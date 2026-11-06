export interface BudgetConfig {
  maxTokens?: number;
  maxCostUSD?: number;
  costPer1kTokens?: number; // default $0.003
}

export interface BudgetStatus {
  totalTokensEstimated: number;
  tokensSavedByCompressor: number;
  estimatedCostUSD: number;
  commandsExecuted: number;
  budgetCapTokens?: number;
  budgetCapUSD?: number;
  percentConsumed: number;
  isOverBudget: boolean;
  alertLevel: 'NORMAL' | 'WARNING' | 'EXCEEDED';
  message: string;
}

export class TelemetryBudgetManager {
  private totalTokens: number = 0;
  private tokensSaved: number = 0;
  private commandsCount: number = 0;
  private config: Required<BudgetConfig>;

  constructor(config?: BudgetConfig) {
    this.config = {
      maxTokens: config?.maxTokens || 250000,
      maxCostUSD: config?.maxCostUSD || 1.0,
      costPer1kTokens: config?.costPer1kTokens || 0.003
    };
  }

  public trackUsage(textOrTokenCount: string | number, tokensSaved: number = 0): void {
    let tokens = 0;
    if (typeof textOrTokenCount === 'number') {
      tokens = textOrTokenCount;
    } else {
      // Stima euristica 1 token ogni ~4 caratteri
      tokens = Math.max(1, Math.round(textOrTokenCount.length / 4));
    }

    this.totalTokens += tokens;
    this.tokensSaved += tokensSaved;
    this.commandsCount++;
  }

  public getStatus(): BudgetStatus {
    const cost = (this.totalTokens / 1000) * this.config.costPer1kTokens;
    const tokenPercent = (this.totalTokens / this.config.maxTokens) * 100;
    const costPercent = (cost / this.config.maxCostUSD) * 100;
    const percentConsumed = Math.round(Math.max(tokenPercent, costPercent));

    let alertLevel: BudgetStatus['alertLevel'] = 'NORMAL';
    let message = 'Budget nei limiti operativi.';

    if (percentConsumed >= 100) {
      alertLevel = 'EXCEEDED';
      message = `🚨 BUDGET SUPERATO! Consumati ${this.totalTokens} token (~$${cost.toFixed(3)} USD). Termina le operazioni o aumenta il limite.`;
    } else if (percentConsumed >= 80) {
      alertLevel = 'WARNING';
      message = `⚠️ Attenzione: raggiunto l'80% del budget sessione (${percentConsumed}% consumato). Ottimizza le chiamate e sintetizza.`;
    }

    return {
      totalTokensEstimated: this.totalTokens,
      tokensSavedByCompressor: this.tokensSaved,
      estimatedCostUSD: Number(cost.toFixed(4)),
      commandsExecuted: this.commandsCount,
      budgetCapTokens: this.config.maxTokens,
      budgetCapUSD: this.config.maxCostUSD,
      percentConsumed,
      isOverBudget: percentConsumed >= 100,
      alertLevel,
      message
    };
  }

  public reset(): void {
    this.totalTokens = 0;
    this.tokensSaved = 0;
    this.commandsCount = 0;
  }
}
