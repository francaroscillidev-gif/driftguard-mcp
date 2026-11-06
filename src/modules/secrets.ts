import fs from 'node:fs';
import path from 'node:path';

export interface SecretFinding {
  provider: 'OPENAI' | 'ANTHROPIC' | 'GITHUB' | 'GOOGLE' | 'AWS' | 'STRIPE' | 'DATABASE_URL' | 'GENERIC_SECRET';
  secretMasked: string;
  rawSecret: string;
  file: string;
  line: number;
  suggestedEnvVar: string;
}

export class SecretScanner {
  private patterns: Array<{
    provider: SecretFinding['provider'];
    regex: RegExp;
    envPrefix: string;
  }> = [
    {
      provider: 'ANTHROPIC',
      regex: /\bsk-ant-[a-zA-Z0-9_\-]{30,}\b/g,
      envPrefix: 'ANTHROPIC_API_KEY'
    },
    {
      provider: 'OPENAI',
      regex: /\bsk-(?!ant-)[a-zA-Z0-9_\-]{30,}\b/g,
      envPrefix: 'OPENAI_API_KEY'
    },
    {
      provider: 'GITHUB',
      regex: /\b(ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{82})\b/g,
      envPrefix: 'GITHUB_TOKEN'
    },
    {
      provider: 'GOOGLE',
      regex: /\bAIza[0-9A-Za-z\-_]{35}\b/g,
      envPrefix: 'GEMINI_API_KEY'
    },
    {
      provider: 'AWS',
      regex: /\bAKIA[0-9A-Z]{16}\b/g,
      envPrefix: 'AWS_ACCESS_KEY_ID'
    },
    {
      provider: 'STRIPE',
      regex: /\bsk_live_[0-9a-zA-Z]{24}\b/g,
      envPrefix: 'STRIPE_SECRET_KEY'
    },
    {
      provider: 'DATABASE_URL',
      regex: /postgres(?:ql)?:\/\/[^:\s]+:[^@\s]+@[^\s\/]+\/[^\s]+/g,
      envPrefix: 'DATABASE_URL'
    }
  ];

  private mask(secret: string): string {
    if (secret.length <= 8) return '****';
    return secret.slice(0, 4) + '...' + secret.slice(-4);
  }

  public scanText(text: string, filePath: string = 'inline'): SecretFinding[] {
    const findings: SecretFinding[] = [];
    const lines = text.split('\n');

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const lineText = lines[lineIndex];

      for (const pattern of this.patterns) {
        pattern.regex.lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = pattern.regex.exec(lineText)) !== null) {
          const rawSecret = match[0];
          findings.push({
            provider: pattern.provider,
            secretMasked: this.mask(rawSecret),
            rawSecret,
            file: filePath,
            line: lineIndex + 1,
            suggestedEnvVar: pattern.envPrefix
          });
        }
      }
    }

    return findings;
  }

  public scanWorkspace(workspacePath: string): SecretFinding[] {
    const findings: SecretFinding[] = [];
    const ignored = new Set(['node_modules', '.git', '.driftguard', 'dist', '.env']);

    const walk = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (ignored.has(entry.name)) continue;
        const full = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          walk(full);
        } else if (entry.isFile()) {
          try {
            const stats = fs.statSync(full);
            if (stats.size > 2 * 1024 * 1024) continue;

            const content = fs.readFileSync(full, 'utf-8');
            const rel = path.relative(workspacePath, full);
            findings.push(...this.scanText(content, rel));
          } catch {
            // Ignora errori di lettura su binari
          }
        }
      }
    };

    walk(workspacePath);
    return findings;
  }

  public remediate(workspacePath: string, finding: SecretFinding): { success: boolean; message: string } {
    try {
      const fullPath = path.join(workspacePath, finding.file);
      if (!fs.existsSync(fullPath)) {
        return { success: false, message: `File ${finding.file} non trovato.` };
      }

      const envPath = path.join(workspacePath, '.env');
      let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : '';

      if (!envContent.includes(finding.suggestedEnvVar)) {
        envContent += (envContent && !envContent.endsWith('\n') ? '\n' : '') + `${finding.suggestedEnvVar}=${finding.rawSecret}\n`;
        fs.writeFileSync(envPath, envContent, 'utf-8');
      }

      let srcContent = fs.readFileSync(fullPath, 'utf-8');
      const replacement = `process.env.${finding.suggestedEnvVar}`;
      srcContent = srcContent.split(finding.rawSecret).join(replacement);
      fs.writeFileSync(fullPath, srcContent, 'utf-8');

      const gitignorePath = path.join(workspacePath, '.gitignore');
      let giContent = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf-8') : '';
      if (!giContent.includes('.env')) {
        giContent += (giContent && !giContent.endsWith('\n') ? '\n' : '') + '.env\n';
        fs.writeFileSync(gitignorePath, giContent, 'utf-8');
      }

      return {
        success: true,
        message: `Segreto ${finding.secretMasked} bonificato con successo: estratto in .env come ${finding.suggestedEnvVar} e sostituito con process.env.${finding.suggestedEnvVar}.`
      };
    } catch (err: any) {
      return { success: false, message: `Errore durante la bonifica: ${err.message}` };
    }
  }
}
