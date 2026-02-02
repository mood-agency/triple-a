export interface FileInfo {
  path: string;
  name: string;
  content: string;
  extension: string;
}

const VALID_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];
const IGNORE_DIRS = ['node_modules', 'dist', 'build', '.git', '.next', 'coverage', '__tests__'];

export class FileScanner {
  async scanDirectory(dirHandle: FileSystemDirectoryHandle): Promise<FileInfo[]> {
    const files: FileInfo[] = [];
    await this.scanRecursive(dirHandle, '', files);
    return files;
  }

  private async scanRecursive(
    dirHandle: FileSystemDirectoryHandle,
    path: string,
    files: FileInfo[]
  ): Promise<void> {
    try {
      for await (const entry of dirHandle.values()) {
        const entryPath = path ? `${path}/${entry.name}` : entry.name;

        if (entry.kind === 'directory') {
          if (!IGNORE_DIRS.includes(entry.name)) {
            const subDir = await dirHandle.getDirectoryHandle(entry.name);
            await this.scanRecursive(subDir, entryPath, files);
          }
        } else if (entry.kind === 'file') {
          const ext = this.getExtension(entry.name);
          if (VALID_EXTENSIONS.includes(ext)) {
            try {
              const fileHandle = await dirHandle.getFileHandle(entry.name);
              const file = await fileHandle.getFile();
              const content = await file.text();

              files.push({
                path: entryPath,
                name: entry.name,
                content,
                extension: ext,
              });
            } catch {
              // Skip files that can't be read
            }
          }
        }
      }
    } catch {
      // Skip directories that can't be accessed
    }
  }

  private getExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    return lastDot >= 0 ? filename.slice(lastDot) : '';
  }
}

export async function pickDirectory(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const handle = await (window as unknown as { showDirectoryPicker(): Promise<FileSystemDirectoryHandle> }).showDirectoryPicker({
      mode: 'read',
    });
    return handle;
  } catch {
    // User cancelled or API not supported
    return null;
  }
}
