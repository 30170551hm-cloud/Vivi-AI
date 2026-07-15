# Vivi AI - AI Provider Gateway (LLM Orchestration)

This document details the configuration, implementation, and execution pipeline of the **AI Provider Gateway** (`src/lib/aiProvider.js`), the cognitive engine of Vivi AI.

---

## 1. Overview & Capabilities

The AI Provider Gateway operates as an abstraction layer above raw artificial intelligence engines. It exposes a single, high-level functional contract:

```javascript
AI.InvokeLLM({ prompt, response_json_schema?, file_urls?, model? })
```

This method automatically returns a clean, parsed JSON object (if a structural schema was provided) or a standard raw string response.

### Highlights:
- **Fallback Orchestration**: If the primary AI provider fails, is slow, or encounters API limit blocks, the system automatically redirects the query through secondary providers in order of their specified priority.
- **Bi-Directional Sinking**: Provider settings are stored locally in `localStorage` for instant boots, but are synchronized in real-time with Firestore when a user session is active.
- **Dynamic Schema Normalization**: Adapts schema field parameters (such as forcing JSON schema types like `string`, `object`, and `array` into uppercase) to comply with Gemini's rigid API requirements.

---

## 2. Supported Providers

The system is pre-configured with a list of active and idle providers:

| Provider ID | Visual Name | Type | Endpoint URL | Default Model | Priority |
| :--- | :--- | :--- | :--- | :--- | :---: |
| `gemini-server` | Gemini (Server Proxy) | `gemini` | `/api/gemini/generate` | `gemini-3.5-flash` | 1 |
| `gemini-direct` | Gemini Directo | `gemini_direct` | `https://generativelanguage...` | `gemini-3.5-flash` | 2 |
| `openrouter` | OpenRouter | `openai_compatible` | `https://openrouter.ai/api/v1` | `meta-llama/...` | 3 |
| `openai` | OpenAI | `openai_compatible` | `https://api.openai.com/v1` | `gpt-4o-mini` | 4 |
| `groq` | Groq | `openai_compatible` | `https://api.groq.com/openai/v1` | `llama3-8b-8192` | 5 |
| `claude` | Anthropic Claude | `claude` | `https://api.anthropic.com/v1` | `claude-3-5-...` | 6 |
| `ollama` | Ollama (Local) | `ollama` | `http://localhost:11434` | `llama3` | 7 |
| `lm-studio` | LM Studio (Local) | `openai_compatible` | `http://localhost:1234/v1` | `meta-llama-...` | 8 |

---

## 3. High Availability Execution Flow

When a module invokes the AI Provider, the gateway executes the following sequence:

```
                  ┌──────────────────────┐
                  │   AI.InvokeLLM()     │
                  └──────────┬───────────┘
                             │
            ┌────────────────▼────────────────┐
            │   Identify enabled providers    │
            │  sorted by Priority (Ascending)  │
            └────────────────┬────────────────┘
                             │
                             ├──────────────────────────┐
                             ▼                          ▼
                 ┌───────────────────────┐  ┌───────────────────────┐
                 │ Provider[Priority N]  │  │   All Retries Fail?   │
                 └───────────┬───────────┘  └───────────┬───────────┘
                             │                          │
                    ┌────────┴────────┐                 │
                    │ Attempt Request │                 │
                    └────────┬────────┘                 │
                             │                          │
                ┌────────────┴────────────┐             │
         ┌──────▼──────┐           ┌──────▼──────┐      │
         │   Success   │           │   Failure   │      │
         └──────┬──────┘           └──────┬──────┘      │
                │                         │             │
                ▼                         ▼             ▼
        ┌───────────────┐         ┌───────────────┐ ┌───────────────┐
        │ Return Reply  │         │  Try Priority │ │ Return Global │
        │ & Cache ID    │         │     (N + 1)   │ │  Error Event  │
        └───────────────┘         └───────────────┘ └───────────────┘
```

### Abort & Timeout Protection
Every call uses a custom `fetchWithTimeoutAndSignal` function wrapped around an `AbortController`. The default timeout is **12 seconds**. This prevents lagging network calls from locking the conversational thread or freezing the application frame.

---

## 4. Key Implementation Details

### Model Mapping Resolver:
The gateway maps requested model labels to production-ready targets to prevent broken API calls:
- `"pro"` maps to `gemini-3.1-pro-preview`
- `"lite"` maps to `gemini-3.1-flash-lite`
- `"flash"` maps to `gemini-3.5-flash` (standard fallback default)

### Dynamic JSON Schemas:
Gemini's type analyzer requires uppercase types (e.g. `{"type": "OBJECT", "properties": ...}`). The gateway includes a recursive helper `normalizeSchema` that converts standard JSON schema declarations seamlessly before request dispatch.
