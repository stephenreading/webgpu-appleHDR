import { useEffect, useRef } from 'react';
import { AppState, PixelRatio, StyleSheet } from 'react-native';
import { Canvas, type CanvasRef, type RNCanvasContext } from 'react-native-webgpu';
import { comparisonConfiguration, createComparisonRenderer, type PresentationMode } from './comparison';

export function GpuComparison({ gain, mode, onError }: {
  gain: number;
  mode: PresentationMode;
  onError: (message: string) => void;
}) {
  const canvasRef = useRef<CanvasRef>(null);
  const latest = useRef({ gain, mode, onError });
  latest.current = { gain, mode, onError };
  const size = useRef({ width: 0, height: 0 });

  useEffect(() => {
    let cancelled = false;
    let frame = 0;
    let device: GPUDevice | undefined;
    let context: RNCanvasContext | null = null;
    let renderer: ReturnType<typeof createComparisonRenderer> | undefined;
    let configuredMode: PresentationMode | undefined;
    let active = AppState.currentState === 'active';
    const subscription = AppState.addEventListener('change', (state) => {
      active = state === 'active';
      // Apply metadata again after foregrounding, before the next drawable.
      if (active) configuredMode = undefined;
    });
    const fail = (error: unknown) => {
      if (!cancelled) latest.current.onError(String(error));
    };

    const render = () => {
      if (cancelled) return;
      try {
        const layout = size.current;
        if (active && layout.width > 0 && layout.height > 0) {
          // Get one context for the lifetime of this Canvas.
          context ??= canvasRef.current?.getContext('webgpu') ?? null;
          if (context && device && renderer) {
            const width = Math.max(1, Math.round(layout.width * PixelRatio.get()));
            const height = Math.max(1, Math.round(layout.height * PixelRatio.get()));
            if (context.canvas.width !== width) context.canvas.width = width;
            if (context.canvas.height !== height) context.canvas.height = height;
            const current = latest.current;
            if (configuredMode !== current.mode) {
              // Reconfigure between complete frames, never while holding a
              // drawable. The float format, shader and device stay the same.
              context.configure(comparisonConfiguration(device, current.mode));
              configuredMode = current.mode;
            }
            renderer.draw(context.getCurrentTexture(), current.gain);
            context.present();
          }
        }
        frame = requestAnimationFrame(render);
      } catch (error) { fail(error); }
    };

    void (async () => {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) throw new Error('No WebGPU adapter.');
      if (cancelled) return;
      const created = await adapter.requestDevice();
      if (cancelled) { created.destroy(); return; }
      device = created;
      device.addEventListener('uncapturederror', (event) => fail(event.error.message));
      void device.lost.then((info) => {
        if (!cancelled) fail(`GPU device lost: ${info.message}`);
      });
      renderer = createComparisonRenderer(device);
      frame = requestAnimationFrame(render);
    })().catch(fail);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      subscription.remove();
      // Release the surface's device reference before destroying its device.
      context?.unconfigure();
      renderer?.destroy();
      device?.destroy();
    };
  }, []);

  return <Canvas ref={canvasRef} style={styles.canvas}
    onLayout={(event) => { size.current = event.nativeEvent.layout; }} />;
}

const styles = StyleSheet.create({ canvas: { flex: 1, backgroundColor: '#000' } });
