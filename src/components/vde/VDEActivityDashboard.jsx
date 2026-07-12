import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FilePlus, FileEdit, Loader2, CheckCircle2, AlertCircle, Terminal, Activity } from 'lucide-react';
import { useVivi } from '@/vivi/hooks/useVivi';

// Real-time dashboard showing what Vivi is creating/correcting right now.
// Subscribes to VDE_ACTIVITY events from the VDE module.
export default function VDEActivityDashboard() {
  const { vivi } = useVivi();
  const [activities, setActivities] = useState([]);
  const [activeCount, setActiveCount] = useState(0);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!vivi) return;

    const handleActivity = (event) => {
      setActivities((prev) => {
        const next = [...prev, event];
        // Keep last 50 events
        return next.slice(-50);
      });
    };

    const unsub = vivi.on('vde:activity', handleActivity);
    return unsub;
  }, [vivi]);

  // Track active sessions
  useEffect(() => {
    const sessions = new Map();
    for (const a of activities) {
      sessions.set(a.sessionId, a.status);
    }
    let active = 0;
    for (const status of sessions.values()) {
      if (['analyzing', 'generating', 'creating', 'correcting'].includes(status)) active++;
    }
    setActiveCount(active);
  }, [activities]);

  // Auto-scroll to bottom on new activity
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activities]);

  const isWorking = activeCount > 0;

  return (
    <div className="rounded-2xl border border-fuchsia-400/20 bg-black/40 backdrop-blur-md overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isWorking ? 'bg-fuchsia-400 animate-pulse' : 'bg-white/20'}`} />
          <Activity className={`w-4 h-4 ${isWorking ? 'text-fuchsia-300' : 'text-white/40'}`} />
          <h3 className="text-white/80 text-sm font-medium">Actividad en tiempo real</h3>
        </div>
        <span className="text-[10px] font-mono text-white/30">
          {isWorking ? `${activeCount} en curso` : 'En reposo'}
        </span>
      </div>

      {/* Activity log */}
      <div ref={scrollRef} className="max-h-64 overflow-y-auto">
        {activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-white/25">
            <Terminal className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-xs">Vivi no está trabajando ahora mismo.</p>
            <p className="text-[10px] mt-1">Pídele que cree o corrija algo por voz.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            <AnimatePresence initial={false}>
              {activities.map((act, i) => (
                <ActivityRow key={`${act.sessionId}-${i}`} activity={act} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

const STATUS_CONFIG = {
  analyzing:   { icon: Loader2,      color: 'text-cyan-300',    bg: 'bg-cyan-500/10',    spin: true,  label: 'Analizando' },
  generating:  { icon: Loader2,      color: 'text-purple-300',  bg: 'bg-purple-500/10',  spin: true,  label: 'Generando' },
  creating:    { icon: FilePlus,     color: 'text-green-300',   bg: 'bg-green-500/10',   spin: false, label: 'Creando' },
  correcting:  { icon: FileEdit,     color: 'text-amber-300',   bg: 'bg-amber-500/10',   spin: false, label: 'Corrigiendo' },
  deployed:    { icon: CheckCircle2, color: 'text-green-400',   bg: 'bg-green-500/15',   spin: false, label: 'Desplegado' },
  error:       { icon: AlertCircle,  color: 'text-red-400',     bg: 'bg-red-500/10',     spin: false, label: 'Error' },
};

function ActivityRow({ activity }) {
  const config = STATUS_CONFIG[activity.status] || STATUS_CONFIG.analyzing;
  const Icon = config.icon;
  const time = new Date(activity.timestamp).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-start gap-3 px-4 py-2.5"
    >
      <div className={`flex-shrink-0 w-7 h-7 rounded-lg ${config.bg} flex items-center justify-center`}>
        <Icon className={`w-3.5 h-3.5 ${config.color} ${config.spin ? 'animate-spin' : ''}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-mono uppercase ${config.color}`}>{config.label}</span>
          <span className="text-[10px] font-mono text-white/20">{time}</span>
        </div>
        <p className="text-white/70 text-xs mt-0.5 truncate">{activity.message}</p>
        {activity.data?.filePath && (
          <p className="text-[10px] font-mono text-cyan-300/40 mt-0.5 truncate">{activity.data.filePath}</p>
        )}
      </div>
    </motion.div>
  );
}