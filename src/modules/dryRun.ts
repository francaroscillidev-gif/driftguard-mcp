export interface DryRunPrediction {
  command: string;
  isPredictable: boolean;
  estimatedRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  affectedPaths: string[];
  systemCallsPredicted: string[];
  recommendation: string;
}

export class DryRunSimulator {
  public simulateCommand(command: string): DryRunPrediction {
    const text = command.trim();
    const affectedPaths: string[] = [];
    const calls: string[] = [];
    let risk: DryRunPrediction['estimatedRisk'] = 'LOW';

    // Rileva creazione o eliminazione file
    if (/\b(rm|unlink)\b/i.test(text)) {
      calls.push('fs.unlink', 'fs.rmdir');
      risk = 'HIGH';
      const parts = text.split(/\s+/).slice(1);
      affectedPaths.push(...parts.filter((p) => !p.startsWith('-')));
    }

    if (/\b(mkdir)\b/i.test(text)) {
      calls.push('fs.mkdir');
      const parts = text.split(/\s+/).slice(1);
      affectedPaths.push(...parts.filter((p) => !p.startsWith('-')));
    }

    if (/\b(touch|cat\s+.*?>|echo\s+.*?>)\b/i.test(text)) {
      calls.push('fs.writeFile', 'fs.appendFile');
      if (risk !== 'HIGH') risk = 'MEDIUM';
      const match = text.match(/>\s*(\S+)/);
      if (match) affectedPaths.push(match[1]);
    }

    if (/\b(npm|yarn|pnpm|pip)\s+(install|add|i)\b/i.test(text)) {
      calls.push('process.exec', 'network.download', 'fs.writePackageJson');
      if (risk !== 'HIGH') risk = 'MEDIUM';
    }

    const recommendation =
      risk === 'HIGH'
        ? 'Si raccomanda di eseguire "driftguard_create_snapshot" prima di lanciare questo comando distruttivo.'
        : 'Comando a basso/medio impatto, sicuro per l\'esecuzione ordinaria.';

    return {
      command: text,
      isPredictable: calls.length > 0,
      estimatedRisk: risk,
      affectedPaths: [...new Set(affectedPaths)],
      systemCallsPredicted: calls,
      recommendation
    };
  }
}
