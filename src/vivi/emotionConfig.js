// EmotionEngine — shared emotion definitions for voice + avatar.
//
// The LLM classifies the emotion of each reply. That emotion flows through
// the AVATAR_EMOTION event and is consumed by:
//   - ViviVoice: adjusts pitch / rate / volume per emotion
//   - ViviAvatar: changes aura color + shows an expression indicator
//
// Color palette per Vivi AI character sheet:
//   Primary Purple #8A4FFF · Deep Purple #5E35B1 · Cyan #00E5FF

export const EMOTIONS = [
  'neutral',
  'feliz',
  'sorprendida',
  'preocupada',
  'triste',
  'enojada',
  'curiosa',
  'divertida',
  'concentrada',
  'relajada',
  'segura',
  'empatica',
  'avergonzada',
  'cansada',
];

// Voice parameters per emotion — applied on top of the user's base config.
// rate: 0.1 (slow) → 2.0 (fast). Natural conversational ~0.82.
// pitch: 0 (low) → 2 (high), normal = 1.0
// volumeMod: multiplier on base volume (0→1)
// pauseMs: inter-sentence pause (breath) in milliseconds
// breathMs: initial breath before speaking
// ⚠️ VOICE IDENTITY IS FIXED — all emotions use IDENTICAL voice parameters.
// The voice (pitch, rate, volume) NEVER changes based on emotion.
// Only natural pauses (pauseMs, breathMs) vary slightly for conversational rhythm.
// This ensures Vivi always sounds like the SAME person — Paulina.
export const EMOTION_VOICE = {
  neutral:       { rate: 0.85, pitch: 1.0, volumeMod: 1.0, pauseMs: 80, breathMs: 0 },
  feliz:         { rate: 0.85, pitch: 1.0, volumeMod: 1.0, pauseMs: 60, breathMs: 0 },
  sorprendida:   { rate: 0.85, pitch: 1.0, volumeMod: 1.0, pauseMs: 50, breathMs: 0 },
  preocupada:    { rate: 0.85, pitch: 1.0, volumeMod: 1.0, pauseMs: 100, breathMs: 0 },
  triste:        { rate: 0.85, pitch: 1.0, volumeMod: 1.0, pauseMs: 120, breathMs: 0 },
  enojada:       { rate: 0.85, pitch: 1.0, volumeMod: 1.0, pauseMs: 60, breathMs: 0 },
  curiosa:       { rate: 0.85, pitch: 1.0, volumeMod: 1.0, pauseMs: 70, breathMs: 0 },
  divertida:     { rate: 0.85, pitch: 1.0, volumeMod: 1.0, pauseMs: 60, breathMs: 0 },
  concentrada:   { rate: 0.85, pitch: 1.0, volumeMod: 1.0, pauseMs: 90, breathMs: 0 },
  relajada:      { rate: 0.82, pitch: 1.0, volumeMod: 0.95, pauseMs: 100, breathMs: 0 },
  segura:        { rate: 0.87, pitch: 1.0, volumeMod: 1.0, pauseMs: 70, breathMs: 0 },
  empatica:      { rate: 0.83, pitch: 1.0, volumeMod: 0.95, pauseMs: 100, breathMs: 0 },
  avergonzada:   { rate: 0.84, pitch: 1.0, volumeMod: 0.9, pauseMs: 90, breathMs: 0 },
  cansada:       { rate: 0.80, pitch: 1.0, volumeMod: 0.85, pauseMs: 120, breathMs: 0 },
};

// Aura color per emotion — overlayed on the avatar.
// Uses the Vivi AI palette: Purple #8A4FFF, Deep Purple #5E35B1, Cyan #00E5FF
export const EMOTION_AURA = {
  neutral:       'rgba(138,79,255,0.22)',
  feliz:         'rgba(0,229,255,0.38)',
  sorprendida:   'rgba(0,229,255,0.42)',
  preocupada:    'rgba(94,53,177,0.36)',
  triste:        'rgba(100,116,139,0.32)',
  enojada:       'rgba(239,68,68,0.42)',
  curiosa:       'rgba(138,79,255,0.38)',
  divertida:     'rgba(0,229,255,0.42)',
  concentrada:   'rgba(94,53,177,0.40)',
  relajada:      'rgba(139,148,223,0.32)',
  segura:        'rgba(138,79,255,0.40)',
  empatica:      'rgba(0,229,255,0.34)',
  avergonzada:   'rgba(244,114,182,0.36)',
  cansada:       'rgba(100,116,139,0.28)',
};

// Expression indicator shown above the avatar when emotion is active.
// Matches the 6 expression variants from the character sheet.
export const EMOTION_EMOJI = {
  neutral:       null,
  feliz:         '😊',
  sorprendida:   '😮',
  preocupada:    '😟',
  triste:        '😢',
  enojada:       '😤',
  curiosa:       '🤔',
  divertida:     '😄',
  concentrada:   '🎯',
  relajada:      '😌',
  segura:        '😎',
  empatica:      '❤️',
  avergonzada:   '😳',
  cansada:       '😴',
};

// Label shown in the badge — matches character sheet expression names.
export const EMOTION_LABEL = {
  neutral:       '',
  feliz:         'Sonrisa',
  sorprendida:   'Sorpresa',
  preocupada:    'Preocupada',
  triste:        'Triste',
  enojada:       'Molesta',
  curiosa:       'Pensando',
  divertida:     'Feliz',
  concentrada:   'Concentrada',
  relajada:      'Relajada',
  segura:        'Segura',
  empatica:      'Empática',
  avergonzada:   'Avergonzada',
  cansada:       'Cansada',
};

// No personality-based gesture overrides — Vivi's avatar motion is driven
// only by her conversational state (idle, listening, thinking, speaking),
// never by personality modes. This keeps her visual identity consistent.

export function isValidEmotion(e) {
  return EMOTIONS.includes(e);
}

export function normalizeEmotion(e) {
  return isValidEmotion(e) ? e : 'neutral';
}