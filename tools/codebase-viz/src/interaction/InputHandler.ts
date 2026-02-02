import type { Camera } from '../renderer/Camera';
import { screenToWorld } from '../renderer/Camera';
import type { GraphNode } from '../types/graph';

export interface InputState {
  mouseX: number;
  mouseY: number;
  worldX: number;
  worldY: number;
  isDragging: boolean;
  dragStartX: number;
  dragStartY: number;
  cameraDragStartX: number;
  cameraDragStartY: number;
  hoveredNode: GraphNode | null;
  hoveredNodeIndex: number;
}

export class InputHandler {
  private canvas: HTMLCanvasElement;
  private camera: Camera;
  private state: InputState;
  private nodes: GraphNode[] = [];
  private onHoverChange?: (node: GraphNode | null) => void;

  constructor(
    canvas: HTMLCanvasElement,
    camera: Camera,
    onHoverChange?: (node: GraphNode | null) => void
  ) {
    this.canvas = canvas;
    this.camera = camera;
    this.onHoverChange = onHoverChange;

    this.state = {
      mouseX: 0,
      mouseY: 0,
      worldX: 0,
      worldY: 0,
      isDragging: false,
      dragStartX: 0,
      dragStartY: 0,
      cameraDragStartX: 0,
      cameraDragStartY: 0,
      hoveredNode: null,
      hoveredNodeIndex: -1,
    };

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.canvas.addEventListener('wheel', this.handleWheel, { passive: false });
    this.canvas.addEventListener('mousedown', this.handleMouseDown);
    this.canvas.addEventListener('mousemove', this.handleMouseMove);
    this.canvas.addEventListener('mouseup', this.handleMouseUp);
    this.canvas.addEventListener('mouseleave', this.handleMouseLeave);
  }

  private handleWheel = (e: WheelEvent): void => {
    e.preventDefault();

    const rect = this.canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) * window.devicePixelRatio;
    const mouseY = (e.clientY - rect.top) * window.devicePixelRatio;

    // Zoom toward mouse position
    const [worldXBefore] = screenToWorld(
      this.camera,
      mouseX,
      mouseY,
      this.canvas.width,
      this.canvas.height
    );
    const [, worldYBefore] = screenToWorld(
      this.camera,
      mouseX,
      mouseY,
      this.canvas.width,
      this.canvas.height
    );

    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    this.camera.zoom = Math.max(
      this.camera.minZoom,
      Math.min(this.camera.maxZoom, this.camera.zoom * zoomFactor)
    );

    const [worldXAfter, worldYAfter] = screenToWorld(
      this.camera,
      mouseX,
      mouseY,
      this.canvas.width,
      this.canvas.height
    );

    // Adjust camera to keep mouse position stable
    this.camera.x += worldXBefore - worldXAfter;
    this.camera.y += worldYBefore - worldYAfter;
  };

  private handleMouseDown = (e: MouseEvent): void => {
    const rect = this.canvas.getBoundingClientRect();
    this.state.dragStartX = (e.clientX - rect.left) * window.devicePixelRatio;
    this.state.dragStartY = (e.clientY - rect.top) * window.devicePixelRatio;
    this.state.cameraDragStartX = this.camera.x;
    this.state.cameraDragStartY = this.camera.y;
    this.state.isDragging = true;
    this.canvas.style.cursor = 'grabbing';
  };

  private handleMouseMove = (e: MouseEvent): void => {
    const rect = this.canvas.getBoundingClientRect();
    this.state.mouseX = (e.clientX - rect.left) * window.devicePixelRatio;
    this.state.mouseY = (e.clientY - rect.top) * window.devicePixelRatio;

    const [worldX, worldY] = screenToWorld(
      this.camera,
      this.state.mouseX,
      this.state.mouseY,
      this.canvas.width,
      this.canvas.height
    );
    this.state.worldX = worldX;
    this.state.worldY = worldY;

    if (this.state.isDragging) {
      const dx = (this.state.mouseX - this.state.dragStartX) / this.camera.zoom;
      const dy = (this.state.mouseY - this.state.dragStartY) / this.camera.zoom;

      this.camera.x = this.state.cameraDragStartX - dx;
      this.camera.y = this.state.cameraDragStartY - dy;
    } else {
      // Hit testing
      this.updateHoveredNode();
    }
  };

  private handleMouseUp = (): void => {
    this.state.isDragging = false;
    this.canvas.style.cursor = this.state.hoveredNode ? 'pointer' : 'grab';
  };

  private handleMouseLeave = (): void => {
    this.state.isDragging = false;
    if (this.state.hoveredNode) {
      this.state.hoveredNode = null;
      this.state.hoveredNodeIndex = -1;
      this.onHoverChange?.(null);
    }
  };

  private updateHoveredNode(): void {
    let foundNode: GraphNode | null = null;
    let foundIndex = -1;

    // Check in reverse order (top nodes first)
    for (let i = this.nodes.length - 1; i >= 0; i--) {
      const node = this.nodes[i];
      const dx = this.state.worldX - node.x;
      const dy = this.state.worldY - node.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= node.size) {
        foundNode = node;
        foundIndex = i;
        break;
      }
    }

    if (foundNode !== this.state.hoveredNode) {
      this.state.hoveredNode = foundNode;
      this.state.hoveredNodeIndex = foundIndex;
      this.canvas.style.cursor = foundNode ? 'pointer' : 'grab';
      this.onHoverChange?.(foundNode);
    }
  }

  updateNodes(nodes: GraphNode[]): void {
    this.nodes = nodes;
  }

  getState(): InputState {
    return this.state;
  }

  destroy(): void {
    this.canvas.removeEventListener('wheel', this.handleWheel);
    this.canvas.removeEventListener('mousedown', this.handleMouseDown);
    this.canvas.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas.removeEventListener('mouseup', this.handleMouseUp);
    this.canvas.removeEventListener('mouseleave', this.handleMouseLeave);
  }
}
