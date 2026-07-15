import React, { useEffect, useState } from 'react';
import { Volume2, Globe, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { useVivi } from '@/vivi/hooks/useVivi';
import { safeJsonStringify } from '@/lib/utils';

// Voice system diagnostics for the Founder panel.
// Shows TTS engine, environment, speechSynthesis availability, and errors.
export default function VoiceStatus() {
  const { vivi, voiceDiag } = useVivi();
  const [status, setStatus] = useState(null);
  const [lastError, setLastError] = useState(null);

  useEffect(() => {
    const update = () => setStatus(vivi.voice?.getDiagnosticInfo());
    update();
    const interval = setInterval(update, 2000);
    return () => clearInterval(interval);
  }, [vivi]);

  useEffect(() => {
    if (voiceDiag?.isError) setLastError(voiceDiag);
  }, [voiceDiag]);

  if (!status) return null;

  const Row = ({ label, value, ok }) => (
    <div className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
      <span className="text-white/50 text-sm">{label}</span>
      <span className="flex items-center gap-1.5 text-sm font-medium">
        {ok !== undefined && (ok ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> : <XCircle className="w-3.5 h-3.5 text-red-400" />)}
        <span className={ok === false ? 'text-red-300' : 'text-white/90'}>{value}</span>
      </span>
    </div>
  );

  return (
    <div className="mt-6 rounded-2xl bg-white/5 border border-white/10 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Volume2 className="w-5 h-5 text-fuchsia-400" />
        <h2 className="text-lg font-medium">Sistema de voz</h2>
      </div>

      <div className="space-y-0.5">
        <Row label="Motor TTS" value={status.ttsEngine} ok={status.ttsSupported} />
        <Row label="speechSynthesis disponible" value={status.ttsSupported ? 'Sí' : 'No'} ok={status.ttsSupported} />
        <Row label="Fallback en la nube" value="Disponible (GenerateSpeech)" ok={true} />
        <Row label="Voces del sistema" value={status.voiceCount} />
        <Row label="Voz seleccionada" value={status.selectedVoice?.name || 'Automática'} />
        <Row label="Idioma" value={status.lang} />
        <Row label="Audio desbloqueado" value={status.unlocked ? 'Sí' : 'No (requiere gesto)'} ok={status.unlocked} />
      </div>

      <div className="mt-4 pt-4 border-t border-white/10">
        <div className="flex items-center gap-2 mb-2">
          <Globe className="w-4 h-4 text-purple-400" />
          <span className="text-sm text-white/50">Entorno detectado</span>
        </div>
        <div className="space-y-0.5">
          <Row label="Plataforma" value={status.env.platform} />
          <Row label="Navegador" value={status.env.browser} />
          <Row label="Dentro de iframe" value={status.env.inIframe ? 'Sí' : 'No'} />
          <Row label="Vista previa builder" value={status.env.isBuilderPreview ? 'Sí' : 'No'} />
        </div>
      </div>

      {lastError && (
        <div className="mt-4 p-3 rounded-lg bg-red-950/50 border border-red-500/30">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-sm font-medium text-red-200">Último error de voz</span>
          </div>
          <p className="text-xs text-red-300/80">{lastError.message}</p>
          {lastError.data && <p className="text-xs text-red-300/60 mt-1 break-words">{typeof lastError.data === 'string' ? lastError.data : safeJsonStringify(lastError.data)}</p>}
        </div>
      )}
    </div>
  );
}