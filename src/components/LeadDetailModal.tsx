import React, { useState } from 'react';
import {
  X,
  User,
  Phone,
  Mail,
  Building,
  MapPin,
  Tag,
  Flame,
  Clock,
  Calendar,
  MessageSquare,
  Send,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  FileText,
  Plus,
  ExternalLink,
  ChevronRight,
  Share2,
  Bot,
  UserCheck,
} from 'lucide-react';
import { PersistentLead, LeadStage, LeadTemperatura, Broker } from '../types';

interface LeadDetailModalProps {
  lead: PersistentLead | null;
  isOpen: boolean;
  brokers: Broker[];
  companyName: string;
  onClose: () => void;
  onUpdateStage: (leadId: string, stage: LeadStage) => Promise<void>;
  onAddNote: (leadId: string, text: string) => Promise<void>;
  onRedistribute: (leadId: string, brokerId?: string, reason?: string) => Promise<void>;
  onRefresh: () => void;
}

export function LeadDetailModal({
  lead,
  isOpen,
  brokers,
  companyName,
  onClose,
  onUpdateStage,
  onAddNote,
  onRedistribute,
  onRefresh,
}: LeadDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'chat' | 'distribuicao' | 'notas'>('overview');
  const [newNoteText, setNewNoteText] = useState('');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [selectedBrokerForRedistribute, setSelectedBrokerForRedistribute] = useState('');
  const [redistributeReason, setRedistributeReason] = useState('');
  const [isRedistributing, setIsRedistributing] = useState(false);
  const [redistributeSuccess, setRedistributeSuccess] = useState<string | null>(null);

  if (!isOpen || !lead) return null;

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;
    try {
      setIsSubmittingNote(true);
      await onAddNote(lead.id, newNoteText.trim());
      setNewNoteText('');
      onRefresh();
    } catch (err) {
      console.error('Erro ao adicionar nota:', err);
    } finally {
      setIsSubmittingNote(false);
    }
  };

  const handleTriggerRedistribute = async () => {
    try {
      setIsRedistributing(true);
      setRedistributeSuccess(null);
      await onRedistribute(
        lead.id,
        selectedBrokerForRedistribute || undefined,
        redistributeReason || 'Reatribuição solicitada pelo gestor'
      );
      setRedistributeSuccess('Lead redistribuído com sucesso!');
      setSelectedBrokerForRedistribute('');
      setRedistributeReason('');
      onRefresh();
      setTimeout(() => setRedistributeSuccess(null), 4000);
    } catch (err: any) {
      console.error('Erro ao redistribuir:', err);
    } finally {
      setIsRedistributing(false);
    }
  };

  const getTemperaturaColor = (temp?: LeadTemperatura) => {
    switch (temp) {
      case 'quente':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'frio':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      default:
        return 'bg-amber-50 text-amber-700 border-amber-200';
    }
  };

  const getStageLabel = (stage: string) => {
    switch (stage) {
      case 'novo':
        return 'Novo Lead';
      case 'qualificado':
        return 'Qualificado por IA';
      case 'roleta':
        return 'Fila da Roleta';
      case 'em_atendimento':
        return 'Em Atendimento';
      case 'visita_agendada':
        return 'Visita Agendada';
      case 'proposta':
        return 'Proposta em Andamento';
      case 'fechado':
        return 'Negócio Fechado';
      case 'perdido':
        return 'Lead Arquivado / Perdido';
      default:
        return stage;
    }
  };

  const cleanPhone = lead.telefone.replace(/\D/g, '');
  const waDirectUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
    `Olá ${lead.nome}, tudo bem? Sou da equipe da ${companyName}.`
  )}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-600 text-white font-bold flex items-center justify-center text-lg shadow-xs">
              {lead.nome.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-slate-900">{lead.nome}</h2>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${getTemperaturaColor(
                    lead.temperatura
                  )}`}
                >
                  <Flame className="w-3.5 h-3.5" />
                  {lead.temperatura ? lead.temperatura.toUpperCase() : 'MORNO'}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                  {getStageLabel(lead.status)}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Criado em {new Date(lead.createdAt).toLocaleString('pt-BR')} • Origem: {lead.origem}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={waDirectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-2xs transition-all"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Chamar no WhatsApp</span>
            </a>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 px-5 border-b border-slate-200 bg-white text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-3.5 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'overview'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            📋 Resumo do Lead
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('distribuicao')}
            className={`py-3 px-3.5 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'distribuicao'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            🔄 Histórico de Roleta & Repasse
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('notas')}
            className={`py-3 px-3.5 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'notas'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            📝 Notas Internas ({lead.notasInternas?.length || 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className={`py-3 px-3.5 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'chat'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            💬 Conversa & Trilha ({lead.historicoMensagens?.length || 0})
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Cards de Contato e Atribuição */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Dados de Contato */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Dados do Interessado
                  </span>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2 text-slate-700">
                      <Phone className="w-4 h-4 text-slate-400" />
                      <strong className="font-semibold">{lead.telefone}</strong>
                    </div>
                    {lead.email && (
                      <div className="flex items-center gap-2 text-slate-700">
                        <Mail className="w-4 h-4 text-slate-400" />
                        <span>{lead.email}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-slate-700">
                      <Building className="w-4 h-4 text-slate-400" />
                      <span>
                        Interesse: <strong>{lead.produtoImovel || 'Não especificado'}</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-700">
                      <Tag className="w-4 h-4 text-slate-400" />
                      <span>
                        Tipo: <strong>{lead.tipoAtendimento || 'Compra'}</strong>
                      </span>
                    </div>
                    {lead.valorInteresse && (
                      <div className="flex items-center gap-2 text-slate-700">
                        <span className="text-emerald-600 font-bold text-sm">💰 {lead.valorInteresse}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Corretor Atribuído */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Corretor Atribuído na Roleta
                  </span>
                  {lead.assignedBroker ? (
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
                        <UserCheck className="w-4 h-4 text-emerald-600" />
                        <span>{lead.assignedBroker.name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-600">
                        <Phone className="w-4 h-4 text-slate-400" />
                        <span>{lead.assignedBroker.phone}</span>
                      </div>
                      {lead.assignedBroker.assignedAt && (
                        <div className="flex items-center gap-2 text-slate-500 text-[11px]">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            Atribuído em {new Date(lead.assignedBroker.assignedAt).toLocaleString('pt-BR')}
                          </span>
                        </div>
                      )}
                      <a
                        href={`https://wa.me/${lead.assignedBroker.phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                          `Olá ${lead.assignedBroker.name}, sobre o lead ${lead.nome} (${lead.telefone})...`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-semibold mt-1"
                      >
                        <span>Falar com corretor via WhatsApp</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  ) : (
                    <div className="text-xs text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-200">
                      Nenhum corretor atribuído ainda. Utilize a aba de repasse para distribuir na Roleta.
                    </div>
                  )}
                </div>
              </div>

              {/* Observações e Detalhes */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Observações & Perfil Qualificado
                </span>
                <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100 whitespace-pre-wrap">
                  {lead.observacoes || 'Nenhuma observação informada.'}
                </p>
              </div>

              {/* Seletor Rápido de Etapa */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Alterar Etapa do Lead no Funil
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(
                    [
                      ['novo', 'Novo Lead'],
                      ['qualificado', 'Qualificado'],
                      ['roleta', 'Roleta'],
                      ['em_atendimento', 'Em Atendimento'],
                      ['visita_agendada', 'Visita Agendada'],
                      ['proposta', 'Proposta'],
                      ['fechado', 'Fechado'],
                      ['perdido', 'Perdido'],
                    ] as [LeadStage, string][]
                  ).map(([stg, lbl]) => (
                    <button
                      key={stg}
                      type="button"
                      onClick={() => onUpdateStage(lead.id, stg)}
                      className={`px-3 py-2 rounded-lg text-xs font-semibold text-center border transition-all cursor-pointer ${
                        lead.status === stg
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'distribuicao' && (
            <div className="space-y-6">
              {/* Formulário de Redistribuição */}
              <div className="p-4 sm:p-5 rounded-xl border border-blue-200 bg-blue-50/50 space-y-4">
                <div className="flex items-center gap-2 text-blue-900 font-bold text-sm">
                  <RefreshCw className="w-4 h-4 text-blue-600" />
                  <span>Redistribuir ou Reatribuir Lead na Roleta</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Encaminhe este lead para o próximo corretor da fila segundo as regras de plantão ou
                  transfira manualmente para um especialista.
                </p>

                {redistributeSuccess && (
                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>{redistributeSuccess}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Destinatário:
                    </label>
                    <select
                      value={selectedBrokerForRedistribute}
                      onChange={(e) => setSelectedBrokerForRedistribute(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg bg-white border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Próximo Corretor da Fila (Automático)</option>
                      {brokers
                        .filter((b) => b.active)
                        .map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name} ({b.phone})
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Motivo da redistribuição:
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Corretor anterior ausente, cliente pediu troca..."
                      value={redistributeReason}
                      onChange={(e) => setRedistributeReason(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg bg-white border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleTriggerRedistribute}
                    disabled={isRedistributing}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRedistributing ? 'animate-spin' : ''}`} />
                    <span>{isRedistributing ? 'Enviando...' : 'Confirmar Redistribuição'}</span>
                  </button>
                </div>
              </div>

              {/* Histórico de Repasses deste Lead */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Trilha de Auditoria de Repasses ({lead.historicoDistribuicoes?.length || 0})
                </span>

                {(!lead.historicoDistribuicoes || lead.historicoDistribuicoes.length === 0) ? (
                  <div className="p-6 rounded-xl border border-slate-200 bg-slate-50 text-center text-xs text-slate-500">
                    Nenhum registro de repasse para este lead até o momento.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {lead.historicoDistribuicoes.map((dist, idx) => (
                      <div
                        key={dist.id || idx}
                        className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-xs">
                            #{idx + 1}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">
                              Corretor: {dist.brokerName} ({dist.brokerPhone})
                            </p>
                            <p className="text-slate-500 text-[11px] mt-0.5">
                              {new Date(dist.data).toLocaleString('pt-BR')} • Tipo:{' '}
                              <strong className="capitalize">{dist.tipo.replace('_', ' ')}</strong>
                            </p>
                          </div>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                            dist.statusEnvioWhatsApp === 'enviado'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {dist.statusEnvioWhatsApp === 'enviado' ? '✓ Enviado WhatsApp' : 'Link Gerado'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'notas' && (
            <div className="space-y-6">
              {/* Formulário de Nova Nota */}
              <form onSubmit={handleCreateNote} className="space-y-3">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Adicionar Nova Nota Interna
                </label>
                <textarea
                  rows={3}
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  placeholder="Escreva anotações de ligações, preferências especiais do cliente, visitas agendadas..."
                  className="w-full p-3 rounded-xl border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSubmittingNote || !newNoteText.trim()}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isSubmittingNote ? 'Salvando...' : 'Salvar Nota'}</span>
                  </button>
                </div>
              </form>

              {/* Lista de Notas */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Histórico de Anotações ({lead.notasInternas?.length || 0})
                </span>

                {(!lead.notasInternas || lead.notasInternas.length === 0) ? (
                  <div className="p-6 rounded-xl border border-slate-200 bg-slate-50 text-center text-xs text-slate-500">
                    Nenhuma nota interna registrada ainda.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {lead.notasInternas.map((nota) => (
                      <div
                        key={nota.id}
                        className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1.5 text-xs shadow-2xs"
                      >
                        <div className="flex items-center justify-between text-slate-500 text-[11px] pb-1 border-b border-slate-100">
                          <span className="font-semibold text-slate-700">{nota.autor}</span>
                          <span>{new Date(nota.data).toLocaleString('pt-BR')}</span>
                        </div>
                        <p className="text-slate-800 leading-relaxed whitespace-pre-wrap">{nota.texto}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'chat' && (
            <div className="space-y-6">
              {/* Trilha de Navegação */}
              {lead.trilhaNavegacao && lead.trilhaNavegacao.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Trilha de Interação do Lead
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                    {lead.trilhaNavegacao.map((step, idx) => (
                      <React.Fragment key={idx}>
                        <span className="px-2 py-0.5 rounded bg-white font-semibold text-slate-700 border border-slate-200 shadow-2xs">
                          {step}
                        </span>
                        {idx < lead.trilhaNavegacao!.length - 1 && (
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}

              {/* Mensagens do WhatsApp */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Transcrição da Conversa via Bot ({lead.historicoMensagens?.length || 0})
                </span>

                {(!lead.historicoMensagens || lead.historicoMensagens.length === 0) ? (
                  <div className="p-6 rounded-xl border border-slate-200 bg-slate-50 text-center text-xs text-slate-500">
                    {lead.rawStructuredText ? (
                      <div className="text-left whitespace-pre-wrap font-mono text-[11px] p-3 bg-white rounded-lg border border-slate-200">
                        {lead.rawStructuredText}
                      </div>
                    ) : (
                      'Nenhum histórico detalhado de mensagens disponível para este lead.'
                    )}
                  </div>
                ) : (
                  <div className="space-y-2 p-3 rounded-xl bg-slate-50 border border-slate-200 max-h-80 overflow-y-auto">
                    {lead.historicoMensagens.map((msg, idx) => {
                      const isUser = msg.role === 'user';
                      return (
                        <div
                          key={idx}
                          className={`flex flex-col max-w-[80%] rounded-xl p-3 text-xs leading-relaxed ${
                            isUser
                              ? 'ml-auto bg-emerald-600 text-white rounded-br-none'
                              : 'mr-auto bg-white text-slate-800 border border-slate-200 rounded-bl-none shadow-2xs'
                          }`}
                        >
                          <span
                            className={`text-[10px] font-bold mb-1 ${
                              isUser ? 'text-emerald-100' : 'text-slate-400'
                            }`}
                          >
                            {isUser ? lead.nome : `${companyName} Bot`} • {msg.timestamp}
                          </span>
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/80 flex items-center justify-between text-xs">
          <span className="text-slate-500">ID do Lead: {lead.id}</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
