import fs from 'node:fs';
import path from 'node:path';

export interface CommandLogEntry {
  command: string;
  exitCode: number;
  timestamp: string;
  durationMs: number;
  relevantEnv?: Record<string, string>;
}

export class RecipeExtractor {
  private logFilePath: string;

  constructor(workspacePath: string) {
    const dir = path.join(path.resolve(workspacePath), '.driftguard');
    fs.mkdirSync(dir, { recursive: true });
    this.logFilePath = path.join(dir, 'session_commands.json');
  }

  public recordCommand(entry: CommandLogEntry): void {
    let logs: CommandLogEntry[] = [];
    if (fs.existsSync(this.logFilePath)) {
      try {
        logs = JSON.parse(fs.readFileSync(this.logFilePath, 'utf-8'));
      } catch {
        logs = [];
      }
    }
    logs.push(entry);
    fs.writeFileSync(this.logFilePath, JSON.stringify(logs, null, 2), 'utf-8');
  }

  public generateRecipe(): {
    blueprintCommands: string[];
    summary: string;
    markdownRecipe: string;
  } {
    if (!fs.existsSync(this.logFilePath)) {
      return {
        blueprintCommands: [],
        summary: 'Nessun comando registrato nella sessione corrente.',
        markdownRecipe: '_Nessun comando registrato_'
      };
    }

    const logs: CommandLogEntry[] = JSON.parse(fs.readFileSync(this.logFilePath, 'utf-8'));

    // Filtra solo i comandi riusciti (exitCode === 0) ed elimina duplicati consecutivi o comandi esplorativi inutili (es. ls, pwd)
    const noisyCommands = new Set(['ls', 'pwd', 'whoami', 'clear']);
    const successful = logs
      .filter((l) => l.exitCode === 0)
      .map((l) => l.command.trim())
      .filter((cmd) => {
        const root = cmd.split(/\s+/)[0];
        return !noisyCommands.has(root);
      });

    // Deduplica mantenendo l'ordine
    const uniqueCommands: string[] = [];
    for (const cmd of successful) {
      if (!uniqueCommands.includes(cmd)) {
        uniqueCommands.push(cmd);
      }
    }

    const markdownRecipe = [
      '### 📋 Reproducibility Blueprint',
      'I seguenti comandi rappresentano i passaggi minimi necessari per riprodurre lo stato attuale con successo:',
      '```bash',
      ...uniqueCommands,
      '```'
    ].join('\n');

    return {
      blueprintCommands: uniqueCommands,
      summary: `Generata ricetta minima con ${uniqueCommands.length} comandi essenziali verificati.`,
      markdownRecipe
    };
  }
}
