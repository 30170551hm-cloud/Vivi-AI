// ProjectManagementTool — Manage projects, goals, and tasks stored as memories.
// Create, update status, list active items.

import { ToolBase } from './ToolBase';
import { FirestoreEntities } from '@/lib/firebaseEntities';

export default class ProjectManagementTool extends ToolBase {
  constructor() {
    super({
      name: 'project_management',
      description: 'Gestiona proyectos, metas y tareas: crear, cambiar estado, listar activos, marcar completados.',
      category: 'productivity',
      permissions: ['memory:write'],
    });
  }

  async execute(params, _context) {
    const action = params?.action;

    switch (action) {
      case 'create': {
        const type = params.type || 'task'; // project | goal | task
        const record = await FirestoreEntities.Memory.create({
          category: type,
          key: params.title || '',
          value: params.description || params.title || '',
          importance: params.importance || 3,
          status: 'active',
          tags: params.tags || [],
          timeline_date: params.due_date || undefined,
        });
        return { success: true, data: { item: record } };
      }
      case 'update_status': {
        const record = await FirestoreEntities.Memory.update(params.id, { status: params.status });
        return { success: true, data: { item: record } };
      }
      case 'list_active': {
        const memories = await FirestoreEntities.Memory.list('-importance', 200);
        const types = params.types || ['project', 'goal', 'task'];
        const active = memories.filter((m) =>
          types.includes(m.category) && (!m.status || m.status === 'active')
        );
        return { success: true, data: { items: active } };
      }
      default:
        return { success: false, data: null, error: `Acción desconocida: ${action}` };
    }
  }
}