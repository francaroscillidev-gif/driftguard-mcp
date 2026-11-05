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

const workspaceRoot = process.cwd();
const snapshotManager = new SnapshotManager(workspaceRoot);
const runtimeDoctor = new RuntimeDoctor();
const recipeExtractor = new RecipeExtractor(workspaceRoot);

const server = new Server(
  {
    name: 'driftguard-mcp',
    version: '1.0.0'
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

// Definizione dei Tools esposti all'agente AI
const TOOLS: Tool[] = [
  {
    name: 'driftguard_create_snapshot',
    description:
      'Crea un checkpoint (snapshot) leggero dello stato del workspace prima di eseguire modifiche rischiose a file o configurazioni.',
    inputSchema: {
      type: 'object',
      properties: {
        label: {
          type: 'string',
          description: 'Descrizione opzionale dello scopo dello snapshot (es. "prima di migrazione DB" o "prima di refactoring auth")'
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
      'Esegue un rollback immediato (Undo) ripristinando il workspace allo snapshot precedente: elimina i file creati dopo lo snapshot e ripristina quelli modificati o cancellati.',
    inputSchema: {
      type: 'object',
      properties: {
        snapshotId: {
          type: 'string',
          description: 'ID dello snapshot da ripristinare. Se omesso, viene utilizzato il più recente.'
        }
      }
    }
  },
  {
    name: 'driftguard_diagnose_failure',
    description:
      'Analizza un messaggio di errore o output di log per diagnosticare problemi di sistema (porte bloccate da processi zombie, permessi, comandi mancanti) e suggerire la soluzione immediata.',
    inputSchema: {
      type: 'object',
      properties: {
        errorOutput: {
          type: 'string',
          description: 'Il testo del messaggio di errore o dello stack trace ricevuto durante l\'esecuzione del comando.'
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
          description: 'Porta TCP specifica da ispezionare (es. 3000, 8080). Se omessa, elenca tutte le porte in ascolto.'
        }
      }
    }
  },
  {
    name: 'driftguard_kill_process',
    description: 'Termina un processo di sistema identificato dal suo PID (es. per liberare una porta bloccata).',
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
          description: 'Durata dell\'esecuzione in millisecondi (opzionale).'
        }
      },
      required: ['command', 'exitCode']
    }
  },
  {
    name: 'driftguard_get_recipe',
    description:
      'Genera il Reproducibility Blueprint: un estratto pulito e ordinato dei soli comandi riusciti ed essenziali per riprodurre lo stato dell\'ambiente.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  }
];

// Handler Lista Tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Handler Esecuzione Tools
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'driftguard_create_snapshot': {
        const label = (args?.label as string) || 'manual-checkpoint';
        const snap = snapshotManager.createSnapshot(label);
        return {
          content: [
            {
              type: 'text',
              text: `✅ Checkpoint creato con successo!\n- ID: ${snap.id}\n- Etichetta: ${snap.label}\n- File tracciati: ${Object.keys(snap.files).length}\n- Timestamp: ${snap.timestamp}`
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

// Avvio Server MCP su Stdio
async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

run().catch((err) => {
  process.stderr.write(`DriftGuard MCP Server fatal error: ${err.message}\n`);
  process.exit(1);
});
