// SystemDiagnosticTool — Diagnoses the health of all Vivi modules.
// Detects errors, bottlenecks, and reports system status.

import { ToolBase } from './ToolBase';

export default class SystemDiagnosticTool extends ToolBase {
  constructor() {
    super({
      name: 'system_diagnostic',
      description: 'Diagnostica el estado del sistema: salud de módulos, errores detectados, cuellos de botella y rendimiento.',
      category: 'system',
      permissions: ['system:read'],
      requiresFounder: true,
    });
  }

  async execute(_params, context) {
    const registry = context?.registry;
    if (!registry) return { success: false, data: null, error: 'Sin registro de módulos' };

    const modules = registry.getAll();
    const healths = [];
    const errors = [];
    const warnings = [];

    for (const mod of modules) {
      try {
        const health = typeof mod.health === 'function' ? mod.health() : { name: mod.name, healthy: mod._initialized };
        healths.push(health);
        if (health.healthy === false) errors.push(`${mod.name}: unhealthy`);
        if (health.warnings?.length) warnings.push(...health.warnings);
      } catch (e) {
        errors.push(`${mod.name}: ${e.message}`);
      }
    }

    return {
      success: true,
      data: {
        totalModules: modules.length,
        healthy: healths.filter((h) => h.healthy !== false).length,
        errors,
        warnings,
        modules: healths.map((h) => ({ name: h.name, healthy: h.healthy })),
      },
    };
  }
}