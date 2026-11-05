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
  issueType: 'PORT_IN_USE' | 'PROCESS_ZOMBIE' | 'PERMISSION_DENIED' | 'COMMAND_NOT_FOUND' | 'UNKNOWN';
  summary: string;
  actionableFix: string;
  details?: Record<string, any>;
}

export class RuntimeDoctor {
  /**
   * Ispeziona porte attive o cerca il processo che blocca una porta specifica
   */
  public inspectPort(targetPort?: number): ProcessPortInfo[] {
    const results: ProcessPortInfo[] = [];
    try {
      // lsof è disponibile su macOS e Linux
      const cmd = targetPort ? `lsof -nP -iTCP:${targetPort} -sTCP:LISTEN` : `lsof -nP -iTCP -sTCP:LISTEN`;
      const output = execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
      const lines = output.trim().split('\n');

      // Header: COMMAND PID USER FD TYPE DEVICE SIZE/OFF NODE NAME
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].trim().split(/\s+/);
        if (parts.length >= 9) {
          const command = parts[0];
          const pid = parseInt(parts[1], 10);
          const user = parts[2];
          const nameField = parts[parts.length - 2] || parts[parts.length - 1]; // e.g. *:3000 o 127.0.0.1:8080

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
      // lsof exits with 1 if no process found
    }
    return results;
  }

  /**
   * Termina un processo che sta bloccando una risorsa
   */
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

  /**
   * Analizza l'output o il messaggio di errore di un comando eseguito da un agente
   * e produce una diagnosi precisa e una soluzione prescrittiva
   */
  public diagnoseError(errorMessageOrLog: string): DiagnosticResult {
    const text = errorMessageOrLog;

    // 1. Errore EADDRINUSE / Porta già in uso
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
          summary: `La porta ${port} sembra in stato di TIME_WAIT o bloccata dal sistema.`,
          actionableFix: `Attendi qualche secondo oppure cambia la porta nelle impostazioni (es. PORT=${port + 1}).`
        };
      }
    }

    // 2. Errore permessi EACCES
    if (text.includes('EACCES') || text.includes('permission denied')) {
      return {
        hasConflict: true,
        issueType: 'PERMISSION_DENIED',
        summary: `Errore di permessi durante l'accesso a un file o porta privilegiata (< 1024).`,
        actionableFix: `Verifica i permessi della cartella (chmod/chown) o evita di usare porte riservate sotto la 1024 senza privilegi.`
      };
    }

    // 3. Command not found
    const cmdMatch = text.match(/command not found:\s*(\S+)/i) || text.match(/'(\S+)' is not recognized/i);
    if (cmdMatch) {
      const missingCmd = cmdMatch[1];
      return {
        hasConflict: true,
        issueType: 'COMMAND_NOT_FOUND',
        summary: `Il comando '${missingCmd}' non è installato o non è presente nel PATH di sistema.`,
        actionableFix: `Verifica se '${missingCmd}' può essere installato via package manager locale o specifica il percorso assoluto.`
      };
    }

    return {
      hasConflict: false,
      issueType: 'UNKNOWN',
      summary: `Nessun conflitto critico standard (porte o permessi) rilevato automaticamente.`,
      actionableFix: `Ispeziona lo stack trace completo o verifica le variabili d'ambiente.`
    };
  }
}
