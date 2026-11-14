# WebGPU Apple HDR

A minimal iOS and tvOS repro for `react-native-webgpu` **0.21.1**, comparing
`CAMetalLayer.wantsExtendedDynamicRangeContent` with
`CALayer.preferredDynamicRange` **plus `contentsHeadroom`**.

One Metal-backed WebGPU canvas, ten fixed grayscale steps, two presentation
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

- The pattern has two rows of five patches, ordered left to right, top to bottom:
  **0.25, 0.5, 1, 1.5, 2, 3, 4, 6, 8, 11× SDR white**.
- Labels describe **linear luminance**, before sRGB encoding. The **1×** patch
  is marked as the SDR-white reference. Label areas and gaps are black.
- Switch APIs without restarting. All ten patches keep identical pixel values
  and positions while switching and foregrounding. On Apple TV, use the Siri
  Remote to select either API button.
- **Tone mapping Off** selects Core Animation's `.never` policy (the default).
  **On** selects `.ifSupported`, requesting system tone mapping where supported.
  This changes layer presentation, while the shader and WebGPU extended mode stay
  fixed. The API buttons, tone-mapping buttons and pattern form one compact group.
- Compare the steps below the display's available headroom, then look for where
  brighter steps clip together. The same fixed pattern is used in Bubblepopalypse's
  Debug menu, independently of its saved highlight gain.

`contentsHeadroom` stays at **11** throughout the preferred path because that
is this sample's maximum linear luminance ratio. It describes the content;
it is neither a brightness multiplier nor a promise that a display can emit
11× white. There is no brightness slider or gain applied to this pattern.

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

The sample adds three **experimental, nonstandard native configuration keys**
to select and instrument the comparison:

```js
context.configure({
  device,
  format: 'rgba16float',
  alphaMode: 'opaque',
  colorSpace: 'srgb',
  toneMapping: { mode: 'extended' },
  nativeDynamicRangeMode: 'preferred', // or 'wants-extended'
  nativeToneMapMode: 'never', // or 'if-supported'
  nativeContentsHeadroom: 11,
});
```

`nativeContentsHeadroom` accepts 0 (untagged) or a finite value ≥ 1. It is used
only for the preferred path with an extended float canvas. Omitted native
options select the legacy path and headroom 0. The app explicitly selects
`preferred` initially; this experiment does not silently migrate other callers.
The API selector is diagnostic scaffolding, not a proposal to standardize
these options in WebGPU.

`nativeToneMapMode` independently selects `CAToneMapModeNever` (Off) or
`CAToneMapModeIfSupported` (On), and defaults to `never` when omitted. The
selection is applied after the range properties, before the transaction flush,
on either API path. With Off, highlights exceeding available display headroom
may clip; On requests system adaptation, whose visible effect depends on the
OS, content and display. A browser readback cannot validate this native effect.

Rebuild the native app after this patch update. An older build ignores the new
configuration key and cannot make the on/off comparison through a JS reload.

| Selected path | Native settings |
| --- | --- |
| `preferred`, OS 26+ | `preferredDynamicRange = CADynamicRangeHigh`, `contentsHeadroom = 11`; legacy flag cleared wherever available |
| `wants-extended` | Legacy flag enabled wherever available; on OS 26+, clear `contentsHeadroom` to 0 and set `preferredDynamicRange = CADynamicRangeStandard` |
| `preferred`, OS before 26 | No HDR opt-in; legacy flag cleared wherever available. No fallback, so the selected API is actually the one being tested |
| `wants-extended`, tvOS | No legacy call: it is unavailable. The UI labels this as the upstream SDR baseline |

The API, tone-mapping policy and headroom are stored with the surface configuration and passed to
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

| Platform | `CAMetalLayer.wantsExtendedDynamicRangeContent` | `CALayer.preferredDynamicRange` and `contentsHeadroom` | `CALayer.toneMapMode` |
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
- Apple: [CALayer.ToneMapMode.ifSupported](https://developer.apple.com/documentation/quartzcore/calayer/tonemapmode-swift.struct/ifsupported).
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

The GPU check executes the **actual app renderer and WGSL**, reads back all ten
steps across repeated frames, and checks their sRGB encoding, unclipped HDR
values, alpha, black label areas and WebGPU validation errors. It uses a browser
for portability; it does not execute the native patch or test Apple's compositor.

Initial automated validation was performed on Linux: TypeScript, configuration
tests, GPU readback, iOS/tvOS prebuild and Metro bundle generation. Native Xcode
compilation and physical iOS/tvOS HDR output still need device verification.
Use [BUG_REPORT.md](BUG_REPORT.md) as a starting point for an upstream issue,
filling in the device observations instead of treating a successful GPU test as
proof of HDR presentation.

## Files to inspect

- [Native patch](patches/react-native-webgpu+0.21.1.patch): the two native paths and availability guards.
- [comparison.ts](src/comparison.ts): canvas configuration, fixed luminance steps and WGSL.
- [GpuComparison.tsx](src/GpuComparison.tsx): context configuration and presentation.
- [App.tsx](App.tsx): the entire screen.
- [withAppleBuild.js](plugins/withAppleBuild.js): platform build settings.
