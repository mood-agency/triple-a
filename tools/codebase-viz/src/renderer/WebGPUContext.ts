export interface WebGPUContext {
  device: GPUDevice;
  context: GPUCanvasContext;
  format: GPUTextureFormat;
  canvas: HTMLCanvasElement;
}

export async function initWebGPU(canvas: HTMLCanvasElement): Promise<WebGPUContext> {
  if (!navigator.gpu) {
    throw new Error('WebGPU not supported in this browser');
  }

  const adapter = await navigator.gpu.requestAdapter({
    powerPreference: 'high-performance',
  });

  if (!adapter) {
    throw new Error('No GPU adapter found');
  }

  const device = await adapter.requestDevice({
    requiredFeatures: [],
    requiredLimits: {},
  });

  device.lost.then((info) => {
    console.error('WebGPU device lost:', info.message);
    if (info.reason !== 'destroyed') {
      // Try to recover
      initWebGPU(canvas);
    }
  });

  const context = canvas.getContext('webgpu');
  if (!context) {
    throw new Error('Failed to get WebGPU context');
  }

  const format = navigator.gpu.getPreferredCanvasFormat();

  context.configure({
    device,
    format,
    alphaMode: 'premultiplied',
  });

  return { device, context, format, canvas };
}

export function resizeCanvas(ctx: WebGPUContext): { width: number; height: number } {
  const dpr = window.devicePixelRatio || 1;
  const displayWidth = Math.floor(ctx.canvas.clientWidth * dpr);
  const displayHeight = Math.floor(ctx.canvas.clientHeight * dpr);

  if (ctx.canvas.width !== displayWidth || ctx.canvas.height !== displayHeight) {
    ctx.canvas.width = displayWidth;
    ctx.canvas.height = displayHeight;

    ctx.context.configure({
      device: ctx.device,
      format: ctx.format,
      alphaMode: 'premultiplied',
    });
  }

  return { width: displayWidth, height: displayHeight };
}
