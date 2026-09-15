import React, { useState, useEffect } from 'react';
import {
  X,
  MessageSquare,
  Send,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Phone,
  Clock,
  Sparkles,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { WhatsAppChatSession, Broker } from '../types';

interface WhatsAppLiveChatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyName: string;
  isWhatsAppConnected: boolean;
}

export function WhatsAppLiveChatsModal({
  isOpen,
  onClose,
  companyName,
  isWhatsAppConnected,
}: WhatsAppLiveChatsModalProps) {
  const [sessions, setSessions] = useState<WhatsAppChatSession[]>([]);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [selectedSession, setSelectedSession] = useState<WhatsAppChatSession | null>(null);
  const [selectedBrokerId, setSelectedBrokerId] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ success: boolean; text: string } | null>(null);

  const fetchChats = async () => {
    setLoading(true);
    try {
      const [chatsRes, brokersRes] = await Promise.all([
        fetch('/api/whatsapp/chats'),
        fetch('/api/brokers'),
      ]);
      if (chatsRes.ok && chatsRes.headers.get('content-type')?.includes('application/json')) {
        const data = await chatsRes.json();
        setSessions(data);
        if (data.length > 0 && !selectedSession) {
          setSelectedSession(data[0]);
        } else if (selectedSession) {
          const updated = data.find((s: WhatsAppChatSession) => s.jid === selectedSession.jid);
          if (updated) setSelectedSession(updated);
        }
      }
      if (brokersRes.ok && brokersRes.headers.get('content-type')?.includes('application/json')) {
        setBrokers(await brokersRes.json());
      }
    } catch (err) {
      console.warn('Aviso transitório ao carregar atendimentos do WhatsApp:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchChats();
      const interval = setInterval(fetchChats, 5000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDispatch = async (session: WhatsAppChatSession, brokerId?: string) => {
    setLoading(true);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/whatsapp/chats/${encodeURIComponent(session.jid)}/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brokerId: brokerId || undefined, companyName }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage({
          success: true,
          text: data.message || `Lead encaminhado com sucesso!`,
        });
        await fetchChats();
      } else {
        setActionMessage({
          success: false,
          text: data.message || data.error || 'Falha ao encaminhar.',
        });
      }
    } catch (err: any) {
      setActionMessage({
        success: false,
        text: err.message || 'Erro ao conectar ao servidor.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col h-[85vh]">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 border border-emerald-500/20">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base sm:text-lg flex items-center gap-2">
                Atendimentos ao Vivo no WhatsApp
                {sessions.length > 0 && (
                  <span className="text-xs bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full border border-emerald-200">
                    {sessions.length} ativo(s)
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-500">
                Acompanhe as conversas da IA e faça o repasse manual para corretores a qualquer momento
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchChats}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              title="Atualizar"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action Message */}
        {actionMessage && (
          <div
            className={`p-3 mx-4 mt-3 rounded-xl text-xs flex items-center justify-between shrink-0 ${
              actionMessage.success
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {actionMessage.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{actionMessage.text}</span>
            </div>
            <button
              onClick={() => setActionMessage(null)}
              className="text-slate-400 hover:text-slate-600 text-xs"
            >
              ✕
            </button>
          </div>
        )}

        {/* Content split in 2 columns */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Left: Chat Sessions List */}
          <div className="w-full sm:w-80 border-r border-slate-100 overflow-y-auto bg-slate-50/50 p-3 space-y-2 shrink-0">
            {sessions.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                Nenhuma conversa recebida no WhatsApp ainda. Quando um cliente mandar mensagem, ela aparecerá aqui em tempo real.
              </div>
            ) : (
              sessions.map((s) => {
                const isSelected = selectedSession?.jid === s.jid;
                return (
                  <button
                    key={s.jid}
                    onClick={() => setSelectedSession(s)}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-white border-emerald-500 shadow-xs ring-2 ring-emerald-500/10'
                        : 'bg-white/80 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1 mb-1">
                      <div className="font-bold text-slate-800 text-xs truncate">
                        {s.name || s.phone}
                      </div>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase shrink-0 ${
                          s.status === 'dispatched'
                            ? 'bg-blue-100 text-blue-800'
                            : s.status === 'qualified'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {s.status === 'dispatched'
                          ? 'Encaminhado'
                          : s.status === 'qualified'
                          ? 'Qualificado'
                          : 'Em Atendimento'}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500 flex items-center gap-1 mb-1">
                      <Phone className="w-3 h-3 text-slate-400" />
                      +{s.phone}
                    </div>

                    <div className="text-[11px] text-slate-600 line-clamp-1 italic">
                      {s.messages[s.messages.length - 1]?.content || 'Iniciando atendimento...'}
                    </div>

                    {s.assignedBroker && (
                      <div className="mt-1 text-[10px] text-blue-700 font-semibold bg-blue-50 px-2 py-0.5 rounded-md">
                        👤 Corretor: {s.assignedBroker.name}
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Right: Selected Session Transcript & Action Panel */}
          {selectedSession ? (
            <div className="hidden sm:flex flex-1 flex-col overflow-hidden bg-white">
              
              {/* Session Top Bar */}
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
                <div>
                  <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    {selectedSession.name}
                    <span className="text-xs font-normal text-slate-500">
                      (+{selectedSession.phone})
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                    <span>
                      {selectedSession.extractedLead.tipoAtendimento || 'Interesse imobiliário'}
                    </span>
                    {selectedSession.extractedLead.produtoImovel && (
                      <span>• {selectedSession.extractedLead.produtoImovel}</span>
                    )}
                  </div>
                </div>

                {/* Quick WhatsApp Web direct button */}
                <a
                  href={`https://wa.me/${selectedSession.phone}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Abrir no WhatsApp
                </a>
              </div>

              {/* Messages Transcript */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/30">
                {selectedSession.messages.map((m) => {
                  const isAssistant = m.role === 'assistant';
                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${isAssistant ? 'items-start' : 'items-end'}`}
                    >
                      <div className="text-[10px] text-slate-400 font-medium mb-1 px-1">
                        {isAssistant ? `IA Direct Houses` : selectedSession.name} • {m.timestamp}
                      </div>
                      <div
                        className={`max-w-[85%] p-3 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-wrap ${
                          isAssistant
                            ? 'bg-white text-slate-800 border border-slate-200 shadow-2xs rounded-tl-xs'
                            : 'bg-emerald-600 text-white shadow-2xs rounded-tr-xs'
                        }`}
                      >
                        {m.content}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom Dispatch Action Bar */}
              <div className="p-4 border-t border-slate-100 bg-white shrink-0 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  
                  {/* Left: Dispatch to next in Roleta */}
                  <button
                    onClick={() => handleDispatch(selectedSession)}
                    disabled={loading}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-2"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Encaminhar ao Próximo da Roleta
                  </button>

                  {/* Right: Dispatch to specific broker */}
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedBrokerId}
                      onChange={(e) => setSelectedBrokerId(e.target.value)}
                      className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                    >
                      <option value="">Ou selecione um corretor específico...</option>
                      {brokers
                        .filter((b) => b.active)
                        .map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name} (+{b.phone})
                          </option>
                        ))}
                    </select>

                    <button
                      onClick={() => handleDispatch(selectedSession, selectedBrokerId)}
                      disabled={loading || !selectedBrokerId}
                      className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-xs rounded-xl transition-colors"
                    >
                      Encaminhar
                    </button>
                  </div>

                </div>
              </div>

            </div>
          ) : (
            <div className="hidden sm:flex flex-1 items-center justify-center p-8 text-center text-slate-400 text-xs">
              Selecione uma conversa ao lado para visualizar as mensagens e encaminhar para um corretor.
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div>Conexão ativa com o motor de IA e WhatsApp Web.</div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-lg transition-colors"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
}
