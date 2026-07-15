// Central event name registry — single source of truth for inter-module communication.
// Modules never call each other directly for flow; they emit and listen to these events.

export const EVENTS = {
  // Voice module
  VOICE_LISTENING_START: 'voice:listening_start',
  VOICE_LISTENING_END: 'voice:listening_end',
  VOICE_INTERIM: 'voice:interim',
  VOICE_USER_SPEECH: 'voice:user_speech',
  VOICE_SPEAKING_START: 'voice:speaking_start',
  VOICE_SPEAKING_END: 'voice:speaking_end',
  VOICE_ERROR: 'voice:error',
  VOICE_DIAGNOSTIC: 'voice:diagnostic',
  VOICE_STATUS: 'voice:status',
  VOICE_VOICES_LOADED: 'voice:voices_loaded',
  VOICE_AUDIO_LEVEL: 'voice:audio_level',

  // VAD (Voice Activity Detection — barge-in)
  VAD_BARGE_IN: 'vad:barge_in',

  // Core (conversation brain)
  CORE_THINKING: 'core:thinking',
  CORE_REPLY: 'core:reply',
  CORE_ERROR: 'core:error',

  // Avatar (pure visual state — never contains logic)
  AVATAR_STATE_CHANGE: 'avatar:state_change',
  AVATAR_GESTURE: 'avatar:gesture',
  AVATAR_EMOTION: 'avatar:emotion',

  // Memory
  MEMORY_STORED: 'memory:stored',
  MEMORY_RECALLED: 'memory:recalled',

  // Knowledge
  KNOWLEDGE_SEARCH: 'knowledge:search',
  KNOWLEDGE_RESULT: 'knowledge:result',

  // Settings
  SETTINGS_UPDATED: 'settings:updated',

  // Notifications
  NOTIFICATION_SHOW: 'notification:show',

  // Analytics
  ANALYTICS_TRACK: 'analytics:track',

  // Security
  SECURITY_ACCESS_DENIED: 'security:access_denied',

  // Module lifecycle
  MODULE_ERROR: 'module:error',
  MODULE_READY: 'module:ready',

  // UI bridge
  UI_CAPTION: 'ui:caption',

  // Logger
  LOG_ADDED: 'log:added',
  LOG_CLEARED: 'log:cleared',

  // Founder recognition
  FOUNDER_RECOGNIZED: 'founder:recognized',
  FOUNDER_MEMORY_RESTORED: 'founder:memory_restored',
  FOUNDER_GREETING: 'founder:greeting',

  // Reasoning engine
  REASONING_ANALYZE: 'reasoning:analyze',
  REASONING_VERIFIED: 'reasoning:verified',

  // Emotion engine
  EMOTION_CHANGE: 'emotion:change',

  // Vision engine
  VISION_ANALYZE: 'vision:analyze',
  VISION_RESULT: 'vision:result',

  // Audio engine
  AUDIO_ANALYZE: 'audio:analyze',

  // Learning engine
  LEARN_STORED: 'learn:stored',

  // Conversation engine
  CONVERSATION_TOPIC: 'conversation:topic',
  CONVERSATION_CONTEXT: 'conversation:context',

  // VDE activity (real-time file operations)
  VDE_ACTIVITY: 'vde:activity',

  // Code Analyzer (self-analysis via GitHub)
  CODE_ANALYSIS_START: 'code_analyzer:start',
  CODE_ANALYSIS_FILE_RESULT: 'code_analyzer:file_result',
  CODE_ANALYSIS_COMPLETE: 'code_analyzer:complete',
  CODE_ANALYSIS_ERROR: 'code_analyzer:error',

  // Network diagnostics
  NETWORK_STATUS: 'network:status',
};