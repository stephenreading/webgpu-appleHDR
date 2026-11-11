# Suggested title

tvOS extended canvas presentation: test preferredDynamicRange + contentsHeadroom on OS 26+

# Issue body

`react-native-webgpu` 0.21.1 supports building for tvOS, but its Apple
presentation helper uses `CAMetalLayer.wantsExtendedDynamicRangeContent` for
extended float canvases. That property is unavailable on tvOS and is compiled
out there, so selecting `toneMapping: { mode: 'extended' }` does not opt the
tvOS layer into HDR through that API.

On OS 26+, `CALayer.preferredDynamicRange` and `contentsHeadroom` are available
on tvOS as well as iOS. I would like to investigate using them for extended
float canvas presentation. The SDK header explicitly describes
`contentsHeadroom` as applicable to CAMetalLayer drawables. Setting the preferred
range alone appeared insufficient in my earlier iPhone experiment; also
declaring the content headroom improved the result. This minimal project is
intended to make that comparison reproducible.

Repro: https://github.com/stephenreading/webgpu-appleHDR

It pins WebGPU 0.21.1 and includes a `patch-package` patch adding an experimental
runtime selector. Both modes render the same shader into `rgba16float`, with
`colorSpace: 'srgb'` and `toneMapping: { mode: 'extended' }`. The layer remains
extended sRGB. No PQ pass or Three.js is involved.

1. Build on Xcode 26+ following the README, and run on an HDR-capable physical device.
2. Start with gain 0: the left and right whites should match.
3. Raise the slider to 10: the right swatch becomes linear 11× SDR white;
   the left remains 1×. Pixels are sRGB-encoded before being written to float16.
4. Switch between the legacy Metal flag and `preferredDynamicRange = high`
   plus `contentsHeadroom = 11`, keeping the gain unchanged.
5. Switch back and forth, return to gain 0, and background/foreground the app.
6. On Apple TV, record the selected HDMI video format. The app does not request
   a display-mode switch. The legacy path is an intentionally unavailable/SDR baseline there.

Expected investigation: on supported OS releases and displays, the preferred
path should allow the extended canvas to use available HDR headroom. We should
retain a suitable legacy fallback for older supported systems in any production
change. The repro deliberately has no fallback when explicitly selecting the
preferred API, to keep the A/B test honest.

Please fill in actual observations before submitting:

| Device / OS | Display / video format | Legacy at gain 0 / 10 | Preferred + headroom at gain 0 / 10 | Switching / foreground result |
| --- | --- | --- | --- | --- |
| iPhone or iPad: … | … | … | … | … |
| Apple TV: … | … | Unavailable / SDR baseline | … | … |

Xcode version: …
Repro commit: …
Brightness / ambient light / power conditions: …

The README links Apple's exact availability declarations. The new APIs start
at 26.0 on iOS/iPadOS, Catalyst, macOS, tvOS and visionOS. The Metal legacy flag
starts at iOS/iPadOS/Catalyst 16.0, macOS 10.11 and visionOS 1.0, and is
unavailable on tvOS/watchOS. The patch includes compile-time platform allowlists
and runtime version checks; it does not use a selector bypass.

The experimental native configuration keys are test instrumentation, not a
request to expose those exact options publicly. A production design would
also need to settle how content headroom is supplied, legacy fallback behavior,
and interaction with system display policy. The sample's 11 is a content-specific
value, not a universal headroom default.
