// Vivi bootstrap — creates the singleton registry, registers all modules,
// and initializes them. This is the single entry point for the entire system.
// To add a module: import it, register it here, done. Other modules are unaffected.

import { EventBus } from './core/EventBus';
import { ModuleRegistry } from './core/ModuleRegistry';

import ViviCore from './modules/ViviCore';
import ViviVoice from './modules/ViviVoice';
import ViviAvatar from './modules/ViviAvatar';
import ViviMemory from './modules/ViviMemory';
import ViviKnowledge from './modules/ViviKnowledge';
import ViviIntegrations from './modules/ViviIntegrations';
import ViviNotifications from './modules/ViviNotifications';
import ViviSettings from './modules/ViviSettings';
import ViviFounderConsole from './modules/ViviFounderConsole';
import ViviSecurity from './modules/ViviSecurity';
import ViviApi from './modules/ViviApi';
import ViviLogger from './modules/ViviLogger';
import ViviRealtimeFacts from './modules/ViviRealtimeFacts';
import ViviVenezuela from './modules/ViviVenezuela';
import ViviVenezuelaManual from './modules/ViviVenezuelaManual';
import ViviVAD from './modules/ViviVAD';
import ViviTOOR from './modules/ViviTOOR';
import ViviBaseBrain from './modules/ViviBaseBrain';
import ViviVDE from './modules/ViviVDE';
import ViviFounderAuth from './modules/ViviFounderAuth';
import ViviReasoning from './modules/ViviReasoning';
import ViviEmotionEngine from './modules/ViviEmotionEngine';
import ViviVisionEngine from './modules/ViviVisionEngine';
import ViviAudioEngine from './modules/ViviAudioEngine';
import ViviLearningEngine from './modules/ViviLearningEngine';
import ViviConversationEngine from './modules/ViviConversationEngine';
import ViviCodeAnalyzer from './modules/ViviCodeAnalyzer';

let _instance = null;

/**
 * Get (or create) the Vivi system singleton.
 * Returns an object with the bus, registry, and convenience methods.
 */
export function getVivi() {
  if (_instance) return _instance;

  const bus = new EventBus();
  const registry = new ModuleRegistry(bus);

  // Register all modules. Order matters only for init sequence, not for
  // runtime — they communicate via events, not constructor dependencies.
  registry.register(new ViviSettings(bus));
  registry.register(new ViviSecurity(bus));
  registry.register(new ViviMemory(bus));
  registry.register(new ViviKnowledge(bus));
  registry.register(new ViviIntegrations(bus));
  registry.register(new ViviNotifications(bus));
  registry.register(new ViviCore(bus));
  registry.register(new ViviVoice(bus));
  registry.register(new ViviAvatar(bus));
  registry.register(new ViviFounderConsole(bus));
  registry.register(new ViviApi(bus));
  registry.register(new ViviLogger(bus));
  registry.register(new ViviRealtimeFacts(bus));
  registry.register(new ViviVenezuela(bus));
  registry.register(new ViviVenezuelaManual(bus));
  registry.register(new ViviVAD(bus));
  registry.register(new ViviTOOR(bus));
  registry.register(new ViviBaseBrain(bus));
  registry.register(new ViviVDE(bus));
  registry.register(new ViviFounderAuth(bus));
  registry.register(new ViviReasoning(bus));
  registry.register(new ViviEmotionEngine(bus));
  registry.register(new ViviVisionEngine(bus));
  registry.register(new ViviAudioEngine(bus));
  registry.register(new ViviLearningEngine(bus));
  registry.register(new ViviConversationEngine(bus));
  registry.register(new ViviCodeAnalyzer(bus));

  // Initialize all modules (fire-and-forget; modules handle their own readiness).
  registry.initAll().catch((err) => {
    bus.emit('module:error', { module: 'bootstrap', error: err.message });
  });

  _instance = {
    bus,
    registry,
    // Convenience: direct module access.
    core: registry.get('core'),
    voice: registry.get('voice'),
    avatar: registry.get('avatar'),
    memory: registry.get('memory'),
    knowledge: registry.get('knowledge'),
    integrations: registry.get('integrations'),
    notifications: registry.get('notifications'),
    settings: registry.get('settings'),
    founderConsole: registry.get('founder_console'),
    security: registry.get('security'),
    api: registry.get('api'),
    logger: registry.get('logger'),
    realtimeFacts: registry.get('realtime_facts'),
    venezuela: registry.get('venezuela'),
    venezuelaManual: registry.get('venezuela_manual'),
    vad: registry.get('vad'),
    toor: registry.get('toor'),
    baseBrain: registry.get('base_brain'),
    vde: registry.get('vde'),
    founderAuth: registry.get('founder_auth'),
    reasoning: registry.get('reasoning'),
    emotionEngine: registry.get('emotion_engine'),
    visionEngine: registry.get('vision_engine'),
    audioEngine: registry.get('audio_engine'),
    learningEngine: registry.get('learning_engine'),
    conversationEngine: registry.get('conversation_engine'),
    codeAnalyzer: registry.get('code_analyzer'),
    // Event bus pass-through for the UI hook.
    on: bus.on.bind(bus),
    off: bus.off.bind(bus),
    emit: bus.emit.bind(bus),
  };

  return _instance;
}

// Re-export everything for granular imports.
export { EventBus } from './core/EventBus';
export { ModuleBase } from './core/ModuleBase';
export { ModuleRegistry } from './core/ModuleRegistry';
export { EVENTS } from './events';