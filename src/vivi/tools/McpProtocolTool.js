// McpProtocolTool — Model Context Protocol (MCP) client.
// Establishes connections, negotiates JSON-RPC 2.0 handshakes, discover tools, and executes calls.

import { ToolBase } from './ToolBase';

export default class McpProtocolTool extends ToolBase {
  constructor() {
    super({
      name: 'mcp_client',
      description: 'Conecta con servidores MCP (Model Context Protocol) externos para descubrir y ejecutar herramientas remotas dinámicamente.',
      category: 'developer',
      permissions: ['mcp:connect'],
      timeout: 15000,
      retries: 1,
    });
    this._connections = new Map(); // Store active JSON-RPC channels
  }

  async execute(params, _context) {
    const action = params?.action; // 'connect' | 'list_tools' | 'call_tool' | 'disconnect'
    const serverUrl = params?.server_url;

    if (!serverUrl) {
      return { success: false, data: null, error: 'Se requiere la URL del servidor MCP ("server_url").' };
    }

    try {
      switch (action) {
        case 'connect':
          return await this.connectMcp(serverUrl);
        case 'list_tools':
          return await this.listMcpTools(serverUrl);
        case 'call_tool':
          return await this.callMcpTool(serverUrl, params.tool_name, params.tool_arguments);
        case 'disconnect':
          return this.disconnectMcp(serverUrl);
        default:
          return {
            success: false,
            data: null,
            error: `Acción MCP '${action}' no soportada.`,
          };
      }
    } catch (err) {
      return {
        success: false,
        data: null,
        error: `Fallo en el protocolo MCP (${action}): ${err.message || err}`,
      };
    }
  }

  // ── MCP Connect Handler ──
  async connectMcp(serverUrl) {
    if (this._connections.has(serverUrl)) {
      return { success: true, data: { status: 'connected', message: 'Ya conectado al servidor MCP.' } };
    }

    // Attempt negotiation handshake
    try {
      // Typically, MCP servers communicate via SSE (HTTP post + eventSource)
      const res = await fetch(`${serverUrl}/sse`);
      if (!res.ok) {
        throw new Error(`Servidor MCP respondió con código HTTP ${res.status}`);
      }

      // Prepare connection state structure
      const connectionState = {
        url: serverUrl,
        connected_at: Date.now(),
        tools: [],
      };

      // Conduct initial JSON-RPC initialize request
      const initPayload = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'Vivi-AI-Core', version: '2.0.0' },
        },
      };

      const initRes = await fetch(`${serverUrl}/rpc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(initPayload),
      });

      if (!initRes.ok) {
        throw new Error(`Inicialización JSON-RPC falló: HTTP ${initRes.status}`);
      }

      const initData = await initRes.json();
      if (initData.error) {
        throw new Error(`MCP Inicialización error: ${initData.error.message || initData.error.code}`);
      }

      connectionState.protocolVersion = initData.result?.protocolVersion;
      connectionState.serverInfo = initData.result?.serverInfo;

      // Persist active connection
      this._connections.set(serverUrl, connectionState);

      return {
        success: true,
        data: {
          status: 'connected',
          server_info: connectionState.serverInfo,
          protocol_version: connectionState.protocolVersion,
        },
      };
    } catch (err) {
      return {
        success: false,
        error: `No se pudo establecer conexión MCP en '${serverUrl}': ${err.message}`,
      };
    }
  }

  // ── MCP List Tools Handler ──
  async listMcpTools(serverUrl) {
    if (!this._connections.has(serverUrl)) {
      const connResult = await this.connectMcp(serverUrl);
      if (!connResult.success) return connResult;
    }

    const payload = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {},
    };

    const res = await fetch(`${serverUrl}/rpc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error(`Fallo consulta tools/list: HTTP ${res.status}`);

    const data = await res.json();
    if (data.error) {
      throw new Error(`MCP Error listando herramientas: ${data.error.message}`);
    }

    const tools = data.result?.tools || [];
    const conn = this._connections.get(serverUrl);
    if (conn) conn.tools = tools;

    return {
      success: true,
      data: {
        server_url: serverUrl,
        tools_discovered: tools.length,
        tools: tools.map(t => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        })),
      },
    };
  }

  // ── MCP Call Tool Handler ──
  async callMcpTool(serverUrl, toolName, toolArguments = {}) {
    if (!toolName) return { success: false, error: 'Se requiere "tool_name".' };

    if (!this._connections.has(serverUrl)) {
      const connResult = await this.connectMcp(serverUrl);
      if (!connResult.success) return connResult;
    }

    const payload = {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: toolArguments,
      },
    };

    const res = await fetch(`${serverUrl}/rpc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error(`Llamada remota MCP falló: HTTP ${res.status}`);

    const data = await res.json();
    if (data.error) {
      return {
        success: false,
        error: `MCP Error remoto en herramienta '${toolName}': ${data.error.message} (Código ${data.error.code})`,
      };
    }

    return {
      success: true,
      data: {
        result: data.result,
        tool: toolName,
      },
    };
  }

  // ── MCP Disconnect ──
  disconnectMcp(serverUrl) {
    if (this._connections.has(serverUrl)) {
      this._connections.delete(serverUrl);
      return { success: true, data: { status: 'disconnected', message: 'Desconectado con éxito.' } };
    }
    return { success: true, data: { status: 'not_connected', message: 'No había conexión activa.' } };
  }
}
