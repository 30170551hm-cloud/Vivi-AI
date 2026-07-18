// MemoryTool — Manage the founder's permanent memory.
// CRUD operations on the Memory entity. Can store, retrieve, update, forget.

import { ToolBase } from './ToolBase';
import { FirestoreEntities } from '@/lib/firebaseEntities';

export default class MemoryTool extends ToolBase {
  constructor() {
    super({
      name: 'memory',
      description: 'Administra la memoria permanente: guardar, buscar, actualizar o eliminar recuerdos, proyectos, metas y tareas.',
      category: 'memory',
      permissions: ['memory:write'],
    });
  }

  async execute(params, _context) {
    const action = params?.action || 'search';

    switch (action) {
      case 'search': {
        const query = params?.query || '';
        const memories = await FirestoreEntities.Memory.list('-importance', 100);
        if (!query) return { success: true, data: { memories: memories.slice(0, 20) } };
        const q = query.toLowerCase();
        const filtered = memories.filter((m) =>
          `${m.key || ''} ${m.value || ''} ${(m.tags || []).join(' ')}`.toLowerCase().includes(q)
        );
        return { success: true, data: { memories: filtered.slice(0, 20) } };
      }
      case 'store': {
        const record = await FirestoreEntities.Memory.create({
          category: params.category || 'fact',
          key: params.key || '',
          value: params.value,
          importance: params.importance || 2,
          status: params.status || 'active',
          tags: params.tags || [],
        });
        return { success: true, data: { memory: record } };
      }
      case 'update': {
        const record = await FirestoreEntities.Memory.update(params.id, params.patch);
        return { success: true, data: { memory: record } };
      }
      case 'forget': {
        await FirestoreEntities.Memory.delete(params.id);
        return { success: true, data: { deleted: true } };
      }
      case 'list_by_category': {
        const memories = await FirestoreEntities.Memory.list('-importance', 200);
        const filtered = memories.filter((m) => m.category === params.category);
        return { success: true, data: { memories: filtered } };
      }
      default:
        return { success: false, data: null, error: `Acción desconocida: ${action}` };
    }
  }
}