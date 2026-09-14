import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  RotateCcw,
  Sparkles,
  Bot,
  User,
  CheckCheck,
  Building2,
  ShieldCheck,
  AlertCircle,
  Copy,
  Check,
  ArrowRight,
  Headphones,
} from 'lucide-react';
import { Message, AppSettings } from '../types';

interface ChatWindowProps {
  messages: Message[];
  isLoading: boolean;
  onSendMessage: (text: string) => void;
  onResetChat: () => void;
  settings: AppSettings;
  onSelectPresetScenario: (scenarioText: string) => void;
}

export function ChatWindow({
  messages,
  isLoading,
  onSendMessage,
  onResetChat,
  settings,
  onSelectPresetScenario,
}: ChatWindowProps) {
  const [inputText, setInputText] = useState('');
  const [copiedLeadMsgId, setCopiedLeadMsgId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;
    const text = inputText.trim();
    setInputText('');
    onSendMessage(text);
  };

  const handleQuickReply = (reply: string) => {
    if (isLoading) return;
    onSendMessage(reply);
  };

  const handleCopyFormattedBlock = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLeadMsgId(id);
    setTimeout(() => setCopiedLeadMsgId(null), 2000);
  };

  // Get current active quick replies from latest assistant message
  const lastAssistantMsg = [...messages].reverse().find((m) => m.role === 'assistant');
  const activeQuickReplies = lastAssistantMsg?.quickReplies || [];

  return (
    <div id="chat-window-root" className="flex flex-col h-full bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Chat Top Header */}
      <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-xs">
              <Building2 className="w-5 h-5" />
            </div>
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></span>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="font-bold text-slate-800 text-sm sm:text-base truncate">
                {settings.companyName || 'Assistente Comercial'}
              </h2>
              <span className="shrink-0 px-1.5 py-0.5 rounded-sm bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                OFICIAL
              </span>
            </div>
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Atendimento Comercial Online • Responde em instantes
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <button
            id="reset-chat-btn"
            onClick={onResetChat}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors"
            title="Reiniciar Atendimento"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="hidden sm:inline">Reiniciar</span>
          </button>
        </div>
      </div>

      {/* Preset Test Scenarios Bar */}
      <div className="px-4 py-2 bg-slate-100/60 border-b border-slate-200/60 flex items-center gap-2 overflow-x-auto text-[11px] no-scrollbar">
        <span className="font-semibold text-slate-500 shrink-0 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-amber-500" />
          Testar cenários:
        </span>
        <button
          id="preset-scenario-comprar"
          onClick={() => onSelectPresetScenario('Olá! Gostaria de comprar um apartamento de 3 quartos.')}
          className="shrink-0 px-2.5 py-1 rounded-full bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 hover:border-slate-300 font-medium transition-colors cursor-pointer"
        >
          Comprar Apto 3Q
        </button>
        <button
          id="preset-scenario-alugar"
          onClick={() => onSelectPresetScenario('Boa tarde! Procuro uma sala comercial para alugar.')}
          className="shrink-0 px-2.5 py-1 rounded-full bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 hover:border-slate-300 font-medium transition-colors cursor-pointer"
        >
          Alugar Comercial
        </button>
        <button
          id="preset-scenario-vender"
          onClick={() => onSelectPresetScenario('Oi! Quero vender uma casa em condomínio fechado.')}
          className="shrink-0 px-2.5 py-1 rounded-full bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 hover:border-slate-300 font-medium transition-colors cursor-pointer"
        >
          Vender Casa
        </button>
        <button
          id="preset-scenario-humano"
          onClick={() => onSelectPresetScenario('Gostaria de falar direto com um atendente humano, por favor.')}
          className="shrink-0 px-2.5 py-1 rounded-full bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 font-medium transition-colors cursor-pointer flex items-center gap-1"
        >
          <Headphones className="w-3 h-3" />
          Pedir Corretor Humano (Regra 8)
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div
        id="chat-messages-container"
        className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-slate-50/40"
      >
        {/* LGPD Safety Notice */}
        <div className="mx-auto max-w-md p-2.5 rounded-xl bg-slate-100/90 border border-slate-200 text-center text-[11px] text-slate-500 flex items-center justify-center gap-1.5 shadow-2xs">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>Atendimento seguro e em conformidade com a LGPD. Respostas rápidas e sigilosas.</span>
        </div>

        {messages.map((msg) => {
          const isAssistant = msg.role === 'assistant';
          const isLeadSummary = msg.content.includes('NOVO LEAD');

          return (
            <div
              key={msg.id}
              className={`flex items-end gap-2.5 ${isAssistant ? 'justify-start' : 'justify-end'}`}
            >
              {isAssistant && (
                <div className="w-7 h-7 rounded-full bg-slate-800 text-white flex items-center justify-center shrink-0 mb-0.5 text-xs font-bold">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[85%] sm:max-w-[78%] rounded-2xl p-3.5 sm:p-4 text-xs sm:text-sm leading-relaxed ${
                  isAssistant
                    ? 'bg-white text-slate-800 border border-slate-200/90 shadow-2xs rounded-bl-xs'
                    : 'bg-emerald-600 text-white shadow-xs rounded-br-xs'
                }`}
              >
                {/* Content */}
                <div className="whitespace-pre-wrap space-y-2">
                  {isLeadSummary ? (
                    <div>
                      {/* Text before NOVO LEAD */}
                      <p>{msg.content.split('NOVO LEAD')[0].trim()}</p>

                      {/* Highlighted NOVO LEAD card */}
                      <div className="mt-3 p-3 rounded-xl bg-slate-900 text-emerald-400 font-mono text-[11px] border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 text-slate-300">
                          <span className="font-bold flex items-center gap-1.5 text-emerald-400">
                            <CheckCheck className="w-3.5 h-3.5" />
                            RESUMO PARA O CORRETOR
                          </span>
                          <button
                            onClick={() =>
                              handleCopyFormattedBlock(
                                msg.id,
                                'NOVO LEAD' + msg.content.split('NOVO LEAD')[1]
                              )
                            }
                            className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] transition-colors"
                          >
                            {copiedLeadMsgId === msg.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span>Copiado!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copiar</span>
                              </>
                            )}
                          </button>
                        </div>
                        <pre className="whitespace-pre-wrap leading-relaxed overflow-x-auto text-[11px]">
                          {'NOVO LEAD' + msg.content.split('NOVO LEAD')[1]}
                        </pre>
                      </div>
                    </div>
                  ) : (
                    <p>{msg.content}</p>
                  )}
                </div>

                {/* Timestamp & Status */}
                <div
                  className={`flex items-center justify-end gap-1 mt-1.5 text-[10px] ${
                    isAssistant ? 'text-slate-400' : 'text-emerald-100'
                  }`}
                >
                  <span>{msg.timestamp}</span>
                  {!isAssistant && <CheckCheck className="w-3 h-3 text-emerald-200" />}
                </div>
              </div>

              {!isAssistant && (
                <div className="w-7 h-7 rounded-full bg-emerald-700 text-white flex items-center justify-center shrink-0 mb-0.5 text-xs font-bold">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {/* Assistant Typing indicator */}
        {isLoading && (
          <div className="flex items-end gap-2.5 justify-start">
            <div className="w-7 h-7 rounded-full bg-slate-800 text-white flex items-center justify-center shrink-0 mb-0.5 text-xs font-bold">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-white border border-slate-200/90 rounded-2xl rounded-bl-xs p-3.5 shadow-2xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce"></span>
                <span
                  className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce"
                  style={{ animationDelay: '0.15s' }}
                ></span>
                <span
                  className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce"
                  style={{ animationDelay: '0.3s' }}
                ></span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Reply Chips */}
      {activeQuickReplies.length > 0 && !isLoading && (
        <div className="px-4 py-2.5 bg-white border-t border-slate-100 flex flex-wrap gap-2 items-center">
          <span className="text-[11px] text-slate-400 font-medium">Sugestões de resposta:</span>
          {activeQuickReplies.map((qr, idx) => (
            <button
              key={idx}
              onClick={() => handleQuickReply(qr)}
              className="px-3 py-1.5 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-medium transition-all flex items-center gap-1 hover:scale-102 active:scale-98 cursor-pointer"
            >
              <span>{qr}</span>
              <ArrowRight className="w-3 h-3 text-emerald-600" />
            </button>
          ))}
        </div>
      )}

      {/* Input Form */}
      <form
        onSubmit={handleSubmit}
        className="p-3 sm:p-4 bg-white border-t border-slate-200 flex items-center gap-2"
      >
        <input
          ref={inputRef}
          id="chat-input-field"
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Digite sua resposta aqui..."
          disabled={isLoading}
          className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all disabled:opacity-50"
        />
        <button
          id="send-message-btn"
          type="submit"
          disabled={!inputText.trim() || isLoading}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-semibold rounded-xl text-xs sm:text-sm flex items-center gap-1.5 transition-all shadow-xs disabled:cursor-not-allowed cursor-pointer shrink-0"
        >
          <Send className="w-4 h-4" />
          <span className="hidden sm:inline">Enviar</span>
        </button>
      </form>
    </div>
  );
}
