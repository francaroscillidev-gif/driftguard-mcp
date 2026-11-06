import { SnapshotManager } from './snapshot.js';
import { SecretScanner } from './secrets.js';
import { TelemetryBudgetManager } from './telemetry.js';
import crypto from 'node:crypto';

export interface AuditReportData {
  generatedAt: string;
  workspacePath: string;
  reportId: string;
  integrityHash: string;
  markdownContent: string;
}

export class AuditTrailExporter {
  public generateReport(
    workspacePath: string,
    snapshotManager: SnapshotManager,
    secretScanner: SecretScanner,
    telemetry: TelemetryBudgetManager
  ): AuditReportData {
    const timestamp = new Date().toISOString();
    const snapshots = snapshotManager.listSnapshots();
    const secrets = secretScanner.scanWorkspace(workspacePath);
    const budget = telemetry.getStatus();

    const reportId = `audit_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

    const md = [
      `# 📋 Agent-Blackbox Compliance & Audit Trail Report`,
      `**Report ID**: \`${reportId}\``,
      `**Data Generazione**: \`${timestamp}\``,
      `**Workspace Verificato**: \`${workspacePath}\``,
      `**Stato Complessivo di Sicurezza**: ${secrets.length === 0 ? '🟢 CONFORME (Zero Segreti Rilevati)' : '🔴 NON CONFORME (Segreti Rilevati)'}`,
      '',
      '---',
      '',
      '## 1. 📊 Telemetria & Costi Sessione',
      `- **Comandi Totali Tracciati**: ${budget.commandsExecuted}`,
      `- **Token Stimati Consumati**: ${budget.totalTokensEstimated.toLocaleString()}`,
      `- **Token Risparmiati dal Compressore**: ${budget.tokensSavedByCompressor.toLocaleString()}`,
      `- **Spesa Stimata**: ~$${budget.estimatedCostUSD} USD`,
      `- **Stato Budget**: ${budget.alertLevel} (${budget.percentConsumed}% utilizzato)`,
      '',
      '## 2. 🔐 Verifica Esposizione Credenziali (GitLeaks / Secret Shield)',
      secrets.length === 0
        ? '✅ Nessuna chiave API (OpenAI, Anthropic, AWS, Stripe, GitHub, Postgres) o token hardcoded rilevato nel codice.'
        : `⚠️ Rilevati **${secrets.length}** potenziali leak di credenziali:\n` +
          secrets.map((s) => `- **${s.provider}** in \`${s.file}:${s.line}\` (valore mascherato: \`${s.secretMasked}\`)`).join('\n'),
      '',
      '## 3. 📸 Cronologia Checkpoint & Integrità Workspace',
      snapshots.length === 0
        ? '_Nessun checkpoint registrato per questa sessione._'
        : snapshots
            .map(
              (s, idx) =>
                `${idx + 1}. **${s.label}** (\`${s.id}\`) - File tracciati: ${s.fileCount} [${new Date(s.timestamp).toLocaleTimeString()}]`
            )
            .join('\n'),
      '',
      '---',
      `*Report generato e firmato digitalmente da Agent-Blackbox MCP v1.4.0.*`
    ].join('\n');

    const integrityHash = crypto.createHash('sha256').update(md).digest('hex');

    return {
      generatedAt: timestamp,
      workspacePath,
      reportId,
      integrityHash,
      markdownContent: md + `\n\n\`SHA-256 Signature: ${integrityHash}\``
    };
  }
}
