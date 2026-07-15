// ToolBase — Base class for all Vivi tools.
// Each tool is an independent, self-contained unit that TOOR orchestrates.
// To add a new tool: create a file extending ToolBase, register it in ViviTOOR.

export class ToolBase {
  constructor(config) {
    this.name = config.name;
    this.description = config.description;
    this.category = config.category || 'general';
    this.permissions = config.permissions || [];
    this.requiresFounder = config.requiresFounder || false;

    // Phase 2: Core Tool Engine features
    this.enabled = config.enabled !== false;
    this.timeout = config.timeout || 15000; // default 15 seconds timeout
    this.retries = config.retries ?? 1;     // default 1 retry (2 attempts total)

    this.metrics = {
      calls: 0,
      successes: 0,
      failures: 0,
      total_duration_ms: 0,
      last_error: null,
      last_run_timestamp: null,
    };
  }

  /**
   * Resilient execution wrapper.
   * Handles timeouts, retries, enabling/disabling, metrics collection, and prevents crashes.
   */
  async run(params, context) {
    // 1. Check if tool is enabled (either statically or dynamically via settings)
    let isEnabled = this.enabled;
    const settings = context?.registry?.get('settings');
    if (settings) {
      const prefs = settings.getPrefs();
      if (prefs?.disabled_tools && Array.isArray(prefs.disabled_tools)) {
        if (prefs.disabled_tools.includes(this.name)) {
          isEnabled = false;
        }
      }
    }

    if (!isEnabled) {
      return {
        success: false,
        data: null,
        error: `La herramienta '${this.name}' está actualmente desactivada por configuración.`,
      };
    }

    this.metrics.calls++;
    let attempt = 0;
    const maxAttempts = Math.max(1, (this.retries || 0) + 1);
    let lastError = null;

    while (attempt < maxAttempts) {
      attempt++;
      const attemptStart = Date.now();
      try {
        // Enforce timeout using a Promise race
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Timeout superado (${this.timeout}ms) ejecutando '${this.name}'`));
          }, this.timeout);
        });

        // Execute the actual tool logic
        const result = await Promise.race([
          this.execute(params, context),
          timeoutPromise,
        ]);

        const duration = Date.now() - attemptStart;
        this.metrics.successes++;
        this.metrics.total_duration_ms += duration;
        this.metrics.last_run_timestamp = Date.now();

        // Ensure we always return a standardized result format
        if (result && typeof result === 'object' && 'success' in result) {
          return result;
        }
        return { success: true, data: result };

      } catch (err) {
        const duration = Date.now() - attemptStart;
        lastError = err;
        this.metrics.failures++;
        this.metrics.total_duration_ms += duration;
        this.metrics.last_error = err.message || String(err);
        this.metrics.last_run_timestamp = Date.now();

        console.warn(`[ToolBase:${this.name}] Intento ${attempt}/${maxAttempts} falló (${duration}ms):`, err.message || err);

        if (attempt >= maxAttempts) {
          break;
        }

        // Delay retry with simple incremental backoff
        await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
      }
    }

    return {
      success: false,
      data: null,
      error: lastError?.message || `La herramienta '${this.name}' falló tras ${maxAttempts} intentos.`,
    };
  }

  /**
   * Execute the actual tool logic. Must be overridden by subclasses.
   * @param {object} params - Tool-specific parameters
   * @param {object} context - { registry, user, bus }
   * @returns {Promise<{ success: boolean, data: any, error?: string }>}
   */
  async execute(_params, _context) {
    throw new Error(`Tool '${this.name}' must implement execute()`);
  }

  /** Brief description for the LLM tool-selection prompt. */
  getPromptDescription() {
    return `${this.name}: ${this.description}`;
  }

  /** Get execution metrics for this tool. */
  getMetrics() {
    const successRate = this.metrics.calls > 0 
      ? Math.round((this.metrics.successes / this.metrics.calls) * 100) 
      : 100;
    const avgDuration = this.metrics.calls > 0 
      ? Math.round(this.metrics.total_duration_ms / this.metrics.calls) 
      : 0;

    return {
      ...this.metrics,
      success_rate_percent: successRate,
      average_duration_ms: avgDuration,
    };
  }
}