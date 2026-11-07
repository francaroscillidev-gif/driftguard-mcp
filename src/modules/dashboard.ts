import http from 'node:http';
import { SnapshotManager } from './snapshot.js';
import { RuntimeDoctor } from './doctor.js';

export class DashboardServer {
  private port: number;
  private server: http.Server | null = null;
  private snapshotManager: SnapshotManager;
  private runtimeDoctor: RuntimeDoctor;

  constructor(workspacePath: string, port: number = 4200) {
    this.port = port;
    this.snapshotManager = new SnapshotManager(workspacePath);
    this.runtimeDoctor = new RuntimeDoctor();
  }

  public start(): Promise<string> {
    return new Promise((resolve) => {
      this.server = http.createServer((req, res) => {
        const url = new URL(req.url || '/', `http://localhost:${this.port}`);

        // Metrics Endpoint (Prometheus / OpenTelemetry compatible)
        if (url.pathname === '/metrics') {
          const snapshots = this.snapshotManager.listSnapshots();
          const ports = this.runtimeDoctor.inspectPort();
          const metrics = [
            '# HELP driftguard_snapshots_total Total number of workspace checkpoints created',
            '# TYPE driftguard_snapshots_total counter',
            `driftguard_snapshots_total ${snapshots.length}`,
            '# HELP driftguard_active_ports_count Number of TCP ports currently in listening state',
            '# TYPE driftguard_active_ports_count gauge',
            `driftguard_active_ports_count ${ports.length}`,
            '# HELP driftguard_agent_server_status Status of the Agent-Blackbox MCP core (1 = operational)',
            '# TYPE driftguard_agent_server_status gauge',
            'driftguard_agent_server_status 1'
          ].join('\n');

          res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8' });
          return res.end(metrics);
        }

        // API Endpoints
        if (url.pathname === '/api/snapshots') {
          const list = this.snapshotManager.listSnapshots();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify(list));
        }

        if (url.pathname === '/api/ports') {
          const ports = this.runtimeDoctor.inspectPort();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify(ports));
        }

        if (url.pathname === '/api/rollback' && req.method === 'POST') {
          let body = '';
          req.on('data', (c) => (body += c));
          req.on('end', () => {
            try {
              const data = body ? JSON.parse(body) : {};
              const result = this.snapshotManager.rollback(data.snapshotId);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              return res.end(JSON.stringify(result));
            } catch (err: any) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              return res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        if (url.pathname === '/api/kill' && req.method === 'POST') {
          let body = '';
          req.on('data', (c) => (body += c));
          req.on('end', () => {
            try {
              const { pid } = JSON.parse(body);
              const result = this.runtimeDoctor.killProcess(pid, true);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              return res.end(JSON.stringify(result));
            } catch (err: any) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              return res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        // Web Dashboard UI
        const html = `
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <title>Agent-Blackbox Dashboard</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    :root {
      --bg: #090d16;
      --card-bg: rgba(22, 27, 46, 0.7);
      --border: #232b47;
      --accent: #6366f1;
      --accent-hover: #4f46e5;
      --danger: #ef4444;
      --text: #f8fafc;
      --muted: #94a3b8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background: var(--bg); color: var(--text); padding: 2rem; min-height: 100vh; }
    .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 2rem; border-bottom: 1px solid var(--border); padding-bottom: 1.5rem; }
    .brand { font-size: 1.5rem; font-weight: 700; display: flex; align-items: center; gap: 0.75rem; }
    .badge { background: #1e1b4b; color: #a5b4fc; font-size: 0.75rem; padding: 0.25rem 0.5rem; border-radius: 9999px; border: 1px solid #3730a3; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
    .card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 1.5rem; backdrop-filter: blur(10px); }
    .card h2 { font-size: 1.15rem; margin-bottom: 1rem; color: #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
    .item-list { display: flex; flex-direction: column; gap: 0.75rem; max-height: 400px; overflow-y: auto; }
    .item { background: #0f172a; border: 1px solid #1e293b; padding: 0.85rem; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; }
    .btn { background: var(--accent); color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-weight: 600; transition: background 0.15s; }
    .btn:hover { background: var(--accent-hover); }
    .btn-danger { background: var(--danger); }
    .btn-danger:hover { background: #dc2626; }
    .muted { color: var(--muted); font-size: 0.85rem; }
    #toast { position: fixed; bottom: 2rem; right: 2rem; background: #10b981; color: white; padding: 0.75rem 1.25rem; border-radius: 8px; font-weight: 600; display: none; }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">
      📦 Agent-Blackbox MCP <span class="badge">v1.1.0 Live Doctor</span>
    </div>
    <div class="muted">Live Flight Recorder Dashboard</div>
  </div>

  <div class="grid">
    <div class="card">
      <h2>
        <span>📸 Workspace Snapshots</span>
        <button class="btn" onclick="fetchSnapshots()">Aggiorna</button>
      </h2>
      <div id="snapshots" class="item-list">Caricamento...</div>
    </div>

    <div class="card">
      <h2>
        <span>🩺 Processi & Porte Attive</span>
        <button class="btn" onclick="fetchPorts()">Aggiorna</button>
      </h2>
      <div id="ports" class="item-list">Caricamento...</div>
    </div>
  </div>

  <div id="toast"></div>

  <script>
    function showToast(msg) {
      const t = document.getElementById('toast');
      t.innerText = msg;
      t.style.display = 'block';
      setTimeout(() => t.style.display = 'none', 3000);
    }

    async function fetchSnapshots() {
      const res = await fetch('/api/snapshots');
      const data = await res.json();
      const c = document.getElementById('snapshots');
      if (data.length === 0) {
        c.innerHTML = '<div class="muted">Nessun checkpoint registrato.</div>';
        return;
      }
      c.innerHTML = data.map(s => \`
        <div class="item">
          <div>
            <strong>\${s.label}</strong>
            <div class="muted">\${s.id} • \${s.fileCount} file • \${new Date(s.timestamp).toLocaleTimeString()}</div>
          </div>
          <button class="btn" onclick="rollback('\${s.id}')">Ripristina</button>
        </div>
      \`).join('');
    }

    async function fetchPorts() {
      const res = await fetch('/api/ports');
      const data = await res.json();
      const c = document.getElementById('ports');
      if (data.length === 0) {
        c.innerHTML = '<div class="muted">Nessuna porta TCP in ascolto rilevata.</div>';
        return;
      }
      c.innerHTML = data.map(p => \`
        <div class="item">
          <div>
            <strong>Porta :\${p.port}</strong> (\${p.command})
            <div class="muted">PID: \${p.pid} • Utente: \${p.user}</div>
          </div>
          <button class="btn btn-danger" onclick="killProc(\${p.pid})">Termina</button>
        </div>
      \`).join('');
    }

    async function rollback(id) {
      if (!confirm('Confermi il ripristino di questo snapshot?')) return;
      const res = await fetch('/api/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshotId: id })
      });
      const data = await res.json();
      showToast('Rollback completato!');
      fetchSnapshots();
    }

    async function killProc(pid) {
      if (!confirm('Vuoi terminare forzatamente il processo PID ' + pid + '?')) return;
      await fetch('/api/kill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pid })
      });
      showToast('Processo terminato!');
      fetchPorts();
    }

    fetchSnapshots();
    fetchPorts();
  </script>
</body>
</html>
        `;

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
      });

      this.server.listen(this.port, () => {
        resolve(`http://localhost:${this.port}`);
      });
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }
}
