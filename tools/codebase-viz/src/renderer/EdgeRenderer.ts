import type { GraphNode, GraphEdge } from '../types/graph';
import type { WebGPUContext } from './WebGPUContext';
import { getViewProjectionMatrix, type Camera } from './Camera';
import edgeShaderCode from './shaders/edge.wgsl?raw';

export class EdgeRenderer {
  private device: GPUDevice;
  private pipeline: GPURenderPipeline;
  private vertexBuffer: GPUBuffer;
  private uniformBuffer: GPUBuffer;
  private bindGroup: GPUBindGroup;
  private maxEdges: number = 50000;
  private vertexCount: number = 0;

  constructor(ctx: WebGPUContext) {
    this.device = ctx.device;

    // Vertex buffer for edge data
    // Per vertex: sourcePos (2), targetPos (2), corner (-1 or 1), along (0 or 1) = 6 floats
    // 6 vertices per edge (2 triangles = quad)
    this.vertexBuffer = this.device.createBuffer({
      size: this.maxEdges * 6 * 6 * 4,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    // Uniform buffer (same layout as nodes)
    this.uniformBuffer = this.device.createBuffer({
      size: 80,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Shader module
    const shaderModule = this.device.createShaderModule({
      code: edgeShaderCode,
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
          {
            arrayStride: 24, // 6 floats * 4 bytes
            stepMode: 'vertex',
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x2' }, // sourcePos
              { shaderLocation: 1, offset: 8, format: 'float32x2' }, // targetPos
              { shaderLocation: 2, offset: 16, format: 'float32' }, // corner
              { shaderLocation: 3, offset: 20, format: 'float32' }, // along
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

  updateEdges(edges: GraphEdge[], nodeMap: Map<string, GraphNode>): void {
    const edgeCount = Math.min(edges.length, this.maxEdges);
    const data = new Float32Array(edgeCount * 6 * 6);

    let validEdges = 0;
    let missingNodes = 0;

    for (let i = 0; i < edgeCount; i++) {
      const edge = edges[i];
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);

      if (!source || !target) {
        missingNodes++;
        continue;
      }

      const offset = validEdges * 36; // 6 vertices * 6 floats

      // Triangle 1 (bottom-left, bottom-right, top-left)
      // Vertex 0: source, corner=-1
      data[offset + 0] = source.x;
      data[offset + 1] = source.y;
      data[offset + 2] = target.x;
      data[offset + 3] = target.y;
      data[offset + 4] = -1;
      data[offset + 5] = 0;

      // Vertex 1: source, corner=1
      data[offset + 6] = source.x;
      data[offset + 7] = source.y;
      data[offset + 8] = target.x;
      data[offset + 9] = target.y;
      data[offset + 10] = 1;
      data[offset + 11] = 0;

      // Vertex 2: target, corner=-1
      data[offset + 12] = source.x;
      data[offset + 13] = source.y;
      data[offset + 14] = target.x;
      data[offset + 15] = target.y;
      data[offset + 16] = -1;
      data[offset + 17] = 1;

      // Triangle 2 (bottom-right, top-right, top-left)
      // Vertex 3: source, corner=1
      data[offset + 18] = source.x;
      data[offset + 19] = source.y;
      data[offset + 20] = target.x;
      data[offset + 21] = target.y;
      data[offset + 22] = 1;
      data[offset + 23] = 0;

      // Vertex 4: target, corner=1
      data[offset + 24] = source.x;
      data[offset + 25] = source.y;
      data[offset + 26] = target.x;
      data[offset + 27] = target.y;
      data[offset + 28] = 1;
      data[offset + 29] = 1;

      // Vertex 5: target, corner=-1
      data[offset + 30] = source.x;
      data[offset + 31] = source.y;
      data[offset + 32] = target.x;
      data[offset + 33] = target.y;
      data[offset + 34] = -1;
      data[offset + 35] = 1;

      validEdges++;
    }

    this.vertexCount = validEdges * 6;
    console.log(`EdgeRenderer: ${validEdges} valid edges, ${missingNodes} missing nodes, vertexCount=${this.vertexCount}`);
    if (validEdges > 0) {
      this.device.queue.writeBuffer(this.vertexBuffer, 0, data.subarray(0, validEdges * 36));
    }
  }

  updateUniforms(
    camera: Camera,
    width: number,
    height: number,
    time: number,
    opacity: number = 0.15
  ): void {
    const viewProj = getViewProjectionMatrix(camera, width, height);
    const uniformData = new Float32Array(20);

    uniformData.set(viewProj, 0);
    uniformData[16] = width;
    uniformData[17] = height;
    uniformData[18] = time;
    uniformData[19] = opacity;

    this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);
  }

  render(pass: GPURenderPassEncoder): void {
    if (this.vertexCount === 0) {
      return;
    }

    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.setVertexBuffer(0, this.vertexBuffer);
    pass.draw(this.vertexCount);
  }

  getVertexCount(): number {
    return this.vertexCount;
  }

  destroy(): void {
    this.vertexBuffer.destroy();
    this.uniformBuffer.destroy();
  }
}
