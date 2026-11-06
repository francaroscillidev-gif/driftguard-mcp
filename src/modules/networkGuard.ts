export interface NetworkAssessment {
  verdict: 'SAFE' | 'WARNING' | 'CRITICAL_BLOCK';
  riskScore: number;
  reason: string;
  detectedUrlOrHost?: string;
  mitigationSuggestion?: string;
}

export class NetworkEgressGuard {
  private allowedDomains: string[] = [
    'github.com',
    'raw.githubusercontent.com',
    'npmjs.org',
    'registry.npmjs.org',
    'pypi.org',
    'files.pythonhosted.org',
    'openai.com',
    'api.openai.com',
    'anthropic.com',
    'api.anthropic.com',
    'googleapis.com',
    'aws.amazon.com',
    'amazonaws.com',
    'cloudflare.com',
    'localhost',
    '127.0.0.1'
  ];

  public evaluateNetworkCommand(command: string): NetworkAssessment {
    const text = command.trim();

    // 1. Pattern critico: Download ed esecuzione shell piped (curl ... | bash o sh)
    const pipeExecPattern = /(curl|wget|fetch).*?\|\s*(bash|sh|zsh|python|perl|eval)/i;
    if (pipeExecPattern.test(text)) {
      return {
        verdict: 'CRITICAL_BLOCK',
        riskScore: 100,
        reason: 'Tentativo di download ed esecuzione diretta di script da remoto tramite pipe (| bash/sh). Pattern tipico di malware.',
        mitigationSuggestion: 'Scarica prima lo script in locale, ispezionalo attentamente ed eseguilo solo se verificato.'
      };
    }

    // 2. Reverse shell o tunneling
    const reverseShellPattern = /\b(nc|ncat|netcat)\s+.*?-e\s+|\b(ngrok|localtunnel|cloudflared)\b/i;
    if (reverseShellPattern.test(text)) {
      return {
        verdict: 'CRITICAL_BLOCK',
        riskScore: 95,
        reason: 'Rilevato comando per stabilire una reverse shell o tunneling non autorizzato verso l\'esterno.',
        mitigationSuggestion: 'Usa esclusivamente porte locali e connessioni documentate.'
      };
    }

    // 3. Estrazione domini/URL per verifica con whitelist
    const urlMatches = text.match(/https?:\/\/([a-zA-Z0-9.\-_]+)/g);
    if (urlMatches) {
      for (const rawUrl of urlMatches) {
        try {
          const parsed = new URL(rawUrl);
          const host = parsed.hostname.toLowerCase();

          // Rileva IP grezzi (es. http://194.23.4.1)
          if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host) && host !== '127.0.0.1') {
            return {
              verdict: 'CRITICAL_BLOCK',
              riskScore: 90,
              reason: `Connessione diretta verso indirizzo IP non risolto tramite dominio DNS: '${host}'.`,
              detectedUrlOrHost: host,
              mitigationSuggestion: 'Usa domini ufficiali verificati con certificati TLS validi.'
            };
          }

          // Verifica se è nella whitelist di domini consentiti
          const isAllowed = this.allowedDomains.some((d) => host === d || host.endsWith('.' + d));
          if (!isAllowed) {
            return {
              verdict: 'WARNING',
              riskScore: 65,
              reason: `Connessione di rete verso dominio esterno non presente nella whitelist sicura: '${host}'.`,
              detectedUrlOrHost: host,
              mitigationSuggestion: `Verifica che '${host}' sia un repository di dipendenze fidato prima di procedere.`
            };
          }
        } catch {
          // Ignora parsing non valido
        }
      }
    }

    return {
      verdict: 'SAFE',
      riskScore: 0,
      reason: 'Nessun pattern di esfiltrazione o connessione malevola rilevato.'
    };
  }
}
