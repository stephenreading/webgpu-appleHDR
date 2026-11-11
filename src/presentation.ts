import type { PresentationMode } from './comparison';

export function presentationStatus(mode: PresentationMode, isTV: boolean, version: number) {
  if (mode === 'wants-extended') {
    return isTV
      ? 'Unavailable on tvOS — this is the upstream SDR baseline.'
      : 'CAMetalLayer.wantsExtendedDynamicRangeContent = true';
  }
  return version >= 26
    ? 'preferredDynamicRange = high · contentsHeadroom = 11'
    : 'Requires iOS / tvOS 26 or later — no legacy fallback in this A/B test.';
}
