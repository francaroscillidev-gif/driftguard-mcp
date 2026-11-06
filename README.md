<div align="center">

# 📦 Agent-Blackbox MCP
### The Flight Recorder, Safety Guardrail & Runtime Doctor for AI Coding Agents

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B%20%7C%2020%2B%20%7C%2022%2B-brightgreen)](https://nodejs.org/)
[![Model Context Protocol](https://img.shields.io/badge/MCP-1.6.1-orange)](https://modelcontextprotocol.io/)
[![npm version](https://img.shields.io/badge/npm-v1.1.0-cb3837.svg)](https://www.npmjs.com/package/agent-blackbox-mcp)

*Give your AI agents (Claude, Cursor, Antigravity, Windsurf) instant undo, pre-rollback diffs, proactive command guardrails, and self-healing diagnostics.*

</div>

---

## 💥 The Problem
When autonomous AI agents execute shell commands in real workspaces:
1. **Accidental Destruction**: The agent mutates or deletes working code, and `git` doesn't protect scratch files or uncommitted work.
2. **Destructive Commands**: The agent can run `rm -rf`, permissive `chmod 777`, or drop database tables without evaluating consequences.
3. **Zombie Processes & Port Collisions**: Background servers are left running, resulting in `EADDRINUSE: 3000` or memory crash loops (`exit code 137`).
4. **Session Amnesia**: Nobody knows the minimal commands that actually made the environment work.

**Agent-Blackbox MCP acts as a flight recorder, safety shield, and OS physician directly inside the agent's MCP toolchain.**

---

## ✨ What's New in v1.1.0

- 🛡️ **Proactive Safety Guardrail (`driftguard_safety_check`)**: Intercepts dangerous commands (`rm -rf /`, `DROP DATABASE`, fork bombs, raw disk writes, credential leaks) before execution.
- 🔍 **Visual Diff Preview (`driftguard_preview_rollback`)**: Inspect line-by-line diffs (`+` and `-`) before confirming a rollback.
- 🩺 **Expanded Runtime Doctor**: Self-heals Node/Python missing packages (`Cannot find module`, `ModuleNotFoundError`), Out of Memory (`OOM / max-old-space-size`), and undefined environment variables.
- 📊 **Built-in Web Dashboard (`--ui`)**: Zero-dependency local web dashboard at `http://localhost:4200` to visualize active TCP listeners, inspect snapshots, and trigger one-click rollbacks.

---

## 🛠️ Tools Exposed to AI Agents (10 Tools)

| Tool Name | Parameters | Description |
| :--- | :--- | :--- |
| `driftguard_safety_check` | `command: string` | Evaluates command risk before running; blocks destructive shell commands. |
| `driftguard_preview_rollback` | `snapshotId?: string` | Displays line-by-line diff of pending changes before undoing. |
| `driftguard_create_snapshot` | `label?: string` | Creates a workspace checkpoint before risky edits. |
| `driftguard_list_snapshots` | _none_ | Lists all recorded checkpoints with timestamps and file counts. |
| `driftguard_rollback` | `snapshotId?: string` | Restores workspace to a checkpoint (defaults to latest). |
| `driftguard_diagnose_failure` | `errorOutput: string` | Parses error output, finds root causes (ports, OOM, missing packages, env vars). |
| `driftguard_inspect_ports` | `port?: number` | Inspects open TCP listeners, showing PID, command, and owner. |
| `driftguard_kill_process` | `pid: number, force?: boolean` | Gracefully or forcefully terminates stuck processes. |
| `driftguard_log_command` | `command: string, exitCode: number` | Logs command outcomes for blueprint generation. |
| `driftguard_get_recipe` | _none_ | Outputs the clean markdown execution blueprint. |

---

## 🚀 Instant Usage (via `npx`)

No repository cloning needed. Run directly with `npx`:

#### 🟣 Claude Desktop
Add to `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "agent-blackbox": {
      "command": "npx",
      "args": ["-y", "agent-blackbox-mcp@1.1.0"]
    }
  }
}
```

#### ⚡ Cursor / Antigravity / Windsurf
Add via the MCP settings tab:
* **Command**: `npx`
* **Args**: `-y agent-blackbox-mcp@1.1.0`

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

## 📄 License
Released under the [MIT License](LICENSE).
