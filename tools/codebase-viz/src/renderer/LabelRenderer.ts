import type { GraphNode } from '../types/graph';
import type { Camera } from './Camera';
import { worldToScreen } from './Camera';

export class LabelRenderer {
  private container: HTMLElement;
  private labels: Map<string, HTMLElement> = new Map();
  private visible = true;

  constructor(container: HTMLElement) {
    this.container = container;

    // Create labels container
    const labelsDiv = document.createElement('div');
    labelsDiv.id = 'node-labels';
    labelsDiv.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      overflow: hidden;
    `;
    this.container.appendChild(labelsDiv);
    this.container = labelsDiv;
  }

  updateLabels(
    nodes: GraphNode[],
    camera: Camera,
    canvasWidth: number,
    canvasHeight: number
  ): void {
    if (!this.visible) return;

    const dpr = window.devicePixelRatio || 1;
    const visibleLabels = new Set<string>();

    // Only show labels when zoomed in enough
    const showLabels = camera.zoom > 0.5;

    for (const node of nodes) {
      const [screenX, screenY] = worldToScreen(
        camera,
        node.x,
        node.y,
        canvasWidth,
        canvasHeight
      );

      // Check if on screen
      const margin = 100;
      const isVisible =
        showLabels &&
        screenX / dpr > -margin &&
        screenX / dpr < canvasWidth / dpr + margin &&
        screenY / dpr > -margin &&
        screenY / dpr < canvasHeight / dpr + margin;

      if (isVisible) {
        visibleLabels.add(node.id);

        let label = this.labels.get(node.id);
        if (!label) {
          label = this.createLabel(node);
          this.labels.set(node.id, label);
          this.container.appendChild(label);
        }

        // Position label
        const x = screenX / dpr;
        const y = screenY / dpr;
        label.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
        label.style.display = 'block';

        // Scale based on zoom
        const scale = Math.min(1, camera.zoom * 0.8);
        label.style.fontSize = `${10 * scale}px`;
      }
    }

    // Hide labels for nodes not visible
    for (const [id, label] of this.labels) {
      if (!visibleLabels.has(id)) {
        label.style.display = 'none';
      }
    }
  }

  private createLabel(node: GraphNode): HTMLElement {
    const label = document.createElement('div');
    label.className = 'node-label';
    label.textContent = node.label;
    label.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      color: white;
      font-size: 10px;
      font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
      white-space: nowrap;
      text-shadow: 0 1px 2px rgba(0,0,0,0.8);
      pointer-events: none;
      user-select: none;
    `;
    return label;
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.container.style.display = visible ? 'block' : 'none';
  }

  clear(): void {
    for (const label of this.labels.values()) {
      label.remove();
    }
    this.labels.clear();
  }

  destroy(): void {
    this.clear();
    this.container.remove();
  }
}
