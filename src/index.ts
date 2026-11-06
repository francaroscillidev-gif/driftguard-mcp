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

const workspaceRoot = process.cwd();
const snapshotManager = new SnapshotManager(workspaceRoot);
const runtimeDoctor = new RuntimeDoctor();
const recipeExtractor = new RecipeExtractor(workspaceRoot);
const safetyGuardrail = new SafetyGuardrail();

// Se l'utente lancia con --ui, avvia anche la dashboard HTTP locale
if (process.argv.includes('--ui')) {
  const dashboard = new DashboardServer(workspaceRoot, 4200);
  dashboard.start().then((url) => {
    process.stderr.write(`[Agent-Blackbox] Dashboard web attiva su: ${url}\n`);
  });
}

const server = new Server(
  {
    name: 'agent-blackbox-mcp',
    version: '1.1.0'
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

// Strumenti esposti all'agente AI (10 tool totali)
const TOOLS: Tool[] = [
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
    name: 'driftguard_log_command',
    description: 'Registra un comando eseguito con relativo exit code per comporre la ricetta finale di riproducibilità.',
    inputSchema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'Il comando eseguito.'
        },
        exitCode: {
          type: 'number',
          description: 'Il codice di uscita (0 per successo, != 0 per errore).'
        },
        durationMs: {
          type: 'number',
          description: 'Durata in millisecondi.'
        }
      },
      required: ['command', 'exitCode']
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

      case 'driftguard_log_command': {
        const command = args?.command as string;
        const exitCode = args?.exitCode as number;
        const durationMs = (args?.durationMs as number) || 0;
        recipeExtractor.recordCommand({
          command,
          exitCode,
          timestamp: new Date().toISOString(),
          durationMs
        });
        return {
          content: [
            {
              type: 'text',
              text: `Comando registrato in cronologia.`
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
