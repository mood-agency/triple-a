import type { FileInfo } from './FileScanner';

export interface ImportInfo {
  source: string;
  isRelative: boolean;
  resolvedPath: string | null;
  importedNames: string[];
}

export interface FileImports {
  path: string;
  imports: ImportInfo[];
  exports: string[];
}

// Simple regex-based import analysis (no TypeScript compiler dependency)
const IMPORT_REGEX = /import\s+(?:(?:(\{[^}]+\})|(\*\s+as\s+\w+)|(\w+))\s+from\s+)?['"]([^'"]+)['"]/g;
const EXPORT_REGEX = /export\s+(?:default\s+)?(?:function|const|class|interface|type|enum)\s+(\w+)/g;
const DYNAMIC_IMPORT_REGEX = /import\(['"]([^'"]+)['"]\)/g;

export class ImportAnalyzer {
  analyze(file: FileInfo, allPaths: Set<string>): FileImports {
    const imports = this.extractImports(file.content, file.path, allPaths);
    const exports = this.extractExports(file.content);

    return {
      path: file.path,
      imports,
      exports,
    };
  }

  private extractImports(
    content: string,
    filePath: string,
    allPaths: Set<string>
  ): ImportInfo[] {
    const imports: ImportInfo[] = [];
    const seenSources = new Set<string>();

    // Static imports
    let match: RegExpExecArray | null;
    while ((match = IMPORT_REGEX.exec(content)) !== null) {
      const source = match[4];
      if (seenSources.has(source)) continue;
      seenSources.add(source);

      const namedImports = match[1];
      const namespaceImport = match[2];
      const defaultImport = match[3];

      const importedNames: string[] = [];
      if (namedImports) {
        const names = namedImports
          .replace(/[{}]/g, '')
          .split(',')
          .map((n) => n.trim().split(/\s+as\s+/)[0].trim())
          .filter(Boolean);
        importedNames.push(...names);
      }
      if (namespaceImport) {
        importedNames.push(namespaceImport.replace(/\*\s+as\s+/, '').trim());
      }
      if (defaultImport) {
        importedNames.push(defaultImport);
      }

      const isRelative = source.startsWith('.') || source.startsWith('/');
      const isAlias = source.startsWith('@/');
      const resolvedPath = isRelative
        ? this.resolveRelativePath(source, filePath, allPaths)
        : isAlias
          ? this.resolveAliasPath(source, allPaths)
          : null;

      imports.push({
        source,
        isRelative: isRelative || isAlias,
        resolvedPath,
        importedNames,
      });
    }

    // Dynamic imports
    while ((match = DYNAMIC_IMPORT_REGEX.exec(content)) !== null) {
      const source = match[1];
      if (seenSources.has(source)) continue;
      seenSources.add(source);

      const isRelative = source.startsWith('.') || source.startsWith('/');
      const isAlias = source.startsWith('@/');
      const resolvedPath = isRelative
        ? this.resolveRelativePath(source, filePath, allPaths)
        : isAlias
          ? this.resolveAliasPath(source, allPaths)
          : null;

      imports.push({
        source,
        isRelative: isRelative || isAlias,
        resolvedPath,
        importedNames: [],
      });
    }

    return imports;
  }

  private extractExports(content: string): string[] {
    const exports: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = EXPORT_REGEX.exec(content)) !== null) {
      exports.push(match[1]);
    }

    return exports;
  }

  private resolveRelativePath(
    importPath: string,
    fromPath: string,
    allPaths: Set<string>
  ): string | null {
    const fromDir = fromPath.split('/').slice(0, -1).join('/');
    const parts = importPath.split('/');
    const resolvedParts = fromDir ? fromDir.split('/') : [];

    for (const part of parts) {
      if (part === '.') continue;
      if (part === '..') {
        resolvedParts.pop();
      } else {
        resolvedParts.push(part);
      }
    }

    const basePath = resolvedParts.join('/');

    // Try different extensions
    const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js'];
    for (const ext of extensions) {
      const fullPath = basePath + ext;
      if (allPaths.has(fullPath)) {
        return fullPath;
      }
    }

    return null;
  }

  private resolveAliasPath(
    importPath: string,
    allPaths: Set<string>
  ): string | null {
    // Handle @/ alias - try both with and without src/ prefix
    const pathWithoutAlias = importPath.replace(/^@\//, '');
    const pathWithSrc = 'src/' + pathWithoutAlias;

    // Try different extensions
    const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js'];

    // Try without src/ prefix first (if user selected src/ folder directly)
    for (const ext of extensions) {
      const fullPath = pathWithoutAlias + ext;
      if (allPaths.has(fullPath)) {
        return fullPath;
      }
    }

    // Try with src/ prefix
    for (const ext of extensions) {
      const fullPath = pathWithSrc + ext;
      if (allPaths.has(fullPath)) {
        return fullPath;
      }
    }

    return null;
  }
}
