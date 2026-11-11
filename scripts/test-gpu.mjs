import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import { chromium } from 'playwright';
import ts from 'typescript';

// Run the actual app renderer and WGSL on WebGPU, then read rgba16float back.
// This checks pixel values, not Apple's compositor or physical HDR output.
const source = fs.readFileSync(new URL('../src/comparison.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText;
const server = http.createServer((request, response) => {
  if (request.url === '/comparison.js') {
    response.setHeader('Content-Type', 'text/javascript');
    response.end(compiled);
  } else response.end('<!doctype html><title>GPU comparison test</title>');
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    headless: true,
    args: ['--no-sandbox', '--enable-unsafe-webgpu', '--use-angle=swiftshader'],
  });
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  const results = await page.evaluate(async () => {
    const { createComparisonRenderer } = await import('/comparison.js');
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error('No WebGPU adapter in test browser.');
    const device = await adapter.requestDevice();
    device.pushErrorScope('validation');
    const renderer = createComparisonRenderer(device);
    const width = 64;
    const texture = device.createTexture({
      size: [width, 32], format: 'rgba16float',
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
    });
    const readback = device.createBuffer({ size: width * 8 * 32,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    function halfToFloat(h) {
      const sign = h & 0x8000 ? -1 : 1;
      const exponent = (h >> 10) & 31;
      const fraction = h & 1023;
      return sign * (exponent ? 2 ** (exponent - 15) * (1 + fraction / 1024) : 2 ** -14 * fraction / 1024);
    }
    const samples = [];
    for (const gain of [0, 1, 4, 10, 10, 0]) {
      renderer.draw(texture, gain);
      const encoder = device.createCommandEncoder();
      encoder.copyTextureToBuffer({ texture }, { buffer: readback, bytesPerRow: width * 8 }, [width, 32]);
      device.queue.submit([encoder.finish()]);
      await readback.mapAsync(GPUMapMode.READ);
      const pixels = new Uint16Array(readback.getMappedRange());
      const at = (x) => Array.from(pixels.slice((16 * width + x) * 4, (16 * width + x) * 4 + 4), halfToFloat);
      samples.push({ gain, left: at(16), right: at(48), gap: at(32) });
      readback.unmap();
    }
    const error = await device.popErrorScope();
    renderer.destroy();
    texture.destroy();
    readback.destroy();
    device.destroy();
    if (error) throw new Error(error.message);
    return samples;
  });
  for (const { gain, left, right, gap } of results) {
    const expected = 1.055 * (1 + gain) ** (1 / 2.4) - 0.055;
    assert.ok(Math.abs(left[0] - 1) < 0.002, 'SDR reference must remain 1');
    assert.ok(Math.abs(right[0] - expected) < 0.004, `HDR gain ${gain}: ${right[0]} vs ${expected}`);
    assert.deepEqual(right.slice(1, 3), right.slice(0, 2), 'white has equal RGB');
    assert.equal(right[3], 1);
    assert.deepEqual(gap, [0, 0, 0, 1]);
  }
  console.log('WebGPU passed: fixed SDR white, live gain 0 → 10 → 0, HDR > 1 retained, black gap, no validation errors.');
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
