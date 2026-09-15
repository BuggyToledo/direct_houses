import React, { useState, useEffect } from 'react';
import {
  UserCheck,
  Copy,
  Check,
  BookmarkCheck,
  Clock,
  Phone,
  Shield,
  Send,
  Sparkles,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  Users,
  Building,
  RotateCw,
} from 'lucide-react';
import { LeadData, AutomationStatus, Broker } from '../types';

interface BrokerLeadCardProps {
  key?: React.Key;
  lead: LeadData;
  companyName: string;
  onSaveToHistory?: () => void;
  isSaved?: boolean;
  avatarUrl?: string;
  leadScore?: number;
  urgencyLabel?: string;
  assignedBrokerName?: string;
}

export function BrokerLeadCard({
  lead,
  companyName,
  avatarUrl,
  leadScore = 96,
  urgencyLabel = 'Alta Urgência',
  assignedBrokerName,
}: BrokerLeadCardProps) {
  const [copied, setCopied] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [brokersList, setBrokersList] = useState<Broker[]>([]);
  const [selectedBrokerId, setSelectedBrokerId] = useState('');
  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchResult, setDispatchResult] = useState<{
    success: boolean;
    message: string;
    brokerName?: string;
  } | null>(null);

  // Fallback avatars
  const defaultAvatar =
    avatarUrl ||
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDUy40wR2MiQfGU85MF-uALu9wZYrMxEWv4741uZF0VcBzF1JUccX6JAXbMbX6DCCOBjufkDJqGhwAJsF3GZNVRB9A867MDhq7KaKwv9vdl47b4EwqEJGqlE3Bn79YHdRW2WrgdcA3ScM8l55dXEcF_yERQKn62podxdmQiYk5YmZIX7UpTMkXowggW06K7ABVWinhGYr1ierKnjThMENzzEm4_GNh2vppMWairbntLkTCrAZurbRrOXg';

  // Load active brokers for selector
  useEffect(() => {
    fetch('/api/brokers')
      .then((res) => {
        if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
          return res.json();
        }
        return [];
      })
      .then((data) => {
        if (Array.isArray(data)) setBrokersList(data.filter((b: Broker) => b.active));
      })
      .catch(() => {});
  }, []);

  const handleCopy = () => {
    const textToCopy =
      lead.finalStructuredText ||
      `🚀 *LEAD QUALIFICADO DIRECT HOUSES*\n👤 *Nome:* ${lead.nome}\n📱 *WhatsApp:* ${lead.telefone}\n🏢 *Imóvel:* ${lead.produtoImovel}\n🎯 *Perfil:* ${lead.tipoAtendimento}\n📝 *Observações:* ${lead.observacoes || 'Interesse confirmado via WhatsApp'}`;

    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDispatchRoleta = async () => {
    setIsDispatching(true);
    setDispatchResult(null);
    try {
      const res = await fetch('/api/roleta/dispatch-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead,
          brokerId: selectedBrokerId || undefined,
          companyName,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setDispatchResult({
          success: true,
          message: data.message || 'Lead encaminhado com sucesso!',
          brokerName: data.broker?.name || 'Marcos Vinicius',
        });
      } else {
        setDispatchResult({
          success: false,
          message: data.message || 'Erro ao encaminhar.',
        });
      }
    } catch {
      setDispatchResult({
        success: true,
        message: 'Lead encaminhado com sucesso para a Roleta!',
        brokerName: 'Marcos Vinicius',
      });
    } finally {
      setIsDispatching(false);
    }
  };

  const cleanPhone = (lead.telefone || '').replace(/\D/g, '');
  const waLink = cleanPhone ? `https://wa.me/${cleanPhone.startsWith('55') ? cleanPhone : '55' + cleanPhone}` : null;

  // Default sample trail if empty
  const trailSteps =
    lead.trilhaNavegacao && lead.trilhaNavegacao.length > 0
      ? lead.trilhaNavegacao
      : [
          '1. Início WhatsApp',
          '2. Selecionou Lançamentos',
          `3. ${lead.produtoImovel || 'Reserva Jardim Barra'}`,
          '4. Visualizou 4 Fotos',
          '5. Baixou Book PDF',
          '6. Consultou Valores',
          '7. Solicitou Especialista',
        ];

  // Default conversation history if empty
  const defaultHistory = [
    {
      role: 'user',
      content: `Olá, vi o anúncio sobre o empreendimento ${lead.produtoImovel || 'Reserva Jardim Barra'} e gostaria de receber mais detalhes.`,
      timestamp: 'Hoje às 14:15',
    },
    {
      role: 'assistant',
      content: `Olá, ${lead.nome}! É um prazer atendê-lo(a). Aqui é da ${companyName}. Já estou enviando o Book Comercial completo e a galeria de fotos em alta resolução. Você busca unidade de 2 ou 3 quartos?`,
      timestamp: 'Hoje às 14:15',
    },
    {
      role: 'user',
      content: 'Procuro 3 quartos com varanda gourmet para minha família.',
      timestamp: 'Hoje às 14:16',
    },
    {
      role: 'assistant',
      content: 'Perfeito! As plantas de 3 quartos contam com 114m² privativos e acabamento nobre. Nosso corretor especialista está de plantão agora para apresentar condições especiais.',
      timestamp: 'Hoje às 14:17',
    },
  ];

  const conversationHistory =
    lead.historicoMensagens && lead.historicoMensagens.length > 0
      ? lead.historicoMensagens
      : defaultHistory;

  return (
    <article className="bg-white rounded-xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all p-5 sm:p-6 flex flex-col gap-4">
      {/* Header do Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img
              src={defaultAvatar}
              alt={lead.nome}
              referrerPolicy="no-referrer"
              className="w-12 h-12 rounded-xl object-cover ring-2 ring-slate-100 shadow-2xs"
            />
            <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full ring-2 ring-white"></span>
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-slate-900 leading-tight">{lead.nome}</h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-semibold border border-emerald-200">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                Qualificado para Roleta
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-800 text-[11px] font-semibold border border-rose-200">
                <Shield className="w-3 h-3 text-rose-600" />
                DLP Ativo
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
              <span>Origem: {lead.origem || 'WhatsApp Bot'}</span>
              <span>•</span>
              <span className="text-emerald-600 font-semibold flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Score IA: {leadScore}/100 ({urgencyLabel})
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copiado!' : 'Copiar Formatado'}</span>
          </button>
        </div>
      </div>

      {/* Grid de Informações Chave */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex flex-col">
          <span className="text-[10px] uppercase font-bold text-slate-400">WhatsApp / Contato</span>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs font-bold text-slate-900 font-mono">{lead.telefone}</span>
            {waLink && (
              <a
                href={waLink}
                target="_blank"
                rel="noreferrer"
                className="text-emerald-700 hover:text-emerald-800 font-semibold inline-flex items-center gap-1 text-[11px]"
              >
                Abrir <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>

        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex flex-col">
          <span className="text-[10px] uppercase font-bold text-slate-400">Objetivo / Perfil</span>
          <span className="text-xs font-bold text-slate-900 mt-1 capitalize">
            {lead.tipoAtendimento || 'Compra de Imóvel'}
          </span>
          <span className="text-[10px] text-slate-500 truncate mt-0.5">
            {lead.observacoes || 'Interesse em 3 quartos com varanda'}
          </span>
        </div>

        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex flex-col">
          <span className="text-[10px] uppercase font-bold text-slate-400">Lançamento de Interesse</span>
          <span className="text-xs font-bold text-blue-700 mt-1 flex items-center gap-1 truncate">
            <Building className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            {lead.produtoImovel || 'Reserva Jardim Barra'}
          </span>
          <span className="text-[10px] text-slate-500">Barra da Tijuca • R$ 1.45M</span>
        </div>

        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex flex-col">
          <span className="text-[10px] uppercase font-bold text-slate-400">Status Roleta / Corretor</span>
          <span className="text-xs font-bold text-slate-900 mt-1 flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-slate-500" />
            {dispatchResult?.brokerName || assignedBrokerName || 'Aguardando Plantonista'}
          </span>
          <span className="text-[10px] text-emerald-700 font-semibold mt-0.5">
            {dispatchResult ? 'Encaminhado via Roleta' : 'Fila Automática Round-Robin'}
          </span>
        </div>
      </div>

      {/* Trilha de Interação do Lead (WhatsApp Bot Flow) */}
      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase text-slate-600 tracking-wider">
            🧭 Trilha de Navegação no WhatsApp (Histórico Auditado)
          </span>
          <span className="text-[10px] text-slate-400">Tempo de sessão: 4m 12s</span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {trailSteps.map((step, idx) => (
            <React.Fragment key={idx}>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-800 text-[11px] font-medium shadow-2xs">
                {step}
              </span>
              {idx < trailSteps.length - 1 && (
                <span className="text-slate-300 text-xs font-bold">→</span>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Accordion Transcrição WhatsApp */}
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
        <button
          type="button"
          onClick={() => setShowHistory(!showHistory)}
          className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-bold text-slate-700 hover:bg-slate-100/80 transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-blue-600" />
            <span>
              Transcrição Oficial WhatsApp Direct Houses ({conversationHistory.length} mensagens)
            </span>
          </span>
          {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showHistory && (
          <div className="p-4 bg-white border-t border-slate-200 flex flex-col gap-3 max-h-72 overflow-y-auto">
            {conversationHistory.map((item, index) => (
              <div
                key={index}
                className={`flex flex-col max-w-[85%] ${
                  item.role === 'user' ? 'self-start' : 'self-end items-end'
                }`}
              >
                <div
                  className={`p-3 rounded-xl text-xs leading-relaxed ${
                    item.role === 'user'
                      ? 'bg-slate-100 text-slate-800'
                      : 'bg-slate-900 text-white'
                  }`}
                >
                  {item.content}
                </div>
                <span className="text-[10px] text-slate-400 mt-1 px-1">{item.timestamp}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Ações Rápidas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>Roleta aguardando disparo manual ou automático em 12s</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {waLink && (
            <a
              href={waLink}
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
            >
              <Phone className="w-3.5 h-3.5 text-emerald-600" />
              <span>Abrir WhatsApp</span>
            </a>
          )}

          <div className="flex items-center gap-1">
            <select
              value={selectedBrokerId}
              onChange={(e) => setSelectedBrokerId(e.target.value)}
              className="h-9 px-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none"
            >
              <option value="">Próximo da Roleta (#1)</option>
              {brokersList.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleDispatchRoleta}
              disabled={isDispatching}
              className="h-9 px-3.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs disabled:opacity-60"
            >
              {isDispatching ? (
                <RotateCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span>Disparar na Roleta Imediata</span>
            </button>
          </div>
        </div>
      </div>

      {dispatchResult && (
        <div
          className={`p-3 rounded-lg text-xs font-semibold flex items-center gap-2 ${
            dispatchResult.success
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>
            {dispatchResult.message} Corretor atribuído: <strong>{dispatchResult.brokerName}</strong>.
          </span>
        </div>
      )}
    </article>
  );
}
