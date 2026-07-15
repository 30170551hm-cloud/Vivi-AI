// SecuritySandboxTool — Secure execution sandbox for JS and Python scripts.
// Implements secure virtual environments, constraints, and instructions.

import { ToolBase } from './ToolBase';

export default class SecuritySandboxTool extends ToolBase {
  constructor() {
    super({
      name: 'safe_sandbox',
      description: 'Ejecuta scripts de JavaScript y Python de forma segura dentro de un entorno aislado (sandbox).',
      category: 'developer',
      permissions: ['sandbox:execute'],
      timeout: 10000,
      retries: 0, // Sandbox codes should not retry automatically
    });
  }

  async execute(params, _context) {
    const language = String(params?.language || 'javascript').toLowerCase().trim();
    const code = params?.code;

    if (!code) {
      return { success: false, data: null, error: 'Se requiere el parámetro "code" (código fuente).' };
    }

    try {
      if (language === 'javascript' || language === 'js') {
        return this.executeJavaScript(code);
      } else if (language === 'python' || language === 'py') {
        return await this.executePython(code, params);
      } else {
        return {
          success: false,
          data: null,
          error: `Lenguaje de programación '${language}' no soportado en este sandbox. Soportados: 'javascript', 'python'.`,
        };
      }
    } catch (err) {
      return {
        success: false,
        data: null,
        error: `Fallo de ejecución catastrófico en el sandbox: ${err.message || err}`,
      };
    }
  }

  // ── JavaScript Sandboxed Execution ──
  executeJavaScript(code) {
    // Basic protection: disallow window, document, process, require, global, import
    const blockList = ['window', 'document', 'process', 'global', 'require', 'import', 'eval', 'Function', 'XMLHttpRequest', 'fetch'];
    for (const token of blockList) {
      if (code.includes(token)) {
        return {
          success: false,
          error: `Seguridad del Sandbox: Uso prohibido del token '${token}' para evitar fugas de contexto.`,
        };
      }
    }

    // Capture console output
    const consoleLogs = [];
    const customConsole = {
      log: (...args) => consoleLogs.push(args.map(x => {
        try {
          return typeof x === 'object' ? JSON.stringify(x) : String(x);
        } catch {
          return '[Circular Object]';
        }
      }).join(' ')),
      warn: (...args) => consoleLogs.push(`[WARN] ` + args.map(x => {
        try {
          return typeof x === 'object' ? JSON.stringify(x) : String(x);
        } catch {
          return '[Circular Object]';
        }
      }).join(' ')),
      error: (...args) => consoleLogs.push(`[ERROR] ` + args.map(x => {
        try {
          return typeof x === 'object' ? JSON.stringify(x) : String(x);
        } catch {
          return '[Circular Object]';
        }
      }).join(' ')),
    };

    try {
      // Create isolated environment function
      const runner = new Function('console', `
        "use strict";
        try {
          ${code}
        } catch(e) {
          console.error(e.message || String(e));
        }
      `);

      runner(customConsole);

      return {
        success: true,
        data: {
          logs: consoleLogs,
          exit_code: 0,
          language: 'javascript'
        }
      };
    } catch (err) {
      return {
        success: false,
        error: `Error de sintaxis o ejecución en el script JS: ${err.message}`,
      };
    }
  }

  // ── Python Sandbox Runner (Remote connection setup instructions) ──
  async executePython(code, params) {
    const remoteExecutionUrl = params?.sandbox_endpoint || process.env.PYTHON_SANDBOX_ENDPOINT || null;

    if (!remoteExecutionUrl) {
      return {
        success: false,
        data: null,
        error: `Para ejecutar código Python de forma segura:
1. El sistema requiere un contenedor aislado externo (ej. gVisor, Firecracker o Piston API).
2. Configura e inicia un endpoint de ejecución segura de Python.
3. Define la variable de entorno 'PYTHON_SANDBOX_ENDPOINT' o pásala en los parámetros.

Código enviado:
\`\`\`python
${code}
\`\`\`
`,
      };
    }

    // If an execution URL is provided, call it in a highly async-safe manner
    const res = await fetch(remoteExecutionUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: 'python',
        version: '3.10',
        files: [{ name: 'main.py', content: code }]
      }),
    });

    if (!res.ok) {
      throw new Error(`Servidor de sandbox retornó código de error ${res.status}`);
    }

    const output = await res.json();
    return {
      success: true,
      data: {
        stdout: output?.run?.stdout || '',
        stderr: output?.run?.stderr || '',
        exit_code: output?.run?.code ?? 0,
        language: 'python'
      }
    };
  }
}
