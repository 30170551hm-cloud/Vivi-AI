import React from 'react';
import { Loader2, CheckCircle2, Volume2, Circle, AlertCircle } from 'lucide-react';

const STATUS_CONFIG = {
  loading_voices: { label: 'Cargando voces...', icon: Loader2, color: 'text-amber-300', spin: true },
  voice_ready: { label: 'Voz lista', icon: CheckCircle2, color: 'text-green-400', spin: false },
  speaking: { label: 'Hablando', icon: Volume2, color: 'text-fuchsia-300', spin: false },
  ended: { label: 'Voz finalizada', icon: Circle, color: 'text-white/50', spin: false },
  error: { label: 'Error de voz', icon: AlertCircle, color: 'text-red-400', spin: false },
  idle: { label: '', icon: null, color: '', spin: false },
};

export default function VoiceStatusBadge({ status = 'idle' }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.idle;
  if (!cfg.icon) return null;

  const Icon = cfg.icon;
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-xs font-medium ${cfg.color}`}>
      <Icon className={`w-3.5 h-3.5 ${cfg.spin ? 'animate-spin' : ''}`} />
      {cfg.label}
    </div>
  );
}