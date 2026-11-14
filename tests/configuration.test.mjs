import assert from 'node:assert/strict';
import test from 'node:test';
import { comparisonConfiguration, CONTENTS_HEADROOM, GRAYSCALE_STEPS } from '../src/comparison.ts';
import { presentationStatus } from '../src/presentation.ts';

test('the A/B comparison changes only the presentation API', () => {
  const device = {};
  const preferred = comparisonConfiguration(device, 'preferred');
  const legacy = comparisonConfiguration(device, 'wants-extended');
  assert.deepEqual({ ...preferred, nativeDynamicRangeMode: undefined },
    { ...legacy, nativeDynamicRangeMode: undefined });
  assert.equal(preferred.format, 'rgba16float');
  assert.equal(preferred.colorSpace, 'srgb');
  assert.equal(preferred.toneMapping.mode, 'extended');
  assert.equal(preferred.nativeContentsHeadroom, Math.max(...GRAYSCALE_STEPS));
  assert.equal(CONTENTS_HEADROOM, 11);
});

test('unsupported APIs are identified, rather than silently called HDR', () => {
  assert.match(presentationStatus('wants-extended', true, 26), /Unavailable on tvOS/);
  assert.match(presentationStatus('preferred', false, 25), /Requires iOS \/ tvOS 26/);
  assert.match(presentationStatus('preferred', true, 26), /contentsHeadroom = 11/);
});
