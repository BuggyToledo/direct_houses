import React, { useState, useMemo } from 'react';
import {
  Users,
  Smartphone,
  Sparkles,
  Phone,
  MessageCircle,
  Clock,
  Search,
  ExternalLink,
  ShieldCheck,
  Shield,
  RefreshCw,
  Trash2,
  Share2,
  CheckCircle2,
  AlertTriangle,
  Send,
  Building,
  Tag,
  Home,
  Crown,
  FileSpreadsheet,
  Zap,
  Filter,
  Check,
  Flame,
  Bot,
  Sliders,
  X,
  Lock,
  LayoutGrid,
  ListFilter,
  Columns3,
  UserPlus,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  FileText,
  UserCheck,
  MoreVertical,
} from 'lucide-react';
import { Broker, WhatsAppStatus, LeadData, PersistentLead, LeadStage, LeadTemperatura } from '../types';
import { BrokerLeadCard } from './BrokerLeadCard';
import { LeadDetailModal } from './LeadDetailModal';
import { NewLeadModal } from './NewLeadModal';

export type PersistentLeadData = PersistentLead;

interface LeadsDashboardProps {
  leads: PersistentLeadData[];
  brokers: Broker[];
  whatsAppStatus: WhatsAppStatus;
  companyName: string;
  lancamentosCount?: number;
  onOpenWhatsAppModal: () => void;
  onOpenBrokersModal: () => void;
  onOpenLancamentosModal: () => void;
  onRefreshLeads: () => void;
  onDeleteLead: (id: string) => void;
  onDispatchLeadToBroker?: (leadId: string, brokerId?: string) => void;
  onNavigateTab?: (tab: string) => void;
}

export function LeadsDashboard({
  leads,
  brokers,
  whatsAppStatus,
  companyName,
  lancamentosCount = 6,
  onOpenWhatsAppModal,
  onOpenBrokersModal,
  onOpenLancamentosModal,
  onRefreshLeads,
  onDeleteLead,
  onDispatchLeadToBroker,
  onNavigateTab,
}: LeadsDashboardProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedProduct, setSelectedProduct] = useState<string>('all');
  const [selectedBroker, setSelectedBroker] = useState<string>('all');
  const [temperaturaFilter, setTemperaturaFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'crm' | 'kanban' | 'cards'>('crm');

  // Modals state
  const [selectedLeadForDetail, setSelectedLeadForDetail] = useState<PersistentLead | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isNewLeadModalOpen, setIsNewLeadModalOpen] = useState(false);
  const [isDlpDrawerOpen, setIsDlpDrawerOpen] = useState(false);
  const [actionSuccessNotice, setActionSuccessNotice] = useState<string | null>(null);

  const notify = (msg: string) => {
    setActionSuccessNotice(msg);
    setTimeout(() => setActionSuccessNotice(null), 3500);
  };

  // Seed sample leads if completely empty
  const defaultStitchLeads: PersistentLeadData[] = useMemo(
    () => [
      {
        id: 'stitch-lead-1',
        nome: 'Roberto Albuquerque',
        telefone: '+55 21 98844-1290',
        email: 'roberto.albuquerque@email.com',
        tipoAtendimento: 'Comprar Lançamento',
        produtoImovel: 'Reserva Jardim Barra',
        valorInteresse: 'R$ 1.450.000,00',
        temperatura: 'quente',
        observacoes: 'Busca 3 quartos com sol da manhã e varanda gourmet integrada. Tem R$ 400k de entrada imediata.',
        origem: 'WhatsApp Anúncio Instagram Ads',
        status: 'qualificado',
        createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
        assignedBroker: {
          id: 'b1',
          name: 'Marcos Vinicius',
          phone: '(21) 99344-1288',
          assignedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
        },
        trilhaNavegacao: [
          '1. Início WhatsApp',
          '2. Selecionou Lançamentos',
          '3. Reserva Jardim Barra',
          '4. Visualizou 4 Fotos',
          '5. Baixou Book PDF',
          '6. Consultou Valores',
          '7. Solicitou Especialista',
        ],
        historicoMensagens: [
          {
            role: 'user',
            content: 'Boa tarde! Vi o anúncio do Reserva Jardim na Barra. Poderia me enviar o Book em PDF?',
            timestamp: 'Hoje às 14:15',
          },
          {
            role: 'assistant',
            content: 'Olá, Roberto! Que excelente escolha. O Reserva Jardim Barra conta com plantas exclusivas de 2 e 3 quartos com varanda gourmet integrada. Já enviei seu Book e 4 fotos em alta!',
            timestamp: 'Hoje às 14:15',
          },
        ],
      },
      {
        id: 'stitch-lead-2',
        nome: 'Dra. Camila Siqueira',
        telefone: '+55 21 99123-4567',
        email: 'dra.camila@clinica.com.br',
        tipoAtendimento: 'Compra de Alto Padrão',
        produtoImovel: 'Horizonte Leblon Residences',
        valorInteresse: 'R$ 4.200.000,00',
        temperatura: 'quente',
        observacoes: 'Médica cirurgiã, interesse em 4 suítes no Leblon. Deseja agendamento privado no decorado.',
        origem: 'WhatsApp Tráfego Direto',
        status: 'em_atendimento',
        createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
        assignedBroker: {
          id: 'b2',
          name: 'Juliana Mendes',
          phone: '(21) 98765-4321',
          assignedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
        },
        trilhaNavegacao: [
          '1. Início WhatsApp',
          '2. Menu Lançamentos',
          '3. Horizonte Leblon',
          '4. Plantas 4 Suítes',
          '5. Baixou Book Comercial',
          '6. Solicitação VIP',
        ],
      },
      {
        id: 'stitch-lead-3',
        nome: 'Carlos Eduardo Fontes',
        telefone: '+55 21 97654-3210',
        email: 'carlos.fontes@invest.com.br',
        tipoAtendimento: 'Investimento para Renda',
        produtoImovel: 'Grand Park Ipanema',
        valorInteresse: 'R$ 980.000,00',
        temperatura: 'morno',
        observacoes: 'Investidor imobiliário de São Paulo, procura 2 suítes para aluguel de temporada (Short-Stay).',
        origem: 'WhatsApp Google Search',
        status: 'roleta',
        createdAt: new Date(Date.now() - 3600000 * 6).toISOString(),
        assignedBroker: {
          id: 'b3',
          name: 'Gabriel Silveira',
          phone: '(21) 99876-5432',
          assignedAt: new Date(Date.now() - 3600000 * 6).toISOString(),
        },
        trilhaNavegacao: [
          '1. Início WhatsApp',
          '2. Lançamentos para Investimento',
          '3. Grand Park Ipanema',
          '4. Tabela de Rentabilidade',
          '5. Contato com Especialista',
        ],
      },
    ],
    []
  );

  // Combine backend leads with fallback demo leads if empty
  const allLeads = useMemo(() => {
    if (!leads || leads.length === 0) return defaultStitchLeads;
    return leads;
  }, [leads, defaultStitchLeads]);

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    return allLeads.filter((lead) => {
      const matchSearch =
        searchTerm === '' ||
        lead.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.telefone?.includes(searchTerm) ||
        lead.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.produtoImovel?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.observacoes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.assignedBroker?.name?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchStatus =
        statusFilter === 'all' ||
        lead.status?.toLowerCase() === statusFilter.toLowerCase() ||
        lead.status?.toLowerCase().includes(statusFilter.toLowerCase());

      const matchProduct =
        selectedProduct === 'all' ||
        lead.produtoImovel?.toLowerCase().includes(selectedProduct.toLowerCase());

      const matchBroker =
        selectedBroker === 'all' ||
        lead.assignedBroker?.name?.toLowerCase().includes(selectedBroker.toLowerCase());

      const matchTemp =
        temperaturaFilter === 'all' ||
        lead.temperatura?.toLowerCase() === temperaturaFilter.toLowerCase();

      return matchSearch && matchStatus && matchProduct && matchBroker && matchTemp;
    });
  }, [allLeads, searchTerm, statusFilter, selectedProduct, selectedBroker, temperaturaFilter]);

  // Handle stage change API
  const handleUpdateStage = async (leadId: string, stage: LeadStage) => {
    try {
      const res = await fetch(`/api/leads/${leadId}/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage }),
      });
      if (res.ok) {
        notify('Etapa do lead atualizada com sucesso!');
        onRefreshLeads();
        if (selectedLeadForDetail && selectedLeadForDetail.id === leadId) {
          setSelectedLeadForDetail((prev) => (prev ? { ...prev, status: stage } : null));
        }
      }
    } catch (err) {
      console.error('Erro ao atualizar etapa:', err);
    }
  };

  // Handle temperature change API
  const handleUpdateTemperatura = async (leadId: string, temperatura: LeadTemperatura) => {
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ temperatura }),
      });
      if (res.ok) {
        notify('Temperatura atualizada!');
        onRefreshLeads();
        if (selectedLeadForDetail && selectedLeadForDetail.id === leadId) {
          setSelectedLeadForDetail((prev) => (prev ? { ...prev, temperatura } : null));
        }
      }
    } catch (err) {
      console.error('Erro ao atualizar temperatura:', err);
    }
  };

  // Handle add note API
  const handleAddNote = async (leadId: string, text: string) => {
    const res = await fetch(`/api/leads/${leadId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto: text }),
    });
    if (res.ok) {
      notify('Anotação registrada com sucesso!');
      onRefreshLeads();
      // Update local lead in detail modal
      const data = await res.json();
      if (selectedLeadForDetail && selectedLeadForDetail.id === leadId) {
        setSelectedLeadForDetail(data.lead);
      }
    }
  };

  // Handle redistribute API
  const handleRedistribute = async (leadId: string, brokerId?: string, reason?: string) => {
    const res = await fetch(`/api/leads/${leadId}/redistribute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brokerId, motivo: reason }),
    });
    if (res.ok) {
      const data = await res.json();
      notify(`Lead redistribuído para ${data.broker?.name || 'novo corretor'}!`);
      onRefreshLeads();
      if (selectedLeadForDetail && selectedLeadForDetail.id === leadId) {
        setSelectedLeadForDetail(data.lead);
      }
    }
  };

  // Handle create new lead
  const handleCreateNewLead = async (
    payload: any,
    distributeImmediately?: boolean,
    targetBrokerId?: string
  ) => {
    const res = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error('Falha ao salvar lead');
    }
    const createdLead = await res.json();

    if (distributeImmediately) {
      await handleRedistribute(
        createdLead.id,
        targetBrokerId,
        'Distribuição imediata após cadastro manual'
      );
    } else {
      notify('Lead cadastrado com sucesso!');
      onRefreshLeads();
    }
  };

  // Export CSV directly from backend
  const handleDownloadCsv = () => {
    window.open('/api/leads/export/csv', '_blank');
  };

  const getTemperaturaBadge = (temp?: LeadTemperatura) => {
    switch (temp) {
      case 'quente':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <Flame className="w-3 h-3 text-rose-500 fill-rose-500" />
            QUENTE
          </span>
        );
      case 'frio':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            ❄️ FRIO
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            ⚡ MORNO
          </span>
        );
    }
  };

  const getStageBadge = (stage: string) => {
    const s = stage.toLowerCase();
    if (s.includes('qualificado')) {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
          Qualificado por IA
        </span>
      );
    }
    if (s.includes('roleta')) {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-800 border border-purple-200">
          Na Roleta
        </span>
      );
    }
    if (s.includes('atendimento')) {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200">
          Em Atendimento
        </span>
      );
    }
    if (s.includes('visita')) {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200">
          Visita Agendada
        </span>
      );
    }
    if (s.includes('fechado')) {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-900 border border-emerald-300">
          ✓ Fechado
        </span>
      );
    }
    if (s.includes('perdido')) {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
          Perdido
        </span>
      );
    }
    return (
      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-800 border border-sky-200">
        Novo Lead
      </span>
    );
  };

  // Pipeline columns for Kanban view
  const KANBAN_COLUMNS: { stage: LeadStage; title: string; color: string }[] = [
    { stage: 'novo', title: 'Novos Leads', color: 'border-sky-300 bg-sky-50/50' },
    { stage: 'qualificado', title: 'Qualificados IA', color: 'border-emerald-300 bg-emerald-50/50' },
    { stage: 'roleta', title: 'Fila da Roleta', color: 'border-purple-300 bg-purple-50/50' },
    { stage: 'em_atendimento', title: 'Em Atendimento', color: 'border-blue-300 bg-blue-50/50' },
    { stage: 'visita_agendada', title: 'Visita Agendada', color: 'border-indigo-300 bg-indigo-50/50' },
    { stage: 'proposta', title: 'Proposta / Negociação', color: 'border-amber-300 bg-amber-50/50' },
    { stage: 'fechado', title: 'Negócio Fechado', color: 'border-emerald-400 bg-emerald-100/50' },
  ];

  return (
    <div className="w-full flex flex-col gap-6 max-w-[1720px] mx-auto">
      {/* 1. Barra de Status Superior & Governança */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>CRM & Roleta Direct Houses em Tempo Real</span>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <span>Repasse WhatsApp Automatizado:</span>
            <span className="text-emerald-700 font-bold">Auditoria Ativa</span>
          </div>

          <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
            <Shield className="w-3.5 h-3.5 text-rose-600" />
            <span>DLP Guard Level 3 • Banco de Leads Protegido</span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setIsDlpDrawerOpen(!isDlpDrawerOpen)}
            className="px-3.5 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
          >
            <Shield className="w-4 h-4 text-rose-600" />
            <span>Governança DLP</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadCsv}
            className="px-3.5 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
            title="Exportar base completa para planilha Excel/CSV"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Exportar CSV</span>
          </button>

          <button
            type="button"
            onClick={() => setIsNewLeadModalOpen(true)}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Novo Lead Comercial</span>
          </button>
        </div>
      </div>

      {/* 2. Bento Grid KPIs */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* KPI 1: Total Leads Cadastrados */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total de Leads no CRM
            </span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div>
              <span className="text-3xl font-bold font-display text-slate-900">
                {allLeads.length}
              </span>
              <span className="text-xs font-bold text-emerald-600 ml-2">
                {allLeads.filter((l) => l.temperatura === 'quente').length} Quentes 🔥
              </span>
            </div>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Origem principal: <strong className="text-slate-800">WhatsApp & Instagram</strong>
          </div>
        </div>

        {/* KPI 2: Distribuídos na Roleta */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Distribuídos na Roleta
            </span>
            <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
              <RefreshCw className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-bold font-display text-slate-900">
                {allLeads.filter((l) => l.assignedBroker).length}
              </span>
              <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                Com Corretor Atribuído
              </span>
            </div>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Plantonistas ativos:{' '}
            <strong className="text-emerald-700">
              {brokers.filter((b) => b.active).length || 6} corretores
            </strong>
          </div>
        </div>

        {/* KPI 3: Em Atendimento Ativo */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Em Atendimento / Visitas
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <MessageCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-bold font-display text-slate-900">
                {
                  allLeads.filter(
                    (l) =>
                      l.status === 'em_atendimento' ||
                      l.status === 'visita_agendada' ||
                      l.status === 'proposta'
                  ).length
                }
              </span>
              <span className="text-xs text-slate-500">No funil de fechamento</span>
            </div>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Taxa de avanço no funil: <strong className="text-blue-700">74%</strong>
          </div>
        </div>

        {/* KPI 4: Lançamentos Vinculados */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Lançamentos Ativos
            </span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <Building className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-3xl font-bold font-display text-slate-900">
              {lancamentosCount || 6}
            </span>
            <span className="text-xs text-slate-500">Imóveis em carteira</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Auditoria DLP:{' '}
            <strong className="text-emerald-700">100% Protegidos contra vazamento</strong>
          </div>
        </div>
      </section>

      {/* 3. Filtros Avançados & Seletor de Modo de Exibição */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col gap-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Seletor de Modo de Exibição */}
          <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200 self-start">
            <button
              type="button"
              onClick={() => setViewMode('crm')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'crm'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ListFilter className="w-4 h-4" />
              <span>Lista CRM Organizada</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'kanban'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Columns3 className="w-4 h-4" />
              <span>Funil Kanban</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span>Cards Detalhados</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRefreshLeads}
              className="p-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 cursor-pointer text-xs flex items-center gap-1.5 font-medium"
              title="Atualizar lista"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Atualizar</span>
            </button>
          </div>
        </div>

        {/* Inputs de Busca e Filtros */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 pt-2 border-t border-slate-100">
          {/* Busca por texto */}
          <div className="lg:col-span-4 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por cliente, telefone, e-mail, imóvel..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Filtro de Etapa / Status */}
          <div className="lg:col-span-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full h-9 px-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todas as Etapas</option>
              <option value="novo">Novo Lead</option>
              <option value="qualificado">Qualificado</option>
              <option value="roleta">Fila da Roleta</option>
              <option value="em_atendimento">Em Atendimento</option>
              <option value="visita_agendada">Visita Agendada</option>
              <option value="proposta">Proposta</option>
              <option value="fechado">Fechado</option>
              <option value="perdido">Perdido</option>
            </select>
          </div>

          {/* Filtro de Temperatura */}
          <div className="lg:col-span-2">
            <select
              value={temperaturaFilter}
              onChange={(e) => setTemperaturaFilter(e.target.value)}
              className="w-full h-9 px-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todas Temperaturas</option>
              <option value="quente">🔥 Quente</option>
              <option value="morno">⚡ Morno</option>
              <option value="frio">❄️ Frio</option>
            </select>
          </div>

          {/* Filtro de Produto */}
          <div className="lg:col-span-2">
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="w-full h-9 px-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todos os Imóveis</option>
              <option value="Reserva Jardim Barra">Reserva Jardim Barra</option>
              <option value="Horizonte Leblon">Horizonte Leblon</option>
              <option value="Grand Park Ipanema">Grand Park Ipanema</option>
            </select>
          </div>

          {/* Filtro de Corretor */}
          <div className="lg:col-span-2">
            <select
              value={selectedBroker}
              onChange={(e) => setSelectedBroker(e.target.value)}
              className="w-full h-9 px-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todos Corretores</option>
              {brokers.map((b) => (
                <option key={b.id} value={b.name}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 4. Visão Selecionada: CRM Table, Kanban ou Cards */}
      {viewMode === 'crm' && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">
              Leads Organizados no Sistema ({filteredLeads.length})
            </h3>
            <span className="text-xs text-slate-500">
              Clique em qualquer lead para ver histórico completo e notas
            </span>
          </div>

          {filteredLeads.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center justify-center">
              <Users className="w-12 h-12 text-slate-300 mb-3" />
              <h4 className="text-sm font-bold text-slate-800">Nenhum lead encontrado</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                Ajuste os filtros de busca ou cadastre um novo lead pelo botão acima.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Cliente & Contato</th>
                    <th className="py-3 px-4">Imóvel & Ticket</th>
                    <th className="py-3 px-4">Temperatura</th>
                    <th className="py-3 px-4">Etapa do Funil</th>
                    <th className="py-3 px-4">Corretor na Roleta</th>
                    <th className="py-3 px-4">Data / Origem</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {filteredLeads.map((lead) => {
                    const cleanPhone = lead.telefone.replace(/\D/g, '');
                    return (
                      <tr
                        key={lead.id}
                        className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                        onClick={() => {
                          setSelectedLeadForDetail(lead);
                          setIsDetailModalOpen(true);
                        }}
                      >
                        {/* Cliente & Contato */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs shrink-0">
                              {lead.nome.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                                {lead.nome}
                              </p>
                              <p className="text-slate-500 text-[11px] font-mono">{lead.telefone}</p>
                              {lead.email && (
                                <p className="text-slate-400 text-[10px]">{lead.email}</p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Imóvel & Ticket */}
                        <td className="py-3.5 px-4">
                          <div>
                            <p className="font-semibold text-slate-900">
                              {lead.produtoImovel || 'Geral'}
                            </p>
                            <p className="text-emerald-700 font-bold text-[11px]">
                              {lead.valorInteresse || 'A consultar'}
                            </p>
                          </div>
                        </td>

                        {/* Temperatura */}
                        <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={lead.temperatura || 'morno'}
                            onChange={(e) =>
                              handleUpdateTemperatura(lead.id, e.target.value as LeadTemperatura)
                            }
                            className="h-7 px-2 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none cursor-pointer"
                          >
                            <option value="quente">🔥 Quente</option>
                            <option value="morno">⚡ Morno</option>
                            <option value="frio">❄️ Frio</option>
                          </select>
                        </td>

                        {/* Etapa */}
                        <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={lead.status}
                            onChange={(e) =>
                              handleUpdateStage(lead.id, e.target.value as LeadStage)
                            }
                            className="h-7 px-2 rounded-lg border border-slate-200 text-xs bg-white font-semibold text-slate-800 focus:outline-none cursor-pointer"
                          >
                            <option value="novo">Novo Lead</option>
                            <option value="qualificado">Qualificado IA</option>
                            <option value="roleta">Fila Roleta</option>
                            <option value="em_atendimento">Em Atendimento</option>
                            <option value="visita_agendada">Visita Agendada</option>
                            <option value="proposta">Proposta</option>
                            <option value="fechado">Negócio Fechado</option>
                            <option value="perdido">Perdido</option>
                          </select>
                        </td>

                        {/* Corretor */}
                        <td className="py-3.5 px-4">
                          {lead.assignedBroker ? (
                            <div className="flex items-center gap-2">
                              <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                              <div>
                                <p className="font-semibold text-slate-900">
                                  {lead.assignedBroker.name}
                                </p>
                                <p className="text-slate-400 text-[10px]">
                                  {lead.assignedBroker.phone}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              Aguardando Roleta
                            </span>
                          )}
                        </td>

                        {/* Data / Origem */}
                        <td className="py-3.5 px-4">
                          <div>
                            <p className="text-slate-700">
                              {new Date(lead.createdAt).toLocaleDateString('pt-BR')}
                            </p>
                            <p className="text-slate-400 text-[11px] truncate max-w-[120px]">
                              {lead.origem || 'WhatsApp'}
                            </p>
                          </div>
                        </td>

                        {/* Ações */}
                        <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <a
                              href={`https://wa.me/${cleanPhone}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600 border border-transparent hover:border-emerald-200 transition-colors"
                              title="Chamar no WhatsApp"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </a>

                            <button
                              type="button"
                              onClick={() => {
                                setSelectedLeadForDetail(lead);
                                setIsDetailModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 border border-slate-200 transition-colors cursor-pointer"
                              title="Ver Detalhes, Notas e Roleta"
                            >
                              <FileText className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => onDeleteLead(lead.id)}
                              className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                              title="Excluir Lead"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 4.2 Modo Funil / Kanban */}
      {viewMode === 'kanban' && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {KANBAN_COLUMNS.map((col) => {
            const columnLeads = filteredLeads.filter(
              (l) => l.status?.toLowerCase() === col.stage.toLowerCase()
            );
            return (
              <div
                key={col.stage}
                className="w-80 shrink-0 bg-white rounded-xl border border-slate-200/80 shadow-xs flex flex-col max-h-[750px]"
              >
                {/* Header da Coluna */}
                <div
                  className={`p-3.5 rounded-t-xl border-b ${col.color} flex items-center justify-between`}
                >
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-xs text-slate-900">{col.title}</h4>
                    <span className="w-5 h-5 rounded-full bg-white/80 font-bold text-[11px] text-slate-700 flex items-center justify-center border border-slate-200">
                      {columnLeads.length}
                    </span>
                  </div>
                </div>

                {/* Lista de Cards da Coluna */}
                <div className="p-3 overflow-y-auto flex-1 space-y-2.5 bg-slate-50/40">
                  {columnLeads.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg">
                      Nenhum lead nesta etapa
                    </div>
                  ) : (
                    columnLeads.map((lead) => (
                      <div
                        key={lead.id}
                        onClick={() => {
                          setSelectedLeadForDetail(lead);
                          setIsDetailModalOpen(true);
                        }}
                        className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs hover:shadow-sm transition-all cursor-pointer space-y-2.5 group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h5 className="font-bold text-xs text-slate-900 group-hover:text-blue-600 transition-colors">
                            {lead.nome}
                          </h5>
                          {getTemperaturaBadge(lead.temperatura)}
                        </div>

                        <div className="text-[11px] text-slate-600 space-y-1">
                          <p className="flex items-center gap-1.5 font-medium">
                            <Building className="w-3.5 h-3.5 text-slate-400" />
                            <span className="truncate">{lead.produtoImovel || 'Imóvel Geral'}</span>
                          </p>
                          {lead.valorInteresse && (
                            <p className="text-emerald-700 font-bold">
                              💰 {lead.valorInteresse}
                            </p>
                          )}
                        </div>

                        {/* Corretor & Ações */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                          <span>
                            👤 {lead.assignedBroker ? lead.assignedBroker.name : 'Sem corretor'}
                          </span>

                          <div
                            className="flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                const currentIndex = KANBAN_COLUMNS.findIndex(
                                  (c) => c.stage === col.stage
                                );
                                if (currentIndex < KANBAN_COLUMNS.length - 1) {
                                  handleUpdateStage(
                                    lead.id,
                                    KANBAN_COLUMNS[currentIndex + 1].stage
                                  );
                                }
                              }}
                              className="p-1 rounded hover:bg-slate-100 text-blue-600 cursor-pointer"
                              title="Avançar etapa"
                            >
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4.3 Modo Cards Detalhados */}
      {viewMode === 'cards' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-base font-bold text-slate-900">
              Feed de Atendimentos Qualificados ({filteredLeads.length})
            </h2>
            <span className="text-xs text-slate-500">
              Visualização executiva com histórico de IA e navegação
            </span>
          </div>

          {filteredLeads.length === 0 ? (
            <div className="bg-white rounded-xl p-12 text-center border border-slate-200/80 shadow-xs flex flex-col items-center justify-center">
              <Users className="w-12 h-12 text-slate-300 mb-3" />
              <h3 className="text-base font-bold text-slate-900">Nenhum lead encontrado</h3>
              <p className="text-xs text-slate-500 max-w-sm mt-1">
                Ajuste os filtros de busca ou aguarde novas interações de clientes no WhatsApp Oficial.
              </p>
            </div>
          ) : (
            filteredLeads.map((item) => {
              const leadData: LeadData = {
                nome: item.nome,
                telefone: item.telefone,
                tipoAtendimento: item.tipoAtendimento,
                produtoImovel: item.produtoImovel,
                observacoes: item.observacoes,
                consentimento: 'Sim',
                origem: item.origem,
                status: item.status,
                isComplete: true,
                confirmationRequested: false,
                confirmed: true,
                humanRequested: false,
                finalStructuredText: item.rawStructuredText || '',
                trilhaNavegacao: item.trilhaNavegacao,
                historicoMensagens: item.historicoMensagens,
              };

              return (
                <BrokerLeadCard
                  key={item.id}
                  lead={leadData}
                  companyName={companyName}
                  assignedBrokerName={item.assignedBroker?.name}
                />
              );
            })
          )}
        </div>
      )}

      {/* Modal Detalhes do Lead */}
      <LeadDetailModal
        lead={selectedLeadForDetail}
        isOpen={isDetailModalOpen}
        brokers={brokers}
        companyName={companyName}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedLeadForDetail(null);
        }}
        onUpdateStage={handleUpdateStage}
        onAddNote={handleAddNote}
        onRedistribute={handleRedistribute}
        onRefresh={onRefreshLeads}
      />

      {/* Modal Novo Lead */}
      <NewLeadModal
        isOpen={isNewLeadModalOpen}
        brokers={brokers}
        onClose={() => setIsNewLeadModalOpen(false)}
        onCreateLead={handleCreateNewLead}
      />

      {/* Drawer Lateral Flutuante DLP & Governança */}
      {isDlpDrawerOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex justify-end">
          <div className="bg-white w-full max-w-md h-full shadow-2xl p-6 flex flex-col justify-between overflow-y-auto border-l border-slate-200">
            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <Shield className="w-6 h-6 text-rose-600" />
                  <h3 className="text-base font-bold text-slate-900">Governança DLP Direct Houses</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDlpDrawerOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex flex-col gap-1.5 text-rose-900">
                <span className="text-xs font-bold uppercase tracking-wider">
                  Nível de Proteção Geral: Nível 3 (Rigoroso)
                </span>
                <p className="text-xs text-rose-800 leading-relaxed">
                  Todas as saídas de texto e anexos enviados pelo bot de WhatsApp são sanitizados por algoritmos DLP antes da entrega ao cliente.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Políticas Ativas na Instância
                </h4>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-semibold text-slate-900">Mascaramento de Telefone de Construtora</p>
                    <p className="text-slate-500 text-[11px]">Bloqueio de desvio de comissão</p>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                    Ativo
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-semibold text-slate-900">Antivazamento de Carteira de Clientes</p>
                    <p className="text-slate-500 text-[11px]">Criptografia de ponta a ponta</p>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                    Ativo
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-semibold text-slate-900">Audit Trail por Inteligência Artificial</p>
                    <p className="text-slate-500 text-[11px]">Log imutável de todas as distribuições</p>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                    Ativo
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsDlpDrawerOpen(false);
                  if (onNavigateTab) onNavigateTab('lancamentos');
                }}
                className="w-full py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold text-center cursor-pointer shadow-xs"
              >
                Gerenciar Matriz de Lançamentos DLP →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notificação de Ação */}
      {actionSuccessNotice && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 z-50">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span className="text-xs font-semibold">{actionSuccessNotice}</span>
        </div>
      )}
    </div>
  );
}
