import crypto from 'node:crypto';

export type BreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitStatus {
  state: BreakerState;
  consecutiveFailures: number;
  threshold: number;
  isLoopDetected: boolean;
  message: string;
  recommendedAction?: string;
}

export class CircuitBreakerManager {
  private threshold: number;
  private consecutiveFailures: number = 0;
  private state: BreakerState = 'CLOSED';
  private lastCommandHash: string | null = null;
  private history: Array<{ hash: string; timestamp: number; exitCode: number }> = [];

  constructor(threshold: number = 3) {
    this.threshold = threshold;
  }

  private hashAttempt(command: string, errorSnippet?: string): string {
    const raw = (command.trim() + '::' + (errorSnippet ? errorSnippet.trim().slice(0, 100) : '')).toLowerCase();
    return crypto.createHash('md5').update(raw).digest('hex');
  }

  public recordAttempt(command: string, exitCode: number, errorSnippet?: string): CircuitStatus {
    const hash = this.hashAttempt(command, errorSnippet);
    const now = Date.now();

    this.history.push({ hash, timestamp: now, exitCode });
    if (this.history.length > 20) this.history.shift();

    if (exitCode === 0) {
      // Successo: resetta il contatore
      this.consecutiveFailures = 0;
      this.state = 'CLOSED';
      this.lastCommandHash = null;

      return {
        state: 'CLOSED',
        consecutiveFailures: 0,
        threshold: this.threshold,
        isLoopDetected: false,
        message: 'Comando completato con successo. Circuit Breaker chiuso e stabile.'
      };
    }

    // Fallimento
    if (this.lastCommandHash === hash) {
      this.consecutiveFailures++;
    } else {
      this.consecutiveFailures = 1;
      this.lastCommandHash = hash;
    }

    if (this.consecutiveFailures >= this.threshold) {
      this.state = 'OPEN';
      return {
        state: 'OPEN',
        consecutiveFailures: this.consecutiveFailures,
        threshold: this.threshold,
        isLoopDetected: true,
        message: `🚨 CIRCUIT BREAKER SCATTATO! Rilevato loop di allucinazione: lo stesso comando o errore è fallito ${this.consecutiveFailures} volte consecutive senza progressi.`,
        recommendedAction: 'FERMATI. Non rieseguire nuovamente questo comando. Esegui il tool "driftguard_diagnose_failure" o "driftguard_preview_rollback" per ripristinare il codice allo stato stabile.'
      };
    }

    return {
      state: 'CLOSED',
      consecutiveFailures: this.consecutiveFailures,
      threshold: this.threshold,
      isLoopDetected: false,
      message: `Comando fallito (${this.consecutiveFailures}/${this.threshold} tentativi prima del blocco del circuito).`
    };
  }

  public reset(): void {
    this.state = 'CLOSED';
    this.consecutiveFailures = 0;
    this.lastCommandHash = null;
  }

  public getStatus(): CircuitStatus {
    return {
      state: this.state,
      consecutiveFailures: this.consecutiveFailures,
      threshold: this.threshold,
      isLoopDetected: this.state === 'OPEN',
      message: this.state === 'OPEN' ? 'Circuito aperto: esecuzioni bloccate.' : 'Circuito normale.'
    };
  }
}
