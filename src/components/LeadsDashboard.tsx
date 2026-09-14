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
} from 'lucide-react';
import { Broker, WhatsAppStatus } from '../types';

export interface PersistentLeadData {
  id: string;
  nome: string;
  telefone: string;
  tipoAtendimento: string;
  produtoImovel: string;
  observacoes: string;
  initialMessage?: string;
  origem: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  assignedBroker?: {
    id: string;
    name: string;
    phone: string;
    assignedAt?: string;
  };
  rawStructuredText?: string;
}

interface LeadsDashboardProps {
  leads: PersistentLeadData[];
  brokers: Broker[];
  whatsAppStatus: WhatsAppStatus;
  companyName: string;
  onOpenWhatsAppModal: () => void;
  onOpenBrokersModal: () => void;
  onRefreshLeads: () => void;
  onDeleteLead: (id: string) => void;
  onDispatchLeadToBroker?: (leadId: string, brokerId?: string) => void;
}

export function LeadsDashboard({
  leads,
  brokers,
  whatsAppStatus,
  companyName,
  onOpenWhatsAppModal,
  onOpenBrokersModal,
  onRefreshLeads,
  onDeleteLead,
  onDispatchLeadToBroker,
}: LeadsDashboardProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const matchSearch =
        searchTerm === '' ||
        lead.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.telefone?.includes(searchTerm) ||
        lead.produtoImovel?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.observacoes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.initialMessage?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.assignedBroker?.name?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'dispatched' && (lead.status?.includes('Direcionado') || lead.status?.includes('Roleta'))) ||
        (statusFilter === 'qualified' && lead.status?.includes('Qualificado')) ||
        (statusFilter === 'timeout' && lead.status?.includes('Inatividade')) ||
        (statusFilter === 'active' && (lead.status?.includes('Atendimento') || lead.status?.includes('Novo')));

      return matchSearch && matchStatus;
    });
  }, [leads, searchTerm, statusFilter]);

  const activeBrokers = brokers.filter((b) => b.active);

  const getCleanPhone = (phone: string) => {
    return (phone || '').replace(/\D/g, '');
  };

  const getStatusBadge = (status: string) => {
    if (status?.includes('Direcionado') || status?.includes('Roleta')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          Direcionado na Roleta
        </span>
      );
    }
    if (status?.includes('Inatividade')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
          <AlertTriangle className="w-3 h-3 text-amber-600" />
          Recuperado (5 min)
        </span>
      );
    }
    if (status?.includes('Qualificado')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
          <Sparkles className="w-3 h-3 text-blue-600" />
          Qualificado por IA
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
        <Clock className="w-3 h-3 text-slate-500" />
        {status || 'Em Atendimento'}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Stat Cards Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: WhatsApp Status */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">WhatsApp 24/7</span>
            <div
              className={`p-2 rounded-xl ${
                whatsAppStatus.state === 'connected' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'
              }`}
            >
              <Smartphone className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  whatsAppStatus.state === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                }`}
              />
              <span className="font-bold text-slate-900 text-sm">
                {whatsAppStatus.state === 'connected' ? 'Ativo e Conectado' : 'Desconectado'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              {whatsAppStatus.connectedPhone ? whatsAppStatus.connectedPhone : 'Clique para escanear QR Code'}
            </p>
          </div>
          <button
            onClick={onOpenWhatsAppModal}
            className="mt-3 w-full py-1.5 px-3 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            {whatsAppStatus.state === 'connected' ? 'Ver Conexão' : 'Conectar WhatsApp'}
          </button>
        </div>

        {/* Card 2: Total Leads */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total de Leads</span>
            <div className="p-2 rounded-xl bg-blue-100 text-blue-600">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 leading-none">{leads.length}</div>
            <p className="text-xs text-slate-500 mt-1">Leads capturados e qualificados</p>
          </div>
          <div className="mt-3 text-[11px] text-slate-400 font-medium flex items-center gap-1">
            <Clock className="w-3 h-3" /> Atualizado em tempo real
          </div>
        </div>

        {/* Card 3: Roleta de Corretores */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Roleta Ativa</span>
            <div className="p-2 rounded-xl bg-indigo-100 text-indigo-600">
              <Share2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 leading-none">{activeBrokers.length}</div>
            <p className="text-xs text-slate-500 mt-1">
              {activeBrokers.length === 1 ? '1 corretor na fila' : `${activeBrokers.length} corretores na fila`}
            </p>
          </div>
          <button
            onClick={onOpenBrokersModal}
            className="mt-3 w-full py-1.5 px-3 text-xs font-semibold rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            Gerenciar Roleta
          </button>
        </div>

        {/* Card 4: Recuperação 5 Min */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Recuperação 24/7</span>
            <div className="p-2 rounded-xl bg-purple-100 text-purple-600">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800">
              Timeout 5 min Ativo
            </span>
            <p className="text-xs text-slate-500 mt-1.5">
              Leads que param de responder são despachados automaticamente para o corretor.
            </p>
          </div>
          <div className="mt-3 text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Proteção contra perda de leads
          </div>
        </div>

      </div>

      {/* Main Workspace: Leads Table & Roleta Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left / Center Column: Leads Feed (8 cols on lg) */}
        <div className="lg:col-span-8 space-y-4">
          
          {/* Filter & Search Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Search input */}
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nome, fone, imóvel..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-slate-50 hover:bg-white transition-colors"
              />
            </div>

            {/* Status filters */}
            <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                  statusFilter === 'all'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Todos ({leads.length})
              </button>
              <button
                onClick={() => setStatusFilter('dispatched')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                  statusFilter === 'dispatched'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Direcionados
              </button>
              <button
                onClick={() => setStatusFilter('timeout')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                  statusFilter === 'timeout'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Recuperados
              </button>
              <button
                onClick={onRefreshLeads}
                className="p-2 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer ml-1"
                title="Atualizar lista"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Leads List Cards */}
          {filteredLeads.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
              <div className="w-14 h-14 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <Users className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-800">Nenhum lead encontrado</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Assim que os clientes enviarem mensagens no WhatsApp do número conectado, a IA fará o atendimento
                automático e os dados aparecerão aqui em tempo real.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLeads.map((lead) => {
                const cleanPhone = getCleanPhone(lead.telefone);
                const waLink = cleanPhone ? `https://wa.me/${cleanPhone}` : '';

                return (
                  <div
                    key={lead.id}
                    className="bg-white rounded-2xl border border-slate-200/90 hover:border-slate-300 p-4 sm:p-5 shadow-xs transition-all space-y-3"
                  >
                    {/* Header Row: Name, Status & Date */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                          {lead.nome?.charAt(0)?.toUpperCase() || 'C'}
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm">{lead.nome || 'Cliente WhatsApp'}</h4>
                          <div className="flex items-center gap-2 mt-0.5">
                            {lead.telefone ? (
                              <a
                                href={waLink}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 hover:underline"
                              >
                                <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                                {lead.telefone}
                              </a>
                            ) : (
                              <span className="text-xs text-slate-400">Telefone não informado</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        {getStatusBadge(lead.status)}
                        <span className="text-[11px] text-slate-400 font-medium">
                          {lead.createdAt ? new Date(lead.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                          Interesse & Imóvel
                        </span>
                        <div className="font-semibold text-slate-800 flex items-center gap-1">
                          <Tag className="w-3.5 h-3.5 text-indigo-600" />
                          <span className="capitalize">{lead.tipoAtendimento || 'Comprar'}</span>: {lead.produtoImovel || 'A combinar'}
                        </div>
                      </div>

                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                          Corretor da Roleta
                        </span>
                        {lead.assignedBroker ? (
                          <div className="font-semibold text-slate-800 flex items-center gap-1">
                            <Users className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{lead.assignedBroker.name}</span>
                            <span className="text-slate-400 text-[11px]">({lead.assignedBroker.phone})</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Aguardando envio na fila</span>
                        )}
                      </div>
                    </div>

                    {/* Initial Message / Link of Property if present */}
                    {lead.initialMessage && (
                      <div className="p-2.5 bg-emerald-50/70 border border-emerald-100 rounded-xl text-xs text-emerald-900">
                        <span className="font-bold block text-[10px] uppercase tracking-wider text-emerald-700 mb-0.5">
                          💬 Primeira Mensagem / Link de Anúncio:
                        </span>
                        <p className="break-all">{lead.initialMessage}</p>
                      </div>
                    )}

                    {/* Observações if present */}
                    {lead.observacoes && lead.observacoes !== 'Nenhuma' && lead.observacoes !== lead.initialMessage && (
                      <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <span className="font-bold text-slate-700">Obs: </span>
                        {lead.observacoes}
                      </div>
                    )}

                    {/* Actions Bar */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                      <div className="flex items-center gap-2">
                        {waLink && (
                          <a
                            href={waLink}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-2xs transition-colors"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            Conversar no WhatsApp
                          </a>
                        )}
                      </div>

                      <div>
                        {deletingId === lead.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                onDeleteLead(lead.id);
                                setDeletingId(null);
                              }}
                              className="px-2 py-1 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg cursor-pointer"
                            >
                              Confirmar
                            </button>
                            <button
                              onClick={() => setDeletingId(null)}
                              className="px-2 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeletingId(lead.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Excluir Lead"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Roleta Queue Panel (4 cols on lg) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-100 text-indigo-700">
                  <Share2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Fila da Roleta</h3>
                  <p className="text-[11px] text-slate-400">Distribuição automática de leads</p>
                </div>
              </div>
              <button
                onClick={onOpenBrokersModal}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
              >
                Editar
              </button>
            </div>

            {brokers.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs">
                Nenhum corretor cadastrado ainda.
                <button
                  onClick={onOpenBrokersModal}
                  className="mt-2 block w-full py-1.5 px-3 rounded-xl bg-indigo-50 text-indigo-700 font-bold text-xs"
                >
                  + Cadastrar Corretores
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {brokers.map((broker, idx) => (
                  <div
                    key={broker.id}
                    className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                      broker.active
                        ? 'bg-slate-50 border-slate-200 hover:border-indigo-200'
                        : 'bg-slate-100/60 border-slate-200 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
                        {idx + 1}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                          {broker.name}
                          {!broker.active && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-200 text-slate-600 font-medium">
                              Inativo
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-500 font-mono">{broker.phone}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-bold text-slate-700 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                        {broker.leadsReceived || 0} leads
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={onOpenBrokersModal}
              className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <Users className="w-3.5 h-3.5" />
              Gerenciar Corretores & Roleta
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
