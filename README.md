# WebGPU Apple HDR

A minimal iOS and tvOS repro for `react-native-webgpu` **0.21.1**, comparing
`CAMetalLayer.wantsExtendedDynamicRangeContent` with
`CALayer.preferredDynamicRange` **plus `contentsHeadroom`**.

One Metal-backed WebGPU canvas, two white swatches, one slider, two presentation
buttons. The shader, GPU device, texture format, color space and pixel values
stay identical when switching APIs. No Three.js or postprocessing is involved.

## Run

Requires a Mac, Node 22.18+ (Node 24 recommended), CocoaPods, and **Xcode 26 or
newer with the iOS/tvOS 26 SDKs installed**. The patch uses SDK 26 declarations;
runtime checks also let the app run on older OS releases. The app's deployment
target is **iOS 17 / tvOS 17**; API availability is listed separately below.

```sh
git clone https://github.com/stephenreading/webgpu-appleHDR.git
cd webgpu-appleHDR
npm ci

# iPhone / iPad
npm run prebuild:ios
npm run ios
```

For Apple TV instead:

```sh
npm run prebuild:tvos
npm run tvos
```

Prebuild generates `ios/` for **one platform at a time** and deliberately cleans
that generated directory. Re-run the appropriate prebuild when switching.
It preserves the `react-native-tvos` npm alias, which supports phones too.
The build plugin disables Expo's upstream precompiled React Native artifacts
so both builds use the TV fork from source. These are app build settings;
**the WebGPU podspec is unchanged** and 0.21.1 already declares tvOS support.

`expo run:ios` installs pods and starts Metro. Add `-- --device` to either run
command to choose a physical device. This needs a native build; Expo Go does
not include this patched module.

To build in Xcode, install pods after prebuild (`cd ios && pod install && cd ..`),
open `ios/WebGPUAppleHDR.xcworkspace`, choose the `WebGPUAppleHDR` scheme and
an iOS or Apple TV destination, and set your signing team. Change
`ios.bundleIdentifier` in [app.config.js](app.config.js) if necessary. For a
device build without Metro, use Release (`npm run ios -- --configuration Release
--device` or `npm run tvos -- --configuration Release --device`).

## Use the comparison

- **Left:** SDR reference, always linear white **1.0**.
- **Right:** linear white **1 + slider gain**. Gain 0 makes both swatches match;
  gain 10 requests **11× SDR white**. Default gain is 1 on iOS and 10 on tvOS.
- Drag the slider on a phone. On Apple TV, focus it and press left/right
  (0.5 steps); up/down moves to the API buttons. VoiceOver can adjust it too.
- Switch APIs without restarting or changing the gain. Move through 0 → 10 → 0
  and switch back and forth. The value is kept while switching and foregrounding;
  a fresh launch resets it to the platform default.

`contentsHeadroom` stays at **11** throughout the preferred path because that
is this sample's maximum linear luminance ratio. It describes the content;
it is neither a brightness multiplier nor a promise that a display can emit
11× white. The slider changes only a shader uniform, on the next frame.

Use a physical HDR-capable display to assess brightness. Simulators and the
automated GPU test can check rendering but cannot establish real HDR output.
On Apple TV, first select an HDR video format in Settings → Video and Audio
and record the format used. The app declares `UIAppSupportsHDR`; it does **not**
request an HDMI display-mode change. Ambient light, display brightness, power
state and available display headroom may affect the result.

## The patch

[`patches/react-native-webgpu+0.21.1.patch`](patches/react-native-webgpu+0.21.1.patch)
is applied automatically by `patch-package` during `npm ci`. Rebuild the native
app after editing it; a JavaScript reload cannot replace native code.

The sample adds two **experimental, nonstandard native configuration keys**
to select and instrument the comparison:

```js
context.configure({
  device,
  format: 'rgba16float',
  alphaMode: 'opaque',
  colorSpace: 'srgb',
  toneMapping: { mode: 'extended' },
  nativeDynamicRangeMode: 'preferred', // or 'wants-extended'
  nativeContentsHeadroom: 11,
});
```

`nativeContentsHeadroom` accepts 0 (untagged) or a finite value ≥ 1. It is used
only for the preferred path with an extended float canvas. Omitted native
options select the legacy path and headroom 0. The app explicitly selects
`preferred` initially; this experiment does not silently migrate other callers.
The API selector is diagnostic scaffolding, not a proposal to standardize
these options in WebGPU.

Both paths set `toneMapMode = CAToneMapModeNever` wherever that API is
available. This explicitly disables Core Animation tone mapping while testing
HDR activation: highlights exceeding the available display range may clip.
The headroom declaration and API selector keep their existing behavior.

| Selected path | Native settings |
| --- | --- |
| `preferred`, OS 26+ | `preferredDynamicRange = CADynamicRangeHigh`, `contentsHeadroom = 11`; legacy flag cleared wherever available |
| `wants-extended` | Legacy flag enabled wherever available; on OS 26+, clear `contentsHeadroom` to 0 and set `preferredDynamicRange = CADynamicRangeStandard` |
| `preferred`, OS before 26 | No HDR opt-in; legacy flag cleared wherever available. No fallback, so the selected API is actually the one being tested |
| `wants-extended`, tvOS | No legacy call: it is unavailable. The UI labels this as the upstream SDR baseline |

The mode and headroom are stored with the surface configuration and passed to
the existing configuration/resize/attach paths. Selecting another API clears
the inactive path on the persistent Metal layer. The existing transaction
flush is preserved so changes made on the JS thread reach Core Animation.
The app configures between complete frames, keeps the same float format and
pipeline, and presents after each submission.

The patch retains the existing extended-sRGB layer color space. The shader
applies the sRGB transfer function to linear luminance **without clipping at
1** before writing `rgba16float`. There is no PQ encoding, gamut conversion,
tone-mapping pass, or direct native-layer manipulation in the app.

### Exact API availability

Checked against Apple's symbol documentation and SDK 26 headers:

| Platform | `CAMetalLayer.wantsExtendedDynamicRangeContent` | `CALayer.preferredDynamicRange` and `contentsHeadroom` | `CALayer.toneMapMode = .never` |
| --- | --- | --- | --- |
| iOS / iPadOS | 16.0+ | 26.0+ | 18.0+ |
| Mac Catalyst | 16.0+ | 26.0+ | 18.0+ |
| macOS | 10.11+ | 26.0+ | 15.0+ |
| tvOS | **Unavailable** | 26.0+ | 18.0+ |
| visionOS | 1.0+ | 26.0+ | 2.0+ |
| watchOS | Unavailable | Unavailable | Unavailable |

The patch uses an explicit platform allowlist around each call, then an
`@available` check with these versions. In particular, it compiles the legacy
call out of tvOS entirely: a runtime availability check alone cannot make an
API marked unavailable compile. The required `*` in `@available` does not
admit other platforms past that compile-time allowlist.

These are **symbol availability** values, not claims that this sample has
macOS, Catalyst, visionOS or watchOS targets. Only iOS and tvOS are provided.
Also, the `CAMetalLayer` declaration of the legacy property must be distinguished
from `CALayer`'s same-named deprecated property; this repro does not claim Apple
has deprecated the Metal declaration.

Sources:

- Apple: [CAMetalLayer.wantsExtendedDynamicRangeContent](https://developer.apple.com/documentation/quartzcore/cametallayer/wantsextendeddynamicrangecontent)
  ([availability metadata](https://developer.apple.com/documentation/quartzcore/cametallayer/wantsextendeddynamicrangecontent.md)).
- Apple: [CALayer.preferredDynamicRange](https://developer.apple.com/documentation/quartzcore/calayer/preferreddynamicrange)
  ([availability metadata](https://developer.apple.com/documentation/quartzcore/calayer/preferreddynamicrange.md)).
- Apple: [CALayer.contentsHeadroom](https://developer.apple.com/documentation/quartzcore/calayer/contentsheadroom)
  ([availability metadata](https://developer.apple.com/documentation/quartzcore/calayer/contentsheadroom.md)).
- Apple: [CALayer.ToneMapMode.never](https://developer.apple.com/documentation/quartzcore/calayer/tonemapmode-swift.struct/never)
  ([availability metadata](https://developer.apple.com/documentation/quartzcore/calayer/tonemapmode-swift.struct/never.md)).
- SDK 26 header mirror: [CAMetalLayer.h](https://github.com/xybp888/iOS-SDKs/blob/master/iPhoneOS26.0.sdk/System/Library/Frameworks/QuartzCore.framework/Headers/CAMetalLayer.h),
  [CALayer.h](https://github.com/xybp888/iOS-SDKs/blob/master/iPhoneOS26.0.sdk/System/Library/Frameworks/QuartzCore.framework/Headers/CALayer.h).
  `contentsHeadroom`'s header comment explicitly describes its use with
  CAMetalLayer drawables. The installed Xcode SDK remains the build authority.

## Validation

```sh
npm run typecheck
npm test
npx playwright install chromium
npm run test:gpu
# To use a system Chromium instead:
CHROMIUM_PATH=/usr/bin/chromium npm run test:gpu
```

The GPU check executes the **actual app renderer and WGSL**, reads back the
float16 pixels at gains 0, 1, 4, 10, 10, 0, and checks the fixed SDR reference,
unclipped HDR values, alpha, gap and WebGPU validation errors. It uses a browser
for portability; it does not execute the native patch or test Apple's compositor.

Initial automated validation was performed on Linux: TypeScript, configuration
tests, GPU readback, iOS/tvOS prebuild and Metro bundle generation. Native Xcode
compilation and physical iOS/tvOS HDR output still need device verification.
Use [BUG_REPORT.md](BUG_REPORT.md) as a starting point for an upstream issue,
filling in the device observations instead of treating a successful GPU test as
proof of HDR presentation.

## Files to inspect

- [Native patch](patches/react-native-webgpu+0.21.1.patch): the two native paths and availability guards.
- [comparison.ts](src/comparison.ts): canvas configuration, WGSL and slider uniform.
- [GpuComparison.tsx](src/GpuComparison.tsx): context configuration and presentation.
- [App.tsx](App.tsx): the entire screen.
- [withAppleBuild.js](plugins/withAppleBuild.js): platform build settings.
