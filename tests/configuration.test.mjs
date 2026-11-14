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
  assert.equal(CONTENTS_HEADROOM, 65504);
});

test('unsupported APIs are identified, rather than silently called HDR', () => {
  assert.match(presentationStatus('wants-extended', true, 26), /unavailable on tvOS/);
  assert.match(presentationStatus('preferred', false, 25), /requires OS 26/);
  assert.equal(presentationStatus('preferred', true, 26), '');
});

test('layer tone mapping changes only native presentation, preserving HDR pixels and headroom', () => {
  for (const mode of ['preferred', 'wants-extended']) {
    const off = comparisonConfiguration({}, mode, 'never');
    const on = comparisonConfiguration(off.device, mode, 'if-supported');
    assert.equal(off.nativeToneMapMode, 'never');
    assert.equal(on.nativeToneMapMode, 'if-supported');
    assert.deepEqual({ ...off, nativeToneMapMode: undefined }, { ...on, nativeToneMapMode: undefined });
    assert.equal(on.toneMapping.mode, 'extended');
    assert.equal(on.nativeContentsHeadroom, CONTENTS_HEADROOM);
  }
});
