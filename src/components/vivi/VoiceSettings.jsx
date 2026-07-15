import React, { useEffect, useState } from 'react';
import { Slider } from '@/components/ui/slider';
import { Volume2, Play, ChevronDown, Check } from 'lucide-react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { useVivi } from '@/vivi/hooks/useVivi';

const AUTO_VOICE = '__auto__';

// Voice configuration: selector + rate/pitch/volume sliders + test button.
// Reads available system voices from ViviVoice; saves prefs via updateSettings.
export default function VoiceSettings({ user, onUpdateSettings }) {
  const { vivi } = useVivi();
  const isMobile = useIsMobile();
  const [voices, setVoices] = useState([]);
  const [voiceDrawerOpen, setVoiceDrawerOpen] = useState(false);

  // Load available voices (they load async via onvoiceschanged).
  useEffect(() => {
    const voice = vivi.voice;
    if (!voice) return;

    let interval = null;
    const updateVoices = () => {
      const v = voice.getAvailableVoices();
      if (v.length > 0) {
        setVoices(v);
        if (interval) clearInterval(interval);
      }
    };

    updateVoices();
    interval = setInterval(updateVoices, 500);
    return () => { if (interval) clearInterval(interval); };
  }, [vivi]);

  // Local state for sliders (save on commit, not during drag).
  const [rate, setRate] = useState(user?.voice_rate ?? 0.85);
  const [pitch, setPitch] = useState(user?.voice_pitch ?? 1.0);
  const [volume, setVolume] = useState(user?.voice_volume ?? 1);

  useEffect(() => {
    setRate(user?.voice_rate ?? 0.85);
    setPitch(user?.voice_pitch ?? 1.0);
    setVolume(user?.voice_volume ?? 1);
  }, [user]);

  const testVoice = () => {
    vivi.voice?.speak('Hola, soy Vivi. Así sueno cuando hablo.', vivi.settings?.getLanguage());
  };

  return (
    <div className="space-y-4 pt-2 border-t border-white/10">
      <div className="flex items-center gap-2 text-white/70">
        <Volume2 className="w-4 h-4" />
        <span className="text-sm font-medium">Configuración de voz</span>
      </div>

      {/* Voice selector */}
      <div className="space-y-1.5">
        <label className="text-xs text-white/50">Voz</label>
        {isMobile ? (
          <Drawer open={voiceDrawerOpen} onOpenChange={setVoiceDrawerOpen}>
            <DrawerTrigger asChild>
              <button className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm select-none touch-manipulation">
                <span className="truncate">{user?.voice_name || 'Automática (recomendada)'}</span>
                <ChevronDown className="w-4 h-4 text-white/40 flex-shrink-0 ml-2" />
              </button>
            </DrawerTrigger>
            <DrawerContent className="bg-[#0b0713] border-white/10">
              <DrawerHeader>
                <DrawerTitle className="text-white">Selecciona una voz</DrawerTitle>
              </DrawerHeader>
              <div className="space-y-1.5 p-4 pb-8 max-h-[60vh] overflow-y-auto">
                <button
                  onClick={() => { onUpdateSettings?.({ voice_name: '' }); setVoiceDrawerOpen(false); }}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm border transition-colors text-left select-none touch-manipulation"
                  style={!user?.voice_name ? { backgroundColor: 'rgba(168,85,247,0.2)', borderColor: 'rgba(192,132,252,0.4)', color: 'white' } : { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}
                >
                  <span>Automática (recomendada)</span>
                  {!user?.voice_name && <Check className="w-4 h-4 text-purple-300" />}
                </button>
                {voices.map((v) => (
                  <button
                    key={v.name}
                    onClick={() => { onUpdateSettings?.({ voice_name: v.name }); setVoiceDrawerOpen(false); }}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm border transition-colors text-left select-none touch-manipulation"
                    style={user?.voice_name === v.name ? { backgroundColor: 'rgba(168,85,247,0.2)', borderColor: 'rgba(192,132,252,0.4)', color: 'white' } : { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}
                  >
                    <span className="truncate">{v.name} ({v.lang})</span>
                    {user?.voice_name === v.name && <Check className="w-4 h-4 text-purple-300 flex-shrink-0 ml-2" />}
                  </button>
                ))}
              </div>
            </DrawerContent>
          </Drawer>
        ) : (
          <Select
            value={user?.voice_name || AUTO_VOICE}
            onValueChange={(v) => onUpdateSettings?.({ voice_name: v === AUTO_VOICE ? '' : v })}
          >
            <SelectTrigger className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:ring-purple-400">
              <SelectValue placeholder="Automática (recomendada)" />
            </SelectTrigger>
            <SelectContent className="bg-[#0b0713] border-white/10 text-white max-h-60">
              <SelectItem value={AUTO_VOICE} className="text-white/80 focus:bg-purple-500/30 focus:text-white">Automática (recomendada)</SelectItem>
              {voices.map((v) => (
                <SelectItem key={v.name} value={v.name} className="text-white/80 focus:bg-purple-500/30 focus:text-white">
                  {v.name} ({v.lang})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Rate */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-white/50">
          <span>Velocidad</span>
          <span>{rate.toFixed(1)}x</span>
        </div>
        <Slider
          value={[rate]}
          min={0.5} max={2} step={0.1}
          onValueChange={([v]) => setRate(v)}
          onValueCommit={([v]) => onUpdateSettings?.({ voice_rate: v })}
        />
      </div>

      {/* Pitch */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-white/50">
          <span>Tono</span>
          <span>{pitch.toFixed(1)}</span>
        </div>
        <Slider
          value={[pitch]}
          min={0} max={2} step={0.1}
          onValueChange={([v]) => setPitch(v)}
          onValueCommit={([v]) => onUpdateSettings?.({ voice_pitch: v })}
        />
      </div>

      {/* Volume */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-white/50">
          <span>Volumen</span>
          <span>{Math.round(volume * 100)}%</span>
        </div>
        <Slider
          value={[volume]}
          min={0} max={1} step={0.1}
          onValueChange={([v]) => setVolume(v)}
          onValueCommit={([v]) => onUpdateSettings?.({ voice_volume: v })}
        />
      </div>

      <button
        onClick={testVoice}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-400 text-white text-sm font-medium transition-colors touch-manipulation select-none"
      >
        <Play className="w-4 h-4" /> Probar voz
      </button>
    </div>
  );
}