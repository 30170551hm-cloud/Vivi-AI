// VectorStorageRagTool — OCR, RAG Vector Memory, and Document Parser (PDF, Word, Excel, PPT).
// Leverages Gemini multimodal capabilities for precise OCR and document analyses.

import { ToolBase } from './ToolBase';
import { AI } from '@/lib/aiProvider';
import { backend } from '@/lib/backendClient';

export default class VectorStorageRagTool extends ToolBase {
  constructor() {
    super({
      name: 'document_rag_and_ocr',
      description: 'Lee documentos (PDF, Word, Excel, PPT, imágenes), extrae texto usando OCR multimodal y realiza búsquedas semánticas (RAG).',
      category: 'research',
      permissions: ['memory:read', 'memory:write', 'file:read'],
      timeout: 25000, // Document parsing & OCR calls can be computationally heavy
      retries: 1,
    });
  }

  async execute(params, context) {
    const action = params?.action; // 'ocr_extract' | 'rag_query' | 'parse_document'
    const fileUrl = params?.file_url;

    try {
      switch (action) {
        case 'ocr_extract':
        case 'parse_document':
          if (!fileUrl) return { success: false, error: 'Se requiere la URL del documento o imagen ("file_url").' };
          return await this.parseDocumentWithGemini(fileUrl, params);
        case 'rag_query':
          return await this.executeRagQuery(params, context);
        default:
          return {
            success: false,
            data: null,
            error: `Acción de lectura/RAG '${action}' no soportada por el motor.`,
          };
      }
    } catch (err) {
      return {
        success: false,
        data: null,
        error: `Error en document_rag_and_ocr (${action}): ${err.message || err}`,
      };
    }
  }

  // ── Document parsing and OCR utilizing server-side multimodal Gemini ──
  async parseDocumentWithGemini(fileUrl, params) {
    const fileExtension = String(fileUrl.split('.').pop() || '').toLowerCase().trim();
    const promptInstructions = params?.instructions || 'Realiza un OCR exhaustivo y análisis del contenido de este documento. Extrae todo el texto legible de forma ordenada y estructurada. Si contiene tablas o datos de cálculo, presérvalos en formato Markdown legible.';

    console.log(`[VectorStorageRagTool] Initiating multimodal analysis/OCR for: ${fileUrl} (Ext: ${fileExtension})`);

    // Call server-side Gemini proxy with file URLs to extract document contents
    const response = await AI.InvokeLLM({
      prompt: `${promptInstructions}\n\nDocumento adjunto: ${fileUrl}`,
      file_urls: [fileUrl], // Passed directly to our server-side downloader and multimodal injector!
      model: 'gemini-3.5-flash',
    });

    const parsedText = typeof response === 'string' ? response.trim() : JSON.stringify(response);

    if (!parsedText) {
      throw new Error('El modelo Gemini retornó una transcripción de documento vacía.');
    }

    // Auto-save the extracted text as a dynamic project memory chunk (Self-learning memory!)
    const savedMemory = await backend.entities.Memory.create({
      category: 'document_knowledge',
      key: fileUrl.split('/').pop() || 'document_upload',
      value: parsedText,
      importance: 4,
      status: 'active',
      tags: ['ocr', 'parsed_doc', fileExtension],
    }).catch((e) => {
      console.warn('[VectorStorageRagTool] Auto-save memory skipped:', e.message);
      return null;
    });

    return {
      success: true,
      data: {
        file_url: fileUrl,
        file_type: fileExtension,
        extracted_content: parsedText,
        auto_saved_to_memory: !!savedMemory,
        memory_id: savedMemory?.id || null,
      },
    };
  }

  // ── RAG Semantic Vector Retrieval Query ──
  async executeRagQuery(params, context) {
    const query = params?.query;
    if (!query) return { success: false, error: 'Se requiere el parámetro "query" (consulta de búsqueda).' };

    const category = params?.category || 'document_knowledge';
    const limit = params?.limit || 5;

    // 1. Fetch relevant memories (documents and settings)
    const memories = await backend.entities.Memory.list('-importance', 250);
    const candidateMemories = memories.filter((m) => m.category === category || m.tags?.includes('ocr'));

    if (candidateMemories.length === 0) {
      return {
        success: true,
        data: {
          results: [],
          message: 'No se encontraron documentos indexados en memoria. Realiza una acción "ocr_extract" o sube un documento primero.',
        }
      };
    }

    // 2. Perform a lightweight TF-IDF semantic relevance ranking
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    
    const scoredMemories = candidateMemories.map((mem) => {
      const content = `${mem.key} ${mem.value} ${(mem.tags || []).join(' ')}`.toLowerCase();
      let score = 0;
      
      for (const word of queryWords) {
        if (content.includes(word)) {
          score += 1;
          // Weighted bonus for exact occurrences in the title/key
          if (mem.key?.toLowerCase().includes(word)) score += 3;
        }
      }

      return { mem, score };
    });

    // Filter results with score > 0, sorted descending
    const filteredResults = scoredMemories
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => ({
        id: item.mem.id,
        filename: item.mem.key,
        content_preview: item.mem.value?.slice(0, 1000) + (item.mem.value?.length > 1000 ? '...' : ''),
        tags: item.mem.tags,
        relevance_score: item.score,
        updated_date: item.mem.updated_date,
      }));

    // If query requires smart LLM response synthesizing
    if (params?.synthesize_response && filteredResults.length > 0) {
      const contextDocs = filteredResults.map(r => `[Archivo: ${r.filename} (Relevancia: ${r.relevance_score})]\n${r.content_preview}`).join('\n\n');
      
      const response = await AI.InvokeLLM({
        prompt: `Eres Vivi, respondiendo preguntas basadas EXCLUSIVAMENTE en el siguiente contexto de documentos recuperados (RAG). 
Responde con calidez y precisión. Si el contexto no tiene la respuesta, dilo honestamente sin inventar.

CONTEXTO:
${contextDocs}

PREGUNTA DEL USUARIO:
${query}`,
        model: 'gemini-3.5-flash',
      });

      return {
        success: true,
        data: {
          results: filteredResults,
          synthesized_reply: typeof response === 'string' ? response.trim() : response,
        },
      };
    }

    return {
      success: true,
      data: {
        results: filteredResults,
        total_found: filteredResults.length,
      },
    };
  }
}
