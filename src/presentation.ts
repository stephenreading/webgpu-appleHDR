import type { PresentationMode } from './comparison';

export function presentationStatus(mode: PresentationMode, isTV: boolean, version: number) {
  if (mode === 'wants-extended') {
    return isTV
      ? 'Legacy unavailable on tvOS'
      : '';
  }
  return version >= 26
    ? ''
    : 'Preferred requires OS 26+';
}
