import { ArchitectureLayer } from '../types/graph';
import type { FileInfo } from './FileScanner';

interface ClassificationRule {
  layer: ArchitectureLayer;
  pathPatterns: RegExp[];
  filePatterns: RegExp[];
  contentPatterns: RegExp[];
  priority: number;
}

const CLASSIFICATION_RULES: ClassificationRule[] = [
  {
    layer: ArchitectureLayer.HOOK,
    pathPatterns: [/\/hooks?\//i],
    filePatterns: [/^use[A-Z].*\.tsx?$/],
    contentPatterns: [/^export\s+(function|const)\s+use[A-Z]/m],
    priority: 10,
  },
  {
    layer: ArchitectureLayer.COMPONENT,
    pathPatterns: [/\/components?\//i, /\/pages?\//i, /\/views?\//i, /\/screens?\//i],
    filePatterns: [/\.tsx$/, /\.component\.tsx?$/],
    contentPatterns: [
      /React\.FC/,
      /export\s+default\s+function\s+\w+.*return\s*\(/s,
      /<[A-Z]\w+/,
      /memo\s*\(/,
    ],
    priority: 5,
  },
  {
    layer: ArchitectureLayer.DATA,
    pathPatterns: [/\/data\//i, /\/store\//i, /\/repositories?\//i, /\/models?\//i],
    filePatterns: [/Repository\.tsx?$/, /Store\.tsx?$/, /Provider\.tsx?$/],
    contentPatterns: [
      /class\s+\w+Repository/,
      /createStore\s*\(/,
      /useStore\s*\(/,
      /createContext\s*\(/,
    ],
    priority: 8,
  },
  {
    layer: ArchitectureLayer.API,
    pathPatterns: [/\/api\//i, /\/services?\//i, /\/client\//i],
    filePatterns: [/Service\.tsx?$/, /Api\.tsx?$/, /Client\.tsx?$/],
    contentPatterns: [
      /fetch\s*\(/,
      /axios\./,
      /supabase\./,
      /\.from\s*\(/,
      /createClient\s*\(/,
    ],
    priority: 7,
  },
  {
    layer: ArchitectureLayer.TYPE,
    pathPatterns: [/\/types?\//i, /\/interfaces?\//i],
    filePatterns: [/\.d\.ts$/, /types?\.ts$/],
    contentPatterns: [
      /^export\s+(interface|type)\s+/m,
      /^interface\s+/m,
      /^type\s+\w+\s*=/m,
    ],
    priority: 9,
  },
  {
    layer: ArchitectureLayer.UTILITY,
    pathPatterns: [/\/utils?\//i, /\/lib\//i, /\/helpers?\//i, /\/common\//i],
    filePatterns: [/Utils?\.tsx?$/, /Helper\.tsx?$/],
    contentPatterns: [],
    priority: 3,
  },
];

export class LayerClassifier {
  classify(file: FileInfo): ArchitectureLayer {
    let bestMatch: ArchitectureLayer = ArchitectureLayer.UNKNOWN;
    let bestScore = 0;

    for (const rule of CLASSIFICATION_RULES) {
      let score = 0;

      // Check path patterns
      for (const pattern of rule.pathPatterns) {
        if (pattern.test(file.path)) {
          score += 3;
          break;
        }
      }

      // Check file patterns
      for (const pattern of rule.filePatterns) {
        if (pattern.test(file.name)) {
          score += 2;
          break;
        }
      }

      // Check content patterns
      for (const pattern of rule.contentPatterns) {
        if (pattern.test(file.content)) {
          score += 1;
        }
      }

      // Apply priority as tiebreaker
      const finalScore = score * 100 + rule.priority;

      if (finalScore > bestScore) {
        bestScore = finalScore;
        bestMatch = rule.layer;
      }
    }

    return bestMatch;
  }
}
