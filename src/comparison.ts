export type PresentationMode = 'preferred' | 'wants-extended';

export const MAX_GAIN = 10;
export const CONTENTS_HEADROOM = 1 + MAX_GAIN;
export const FORMAT: GPUTextureFormat = 'rgba16float';

// This canvas is tagged kCGColorSpaceExtendedSRGB by react-native-webgpu.
// Encode linear light with the sRGB transfer function, retaining values > 1.
export const SHADER = /* wgsl */ `
@group(0) @binding(0) var<uniform> params: vec4f;

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
  let left = in.uv.x > 0.06 && in.uv.x < 0.44;
  let right = in.uv.x > 0.56 && in.uv.x < 0.94;
  let inside = in.uv.y > 0.12 && in.uv.y < 0.88;
  if (!inside || (!left && !right)) { return vec4f(0, 0, 0, 1); }
  let linearWhite = select(1.0, 1.0 + params.x, right);
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
  const module = device.createShaderModule({ label: 'SDR / HDR white', code: SHADER });
  const pipeline = device.createRenderPipeline({
    label: 'SDR / HDR comparison',
    layout: 'auto',
    vertex: { module, entryPoint: 'vertexMain' },
    fragment: { module, entryPoint: 'fragmentMain', targets: [{ format: FORMAT }] },
    primitive: { topology: 'triangle-list' },
  });
  const uniform = device.createBuffer({
    label: 'HDR gain', size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: uniform } }],
  });
  return {
    draw(texture: GPUTexture, gain: number) {
      const safeGain = Number.isFinite(gain) ? Math.max(0, Math.min(MAX_GAIN, gain)) : 0;
      device.queue.writeBuffer(uniform, 0, new Float32Array([safeGain, 0, 0, 0]));
      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({
        colorAttachments: [{
          view: texture.createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: 'clear', storeOp: 'store',
        }],
      });
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.draw(3);
      pass.end();
      device.queue.submit([encoder.finish()]);
    },
    destroy() { uniform.destroy(); },
  };
}
