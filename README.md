<div align="center">

<img src="./assets/logo.svg" alt="Agent-Blackbox Logo" width="140" height="140" style="margin-bottom: 12px;" />

# 🛡️ Agent-Blackbox MCP (v2.0 Titanium)
### The Enterprise AI Agent Flight Recorder, Policy Engine & Autonomous Resilience Suite

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B%20%7C%2020%2B%20%7C%2022%2B-brightgreen)](https://nodejs.org/)
[![Model Context Protocol](https://img.shields.io/badge/MCP-1.6.1-orange)](https://modelcontextprotocol.io/)
[![npm version](https://img.shields.io/badge/npm-v2.0.0-cb3837.svg)](https://www.npmjs.com/package/agent-blackbox-mcp)

*The premier enterprise standard for autonomous coding agents (Claude Desktop, Cursor, Antigravity, Windsurf): policy-as-code enforcement, predictive dry-run simulation, selective precision rollbacks, and OpenTelemetry / Prometheus metrics.*

**Lead Architect & Maintainer**: Franca Roscilli ([@francaroscillidev-gif](https://github.com/francaroscillidev-gif))

</div>

---

## 🚀 What's New in v2.0 Titanium

- 🧪 **Predictive Dry-Run Simulation (`driftguard_dry_run_command`)**: Evaluates potential shell impacts (predicting `fs.unlink`, `mkdir`, and affected file paths) before real execution.
- 🎯 **Selective Precision Rollback (`driftguard_selective_rollback`)**: Surgically restores only specific damaged files from snapshots while preserving good modifications.
- 🚦 **Real-Time Policy Engine (`driftguard_policy_check`)**: Enforces organization-wide rules via `driftguard.policy.json`, protecting sensitive directories (`.env`, `credentials/`, `production/`) and restricting unauthorized commands.
- 📈 **OpenTelemetry & Prometheus Metrics Endpoint (`/metrics`)**: Standardized observability metrics exposed directly by the internal HTTP dashboard for Datadog, Prometheus, and Grafana.
- 🦺 **Transactional Auto-Healing (`driftguard_auto_heal`)**: One-step resolution for zombie TCP ports and environment bottlenecks.
- 🧹 **Workspace Bloat Cleaner (`driftguard_clean_bloat`)**: Automatically prunes cache directories and rogue debug logs.
- 🛡️ **Dependency Vulnerability Auditor (`driftguard_audit_dependencies`)**: Scans package manifests for compromised and deprecated dependencies.
- 💉 **Prompt Injection Shield (`driftguard_prompt_shield`)**: Neutralizes indirect prompt injections, DAN jailbreaks, and credential theft vectors.
- 🩺 **Workspace Health Score Index (`driftguard_health_score`)**: Real-time 0-100 diagnostic index.

---

## 🛠️ Complete MCP Toolset (24 Tools)

| Tool Name | Parameters | Description |
| :--- | :--- | :--- |
| `driftguard_dry_run_command` | `command: string` | Predicts affected paths and system calls before execution. |
| `driftguard_selective_rollback` | `targetFiles: string[], snapshotId?: string` | Surgically restores only specified files, preserving good progress. |
| `driftguard_policy_check` | `actionDescription: string, targetPath?: string` | Enforces Policy-as-Code from `driftguard.policy.json`. |
| `driftguard_auto_heal` | `errorLog: string` | One-step autonomous resolution: terminates blocking zombies and applies fixes. |
| `driftguard_clean_bloat` | `dryRun?: boolean` | Prunes cache folders (.pytest_cache, .cache, .tmp) and orphan logs. |
| `driftguard_audit_dependencies` | _none_ | Audits dependencies for known compromised packages and deprecations. |
| `driftguard_health_score` | _none_ | Instant 0-100 health diagnostic covering secrets, ports, budgets, and snapshots. |
| `driftguard_prompt_shield` | `text: string` | Detects prompt injection, jailbreaks, and credential theft vectors. |
| `driftguard_budget_status` | _none_ | Tracks session token usage, estimated USD costs, and threshold alerts. |
| `driftguard_network_check` | `command: string` | Blocks malicious piped shell scripts (`\| bash`), raw IPs, and unverified domains. |
| `driftguard_export_audit_report` | _none_ | Generates a signed compliance report with integrity hash for clients/security. |
| `driftguard_circuit_breaker_check` | `command: string, exitCode: number` | Trips when consecutive errors exceed threshold; halts runaway loops. |
| `driftguard_compress_log` | `rawLog: string` | Compresses noisy build/test logs, saving 85-90% token context. |
| `driftguard_scan_secrets` | `textOnly?: string` | Scans workspace/text for hardcoded API keys & database credentials. |
| `driftguard_remediate_secret` | `finding: object` | Automatically extracts a raw secret into `.env` and replaces it with `process.env`. |
| `driftguard_git_shadow_checkpoint` | `label?: string` | Creates a zero-interruption shadow Git checkpoint. |
| `driftguard_safety_check` | `command: string` | Evaluates command risk before running; blocks destructive shell commands. |
| `driftguard_preview_rollback` | `snapshotId?: string` | Displays line-by-line diff of pending changes before undoing. |
| `driftguard_create_snapshot` | `label?: string` | Creates a workspace checkpoint before risky edits. |
| `driftguard_list_snapshots` | _none_ | Lists all recorded checkpoints with timestamps and file counts. |
| `driftguard_rollback` | `snapshotId?: string` | Restores workspace to a checkpoint (defaults to latest). |
| `driftguard_diagnose_failure` | `errorOutput: string` | Parses error output, finds root causes (ports, OOM, missing packages, env vars). |
| `driftguard_inspect_ports` | `port?: number` | Inspects open TCP listeners, showing PID, command, and owner. |
| `driftguard_kill_process` | `pid: number, force?: boolean` | Gracefully or forcefully terminates stuck processes. |

---

## 🚀 Instant Usage (via `npx`)

Run directly with `npx`:

#### 🟣 Claude Desktop
Add to `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "agent-blackbox": {
      "command": "npx",
      "args": ["-y", "agent-blackbox-mcp@2.0.0"]
    }
  }
}
```

#### ⚡ Cursor / Antigravity / Windsurf
Add via the MCP settings tab:
* **Command**: `npx`
* **Args**: `-y agent-blackbox-mcp@2.0.0`

#### 📊 Web Dashboard & Prometheus Metrics
Run the dashboard alongside the server:
```bash
npx -y agent-blackbox-mcp --ui
```
* Dashboard UI: [http://localhost:4200](http://localhost:4200)
* Prometheus Scrape Target: [http://localhost:4200/metrics](http://localhost:4200/metrics)

---

## 🧪 Testing

Run the automated test suite:
```bash
npm test
```

---

## 📬 Contact, Support & Commercial Inquiries

- **Lead Developer & Maintainer**: Franca Roscilli
- **Email**: [francaroscillidev@gmail.com](mailto:francaroscillidev@gmail.com)
- **GitHub**: [@francaroscillidev-gif](https://github.com/francaroscillidev-gif)
- **Bug Reports & Feature Requests**: [Open an issue on GitHub](https://github.com/francaroscillidev-gif/driftguard-mcp/issues)

---

## 📄 License
Released under the [Apache 2.0 License](LICENSE).  
Copyright 2026 Franca Roscilli (francaroscillidev@gmail.com).
