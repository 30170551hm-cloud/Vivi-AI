// diagnosticsStore.js — Centralized real-time diagnostics tracking for Vivi AI.
// Tracks all steps: Micrófono → STT → Conversation Manager → AI Service → Gemini → Memory → Voice → Avatar

class DiagnosticsStore {
  constructor() {
    this.subscribers = new Set();
    
    // Initial states for each step in the chain
    this.steps = {
      mic: { label: 'Micrófono', status: 'idle', details: 'No iniciado' },
      stt: { label: 'Speech-to-Text', status: 'idle', details: 'Esperando activación' },
      core: { label: 'Conversation Manager', status: 'idle', details: 'Listo para procesar' },
      ai: { label: 'AI Service', status: 'idle', details: 'Listo para recibir peticiones' },
      gemini: { label: 'Gemini', status: 'idle', details: 'Esperando llamada' },
      memory: { label: 'Memory', status: 'idle', details: 'Conectada a Firestore' },
      voice: { label: 'Voice', status: 'idle', details: 'Sintetizador listo' },
      avatar: { label: 'Avatar', status: 'idle', details: 'Renderizado en reposo' }
    };

    // Detailed metrics of the last Gemini call
    this.geminiCall = {
      apiKeyStatus: 'Desconocido',
      sdk: 'REST Fetch via aiProvider',
      model: 'Ninguno',
      endpoint: 'Ninguno',
      httpCode: '-',
      responseTime: '-',
      prompt: '',
      responseBody: '',
      errorMessage: '',
      stackTrace: '',
      fileFunc: '-'
    };

    this.geminiCalls = [];
  }

  getSnapshot() {
    return {
      steps: this.steps,
      geminiCall: this.geminiCall,
      geminiCalls: this.geminiCalls,
      credentials: {
        frontendKey: import.meta.env?.VITE_GEMINI_API_KEY || '',
        frontendModel: import.meta.env?.VITE_GEMINI_MODEL || 'gemini-3.5-flash'
      }
    };
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  notify() {
    const snapshot = this.getSnapshot();
    this.subscribers.forEach(cb => cb(snapshot));
  }

  updateStep(stepId, status, details = '') {
    if (this.steps[stepId]) {
      this.steps[stepId] = { ...this.steps[stepId], status, message: details, timestamp: Date.now() };
      this.notify();
    }
  }

  recordGeminiCall({
    apiKey,
    sdk = 'REST Fetch via aiProvider',
    model,
    endpoint,
    httpCode,
    responseTime,
    prompt,
    responseBody,
    errorMessage = '',
    stackTrace = '',
    fileFunc = '-'
  }) {
    // Hide api key credentials safely
    let keyStatus = 'Faltante';
    if (apiKey) {
      keyStatus = `Presente (${apiKey.substring(0, 10)}... [Oculta - ${apiKey.length} chars])`;
    }

    const callDetails = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: Date.now(),
      apiKeyStatus: keyStatus,
      sdk,
      model: model || '-',
      endpoint: endpoint || '-',
      httpCode: httpCode !== undefined ? Number(httpCode) : 200,
      responseTime: responseTime !== undefined ? Number(responseTime) : 0,
      prompt: prompt || '',
      responseBody: responseBody || '',
      errorMessage: errorMessage || '',
      stackTrace: stackTrace || '',
      fileFunc
    };

    this.geminiCall = callDetails;
    this.geminiCalls = [callDetails, ...this.geminiCalls].slice(0, 50);
    this.notify();
  }
}

export const diagnosticsStore = new DiagnosticsStore();
window.__vivi_diagnostics = diagnosticsStore; // expose for debug
