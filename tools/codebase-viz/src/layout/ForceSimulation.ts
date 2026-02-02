import type { GraphNode, GraphEdge } from '../types/graph';
import ForceWorker from './force.worker?worker';

export interface SimulationConfig {
  width: number;
  height: number;
  repulsionStrength?: number;
  attractionStrength?: number;
  layerStrength?: number;
  damping?: number;
  maxVelocity?: number;
}

export class ForceSimulation {
  private worker: Worker;
  private nodes: GraphNode[] = [];
  private onUpdate?: (positions: Float32Array) => void;
  private running = false;
  private animationFrameId: number | null = null;

  constructor() {
    this.worker = new ForceWorker();
    this.worker.onmessage = this.handleWorkerMessage.bind(this);
  }

  init(
    nodes: GraphNode[],
    edges: GraphEdge[],
    config: SimulationConfig,
    onUpdate: (positions: Float32Array) => void
  ): void {
    this.nodes = nodes;
    this.onUpdate = onUpdate;

    const nodeData = nodes.map((n) => ({
      id: n.id,
      x: n.x,
      y: n.y,
      vx: n.vx,
      vy: n.vy,
      size: n.size,
      layer: n.layer,
    }));

    const edgeData = edges.map((e) => ({
      source: e.source,
      target: e.target,
      weight: e.weight,
    }));

    this.worker.postMessage({
      type: 'init',
      nodes: nodeData,
      edges: edgeData,
      config,
    });
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.step();
  }

  stop(): void {
    this.running = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.worker.postMessage({ type: 'stop' });
  }

  private step(): void {
    if (!this.running) return;

    this.worker.postMessage({
      type: 'step',
      iterations: 1,
    });

    this.animationFrameId = requestAnimationFrame(() => this.step());
  }

  private handleWorkerMessage(e: MessageEvent): void {
    if (e.data.type === 'positions') {
      const positions = new Float32Array(e.data.positions);

      // Update node positions
      for (let i = 0; i < this.nodes.length && i < positions.length / 2; i++) {
        this.nodes[i].x = positions[i * 2];
        this.nodes[i].y = positions[i * 2 + 1];
      }

      this.onUpdate?.(positions);
    }
  }

  destroy(): void {
    this.stop();
    this.worker.terminate();
  }
}
