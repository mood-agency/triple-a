import type { GraphNode } from '../types/graph';
import type { WebGPUContext } from './WebGPUContext';
import { getViewProjectionMatrix, type Camera } from './Camera';
import nodeShaderCode from './shaders/node.wgsl?raw';

export class NodeRenderer {
  private device: GPUDevice;
  private pipeline: GPURenderPipeline;
  private vertexBuffer: GPUBuffer;
  private instanceBuffer: GPUBuffer;
  private uniformBuffer: GPUBuffer;
  private bindGroup: GPUBindGroup;
  private vertexCount: number;
  private maxInstances: number = 10000;
  private instanceCount: number = 0;

  constructor(ctx: WebGPUContext) {
    this.device = ctx.device;

    // Create quad vertices (rectangle)
    const vertices = this.createQuadVertices();
    this.vertexCount = vertices.length / 2;

    this.vertexBuffer = this.device.createBuffer({
      size: vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(this.vertexBuffer, 0, vertices);

    // Instance buffer for node data
    // Per instance: position (2), size (1), color (4), nodeIndex (1) = 8 floats
    this.instanceBuffer = this.device.createBuffer({
      size: this.maxInstances * 8 * 4,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    // Uniform buffer
    this.uniformBuffer = this.device.createBuffer({
      size: 80, // mat4 (64) + vec2 (8) + f32 (4) + f32 (4)
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Shader module
    const shaderModule = this.device.createShaderModule({
      code: nodeShaderCode,
    });

    // Bind group layout
    const bindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' },
        },
      ],
    });

    this.bindGroup = this.device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: { buffer: this.uniformBuffer },
        },
      ],
    });

    // Pipeline
    this.pipeline = this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout],
      }),
      vertex: {
        module: shaderModule,
        entryPoint: 'vertexMain',
        buffers: [
          // Vertex buffer (circle geometry)
          {
            arrayStride: 8,
            stepMode: 'vertex',
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x2' },
            ],
          },
          // Instance buffer
          {
            arrayStride: 32, // 8 floats * 4 bytes
            stepMode: 'instance',
            attributes: [
              { shaderLocation: 1, offset: 0, format: 'float32x2' }, // position
              { shaderLocation: 2, offset: 8, format: 'float32' }, // size
              { shaderLocation: 3, offset: 12, format: 'float32x4' }, // color (offset 12, 16 bytes)
              { shaderLocation: 4, offset: 28, format: 'float32' }, // nodeIndex
            ],
          },
        ],
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fragmentMain',
        targets: [
          {
            format: ctx.format,
            blend: {
              color: {
                srcFactor: 'src-alpha',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
              },
              alpha: {
                srcFactor: 'one',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
              },
            },
          },
        ],
      },
      primitive: {
        topology: 'triangle-list',
      },
    });
  }

  private createQuadVertices(): Float32Array {
    // Two triangles forming a quad, UV coords from -1 to 1
    return new Float32Array([
      // Triangle 1
      -1, -1,
       1, -1,
       1,  1,
      // Triangle 2
      -1, -1,
       1,  1,
      -1,  1,
    ]);
  }

  updateNodes(nodes: GraphNode[]): void {
    this.instanceCount = Math.min(nodes.length, this.maxInstances);
    const data = new Float32Array(this.instanceCount * 8);

    for (let i = 0; i < this.instanceCount; i++) {
      const node = nodes[i];
      const offset = i * 8;

      data[offset + 0] = node.x;
      data[offset + 1] = node.y;
      data[offset + 2] = node.size;
      data[offset + 3] = node.color[0];
      data[offset + 4] = node.color[1];
      data[offset + 5] = node.color[2];
      data[offset + 6] = node.color[3];
      data[offset + 7] = i;
    }

    this.device.queue.writeBuffer(this.instanceBuffer, 0, data);
  }

  updateUniforms(
    camera: Camera,
    width: number,
    height: number,
    time: number,
    hoveredNodeIndex: number
  ): void {
    const viewProj = getViewProjectionMatrix(camera, width, height);
    const uniformData = new Float32Array(20);

    // Copy view projection matrix (16 floats)
    uniformData.set(viewProj, 0);

    // Viewport
    uniformData[16] = width;
    uniformData[17] = height;

    // Time
    uniformData[18] = time;

    // Hovered node
    uniformData[19] = hoveredNodeIndex;

    this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);
  }

  render(pass: GPURenderPassEncoder): void {
    if (this.instanceCount === 0) return;

    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.setVertexBuffer(0, this.vertexBuffer);
    pass.setVertexBuffer(1, this.instanceBuffer);
    pass.draw(this.vertexCount, this.instanceCount);
  }

  destroy(): void {
    this.vertexBuffer.destroy();
    this.instanceBuffer.destroy();
    this.uniformBuffer.destroy();
  }
}
