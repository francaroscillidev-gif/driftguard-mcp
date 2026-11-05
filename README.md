<div align="center">

# 🛡️ DriftGuard MCP
### The Flight Recorder & Runtime Doctor for AI Coding Agents

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B%20%7C%2020%2B%20%7C%2022%2B-brightgreen)](https://nodejs.org/)
[![Model Context Protocol](https://img.shields.io/badge/MCP-1.6.1-orange)](https://modelcontextprotocol.io/)
[![CI Status](https://img.shields.io/badge/build-passing-brightgreen)](#)

*Give your AI agents (Claude, Cursor, Antigravity, Windsurf) instant undo, self-healing diagnostics for port collisions, and session reproducibility.*

</div>

---

## 💥 The Problem
When autonomous AI agents execute shell commands in real workspaces, three frequent problems cause massive agent failure loops:
1. **Accidental Destruction**: The agent mutates or deletes working code, and `git` doesn't protect scratch files or uncommitted work.
2. **Zombie Processes & Port Collisions**: Background servers are left running. The agent gets cryptic `EADDRINUSE: 3000` or `137` errors and hallucinates broken fixes.
3. **Session Amnesia**: After 20 trial-and-error commands, nobody knows the minimal recipe that actually made the environment work.

**DriftGuard MCP acts as a flight recorder and OS physician directly inside the agent's MCP toolchain.**

---

## ✨ Features

- 📸 **Pre-Flight Snapshots**: Lightning-fast, lightweight filesystem snapshots storing SHA-256 diffs before risky agent tasks.
- 🔄 **One-Click Rollback**: Restores altered/deleted files and deletes untracked clutter in milliseconds.
- 🩺 **Runtime Doctor**: Analyzes stderr logs, diagnoses occupied ports and orphan processes, and gives the agent the exact command to fix it.
- ⚡ **Zombie Hunter**: Directly inspects TCP listeners and terminates rogue background daemons.
- 📋 **Reproducibility Blueprint**: Extracts clean, deduplicated, verified execution scripts from the agent's session log.

---

## 🛠️ Tools Exposed

| Tool Name | Parameters | Description |
| :--- | :--- | :--- |
| `driftguard_create_snapshot` | `label?: string` | Creates a workspace checkpoint before risky edits. |
| `driftguard_list_snapshots` | _none_ | Lists all recorded checkpoints with timestamps and file counts. |
| `driftguard_rollback` | `snapshotId?: string` | Restores workspace to a checkpoint (defaults to latest). |
| `driftguard_diagnose_failure` | `errorOutput: string` | Parses error output, finds root causes (ports, permissions, missing CLI). |
| `driftguard_inspect_ports` | `port?: number` | Inspects open TCP listeners, showing PID, command, and owner. |
| `driftguard_kill_process` | `pid: number, force?: boolean` | Gracefully or forcefully terminates stuck processes. |
| `driftguard_log_command` | `command: string, exitCode: number` | Logs command outcomes for blueprint generation. |
| `driftguard_get_recipe` | _none_ | Outputs the clean markdown execution blueprint. |

---

## 🚀 Quick Setup

### 1. Clone & Build
```bash
git clone https://github.com/<your-username>/driftguard-mcp.git
cd driftguard-mcp
npm install
npm run build
```

### 2. Connect to Your AI Client

#### 🟣 Claude Desktop
Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):
```json
{
  "mcpServers": {
    "driftguard": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/driftguard-mcp/dist/index.js"]
    }
  }
}
```

#### ⚡ Cursor / Antigravity / Windsurf
Add via the MCP settings tab:
* **Command**: `node`
* **Args**: `/ABSOLUTE/PATH/TO/driftguard-mcp/dist/index.js`

---

## 🧪 Testing

Run the automated test suite:
```bash
npm test
```

---

## 🤝 Contributing
Contributions are welcome! Feel free to open issues or pull requests.

## 📄 License
Released under the [MIT License](LICENSE).
