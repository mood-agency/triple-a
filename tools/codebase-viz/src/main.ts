import { initWebGPU, resizeCanvas, type WebGPUContext } from './renderer/WebGPUContext';
import { NodeRenderer } from './renderer/NodeRenderer';
import { EdgeRenderer } from './renderer/EdgeRenderer';
import { LabelRenderer } from './renderer/LabelRenderer';
import { createCamera, type Camera } from './renderer/Camera';
import { InputHandler } from './interaction/InputHandler';
import { FileScanner, pickDirectory, type FileInfo } from './parser/FileScanner';
import { ImportAnalyzer } from './parser/ImportAnalyzer';
import { LayerClassifier } from './parser/LayerClassifier';
import { GraphBuilder } from './parser/GraphBuilder';
import { PatternDetector, type PatternGroup } from './parser/PatternDetector';
import type { Graph, GraphNode, GraphEdge } from './types/graph';
import ELK from 'elkjs/lib/elk.bundled.js';

class CodebaseVisualizer {
  private ctx: WebGPUContext | null = null;
  private nodeRenderer: NodeRenderer | null = null;
  private edgeRenderer: EdgeRenderer | null = null;
  private labelRenderer: LabelRenderer | null = null;
  private camera: Camera;
  private inputHandler: InputHandler | null = null;
  private graph: Graph | null = null;
  private files: FileInfo[] = [];
  private patternGroups: PatternGroup[] = [];

  // Layout computed flag
  private layoutComputed = false;

  // Edge visibility settings
  private showEdges = true;
  private edgeOpacity = 0.15;

  private canvas: HTMLCanvasElement;
  private canvasContainer: HTMLElement;
  private statsEl: HTMLElement;
  private tooltipEl: HTMLElement;
  private errorEl: HTMLElement;
  private patternsEl: HTMLElement;

  private startTime = performance.now();
  private running = false;

  constructor() {
    this.canvas = document.getElementById('canvas') as HTMLCanvasElement;
    this.canvasContainer = document.getElementById('canvas-container') as HTMLElement;
    this.statsEl = document.getElementById('stats') as HTMLElement;
    this.tooltipEl = document.getElementById('tooltip') as HTMLElement;
    this.errorEl = document.getElementById('error') as HTMLElement;
    this.patternsEl = document.getElementById('patterns') as HTMLElement;

    this.camera = createCamera();

    this.init();
  }

  private async init(): Promise<void> {
    try {
      this.ctx = await initWebGPU(this.canvas);
      this.nodeRenderer = new NodeRenderer(this.ctx);
      this.edgeRenderer = new EdgeRenderer(this.ctx);
      this.labelRenderer = new LabelRenderer(this.canvasContainer);

      this.inputHandler = new InputHandler(
        this.canvas,
        this.camera,
        this.handleHoverChange.bind(this)
      );

      const openButton = document.getElementById('open-folder');
      openButton?.addEventListener('click', () => this.openFolder());

      // Set up edge controls
      const showEdgesCheckbox = document.getElementById('show-edges') as HTMLInputElement;
      const edgeOpacitySlider = document.getElementById('edge-opacity') as HTMLInputElement;

      showEdgesCheckbox?.addEventListener('change', () => {
        this.showEdges = showEdgesCheckbox.checked;
      });

      edgeOpacitySlider?.addEventListener('input', () => {
        this.edgeOpacity = parseInt(edgeOpacitySlider.value) / 100;
      });

      this.running = true;
      this.render();

      window.addEventListener('resize', () => this.handleResize());
      this.handleResize();

      this.statsEl.textContent = 'Click "Open Folder" to visualize a codebase';
    } catch (error) {
      console.error('WebGPU initialization failed:', error);
      this.errorEl.style.display = 'block';
    }
  }

  private async openFolder(): Promise<void> {
    const dirHandle = await pickDirectory();
    if (!dirHandle) return;

    this.layoutComputed = false;
    this.statsEl.textContent = 'Scanning files...';
    this.labelRenderer?.clear();

    try {
      const scanner = new FileScanner();
      this.files = await scanner.scanDirectory(dirHandle);

      if (this.files.length === 0) {
        this.statsEl.textContent = 'No TypeScript/JavaScript files found';
        return;
      }

      this.statsEl.textContent = `Analyzing ${this.files.length} files...`;

      const allPaths = new Set(this.files.map((f) => f.path));
      const analyzer = new ImportAnalyzer();
      const fileImports = this.files.map((f) => analyzer.analyze(f, allPaths));

      const classifier = new LayerClassifier();
      const layers = new Map(this.files.map((f) => [f.path, classifier.classify(f)]));

      const { width, height } = resizeCanvas(this.ctx!);
      const builder = new GraphBuilder();
      this.graph = builder.build(this.files, fileImports, layers, width, height);

      const patternDetector = new PatternDetector();
      this.patternGroups = patternDetector.detectPatterns(
        this.files,
        this.graph.nodes,
        this.graph.edges
      );

      this.updatePatternsSidebar();

      console.log(`Graph: ${this.graph.nodes.length} nodes, ${this.graph.edges.length} edges`);

      // Compute hierarchical layout with ELK
      await this.computeHierarchicalLayout(this.graph.nodes, this.graph.edges, width, height);
      this.layoutComputed = true;

      // Update renderers
      this.nodeRenderer?.updateNodes(this.graph.nodes);
      this.edgeRenderer?.updateEdges(this.graph.edges, this.graph.nodeMap);
      this.inputHandler?.updateNodes(this.graph.nodes);

      const statsText = `${this.files.length} files, ${this.graph.edges.length} connections`;
      this.statsEl.textContent = statsText;
    } catch (error) {
      console.error('Failed to analyze codebase:', error);
      this.statsEl.textContent = 'Error analyzing codebase';
    }
  }

  private async computeHierarchicalLayout(nodes: GraphNode[], edges: GraphEdge[], width: number, height: number): Promise<void> {
    const elk = new ELK();

    // Create ELK graph structure
    const elkGraph = {
      id: 'root',
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': 'DOWN',
        'elk.spacing.nodeNode': '50',
        'elk.layered.spacing.nodeNodeBetweenLayers': '80',
        'elk.edgeRouting': 'POLYLINE',
        'elk.layered.mergeEdges': 'true',
        'elk.layered.compaction.postCompaction.strategy': 'EDGE_LENGTH',
      },
      children: nodes.map(node => ({
        id: node.id,
        width: 100,
        height: 30,
      })),
      edges: edges.map(edge => ({
        id: edge.id,
        sources: [edge.source],
        targets: [edge.target],
      })),
    };

    try {
      const layoutedGraph = await elk.layout(elkGraph);

      // Get layout bounds
      const graphWidth = layoutedGraph.width || width;
      const graphHeight = layoutedGraph.height || height;

      // Apply positions to our nodes (centered at origin)
      const nodeMap = new Map(nodes.map(n => [n.id, n]));
      for (const child of layoutedGraph.children || []) {
        const node = nodeMap.get(child.id);
        if (node && child.x !== undefined && child.y !== undefined) {
          node.x = child.x - graphWidth / 2 + 60; // +60 to center the node (half of width)
          node.y = child.y - graphHeight / 2 + 20; // +20 to center the node (half of height)
        }
      }

      console.log(`ELK layout computed: ${graphWidth}x${graphHeight}`);
    } catch (error) {
      console.error('ELK layout failed:', error);
      // Fallback to simple grid layout
      this.fallbackGridLayout(nodes, width, height);
    }
  }

  private fallbackGridLayout(nodes: GraphNode[], width: number, height: number): void {
    const cols = Math.ceil(Math.sqrt(nodes.length));
    const spacing = 150;
    nodes.forEach((node, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      node.x = col * spacing - (cols * spacing) / 2;
      node.y = row * spacing - (Math.ceil(nodes.length / cols) * spacing) / 2;
    });
  }

  private updatePatternsSidebar(): void {
    if (!this.patternsEl) return;

    this.patternsEl.innerHTML = '';

    if (this.patternGroups.length === 0) {
      this.patternsEl.innerHTML = '<div class="empty-patterns">No patterns detected</div>';
      return;
    }

    for (const group of this.patternGroups) {
      const groupEl = document.createElement('div');
      groupEl.className = 'pattern-group';
      groupEl.innerHTML = `
        <div class="pattern-header" style="border-left: 3px solid ${group.color}">
          <span class="pattern-name">${group.name}</span>
          <span class="pattern-count">${group.nodes.length}</span>
        </div>
        <div class="pattern-files">
          ${group.nodes
            .slice(0, 5)
            .map((path) => {
              const name = path.split('/').pop()?.replace(/\.(tsx?|jsx?)$/, '') || path;
              return `<div class="pattern-file">${name}</div>`;
            })
            .join('')}
          ${group.nodes.length > 5 ? `<div class="pattern-more">+${group.nodes.length - 5} more</div>` : ''}
        </div>
      `;

      groupEl.addEventListener('click', () => this.highlightPatternGroup(group));
      this.patternsEl.appendChild(groupEl);
    }
  }

  private highlightPatternGroup(group: PatternGroup): void {
    if (!this.graph) return;

    const groupNodes = this.graph.nodes.filter((n) => group.nodes.includes(n.id));
    if (groupNodes.length === 0) return;

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    for (const node of groupNodes) {
      minX = Math.min(minX, node.x);
      maxX = Math.max(maxX, node.x);
      minY = Math.min(minY, node.y);
      maxY = Math.max(maxY, node.y);
    }

    this.camera.x = (minX + maxX) / 2;
    this.camera.y = (minY + maxY) / 2;
    this.camera.zoom = 1.5;
  }

  private handleHoverChange(node: GraphNode | null): void {
    if (node) {
      const rect = this.canvas.getBoundingClientRect();
      const state = this.inputHandler!.getState();

      this.tooltipEl.style.display = 'block';
      this.tooltipEl.style.left = `${state.mouseX / window.devicePixelRatio + rect.left + 15}px`;
      this.tooltipEl.style.top = `${state.mouseY / window.devicePixelRatio + rect.top + 15}px`;

      const nameEl = this.tooltipEl.querySelector('.name') as HTMLElement;
      const pathEl = this.tooltipEl.querySelector('.path') as HTMLElement;
      nameEl.textContent = node.label;
      pathEl.textContent = node.path;
    } else {
      this.tooltipEl.style.display = 'none';
    }
  }

  private handleResize(): void {
    if (!this.ctx) return;
    resizeCanvas(this.ctx);
  }

  private render(): void {
    if (!this.running || !this.ctx) return;

    const { width, height } = resizeCanvas(this.ctx);
    const time = (performance.now() - this.startTime) / 1000;

    const inputState = this.inputHandler?.getState();
    const hoveredIndex = inputState?.hoveredNodeIndex ?? -1;

    this.nodeRenderer?.updateUniforms(this.camera, width, height, time, hoveredIndex);
    this.edgeRenderer?.updateUniforms(this.camera, width, height, time, this.edgeOpacity);

    if (this.graph) {
      this.labelRenderer?.updateLabels(this.graph.nodes, this.camera, width, height);
    }

    const textureView = this.ctx.context.getCurrentTexture().createView();
    const commandEncoder = this.ctx.device.createCommandEncoder();

    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: textureView,
        clearValue: { r: 0.102, g: 0.102, b: 0.18, a: 1.0 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
    });

    if (this.showEdges) {
      this.edgeRenderer?.render(renderPass);
    }
    this.nodeRenderer?.render(renderPass);

    renderPass.end();
    this.ctx.device.queue.submit([commandEncoder.finish()]);

    requestAnimationFrame(() => this.render());
  }

  destroy(): void {
    this.running = false;
    this.inputHandler?.destroy();
    this.nodeRenderer?.destroy();
    this.edgeRenderer?.destroy();
    this.labelRenderer?.destroy();
  }
}

new CodebaseVisualizer();
