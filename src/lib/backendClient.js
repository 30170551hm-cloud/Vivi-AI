import { authClient } from './authClient';
import { FirestoreEntities } from './firebaseEntities';
import { UploadFile } from './firebaseStorageAdapter';
import { CoreIntegrations } from './llmProviders';

function isTextLikeFile(contentType = '', fileUrl = '') {
  const type = String(contentType).toLowerCase();
  const url = String(fileUrl).toLowerCase();
  return (
    type.includes('text/') ||
    type.includes('application/json') ||
    type.includes('application/xml') ||
    type.includes('application/javascript') ||
    url.endsWith('.txt') ||
    url.endsWith('.md') ||
    url.endsWith('.json') ||
    url.endsWith('.csv') ||
    url.endsWith('.xml') ||
    url.endsWith('.html')
  );
}

async function ExtractDataFromUploadedFile({ file_url, json_schema } = {}) {
  if (!file_url) throw new Error('Falta file_url');
  if (!json_schema) throw new Error('Falta json_schema');

  const response = await fetch(file_url);
  if (!response.ok) {
    throw new Error(`No se pudo leer el archivo (${response.status})`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!isTextLikeFile(contentType, file_url)) {
    throw new Error('Formato de archivo no soportado para extracción directa; usa archivos de texto/JSON/CSV/MD.');
  }

  const text = (await response.text()).slice(0, 15000);
  if (!text.trim()) throw new Error('El archivo está vacío o no contiene texto legible.');

  return CoreIntegrations.InvokeLLM({
    prompt: `Extrae la información requerida del siguiente contenido y responde ESTRICTAMENTE con el JSON del schema proporcionado.\n\nContenido:\n${text}`,
    response_json_schema: json_schema,
  });
}

export const backend = {
  auth: authClient,
  entities: FirestoreEntities,
  integrations: {
    Core: {
      UploadFile,
      InvokeLLM: CoreIntegrations.InvokeLLM,
      GenerateImage: CoreIntegrations.GenerateImage,
      GenerateSpeech: CoreIntegrations.GenerateSpeech,
      ExtractDataFromUploadedFile,
    },
  },
};
