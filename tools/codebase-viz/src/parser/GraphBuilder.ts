import { type Graph, type GraphNode, type GraphEdge, LAYER_COLORS, LAYER_Y_POSITIONS, ArchitectureLayer } from '../types/graph';
import type { FileInfo } from './FileScanner';
import type { FileImports } from './ImportAnalyzer';

export class GraphBuilder {
  build(
    files: FileInfo[],
    fileImports: FileImports[],
    layers: Map<string, ArchitectureLayer>,
    canvasWidth: number,
    canvasHeight: number
  ): Graph {
    const nodeMap = new Map<string, GraphNode>();
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    // Create nodes
    for (const file of files) {
      const layer = layers.get(file.path) || ArchitectureLayer.UNKNOWN;
      const color = LAYER_COLORS[layer];

      // Initial position based on layer (will be refined by force simulation)
      const layerY = LAYER_Y_POSITIONS[layer];
      const x = (Math.random() - 0.5) * canvasWidth * 0.8;
      const y = (layerY - 0.5) * canvasHeight * 0.8;

      const node: GraphNode = {
        id: file.path,
        path: file.path,
        label: this.getLabel(file.path),
        layer,
        x,
        y,
        vx: 0,
        vy: 0,
        size: 12 + Math.min(file.content.length / 1000, 20), // Size based on file size
        color,
      };

      nodes.push(node);
      nodeMap.set(file.path, node);
    }

    // Create edges from imports
    const edgeSet = new Set<string>();

    for (const fileImport of fileImports) {
      const sourceNode = nodeMap.get(fileImport.path);
      if (!sourceNode) continue;

      for (const imp of fileImport.imports) {
        if (!imp.isRelative || !imp.resolvedPath) continue;

        const targetNode = nodeMap.get(imp.resolvedPath);
        if (!targetNode) continue;

        // Avoid duplicate edges
        const edgeKey = `${fileImport.path}->${imp.resolvedPath}`;
        if (edgeSet.has(edgeKey)) continue;
        edgeSet.add(edgeKey);

        edges.push({
          id: edgeKey,
          source: fileImport.path,
          target: imp.resolvedPath,
          weight: imp.importedNames.length || 1,
        });
      }
    }

    // Adjust node sizes based on connection count
    const incomingEdges = new Map<string, number>();
    for (const edge of edges) {
      incomingEdges.set(edge.target, (incomingEdges.get(edge.target) || 0) + 1);
    }

    for (const node of nodes) {
      const incoming = incomingEdges.get(node.id) || 0;
      node.size = Math.max(8, Math.min(30, node.size + incoming * 2));
    }

    return { nodes, edges, nodeMap };
  }

  private getLabel(path: string): string {
    const parts = path.split('/');
    const filename = parts[parts.length - 1];
    // Remove extension
    return filename.replace(/\.(tsx?|jsx?)$/, '');
  }
}
