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
    const { createComparisonRenderer, GRAYSCALE_STEPS, STEP_COLUMNS, STEP_ROWS } = await import('/comparison.js');
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error('No WebGPU adapter in test browser.');
    const device = await adapter.requestDevice();
    device.pushErrorScope('validation');
    const renderer = createComparisonRenderer(device);
    const width = 320, height = 128;
    const texture = device.createTexture({
      size: [width, height], format: 'rgba16float',
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
    });
    const readback = device.createBuffer({ size: width * 8 * height,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    function halfToFloat(h) {
      const sign = h & 0x8000 ? -1 : 1;
      const exponent = (h >> 10) & 31;
      const fraction = h & 1023;
      return sign * (exponent ? 2 ** (exponent - 15) * (1 + fraction / 1024) : 2 ** -14 * fraction / 1024);
    }
    const samples = [];
    for (let frame = 0; frame < 2; frame++) {
      renderer.draw(texture);
      const encoder = device.createCommandEncoder();
      encoder.copyTextureToBuffer({ texture }, { buffer: readback, bytesPerRow: width * 8 }, [width, height]);
      device.queue.submit([encoder.finish()]);
      await readback.mapAsync(GPUMapMode.READ);
      const pixels = new Uint16Array(readback.getMappedRange());
      const at = (x, y) => {
        const offset = (Math.floor(y) * width + Math.floor(x)) * 4;
        return Array.from(pixels.slice(offset, offset + 4), halfToFloat);
      };
      samples.push({
        patches: GRAYSCALE_STEPS.map((value, i) => ({ value,
          rgba: at((i % STEP_COLUMNS + 0.5) * width / STEP_COLUMNS,
            (Math.floor(i / STEP_COLUMNS) + 0.35) * height / STEP_ROWS),
        })),
        border: at(0, 0),
        labelArea: at(width / STEP_COLUMNS * 0.5, height / STEP_ROWS * 0.85),
      });
      readback.unmap();
    }
    const error = await device.popErrorScope();
    texture.destroy();
    readback.destroy();
    device.destroy();
    if (error) throw new Error(error.message);
    return samples;
  });
  for (const { patches, border, labelArea } of results) {
    assert.deepEqual(patches.map(p => p.value), [0.25, 0.5, 1, 1.5, 2, 3, 4, 6, 8, 11]);
    for (const { value, rgba } of patches) {
      const expected = 1.055 * value ** (1 / 2.4) - 0.055;
      assert.ok(Math.abs(rgba[0] - expected) < 0.004, `Step ${value}: ${rgba[0]} vs ${expected}`);
      assert.deepEqual(rgba.slice(1, 3), rgba.slice(0, 2), 'gray has equal RGB');
      assert.equal(rgba[3], 1);
    }
    assert.deepEqual(border, [0, 0, 0, 1]);
    assert.deepEqual(labelArea, [0, 0, 0, 1]);
  }
  assert.deepEqual(results[0], results[1], 'the fixed pattern must not change between frames');
  console.log('WebGPU passed: all ten grayscale steps, sRGB encoding, HDR > 1 retained, black label areas, stable frames, no validation errors.');
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
