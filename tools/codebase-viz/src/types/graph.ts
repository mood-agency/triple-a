export enum ArchitectureLayer {
  COMPONENT = 'component',
  HOOK = 'hook',
  DATA = 'data',
  API = 'api',
  UTILITY = 'utility',
  TYPE = 'type',
  UNKNOWN = 'unknown',
}

export interface GraphNode {
  id: string;
  path: string;
  label: string;
  layer: ArchitectureLayer;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: [number, number, number, number];
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  weight: number;
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  nodeMap: Map<string, GraphNode>;
}

export const LAYER_COLORS: Record<ArchitectureLayer, [number, number, number, number]> = {
  [ArchitectureLayer.COMPONENT]: [0.38, 0.72, 0.95, 1.0], // #61B8F2
  [ArchitectureLayer.HOOK]: [0.67, 0.51, 0.90, 1.0], // #AB82E6
  [ArchitectureLayer.DATA]: [0.30, 0.80, 0.55, 1.0], // #4DCC8D
  [ArchitectureLayer.API]: [0.95, 0.61, 0.32, 1.0], // #F39C52
  [ArchitectureLayer.UTILITY]: [0.60, 0.60, 0.60, 1.0], // #999999
  [ArchitectureLayer.TYPE]: [0.80, 0.72, 0.45, 1.0], // #CCB873
  [ArchitectureLayer.UNKNOWN]: [0.50, 0.50, 0.50, 1.0], // #808080
};

export const LAYER_Y_POSITIONS: Record<ArchitectureLayer, number> = {
  [ArchitectureLayer.COMPONENT]: 0.15,
  [ArchitectureLayer.HOOK]: 0.35,
  [ArchitectureLayer.DATA]: 0.55,
  [ArchitectureLayer.API]: 0.75,
  [ArchitectureLayer.UTILITY]: 0.5,
  [ArchitectureLayer.TYPE]: 0.9,
  [ArchitectureLayer.UNKNOWN]: 0.5,
};
