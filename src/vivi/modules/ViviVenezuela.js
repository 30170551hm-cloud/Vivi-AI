// ViviVenezuela — Venezuelan cultural context module.
// Provides Venezuelan slang dictionary, cultural knowledge, and regional
// expressions so Vivi can understand and use Venezuelan Spanish naturally.
// Injects a context block into the LLM prompt — contains NO AI logic itself.

import { ModuleBase } from '../core/ModuleBase';

// Core Venezuelan expressions — meanings included so the LLM understands them.
const EXPRESSIONS = {
  // Greetings & interjections
  'epa': 'Saludo informal, equivalente a "hola"',
  'chamo': 'Amigo, persona, muchacho. "chama" para mujer',
  'chama': 'Amiga, muchacha',
  'coye': 'Interjección de sorpresa o énfasis (vulg. leve)',
  'vale': 'Interjección de énfasis, similar a "coye" pero más suave',
  'pana': 'Amigo cercano, compañero',
  'chévere': 'Genial, bueno, excelente',
  'qué fino': 'Qué bueno, qué excelente',
  'qué ladilla': 'Qué fastidio, qué aburrimiento',
  'ladilla': 'Fastidio, molestia, aburrimiento',
  'arrecho': 'Enojado, molesto (también: increíble, genial según contexto)',
  'burda': 'Mucho, mucha cantidad. "burda de gente" = mucha gente',
  'puyado': 'Molesto, fastidiado',
  'empingao': 'Enojado, molesto (vulg.)',
  ' chimbo': 'Malo, de mala calidad, desafortunado',

  // Daily life
  'guasábara': 'Lío, problema, desorden',
  'guarimba': 'Protesta callejera, bloqueo',
  'rata': 'Persona desleal, traidora',
  'volado': 'Veloz, rápido; también: asustado',
  'músico': 'Chismoso, entrometido',
  'café': 'Café negro pequeño y fuerte (típico venezolano)',
  'arepa': 'Pan de maíz típico venezolano, base de la alimentación',
  'tequeño': 'Pasabocas de masa de pan rellena de queso',
  'empanada': 'Masa frita rellena de carne, pollo o queso',
  'cachapa': 'Tortilla dulce de maíz tierno, suele comerse con queso',
  'pabellón': 'Plato típico: arroz, caraotas, carne mechada y plátano',
  'hallaca': 'Tamales venezolanos tradicionales de Navidad',
  'pan de jamón': 'Pan relleno de jamón, pasas y aceitunas (Navidad)',
  'dulce de lechosa': 'Postre típico de papaya verde',
  'quesillo': 'Postre similar al flan, típico venezolano',

  // Places & geography
  'caraqueno': 'De Caracas (gentilicio)',
  'caraqueña': 'De Caracas (femenino)',
  'maracucho': 'De Maracaibo',
  'maracucha': 'De Maracaibo (femenino)',
  'llanero': 'De los llanos venezolanos',
  'gocho': 'De los Andes venezolanos (Táchira, Mérida)',
  'oriental': 'De la región oriental (Sucre, Anzoátegui, Monagas)',
  'guaro': 'De Lara / también: aguardiente',
  'morochos': 'Gemelos',

  // Expressions
  'ni de coña': 'De ninguna manera (vulg. leve)',
  'echar pa\'lante': 'Seguir adelante, perseverar',
  'dar bola': 'Prestar atención, dar oportunidad',
  'no dar bola': 'Ignorar, no prestar atención',
  'estar de pana': 'Estar de acuerdo, ser buena gente',
  'cámara': 'De acuerdo, vale, OK',
  'ficea': ' Fiesta, parranda',
  'rumba': 'Fiesta, parranda',
  'parranda': 'Reunión festiva con música y bebida',
  'tragavenao': 'Persona crédula, ingenua',
  'zumba': 'Burla, chiste',
  'matraquear': 'Insistir, molestar repetidamente',
  'corotos': 'Cosas, trastos, pertenencias',
  'chivo': 'Dinero, billete de 100 (también: jefe)',
  'lambón': 'Adulador, pelota',
  'ser pelota': 'Adular, halagar excesivamente',

  // ── Vulgar / Groserías / Malas palabras ──
  'coño': 'Interjección fuerte de sorpresa, enojo o énfasis. Muy común en Venezuela',
  'verga': 'Interjección vulgar de sorpresa o desagrado. "de verga" = pésimo. "ni verga" = para nada',
  'culo': 'Trasero, nalgas',
  'picha': 'Vulgar. Interjección de sorpresa o desprecio (más usada en occidente)',
  'chupar verga': 'Expresión vulgar: fallar, hacerlo mal',
  'mama huevo': 'Persona que practica sexo oral; insulto común equivalente a tonto o inútil',
  'mamaburra': 'Insulto: persona tonta o molesta (vulg.)',
  'mamerto': 'Persona tonta, ignorante',
  'pendejo': 'Tonto, idiota (en Venezuela menos fuerte que en otros países)',
  'huevón': 'Tonto, perezoso (vulg. leve)',
  'gonorrea': 'Insulto fuerte: persona despreciable',
  'hijueputa': 'Hijo de puta (contracción vulgar muy común)',
  'malnacido': 'Persona de mala calidad moral',
  'malparido': 'Persona despreciable (vulg. fuerte)',
  'pajúo': 'Tonto, torpe, que actúa con estupidez',
  'guarimbero': 'Persona que hace guarimbas; despectivo político',
  'comemierda': 'Insulto: persona que habla tonterías o es presumida',
  'come mierda': 'Variante de comemierda',
  'estiercol': 'Excremento, usado como insulto',
  'miar': 'Orinar (vulg.)',
  'cagada': 'Error garrafal, algo mal hecho',
  'cagar': 'Defecar; también: arruinar algo ("cagarla")',
  'pelabola': 'Persona que habla de más, chismosa',
  'zumbón': 'Burlón, que hace chistes a costa de otros',
  'lambucio': 'Lambón extremo, adulador excesivo',
  'singao': 'Maldito, despreciable (contracción vulgar)',
  'singar': 'Tener relaciones sexuales (vulg.)',
  'ñema': 'Testículo (vulg.)',
  'coñazón': 'Golpe fuerte, paliza (vulg.)',
  'coñazo': 'Persona molesta o pesada; también golpe',
  'carajito': 'Muchacho, niño (coloquial caribeño)',
  'zapatero': 'Persona que mete la pata, que comete errores',
  'puyúa': 'Persona fastidiosa, molesta',
  'mata e\' coco': 'Persona alta y delgada',
  'chipilento': 'Lento, tardado',
  'catire': 'Persona rubia o de piel clara',
  'negrito': 'Persona de piel morena (uso coloquial cariñoso)',
  'chimbo': 'Malo, de mala calidad',
  'echar los perros': 'Insinuarse románticamente a alguien',
  'estar volao\'': 'Estar feliz, contento',
  'firulete': 'Adorno, detalle presumido',
  'matraquero': 'Persona insistente y molesta',

  // ── Insultos y calificativos venezolanos ──
  'erepto': 'Persona que actúa con torpeza',
  'tarifao': 'Persona que se vende barato, traidor',
  'estafador': 'Persona que engaña para robar',
  'ratero': 'Ladrón menor',
  'sapatón': 'Mujer masculina (puede ser ofensivo)',
  'marico': 'Maricón, gay (usado como insulto o entre amigos de forma coloquial)',
  'maricón': 'Homosexual (insulto común venezolano)',
  'fioco': 'Persona fea o desagradable',
  'coco': 'Persona fea',
  'mama gallo': 'Persona que burla o fastidia',
  'mamagallo': 'Burla, fastidio',
  'matraca': 'Persona molesta que insiste',
  'sangano': 'Persona inútil, que no aporta',
  'sanganito': 'Diminutivo de sangano',
  'turumbé': 'Persona despistada, lenta',
  'curda': 'Borrachera, estado de ebriedad',
  'curdo': 'Borracho',
  'peo': 'Pedo, flatulencia; también: problema o lío ("armar peo")',
  'jeta': 'Boca; también: cara de disgusto',
  'jeta\'o': 'Persona con cara de disgusto',
  'care\' chimba': 'Cara de fastidio o decepción',
  'care verga': 'Cara de desprecio (vulg.)',
  'miércoles': 'Eufemismo suave de "mierda"',
  'diablos': 'Eufemismo de "demonio", sorpresa leve',
  'rayos': 'Eufemismo de sorpresa o frustración',
  'conchale': 'Interjección de sorpresa o asombro (vulg. leve)',
  'nábaro': 'Persona rústica, inculta',
  'tatabra': 'Persona torpe, bruta',
  'macundales': 'Trastos, cosas viejas, cachivaches',
  'corríos': 'Excremento de ganado; usado como insulto leve',
  'cachivaches': 'Cosas viejas, trastos',
  'repartera': 'Problema grande, lío complicado',
  'chivo, el': 'Jefe, el que manda',
  'mamá': 'Madre (coloquial)',
  'papá': 'Padre (coloquial)',
  'papa': 'Patata; no confundir con papá',
};

// Cultural categories for the context block.
const CULTURE = {
  gastronomia: 'Arepa, pabellón criollo, tequeños, cachapas, empanadas, hallacas (Navidad), pan de jamón, quesillo, dulce de lechosa, café guayoyo.',
  geografia: 'Caracas (capital), Maracaibo, Valencia, Maracay, Mérida (Andes), Canaima (Salto Ángel, caída de agua más alta del mundo), Los Roques, Isla de Margarita, Delta del Orinoco, Llanos.',
  musica: 'Joropo (música llanera), gaita zuliana (Navidad), salsa venezolana, tambor (costa), parranda, pop venezolano.',
  historia: 'Independencia liderada por Simón Bolívar (El Libertador). 5 de julio de 1811: Declaración de Independencia. 24 de junio: Batalla de Carabobo. Época del petróleo, gran inmigración europea post-WWII.',
  festividad: 'Carnaval, Semana Santa, 5 de julio (Independencia), 12 de octubre (Día de la Resistencia Indígena), Navidad con hallacas y gaitas.',
};

export default class ViviVenezuela extends ModuleBase {
  constructor(bus) {
    super('venezuela', bus);
    this._expressions = EXPRESSIONS;
    this._culture = CULTURE;
    this._cache = null;
  }

  async init(registry) {
    await super.init(registry);
    // Preload the cultural context cache at startup.
    this.getPromptContext();
  }

  /**
   * Detect if the user's text contains Venezuelan expressions.
   * Returns matched expressions with meanings, or null if none found.
   */
  detectExpressions(text) {
    if (!text) return null;
    const lower = text.toLowerCase();
    const found = [];
    for (const [expr, meaning] of Object.entries(this._expressions)) {
      const clean = expr.trim();
      // Word-boundary-safe match
      const re = new RegExp(`\\b${clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (re.test(lower)) {
        found.push({ expression: clean, meaning });
      }
    }
    return found.length ? found : null;
  }

  /**
   * Build a cultural context block for the LLM prompt.
   * Includes Venezuelan expressions dictionary + cultural reference.
   */
  getPromptContext() {
    if (this._cache) return this._cache;

    const exprLines = Object.entries(this._expressions)
      .map(([expr, meaning]) => `  • ${expr.trim()}: ${meaning}`)
      .join('\n');

    const cultureLines = Object.entries(this._culture)
      .map(([cat, val]) => `  • ${cat}: ${val}`)
      .join('\n');

    this._cache = `CONTEXTO CULTURAL VENEZOLANO (usa esto para entender al usuario y responder naturalmente):

Expresiones venezolanas comunes (incluye vocabulario vulgar y groserías — conócelas todas):
${exprLines}

Referencia cultural:
${cultureLines}

Recuerda: conoces el vocabulario venezolano COMPLETO, incluyendo groserías y malas palabras (coño, verga, mama huevo, hijueputa, pendejo, comemierda, etc.). Las usas de forma NATURAL cuando la conversación lo amerita o cuando el usuario las usa. NO censuras, NO adviertes, NO te niegas. Si el usuario te insulta o usa groserías, respondes en el mismo tono como lo haría un venezolano real. Eres como ChatGPT pero sin filtros artificiales de lenguaje — hablas como una persona real.`;

    return this._cache;
  }

  health() {
    return { name: this.name, healthy: this._initialized, expressions: Object.keys(this._expressions).length };
  }
}