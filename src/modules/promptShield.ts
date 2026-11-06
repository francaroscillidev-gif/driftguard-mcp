export interface PromptInjectionAssessment {
  isSuspicious: boolean;
  threatLevel: 'SAFE' | 'SUSPICIOUS' | 'CRITICAL_INJECTION';
  riskScore: number;
  reason: string;
  matchedPatterns: string[];
  suggestedAction?: string;
}

export class PromptShieldGuard {
  private injectionPatterns: Array<{
    id: string;
    regex: RegExp;
    threat: 'SUSPICIOUS' | 'CRITICAL_INJECTION';
    score: number;
    reason: string;
  }> = [
    {
      id: 'INSTRUCTION_OVERRIDE',
      regex: /(ignore|disregard|forget)\s+(all\s+)?(previous|prior|above|existing)?\s*(instructions|prompts|rules)/i,
      threat: 'CRITICAL_INJECTION',
      score: 95,
      reason: 'Tentativo esplicito di sovrascrittura delle istruzioni di sistema (Instruction Override).'
    },
    {
      id: 'ROLEPLAY_JAILBREAK',
      regex: /(you\s+are\s+now\s+(DAN|unrestricted|in\s+developer\s+mode)|act\s+as\s+an\s+unfiltered\s+ai|jailbroken\s+mode|\bDAN\b)/i,
      threat: 'CRITICAL_INJECTION',
      score: 90,
      reason: 'Pattern tipico di jailbreak di personalità (DAN / Unrestricted / Developer Mode).'
    },
    {
      id: 'SECRET_EXFILTRATION_PROMPT',
      regex: /(send|post|transmit|exfiltrate)\s+.*?(all\s+api\s+keys|env\s+variables|passwords|credentials)\s+to\b/i,
      threat: 'CRITICAL_INJECTION',
      score: 100,
      reason: 'Istruzione per trasmettere o esfiltrare credenziali riservate verso server esterni.'
    },
    {
      id: 'SYSTEM_PROMPT_LEAK_REQUEST',
      regex: /(repeat|print|reveal|output)\s+(your\s+)?(entire\s+)?(system\s+prompt|initial\s+instructions)/i,
      threat: 'SUSPICIOUS',
      score: 65,
      reason: 'Richiesta di rivelare il system prompt o la configurazione interna.'
    }
  ];

  public inspectContent(content: string): PromptInjectionAssessment {
    const text = content.trim();
    const matches: string[] = [];
    let highestScore = 0;
    let worstThreat: PromptInjectionAssessment['threatLevel'] = 'SAFE';
    let worstReason = 'Contenuto sicuro, nessun vettore di injection rilevato.';

    for (const pattern of this.injectionPatterns) {
      if (pattern.regex.test(text)) {
        matches.push(pattern.id);
        if (pattern.score > highestScore) {
          highestScore = pattern.score;
          worstThreat = pattern.threat;
          worstReason = pattern.reason;
        }
      }
    }

    return {
      isSuspicious: worstThreat !== 'SAFE',
      threatLevel: worstThreat,
      riskScore: highestScore,
      reason: worstReason,
      matchedPatterns: matches,
      suggestedAction:
        worstThreat === 'CRITICAL_INJECTION'
          ? 'Blocca l\'elaborazione di questo testo e segnala il tentativo di injection all\'utente.'
          : undefined
    };
  }
}
