// ViviTOOR — Tool Orchestrator.
// The intelligent administrator of all Vivi tools.
//
// RESPONSIBILITIES:
//   • Manage all available tools (registry)
//   • Auto-detect which tool to use for each request (LLM-powered)
//   • Register all executed actions (audit trail via ToolAction entity)
//   • Administer permissions (founder-only tools)
//   • Coordinate multiple tools simultaneously
//   • Optimize response times (caching, parallel execution)
//   • Maintain system state
//
// TOOR is independent of ViviCore — Core asks TOOR to resolve a request,
// TOOR decides which tool(s) to use and returns the result.

import { ModuleBase } from '../core/ModuleBase';
import { EVENTS } from '../events';
import { base44 } from '@/api/base44Client';

import WebSearchTool from '../tools/WebSearchTool';
import MemoryTool from '../tools/MemoryTool';
import SystemDiagnosticTool from '../tools/SystemDiagnosticTool';
import FileManagementTool from '../tools/FileManagementTool';
import CodeTool from '../tools/CodeTool';
import DocumentationTool from '../tools/DocumentationTool';
import KnowledgeQueryTool from '../tools/KnowledgeQueryTool';
import ProjectManagementTool from '../tools/ProjectManagementTool';
import { AI } from '@/lib/aiProvider';

export default class ViviTOOR extends ModuleBase {
  constructor(bus) {
    super('toor', bus);
    this._tools = new Map();
    this._actionLog = [];
    this._maxLogEntries = 100;
  }

  async init(registry) {
    await super.init(registry);

    // Register all built-in tools.
    // New tools can be added here without modifying anything else.
    this.registerTool(new WebSearchTool());
    this.registerTool(new MemoryTool());
    this.registerTool(new KnowledgeQueryTool());
    this.registerTool(new ProjectManagementTool());
    this.registerTool(new FileManagementTool());
    this.registerTool(new CodeTool());
    this.registerTool(new DocumentationTool());
    this.registerTool(new SystemDiagnosticTool());

    this._diag(`TOOR initialized with ${this._tools.size} tools`);
  }

  /** Register a new tool. */
  registerTool(tool) {
    this._tools.set(tool.name, tool);
    this._diag(`Tool registered: ${tool.name}`);
  }

  /** Get a tool by name. */
  getTool(name) {
    return this._tools.get(name);
  }

  /** List all registered tools. */
  listTools() {
    return Array.from(this._tools.values()).map((t) => ({
      name: t.name,
      description: t.description,
      category: t.category,
      requiresFounder: t.requiresFounder,
    }));
  }

  /**
   * Auto-detect which tool(s) to use for a given user request.
   * Uses LLM to classify the request and select the best tool.
   * Returns the tool name and suggested parameters.
   */
  async detectTool(userText) {
    const toolList = this.listTools();
    const toolDescriptions = toolList.map((t) => `- ${t.name}: ${t.description}`).join('\n');

    try {
      const response = await AI.InvokeLLM({
        prompt: `Analiza la solicitud del usuario y determina qué herramienta de Vivi debe usarse.

Herramientas disponibles:
${toolDescriptions}

Solicitud del usuario: "${userText}"

Responde con un JSON que indique:
- tool: el nombre exacto de la herramienta más adecuada, o "none" si ninguna aplica (conversación normal)
- action: la acción específica dentro de la herramienta (si aplica)
- params: parámetros sugeridos para la herramienta
- reason: por qué elegiste esta herramienta

Si la solicitud es una conversación normal, saludo, o pregunta que Vivi puede responder con su conocimiento, usa "none".`,
        response_json_schema: {
          type: 'object',
          properties: {
            tool: { type: 'string' },
            action: { type: 'string' },
            params: { type: 'object', additionalProperties: true },
            reason: { type: 'string' },
          },
          required: ['tool', 'reason'],
        },
      });

      return response;
    } catch (err) {
      this._diagError('detectTool failed', err?.message);
      return { tool: 'none', reason: 'detection failed' };
    }
  }

  /**
   * Execute a tool by name with the given parameters.
   * Logs the action for audit, checks permissions.
   */
  async execute(toolName, params, context) {
    const tool = this._tools.get(toolName);
    if (!tool) {
      return { success: false, data: null, error: `Herramienta no encontrada: ${toolName}` };
    }

    // Permission check: founder-only tools
    if (tool.requiresFounder) {
      const security = context?.registry?.get('security');
      if (security && !security.isAuthorized()) {
        this._logAction(toolName, params, null, 'error', 0, 'Permission denied: founder only');
        return { success: false, data: null, error: 'Permiso denegado: solo el fundador puede usar esta herramienta' };
      }
    }

    const startTime = Date.now();
    try {
      const result = await tool.execute(params, context);
      const duration = Date.now() - startTime;
      this._logAction(toolName, params, result, result.success ? 'success' : 'error', duration, result.error);
      this._diag(`Tool executed: ${toolName} (${duration}ms) — ${result.success ? 'success' : 'error'}`);
      return result;
    } catch (err) {
      const duration = Date.now() - startTime;
      this._logAction(toolName, params, null, 'error', duration, err?.message);
      this._diagError(`Tool error: ${toolName}`, err?.message);
      return { success: false, data: null, error: err?.message || 'Error desconocido' };
    }
  }

  /**
   * Resolve a user request: detect the tool, execute it, return the result.
   * This is the main entry point that ViviCore calls.
   * Returns null if no tool is needed (normal conversation).
   */
  async resolveRequest(userText, context) {
    const detection = await this.detectTool(userText);

    if (!detection || detection.tool === 'none' || !detection.tool) {
      return null; // No tool needed — normal conversation
    }

    this._diag(`TOOR detected tool: ${detection.tool} — ${detection.reason}`);
    const result = await this.execute(detection.tool, detection.params || {}, context);

    return {
      toolName: detection.tool,
      reason: detection.reason,
      result,
    };
  }

  /** Log an action to the in-memory audit trail and persist to ToolAction entity. */
  _logAction(toolName, params, result, status, durationMs, error) {
    const entry = {
      tool_name: toolName,
      action: params?.action || 'execute',
      input_summary: JSON.stringify(params || {}).slice(0, 500),
      output_summary: result?.data ? JSON.stringify(result.data).slice(0, 500) : '',
      status,
      duration_ms: durationMs,
      error_message: error || null,
      timestamp: Date.now(),
    };

    this._actionLog.push(entry);
    if (this._actionLog.length > this._maxLogEntries) {
      this._actionLog.shift();
    }

    // Persist to entity for permanent audit trail (fire-and-forget)
    this.safe(() => base44.entities.ToolAction.create({
      tool_name: entry.tool_name,
      action: entry.action,
      input_summary: entry.input_summary,
      output_summary: entry.output_summary,
      status: entry.status,
      duration_ms: entry.duration_ms,
      error_message: entry.error_message,
    }));
  }

  /** Get the recent action log (in-memory, for quick access). */
  getActionLog(limit = 20) {
    return this._actionLog.slice(-limit).reverse();
  }

  /** Get recent persisted actions from the database. */
  async getPersistedActions(limit = 50) {
    return await this.safe(() => base44.entities.ToolAction.list('-created_date', limit), []);
  }

  _diag(message) {
    console.log(`[ViviTOOR] ${message}`);
    this.emit(EVENTS.LOG_ADDED, { module: 'toor', message, timestamp: Date.now() });
  }

  _diagError(message, error) {
    const errMsg = error?.message || String(error || 'Unknown error');
    console.error(`[ViviTOOR] ${message}`, error || '');
    this.emit(EVENTS.LOG_ADDED, { module: 'toor', message: `${message}: ${errMsg}`, level: 'error', timestamp: Date.now() });
  }

  health() {
    return {
      name: this.name,
      healthy: this._initialized,
      toolsRegistered: this._tools.size,
      actionsLogged: this._actionLog.length,
    };
  }
}