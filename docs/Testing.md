# Vivi AI - Testing & Verification Guidelines

This document outlines the testing and system validation strategies implemented in Vivi AI, covering interactive diagnostics, static code analysis, sandboxed execution, and lint checks.

---

## 1. Static Validation (Linting & Builds)

To maintain code reliability and catch potential issues before deployment, Vivi AI relies on two main validation checks:

### A. Static Linting
- **Command**: `npm run lint`
- **Execution Engine**: ESLint
- **Configured Rules**: Ensures correct ES Module path structures, prevents unused imports, checks React hook dependencies, and catches missing variables.
- **Auto-Fixing**: Run `npm run lint:fix` to automatically resolve standard spacing, indentation, and import sorting issues.

### B. Compilation Verification
- **Command**: `npm run build`
- **Execution Engine**: Vite (Frontend) + Esbuild (Server bundle)
- **Validation**: Confirms that import paths exist, JSX compiles cleanly, types are respected, and the backend bundle builds successfully.

---

## 2. Dynamic Runtime Diagnostics

Vivi AI includes an interactive **Diagnostic Panel** (`src/components/vivi/DiagnosticPanel.jsx`) built directly into the client dashboard. This lets developers test the application live in the browser.

### Panel Capabilities:
- **Module Status Tracker**: Displays real-time statuses (`idle`, `listening`, `thinking`, `speaking`, `error`) for each of the 28 active modules.
- **STT/TTS Tester**: Allows manual voice synthesis tests, speech recognition evaluations, and volume level checks.
- **Latency & Ping Analyzer**: Performs continuous checks against Google Generative Language endpoints and Firestore connections, displaying real-time response times in milliseconds.
- **Interactive Console & Log Downloader**: Displays Event Bus logs and includes a copy-to-clipboard button utilizing the `safeJsonStringify` utility to export system status dumps for troubleshooting.

---

## 3. Sandboxed Execution Testing

When validating automated code modifications or executing external script snippets, Vivi AI uses the `SecuritySandboxTool` (`src/vivi/tools/SecuritySandboxTool.js`). This tool isolates execution to keep the main thread safe:

- **Isolated Scope**: Execution is scoped to prevent scripts from accessing or modifying sensitive global objects like `window`, `document`, or parent cookies.
- **Console Interception**: Overrides standard `console.log`, `console.warn`, and `console.error` to collect output in a private array, which is then serialized and returned to the caller.
- **Error Isolation**: Wraps executions in comprehensive `try-catch` blocks. It catches syntax errors, circular references, and dynamic execution crashes without interrupting the central runtime engine.
