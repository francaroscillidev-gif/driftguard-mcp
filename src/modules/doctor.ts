import { execSync } from 'node:child_process';

export interface ProcessPortInfo {
  port: number;
  pid: number;
  command: string;
  user: string;
  protocol: string;
}

export interface DiagnosticResult {
  hasConflict: boolean;
  issueType:
    | 'PORT_IN_USE'
    | 'PROCESS_ZOMBIE'
    | 'PERMISSION_DENIED'
    | 'COMMAND_NOT_FOUND'
    | 'OUT_OF_MEMORY'
    | 'MISSING_DEPENDENCY'
    | 'MISSING_ENV_VAR'
    | 'UNKNOWN';
  summary: string;
  actionableFix: string;
  details?: Record<string, any>;
}

export class RuntimeDoctor {
  public inspectPort(targetPort?: number): ProcessPortInfo[] {
    const results: ProcessPortInfo[] = [];
    try {
      const cmd = targetPort ? `lsof -nP -iTCP:${targetPort} -sTCP:LISTEN` : `lsof -nP -iTCP -sTCP:LISTEN`;
      const output = execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
      const lines = output.trim().split('\n');

      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].trim().split(/\s+/);
        if (parts.length >= 9) {
          const command = parts[0];
          const pid = parseInt(parts[1], 10);
          const user = parts[2];
          const nameField = parts[parts.length - 2] || parts[parts.length - 1];

          const portMatch = nameField.match(/:(\d+)$/);
          const port = portMatch ? parseInt(portMatch[1], 10) : 0;

          if (port > 0) {
            results.push({
              port,
              pid,
              command,
              user,
              protocol: 'TCP'
            });
          }
        }
      }
    } catch {
      // lsof returns 1 when no sockets match
    }
    return results;
  }

  public killProcess(pid: number, force: boolean = false): { success: boolean; message: string } {
    try {
      const signal = force ? 'SIGKILL' : 'SIGTERM';
      process.kill(pid, signal);
      return {
        success: true,
        message: `Processo PID ${pid} terminato con segnale ${signal}.`
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Impossibile terminare il processo PID ${pid}: ${err.message}`
      };
    }
  }

  public diagnoseError(errorMessageOrLog: string): DiagnosticResult {
    const text = errorMessageOrLog;

    // 1. Port conflict / EADDRINUSE
    const portMatch = text.match(/(?:EADDRINUSE|address already in use).*?(?:port\s*|:)?(\d{2,5})/i) ||
                      text.match(/port\s+(\d{2,5})\s+is already in use/i);

    if (portMatch) {
      const port = parseInt(portMatch[1], 10);
      const activeProcesses = this.inspectPort(port);
      if (activeProcesses.length > 0) {
        const p = activeProcesses[0];
        return {
          hasConflict: true,
          issueType: 'PORT_IN_USE',
          summary: `La porta ${port} è già occupata dal processo '${p.command}' (PID: ${p.pid}, utente: ${p.user}).`,
          actionableFix: `Esegui il tool 'driftguard_kill_process' con PID ${p.pid} oppure termina manualmente con: 'kill -9 ${p.pid}'.`,
          details: { process: p }
        };
      } else {
        return {
          hasConflict: true,
          issueType: 'PORT_IN_USE',
          summary: `La porta ${port} sembra bloccata in stato di TIME_WAIT.`,
          actionableFix: `Attendi qualche secondo oppure imposta una porta alternativa (es. PORT=${port + 1}).`
        };
      }
    }

    // 2. Out of Memory (OOM / Heap Overflow / Exit code 137)
    if (
      text.includes('JavaScript heap out of memory') ||
      text.includes('MemoryError') ||
      text.includes('exit code 137') ||
      text.includes('SIGKILL') && text.includes('memory')
    ) {
      return {
        hasConflict: true,
        issueType: 'OUT_OF_MEMORY',
        summary: 'Il processo è stato terminato per esaurimento della memoria RAM disponibile (OOM).',
        actionableFix: 'Aumenta il limite di memoria heap di Node.js eseguendo: NODE_OPTIONS="--max-old-space-size=4096" oppure ottimizza la gestione dello stream di dati.'
      };
    }

    // 3. Modulo Node.js mancante
    const nodeModMatch = text.match(/Cannot find module ['"]([^'"]+)['"]/i) ||
                         text.match(/Error: Cannot find package ['"]([^'"]+)['"]/i);
    if (nodeModMatch) {
      const mod = nodeModMatch[1];
      return {
        hasConflict: true,
        issueType: 'MISSING_DEPENDENCY',
        summary: `Modulo Node.js mancante: '${mod}'.`,
        actionableFix: `Installa il modulo mancante con: 'npm install ${mod}' (oppure 'npm install --save-dev ${mod}' se tipo di sviluppo).`
      };
    }

    // 4. Modulo Python mancante
    const pyModMatch = text.match(/ModuleNotFoundError: No module named ['"]([^'"]+)['"]/i);
    if (pyModMatch) {
      const mod = pyModMatch[1];
      return {
        hasConflict: true,
        issueType: 'MISSING_DEPENDENCY',
        summary: `Modulo Python mancante: '${mod}'.`,
        actionableFix: `Installa il modulo mancante con: 'pip install ${mod}' oppure 'uv add ${mod}'.`
      };
    }

    // 5. Variabile d'ambiente mancante
    const envMatch = text.match(/process\.env\.([A-Z0-9_]+)\s+is undefined/i) ||
                     text.match(/KeyError: ['"]([A-Z0-9_]+)['"]/i) ||
                     text.match(/missing required environment variable ['"]?([A-Z0-9_]+)['"]?/i);
    if (envMatch) {
      const envVar = envMatch[1];
      return {
        hasConflict: true,
        issueType: 'MISSING_ENV_VAR',
        summary: `Variabile d'ambiente richiesta ma non definita: '${envVar}'.`,
        actionableFix: `Aggiungi '${envVar}=<tuo_valore>' al file .env locale ed esegui con dotenv caricato.`
      };
    }

    // 6. Errore permessi EACCES
    if (text.includes('EACCES') || text.includes('permission denied')) {
      return {
        hasConflict: true,
        issueType: 'PERMISSION_DENIED',
        summary: `Errore di permessi di accesso al filesystem o binding a porta riservata.`,
        actionableFix: `Verifica i permessi del percorso o evita l'uso di porte < 1024 senza privilegi root.`
      };
    }

    // 7. Command not found
    const cmdMatch = text.match(/command not found:\s*(\S+)/i) || text.match(/'(\S+)' is not recognized/i);
    if (cmdMatch) {
      const missingCmd = cmdMatch[1];
      return {
        hasConflict: true,
        issueType: 'COMMAND_NOT_FOUND',
        summary: `Comando '${missingCmd}' non trovato nel PATH.`,
        actionableFix: `Verifica l'installazione di '${missingCmd}' o il percorso nel PATH di sistema.`
      };
    }

    return {
      hasConflict: false,
      issueType: 'UNKNOWN',
      summary: `Nessun conflitto critico noto (porte, OOM, dipendenze mancanti) rilevato.`,
      actionableFix: `Ispeziona l'intero stack trace e i log di sistema.`
    };
  }
}
