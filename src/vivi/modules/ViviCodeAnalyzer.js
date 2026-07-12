// ViviCodeAnalyzer — Self-analysis of Vivi's own source code.
// Contains NO code-writing logic. Reads the real project via GitHub
// (through Cloud Functions — the GitHub token never reaches the browser)
// and asks the LLM provider layer to find issues, using the SAME severity
// convention as the human technical audit: 🔴 Crítico, 🟠 Importante,
// 🟡 Recomendación, 🟢 Correcto.
//
// DIVISIÓN DE RESPONSABILIDADES (no duplicar ViviVDE):
//   ViviCodeAnalyzer  → SOLO detecta y reporta. Nunca escribe código.
//   ViviVDE           → diseña la solución y genera el código, a partir de
//                       un hallazgo que el Analyzer le entrega.
// Igual que ViviConversationEngine nunca genera respuestas (eso es tarea
// exclusiva de ViviCore), Analyzer nunca genera código (eso es tarea
// exclusiva de VDE). Separación verificada contra el patrón ya existente.
//
// ESTADO: módulo nuevo, reemplaza un archivo de 0 bytes que no hacía nada.
// Requiere GITHUB_TOKEN configurado en Cloud Functions y que llmProviders.js
// (callLLM) esté desplegado — ninguno de los dos está probado contra un
// proyecto real todavía.

import { ModuleBase } from '../core/ModuleBase';
import { EVENTS } from '../events';
import { GitHubProvider } from '@/lib/githubProvider';
import { CoreIntegrations } from '@/lib/llmProviders';

// Extensiones que tiene sentido analizar; se ignoran assets, locks, etc.
const ANALYZABLE_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx'];

// Carpetas que nunca aportan valor al análisis (generadas, de terceros, o
// ya cubiertas por otras herramientas).
const IGNORED_PATH_SEGMENTS = ['node_modules', 'dist', 'components/ui', '.git'];

const ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['critico', 'importante', 'recomendacion', 'correcto'] },
          line_hint: { type: 'string', description: 'Línea aproximada o rango' },
          category: {
            type: 'string',
            enum: ['error_logico', 'codigo_duplicado', 'modulo_incompleto', 'dependencia_rota',
                   'seguridad', 'rendimiento', 'deuda_tecnica', 'archivo_sin_uso', 'funcion_huerfana', 'otro'],
          },
          explanation: { type: 'string' },
          risk: { type: 'string' },
          suggested_fix: { type: 'string' },
        },
        required: ['severity', 'category', 'explanation'],
      },
    },
  },
  required: ['findings'],
};

export default class ViviCodeAnalyzer extends ModuleBase {
  constructor(bus, config = {}) {
    super('code_analyzer', bus);
    // Config del repo a analizar — por defecto, el propio repo de Vivi.
    this._owner = config.owner || 'vivioficial';
    this._repo = config.repo || 'VIVI-AI';
    this._branch = config.branch || 'main';
    this._lastReport = null;
  }

  async init(registry) {
    await super.init(registry);
  }

  /**
   * Analiza un solo archivo del repo real.
   * @param {string} path - ruta relativa dentro del repo, ej: 'src/vivi/modules/ViviCore.js'
   * @returns {Promise<{path: string, findings: object[]}|null>}
   */
  async analyzeFile(path) {
    const file = await this.safe(() =>
      GitHubProvider.getRepoFile({ owner: this._owner, repo: this._repo, path, branch: this._branch }),
      null
    );
    if (!file?.content) {
      this._diagError('No se pudo leer el archivo', path);
      return null;
    }

    const result = await this.safe(() =>
      CoreIntegrations.InvokeLLM({
        prompt: `Eres un auditor técnico senior. Analiza el siguiente archivo de código fuente de Vivi AI y detecta: errores lógicos, código duplicado, módulos incompletos, dependencias rotas, problemas de seguridad, problemas de rendimiento, deuda técnica, código sin uso o funciones huérfanas.\n\nArchivo: ${path}\n\n\`\`\`\n${file.content.slice(0, 12000)}\n\`\`\`\n\nSolo reporta hallazgos reales y específicos de este archivo — no generes hallazgos genéricos. Si el archivo está correcto, devuelve una lista vacía o un único hallazgo de severidad "correcto" explicando por qué.`,
        response_json_schema: ANALYSIS_SCHEMA,
      }),
      null
    );

    const findings = result?.findings || [];
    this.emit(EVENTS.CODE_ANALYSIS_FILE_RESULT, { path, findings });
    return { path, findings };
  }

  /**
   * Analiza el proyecto completo (acotado a maxFiles para no agotar cuota de LLM).
   * @param {{maxFiles?: number}} options
   */
  async analyzeProject({ maxFiles = 15 } = {}) {
    this.emit(EVENTS.CODE_ANALYSIS_START, { owner: this._owner, repo: this._repo });

    const tree = await this.safe(() =>
      GitHubProvider.getRepoTree({ owner: this._owner, repo: this._repo, branch: this._branch }),
      null
    );
    if (!tree?.files) {
      this._diagError('No se pudo leer el árbol del repo', 'tree vacío');
      this.emit(EVENTS.CODE_ANALYSIS_ERROR, { message: 'No se pudo leer el árbol del repo' });
      return null;
    }

    const candidates = tree.files
      .filter((f) => f.type === 'blob')
      .filter((f) => ANALYZABLE_EXTENSIONS.some((ext) => f.path.endsWith(ext)))
      .filter((f) => !IGNORED_PATH_SEGMENTS.some((seg) => f.path.includes(seg)))
      .slice(0, maxFiles);

    const report = { owner: this._owner, repo: this._repo, analyzed: [], startedAt: Date.now() };

    for (const file of candidates) {
      const result = await this.analyzeFile(file.path);
      if (result) report.analyzed.push(result);
    }

    report.finishedAt = Date.now();
    report.totalFindings = report.analyzed.reduce((n, r) => n + r.findings.length, 0);
    this._lastReport = report;

    this.emit(EVENTS.CODE_ANALYSIS_COMPLETE, report);
    this._diag(`Análisis completo: ${report.analyzed.length} archivos, ${report.totalFindings} hallazgos`);
    return report;
  }

  /** Último informe de análisis generado (para la UI). */
  getLastReport() {
    return this._lastReport;
  }

  /**
   * Entrega un hallazgo concreto a ViviVDE para que diseñe la corrección.
   * El Analyzer nunca genera código él mismo — delega en VDE, que es quien
   * tiene esa responsabilidad (ver cabecera del archivo).
   */
  async proposeFixFor(path, finding) {
    const vde = this.registry?.get('vde');
    if (!vde) {
      this._diagError('ViviVDE no está registrado — no se puede proponer corrección', path);
      return null;
    }
    return vde.detectBug(
      `${finding.category}: ${finding.explanation}`,
      `Archivo: ${path}\nLínea aproximada: ${finding.line_hint || 'no especificada'}\nRiesgo: ${finding.risk || 'no especificado'}`
    );
  }

  _diag(message) {
    console.log(`[ViviCodeAnalyzer] ${message}`);
    this.emit(EVENTS.LOG_ADDED, { module: 'code_analyzer', message, timestamp: Date.now() });
  }

  _diagError(message, detail) {
    console.error(`[ViviCodeAnalyzer] ${message}`, detail || '');
    this.emit(EVENTS.LOG_ADDED, { module: 'code_analyzer', message: `${message}: ${detail}`, level: 'error', timestamp: Date.now() });
  }

  health() {
    return { name: this.name, healthy: this._initialized, lastReport: this._lastReport ? {
      analyzed: this._lastReport.analyzed.length,
      totalFindings: this._lastReport.totalFindings,
    } : null };
  }
}
