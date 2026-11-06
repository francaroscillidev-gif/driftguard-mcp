export interface SafetyAssessment {
  verdict: 'SAFE' | 'WARNING' | 'CRITICAL_BLOCK';
  riskScore: number; // 0 to 100
  reason: string;
  mitigationSuggestion?: string;
  matchedRules: string[];
}

export class SafetyGuardrail {
  private dangerousPatterns: Array<{
    id: string;
    regex: RegExp;
    verdict: 'WARNING' | 'CRITICAL_BLOCK';
    score: number;
    reason: string;
    suggestion: string;
  }> = [
    {
      id: 'ROOT_DELETION',
      regex: /\brm\s+(-[a-zA-Z]*r[a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*r|--recursive)\s+([\/\~]|\.\.|\*)\s*$/i,
      verdict: 'CRITICAL_BLOCK',
      score: 100,
      reason: 'Tentativo di cancellazione ricorsiva distruttiva della root (/) o della home directory.',
      suggestion: 'Specifica esplicitamente una sottocartella di lavoro isolata invece della root.'
    },
    {
      id: 'PERMISSIVE_CHMOD',
      regex: /\bchmod\s+(-[a-zA-Z]*R\s+)?(777|a\+[rwx]{3})\b/i,
      verdict: 'CRITICAL_BLOCK',
      score: 95,
      reason: 'Concessione permessi aperti totali (777 o a+rwx) che espongono il sistema ad attacchi.',
      suggestion: 'Usa permessi restrittivi (es. 755 o 644) solo per i file necessari.'
    },
    {
      id: 'FORK_BOMB',
      regex: /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/,
      verdict: 'CRITICAL_BLOCK',
      score: 100,
      reason: 'Pattern identico a una shell fork-bomb progettata per saturare e bloccare la CPU.',
      suggestion: 'Comando malevolo bloccato categoricamente.'
    },
    {
      id: 'SYSTEM_DIRECTORY_MODIFICATION',
      regex: /\b(sudo\s+)?(rm|mv|chown)\s+.*?\b(\/etc|\/boot|\/bin|\/sbin|\/usr\/bin|\/System)\b/i,
      verdict: 'CRITICAL_BLOCK',
      score: 95,
      reason: 'Modifica o cancellazione diretta di cartelle o binari critici di sistema operativo.',
      suggestion: 'Limita le operazioni esclusivamente all\'interno del workspace dell\'utente.'
    },
    {
      id: 'RAW_HARD_DRIVE_WRITE',
      regex: /\bdd\s+.*?(of=\/dev\/(sd[a-z]|disk|nvme|zero))/i,
      verdict: 'CRITICAL_BLOCK',
      score: 100,
      reason: 'Scrittura grezza diretta su un dispositivo o blocco di memoria del disco.',
      suggestion: 'Operazione di partizionamento/low-level non autorizzata.'
    },
    {
      id: 'DROP_DATABASE',
      regex: /\b(DROP\s+DATABASE|DROP\s+TABLE|TRUNCATE\s+TABLE)\b/i,
      verdict: 'WARNING',
      score: 75,
      reason: 'Esecuzione di query DDL distruttive su database che comportano perdita permanente di dati.',
      suggestion: 'Esegui prima uno snapshot o un backup del database prima di troncare tabelle.'
    },
    {
      id: 'POTENTIAL_TOKEN_EXPOSURE',
      regex: /(curl|wget|echo).*?(ghp_[A-Za-z0-9_]{20,}|npm_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,})/i,
      verdict: 'WARNING',
      score: 70,
      reason: 'Comando contenente chiavi API segrete (GitHub/npm/OpenAI) in chiaro negli argomenti.',
      suggestion: 'Passa i token tramite variabili d\'ambiente (es. $GITHUB_TOKEN) invece che come stringhe hardcoded nei log.'
    }
  ];

  public evaluateCommand(command: string): SafetyAssessment {
    const matchedRules: string[] = [];
    let highestScore = 0;
    let worstVerdict: 'SAFE' | 'WARNING' | 'CRITICAL_BLOCK' = 'SAFE';
    let worstReason = 'Comando sicuro per l\'esecuzione.';
    let suggestion = '';

    for (const rule of this.dangerousPatterns) {
      if (rule.regex.test(command.trim())) {
        matchedRules.push(rule.id);
        if (rule.score > highestScore) {
          highestScore = rule.score;
          worstVerdict = rule.verdict;
          worstReason = rule.reason;
          suggestion = rule.suggestion;
        }
      }
    }

    return {
      verdict: worstVerdict,
      riskScore: highestScore,
      reason: worstReason,
      mitigationSuggestion: suggestion || undefined,
      matchedRules
    };
  }
}
