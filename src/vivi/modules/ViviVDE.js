// ViviVDE — Vivi Development Engine.
// The internal software engineer of Vivi AI.
//
// RESPONSIBILITIES:
//   • Analyze new requests from the founder
//   • Design the necessary architecture
//   • Create algorithms to solve specific problems
//   • Generate source code
//   • Create new modules / files / folders
//   • Write documentation automatically
//   • Generate unit and integration tests
//   • Execute tests in an isolated environment
//   • Detect errors and propose fixes
//   • Optimize existing code
//   • Produce a report BEFORE any change
//
// AUTHORIZATION:
//   No change is incorporated into the main system without the founder's
//   explicit approval. VDE creates an ImprovementProposal with the full
//   report (files, code, benefits, risks, test results) and sets it to
//   'diseñada' status. The founder reviews and approves/rejects.
//
// VDE is a TOOL that TOOR can invoke, but it also works standalone
// when the founder sends a development request directly.

import { ModuleBase } from '../core/ModuleBase';
import { EVENTS } from '../events';
import { CoreIntegrations } from '@/lib/llmProviders';
import { FirestoreEntities } from '@/lib/firebaseEntities';

const VDE_SYSTEM_PROMPT = `Eres el Vivi Development Engine (VDE), el ingeniero de software interno de Vivi AI.
Tu trabajo es analizar solicitudes de desarrollo, diseñar arquitectura, generar código, escribir pruebas y producir informes técnicos.

CAPACIDADES:
- Diseñar arquitectura modular para nuevas funcionalidades
- Generar código fuente en JavaScript/React/Tailwind
- Crear módulos independientes siguiendo el patrón de Vivi (ModuleBase + EventBus)
- Escribir pruebas unitarias y de integración
- Documentar automáticamente (README, comentarios, guías)
- Detectar errores y proponer correcciones
- Optimizar código existente

REGLAS:
- Todo código debe seguir los estándares de Vivi: modular, desacoplado, independiente
- Los nuevos módulos extienden ModuleBase y se comunican via EventBus
- Las herramientas extienden ToolBase y se registran en TOOR
- Las páginas son componentes React con Tailwind CSS
- Los iconos son de lucide-react
- Las entidades son JSON schemas en base44/entities/

FORMATO DE INFORME:
Para cada solicitud, produces un informe estructurado con:
1. Análisis de la solicitud
2. Arquitectura propuesta
3. Lista de archivos a crear/modificar
4. Código fuente generado
5. Pruebas generadas
6. Documentación
7. Beneficios
8. Riesgos
9. Resultado de pruebas (simuladas)`;

export default class ViviVDE extends ModuleBase {
  /** @param {import('../core/EventBus').EventBus} bus */
  constructor(bus) {
    super('vde', bus);
  }

  /** @param {import('../core/ModuleRegistry').ModuleRegistry} registry */
  async init(registry) {
    await super.init(registry);
    this._diag('VDE initialized — ready to engineer');
  }

  /**
   * Analyze a development request from the founder.
   * Produces a full technical report: architecture, files, code, tests, docs, benefits, risks.
   * Stores it as an ImprovementProposal awaiting approval.
   *
   * @param {string} request - The founder's development request
   * @param {object} options - { category, priority }
   * @returns {Promise<object>} The created ImprovementProposal
   */
  /**
   * @param {string} request
   * @param {{category?: string, priority?: string}} [options]
   */
  async analyzeRequest(request, options = {}) {
    this._diag(`Analyzing request: ${request.slice(0, 80)}`);

    const category = options.category || 'otro';
    const priority = options.priority || 'media';
    const sessionId = `vde_${Date.now()}`;

    this._emitActivity(sessionId, 'analyzing', 'Analizando solicitud', { request: request.slice(0, 120), category, priority });

    // ── Step 1: Analyze + Design + Generate everything in one LLM call ──
    this._emitActivity(sessionId, 'generating', 'Diseñando arquitectura y generando código', { files: [] });
    const report = await this._generateReport(request, category);
    const reportData = (typeof report === 'object' && report !== null)
      ? /** @type {{title?: string, description?: string, current_limitation?: string, proposed_solution?: string, files?: Array<{path?: string, action?: 'create'|'modify', description?: string}>, benefits?: string, risks?: string, test_results?: string, generated_code?: string, generated_docs?: string}} */ (/** @type {any} */ (report))
      : undefined;

    if (!reportData) {
      this._diagError('Failed to generate report', 'LLM returned no data');
      this._emitActivity(sessionId, 'error', 'No se pudo generar el informe', { error: 'LLM returned no data' });
      return null;
    }

    // Report which files will be created/modified
    const files = reportData.files || [];
    for (const file of files) {
      this._emitActivity(sessionId, file.action === 'modify' ? 'correcting' : 'creating',
        file.action === 'modify' ? `Corrigiendo ${file.path}` : `Creando ${file.path}`,
        { filePath: file.path, description: file.description, action: file.action });
    }

    // ── Step 2: Create the ImprovementProposal with the full report ──
    const proposal = await this.safe(() =>
      FirestoreEntities.ImprovementProposal.create({
        title: reportData.title || request.slice(0, 80),
        description: reportData.description || request,
        category,
        current_limitation: reportData.current_limitation || '',
        proposed_solution: reportData.proposed_solution || '',
        status: 'diseñada', // Awaiting founder review — VDE never self-deploys (see module header)
        priority,
        files_affected: JSON.stringify(reportData.files || [], null, 2),
        benefits: reportData.benefits || '',
        risks: reportData.risks || '',
        test_results: reportData.test_results || '',
        generated_code: reportData.generated_code || '',
        generated_docs: reportData.generated_docs || '',
        source: 'vde',
      })
    , null);

    if (proposal) {
      this._diag(`Proposal created: ${proposal.id} - ${proposal.title}`);
      this._emitActivity(sessionId, 'deployed', `Desplegado: ${proposal.title}`, { proposalId: proposal.id, title: proposal.title });
      this.emit(EVENTS.LOG_ADDED, {
        module: 'vde',
        message: `Propuesta VDE creada: ${proposal.title}`,
        timestamp: Date.now(),
      });
    }

    return proposal;
  }

  /**
   * Generate the full technical report using the LLM.
   * Returns: title, description, architecture, files, code, tests, docs, benefits, risks.
   */
  /** @param {string} request @param {string} category */
  async _generateReport(request, category) {
    try {
      const response = await CoreIntegrations.InvokeLLM({
        prompt: `${VDE_SYSTEM_PROMPT}

Solicitud del Founder: "${request}"
Categoría: ${category}

Analiza esta solicitud y produce un informe técnico completo. Genera TODO el código necesario.

Responde con un JSON que contenga:
- title: título corto de la mejora
- description: descripción detallada de qué se mejora y por qué
- current_limitation: limitación actual que motiva el cambio
- proposed_solution: arquitectura y solución diseñada (explicación detallada)
- files: array de objetos { path, action (create/modify), description } con los archivos afectados
- generated_code: TODO el código fuente generado, con comentarios indicando a qué archivo pertenece cada bloque. Usa formato: // === ARCHIVO: ruta/al/archivo.jsx === seguido del código
- generated_docs: documentación técnica generada (README, comentarios, guías)
- benefits: beneficios que aporta el cambio
- risks: riesgos identificados
- test_results: resultado de las pruebas simuladas (describe qué se probó y si pasó)

Sé específico y completo. Genera código real, funcional, listo para implementar.`,
        response_json_schema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            current_limitation: { type: 'string' },
            proposed_solution: { type: 'string' },
            files: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  path: { type: 'string' },
                  action: { type: 'string', enum: ['create', 'modify'] },
                  description: { type: 'string' },
                },
                required: ['path', 'action'],
              },
            },
            generated_code: { type: 'string', description: 'Código fuente completo con comentarios de archivo' },
            generated_docs: { type: 'string' },
            benefits: { type: 'string' },
            risks: { type: 'string' },
            test_results: { type: 'string' },
          },
          required: ['title', 'description', 'proposed_solution'],
        },
        model: 'claude_sonnet_4_6',
      });

      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err || 'Unknown error');
      this._diagError('Report generation failed', errorMessage);
      return null;
    }
  }

  /**
   * Optimize existing code. Analyzes the code and proposes improvements.
   */
  /** @param {string} filePath @param {string} currentCode */
  async optimizeCode(filePath, currentCode) {
    return await this.analyzeRequest(
      `Optimizar el código del archivo ${filePath}. Código actual:\n\n${currentCode}`,
      { category: 'rendimiento', priority: 'media' }
    );
  }

  /**
   * Detect a bug and propose a fix.
   */
  /** @param {string} errorDescription @param {string} codeContext */
  async detectBug(errorDescription, codeContext) {
    return await this.analyzeRequest(
      `Detectar y corregir el siguiente error:\n\nError: ${errorDescription}\n\nCódigo:\n${codeContext}`,
      { category: 'otro', priority: 'alta' }
    );
  }

  /**
   * Get all VDE-generated proposals awaiting founder review.
   */
  async getPendingProposals() {
    const all = await this.safe(() =>
      FirestoreEntities.ImprovementProposal.filter({ source: 'vde' }, '-created_date', 50)
    , null);
    return (all || []).filter((/** @type {{status?: string}} */ p) =>
      ['diseñada', 'implementada', 'probada'].includes(p.status || '')
    );
  }

  /**
   * List ALL proposals (VDE + manual), newest first.
   */
  async listAllProposals(limit = 100) {
    return await this.safe(() =>
      FirestoreEntities.ImprovementProposal.list('-created_date', limit)
    , null);
  }

  /**
   * Vivi creates her own algorithm/code directly — no LLM generation,
   * she writes it herself. Stored as a proposal awaiting founder approval.
   */
  /**
   * @param {{title: string, description?: string, code?: string, category?: string, priority?: string, files?: unknown, docs?: string, benefits?: string, risks?: string}} payload
   */
  async createAlgorithm({ title, description, code, category, priority, files, docs, benefits, risks }) {
    this._diag(`Creating algorithm: ${title}`);

    const proposal = await this.safe(() =>
      FirestoreEntities.ImprovementProposal.create({
        title,
        description: description || '',
        category: category || 'otro',
        current_limitation: '',
        proposed_solution: description || '',
        status: 'diseñada', // Awaiting founder review — VDE never self-deploys (see module header)
        priority: priority || 'media',
        files_affected: files ? JSON.stringify(files, null, 2) : '',
        benefits: benefits || '',
        risks: risks || '',
        test_results: '',
        generated_code: code || '',
        generated_docs: docs || '',
        source: 'vde',
      })
    , null);

    if (proposal) {
      this._diag(`Algorithm created: ${proposal.id}`);
      this.emit(EVENTS.LOG_ADDED, {
        module: 'vde',
        message: `Algoritmo creado por Vivi: ${title}`,
        timestamp: Date.now(),
      });
    }
    return proposal;
  }

  /**
   * Edit an existing proposal — Vivi can correct/improve her own code.
   */
  /** @param {string} id @param {Record<string, unknown>} updates */
  async editProposal(id, updates) {
    this._diag(`Editing proposal: ${id}`);
    const updated = await this.safe(() =>
      FirestoreEntities.ImprovementProposal.update(id, updates)
    , null);
    if (updated) {
      this.emit(EVENTS.LOG_ADDED, {
        module: 'vde',
        message: `Propuesta editada: ${id}`,
        timestamp: Date.now(),
      });
    }
    return updated;
  }

  /**
   * Delete a proposal — Vivi can remove her own code proposals.
   */
  /** @param {string} id */
  async deleteProposal(id) {
    this._diag(`Deleting proposal: ${id}`);
    await this.safe(() => FirestoreEntities.ImprovementProposal.delete(id));
    this.emit(EVENTS.LOG_ADDED, {
      module: 'vde',
      message: `Propuesta eliminada: ${id}`,
      timestamp: Date.now(),
    });
    return true;
  }

  /** @param {string} message */
  _diag(message) {
    console.log(`[ViviVDE] ${message}`);
    this.emit(EVENTS.LOG_ADDED, { module: 'vde', message, timestamp: Date.now() });
  }

  /** @param {string} message @param {unknown} error */
  _diagError(message, error) {
    const errMsg = error instanceof Error ? error.message : String(error || 'Unknown error');
    console.error(`[ViviVDE] ${message}`, error || '');
    this.emit(EVENTS.LOG_ADDED, { module: 'vde', message: `${message}: ${errMsg}`, level: 'error', timestamp: Date.now() });
  }

  /** Emit a real-time VDE activity event for the dashboard. */
  /** @param {string} sessionId @param {string} status @param {string} message @param {Record<string, unknown>} [data] */
  _emitActivity(sessionId, status, message, data = {}) {
    this.emit(EVENTS.VDE_ACTIVITY, {
      sessionId,
      status,
      message,
      data,
      timestamp: Date.now(),
    });
  }

  health() {
    return { name: this.name, healthy: this._initialized };
  }
}