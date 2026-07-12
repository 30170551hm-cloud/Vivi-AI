// ViviReasoning — Reasoning engine.
// Validates information before Vivi responds. Performs:
//   1. Analysis — decompose the user's input to understand intent.
//   2. Verification — for factual claims, cross-check via web search.
//   3. Planning — for complex tasks, break them into steps.
//
// This module does NOT generate Vivi's reply — it enriches the context
// that ViviCore uses to generate a better, verified reply.

import { ModuleBase } from '../core/ModuleBase';
import { EVENTS } from '../events';
import { AI } from '@/lib/aiProvider';

// Claims that should be verified before responding — numbers, dates, facts.
const VERIFIABLE_PATTERNS =
  /(cu[aá]nto[s]?|cu[aá]ndo|qu[ié]n\s+(es|fue)|qu[eé]\s+(es|significa)|d[oó]nde|capital\s+de|poblaci[oó]n|precio|cotizaci[oó]n|resultado|a[ñn]o|fecha|porcentaje|distancia|temperatura|altura|profundidad)/i;

export default class ViviReasoning extends ModuleBase {
  constructor(bus) {
    super('reasoning', bus);
  }

  async init(registry) {
    await super.init(registry);
  }

  /** Analyze input complexity and intent. Returns a structured analysis. */
  analyze(input) {
    if (!input) return { complexity: 'simple', intent: 'unknown', shouldVerify: false };

    const words = input.trim().split(/\s+/);
    const sentences = input.split(/[.!?]/).filter((s) => s.trim());
    const hasQuestion = input.includes('?');
    const isLong = words.length > 20 || sentences.length > 2;
    const shouldVerify = VERIFIABLE_PATTERNS.test(input);

    let intent = 'conversational';
    if (shouldVerify) intent = 'factual';
    else if (/^(crea|desarrolla|programa|implementa)/i.test(input)) intent = 'development';
    else if (/^(traduce|resum|explica|ense[ñn]a)/i.test(input)) intent = 'cognitive';
    else if (hasQuestion) intent = 'question';

    const complexity = isLong ? 'complex' : 'simple';

    return { complexity, intent, shouldVerify, wordCount: words.length };
  }

  /** Verify a factual claim using web search. Returns { verified, source } or null. */
  async verify(claim, lang = 'es-ES') {
    const analysis = this.analyze(claim);
    if (!analysis.shouldVerify) return null;

    this.emit(EVENTS.REASONING_ANALYZE, { claim, intent: analysis.intent });

    const result = await this.safe(() =>
      AI.InvokeLLM({
        prompt: `Verifica la siguiente afirmación o pregunta buscando en internet. Responde en ${lang}.

Afirmación/Pregunta: ${claim}

Devuelve un JSON con:
- verified: true si la información es verificable y correcta, false si no
- fact: el dato verificado en una frase corta
- source: de dónde lo obtuviste (ej: "Wikipedia", "BBC", "sitio oficial")
- confidence: alta/media/baja`,
        add_context_from_internet: true,
        model: 'gemini_3_flash',
        response_json_schema: {
          type: 'object',
          properties: {
            verified: { type: 'boolean' },
            fact: { type: 'string' },
            source: { type: 'string' },
            confidence: { type: 'string', enum: ['alta', 'media', 'baja'] },
          },
          required: ['verified', 'fact', 'source', 'confidence'],
        },
      }),
      null
    );

    if (result) {
      this.emit(EVENTS.REASONING_VERIFIED, { claim, ...result });
    }

    return result;
  }

  health() {
    return { name: this.name, healthy: this._initialized };
  }
}