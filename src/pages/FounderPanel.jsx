import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Crown, ArrowLeft, Users, Brain, MessageSquare, ShieldAlert } from 'lucide-react';
import { useVivi } from '@/vivi/hooks/useVivi';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import PullToRefreshIndicator from '@/components/vivi/PullToRefreshIndicator';
import FounderLogs from '@/components/vivi/FounderLogs';
import VoiceStatus from '@/components/vivi/VoiceStatus';
import PageTransition from '@/components/PageTransition';

// Reads data from ViviFounderConsole module via useVivi. Contains NO business logic.
export default function FounderPanel() {
  const { vivi, user } = useVivi();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ users: 0, memories: 0, messages: 0 });
  const [authorized, setAuthorized] = useState(false);

  const { scrollRef, pullDistance, refreshing } = usePullToRefresh(async () => {
    const founderConsole = vivi.registry.get('founder_console');
    if (founderConsole && authorized) {
      const s = await founderConsole.getStats();
      if (s) setStats(s);
    }
  });

  useEffect(() => {
    (async () => {
      const security = vivi.registry.get('security');
      const founderConsole = vivi.registry.get('founder_console');
      if (!security) { setLoading(false); return; }

      await security.refresh();
      setAuthorized(security.isAuthorized());

      if (security.isAuthorized() && founderConsole) {
        const s = await founderConsole.getStats();
        if (s) setStats(s);
      }
      setLoading(false);
    })();
  }, [vivi]);

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#07040f]">
        <div className="w-8 h-8 border-4 border-purple-900 border-t-purple-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#07040f] text-white px-6 text-center" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <ShieldAlert className="w-12 h-12 text-red-400 mb-4" />
        <h1 className="text-xl font-semibold">Acceso restringido</h1>
        <p className="text-white/50 mt-2 max-w-sm">Este panel es exclusivo para el Founder de HRYET.</p>
        <button onClick={() => navigate(-1)} className="mt-6 text-purple-300 hover:text-purple-200">Volver a Vivi</button>
      </div>
    );
  }

  const cards = [
    { icon: Users, label: 'Usuarios', value: stats.users, color: 'from-fuchsia-500 to-purple-600' },
    { icon: Brain, label: 'Memorias', value: stats.memories, color: 'from-purple-500 to-indigo-600' },
    { icon: MessageSquare, label: 'Mensajes', value: stats.messages, color: 'from-indigo-500 to-blue-600' },
  ];

  return (
    <PageTransition>
    <div ref={scrollRef} className="h-screen overflow-y-auto overscroll-contain bg-gradient-to-b from-[#0a0512] to-[#05030a] text-white" style={{ paddingTop: 'calc(1.5rem + env(safe-area-inset-top))', paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
      <div className="max-w-4xl mx-auto">
        <PullToRefreshIndicator pullDistance={pullDistance} refreshing={refreshing} />
        <button onClick={() => navigate(-1)} className="inline-flex items-center text-white/60 hover:text-white mb-8">
          <ArrowLeft className="w-4 h-4 mr-2" /> Volver a Vivi
        </button>

        <div className="flex items-center gap-3 mb-2">
          <Crown className="w-7 h-7 text-fuchsia-400" />
          <h1 className="text-3xl font-semibold tracking-tight">Panel Founder</h1>
        </div>
        <p className="text-white/50 mb-10">Henrry Moyses García Rojas · Fundador de HRYET</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {cards.map((c, i) => (
            <motion.div
              key={c.label}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              className="rounded-2xl bg-white/5 border border-white/10 p-6"
            >
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center mb-4`}>
                <c.icon className="w-5 h-5 text-white" />
              </div>
              <div className="text-3xl font-bold">{c.value}</div>
              <div className="text-white/50 text-sm mt-1">{c.label}</div>
            </motion.div>
          ))}
        </div>

        <div className="mt-10 rounded-2xl bg-white/5 border border-white/10 p-6">
          <h2 className="text-lg font-medium mb-2">Arquitectura modular</h2>
          <p className="text-white/50 text-sm leading-relaxed">
            Vivi AI funciona con 13 módulos independientes conectados por un bus de eventos interno.
            Cada módulo (Core, Voice, Avatar, Memory, Knowledge, Integrations, Notifications, Settings,
            FounderConsole, Analytics, Security, API, Logger) puede actualizarse sin afectar a los demás.
            El acceso a este panel se controla mediante el módulo ViviSecurity.
          </p>
        </div>

        <VoiceStatus />

        <FounderLogs />
      </div>
    </div>
    </PageTransition>
  );
}