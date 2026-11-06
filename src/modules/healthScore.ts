import { SnapshotManager } from './snapshot.js';
import { SecretScanner } from './secrets.js';
import { RuntimeDoctor } from './doctor.js';
import { TelemetryBudgetManager } from './telemetry.js';

export interface HealthScoreResult {
  score: number; // 0 to 100
  verdict: 'EXCELLENT' | 'GOOD' | 'NEEDS_ATTENTION' | 'CRITICAL';
  factors: {
    cleanWorkingDirectory: boolean;
    zeroLeakedSecrets: boolean;
    noZombiePorts: boolean;
    budgetSafe: boolean;
    snapshotsAvailable: boolean;
  };
  recommendations: string[];
  markdownSummary: string;
}

export class HealthScoreEngine {
  public calculateHealth(
    workspacePath: string,
    snapshotManager: SnapshotManager,
    secretScanner: SecretScanner,
    runtimeDoctor: RuntimeDoctor,
    telemetry: TelemetryBudgetManager
  ): HealthScoreResult {
    let score = 100;
    const recommendations: string[] = [];

    // 1. Controllo segreti esposti (-30 se ci sono segreti)
    const secrets = secretScanner.scanWorkspace(workspacePath);
    const zeroLeakedSecrets = secrets.length === 0;
    if (!zeroLeakedSecrets) {
      score -= 30;
      recommendations.push(`Bonifica i ${secrets.length} segreti trovati nel codice usando 'driftguard_remediate_secret'.`);
    }

    // 2. Controllo porte aperte/zombie (-15 se ci sono porte bloccate)
    const ports = runtimeDoctor.inspectPort();
    const noZombiePorts = ports.length === 0;
    if (!noZombiePorts) {
      score -= 15;
      recommendations.push(`Ci sono ${ports.length} porte TCP attive (possibili processi zombie). Ispeziona con 'driftguard_inspect_ports'.`);
    }

    // 3. Controllo budget telemetria (-20 se superato, -10 se warning)
    const budget = telemetry.getStatus();
    const budgetSafe = !budget.isOverBudget;
    if (budget.alertLevel === 'EXCEEDED') {
      score -= 20;
      recommendations.push('Budget token superato! Ottimizza i prompt con il compressore di log.');
    } else if (budget.alertLevel === 'WARNING') {
      score -= 10;
      recommendations.push('Raggiunto l\'80% del budget sessione.');
    }

    // 4. Presenza di snapshot di sicurezza (-10 se nessuno snapshot)
    const snapshots = snapshotManager.listSnapshots();
    const snapshotsAvailable = snapshots.length > 0;
    if (!snapshotsAvailable) {
      score -= 10;
      recommendations.push('Nessun checkpoint registrato. Crea uno snapshot preventivo con "driftguard_create_snapshot".');
    }

    score = Math.max(0, Math.min(100, score));

    let verdict: HealthScoreResult['verdict'] = 'EXCELLENT';
    if (score < 50) verdict = 'CRITICAL';
    else if (score < 75) verdict = 'NEEDS_ATTENTION';
    else if (score < 90) verdict = 'GOOD';

    const markdownSummary = [
      `### 🩺 Workspace Health Score: **${score}/100** [${verdict}]`,
      `- **Segreti Protetti**: ${zeroLeakedSecrets ? '✅ Nessun leak' : '❌ Credenziali in chiaro' }`,
      `- **Porte & Processi**: ${noZombiePorts ? '✅ Pulito' : `⚠️ ${ports.length} porte in ascolto`}`,
      `- **Stato Budget**: ${budgetSafe ? '✅ Nei limiti' : '❌ Superato'}`,
      `- **Checkpoint di Ripristino**: ${snapshotsAvailable ? `✅ ${snapshots.length} disponibili` : '⚠️ Nessuno'}`,
      recommendations.length > 0 ? '\n**Azioni Consigliate**:\n' + recommendations.map((r) => `- ${r}`).join('\n') : '\n✅ Tutto perfetto e pronto per produzione!'
    ].join('\n');

    return {
      score,
      verdict,
      factors: {
        cleanWorkingDirectory: true,
        zeroLeakedSecrets,
        noZombiePorts,
        budgetSafe,
        snapshotsAvailable
      },
      recommendations,
      markdownSummary
    };
  }
}
