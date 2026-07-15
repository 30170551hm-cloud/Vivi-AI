import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Volume2, Play, RefreshCw, CheckCircle2, XCircle, Activity } from 'lucide-react';
import { useVivi } from '@/vivi/hooks/useVivi';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import PullToRefreshIndicator from '@/components/vivi/PullToRefreshIndicator';
import PageTransition from '@/components/PageTransition';
import { safeJsonStringify } from '@/lib/utils';

export default function VoiceDiagnostic() {
  const { vivi, testVoice, voiceStatus } = useVivi();
  const navigate = useNavigate();
  const [info, setInfo] = useState(null);

  const { scrollRef, pullDistance, refreshing } = usePullToRefresh(async () => {
    refresh();
  });

  const refresh = () => {
    const voice = vivi.voice;
    if (voice) setInfo(voice.getDiagnosticInfo());
  };

  const exportHistory = () => {
    const voice = vivi.voice;
    if (!voice) return;
    const history = voice.getTransitionHistory();
    const text = history.map((t, i) =>
      `${String(i).padStart(3, '0')} | ${t.timestamp} | ${t.oldState} → ${t.newState} | ${t.reason} | ${t.caller} | ${t.file}:${t.line}`
    ).join('\n');
    console.log('=== ViviVoice Transition History (full) ===\n' + text);
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 1000);
    return () => clearInterval(interval);
  }, [vivi, voiceStatus]);

  if (!info) {
    return (
      <div className="min-h-screen bg-[#07040f] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-purple-900 border-t-purple-400 rounded-full animate-spin" />
      </div>
    );
  }

  const spanishVoices = info.voices.filter(v => /^es/i.test(v.lang));
  const femaleVoices = info.voices.filter(v => v.isFemale);

  return (
    <PageTransition>
    <div ref={scrollRef} className="h-screen overflow-y-auto overscroll-contain bg-gradient-to-b from-[#0a0512] to-[#05030a] text-white" style={{ paddingTop: 'calc(1.5rem + env(safe-area-inset-top))', paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
      <div className="max-w-4xl mx-auto">
        <PullToRefreshIndicator pullDistance={pullDistance} refreshing={refreshing} />
        <button onClick={() => navigate(-1)} className="inline-flex items-center text-white/60 hover:text-white mb-8">
          <ArrowLeft className="w-4 h-4 mr-2" /> Volver a Vivi
        </button>

        <div className="flex items-center gap-3 mb-2">
          <Volume2 className="w-7 h-7 text-fuchsia-400" />
          <h1 className="text-3xl font-semibold tracking-tight">Diagnóstico de Voz</h1>
        </div>
        <p className="text-white/50 mb-8">Estado completo del motor TTS de Vivi AI</p>

        {/* Test button */}
        <div className="rounded-2xl bg-white/5 border border-white/10 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-medium mb-1">Probar voz</h2>
              <p className="text-white/50 text-sm">Reproduce una frase de prueba para verificar el audio.</p>
            </div>
            <button
              onClick={testVoice}
              disabled={voiceStatus === 'speaking' || voiceStatus === 'loading_voices'}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:opacity-90 disabled:opacity-40 text-white font-medium transition-opacity"
            >
              <Play className="w-4 h-4" /> Probar
            </button>
          </div>
          {voiceStatus && (
            <div className="mt-3 text-sm">
              <span className="text-white/50">Estado actual: </span>
              <span className={
                voiceStatus === 'speaking' ? 'text-fuchsia-300' :
                voiceStatus === 'voice_ready' ? 'text-green-400' :
                voiceStatus === 'loading_voices' ? 'text-amber-300' :
                voiceStatus === 'error' ? 'text-red-400' :
                'text-white/60'
              }>{voiceStatus}</span>
            </div>
          )}
        </div>

        {/* Environment & Engine */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
            <h3 className="text-sm font-medium text-white/70 mb-3">Motor TTS</h3>
            <dl className="space-y-2 text-sm">
              <Row label="Motor" value={info.ttsEngine} />
              <Row label="speechSynthesis" value={info.synthesisExists ? 'Disponible' : 'No disponible'} ok={info.synthesisExists} />
              <Row label="TTS soportado" value={info.ttsSupported ? 'Sí' : 'No'} ok={info.ttsSupported} />
              <Row label="STT soportado" value={info.sttSupported ? 'Sí' : 'No'} ok={info.sttSupported} />
            </dl>
          </div>

          <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
            <h3 className="text-sm font-medium text-white/70 mb-3">Entorno</h3>
            <dl className="space-y-2 text-sm">
              <Row label="Plataforma" value={info.env?.platform || 'unknown'} />
              <Row label="Navegador" value={info.env?.browser || 'unknown'} />
              <Row label="En iframe" value={info.env?.inIframe ? 'Sí' : 'No'} />
              <Row label="Vista previa builder" value={info.env?.isBuilderPreview ? 'Sí' : 'No'} />
            </dl>
          </div>
        </div>

        {/* speechSynthesis runtime state */}
        <div className="rounded-2xl bg-white/5 border border-white/10 p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-white/70">Estado de speechSynthesis</h3>
            <button onClick={refresh} className="text-white/40 hover:text-white/80">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <StateCard label="Pausado" active={info.synthesisPaused} />
            <StateCard label="Pendiente" active={info.synthesisPending} />
            <StateCard label="Hablando" active={info.synthesisSpeaking} />
          </div>
        </div>

        {/* Selected voice */}
        <div className="rounded-2xl bg-white/5 border border-white/10 p-5 mb-6">
          <h3 className="text-sm font-medium text-white/70 mb-3">Voz seleccionada</h3>
          <dl className="space-y-2 text-sm">
            <Row label="Nombre" value={info.selectedVoice?.name || 'Ninguna'} />
            <Row label="Idioma" value={info.selectedVoice?.lang || '—'} />
            <Row label="Voces cargadas" value={info.voiceCount} />
            <Row label="Voces listas" value={info.voicesReady ? 'Sí' : 'No'} ok={info.voicesReady} />
            <Row label="Audio desbloqueado" value={info.unlocked ? 'Sí' : 'No'} ok={info.unlocked} />
            <Row label="Velocidad" value={`${info.rate}x`} />
            <Row label="Tono" value={info.pitch} />
            <Row label="Volumen" value={`${Math.round(info.volume * 100)}%`} />
          </dl>
        </div>

        {/* Voice list */}
        <div className="rounded-2xl bg-white/5 border border-white/10 p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-white/70">Voces detectadas ({info.voiceCount})</h3>
            <div className="flex gap-3 text-xs text-white/40">
              <span>Español: {spanishVoices.length}</span>
              <span>Femeninas: {femaleVoices.length}</span>
            </div>
          </div>
          {info.voiceCount === 0 ? (
            <p className="text-red-300/70 text-sm">
              No se detectaron voces. Esto puede ocurrir en iframes o navegadores sin soporte TTS.
              El sistema usará el fallback en la nube (GenerateSpeech).
            </p>
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {info.voices.map((v, i) => (
                <div
                  key={`${v.name}-${i}`}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                    v.name === info.selectedVoice?.name
                      ? 'bg-purple-500/20 border border-purple-400/30'
                      : 'bg-white/5'
                  }`}
                >
                  <span className="text-white/80">{v.name}</span>
                  <div className="flex items-center gap-2">
                    {v.isFemale && <span className="text-xs text-fuchsia-400/60">F</span>}
                    <span className="text-white/40 text-xs">{v.lang}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {info.voiceCount > 0 && spanishVoices.length === 0 && (
            <p className="mt-3 text-amber-300/70 text-xs">
              No hay voces en español disponibles. Se usará la primera voz compatible o el fallback en la nube.
            </p>
          )}
        </div>

        {/* State machine current state */}
        <div className="rounded-2xl bg-white/5 border border-white/10 p-5 mb-6">
          <h3 className="text-sm font-medium text-white/70 mb-3">Máquina de estados</h3>
          <div className="grid grid-cols-4 gap-2">
            {['idle', 'listening', 'thinking', 'speaking'].map((s) => (
              <div key={s} className={`rounded-lg p-3 text-center border ${info.state === s ? 'bg-fuchsia-500/20 border-fuchsia-400/40' : 'bg-white/5 border-white/5'}`}>
                <div className={`text-xs font-medium ${info.state === s ? 'text-fuchsia-300' : 'text-white/30'}`}>
                  {s === 'idle' ? 'IDLE' : s === 'listening' ? 'LISTENING' : s === 'thinking' ? 'THINKING' : 'SPEAKING'}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-4 text-xs text-white/50">
            <span>Reconocimiento activo: <span className={info.recognitionActive ? 'text-green-400' : 'text-white/40'}>{info.recognitionActive ? 'Sí' : 'No'}</span></span>
            <span>Conversación activa: <span className={info.conversationActive ? 'text-green-400' : 'text-white/40'}>{info.conversationActive ? 'Sí' : 'No'}</span></span>
          </div>
        </div>

        {/* Transition history — last 20 entries */}
        <div className="rounded-2xl bg-white/5 border border-white/10 p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-white/70 flex items-center gap-2">
              <Activity className="w-4 h-4" /> Historial de transiciones (últimas 20)
            </h3>
            <div className="flex items-center gap-2">
              <button onClick={exportHistory} className="text-xs text-white/40 hover:text-white/80 flex items-center gap-1">
                <Activity className="w-3.5 h-3.5" /> Exportar consola
              </button>
              <button onClick={refresh} className="text-white/40 hover:text-white/80">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
          {info.transitionHistory && info.transitionHistory.length > 0 ? (
            <div className="space-y-1 max-h-80 overflow-y-auto text-xs font-mono">
              {info.transitionHistory.slice().reverse().map((t, i) => (
                <div key={i} className="flex items-start gap-2 px-2 py-1.5 rounded bg-black/30 border border-white/5">
                  <span className="text-white/40 flex-shrink-0">{String(i).padStart(2, '0')}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-purple-300">{t.oldState}</span>
                      <span className="text-white/30">→</span>
                      <span className="text-fuchsia-300">{t.newState}</span>
                      {t.newState && t.newState.includes('BLOCKED') && <span className="text-red-400 text-[10px]">BLOCKED</span>}
                    </div>
                    <div className="text-white/40 mt-0.5">
                      <span className="text-amber-300/60">{t.reason}</span>
                      {' · '}
                      <span className="text-white/50">{t.caller}</span>
                      {' · '}
                      <span className="text-white/30">{t.file?.split('/').pop()}:{t.line}</span>
                    </div>
                    <div className="text-white/25 mt-0.5">
                      {t.timestamp}
                      {t.recognitionActive !== undefined && ` · rec:${t.recognitionActive ? 'on' : 'off'}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-white/40 text-sm">Sin transiciones registradas todavía.</p>
          )}
        </div>

        {/* Last error */}
        <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
          <h3 className="text-sm font-medium text-white/70 mb-3">Último error registrado</h3>
          {info.lastError ? (
            <div className="bg-red-950/40 border border-red-500/20 rounded-lg p-3 text-sm">
              <p className="text-red-300 font-medium">{info.lastError.message}</p>
              {info.lastError.data && (
                <p className="text-red-300/60 mt-1 break-words text-xs">
                  {typeof info.lastError.data === 'string'
                    ? info.lastError.data
                    : safeJsonStringify(info.lastError.data)}
                </p>
              )}
              <p className="text-red-300/40 mt-1 text-xs">
                {new Date(info.lastError.timestamp).toLocaleString()}
              </p>
            </div>
          ) : (
            <p className="text-green-400/70 text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Sin errores registrados
            </p>
          )}
        </div>
      </div>
    </div>
    </PageTransition>
  );
}

function Row({ label, value, ok }) {
  return (
    <div className="flex justify-between items-center">
      <dt className="text-white/50">{label}</dt>
      <dd className="text-white/90 flex items-center gap-1.5">
        {ok !== undefined && (ok ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> : <XCircle className="w-3.5 h-3.5 text-red-400" />)}
        {String(value)}
      </dd>
    </div>
  );
}

function StateCard({ label, active }) {
  return (
    <div className={`rounded-lg p-3 text-center border ${active ? 'bg-fuchsia-500/10 border-fuchsia-400/30' : 'bg-white/5 border-white/5'}`}>
      <div className={`text-2xl mb-1 ${active ? 'text-fuchsia-300' : 'text-white/30'}`}>
        {active ? '●' : '○'}
      </div>
      <div className="text-xs text-white/50">{label}</div>
    </div>
  );
}