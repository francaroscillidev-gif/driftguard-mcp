# Contributing to Agent-Blackbox MCP

Thank you for your interest in contributing to **Agent-Blackbox MCP**!

This project is maintained by **Franca Roscilli** under the [Apache 2.0 License](LICENSE).

---

## 🛠️ Development Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/francaroscillidev-gif/driftguard-mcp.git
   cd driftguard-mcp
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Build TypeScript**:
   ```bash
   npm run build
   ```

4. **Run Unit Tests**:
   ```bash
   npm test
   ```

---

## 🧪 Code Quality & Guidelines

- **Zero-Dependency Core**: All new diagnostic tools should use Node.js native APIs where possible to keep package size under 40 kB.
- **Strict Typing**: TypeScript code must pass compilation with zero errors or warnings (`npm run build`).
- **Comprehensive Tests**: Any new tool or module added to `src/modules/` must include corresponding unit tests in `src/modules/modules.test.ts`.

---

## 📬 Submitting Changes

1. Fork the repository and create your feature branch:
   ```bash
   git checkout -b feature/my-new-mcp-tool
   ```
2. Commit your changes with clear, semantic commit messages:
   ```bash
   git commit -m "feat: add new telemetry metric for memory usage"
   ```
3. Push to your branch and open a **Pull Request** targeting `main`.

---

## 📄 License & Intellectual Property

By contributing to Agent-Blackbox MCP, you agree that your contributions will be licensed under its **Apache 2.0 License**.
