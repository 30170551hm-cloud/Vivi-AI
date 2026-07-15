import React, { useEffect, useRef, useState } from 'react';
import { Trash2, AlertCircle, AlertTriangle, Info, Terminal } from 'lucide-react';
import { useVivi } from '@/vivi/hooks/useVivi';
import { EVENTS } from '@/vivi/events';

// Real-time log viewer for the Founder panel.
// Reads from ViviLogger module; updates live via LOG_ADDED events.
export default function FounderLogs() {
  const { vivi } = useVivi();
  const [logs, setLogs] = useState([]);
  const scrollRef = useRef(null);

  useEffect(() => {
    const logger = vivi.registry.get('logger');
    if (logger) setLogs(logger.getLogs());

    const unsubs = [
      vivi.on(EVENTS.LOG_ADDED, (entry) => {
        setLogs((prev) => [...prev, entry].slice(-200));
      }),
      vivi.on(EVENTS.LOG_CLEARED, () => setLogs([])),
    ];

    return () => unsubs.forEach((u) => u && u());
  }, [vivi]);

  // Auto-scroll to bottom on new logs.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const clear = () => vivi.registry.get('logger')?.clear();

  const icon = (level) => {
    if (level === 'error') return <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />;
    if (level === 'warn') return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />;
    return <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />;
  };

  const formatTime = (iso) => {
    try {
      return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return iso;
    }
  };

  return (
    <div className="mt-6 rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-fuchsia-400" />
          <h2 className="text-lg font-medium">Logs en tiempo real</h2>
          <span className="text-xs text-white/40 ml-2">{logs.length} entradas</span>
        </div>
        <button
          onClick={clear}
          className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors touch-manipulation"
        >
          <Trash2 className="w-4 h-4" /> Limpiar
        </button>
      </div>

      <div ref={scrollRef} className="max-h-80 overflow-y-auto px-6 py-3 space-y-1.5 font-mono text-xs">
        {logs.length === 0 ? (
          <p className="text-white/30 py-4 text-center">Sin eventos. El sistema está funcionando correctamente.</p>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="flex items-start gap-2 py-1">
              <span className="text-white/30 shrink-0">{formatTime(log.timestamp)}</span>
              {icon(log.level)}
              <span className="text-purple-300/70 shrink-0">[{log.module}]</span>
              <span className="text-white/70 break-words">{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}