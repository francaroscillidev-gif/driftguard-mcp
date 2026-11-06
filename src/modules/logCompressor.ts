export interface CompressedLogResult {
  originalLength: number;
  compressedLength: number;
  compressionRatioPercent: number;
  tokensSavedEstimate: number;
  primaryError: string;
  sourceLocation?: string;
  condensedOutput: string;
}

export class LogCompressor {
  // Rimuove sequenze ANSI colorate dai terminali
  private stripAnsi(text: string): string {
    return text.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
  }

  public compress(rawLog: string): CompressedLogResult {
    const clean = this.stripAnsi(rawLog);
    const lines = clean.split('\n');

    let primaryError = 'Nessun errore esplicito estratto.';
    let sourceLocation: string | undefined = undefined;
    const relevantLines: string[] = [];

    // Pattern per individuare le righe veramente importanti
    const errorPattern = /^(error|fatal|fail|exception|uncaught|\S+error:)/i;
    const fileLocPattern = /(?:\/|[A-Za-z]:\\|[.]{1,2}\/)[^:\s]+:\d+(?::\d+)?/;
    const internalNoise = /(node:internal|node_modules\/|\s+at\s+async\s+|\s+at\s+process\.)/;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Salta stack trace interni del runtime o di librerie terze
      if (internalNoise.test(trimmed)) {
        continue;
      }

      // Cattura la riga primaria di errore se non ancora trovata
      if (errorPattern.test(trimmed) && primaryError.startsWith('Nessun')) {
        primaryError = trimmed;
      }

      // Cattura il file sorgente utente
      const locMatch = trimmed.match(fileLocPattern);
      if (locMatch && !sourceLocation && !trimmed.includes('node_modules')) {
        sourceLocation = locMatch[0];
      }

      // Conserva solo righe informative
      if (
        errorPattern.test(trimmed) ||
        trimmed.includes('TS2') ||
        trimmed.includes('SyntaxError') ||
        trimmed.includes('TypeError') ||
        trimmed.includes('FAIL') ||
        (locMatch && !trimmed.includes('node_modules'))
      ) {
        relevantLines.push(trimmed);
      }
    }

    // Se il log era già compatto o il filtro ha eliminato troppo, mantieni fino a 10 righe
    const outputLines = relevantLines.length > 0 ? relevantLines : lines.slice(0, 10);
    const condensedOutput = outputLines.join('\n');

    const originalLength = rawLog.length;
    const compressedLength = condensedOutput.length;
    const compressionRatioPercent = originalLength > 0 ? Math.round(((originalLength - compressedLength) / originalLength) * 100) : 0;
    
    // Stima 1 token ogni ~4 caratteri
    const tokensSavedEstimate = Math.max(0, Math.round((originalLength - compressedLength) / 4));

    return {
      originalLength,
      compressedLength,
      compressionRatioPercent: Math.max(0, compressionRatioPercent),
      tokensSavedEstimate,
      primaryError,
      sourceLocation,
      condensedOutput
    };
  }
}
