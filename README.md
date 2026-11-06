<div align="center">

# 📦 Agent-Blackbox MCP
### The Autonomous Flight Recorder, Self-Healing, Bloat Cleaner & Governance Suite for AI Agents

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B%20%7C%2020%2B%20%7C%2022%2B-brightgreen)](https://nodejs.org/)
[![Model Context Protocol](https://img.shields.io/badge/MCP-1.6.1-orange)](https://modelcontextprotocol.io/)
[![npm version](https://img.shields.io/badge/npm-v1.6.0-cb3837.svg)](https://www.npmjs.com/package/agent-blackbox-mcp)

*The definitive enterprise resilience suite for Claude, Cursor, Antigravity, and Windsurf: autonomous self-healing, bloat pruning, prompt injection defense, instant rollback, and dependency auditing.*

**Author**: Franca Roscilli ([@francaroscillidev-gif](https://github.com/francaroscillidev-gif))

</div>

---

## ✨ Features (v1.6.0 Autonomous Resilience)

- 🦺 **Transactional Auto-Healing (`driftguard_auto_heal`)**: Diagnoses runtime failures, eliminates blocking zombie processes, and restores environment health in a single step.
- 🧹 **Workspace Bloat Cleaner (`driftguard_clean_bloat`)**: Automatically cleans `.cache`, `.pytest_cache`, `.DS_Store`, and rogue log files, reclaiming disk space and accelerating snapshot times.
- 🛡️ **Dependency Vulnerability Auditor (`driftguard_audit_dependencies`)**: Scans package manifests for compromised dependencies, malicious supply-chain packages, and deprecated libraries.
- 💉 **Prompt Injection & Jailbreak Shield (`driftguard_prompt_shield`)**: Scans external prompts, files, and issues to block indirect prompt injection, DAN jailbreaks, instruction overrides, and credential theft.
- 🩺 **Workspace Health Score Index (`driftguard_health_score`)**: Computes an instant 0-100 diagnostic index assessing exposed secrets, zombie processes, token budgets, and snapshot coverage.
- 📊 **Token & Cost Budget Controller (`driftguard_budget_status`)**: Real-time telemetry tracking estimated token spend and session costs with customizable alert caps.
- 🌐 **Network Egress & Pipe Blocker (`driftguard_network_check`)**: Detects remote code execution patterns (`curl ... | bash`), reverse shells, and raw IP queries, enforcing an enterprise domain whitelist.
- 📑 **Cryptographic Audit Trail Exporter (`driftguard_export_audit_report`)**: Generates and SHA-256 signs a formal Markdown compliance report verifying actions, modified files, zero leaked secrets, and cost savings.
- 🛑 **Anti-Loop Circuit Breaker (`driftguard_circuit_breaker_check`)**: Detects repeated failures and trips an emergency stop after 3 consecutive identical crashes.
- 🗜️ **Semantic Log & Stack Trace Compressor (`driftguard_compress_log`)**: Strips ANSI colors, `node_modules` clutter, and internal runtime callstacks, **saving up to 85-90% of token context**.
- 🔐 **Secret Leak Blocker (`driftguard_scan_secrets`)**: Deep scans for hardcoded API keys across 7+ providers with automated extraction to `.env`.
- 🔀 **Git Shadow Checkpoints (`driftguard_git_shadow_checkpoint`)**: Creates isolated, non-intrusive Git shadow refs (`refs/driftguard/shadow-*`) without altering user branch HEAD or unstaged changes.
- 🛡️ **Proactive Safety Guardrail (`driftguard_safety_check`)**: Intercepts dangerous commands (`rm -rf /`, `DROP DATABASE`, fork bombs, raw disk writes) before execution.
- 🔍 **Visual Diff Preview (`driftguard_preview_rollback`)**: Inspect line-by-line diffs (`+` and `-`) before confirming a rollback.
- 🩺 **Self-Healing Runtime Doctor**: Diagnoses Node/Python missing packages (`Cannot find module`, `ModuleNotFoundError`), Out of Memory (`OOM / max-old-space-size`), and undefined environment variables.
- 📊 **Built-in Web Dashboard (`--ui`)**: Zero-dependency local web dashboard at `http://localhost:4200` to visualize active TCP listeners, inspect snapshots, and trigger one-click rollbacks.

---

## 🛠️ Complete MCP Toolset (21 Tools)

| Tool Name | Parameters | Description |
| :--- | :--- | :--- |
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
      "args": ["-y", "agent-blackbox-mcp@1.6.0"]
    }
  }
}
```

#### ⚡ Cursor / Antigravity / Windsurf
Add via the MCP settings tab:
* **Command**: `npx`
* **Args**: `-y agent-blackbox-mcp@1.6.0`

#### 📊 Optional Web Dashboard
Run the dashboard alongside the server:
```bash
npx -y agent-blackbox-mcp --ui
```
Then open [http://localhost:4200](http://localhost:4200) in your browser.

---

## 🧪 Testing

Run the automated test suite:
```bash
npm test
```

---

## 📬 Contact, Support & Commercial Inquiries

If you have questions, feedback, enterprise integration requests, or custom agent governance needs, feel free to reach out directly:

- **Lead Developer & Maintainer**: Franca Roscilli
- **Email**: [francaroscillidev@gmail.com](mailto:francaroscillidev@gmail.com)
- **GitHub**: [@francaroscillidev-gif](https://github.com/francaroscillidev-gif)
- **Bug Reports & Feature Requests**: [Open an issue on GitHub](https://github.com/francaroscillidev-gif/driftguard-mcp/issues)

---

## 📄 License
Released under the [Apache 2.0 License](LICENSE).  
Copyright 2026 Franca Roscilli (francaroscillidev@gmail.com).

