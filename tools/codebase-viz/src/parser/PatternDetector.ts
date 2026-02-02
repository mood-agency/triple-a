import type { FileInfo } from './FileScanner';
import type { GraphNode, GraphEdge } from '../types/graph';

export enum ArchitecturalPattern {
  CQRS_COMMAND = 'cqrs-command',
  CQRS_QUERY = 'cqrs-query',
  CQRS_HANDLER = 'cqrs-handler',
  EVENT_BUS = 'event-bus',
  REPOSITORY = 'repository',
  PROVIDER = 'provider',
  HOOK = 'hook',
  COMPONENT = 'component',
  UNKNOWN = 'unknown',
}

export interface PatternGroup {
  id: string;
  name: string;
  pattern: ArchitecturalPattern;
  nodes: string[]; // Node IDs
  color: string;
  description: string;
}

interface PatternRule {
  pattern: ArchitecturalPattern;
  pathPatterns: RegExp[];
  filePatterns: RegExp[];
  contentPatterns: RegExp[];
  groupName: string;
  color: string;
  description: string;
}

const PATTERN_RULES: PatternRule[] = [
  {
    pattern: ArchitecturalPattern.CQRS_COMMAND,
    pathPatterns: [/\/cqrs\/commands?\//i, /\/commands?\//i],
    filePatterns: [/Command\.tsx?$/, /Commands\.tsx?$/],
    contentPatterns: [/interface\s+\w+Command/, /type\s+\w+Command/],
    groupName: 'CQRS Commands',
    color: '#E94560',
    description: 'Command definitions for CQRS pattern',
  },
  {
    pattern: ArchitecturalPattern.CQRS_QUERY,
    pathPatterns: [/\/cqrs\/queries?\//i, /\/queries?\//i],
    filePatterns: [/Query\.tsx?$/, /Queries\.tsx?$/],
    contentPatterns: [/interface\s+\w+Query/, /type\s+\w+Query/],
    groupName: 'CQRS Queries',
    color: '#0F3460',
    description: 'Query definitions for CQRS pattern',
  },
  {
    pattern: ArchitecturalPattern.CQRS_HANDLER,
    pathPatterns: [/\/cqrs\/handlers?\//i, /\/handlers?\//i],
    filePatterns: [/Handler\.tsx?$/, /Handlers\.tsx?$/],
    contentPatterns: [/CommandHandler|QueryHandler|registerHandler/],
    groupName: 'CQRS Handlers',
    color: '#16213E',
    description: 'Command and Query handlers',
  },
  {
    pattern: ArchitecturalPattern.EVENT_BUS,
    pathPatterns: [/\/events?\//i],
    filePatterns: [/EventBus\.tsx?$/, /Event\.tsx?$/, /Events\.tsx?$/],
    contentPatterns: [/EventBus|subscribe|publish|emit|DomainEvent/],
    groupName: 'Event Bus',
    color: '#FF6B6B',
    description: 'Event-driven communication',
  },
  {
    pattern: ArchitecturalPattern.REPOSITORY,
    pathPatterns: [/\/data\//i, /\/repositories?\//i],
    filePatterns: [/Repository\.tsx?$/, /Store\.tsx?$/],
    contentPatterns: [/class\s+\w+Repository|interface\s+\w+Repository/],
    groupName: 'Data Repositories',
    color: '#4DCC8D',
    description: 'Data access layer',
  },
  {
    pattern: ArchitecturalPattern.PROVIDER,
    pathPatterns: [/\/providers?\//i, /\/context\//i],
    filePatterns: [/Provider\.tsx?$/, /Context\.tsx?$/],
    contentPatterns: [/createContext|Provider|useContext/],
    groupName: 'Providers & Context',
    color: '#AB82E6',
    description: 'React Context providers',
  },
  {
    pattern: ArchitecturalPattern.HOOK,
    pathPatterns: [/\/hooks?\//i],
    filePatterns: [/^use[A-Z].*\.tsx?$/],
    contentPatterns: [/^export\s+(function|const)\s+use[A-Z]/m],
    groupName: 'Custom Hooks',
    color: '#AB82E6',
    description: 'React custom hooks',
  },
];

export class PatternDetector {
  detectPatterns(
    files: FileInfo[],
    nodes: GraphNode[],
    edges: GraphEdge[]
  ): PatternGroup[] {
    const groups: Map<ArchitecturalPattern, PatternGroup> = new Map();
    const nodePatterns: Map<string, ArchitecturalPattern> = new Map();

    // Classify each file by pattern
    for (const file of files) {
      const pattern = this.classifyFile(file);
      if (pattern !== ArchitecturalPattern.UNKNOWN) {
        nodePatterns.set(file.path, pattern);
      }
    }

    // Group nodes by pattern
    for (const [nodePath, pattern] of nodePatterns) {
      let group = groups.get(pattern);
      if (!group) {
        const rule = PATTERN_RULES.find((r) => r.pattern === pattern);
        if (rule) {
          group = {
            id: pattern,
            name: rule.groupName,
            pattern,
            nodes: [],
            color: rule.color,
            description: rule.description,
          };
          groups.set(pattern, group);
        }
      }
      if (group) {
        group.nodes.push(nodePath);
      }
    }

    return Array.from(groups.values()).filter((g) => g.nodes.length > 0);
  }

  private classifyFile(file: FileInfo): ArchitecturalPattern {
    let bestMatch = ArchitecturalPattern.UNKNOWN;
    let bestScore = 0;

    for (const rule of PATTERN_RULES) {
      let score = 0;

      // Path matching (high weight)
      for (const pattern of rule.pathPatterns) {
        if (pattern.test(file.path)) {
          score += 5;
          break;
        }
      }

      // File name matching
      for (const pattern of rule.filePatterns) {
        if (pattern.test(file.name)) {
          score += 3;
          break;
        }
      }

      // Content matching
      for (const pattern of rule.contentPatterns) {
        if (pattern.test(file.content)) {
          score += 2;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = rule.pattern;
      }
    }

    return bestScore >= 3 ? bestMatch : ArchitecturalPattern.UNKNOWN;
  }

  getPatternColor(pattern: ArchitecturalPattern): string {
    const rule = PATTERN_RULES.find((r) => r.pattern === pattern);
    return rule?.color || '#808080';
  }
}
