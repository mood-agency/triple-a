import { ArchitectureLayer, LAYER_Y_POSITIONS } from '../types/graph';

interface NodeData {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  layer: ArchitectureLayer;
}

interface EdgeData {
  source: string;
  target: string;
  weight: number;
}

interface SimulationConfig {
  width: number;
  height: number;
  repulsionStrength: number;
  attractionStrength: number;
  layerStrength: number;
  damping: number;
  maxVelocity: number;
}

interface InitMessage {
  type: 'init';
  nodes: NodeData[];
  edges: EdgeData[];
  config: SimulationConfig;
}

interface StepMessage {
  type: 'step';
  iterations: number;
}

interface StopMessage {
  type: 'stop';
}

type WorkerMessage = InitMessage | StepMessage | StopMessage;

let nodes: NodeData[] = [];
let edges: EdgeData[] = [];
let nodeMap: Map<string, NodeData> = new Map();
let config: SimulationConfig = {
  width: 1920,
  height: 1080,
  repulsionStrength: 500,
  attractionStrength: 0.005,
  layerStrength: 0.02,
  damping: 0.9,
  maxVelocity: 50,
};
let running = false;

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const message = e.data;

  switch (message.type) {
    case 'init':
      nodes = message.nodes;
      edges = message.edges;
      config = { ...config, ...message.config };
      nodeMap = new Map(nodes.map((n) => [n.id, n]));
      running = true;
      break;

    case 'step':
      if (!running) return;
      for (let i = 0; i < message.iterations; i++) {
        simulate();
      }
      sendPositions();
      break;

    case 'stop':
      running = false;
      break;
  }
};

function simulate(): void {
  // Reset velocities
  for (const node of nodes) {
    node.vx = 0;
    node.vy = 0;
  }

  // Repulsive forces between all nodes (quadratic but works for <1000 nodes)
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const nodeA = nodes[i];
      const nodeB = nodes[j];

      const dx = nodeB.x - nodeA.x;
      const dy = nodeB.y - nodeA.y;
      const distSq = dx * dx + dy * dy;
      const dist = Math.sqrt(distSq) || 0.1;

      // Repulsion force (inverse square law)
      const force = config.repulsionStrength / distSq;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;

      nodeA.vx -= fx;
      nodeA.vy -= fy;
      nodeB.vx += fx;
      nodeB.vy += fy;
    }
  }

  // Attractive forces along edges
  for (const edge of edges) {
    const source = nodeMap.get(edge.source);
    const target = nodeMap.get(edge.target);
    if (!source || !target) continue;

    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;

    // Spring force (Hooke's law)
    const force = dist * config.attractionStrength * edge.weight;
    const fx = (dx / dist) * force;
    const fy = (dy / dist) * force;

    source.vx += fx;
    source.vy += fy;
    target.vx -= fx;
    target.vy -= fy;
  }

  // Layer separation forces (keep architecture layers vertically separated)
  for (const node of nodes) {
    const targetY = (LAYER_Y_POSITIONS[node.layer] - 0.5) * config.height * 0.8;
    const dy = targetY - node.y;
    node.vy += dy * config.layerStrength;
  }

  // Apply velocities with damping and bounds
  for (const node of nodes) {
    // Apply damping
    node.vx *= config.damping;
    node.vy *= config.damping;

    // Clamp velocity
    const speed = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
    if (speed > config.maxVelocity) {
      node.vx = (node.vx / speed) * config.maxVelocity;
      node.vy = (node.vy / speed) * config.maxVelocity;
    }

    // Update positions
    node.x += node.vx;
    node.y += node.vy;

    // Keep within bounds
    const padding = 50;
    const halfWidth = config.width / 2 - padding;
    const halfHeight = config.height / 2 - padding;

    node.x = Math.max(-halfWidth, Math.min(halfWidth, node.x));
    node.y = Math.max(-halfHeight, Math.min(halfHeight, node.y));
  }
}

function sendPositions(): void {
  const positions = new Float32Array(nodes.length * 2);
  for (let i = 0; i < nodes.length; i++) {
    positions[i * 2] = nodes[i].x;
    positions[i * 2 + 1] = nodes[i].y;
  }

  self.postMessage(
    {
      type: 'positions',
      positions: positions.buffer,
    },
    { transfer: [positions.buffer] }
  );
}
