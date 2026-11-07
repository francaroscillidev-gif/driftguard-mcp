import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export interface FileSnapshotEntry {
  relativePath: string;
  hash: string;
  size: number;
  contentBase64?: string;
}

export interface SnapshotMetadata {
  id: string;
  label: string;
  timestamp: string;
  workspacePath: string;
  files: Record<string, FileSnapshotEntry>;
}

export interface DiffEntry {
  file: string;
  status: 'MODIFIED' | 'ADDED' | 'DELETED';
  diffPreview: string;
}

export class SnapshotManager {
  private baseDir: string;
  private storageDir: string;

  constructor(workspacePath: string) {
    this.baseDir = path.resolve(workspacePath);
    this.storageDir = path.join(this.baseDir, '.driftguard', 'snapshots');
    fs.mkdirSync(this.storageDir, { recursive: true });
  }

  private hashFile(filePath: string): string {
    const buffer = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  private shouldIgnore(relPath: string): boolean {
    const ignoredPatterns = [
      '.git',
      'node_modules',
      '.driftguard',
      'dist',
      '.next',
      '.cache',
      '.DS_Store'
    ];
    const parts = relPath.split(path.sep);
    return parts.some((p) => ignoredPatterns.includes(p));
  }

  private walkDir(currentDir: string, rootDir: string): string[] {
    if (!fs.existsSync(currentDir)) return [];
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    let files: string[] = [];

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relPath = path.relative(rootDir, fullPath);

      if (this.shouldIgnore(relPath)) {
        continue;
      }

      if (entry.isDirectory()) {
        files = files.concat(this.walkDir(fullPath, rootDir));
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
    return files;
  }

  public createSnapshot(label: string = 'pre-action'): SnapshotMetadata {
    const id = `snap_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const timestamp = new Date().toISOString();
    const filesRecord: Record<string, FileSnapshotEntry> = {};

    const allFiles = this.walkDir(this.baseDir, this.baseDir);
    const snapBlobDir = path.join(this.storageDir, id, 'blobs');
    fs.mkdirSync(snapBlobDir, { recursive: true });

    for (const filePath of allFiles) {
      const relPath = path.relative(this.baseDir, filePath);
      const stats = fs.statSync(filePath);
      const hash = this.hashFile(filePath);

      filesRecord[relPath] = {
        relativePath: relPath,
        hash,
        size: stats.size
      };

      const blobPath = path.join(snapBlobDir, hash);
      if (!fs.existsSync(blobPath)) {
        fs.copyFileSync(filePath, blobPath);
      }
    }

    const metadata: SnapshotMetadata = {
      id,
      label,
      timestamp,
      workspacePath: this.baseDir,
      files: filesRecord
    };

    const metaFile = path.join(this.storageDir, `${id}.json`);
    fs.writeFileSync(metaFile, JSON.stringify(metadata, null, 2), 'utf-8');

    return metadata;
  }

  public listSnapshots(): Array<{ id: string; label: string; timestamp: string; fileCount: number }> {
    if (!fs.existsSync(this.storageDir)) return [];
    const files = fs.readdirSync(this.storageDir).filter((f) => f.endsWith('.json'));

    const list: Array<{ id: string; label: string; timestamp: string; fileCount: number }> = [];
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(this.storageDir, file), 'utf-8');
        const meta: SnapshotMetadata = JSON.parse(content);
        list.push({
          id: meta.id,
          label: meta.label,
          timestamp: meta.timestamp,
          fileCount: Object.keys(meta.files).length
        });
      } catch {
        // Skip corrupt metadata
      }
    }
    return list.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  /**
   * Genera un'anteprima visiva del diff (righe + e -) di ciò che cambierà prima di fare il rollback
   */
  public previewRollback(snapshotId?: string): {
    snapshotId: string;
    totalChanges: number;
    diffs: DiffEntry[];
  } {
    let targetSnapId = snapshotId;
    if (!targetSnapId) {
      const all = this.listSnapshots();
      if (all.length === 0) {
        throw new Error('Nessuno snapshot disponibile per l\'anteprima.');
      }
      targetSnapId = all[0].id;
    }

    const metaFile = path.join(this.storageDir, `${targetSnapId}.json`);
    if (!fs.existsSync(metaFile)) {
      throw new Error(`Snapshot ${targetSnapId} non trovato.`);
    }

    const metadata: SnapshotMetadata = JSON.parse(fs.readFileSync(metaFile, 'utf-8'));
    const snapBlobDir = path.join(this.storageDir, targetSnapId, 'blobs');
    const diffs: DiffEntry[] = [];

    // 1. File attualmente nel workspace ma assenti nello snapshot (verranno eliminati)
    const currentFiles = this.walkDir(this.baseDir, this.baseDir);
    const currentRelSet = new Set<string>();

    for (const filePath of currentFiles) {
      const relPath = path.relative(this.baseDir, filePath);
      currentRelSet.add(relPath);

      if (!metadata.files[relPath]) {
        diffs.push({
          file: relPath,
          status: 'ADDED',
          diffPreview: `--- /dev/null\n+++ ${relPath} (Verrà eliminato dal rollback)`
        });
      }
    }

    // 2. File presenti nello snapshot
    for (const [relPath, entry] of Object.entries(metadata.files)) {
      const targetFilePath = path.join(this.baseDir, relPath);
      const blobPath = path.join(snapBlobDir, entry.hash);

      if (!fs.existsSync(targetFilePath)) {
        diffs.push({
          file: relPath,
          status: 'DELETED',
          diffPreview: `--- ${relPath} (Attualmente mancante)\n+++ ${relPath} (Verrà ripristinato dallo snapshot)`
        });
      } else {
        const curHash = this.hashFile(targetFilePath);
        if (curHash !== entry.hash) {
          // Genera un diff leggero riga per riga
          const originalLines = fs.existsSync(blobPath) ? fs.readFileSync(blobPath, 'utf-8').split('\n') : [];
          const currentLines = fs.readFileSync(targetFilePath, 'utf-8').split('\n');

          const diffLines: string[] = [
            `@@ Snapshot vs Stato Corrente per ${relPath} @@`
          ];

          const max = Math.min(Math.max(originalLines.length, currentLines.length), 30);
          for (let i = 0; i < max; i++) {
            const orig = originalLines[i];
            const curr = currentLines[i];
            if (orig !== curr) {
              if (orig !== undefined) diffLines.push(`- ${orig}`);
              if (curr !== undefined) diffLines.push(`+ ${curr}`);
            }
          }

          diffs.push({
            file: relPath,
            status: 'MODIFIED',
            diffPreview: diffLines.join('\n')
          });
        }
      }
    }

    return {
      snapshotId: targetSnapId,
      totalChanges: diffs.length,
      diffs
    };
  }

  public rollback(snapshotId?: string): { restored: string[]; deleted: string[]; snapshotId: string } {
    let targetSnapId = snapshotId;
    if (!targetSnapId) {
      const all = this.listSnapshots();
      if (all.length === 0) {
        throw new Error('Nessuno snapshot disponibile per il rollback.');
      }
      targetSnapId = all[0].id;
    }

    const metaFile = path.join(this.storageDir, `${targetSnapId}.json`);
    if (!fs.existsSync(metaFile)) {
      throw new Error(`Snapshot ${targetSnapId} non trovato.`);
    }

    const metadata: SnapshotMetadata = JSON.parse(fs.readFileSync(metaFile, 'utf-8'));
    const snapBlobDir = path.join(this.storageDir, targetSnapId, 'blobs');

    const restored: string[] = [];
    const deleted: string[] = [];

    // 1. Elimina file creati dopo lo snapshot
    const currentFiles = this.walkDir(this.baseDir, this.baseDir);
    for (const filePath of currentFiles) {
      const relPath = path.relative(this.baseDir, filePath);
      if (!metadata.files[relPath]) {
        fs.unlinkSync(filePath);
        deleted.push(relPath);
      }
    }

    // 2. Ripristina i file modificati o eliminati
    for (const [relPath, entry] of Object.entries(metadata.files)) {
      const targetFilePath = path.join(this.baseDir, relPath);
      const blobPath = path.join(snapBlobDir, entry.hash);

      let needsRestore = false;
      if (!fs.existsSync(targetFilePath)) {
        needsRestore = true;
      } else {
        const curHash = this.hashFile(targetFilePath);
        if (curHash !== entry.hash) {
          needsRestore = true;
        }
      }

      if (needsRestore && fs.existsSync(blobPath)) {
        fs.mkdirSync(path.dirname(targetFilePath), { recursive: true });
        fs.copyFileSync(blobPath, targetFilePath);
        restored.push(relPath);
      }
    }

    return {
      snapshotId: targetSnapId,
      restored,
      deleted
    };
  }

  /**
   * Esegue un rollback selettivo: ripristina solo i file specificati mantenendo intatti gli altri file
   */
  public selectiveRollback(targetFiles: string[], snapshotId?: string): { restored: string[]; snapshotId: string } {
    let targetSnapId = snapshotId;
    if (!targetSnapId) {
      const all = this.listSnapshots();
      if (all.length === 0) {
        throw new Error('Nessuno snapshot disponibile per il rollback selettivo.');
      }
      targetSnapId = all[0].id;
    }

    const metaFile = path.join(this.storageDir, `${targetSnapId}.json`);
    if (!fs.existsSync(metaFile)) {
      throw new Error(`Snapshot ${targetSnapId} non trovato.`);
    }

    const metadata: SnapshotMetadata = JSON.parse(fs.readFileSync(metaFile, 'utf-8'));
    const snapBlobDir = path.join(this.storageDir, targetSnapId, 'blobs');
    const restored: string[] = [];

    for (const relPath of targetFiles) {
      const entry = metadata.files[relPath];
      if (entry) {
        const targetFilePath = path.join(this.baseDir, relPath);
        const blobPath = path.join(snapBlobDir, entry.hash);

        if (fs.existsSync(blobPath)) {
          fs.mkdirSync(path.dirname(targetFilePath), { recursive: true });
          fs.copyFileSync(blobPath, targetFilePath);
          restored.push(relPath);
        }
      }
    }

    return {
      snapshotId: targetSnapId,
      restored
    };
  }
}
