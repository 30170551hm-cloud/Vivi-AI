import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { 
  Activity, X, ShieldAlert, CheckCircle2, Play, Pause, 
  Copy, Check, ShieldCheck, HelpCircle, HardDrive, Cpu, Database, 
  Volume2, Eye, Mic, ChevronDown, ChevronUp, Terminal
} from 'lucide-react';
import { diagnosticsStore } from '@/lib/diagnosticsStore';
import { safeJsonStringify } from '@/lib/utils';

export default function DiagnosticPanel({ open, onClose }) {
  const [diagnostics, setDiagnostics] = useState(diagnosticsStore.getSnapshot());
  const [copied, setCopied] = useState(false);
  const [expandedCallId, setExpandedCallId] = useState(null);
  const logsEndRef = useRef(null);

  useEffect(() => {
    return diagnosticsStore.subscribe((state) => {
      setDiagnostics({ ...state });
    });
  }, []);

  const copyToClipboard = () => {
    const rawData = safeJsonStringify(diagnostics, 2);
    navigator.clipboard.writeText(rawData).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
      console.error('Failed to copy diagnostics:', err);
    });
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'exitoso':
        return <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
      case 'procesando':
      case 'llamando':
      case 'generando':
      case 'reproduciendo':
      case 'leyendo':
      case 'escribiendo':
        return <Activity className="w-5 h-5 text-indigo-400 animate-pulse" />;
      case 'activo':
        return <Play className="w-5 h-5 text-sky-400" />;
      case 'error':
        return <ShieldAlert className="w-5 h-5 text-rose-500 animate-bounce" />;
      case 'idle':
      default:
        return <Pause className="w-5 h-5 text-zinc-500" />;
    }
  };

  const getStatusBgClass = (status) => {
    switch (status) {
      case 'exitoso':
        return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400';
      case 'procesando':
      case 'llamando':
      case 'generando':
      case 'reproduciendo':
      case 'leyendo':
      case 'escribiendo':
        return 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400';
      case 'activo':
        return 'bg-sky-500/10 border-sky-500/30 text-sky-400';
      case 'error':
        return 'bg-rose-500/10 border-rose-500/30 text-rose-400';
      case 'idle':
      default:
        return 'bg-zinc-500/10 border-zinc-500/20 text-zinc-400';
    }
  };

  const maskApiKey = (key) => {
    if (!key) return <span className="text-rose-400 font-mono">No Configurada ❌</span>;
    if (key.length <= 8) return <span className="text-yellow-400 font-mono">Inválida ⚠️</span>;
    return <span className="text-emerald-400 font-mono">{key.slice(0, 4)}...{key.slice(-4)}</span>;
  };

  // Convert key-value details of steps
  const stepLabels = {
    mic: { label: 'Micrófono', icon: <Mic className="w-4 h-4" /> },
    stt: { label: 'Speech-to-Text', icon: <Terminal className="w-4 h-4" /> },
    core: { label: 'Conversation Manager', icon: <Cpu className="w-4 h-4" /> },
    ai: { label: 'AI Service Proxy', icon: <HardDrive className="w-4 h-4" /> },
    gemini: { label: 'Gemini Direct API', icon: <Cpu className="w-4 h-4" /> },
    memory: { label: 'Memory (Firestore)', icon: <Database className="w-4 h-4" /> },
    voice: { label: 'Voice (TTS / Audio)', icon: <Volume2 className="w-4 h-4" /> },
    avatar: { label: 'Avatar Sync Engine', icon: <Eye className="w-4 h-4" /> },
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm touch-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Drawer Panel */}
          <motion.div
            id="diagnostic-panel-drawer"
            className="fixed bottom-0 inset-x-0 md:inset-y-0 md:right-0 md:left-auto md:w-[480px] h-[85vh] md:h-full bg-[#0D0D11] border-t md:border-t-0 md:border-l border-white/10 shadow-2xl z-50 flex flex-col rounded-t-2xl md:rounded-t-none"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-[#121217]">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-indigo-400 animate-pulse" />
                <div>
                  <h2 className="text-base font-bold text-white leading-tight">Panel de Diagnóstico Vivi</h2>
                  <p className="text-xs text-white/50">Monitoreo de flujo y latencia en tiempo real</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={copyToClipboard}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors active:scale-95"
                  title="Copiar logs completos"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors active:scale-95"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5 scrollbar-thin">
              
              {/* Credentials / Environment Status */}
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 space-y-2.5">
                <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider">Estado del Entorno</h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="block text-white/45">VITE_GEMINI_API_KEY</span>
                    <span className="font-semibold block truncate">
                      {maskApiKey(diagnostics.credentials.frontendKey)}
                    </span>
                  </div>
                  <div>
                    <span className="block text-white/45">VITE_GEMINI_MODEL</span>
                    <span className="font-semibold block truncate text-indigo-300 font-mono">
                      {diagnostics.credentials.frontendModel || 'No Configurado ⚠️'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 8-Step pipeline */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider">Cadena de Procesamiento (8 Pasos)</h3>
                <div className="space-y-2">
                  {Object.entries(stepLabels).map(([key, info]) => {
                    const stepState = diagnostics.steps[key] || { status: 'idle', message: 'Inactivo' };
                    return (
                      <div 
                        key={key} 
                        className={`flex items-start gap-3 p-2.5 rounded-xl border transition-all duration-300 ${
                          stepState.status === 'error' ? 'border-rose-500/30 bg-rose-500/[0.02]' : 'border-white/5 bg-white/[0.01]'
                        }`}
                      >
                        <div className={`p-2 rounded-lg ${getStatusBgClass(stepState.status)}`}>
                          {info.icon}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-white/90">{info.label}</span>
                            <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border ${getStatusBgClass(stepState.status)}`}>
                              {stepState.status}
                            </span>
                          </div>
                          <p className="text-xs text-white/60 mt-0.5 break-words line-clamp-2">
                            {stepState.message}
                          </p>
                          {stepState.timestamp && (
                            <span className="text-[9px] text-white/30 block mt-1 font-mono">
                              Actualizado: {new Date(stepState.timestamp).toLocaleTimeString()}
                            </span>
                          )}
                        </div>

                        <div className="self-center">
                          {getStatusIcon(stepState.status)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* API Logs */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider">Historial de Llamadas Gemini</h3>
                
                {diagnostics.geminiCalls.length === 0 ? (
                  <div className="p-8 text-center border border-dashed border-white/10 rounded-xl bg-white/[0.01]">
                    <HelpCircle className="w-8 h-8 text-white/20 mx-auto mb-2" />
                    <p className="text-xs text-white/40">No hay llamadas a la API registradas aún.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {diagnostics.geminiCalls.map((call) => {
                      const isExpanded = expandedCallId === call.id;
                      const hasError = call.httpCode !== 200 || call.errorMessage;
                      
                      return (
                        <div 
                          key={call.id} 
                          className={`rounded-xl border transition-all ${
                            hasError 
                              ? 'border-rose-500/30 bg-rose-500/[0.02]' 
                              : 'border-white/10 bg-white/[0.02]'
                          }`}
                        >
                          {/* Header Accordion */}
                          <button
                            onClick={() => setExpandedCallId(isExpanded ? null : call.id)}
                            className="w-full flex items-center justify-between p-3 text-left touch-manipulation text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`font-mono px-1.5 py-0.5 rounded border font-bold ${
                                call.httpCode === 200 
                                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                                  : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                              }`}>
                                {call.httpCode}
                              </span>
                              <div className="min-w-0">
                                <p className="font-mono font-semibold text-white/80 truncate max-w-[200px]">
                                  {call.model}
                                </p>
                                <span className="text-[10px] text-white/40">
                                  {new Date(call.timestamp).toLocaleTimeString()} • {call.responseTime}ms
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 text-white/40">
                              {hasError && <ShieldAlert className="w-4 h-4 text-rose-500" />}
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </div>
                          </button>

                          {/* Expanded content */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                className="border-t border-white/5 bg-[#121217] p-3 space-y-3.5 text-xs rounded-b-xl"
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                              >
                                {/* Endpoint */}
                                <div>
                                  <span className="block text-white/40 font-semibold mb-0.5 uppercase text-[10px]">Endpoint</span>
                                  <p className="font-mono bg-black/40 p-1.5 rounded text-zinc-300 select-all break-all text-[11px]">
                                    {call.endpoint}
                                  </p>
                                </div>

                                {/* File & Function */}
                                <div>
                                  <span className="block text-white/40 font-semibold mb-0.5 uppercase text-[10px]">Archivo y Función</span>
                                  <p className="font-mono bg-black/40 p-1.5 rounded text-zinc-300 text-[11px]">
                                    {call.fileFunc || 'Desconocido'}
                                  </p>
                                </div>

                                {/* Prompt */}
                                <div>
                                  <span className="block text-white/40 font-semibold mb-0.5 uppercase text-[10px]">Prompt enviado</span>
                                  <div className="bg-black/30 p-2 rounded text-zinc-300 max-h-40 overflow-y-auto whitespace-pre-wrap font-sans">
                                    {call.prompt}
                                  </div>
                                </div>

                                {/* Response body or error */}
                                <div>
                                  <span className="block text-white/40 font-semibold mb-0.5 uppercase text-[10px]">
                                    {hasError ? 'Mensaje de Error Completo' : 'Respuesta de Gemini'}
                                  </span>
                                  <div className={`p-2 rounded max-h-56 overflow-y-auto font-mono text-[11px] ${
                                    hasError ? 'bg-rose-950/20 text-rose-400 border border-rose-500/10' : 'bg-black/30 text-emerald-400'
                                  }`}>
                                    {hasError ? (call.errorMessage || call.responseBody) : call.responseBody}
                                  </div>
                                </div>

                                {/* Stack Trace if present */}
                                {call.stackTrace && (
                                  <div>
                                    <span className="block text-white/40 font-semibold mb-0.5 uppercase text-[10px] text-rose-400">Stack Trace completo</span>
                                    <pre className="p-2 bg-rose-950/10 border border-rose-500/10 rounded text-[10px] text-zinc-400 font-mono overflow-x-auto whitespace-pre">
                                      {call.stackTrace}
                                    </pre>
                                  </div>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>

            {/* Footer status banner */}
            <div className="p-3.5 bg-[#121217] border-t border-white/10 text-center text-xs text-white/40 flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Diagnóstico activo • Vivi AI Engine v2.0</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
