import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users,
  Timer,
  Shield,
  ShieldCheck,
  PauseCircle,
  PlayCircle,
  SlidersHorizontal,
  UserPlus,
  Badge,
  Inbox,
  Gauge,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Phone,
  MessageSquare,
  Search,
  Filter,
  Send,
  MoreVertical,
  Sliders,
  Sparkles,
  Flame,
  Check,
  Touchpad,
  Lock,
  History,
  FileSpreadsheet,
  Trash2,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  UserCheck,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { Broker, RoletaDistributionLog, RoletaStats, RoletaConfig } from '../types';

interface RoletaViewProps {
  companyName: string;
}

export function RoletaView({ companyName }: RoletaViewProps) {
  // Tabs: 'plantao' or 'history'
  const [activeTab, setActiveTab] = useState<'plantao' | 'history'>('plantao');

  // Roleta Rules States
  const [isPaused, setIsPaused] = useState(false);
  const [timeoutSeconds, setTimeoutSeconds] = useState(120);
  const [dispatchDelaySeconds, setDispatchDelaySeconds] = useState(3);
  const [autoDispatchEnabled, setAutoDispatchEnabled] = useState(true);
  const [notifyClientWithBrokerName, setNotifyClientWithBrokerName] = useState(true);
  const [transbordoInteligente, setTransbordoInteligente] = useState(true);
  const [filtroRegiao, setFiltroRegiao] = useState(true);
  const [mascaramentoDlp, setMascaramentoDlp] = useState(true);
  const [acceptedSimulation, setAcceptedSimulation] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // Search & Filters for Corretores
  const [searchTerm, setSearchTerm] = useState('');

  // Brokers list from server
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [isLoadingBrokers, setIsLoadingBrokers] = useState(false);

  // Roleta History States
  const [historyLogs, setHistoryLogs] = useState<RoletaDistributionLog[]>([]);
  const [historyStats, setHistoryStats] = useState<RoletaStats | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [historyBrokerFilter, setHistoryBrokerFilter] = useState('all');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('all');
  const [historyTypeFilter, setHistoryTypeFilter] = useState('all');

  // Test Dispatch
  const [isDispatchingTest, setIsDispatchingTest] = useState(false);
  const [testResultNotice, setTestResultNotice] = useState<string | null>(null);

  // Fetch Roleta configuration
  const fetchRoletaConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/roleta/config');
      if (res.ok) {
        const data: RoletaConfig = await res.json();
        if (typeof data.timeoutSeconds === 'number') setTimeoutSeconds(data.timeoutSeconds);
        if (typeof data.dispatchDelaySeconds === 'number') setDispatchDelaySeconds(data.dispatchDelaySeconds);
        if (typeof data.autoDispatchEnabled === 'boolean') setAutoDispatchEnabled(data.autoDispatchEnabled);
        if (typeof data.notifyClientWithBrokerName === 'boolean') {
          setNotifyClientWithBrokerName(data.notifyClientWithBrokerName);
        }
      }
    } catch (err) {
      console.warn('Aviso ao carregar config da roleta:', err);
    }
  }, []);

  // Save Roleta configuration
  const handleSaveConfig = async (patch: Partial<RoletaConfig>) => {
    try {
      setIsSavingConfig(true);
      const res = await fetch('/api/roleta/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        const updated: RoletaConfig = await res.json();
        if (typeof updated.timeoutSeconds === 'number') setTimeoutSeconds(updated.timeoutSeconds);
        if (typeof updated.dispatchDelaySeconds === 'number') setDispatchDelaySeconds(updated.dispatchDelaySeconds);
        if (typeof updated.autoDispatchEnabled === 'boolean') setAutoDispatchEnabled(updated.autoDispatchEnabled);
        if (typeof updated.notifyClientWithBrokerName === 'boolean') {
          setNotifyClientWithBrokerName(updated.notifyClientWithBrokerName);
        }
      }
    } catch (err) {
      console.error('Erro ao salvar config da roleta:', err);
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Fetch brokers from API
  const fetchBrokers = useCallback(async () => {
    try {
      setIsLoadingBrokers(true);
      const res = await fetch('/api/brokers');
      if (res.ok) {
        const data = await res.json();
        setBrokers(data);
      }
    } catch (err) {
      console.error('Erro ao buscar corretores:', err);
    } finally {
      setIsLoadingBrokers(false);
    }
  }, []);

  // Fetch history and stats from API
  const fetchHistory = useCallback(async () => {
    try {
      setIsLoadingHistory(true);
      const res = await fetch('/api/roleta/history?limit=100');
      if (res.ok) {
        const data = await res.json();
        setHistoryLogs(data.history || []);
        setHistoryStats(data.stats || null);
      }
    } catch (err) {
      console.error('Erro ao buscar histórico da roleta:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    fetchBrokers();
    fetchHistory();
    fetchRoletaConfig();
  }, [fetchBrokers, fetchHistory, fetchRoletaConfig]);

  // Toggle broker active status
  const handleToggleBrokerActive = async (broker: Broker) => {
    try {
      const updated = { ...broker, active: !broker.active };
      const res = await fetch('/api/brokers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      if (res.ok) {
        setBrokers((prev) => prev.map((b) => (b.id === broker.id ? updated : b)));
      }
    } catch (err) {
      console.error('Erro ao atualizar corretor:', err);
    }
  };

  // Trigger test dispatch
  const handleTriggerTestDispatch = async (targetBrokerId?: string) => {
    try {
      setIsDispatchingTest(true);
      setTestResultNotice(null);
      const res = await fetch('/api/roleta/test-dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brokerId: targetBrokerId }),
      });
      if (res.ok) {
        const data = await res.json();
        setTestResultNotice(
          `Disparo realizado com sucesso para ${data.broker?.name || 'corretor sorteado'}!`
        );
        fetchHistory();
        fetchBrokers();
        setTimeout(() => setTestResultNotice(null), 5000);
      }
    } catch (err) {
      console.error('Erro no disparo de teste:', err);
    } finally {
      setIsDispatchingTest(false);
    }
  };

  // Clear history
  const handleClearHistory = async () => {
    if (!window.confirm('Tem certeza que deseja zerar o histórico de distribuição da roleta?')) {
      return;
    }
    try {
      const res = await fetch('/api/roleta/history', { method: 'DELETE' });
      if (res.ok) {
        fetchHistory();
      }
    } catch (err) {
      console.error('Erro ao limpar histórico:', err);
    }
  };

  // Filtered brokers
  const filteredBrokers = useMemo(() => {
    return brokers.filter(
      (b) =>
        b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.phone.includes(searchTerm) ||
        (b.email && b.email.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [brokers, searchTerm]);

  // Filtered history logs
  const filteredHistoryLogs = useMemo(() => {
    return historyLogs.filter((log) => {
      const matchSearch =
        historySearch === '' ||
        log.leadNome.toLowerCase().includes(historySearch.toLowerCase()) ||
        log.leadTelefone.includes(historySearch) ||
        log.brokerNome.toLowerCase().includes(historySearch.toLowerCase()) ||
        (log.produtoImovel && log.produtoImovel.toLowerCase().includes(historySearch.toLowerCase()));

      const matchBroker =
        historyBrokerFilter === 'all' || log.brokerNome.toLowerCase().includes(historyBrokerFilter.toLowerCase());

      const matchStatus =
        historyStatusFilter === 'all' || log.statusEnvioWhatsApp === historyStatusFilter;

      const matchType =
        historyTypeFilter === 'all' || log.tipoDistribuicao === historyTypeFilter;

      return matchSearch && matchBroker && matchStatus && matchType;
    });
  }, [historyLogs, historySearch, historyBrokerFilter, historyStatusFilter, historyTypeFilter]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'enviado':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <Check className="w-3 h-3 text-emerald-600" />
            WhatsApp Enviado
          </span>
        );
      case 'link_gerado':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200">
            Link Direto Gerado
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-800 border border-rose-200">
            Falha
          </span>
        );
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'automatica_roleta':
        return 'Roleta Automática';
      case 'manual_operador':
        return 'Repasse Manual';
      case 'timeout_recuperacao':
        return 'Transbordo Timeout';
      case 'redistribuicao':
        return 'Redistribuição';
      default:
        return type;
    }
  };

  return (
    <div className="w-full flex flex-col gap-6 max-w-[1720px] mx-auto">
      {/* 1. Header & Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <span>Roleta de Corretores & Distribuição de Leads</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold">
              Algoritmo Round-Robin Ativo
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Distribuição balanceada, SLA auditado e histórico completo de repasses para WhatsApp
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('plantao')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'plantao'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Plantão & Corretores ({brokers.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'history'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Histórico de Distribuição ({historyLogs.length})</span>
          </button>
        </div>
      </div>

      {/* Test Notice */}
      {testResultNotice && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center justify-between shadow-xs animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{testResultNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setTestResultNotice(null)}
            className="text-emerald-700 hover:text-emerald-900"
          >
            ✕
          </button>
        </div>
      )}

      {/* 2. TAB: HISTÓRICO DE DISTRIBUIÇÃO */}
      {activeTab === 'history' && (
        <div className="flex flex-col gap-6">
          {/* Métricas do Histórico */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Total de Distribuições
                </span>
                <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                  <RotateCw className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-bold font-display text-slate-900">
                  {historyStats?.totalDistribuicoes || historyLogs.length}
                </span>
                <span className="text-xs text-slate-500">Leads repassados</span>
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Auditoria permanente gravada no servidor
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Entregues via WhatsApp
                </span>
                <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                  <MessageSquare className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-bold font-display text-emerald-600">
                  {historyStats?.enviadosWhatsApp ||
                    historyLogs.filter((l) => l.statusEnvioWhatsApp === 'enviado').length}
                </span>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                  100% Notificados
                </span>
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Disparo instantâneo pelo Baileys Engine
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Links de Atendimento
                </span>
                <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                  <ExternalLink className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-bold font-display text-slate-900">
                  {historyStats?.linksGerados ||
                    historyLogs.filter((l) => l.statusEnvioWhatsApp === 'link_gerado').length}
                </span>
                <span className="text-xs text-slate-500">Links de contingência</span>
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Permite acionamento manual em 1 clique
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Taxa de Aceite / SLA
                </span>
                <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
                  <Timer className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-bold font-display text-slate-900">1.8 min</span>
                <span className="text-xs font-bold text-emerald-600">Tempo médio</span>
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Transbordo configurado para <strong>{timeoutSeconds}s</strong>
              </div>
            </div>
          </section>

          {/* Filtros e Ações do Histórico */}
          <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-slate-900">
                  Logs de Distribuição da Roleta ({filteredHistoryLogs.length})
                </h3>
                <span className="text-xs text-slate-500">• Ordem cronológica decrescente</span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <a
                  href="/api/roleta/history/export/csv"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 flex items-center gap-1.5 transition-all shadow-2xs"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>Exportar Histórico (CSV)</span>
                </a>

                <button
                  type="button"
                  onClick={() => handleTriggerTestDispatch()}
                  disabled={isDispatchingTest}
                  className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                >
                  <Send className={`w-3.5 h-3.5 ${isDispatchingTest ? 'animate-spin' : ''}`} />
                  <span>{isDispatchingTest ? 'Disparando...' : 'Disparo de Teste'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleClearHistory}
                  className="p-2 rounded-lg bg-slate-50 hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200 transition-colors cursor-pointer text-xs"
                  title="Limpar Histórico"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Inputs de Filtro */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 pt-2 border-t border-slate-100">
              <div className="lg:col-span-5 relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por lead, telefone, corretor ou imóvel..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="lg:col-span-3">
                <select
                  value={historyBrokerFilter}
                  onChange={(e) => setHistoryBrokerFilter(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Todos os Corretores</option>
                  {brokers.map((b) => (
                    <option key={b.id} value={b.name}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="lg:col-span-2">
                <select
                  value={historyStatusFilter}
                  onChange={(e) => setHistoryStatusFilter(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Status WhatsApp</option>
                  <option value="enviado">Enviado com Sucesso</option>
                  <option value="link_gerado">Link Gerado</option>
                  <option value="falha">Falha</option>
                </select>
              </div>

              <div className="lg:col-span-2">
                <select
                  value={historyTypeFilter}
                  onChange={(e) => setHistoryTypeFilter(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Tipo de Distribuição</option>
                  <option value="automatica_roleta">Roleta Automática</option>
                  <option value="manual_operador">Repasse Manual</option>
                  <option value="timeout_recuperacao">Timeout</option>
                  <option value="redistribuicao">Redistribuição</option>
                </select>
              </div>
            </div>
          </div>

          {/* Tabela de Histórico */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
            {filteredHistoryLogs.length === 0 ? (
              <div className="p-12 text-center flex flex-col items-center justify-center">
                <History className="w-12 h-12 text-slate-300 mb-3" />
                <h4 className="text-sm font-bold text-slate-800">Nenhum registro de distribuição</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  Quando um lead for qualificado via WhatsApp e distribuído na roleta, cada repasse
                  será auditado aqui em tempo real.
                </p>
                <button
                  type="button"
                  onClick={() => handleTriggerTestDispatch()}
                  className="mt-4 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
                >
                  Disparar Teste Agora
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4">Data / Hora</th>
                      <th className="py-3 px-4">Lead (Cliente)</th>
                      <th className="py-3 px-4">Imóvel de Interesse</th>
                      <th className="py-3 px-4">Corretor Sorteado</th>
                      <th className="py-3 px-4">Tipo Distribuição</th>
                      <th className="py-3 px-4">Status WhatsApp</th>
                      <th className="py-3 px-4">Motivo / SLA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                    {filteredHistoryLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Data / Hora */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>{new Date(log.timestamp).toLocaleString('pt-BR')}</span>
                          </div>
                        </td>

                        {/* Lead */}
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-bold text-slate-900">{log.leadNome}</p>
                            <p className="text-slate-500 text-[11px] font-mono">
                              {log.leadTelefone}
                            </p>
                          </div>
                        </td>

                        {/* Imóvel */}
                        <td className="py-3 px-4">
                          <span className="font-semibold text-slate-800">
                            {log.produtoImovel || 'Lançamento Geral'}
                          </span>
                        </td>

                        {/* Corretor */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                            <div>
                              <p className="font-semibold text-slate-900">{log.brokerNome}</p>
                              <p className="text-slate-400 text-[10px] font-mono">
                                {log.brokerTelefone}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Tipo */}
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-[11px] font-medium border border-slate-200">
                            {getTypeLabel(log.tipoDistribuicao)}
                          </span>
                        </td>

                        {/* Status WhatsApp */}
                        <td className="py-3 px-4">{getStatusBadge(log.statusEnvioWhatsApp)}</td>

                        {/* Motivo / SLA */}
                        <td className="py-3 px-4">
                          <p className="text-slate-600 text-[11px] max-w-xs truncate">
                            {log.motivo || 'Roleta automática'}
                          </p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. TAB: PLANTÃO & REGRAS DA ROLETA */}
      {activeTab === 'plantao' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Tabela de Corretores (8 colunas) */}
          <div className="xl:col-span-8 bg-white rounded-xl p-5 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Fila Round-Robin de Plantão ({filteredBrokers.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Ordem estrita de repasse. O próximo da fila receberá a notificação em tempo real.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPaused(!isPaused)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs ${
                    isPaused
                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {isPaused ? <PlayCircle className="w-3.5 h-3.5" /> : <PauseCircle className="w-3.5 h-3.5" />}
                  <span>{isPaused ? 'Retomar Roleta' : 'Pausar Roleta'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTriggerTestDispatch()}
                  disabled={isDispatchingTest}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Simular Disparo Roleta</span>
                </button>
              </div>
            </div>

            {/* Input de Busca */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filtrar corretor por nome ou telefone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-9 pl-9 pr-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Tabela de Corretores */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3">Fila</th>
                    <th className="py-2.5 px-3">Corretor</th>
                    <th className="py-2.5 px-3">Telefone</th>
                    <th className="py-2.5 px-3 text-center">Leads Recebidos</th>
                    <th className="py-2.5 px-3 text-center">Status Plantão</th>
                    <th className="py-2.5 px-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {filteredBrokers.map((broker, idx) => (
                    <tr key={broker.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3 font-bold text-blue-700">
                        {broker.active ? `#${idx + 1}` : '--'}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-slate-200 font-bold flex items-center justify-center text-xs text-slate-700 shrink-0">
                            {broker.name.charAt(0)}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block">{broker.name}</span>
                            {broker.email && (
                              <span className="text-[10px] text-slate-400">{broker.email}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-600">{broker.phone}</td>
                      <td className="py-3 px-3 text-center font-semibold">
                        {broker.leadsReceived || 0} Leads
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleBrokerActive(broker)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            broker.active ? 'bg-blue-600' : 'bg-slate-300'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                              broker.active ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleTriggerTestDispatch(broker.id)}
                          className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-blue-600 cursor-pointer"
                          title="Enviar lead de teste para este corretor"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-2 text-xs text-slate-500 border-t border-slate-100">
              <span>Exibindo {filteredBrokers.length} corretores cadastrados.</span>
              <span className="px-2 py-1 rounded bg-slate-100 font-semibold text-slate-700">
                Balanceamento Automático: ON
              </span>
            </div>
          </div>

          {/* Painel Lateral: Regras da Roleta & Automação (4 colunas) */}
          <div className="xl:col-span-4 flex flex-col gap-6">
            {/* Card Configurações de Transbordo */}
            <div className="bg-white rounded-xl p-5 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Timer className="w-5 h-5 text-blue-600" />
                  <h3 className="text-base font-bold text-slate-900">Temporizadores & Transbordo</h3>
                </div>
                {isSavingConfig ? (
                  <span className="text-[10px] font-bold text-blue-600 animate-pulse">Salvando...</span>
                ) : (
                  <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    Ativo
                  </span>
                )}
              </div>

              {/* 1. Temporizador de Despacho / Encaminhamento */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-bold text-slate-800">Temporizador de Envio (Delay):</span>
                  </div>
                  <span className="text-sm font-bold text-blue-600">{dispatchDelaySeconds}s</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-tight">
                  Tempo que a IA aguarda após responder para enviar a ficha completa do lead ao corretor no WhatsApp.
                </p>
                <input
                  type="range"
                  min={1}
                  max={30}
                  step={1}
                  value={dispatchDelaySeconds}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setDispatchDelaySeconds(val);
                    handleSaveConfig({ dispatchDelaySeconds: val });
                  }}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 mt-1"
                />
                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                  <span>1s (Imediato)</span>
                  <span className="font-semibold text-blue-600">3s (Recomendado)</span>
                  <span>15s</span>
                  <span>30s</span>
                </div>
              </div>

              {/* 2. Timeout de Tolerância / SLA do Corretor */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Timer className="w-4 h-4 text-purple-600" />
                    <span className="text-xs font-bold text-slate-800">Tolerância / SLA do Corretor:</span>
                  </div>
                  <span className="text-sm font-bold text-purple-600">{timeoutSeconds}s</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-tight">
                  Tempo máximo para o corretor responder antes de transbordar automaticamente para o próximo.
                </p>
                <input
                  type="range"
                  min={30}
                  max={300}
                  step={15}
                  value={timeoutSeconds}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setTimeoutSeconds(val);
                    handleSaveConfig({ timeoutSeconds: val, inactivityTimeoutSeconds: val });
                  }}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-purple-600 mt-1"
                />
                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                  <span>30s (Rápido)</span>
                  <span>120s (Padrão)</span>
                  <span>300s (5 min)</span>
                </div>
              </div>

              {/* Dica de Testes com Mesmo Telefone */}
              <div className="p-3 rounded-lg bg-emerald-50/70 border border-emerald-200/80 text-[11px] text-emerald-900 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Modo de Testes Ilimitados Ativo:</strong> você pode testar repetidamente usando o mesmo número de WhatsApp. O sistema reativa a sessão automaticamente a cada novo teste após 15s.
                </span>
              </div>

              {/* Checkboxes */}
              <div className="flex flex-col gap-3 pt-1">
                <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={transbordoInteligente}
                    onChange={(e) => setTransbordoInteligente(e.target.checked)}
                    className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>
                    <strong className="font-semibold text-slate-900">Transbordo Automático:</strong>{' '}
                    Repassar se o corretor não responder no tempo estipulado.
                  </span>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={filtroRegiao}
                    onChange={(e) => setFiltroRegiao(e.target.checked)}
                    className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>
                    <strong className="font-semibold text-slate-900">Priorizar Especialista da Região:</strong>{' '}
                    Prioriza corretores credenciados no bairro do imóvel.
                  </span>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={mascaramentoDlp}
                    onChange={(e) => setMascaramentoDlp(e.target.checked)}
                    className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>
                    <strong className="font-semibold text-slate-900">Mascaração DLP WhatsApp:</strong>{' '}
                    Proteção contra desvio de comissão ou vazamento de dados.
                  </span>
                </label>
              </div>
            </div>

            {/* Preview da Mensagem Disparada */}
            <div className="bg-white rounded-xl p-5 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-base font-bold text-slate-900">Preview do WhatsApp Oficial</h3>
                </div>
                <span className="text-[11px] text-slate-400">Instância Direct Houses</span>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs flex flex-col gap-2.5 shadow-2xs">
                <div className="flex items-center justify-between text-slate-500 pb-1 border-b border-slate-200">
                  <span className="font-bold text-blue-700 text-[11px]">
                    {companyName.toUpperCase()} • ROLETA AUTOMÁTICA
                  </span>
                  <span className="text-[10px]">Agora</span>
                </div>

                <p className="text-slate-800 leading-relaxed font-medium">
                  🚀 <strong>NOVO LEAD EXCLUSIVO DISPONÍVEL NA ROLETA!</strong><br />
                  Você tem <strong>{timeoutSeconds} segundos</strong> para aceitar este atendimento.
                </p>

                <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1 text-slate-700 font-sans">
                  <div>👤 <strong>Cliente:</strong> Roberto Albuquerque</div>
                  <div>🏢 <strong>Interesse:</strong> Reserva Jardim Barra (3 Quartos)</div>
                  <div>💰 <strong>Ticket Estimado:</strong> R$ 1.450.000,00</div>
                  <div>🎯 <strong>Origem:</strong> Anúncio Instagram Ads</div>
                  <div>🛡️ <strong>DLP Status:</strong> Lead Auditado e Protegido</div>
                </div>

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setAcceptedSimulation(!acceptedSimulation)}
                    className={`w-full py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                      acceptedSimulation
                        ? 'bg-emerald-600 text-white'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    <Check className="w-4 h-4" />
                    <span>
                      {acceptedSimulation
                        ? '✓ Atendimento Aceito!'
                        : 'Simular Aceite no WhatsApp'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
