import fs from 'node:fs';
import path from 'node:path';

export interface CleanBloatResult {
  cleanedFilesCount: number;
  reclaimedBytes: number;
  reclaimedFormatted: string;
  cleanedItems: string[];
}

export class WorkspaceBloatCleaner {
  private junkDirectoryNames = new Set([
    '.cache',
    '.pytest_cache',
    '__pycache__',
    '.turbo',
    '.parcel-cache',
    '.temp',
    '.tmp'
  ]);

  private junkFileExtensions = new Set([
    '.tmp',
    '.log',
    '.pyc',
    '.DS_Store'
  ]);

  private isJunkFile(fileName: string): boolean {
    if (fileName === 'npm-debug.log' || fileName === 'yarn-error.log' || fileName === '.DS_Store') {
      return true;
    }
    const ext = path.extname(fileName);
    return this.junkFileExtensions.has(ext);
  }

  public clean(workspacePath: string, dryRun: boolean = false): CleanBloatResult {
    let count = 0;
    let bytes = 0;
    const cleanedItems: string[] = [];

    const walkAndPrune = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        const rel = path.relative(workspacePath, full);

        if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === '.driftguard') {
          continue;
        }

        if (entry.isDirectory()) {
          if (this.junkDirectoryNames.has(entry.name)) {
            // Cartella di cache/spazzatura trovata
            count++;
            cleanedItems.push(rel + '/');
            if (!dryRun) {
              fs.rmSync(full, { recursive: true, force: true });
            }
          } else {
            walkAndPrune(full);
          }
        } else if (entry.isFile()) {
          if (this.isJunkFile(entry.name)) {
            try {
              const stat = fs.statSync(full);
              bytes += stat.size;
              count++;
              cleanedItems.push(rel);
              if (!dryRun) {
                fs.unlinkSync(full);
              }
            } catch {}
          }
        }
      }
    };

    walkAndPrune(workspacePath);

    let reclaimedFormatted = `${bytes} B`;
    if (bytes > 1024 * 1024) reclaimedFormatted = `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    else if (bytes > 1024) reclaimedFormatted = `${(bytes / 1024).toFixed(2)} KB`;

    return {
      cleanedFilesCount: count,
      reclaimedBytes: bytes,
      reclaimedFormatted,
      cleanedItems
    };
  }
}
