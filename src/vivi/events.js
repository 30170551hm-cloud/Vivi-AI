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
  VOICE_CONVERSATION_STATE: 'voice:conversation_state',

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
  UI_NAVIGATE: 'ui:navigate',

  // Logger
  LOG_ADDED: 'log:added',
  LOG_CLEARED: 'log:cleared',

  // LLM Gateway (multi-provider fallback chain)
  LLM_PROVIDER_USED: 'llm:provider_used',
  LLM_PROVIDER_FAILED: 'llm:provider_failed',

  // Firebase (external memory store)
  FIREBASE_CONNECTED: 'firebase:connected',
  FIREBASE_DISCONNECTED: 'firebase:disconnected',

  // Vercel (deployment management)
  VERCEL_DEPLOY_TRIGGERED: 'vercel:deploy_triggered',
  VERCEL_DEPLOY_STATUS: 'vercel:deploy_status',

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

  // Vision capture (real-time camera → backend → actions pipeline)
  VISION_CAPTURE_START: 'vision:capture_start',
  VISION_CAPTURE_STOP: 'vision:capture_stop',
  VISION_FRAME_CAPTURED: 'vision:frame_captured',
  VISION_FRAME_PROCESSING: 'vision:frame_processing',
  VISION_ACTION: 'vision:action',
  VISION_OVERLAY: 'vision:overlay',
  VISION_ERROR: 'vision:error',

  // Audio engine
  AUDIO_ANALYZE: 'audio:analyze',

  // Learning engine
  LEARN_STORED: 'learn:stored',

  // Conversation engine
  CONVERSATION_TOPIC: 'conversation:topic',
  CONVERSATION_CONTEXT: 'conversation:context',

  // VDE activity (real-time file operations)
  VDE_ACTIVITY: 'vde:activity',

  // University (Internal University of Vivi — knowledge faculties)
  UNIVERSITY_CONSULT: 'university:consult',
  UNIVERSITY_RESULT: 'university:result',
  UNIVERSITY_LEARNED: 'university:learned',

  // Dev Engine (Software Engineering Agent)
  DEV_CODE_ANALYZED: 'dev:code_analyzed',
  DEV_EDIT_SUGGESTED: 'dev:edit_suggested',
  DEV_ARCHITECTURE_MAPPED: 'dev:architecture_mapped',
  DEV_REPO_SYNCED: 'dev:repo_synced',
  DEV_COMMIT_CREATED: 'dev:commit_created',
  DEV_BRANCH_CREATED: 'dev:branch_created',
  DEV_PR_CREATED: 'dev:pr_created',
  DEV_TEST_RESULT: 'dev:test_result',
  DEV_DEPLOY_STATUS: 'dev:deploy_status',
  DEV_DOC_GENERATED: 'dev:doc_generated',
  DEV_PLAN_CREATED: 'dev:plan_created',
  DEV_SECURITY_AUDIT: 'dev:security_audit',
  DEV_TERMINAL_COMMAND: 'dev:terminal_command',
  DEV_ACTIVITY: 'dev:activity',
  DEV_APPROVAL_REQUIRED: 'dev:approval_required',
  DEV_CERTIFICATION_START: 'dev:certification_start',
  DEV_CERTIFICATION_RESULT: 'dev:certification_result',
  DEV_KNOWLEDGE_GRAPH_UPDATED: 'dev:knowledge_graph_updated',
  DEV_ENGINEERING_TASK_START: 'dev:engineering_task_start',
  DEV_ENGINEERING_TASK_COMPLETE: 'dev:engineering_task_complete',
  DEV_REPO_INDEXED: 'dev:repo_indexed',

  // Capability Core
  CAPABILITY_REGISTERED: 'capability:registered',
  CAPABILITY_UNLOADED: 'capability:unloaded',
  CAPABILITY_UPDATED: 'capability:updated',
  CAPABILITY_CONFLICT: 'capability:conflict',

  // Permission Manager
  PERMISSION_CHECK: 'permission:check',
  PERMISSION_GRANTED: 'permission:granted',
  PERMISSION_DENIED: 'permission:denied',
  PERMISSION_APPROVAL_REQUIRED: 'permission:approval_required',
  FOUNDER_MODE_TOGGLED: 'founder:mode_toggled',
  ACTION_LOGGED: 'action:logged',

  // Self Engineering
  SELF_ENGINEERING_START: 'self_engineering:start',
  SELF_ENGINEERING_PROGRESS: 'self_engineering:progress',
  SELF_ENGINEERING_COMPLETE: 'self_engineering:complete',
  SELF_ENGINEERING_REVERTED: 'self_engineering:reverted',
  BACKUP_CREATED: 'backup:created',

  // Permanent Memory
  PERMANENT_MEMORY_STORED: 'permanent_memory:stored',
  PERMANENT_MEMORY_RECALLED: 'permanent_memory:recalled',
  PERMANENT_MEMORY_SUMMARIZED: 'permanent_memory:summarized',

  // Auto Learning
  AUTO_LEARN_COMPLETE: 'auto_learn:complete',

  // Self Evolution
  EVOLUTION_SCAN_START: 'evolution:scan_start',
  EVOLUTION_SCAN_COMPLETE: 'evolution:scan_complete',
  EVOLUTION_LIMITATION_DETECTED: 'evolution:limitation_detected',
  EVOLUTION_IMPROVEMENT_PROPOSED: 'evolution:improvement_proposed',
  EVOLUTION_IMPROVEMENT_APPLIED: 'evolution:improvement_applied',
  EVOLUTION_ARCHITECTURE_REORGANIZED: 'evolution:architecture_reorganized',

  // Mission Control
  MISSION_CONTROL_STATUS: 'mission_control:status',

  // Operational state (what Vivi is DOING — separate from emotions)
  OPERATION_STATE: 'operation:state',

  // Voice commands
  VOICE_COMMAND_DETECTED: 'voice_command:detected',

  // Global kill-switch (covers ALL modules: finance, file ops, sandbox, patches)
  KILL_SWITCH_ACTIVATED: 'kill_switch:activated',
  KILL_SWITCH_DEACTIVATED: 'kill_switch:deactivated',

  // Finance module (banking integrations, transfers, ledger)
  FINANCE_BALANCE_READ: 'finance:balance_read',
  FINANCE_TRANSFER_REQUESTED: 'finance:transfer_requested',
  FINANCE_TRANSFER_APPROVAL_REQUIRED: 'finance:transfer_approval_required',
  FINANCE_TRANSFER_APPROVED: 'finance:transfer_approved',
  FINANCE_TRANSFER_EXECUTED: 'finance:transfer_executed',
  FINANCE_TRANSFER_REJECTED: 'finance:transfer_rejected',
  FINANCE_DAILY_LIMIT_EXCEEDED: 'finance:daily_limit_exceeded',
  FINANCE_WHITELIST_VIOLATION: 'finance:whitelist_violation',

  // Developer Agent (independent software development assistant — deactivated by default)
  DEV_AGENT_ACTIVATED: 'dev_agent:activated',
  DEV_AGENT_DEACTIVATED: 'dev_agent:deactivated',
  DEV_AGENT_EVIDENCE: 'dev_agent:evidence',

  // Tool Manager
  DEV_TOOL_SELECTED: 'dev_tool:selected',
  DEV_TOOL_EXECUTED: 'dev_tool:executed',
  DEV_TOOL_UNAVAILABLE: 'dev_tool:unavailable',

  // Audit Engine
  DEV_AUDIT_START: 'dev_audit:start',
  DEV_AUDIT_PROGRESS: 'dev_audit:progress',
  DEV_AUDIT_COMPLETE: 'dev_audit:complete',

  // Work Cycle
  DEV_WORKCYCLE_START: 'dev_workcycle:start',
  DEV_WORKCYCLE_STEP: 'dev_workcycle:step',
  DEV_WORKCYCLE_COMPLETE: 'dev_workcycle:complete',

  // Security Guard
  DEV_SECURITY_BLOCKED: 'dev_security:blocked',

  // Code Sandbox
  SANDBOX_EXECUTION_START: 'sandbox:execution_start',
  SANDBOX_EXECUTION_COMPLETE: 'sandbox:execution_complete',
  SANDBOX_EXECUTION_ERROR: 'sandbox:execution_error',

  // Vector Memory
  VECTOR_MEMORY_STORED: 'vector_memory:stored',
  VECTOR_MEMORY_SEARCH: 'vector_memory:search',
  VECTOR_MEMORY_RESULTS: 'vector_memory:results',

  // API Gateway
  API_GATEWAY_CALL: 'api_gateway:call',
  API_GATEWAY_RESPONSE: 'api_gateway:response',

  // Web Scraper
  WEB_SCRAPER_START: 'web_scraper:start',
  WEB_SCRAPER_COMPLETE: 'web_scraper:complete',

  // Multimodal
  MULTIMODAL_VISION_START: 'multimodal:vision_start',
  MULTIMODAL_VISION_COMPLETE: 'multimodal:vision_complete',
  MULTIMODAL_AUDIO_START: 'multimodal:audio_start',
  MULTIMODAL_AUDIO_COMPLETE: 'multimodal:audio_complete',

  // Integration Manager (automatic external tool integration)
  INTEGRATION_TOOL_DETECTED: 'integration:tool_detected',
  INTEGRATION_AUTH_REQUIRED: 'integration:auth_required',
  INTEGRATION_AUTH_APPROVED: 'integration:auth_approved',
  INTEGRATION_AUTH_REJECTED: 'integration:auth_rejected',
  INTEGRATION_CONNECTED: 'integration:connected',
  INTEGRATION_DISCONNECTED: 'integration:disconnected',
  INTEGRATION_VERIFIED: 'integration:verified',
  INTEGRATION_EXPIRED: 'integration:expired',
  INTEGRATION_ERROR: 'integration:error',
  INTEGRATION_OAUTH_URL: 'integration:oauth_url',
  INTEGRATION_NEEDS_CONNECTOR: 'integration:needs_connector',

  // Patch Workflow (safe change proposal / apply / artifact delivery)
  PATCH_PROPOSED: 'patch:proposed',
  PATCH_PR_CREATED: 'patch:pr_created',
  PATCH_APPROVAL_REQUIRED: 'patch:approval_required',
  PATCH_APPROVED: 'patch:approved',
  PATCH_APPLIED: 'patch:applied',
  PATCH_REJECTED: 'patch:rejected',
  PATCH_KILL_SWITCH: 'patch:kill_switch',
  ARTIFACT_DELIVERED: 'patch:artifact_delivered',

  // File delivery (Vivi generates and delivers downloadable files)
  FILE_DELIVERED: 'file:delivered',
};