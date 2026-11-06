import fs from 'node:fs';
import path from 'node:path';

export interface DependencyAuditResult {
  hasVulnerabilities: boolean;
  warningsCount: number;
  advisories: Array<{
    package: string;
    installedVersion?: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    recommendation: string;
  }>;
  markdownSummary: string;
}

export class DependencyAuditor {
  // Pattern euristici per pacchetti notoriamente a rischio o deprecati di recente
  private flaggedPackages: Record<string, { severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; reason: string }> = {
    'event-stream': { severity: 'CRITICAL', reason: 'Pacchetto compromesso storicamente da attacco alla supply-chain.' },
    'flatmap-stream': { severity: 'CRITICAL', reason: 'Malware iniettato noto.' },
    'request': { severity: 'MEDIUM', reason: 'Pacchetto deprecato dal 2020. Usa fetch nativo o axios/undici.' },
    'colors': { severity: 'HIGH', reason: 'Versioni storiche contaminate con denial of service.' },
    'node-serialize': { severity: 'CRITICAL', reason: 'Vulnerabilità di esecuzione arbitraria di codice (RCE).' }
  };

  public audit(workspacePath: string): DependencyAuditResult {
    const pkgPath = path.join(workspacePath, 'package.json');
    const advisories: DependencyAuditResult['advisories'] = [];

    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        const allDeps = {
          ...(pkg.dependencies || {}),
          ...(pkg.devDependencies || {})
        };

        for (const [depName, depVer] of Object.entries(allDeps)) {
          if (this.flaggedPackages[depName]) {
            const info = this.flaggedPackages[depName];
            advisories.push({
              package: depName,
              installedVersion: String(depVer),
              severity: info.severity,
              recommendation: info.reason
            });
          }
        }
      } catch {}
    }

    const hasVulnerabilities = advisories.some((a) => a.severity === 'HIGH' || a.severity === 'CRITICAL');
    const markdownSummary = [
      `### 🛡️ Dependency Security Audit`,
      advisories.length === 0
        ? '✅ Nessuna dipendenza compromessa o deprecata nota rilevata nel manifesto di progetto.'
        : `⚠️ Rilevate **${advisories.length}** segnalazioni di sicurezza:\n` +
          advisories.map((a) => `- **[${a.severity}]** \`${a.package}\` (${a.installedVersion}): ${a.recommendation}`).join('\n')
    ].join('\n');

    return {
      hasVulnerabilities,
      warningsCount: advisories.length,
      advisories,
      markdownSummary
    };
  }
}
