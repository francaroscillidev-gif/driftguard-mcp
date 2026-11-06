#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool
} from '@modelcontextprotocol/sdk/types.js';
import { SnapshotManager } from './modules/snapshot.js';
import { RuntimeDoctor } from './modules/doctor.js';
import { RecipeExtractor } from './modules/recipe.js';
import { SafetyGuardrail } from './modules/safety.js';
import { DashboardServer } from './modules/dashboard.js';
import { SecretScanner, SecretFinding } from './modules/secrets.js';
import { GitShadowManager } from './modules/gitShadow.js';
import { CircuitBreakerManager } from './modules/circuitBreaker.js';
import { LogCompressor } from './modules/logCompressor.js';
import { TelemetryBudgetManager } from './modules/telemetry.js';
import { NetworkEgressGuard } from './modules/networkGuard.js';
import { AuditTrailExporter } from './modules/auditReport.js';
import { PromptShieldGuard } from './modules/promptShield.js';
import { HealthScoreEngine } from './modules/healthScore.js';
import { WorkspaceBloatCleaner } from './modules/cleaner.js';
import { DependencyAuditor } from './modules/depAuditor.js';
import { AutoHealPipeline } from './modules/autoHeal.js';

const workspaceRoot = process.cwd();
const snapshotManager = new SnapshotManager(workspaceRoot);
const runtimeDoctor = new RuntimeDoctor();
const recipeExtractor = new RecipeExtractor(workspaceRoot);
const safetyGuardrail = new SafetyGuardrail();
const secretScanner = new SecretScanner();
const gitShadowManager = new GitShadowManager(workspaceRoot);
const circuitBreaker = new CircuitBreakerManager(3);
const logCompressor = new LogCompressor();
const telemetryManager = new TelemetryBudgetManager({ maxTokens: 250000, maxCostUSD: 1.0 });
const networkGuard = new NetworkEgressGuard();
const auditExporter = new AuditTrailExporter();
const promptShield = new PromptShieldGuard();
const healthEngine = new HealthScoreEngine();
const bloatCleaner = new WorkspaceBloatCleaner();
const depAuditor = new DependencyAuditor();
const autoHealer = new AutoHealPipeline(runtimeDoctor);

if (process.argv.includes('--ui')) {
  const dashboard = new DashboardServer(workspaceRoot, 4200);
  dashboard.start().then((url) => {
    process.stderr.write(`[Agent-Blackbox] Dashboard web attiva su: ${url}\n`);
  });
}

const server = new Server(
  {
    name: 'agent-blackbox-mcp',
    version: '1.6.0'
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

const TOOLS: Tool[] = [
  {
    name: 'driftguard_auto_heal',
    description:
      'Auto-riparazione transazionale in un unico passaggio: diagnostica l\'errore, killa i processi zombie e ripristina la disponibilità delle risorse.',
    inputSchema: {
      type: 'object',
      properties: {
        errorLog: {
          type: 'string',
          description: 'L\'errore o lo stack trace ricevuto.'
        }
      },
      required: ['errorLog']
    }
  },
  {
    name: 'driftguard_clean_bloat',
    description:
      'Spazzino intelligente del workspace: rimuove in sicurezza file temporanei, directory di cache (.pytest_cache, .cache, .tmp) e file di log orfani.',
    inputSchema: {
      type: 'object',
      properties: {
        dryRun: {
          type: 'boolean',
          description: 'Se true, mostra solo cosa verrebbe eliminato senza cancellare nulla.'
        }
      }
    }
  },
  {
    name: 'driftguard_audit_dependencies',
    description:
      'Ispettore di sicurezza delle dipendenze: scansiona package.json per rilevare pacchetti compromessi noti, malware supply-chain o librerie deprecate.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'driftguard_health_score',
    description:
      'Calcola lo Score di Salute complessivo (0-100) del workspace: verifica segreti esposti, processi zombie, budget token e checkpoint pronti.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'driftguard_prompt_shield',
    description:
      'Scansiona testi, file o issue esterne per rilevare e bloccare attacchi di Prompt Injection, tentativi di jailbreak o furto di credenziali.',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Il testo da esaminare prima di elaborarlo.'
        }
      },
      required: ['text']
    }
  },
  {
    name: 'driftguard_budget_status',
    description:
      'Monitora la telemetria di spesa e token consumati della sessione corrente, avvisando prima di superare il budget limite.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'driftguard_network_check',
    description:
      'Ispeziona comandi shell con chiamate di rete (curl, wget, npm, pip) per bloccare script malevoli piped (| bash), IP grezzi o domini non verificati.',
    inputSchema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'Il comando shell contenente URL o chiamate di rete.'
        }
      },
      required: ['command']
    }
  },
  {
    name: 'driftguard_export_audit_report',
    description:
      'Genera e firma digitalmente un Report di Conformità & Audit Trail completo (zero-secrets, checkpoint, modifiche effettuate e telemetria token).',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'driftguard_circuit_breaker_check',
    description:
      'Registra l\'esito di un comando ed evita loop infiniti di allucinazione, bloccando l\'agente se ripete lo stesso errore per 3 volte consecutive.',
    inputSchema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'Il comando appena eseguito.'
        },
        exitCode: {
          type: 'number',
          description: 'L\'exit code del comando (0 per successo, != 0 per errore).'
        },
        errorSnippet: {
          type: 'string',
          description: 'Snippet opzionale del messaggio di errore.'
        }
      },
      required: ['command', 'exitCode']
    }
  },
  {
    name: 'driftguard_compress_log',
    description:
      'Comprime log di compilazione prolissi e stack trace (rimuovendo ANSI colors, boilerplate di node_modules e rumore interno), risparmiando fino all\'85-90% di token di contesto.',
    inputSchema: {
      type: 'object',
      properties: {
        rawLog: {
          type: 'string',
          description: 'L\'intero output del comando terminale da comprimere.'
        }
      },
      required: ['rawLog']
    }
  },
  {
    name: 'driftguard_scan_secrets',
    description:
      'Scansiona il workspace o un testo per rilevare chiavi API hardcoded (OpenAI, Anthropic, Google, AWS, Stripe, GitHub, DB URI) per prevenire leak accidentali.',
    inputSchema: {
      type: 'object',
      properties: {
        textOnly: {
          type: 'string',
          description: 'Testo facoltativo da ispezionare invece di scansionare l\'intero workspace.'
        }
      }
    }
  },
  {
    name: 'driftguard_remediate_secret',
    description:
      'Sposta un segreto trovato in chiaro nel file .env locale, assicurando l\'inserimento di .env in .gitignore e sostituendo il valore con process.env.<VAR>.',
    inputSchema: {
      type: 'object',
      properties: {
        finding: {
          type: 'object',
          description: 'L\'oggetto finding restituito da driftguard_scan_secrets.'
        }
      },
      required: ['finding']
    }
  },
  {
    name: 'driftguard_git_shadow_checkpoint',
    description:
      'Crea un checkpoint ombra nativo Git (senza spostare l\'HEAD dell\'utente né sporcare i branch di lavoro attivi).',
    inputSchema: {
      type: 'object',
      properties: {
        label: {
          type: 'string',
          description: 'Etichetta descrittiva del checkpoint ombra.'
        }
      }
    }
  },
  {
    name: 'driftguard_safety_check',
    description:
      'Valuta preventivamente il rischio di un comando shell prima di eseguirlo, bloccando comandi distruttivi (rm -rf /, drop database, esposizione chiavi, fork bomb).',
    inputSchema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'Il comando shell che l\'agente intende eseguire.'
        }
      },
      required: ['command']
    }
  },
  {
    name: 'driftguard_preview_rollback',
    description:
      'Mostra un diff dettagliato riga per riga di ciò che cambierà, verrà ripristinato o cancellato PRIMA di eseguire il rollback effettivo.',
    inputSchema: {
      type: 'object',
      properties: {
        snapshotId: {
          type: 'string',
          description: 'ID dello snapshot da confrontare. Se omesso, usa il più recente.'
        }
      }
    }
  },
  {
    name: 'driftguard_create_snapshot',
    description:
      'Crea un checkpoint (snapshot) leggero dello stato del workspace prima di eseguire modifiche rischiose a file o configurazioni.',
    inputSchema: {
      type: 'object',
      properties: {
        label: {
          type: 'string',
          description: 'Descrizione opzionale dello scopo dello snapshot.'
        }
      }
    }
  },
  {
    name: 'driftguard_list_snapshots',
    description: 'Elenca tutti i checkpoint/snapshot creati nella sessione corrente.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'driftguard_rollback',
    description:
      'Esegue un rollback immediato (Undo) ripristinando il workspace allo snapshot precedente.',
    inputSchema: {
      type: 'object',
      properties: {
        snapshotId: {
          type: 'string',
          description: 'ID dello snapshot da ripristinare. Se omesso, usa il più recente.'
        }
      }
    }
  },
  {
    name: 'driftguard_diagnose_failure',
    description:
      'Analizza errori e stack trace per diagnosticare problemi di sistema (porte bloccate, OOM heap overflow, pacchetti Node/Python mancanti, env vars mancanti) con relativa soluzione prescrittiva.',
    inputSchema: {
      type: 'object',
      properties: {
        errorOutput: {
          type: 'string',
          description: 'Il testo del messaggio di errore o dello stack trace.'
        }
      },
      required: ['errorOutput']
    }
  },
  {
    name: 'driftguard_inspect_ports',
    description:
      'Mostra i processi attivi in ascolto su una porta specifica o su tutte le porte TCP locali.',
    inputSchema: {
      type: 'object',
      properties: {
        port: {
          type: 'number',
          description: 'Porta TCP specifica da ispezionare.'
        }
      }
    }
  },
  {
    name: 'driftguard_kill_process',
    description: 'Termina un processo di sistema identificato dal suo PID.',
    inputSchema: {
      type: 'object',
      properties: {
        pid: {
          type: 'number',
          description: 'Il PID del processo da terminare.'
        },
        force: {
          type: 'boolean',
          description: 'Se true, invia SIGKILL (-9); se false o omesso, invia SIGTERM.'
        }
      },
      required: ['pid']
    }
  },
  {
    name: 'driftguard_get_recipe',
    description:
      'Genera il Reproducibility Blueprint: un estratto pulito dei soli comandi riusciti ed essenziali.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  }
];

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'driftguard_auto_heal': {
        const errorLog = (args?.errorLog as string) || '';
        const healRes = autoHealer.healError(errorLog);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(healRes, null, 2)
            }
          ]
        };
      }

      case 'driftguard_clean_bloat': {
        const dryRun = Boolean(args?.dryRun);
        const result = bloatCleaner.clean(workspaceRoot, dryRun);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }

      case 'driftguard_audit_dependencies': {
        const audit = depAuditor.audit(workspaceRoot);
        return {
          content: [
            {
              type: 'text',
              text: audit.markdownSummary
            }
          ]
        };
      }

      case 'driftguard_health_score': {
        const result = healthEngine.calculateHealth(workspaceRoot, snapshotManager, secretScanner, runtimeDoctor, telemetryManager);
        return {
          content: [
            {
              type: 'text',
              text: result.markdownSummary
            }
          ]
        };
      }

      case 'driftguard_prompt_shield': {
        const text = (args?.text as string) || '';
        const assessment = promptShield.inspectContent(text);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(assessment, null, 2)
            }
          ]
        };
      }

      case 'driftguard_budget_status': {
        const status = telemetryManager.getStatus();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(status, null, 2)
            }
          ]
        };
      }

      case 'driftguard_network_check': {
        const cmd = (args?.command as string) || '';
        const assessment = networkGuard.evaluateNetworkCommand(cmd);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(assessment, null, 2)
            }
          ]
        };
      }

      case 'driftguard_export_audit_report': {
        const report = auditExporter.generateReport(workspaceRoot, snapshotManager, secretScanner, telemetryManager);
        return {
          content: [
            {
              type: 'text',
              text: report.markdownContent
            }
          ]
        };
      }

      case 'driftguard_circuit_breaker_check': {
        const cmd = args?.command as string;
        const code = args?.exitCode as number;
        const err = args?.errorSnippet as string | undefined;
        const status = circuitBreaker.recordAttempt(cmd, code, err);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(status, null, 2)
            }
          ]
        };
      }

      case 'driftguard_compress_log': {
        const raw = (args?.rawLog as string) || '';
        const compressed = logCompressor.compress(raw);
        telemetryManager.trackUsage(raw, compressed.tokensSavedEstimate);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(compressed, null, 2)
            }
          ]
        };
      }

      case 'driftguard_scan_secrets': {
        const textOnly = args?.textOnly as string | undefined;
        const findings = textOnly ? secretScanner.scanText(textOnly) : secretScanner.scanWorkspace(workspaceRoot);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(findings, null, 2)
            }
          ]
        };
      }

      case 'driftguard_remediate_secret': {
        const finding = args?.finding as SecretFinding;
        const res = secretScanner.remediate(workspaceRoot, finding);
        return {
          content: [
            {
              type: 'text',
              text: res.message
            }
          ]
        };
      }

      case 'driftguard_git_shadow_checkpoint': {
        const label = (args?.label as string) || 'shadow-save';
        const res = gitShadowManager.createShadowCheckpoint(label);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(res, null, 2)
            }
          ]
        };
      }

      case 'driftguard_safety_check': {
        const cmd = (args?.command as string) || '';
        const assessment = safetyGuardrail.evaluateCommand(cmd);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(assessment, null, 2)
            }
          ]
        };
      }

      case 'driftguard_preview_rollback': {
        const snapId = args?.snapshotId as string | undefined;
        const preview = snapshotManager.previewRollback(snapId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(preview, null, 2)
            }
          ]
        };
      }

      case 'driftguard_create_snapshot': {
        const label = (args?.label as string) || 'manual-checkpoint';
        const snap = snapshotManager.createSnapshot(label);
        return {
          content: [
            {
              type: 'text',
              text: `✅ Checkpoint creato!\n- ID: ${snap.id}\n- Etichetta: ${snap.label}\n- File tracciati: ${Object.keys(snap.files).length}\n- Timestamp: ${snap.timestamp}`
            }
          ]
        };
      }

      case 'driftguard_list_snapshots': {
        const list = snapshotManager.listSnapshots();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(list, null, 2)
            }
          ]
        };
      }

      case 'driftguard_rollback': {
        const snapId = args?.snapshotId as string | undefined;
        const result = snapshotManager.rollback(snapId);
        return {
          content: [
            {
              type: 'text',
              text: `🔄 Rollback completato allo snapshot [${result.snapshotId}]!\n- File ripristinati: ${result.restored.length} (${result.restored.join(', ') || 'nessuno'})\n- Nuovi file eliminati: ${result.deleted.length} (${result.deleted.join(', ') || 'nessuno'})`
            }
          ]
        };
      }

      case 'driftguard_diagnose_failure': {
        const errorOutput = (args?.errorOutput as string) || '';
        const diagnosis = runtimeDoctor.diagnoseError(errorOutput);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(diagnosis, null, 2)
            }
          ]
        };
      }

      case 'driftguard_inspect_ports': {
        const port = args?.port as number | undefined;
        const procs = runtimeDoctor.inspectPort(port);
        return {
          content: [
            {
              type: 'text',
              text: procs.length > 0 ? JSON.stringify(procs, null, 2) : `Nessun processo in ascolto rilevato${port ? ` sulla porta ${port}` : ''}.`
            }
          ]
        };
      }

      case 'driftguard_kill_process': {
        const pid = args?.pid as number;
        const force = Boolean(args?.force);
        const res = runtimeDoctor.killProcess(pid, force);
        return {
          content: [
            {
              type: 'text',
              text: res.message
            }
          ]
        };
      }

      case 'driftguard_get_recipe': {
        const recipe = recipeExtractor.generateRecipe();
        return {
          content: [
            {
              type: 'text',
              text: recipe.markdownRecipe
            }
          ]
        };
      }

      default:
        throw new Error(`Tool sconosciuto: ${name}`);
    }
  } catch (error: any) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `Errore nell'esecuzione del tool ${name}: ${error.message}`
        }
      ]
    };
  }
});

async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

run().catch((err) => {
  process.stderr.write(`Agent-Blackbox fatal error: ${err.message}\n`);
  process.exit(1);
});
