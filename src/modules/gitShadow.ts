import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

export interface ShadowCheckpointResult {
  isGitRepo: boolean;
  shadowCommitHash?: string;
  shadowBranchName?: string;
  message: string;
}

export class GitShadowManager {
  private workspacePath: string;

  constructor(workspacePath: string) {
    this.workspacePath = path.resolve(workspacePath);
  }

  public isGit(): boolean {
    try {
      const out = execSync('git rev-parse --is-inside-work-tree', {
        cwd: this.workspacePath,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore']
      });
      return out.trim() === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Crea un commit e una ref ombra senza toccare l'HEAD, il branch o lo staging corrente dell'utente
   */
  public createShadowCheckpoint(label: string = 'checkpoint'): ShadowCheckpointResult {
    if (!this.isGit()) {
      return {
        isGitRepo: false,
        message: 'Il workspace corrente non è una repository Git.'
      };
    }

    try {
      const timestamp = Date.now();
      const shadowRef = `refs/driftguard/shadow-${timestamp}`;

      const shadowIndexPath = path.join(this.workspacePath, '.git', 'driftguard_shadow_index');
      const env = { ...process.env, GIT_INDEX_FILE: shadowIndexPath };
      
      execSync('git add -A', { cwd: this.workspacePath, env, stdio: 'ignore' });
      const treeHash = execSync('git write-tree', { cwd: this.workspacePath, env, encoding: 'utf-8' }).trim();
      
      const commitHash = execSync(`git commit-tree ${treeHash} -m "DriftGuard Shadow: ${label}"`, {
        cwd: this.workspacePath,
        encoding: 'utf-8'
      }).trim();

      execSync(`git update-ref ${shadowRef} ${commitHash}`, { cwd: this.workspacePath, stdio: 'ignore' });

      if (fs.existsSync(shadowIndexPath)) {
        fs.unlinkSync(shadowIndexPath);
      }

      return {
        isGitRepo: true,
        shadowCommitHash: commitHash,
        shadowBranchName: shadowRef,
        message: `Checkpoint ombra Git creato con successo (Ref: ${shadowRef}, Commit: ${commitHash.slice(0, 7)}).`
      };
    } catch (err: any) {
      return {
        isGitRepo: true,
        message: `Impossibile creare lo shadow checkpoint Git: ${err.message}`
      };
    }
  }
}
