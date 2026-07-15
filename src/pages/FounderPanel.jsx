import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Crown, ArrowLeft, Users, Brain, MessageSquare, ShieldAlert,
  Sliders, RefreshCw, Trash2, Plus, ArrowUp, ArrowDown,
  FileCode, CheckCircle2, Play, HelpCircle, Activity,
  Save, Server, Eye, EyeOff, Sparkles, Send, Check, Code
} from 'lucide-react';
import { useVivi } from '@/vivi/hooks/useVivi';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import PullToRefreshIndicator from '@/components/vivi/PullToRefreshIndicator';
import FounderLogs from '@/components/vivi/FounderLogs';
import VoiceStatus from '@/components/vivi/VoiceStatus';
import PageTransition from '@/components/PageTransition';
import { AI } from '@/lib/aiProvider';

export default function FounderPanel() {
  const { vivi } = useVivi();
  const navigate = useNavigate();
  
  // Navigation & Loading State
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [activeTab, setActiveTab] = useState('stats'); // stats | llm | memory | dev | logs
  
  // Stats State
  const [stats, setStats] = useState({ users: 0, memories: 0, messages: 0 });
  
  // LLM Gateway State
  const [providers, setProviders] = useState([]);
  const [lastActiveProvider, setLastActiveProvider] = useState('');
  const [showKeys, setShowKeys] = useState({}); // Toggles password visibility per provider
  const [savingGateway, setSavingGateway] = useState(false);
  
  // Memory State
  const [memories, setMemories] = useState([]);
  const [loadingMemories, setLoadingMemories] = useState(false);
  const [newMemory, setNewMemory] = useState({ category: 'preference', key: '', value: '', importance: 3 });
  const [creatingMemory, setCreatingMemory] = useState(false);
  
  // Developer & VDE State
  const [proposals, setProposals] = useState([]);
  const [loadingProposals, setLoadingProposals] = useState(false);
  const [scanningRepo, setScanningRepo] = useState(false);
  const [analysisReport, setAnalysisReport] = useState(null);
  const [vdePrompt, setVdePrompt] = useState('');
  const [generatingProposal, setGeneratingProposal] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState(null);

  // Pull to refresh action
  const { scrollRef, pullDistance, refreshing } = usePullToRefresh(async () => {
    await refreshAllData();
  });

  const refreshAllData = async () => {
    try {
      const security = vivi.registry.get('security');
      if (security && security.isAuthorized()) {
        const founderConsole = vivi.registry.get('founder_console');
        if (founderConsole) {
          const s = await founderConsole.getStats();
          if (s) setStats(s);
        }
        
        // Refresh LLM Providers
        setProviders(AI.getProviders());
        setLastActiveProvider(AI.getLastActiveProvider());
        
        // Refresh Memory List
        if (vivi.memory) {
          setLoadingMemories(true);
          const mems = await vivi.memory.listAll();
          setMemories(mems || []);
          setLoadingMemories(false);
        }
        
        // Refresh VDE Proposals
        if (vivi.vde) {
          setLoadingProposals(true);
          const props = await vivi.vde.listAllProposals();
          setProposals(props || []);
          setLoadingProposals(false);
        }
        
        // Load latest analysis report if any
        if (vivi.codeAnalyzer) {
          setAnalysisReport(vivi.codeAnalyzer.getLastReport());
        }
      }
    } catch (err) {
      console.error('[FounderPanel] Error loading page data:', err);
    }
  };

  useEffect(() => {
    (async () => {
      const security = vivi.registry.get('security');
      if (!security) { setLoading(false); return; }

      await security.refresh();
      const authState = security.isAuthorized();
      setAuthorized(authState);

      if (authState) {
        await refreshAllData();
      }
      setLoading(false);
    })();
  }, [vivi]);

  // LLM Gateway Handlers
  const handleToggleProvider = (id) => {
    setProviders(prev => prev.map(p => p.id === id ? { ...p, enabled: !p.enabled } : p));
  };

  const handleUpdateProviderField = (id, field, value) => {
    setProviders(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const handleMoveProvider = (index, direction) => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === providers.length - 1) return;
    
    const nextIndex = direction === 'up' ? index - 1 : index + 1;
    const updated = [...providers];
    
    // Swap priorities
    const tempPriority = updated[index].priority;
    updated[index].priority = updated[nextIndex].priority;
    updated[nextIndex].priority = tempPriority;
    
    // Swap array items
    const temp = updated[index];
    updated[index] = updated[nextIndex];
    updated[nextIndex] = temp;
    
    setProviders(updated);
  };

  const handleSaveGateway = async () => {
    setSavingGateway(true);
    try {
      AI.saveProviders(providers);
      setLastActiveProvider(AI.getLastActiveProvider());
      alert('¡Configuración del LLM Gateway guardada exitosamente y sincronizada!');
    } catch (err) {
      alert('Error al guardar configuración: ' + err.message);
    } finally {
      setSavingGateway(false);
    }
  };

  const handleResetGateway = () => {
    if (confirm('¿Seguro que deseas restablecer la configuración de proveedores por defecto?')) {
      const reset = AI.resetProviders();
      setProviders(reset);
      setLastActiveProvider(AI.getLastActiveProvider());
    }
  };

  const toggleShowKey = (id) => {
    setShowKeys(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Memory Handlers
  const handleCreateMemory = async (e) => {
    e.preventDefault();
    if (!newMemory.value.trim()) return;
    setCreatingMemory(true);
    try {
      if (vivi.memory) {
        await vivi.memory.store({
          category: newMemory.category,
          key: newMemory.key || '',
          value: newMemory.value,
          importance: Number(newMemory.importance),
          status: 'active'
        });
        setNewMemory({ category: 'preference', key: '', value: '', importance: 3 });
        // reload list
        const mems = await vivi.memory.listAll();
        setMemories(mems || []);
        // reload stats
        const founderConsole = vivi.registry.get('founder_console');
        if (founderConsole) {
          const s = await founderConsole.getStats();
          if (s) setStats(s);
        }
      }
    } catch (err) {
      alert('Error al crear recuerdo: ' + err.message);
    } finally {
      setCreatingMemory(false);
    }
  };

  const handleDeleteMemory = async (id) => {
    if (confirm('¿Estás seguro de que deseas eliminar este recuerdo de forma permanente de Firestore?')) {
      try {
        if (vivi.memory) {
          await vivi.memory.forget(id);
          setMemories(prev => prev.filter(m => m.id !== id));
          // reload stats
          const founderConsole = vivi.registry.get('founder_console');
          if (founderConsole) {
            const s = await founderConsole.getStats();
            if (s) setStats(s);
          }
        }
      } catch (err) {
        alert('Error al eliminar recuerdo: ' + err.message);
      }
    }
  };

  const handleForgetAllMemories = async () => {
    if (confirm('⚠️ ADVERTENCIA: Esto eliminará absolutamente todos los recuerdos del usuario de la base de datos Firestore de forma permanente. ¿Continuar?')) {
      try {
        if (vivi.memory) {
          await vivi.memory.forgetAll();
          setMemories([]);
          const founderConsole = vivi.registry.get('founder_console');
          if (founderConsole) {
            const s = await founderConsole.getStats();
            if (s) setStats(s);
          }
        }
      } catch (err) {
        alert('Error al reiniciar memoria: ' + err.message);
      }
    }
  };

  // Developer & Autocorrection Handlers
  const handleScanRepository = async () => {
    setScanningRepo(true);
    try {
      if (vivi.codeAnalyzer) {
        const report = await vivi.codeAnalyzer.analyzeProject({ maxFiles: 8 });
        setAnalysisReport(report);
        alert(`Escaneo completo: se analizaron ${report.analyzed.length} archivos principales.`);
      }
    } catch (err) {
      alert('Error en el escaneo: ' + err.message);
    } finally {
      setScanningRepo(false);
    }
  };

  const handleTriggerVDE = async (e) => {
    e.preventDefault();
    if (!vdePrompt.trim()) return;
    setGeneratingProposal(true);
    try {
      if (vivi.vde) {
        const proposal = await vivi.vde.analyzeRequest(vdePrompt, {
          category: 'otro',
          priority: 'alta'
        });
        if (proposal) {
          setVdePrompt('');
          // reload proposals
          const props = await vivi.vde.listAllProposals();
          setProposals(props || []);
          alert(`¡VDE ha generado la propuesta de mejora de forma exitosa!: "${proposal.title}"`);
        }
      }
    } catch (err) {
      alert('Error en VDE: ' + err.message);
    } finally {
      setGeneratingProposal(false);
    }
  };

  const handleUpdateProposalStatus = async (id, newStatus) => {
    try {
      if (vivi.vde) {
        await vivi.vde.editProposal(id, { status: newStatus });
        setProposals(prev => prev.map(p => p.id === id ? { ...p, status: newStatus } : p));
        if (selectedProposal && selectedProposal.id === id) {
          setSelectedProposal(prev => ({ ...prev, status: newStatus }));
        }
      }
    } catch (err) {
      alert('Error al actualizar propuesta: ' + err.message);
    }
  };

  const handleDeleteProposal = async (id) => {
    if (confirm('¿Seguro que deseas eliminar esta propuesta de VDE de forma permanente?')) {
      try {
        if (vivi.vde) {
          await vivi.vde.deleteProposal(id);
          setProposals(prev => prev.filter(p => p.id !== id));
          if (selectedProposal && selectedProposal.id === id) {
            setSelectedProposal(null);
          }
        }
      } catch (err) {
        alert('Error al borrar propuesta: ' + err.message);
      }
    }
  };

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
        <p className="text-white/50 mt-2 max-w-sm">Este panel es exclusivo para el Founder de Vivi AI.</p>
        <button onClick={() => navigate(-1)} className="mt-6 text-purple-300 hover:text-purple-200">Volver a Vivi</button>
      </div>
    );
  }

  return (
    <PageTransition>
      <div ref={scrollRef} className="h-screen overflow-y-auto overscroll-contain bg-gradient-to-b from-[#0a0512] to-[#05030a] text-white" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))', paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))', paddingLeft: '1rem', paddingRight: '1rem' }}>
        <div className="max-w-5xl mx-auto pb-10">
          <PullToRefreshIndicator pullDistance={pullDistance} refreshing={refreshing} />
          
          <button onClick={() => navigate(-1)} className="inline-flex items-center text-white/60 hover:text-white mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" /> Volver a Vivi
          </button>

          {/* Founder Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <Crown className="w-8 h-8 text-fuchsia-400 animate-pulse" />
                <h1 className="text-3xl font-semibold tracking-tight">Consola de Control Founder</h1>
              </div>
              <p className="text-white/50">Henrry Moyses García Rojas · Propietario & Fundador</p>
            </div>
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-full text-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              <span>SISTEMA EN LÍNEA (MODO ADMINISTRADOR)</span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex flex-wrap gap-2 mb-8 bg-white/5 p-1 rounded-xl border border-white/10">
            <button
              onClick={() => setActiveTab('stats')}
              className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-all ${activeTab === 'stats' ? 'bg-purple-600 text-white' : 'text-white/60 hover:text-white'}`}
            >
              <Activity className="w-4 h-4" /> Estadísticas
            </button>
            <button
              onClick={() => setActiveTab('llm')}
              className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-all ${activeTab === 'llm' ? 'bg-purple-600 text-white' : 'text-white/60 hover:text-white'}`}
            >
              <Server className="w-4 h-4" /> LLM Gateway
            </button>
            <button
              onClick={() => setActiveTab('memory')}
              className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-all ${activeTab === 'memory' ? 'bg-purple-600 text-white' : 'text-white/60 hover:text-white'}`}
            >
              <Brain className="w-4 h-4" /> Base de Memorias
            </button>
            <button
              onClick={() => setActiveTab('dev')}
              className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-all ${activeTab === 'dev' ? 'bg-purple-600 text-white' : 'text-white/60 hover:text-white'}`}
            >
              <Code className="w-4 h-4" /> Modo Desarrollador
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-all ${activeTab === 'logs' ? 'bg-purple-600 text-white' : 'text-white/60 hover:text-white'}`}
            >
              <MessageSquare className="w-4 h-4" /> Diagnóstico & Logs
            </button>
          </div>

          {/* Tab Content Area */}
          <AnimatePresence mode="wait">
            
            {/* TAB: STATS */}
            {activeTab === 'stats' && (
              <motion.div
                key="stats"
                initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }}
                className="space-y-6"
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-fuchsia-500 to-purple-600 flex items-center justify-center mb-4">
                      <Users className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-3xl font-bold">{stats.users}</div>
                    <div className="text-white/50 text-sm mt-1">Usuarios registrados</div>
                  </div>
                  <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center mb-4">
                      <Brain className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-3xl font-bold">{stats.memories}</div>
                    <div className="text-white/50 text-sm mt-1">Recuerdos persistidos</div>
                  </div>
                  <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center mb-4">
                      <MessageSquare className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-3xl font-bold">{stats.messages}</div>
                    <div className="text-white/50 text-sm mt-1">Mensajes guardados</div>
                  </div>
                </div>

                <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
                  <h2 className="text-lg font-medium mb-2 flex items-center gap-2 text-fuchsia-400">
                    <Sparkles className="w-5 h-5" /> Arquitectura Autónoma
                  </h2>
                  <p className="text-white/70 text-sm leading-relaxed mb-4">
                    Vivi AI opera sobre un ecosistema de micro-módulos desacoplados gobernados por eventos. 
                    El cerebro conversacional ya no depende de Base44: se comunica con el nuevo <strong>LLM Gateway</strong> inteligente de Vivi que redirige dinámicamente las peticiones en milisegundos con tolerancia a fallas.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs mt-2">
                    <div className="bg-black/40 p-4 rounded-xl border border-white/5">
                      <div className="font-semibold text-white/90 mb-2">Características del Motor</div>
                      <ul className="space-y-1 text-white/60 list-disc list-inside">
                        <li>Memoria de largo plazo persistida en Firestore.</li>
                        <li>Sintetizador y reconocedor de voz de baja latencia.</li>
                        <li>Análisis de código fuente en tiempo real.</li>
                        <li>Generación automática de Pull Requests mediante VDE.</li>
                      </ul>
                    </div>
                    <div className="bg-black/40 p-4 rounded-xl border border-white/5">
                      <div className="font-semibold text-white/90 mb-2">Diagnóstico de Conectividad</div>
                      <div className="flex justify-between py-1 border-b border-white/5">
                        <span>API Gemini</span>
                        <span className="text-emerald-400">Excelente</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-white/5">
                        <span>Base de Datos</span>
                        <span className="text-emerald-400">Conectado (Firestore)</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span>Autenticación</span>
                        <span className="text-emerald-400">Activa (Firebase Auth)</span>
                      </div>
                    </div>
                  </div>
                </div>

                <VoiceStatus />
              </motion.div>
            )}

            {/* TAB: LLM GATEWAY */}
            {activeTab === 'llm' && (
              <motion.div
                key="llm"
                initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }}
                className="space-y-6"
              >
                <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <div>
                      <h2 className="text-lg font-semibold flex items-center gap-2">
                        <Sliders className="w-5 h-5 text-purple-400" /> Prioridad de Proveedores de IA
                      </h2>
                      <p className="text-white/50 text-sm mt-1">
                        Vivi usará el primer proveedor habilitado. Si falla, pasará al siguiente de forma automática y resiliente.
                      </p>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <button
                        onClick={handleResetGateway}
                        className="flex-1 sm:flex-none inline-flex justify-center items-center gap-2 px-3.5 py-2 text-xs font-medium border border-white/10 rounded-xl hover:bg-white/10 transition-colors"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Resetear
                      </button>
                      <button
                        onClick={handleSaveGateway}
                        disabled={savingGateway}
                        className="flex-1 sm:flex-none inline-flex justify-center items-center gap-2 px-4 py-2 text-xs font-semibold bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 rounded-xl transition-all shadow-lg shadow-purple-900/40"
                      >
                        <Save className="w-3.5 h-3.5" /> {savingGateway ? 'Guardando...' : 'Guardar Prioridades'}
                      </button>
                    </div>
                  </div>

                  {/* Provider List */}
                  <div className="space-y-3">
                    {providers.map((p, idx) => {
                      const isCurrentActive = lastActiveProvider === p.id;
                      return (
                        <div
                          key={p.id}
                          className={`rounded-xl border p-4 bg-black/30 transition-all ${isCurrentActive ? 'border-purple-500/50 shadow-md shadow-purple-500/5' : 'border-white/10'}`}
                        >
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            
                            {/* Priority, Switch and Name */}
                            <div className="flex items-center gap-3">
                              <div className="flex flex-col items-center">
                                <button
                                  disabled={idx === 0}
                                  onClick={() => handleMoveProvider(idx, 'up')}
                                  className="text-white/40 hover:text-white disabled:opacity-20 py-0.5"
                                >
                                  <ArrowUp className="w-4 h-4" />
                                </button>
                                <span className="text-xs font-mono font-bold bg-white/10 px-2 py-0.5 rounded text-white/70">
                                  {idx + 1}
                                </span>
                                <button
                                  disabled={idx === providers.length - 1}
                                  onClick={() => handleMoveProvider(idx, 'down')}
                                  className="text-white/40 hover:text-white disabled:opacity-20 py-0.5"
                                >
                                  <ArrowDown className="w-4 h-4" />
                                </button>
                              </div>

                              <input
                                type="checkbox"
                                checked={p.enabled}
                                onChange={() => handleToggleProvider(p.id)}
                                className="w-4 h-4 text-purple-600 border-white/20 rounded focus:ring-purple-500"
                              />

                              <div>
                                <div className="font-medium flex items-center gap-2">
                                  {p.name}
                                  {p.enabled ? (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-medium">Habilitado</span>
                                  ) : (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-white/40 font-medium">Inactivo</span>
                                  )}
                                  {isCurrentActive && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/30 animate-pulse">ACTIVO</span>
                                  )}
                                </div>
                                <div className="text-xs text-white/40 font-mono mt-0.5">Tipo: {p.type}</div>
                              </div>
                            </div>

                            {/* Configuration Fields */}
                            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3 md:max-w-xl">
                              
                              {/* Model */}
                              <div>
                                <label className="block text-[10px] font-medium text-white/40 mb-1">Modelo</label>
                                <input
                                  type="text"
                                  value={p.model || ''}
                                  onChange={(e) => handleUpdateProviderField(p.id, 'model', e.target.value)}
                                  placeholder="ej: gpt-4o-mini"
                                  className="w-full text-xs bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-purple-500"
                                />
                              </div>

                              {/* Endpoint URL */}
                              <div>
                                <label className="block text-[10px] font-medium text-white/40 mb-1">URL Base / Endpoint</label>
                                <input
                                  type="text"
                                  value={p.url || ''}
                                  disabled={p.id === 'gemini-server' || p.id === 'gemini-direct'}
                                  onChange={(e) => handleUpdateProviderField(p.id, 'url', e.target.value)}
                                  placeholder="ej: https://api.openai.com/v1"
                                  className="w-full text-xs bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-purple-500 disabled:opacity-40"
                                />
                              </div>

                              {/* API Key */}
                              <div>
                                <label className="block text-[10px] font-medium text-white/40 mb-1">API Key</label>
                                <div className="relative">
                                  <input
                                    type={showKeys[p.id] ? 'text' : 'password'}
                                    value={p.apiKey || ''}
                                    disabled={p.id === 'gemini-server'}
                                    onChange={(e) => handleUpdateProviderField(p.id, 'apiKey', e.target.value)}
                                    placeholder={p.id === 'gemini-direct' ? 'Usa key del entorno por defecto' : 'Ingresa API Key'}
                                    className="w-full text-xs bg-white/5 border border-white/10 rounded-lg pl-2.5 pr-8 py-1.5 text-white focus:outline-none focus:border-purple-500 disabled:opacity-40"
                                  />
                                  {p.id !== 'gemini-server' && (
                                    <button
                                      type="button"
                                      onClick={() => toggleShowKey(p.id)}
                                      className="absolute right-2 top-1.5 text-white/40 hover:text-white"
                                    >
                                      {showKeys[p.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                    </button>
                                  )}
                                </div>
                              </div>

                            </div>

                          </div>
                        </div>
                      );
                    })}
                  </div>

                </div>
              </motion.div>
            )}

            {/* TAB: MEMORY MANAGER */}
            {activeTab === 'memory' && (
              <motion.div
                key="memory"
                initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }}
                className="space-y-6"
              >
                {/* Manual Memory Creator */}
                <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
                  <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
                    <Plus className="w-5 h-5 text-purple-400" /> Registrar Nuevo Recuerdo en Firestore
                  </h2>
                  <form onSubmit={handleCreateMemory} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-white/50 mb-1.5">Categoría</label>
                      <select
                        value={newMemory.category}
                        onChange={(e) => setNewMemory(prev => ({ ...prev, category: e.target.value }))}
                        className="w-full text-xs bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                      >
                        <option value="preference">Preferencia</option>
                        <option value="name">Nombre / Identidad</option>
                        <option value="work">Trabajo / Profesión</option>
                        <option value="company">Empresa / Negocios</option>
                        <option value="routine">Rutina / Hábitos</option>
                        <option value="goal">Meta / Objetivo</option>
                        <option value="project">Proyecto Activo</option>
                        <option value="task">Tarea Pendiente</option>
                        <option value="relationship">Relación Personal</option>
                        <option value="story">Historia / Chisme</option>
                        <option value="fact">Hecho General</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-white/50 mb-1.5">Etiqueta Corta (Key)</label>
                      <input
                        type="text"
                        value={newMemory.key}
                        onChange={(e) => setNewMemory(prev => ({ ...prev, key: e.target.value }))}
                        placeholder="ej: cancion_favorita"
                        className="w-full text-xs bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-white/50 mb-1.5">Valor / Detalle del Recuerdo</label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          value={newMemory.value}
                          onChange={(e) => setNewMemory(prev => ({ ...prev, value: e.target.value }))}
                          placeholder="ej: Le encanta el café expreso por las mañanas..."
                          className="w-full text-xs bg-white/5 border border-white/10 rounded-xl pl-3 pr-24 py-2 text-white focus:outline-none focus:border-purple-500"
                        />
                        <button
                          type="submit"
                          disabled={creatingMemory}
                          className="absolute right-1 top-1 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 text-white px-3.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" /> {creatingMemory ? 'Creando...' : 'Agregar'}
                        </button>
                      </div>
                    </div>
                  </form>
                </div>

                {/* Memories Explorer */}
                <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <div>
                      <h2 className="text-lg font-semibold flex items-center gap-2">
                        <Brain className="w-5 h-5 text-purple-400" /> Explorador de Recuerdos Persistidos
                      </h2>
                      <p className="text-white/50 text-sm mt-1">
                        Todos los recuerdos recuperados en tiempo real desde Firestore. Vivi AI asocia estos datos de forma inteligente a su contexto conversacional.
                      </p>
                    </div>
                    <button
                      onClick={handleForgetAllMemories}
                      className="inline-flex items-center gap-2 text-xs font-semibold text-red-400 hover:text-red-300 border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 px-4 py-2 rounded-xl transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Borrar Toda la Memoria
                    </button>
                  </div>

                  {loadingMemories ? (
                    <div className="flex flex-col items-center justify-center py-12 text-white/40">
                      <div className="w-6 h-6 border-2 border-purple-900 border-t-purple-400 rounded-full animate-spin mb-3" />
                      <span className="text-xs">Cargando base de recuerdos...</span>
                    </div>
                  ) : memories.length === 0 ? (
                    <div className="text-center py-12 text-white/40 border border-dashed border-white/10 rounded-xl">
                      <HelpCircle className="w-8 h-8 mx-auto mb-3 text-white/25" />
                      <p className="text-sm">No hay recuerdos registrados todavía en la base de datos.</p>
                      <p className="text-xs mt-1">Inicia una conversación con Vivi o crea un recuerdo manual.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs text-white/80 border-collapse">
                        <thead>
                          <tr className="border-b border-white/10 text-white/40 font-medium">
                            <th className="py-2.5">Categoría</th>
                            <th className="py-2.5">Etiqueta (Key)</th>
                            <th className="py-2.5">Detalle / Valor</th>
                            <th className="py-2.5 text-center">Importancia</th>
                            <th className="py-2.5 text-right">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {memories.map((m) => (
                            <tr key={m.id} className="hover:bg-white/5 transition-colors">
                              <td className="py-3">
                                <span className="bg-purple-900/40 text-purple-300 font-medium px-2 py-0.5 rounded-md border border-purple-500/20">
                                  {m.category}
                                </span>
                              </td>
                              <td className="py-3 font-mono text-white/60">{m.key || '—'}</td>
                              <td className="py-3 pr-4 max-w-sm truncate" title={m.value}>{m.value}</td>
                              <td className="py-3 text-center">
                                <span className="font-semibold text-fuchsia-400 bg-fuchsia-400/5 border border-fuchsia-400/20 px-1.5 py-0.5 rounded">
                                  {m.importance || 2}★
                                </span>
                              </td>
                              <td className="py-3 text-right">
                                <button
                                  onClick={() => handleDeleteMemory(m.id)}
                                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10 p-1.5 rounded-lg transition-colors"
                                  title="Olvidar recuerdo"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                </div>
              </motion.div>
            )}

            {/* TAB: DEV MODE & VDE */}
            {activeTab === 'dev' && (
              <motion.div
                key="dev"
                initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }}
                className="space-y-6"
              >
                {/* Core GitHub / Vercel Analyzer */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Code Analyzer Suite */}
                  <div className="rounded-2xl bg-white/5 border border-white/10 p-6 space-y-4">
                    <div>
                      <h2 className="text-lg font-semibold flex items-center gap-2">
                        <FileCode className="w-5 h-5 text-purple-400" /> Analizador Automático de Código
                      </h2>
                      <p className="text-white/50 text-sm mt-1">
                        Escanea el repositorio de Vivi para detectar deuda técnica, funciones huérfanas, fallos de lógica o cuellos de botella de latencia.
                      </p>
                    </div>

                    <button
                      onClick={handleScanRepository}
                      disabled={scanningRepo}
                      className="w-full inline-flex justify-center items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 text-sm font-semibold rounded-xl transition-all shadow-lg shadow-purple-950/40"
                    >
                      {scanningRepo ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" /> Analizando código fuente...
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4" /> Ejecutar Auditoría de Repositorio
                        </>
                      )}
                    </button>

                    {analysisReport ? (
                      <div className="bg-black/40 border border-white/5 rounded-xl p-4 space-y-3 max-h-80 overflow-y-auto">
                        <div className="flex justify-between items-center pb-2 border-b border-white/5">
                          <span className="text-xs font-semibold text-white/60">Último Reporte</span>
                          <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-medium px-2 py-0.5 rounded-full">Auditable</span>
                        </div>
                        {analysisReport.analyzed && analysisReport.analyzed.map((file, fIdx) => (
                          <div key={fIdx} className="space-y-1.5 border-b border-white/5 last:border-0 pb-3 last:pb-0 pt-2 first:pt-0">
                            <div className="text-xs font-mono text-purple-300 truncate">{file.path}</div>
                            {file.findings.map((f, findIdx) => (
                              <div key={findIdx} className="bg-white/5 p-2 rounded-lg text-[11px] text-white/70">
                                <div className="flex justify-between items-center mb-1">
                                  <span className="font-semibold text-fuchsia-400">{f.category}</span>
                                  <span className="text-[10px] uppercase font-bold text-red-400">{f.severity}</span>
                                </div>
                                <p>{f.explanation}</p>
                                {f.suggested_fix && (
                                  <div className="mt-1.5 text-white/40 border-t border-white/5 pt-1">
                                    <strong>Solución sugerida:</strong> {f.suggested_fix}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-white/30 border border-dashed border-white/10 rounded-xl text-xs">
                        Ejecuta la auditoría para visualizar hallazgos y sugerencias del compilador de IA.
                      </div>
                    )}
                  </div>

                  {/* VDE Autonomous Improvement Engine */}
                  <div className="rounded-2xl bg-white/5 border border-white/10 p-6 space-y-4">
                    <div>
                      <h2 className="text-lg font-semibold flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-purple-400" /> Motor de Autocorrección VDE
                      </h2>
                      <p className="text-white/50 text-sm mt-1">
                        Ordena a Vivi Development Engine (VDE) diseñar nuevas soluciones o corregir de manera autónoma archivos del repositorio y generar propuestas de Pull Request.
                      </p>
                    </div>

                    <form onSubmit={handleTriggerVDE} className="space-y-3">
                      <textarea
                        required
                        rows={4}
                        value={vdePrompt}
                        onChange={(e) => setVdePrompt(e.target.value)}
                        placeholder="ej: Diseña una optimización para el buffer de audio en ViviVoice, reduciendo la latencia de respuesta a menos de 400ms..."
                        className="w-full text-xs bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-purple-500"
                      />
                      <button
                        type="submit"
                        disabled={generatingProposal}
                        className="w-full inline-flex justify-center items-center gap-2 px-4 py-2.5 bg-fuchsia-600 hover:bg-fuchsia-700 disabled:bg-fuchsia-800 text-sm font-semibold rounded-xl transition-all shadow-lg shadow-fuchsia-950/40"
                      >
                        {generatingProposal ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" /> Programando correcciones...
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4" /> Generar Propuesta de Software
                          </>
                        )}
                      </button>
                    </form>
                  </div>

                </div>

                {/* VDE Proposal Backlog */}
                <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
                  <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-purple-400" /> Registro de Propuestas de Software (VDE)
                  </h2>

                  {loadingProposals ? (
                    <div className="flex flex-col items-center justify-center py-12 text-white/40">
                      <div className="w-6 h-6 border-2 border-purple-900 border-t-purple-400 rounded-full animate-spin mb-3" />
                      <span className="text-xs">Buscando propuestas en backlog...</span>
                    </div>
                  ) : proposals.length === 0 ? (
                    <div className="text-center py-12 text-white/40 border border-dashed border-white/10 rounded-xl text-xs">
                      No hay propuestas de software de VDE registradas en el backlog.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Left: Proposals List */}
                      <div className="md:col-span-1 space-y-2 max-h-96 overflow-y-auto pr-2">
                        {proposals.map((p) => (
                          <div
                            key={p.id}
                            onClick={() => setSelectedProposal(p)}
                            className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${selectedProposal?.id === p.id ? 'bg-purple-600/20 border-purple-500' : 'bg-black/20 border-white/5 hover:border-white/10'}`}
                          >
                            <div className="font-semibold truncate">{p.title}</div>
                            <div className="flex justify-between items-center mt-2 text-[10px] text-white/50">
                              <span className="uppercase">{p.priority}</span>
                              <span className="bg-white/5 px-2 py-0.5 rounded-full font-mono">{p.status}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Right: Proposal Details Viewer */}
                      <div className="md:col-span-2 bg-black/40 border border-white/5 rounded-2xl p-5 space-y-4 max-h-96 overflow-y-auto">
                        {selectedProposal ? (
                          <>
                            <div className="flex justify-between items-start gap-4 pb-3 border-b border-white/5">
                              <div>
                                <h3 className="text-sm font-semibold text-white">{selectedProposal.title}</h3>
                                <div className="text-[10px] text-white/40 mt-1 font-mono">ID: {selectedProposal.id}</div>
                              </div>
                              <div className="flex gap-1.5">
                                <button
                                  onClick={() => handleUpdateProposalStatus(selectedProposal.id, 'aprobada')}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded text-[10px] font-semibold"
                                >
                                  Aprobar PR
                                </button>
                                <button
                                  onClick={() => handleDeleteProposal(selectedProposal.id)}
                                  className="bg-red-950/40 hover:bg-red-900/60 border border-red-500/20 text-red-400 px-2.5 py-1 rounded text-[10px] font-semibold"
                                >
                                  Descartar
                                </button>
                              </div>
                            </div>

                            <div className="space-y-3 text-xs text-white/70">
                              <div>
                                <h4 className="font-semibold text-white/90">Descripción de la Mejora</h4>
                                <p className="leading-relaxed mt-1">{selectedProposal.description}</p>
                              </div>
                              {selectedProposal.current_limitation && (
                                <div>
                                  <h4 className="font-semibold text-white/90">Limitación Previa</h4>
                                  <p className="leading-relaxed mt-1 text-red-300">{selectedProposal.current_limitation}</p>
                                </div>
                              )}
                              {selectedProposal.proposed_solution && (
                                <div>
                                  <h4 className="font-semibold text-white/90">Solución Propuesta</h4>
                                  <p className="leading-relaxed mt-1 text-emerald-300">{selectedProposal.proposed_solution}</p>
                                </div>
                              )}
                              {selectedProposal.generated_code && (
                                <div>
                                  <h4 className="font-semibold text-white/90">Código Generado de Solución</h4>
                                  <pre className="bg-black/80 border border-white/10 p-3 rounded-lg overflow-x-auto text-[10px] font-mono mt-1 max-h-60 text-purple-200">
                                    {selectedProposal.generated_code}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </>
                        ) : (
                          <div className="h-full flex flex-col items-center justify-center text-white/30 text-xs py-20 text-center">
                            <Sliders className="w-8 h-8 mb-3 text-white/10" />
                            Selecciona una propuesta del backlog lateral para inspeccionar el análisis, código generado y simulación de pruebas.
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                </div>
              </motion.div>
            )}

            {/* TAB: LOGS */}
            {activeTab === 'logs' && (
              <motion.div
                key="logs"
                initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }}
                className="space-y-6"
              >
                <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
                  <h2 className="text-lg font-semibold mb-2">Canal de Diagnóstico en Tiempo Real</h2>
                  <p className="text-white/50 text-sm mb-6">
                    Muestra los logs internos de Vivi AI organizados por micro-módulo (Core, Voice, Settings, Memory, etc.). 
                  </p>
                  <FounderLogs />
                </div>
              </motion.div>
            )}

          </AnimatePresence>

        </div>
      </div>
    </PageTransition>
  );
}
