export type PresentationMode = 'preferred' | 'wants-extended';

export const GRAYSCALE_STEPS = [0.25, 0.5, 1, 1.5, 2, 3, 4, 6, 8, 11] as const;
export const STEP_COLUMNS = 5;
export const STEP_ROWS = 2;
export const CONTENTS_HEADROOM = Math.max(...GRAYSCALE_STEPS);
export const FORMAT: GPUTextureFormat = 'rgba16float';

// This canvas is tagged kCGColorSpaceExtendedSRGB by react-native-webgpu.
// Encode linear light with the sRGB transfer function, retaining values > 1.
export const SHADER = /* wgsl */ `
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@vertex fn vertexMain(@builtin(vertex_index) index: u32) -> VertexOutput {
  let positions = array<vec2f, 3>(vec2f(-1, -1), vec2f(3, -1), vec2f(-1, 3));
  var out: VertexOutput;
  out.position = vec4f(positions[index], 0, 1);
  out.uv = positions[index] * 0.5 + 0.5;
  return out;
}

fn encodeSRGB(linear: f32) -> f32 {
  if (linear <= 0.0031308) { return 12.92 * linear; }
  return 1.055 * pow(linear, 1.0 / 2.4) - 0.055;
}

@fragment fn fragmentMain(in: VertexOutput) -> @location(0) vec4f {
  let grid = vec2f(in.uv.x * ${STEP_COLUMNS}.0, (1.0 - in.uv.y) * ${STEP_ROWS}.0);
  let cell = fract(grid);
  if (cell.x < 0.08 || cell.x > 0.92 || cell.y < 0.08 || cell.y > 0.64) {
    return vec4f(0, 0, 0, 1);
  }
  let index = min(u32(floor(grid.y)) * ${STEP_COLUMNS}u + u32(floor(grid.x)), ${GRAYSCALE_STEPS.length - 1}u);
  let steps = array<f32, ${GRAYSCALE_STEPS.length}>(${GRAYSCALE_STEPS.map(v => v.toFixed(2)).join(', ')});
  let linearWhite = steps[index];
  let encodedWhite = encodeSRGB(linearWhite);
  return vec4f(vec3f(encodedWhite), 1);
}
`;

// These two native* keys are experimental additions in the bundled patch,
// not standard WebGPU options. The remaining configuration is identical.
export function comparisonConfiguration(device: GPUDevice, mode: PresentationMode) {
  return {
    device,
    format: FORMAT,
    alphaMode: 'opaque',
    colorSpace: 'srgb',
    toneMapping: { mode: 'extended' },
    nativeDynamicRangeMode: mode,
    nativeContentsHeadroom: CONTENTS_HEADROOM,
  } satisfies GPUCanvasConfiguration & {
    nativeDynamicRangeMode: PresentationMode;
    nativeContentsHeadroom: number;
  };
}

export function createComparisonRenderer(device: GPUDevice) {
  const module = device.createShaderModule({ label: 'Stepped grayscale', code: SHADER });
  const pipeline = device.createRenderPipeline({
    label: 'SDR / HDR comparison',
    layout: 'auto',
    vertex: { module, entryPoint: 'vertexMain' },
    fragment: { module, entryPoint: 'fragmentMain', targets: [{ format: FORMAT }] },
    primitive: { topology: 'triangle-list' },
  });
  return {
    draw(texture: GPUTexture) {
      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({
        colorAttachments: [{
          view: texture.createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: 'clear', storeOp: 'store',
        }],
      });
      pass.setPipeline(pipeline);
      pass.draw(3);
      pass.end();
      device.queue.submit([encoder.finish()]);
    },
  };
}
