import React, { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Crown, LogOut, ChevronDown, Brain, Cpu } from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { authClient } from '@/lib/authClient';
import VoiceSettings from '@/components/vivi/VoiceSettings';
import AccountDeletion from '@/components/vivi/AccountDeletion';

const LANGS = [
  { code: 'auto', label: 'Automático' },
  { code: 'es-ES', label: 'Español' },
  { code: 'en-US', label: 'English' },
  { code: 'pt-BR', label: 'Português' },
  { code: 'fr-FR', label: 'Français' },
];

// Pure presentational — receives updateSettings callback from parent (useVivi).
export default function SettingsPanel({ open, onOpenChange, user, onUpdateSettings }) {
  const [name, setName] = useState('');
  const [lang, setLang] = useState('auto');
  const [voice, setVoice] = useState(true);
  const [langDrawerOpen, setLangDrawerOpen] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (user) {
      setName(user.display_name || '');
      setLang(user.preferred_language || 'auto');
      setVoice(user.voice_enabled !== false);
    }
  }, [user]);

  const save = (patch) => onUpdateSettings?.(patch);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="bg-[#0b0713] border-white/10 text-white">
        <SheetHeader>
          <SheetTitle className="text-white">Configuración</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="space-y-2">
            <Label className="text-white/70">Tu nombre</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => save({ display_name: name })}
              placeholder="¿Cómo te llamas?"
              className="bg-white/5 border-white/10 text-white"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-white/70">Idioma</Label>
            {isMobile ? (
              <Drawer open={langDrawerOpen} onOpenChange={setLangDrawerOpen}>
                <DrawerTrigger asChild>
                  <button className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm select-none touch-manipulation">
                    <span>{LANGS.find((l) => l.code === lang)?.label || 'Automático'}</span>
                    <ChevronDown className="w-4 h-4 text-white/40" />
                  </button>
                </DrawerTrigger>
                <DrawerContent className="bg-[#0b0713] border-white/10">
                  <DrawerHeader>
                    <DrawerTitle className="text-white">Selecciona tu idioma</DrawerTitle>
                  </DrawerHeader>
                  <div className="space-y-2 p-4 pb-8">
                    {LANGS.map((l) => (
                      <button
                        key={l.code}
                        onClick={() => { setLang(l.code); save({ preferred_language: l.code }); setLangDrawerOpen(false); }}
                        className={`w-full px-4 py-3 rounded-lg text-sm border transition-colors text-left select-none touch-manipulation ${lang === l.code ? 'bg-purple-500 border-purple-400 text-white' : 'bg-white/5 border-white/10 text-white/70'}`}
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                </DrawerContent>
              </Drawer>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {LANGS.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => { setLang(l.code); save({ preferred_language: l.code }); }}
                    className={`px-3 py-2 rounded-lg text-sm border transition-colors select-none touch-manipulation ${lang === l.code ? 'bg-purple-500 border-purple-400' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-white/70">Modo manos libres</Label>
            <Switch checked={voice} onCheckedChange={(v) => { setVoice(v); save({ voice_enabled: v }); }} />
          </div>

          {voice && (
            <VoiceSettings user={user} onUpdateSettings={save} />
          )}

          <Link to="/memoria">
            <Button variant="outline" className="w-full bg-white/5 border-white/10 text-white hover:bg-white/10">
              <Brain className="w-4 h-4 mr-2" /> Memoria Permanente
            </Button>
          </Link>

          <Link to="/vde-console">
            <Button variant="outline" className="w-full bg-fuchsia-500/10 border-fuchsia-400/30 text-fuchsia-200 hover:bg-fuchsia-500/20">
              <Cpu className="w-4 h-4 mr-2" /> Consola VDE — Mi código
            </Button>
          </Link>

          {user?.is_founder && (
            <Link to="/founder">
              <Button className="w-full bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:opacity-90">
                <Crown className="w-4 h-4 mr-2" /> Panel Founder
              </Button>
            </Link>
          )}

          <div className="space-y-2 pt-4 border-t border-white/10">
            <Label className="text-white/50 text-xs">Zona de peligro</Label>
            <AccountDeletion />
          </div>

          <Button
            variant="ghost"
            onClick={() => authClient.logout()}
            className="w-full text-white/60 hover:text-white hover:bg-white/5"
          >
            <LogOut className="w-4 h-4 mr-2" /> Cerrar sesión
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}