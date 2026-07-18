// FileManagementTool — Upload, manage, and extract data from files.
// Uses Base44's UploadFile and ExtractDataFromUploadedFile integrations.

import { ToolBase } from './ToolBase';
import { UploadFile } from '@/lib/firebaseStorageAdapter';
import { CoreIntegrations } from '@/lib/llmProviders';

export default class FileManagementTool extends ToolBase {
  constructor() {
    super({
      name: 'file_management',
      description: 'Gestiona archivos: subir, extraer datos de CSV/Excel/PDF/JSON, y procesar documentos.',
      category: 'files',
      permissions: ['files:write'],
    });
  }

  async execute(params, _context) {
    const action = params?.action;

    switch (action) {
      case 'upload': {
        if (!params.file) return { success: false, data: null, error: 'Archivo requerido' };
        const result = await UploadFile({ file: params.file });
        return { success: true, data: { file_url: result.file_url } };
      }
      case 'extract': {
        if (!params.file_url || !params.json_schema) {
          return { success: false, data: null, error: 'file_url y json_schema requeridos' };
        }
        const result = await CoreIntegrations.InvokeLLM({
          prompt: 'Extrae los datos estructurados del siguiente archivo según el esquema JSON proporcionado.',
          file_urls: [params.file_url],
          response_json_schema: params.json_schema,
        });
        return { success: true, data: result };
      }
      default:
        return { success: false, data: null, error: `Acción desconocida: ${action}` };
    }
  }
}