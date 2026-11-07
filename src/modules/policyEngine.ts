import fs from 'node:fs';
import path from 'node:path';

export interface PolicyRule {
  id: string;
  action: 'DENY' | 'ALLOW' | 'REQUIRE_CONFIRMATION';
  pattern: string; // regex pattern string
  description: string;
}

export interface SecurityPolicyConfig {
  version: string;
  environment: 'development' | 'staging' | 'production';
  rules: PolicyRule[];
  protectedDirectories: string[];
  maxMemoryMB?: number;
}

export class PolicyEngine {
  private config: SecurityPolicyConfig;

  constructor(workspacePath: string) {
    const policyFile = path.join(workspacePath, 'driftguard.policy.json');
    if (fs.existsSync(policyFile)) {
      try {
        this.config = JSON.parse(fs.readFileSync(policyFile, 'utf-8'));
      } catch {
        this.config = this.getDefaultPolicy();
      }
    } else {
      this.config = this.getDefaultPolicy();
    }
  }

  private getDefaultPolicy(): SecurityPolicyConfig {
    return {
      version: '2.0.0',
      environment: 'development',
      protectedDirectories: ['.git', '.env', 'node_modules', 'credentials', 'cert', 'production'],
      rules: [
        {
          id: 'DENY_RAW_DISK_WRITE',
          action: 'DENY',
          pattern: '\\bdd\\s+.*?of=/dev/',
          description: 'Blocca scritture grezze dirette su disco a basso livello.'
        },
        {
          id: 'DENY_KILL_ROOT',
          action: 'DENY',
          pattern: '\\bkill\\s+(-9\\s+)?(1\\b|0\\b)',
          description: 'Blocca tentativi di terminare processi di init o di sistema root.'
        },
        {
          id: 'DENY_ENV_PRINT',
          action: 'DENY',
          pattern: '\\b(printenv|env|set)\\b.*?(\\||>)',
          description: 'Blocca tentativi di esportare o redirezionare variabili d\'ambiente su file/rete.'
        }
      ]
    };
  }

  public evaluateAction(actionDescription: string, targetPath?: string): {
    allowed: boolean;
    violatedRule?: PolicyRule;
    reason: string;
  } {
    // 1. Verifica cartelle protette
    if (targetPath) {
      for (const prot of this.config.protectedDirectories) {
        if (targetPath.includes(prot)) {
          return {
            allowed: false,
            reason: `Violazione Policy Aziendale: Il percorso '${targetPath}' si trova all'interno della cartella protetta '${prot}'.`
          };
        }
      }
    }

    // 2. Verifica regole regex
    for (const rule of this.config.rules) {
      const reg = new RegExp(rule.pattern, 'i');
      if (reg.test(actionDescription)) {
        if (rule.action === 'DENY') {
          return {
            allowed: false,
            violatedRule: rule,
            reason: `Violazione Policy Aziendale [${rule.id}]: ${rule.description}`
          };
        }
      }
    }

    return {
      allowed: true,
      reason: 'Azione pienamente conforme alle policy di sicurezza.'
    };
  }
}
