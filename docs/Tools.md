# Vivi AI - Functional Tools & Orchestration (ViviTOOR)

This document describes the structure and execution rules of functional tools (`src/vivi/tools/`) integrated into Vivi AI's cognitive reasoning pipeline.

---

## 1. Tool Base Pattern (`ToolBase.js`)

Every functional tool extends the abstract class `ToolBase` and implements a strict descriptor contract:

```javascript
class MyTool extends ToolBase {
  constructor(name, description, schema) {
    super(name, description, schema);
  }

  async execute(params, context) {
    // Run tool logic
    // Must return a structured { success, data, error } envelope
  }
}
```

By enforcing this contract, Vivi's central Tool Orchestrator (`ViviTOOR`) can serialize tool descriptions to include them in Gemini system prompts as structured JSON functions.

---

## 2. Directory of Core Functional Tools

Vivi AI incorporates a diverse toolset to let the assistant inspect, modify, and query context:

### A. Core Memory & Knowledge Tools
- **`MemoryTool.js`**: Exposes memory CRUD operations. Allows the language model to write new memories, delete outdated nodes, or update importances directly from a conversation.
- **`WebSearchTool.js`**: Connects to search engines to gather up-to-date facts, bypassing pre-trained knowledge cutoffs.
- **`VectorStorageRagTool.js`**: Integrates deep document search over long-form texts by splitting inputs, matching vector embeddings, and extracting localized text chunks.
- **`KnowledgeQueryTool.js`**: Executes structural database searches across static facts and Venezuela localizations.

### B. Workspace & Location Integration Tools
- **`WorkspaceIntegrationsTool.js`**: Executes Google Workspace API requests (Gmail search, Calendar scheduling, Drive updates) using credentials authorized via OAuth.
- **`GoogleMapsPlatformTool.js`**: Pinpoints places, performs address validations, and builds routing pathways.

### C. System & Repository Operations
- **`FileManagementTool.js`**: Read, write, and list workspace documents.
- **`CodeTool.js`**: Audits codebase structures, checks syntax correctness, and runs modular edits.
- **`SecuritySandboxTool.js`**: Safely executes dynamic JavaScript or script commands inside an isolated environment, catching cyclic serialization risks or crash triggers.
- **`SystemDiagnosticTool.js`**: Generates real-time telemetry, tracks system memory leaks, and parses network connection latency.
- **`McpProtocolTool.js`**: Connects to external Model Context Protocol (MCP) host servers to discover dynamic schemas and run remote executions.

---

## 3. Tool Execution Pipeline

When Vivi Core determines that a user query requires a tool call:

```
┌─────────────────────────────────────────────────────────────┐
│                      ViviCore Engine                        │
│   (Receives Tool Call payload from Gemini Server API)        │
└──────────────────────────────┬──────────────────────────────┘
                               │ Dispatches Payload
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                      ViviTOOR Module                        │
│   (Checks security rules, validates schemas, runs timers)   │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
               ├──────────────────────────────┼──────────────────────────────┐
               ▼                              ▼                              ▼
     ┌───────────────────┐          ┌───────────────────┐          ┌───────────────────┐
     │  Validate Input   │          │  Security Check   │          │ Execute Tool logic│
     │  against schema   │          │ (Founder privilege│          │  within try-catch │
     └───────────────────┘          └───────────────────┘          └───────────────────┘
                                                                             │
                                                                             ▼
                                                                   ┌───────────────────┐
                                                                   │ Return formatted  │
                                                                   │ {success, data}   │
                                                                   └───────────────────┘
```

### Safety and Logging Safeguards:
- **Telemetry Buffering**: Every tool action logs parameters, execution durations, and statuses using `_logAction()`.
- **Cyclic Protection**: Tool logs utilize the `safeJsonStringify` utility to prevent fatal circular reference crashes when serializing complex system outputs.
- **Sandboxed Execution**: Highly sensitive operations (like code testing or raw command executions) run inside `SecuritySandboxTool` where access to the global `window` context is intercepted and mocked.
