import { RuntimeDoctor, DiagnosticResult } from './doctor.js';

export interface AutoHealAction {
  actionTaken: string;
  success: boolean;
  details: string;
}

export class AutoHealPipeline {
  private doctor: RuntimeDoctor;

  constructor(doctor: RuntimeDoctor) {
    this.doctor = doctor;
  }

  public healError(errorLog: string): {
    diagnosedIssue: DiagnosticResult['issueType'];
    actions: AutoHealAction[];
    isResolved: boolean;
    summary: string;
  } {
    const diagnosis = this.doctor.diagnoseError(errorLog);
    const actions: AutoHealAction[] = [];

    // 1. Risoluzione automatica di porta occupata
    if (diagnosis.issueType === 'PORT_IN_USE' && diagnosis.details?.process) {
      const pid = diagnosis.details.process.pid;
      const killRes = this.doctor.killProcess(pid, true);
      actions.push({
        actionTaken: `TERMINATE_ZOMBIE_PROCESS_PID_${pid}`,
        success: killRes.success,
        details: killRes.message
      });

      return {
        diagnosedIssue: 'PORT_IN_USE',
        actions,
        isResolved: killRes.success,
        summary: `Auto-Heal: Porta ${diagnosis.details.process.port} liberata terminando il processo zombie PID ${pid}.`
      };
    }

    // 2. Risoluzione suggerita per OOM o moduli mancanti
    return {
      diagnosedIssue: diagnosis.issueType,
      actions: [
        {
          actionTaken: 'PRESCRIPTIVE_INSTRUCTION',
          success: true,
          details: diagnosis.actionableFix
        }
      ],
      isResolved: false,
      summary: `Auto-Heal: Prescrizione pronta per ${diagnosis.issueType}: ${diagnosis.actionableFix}`
    };
  }
}
