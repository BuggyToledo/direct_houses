import React, { useState } from 'react';
import {
  UserCheck,
  Copy,
  Check,
  BookmarkCheck,
  Clock,
  Tag,
  Phone,
  HelpCircle,
  FileCheck,
  Shield,
  Send,
  AlertCircle,
  Webhook,
  Mail,
  RefreshCw,
  Settings,
  CheckCircle2,
  XCircle,
  Sparkles,
} from 'lucide-react';
import { LeadData, AutomationStatus } from '../types';

interface BrokerLeadCardProps {
  lead: LeadData;
  companyName: string;
  onSaveToHistory: () => void;
  isSaved?: boolean;
  automationsConfig?: {
    makeEnabled?: boolean;
    makeWebhookUrl?: string;
    n8nEnabled?: boolean;
    emailEnabled?: boolean;
    n8nWebhookUrl?: string;
    emailRecipients?: string;
  };
  automationStatus?: AutomationStatus;
  onTriggerAutomations?: () => void;
  onOpenSettings?: () => void;
}

export function BrokerLeadCard({
  lead,
  companyName,
  onSaveToHistory,
  isSaved,
  automationsConfig,
  automationStatus,
  onTriggerAutomations,
  onOpenSettings,
}: BrokerLeadCardProps) {
  const [copied, setCopied] = useState(false);

  // Compute filled fields count (out of 5 key fields)
  const fields = [
    { label: 'Nome', value: lead.nome, icon: UserCheck, key: 'nome' },
    { label: 'Telefone', value: lead.telefone, icon: Phone, key: 'telefone' },
    { label: 'Tipo de atendimento', value: lead.tipoAtendimento, icon: Tag, key: 'tipo' },
    { label: 'Produto ou imóvel', value: lead.produtoImovel, icon: HelpCircle, key: 'imovel' },
    { label: 'Observações', value: lead.observacoes, icon: FileCheck, key: 'obs' },
  ];

  const filledCount = fields.filter((f) => Boolean(f.value && f.value.trim().length > 0)).length;
  const progressPercent = Math.round((filledCount / 5) * 100);

  // Fallback constructed formatted string if finalStructuredText isn't emitted yet
  const formattedOutput =
    lead.finalStructuredText ||
    `NOVO LEAD\n\nNome: ${lead.nome || 'Não informado'}\nTelefone: ${lead.telefone || 'Não informado'}\nTipo de atendimento: ${lead.tipoAtendimento || 'Não informado'}\nProduto ou imóvel: ${lead.produtoImovel || 'Não informado'}\nObservações: ${lead.observacoes || 'Nenhuma'}\nConsentimento para contato: ${lead.consentimento || 'Registrado no atendimento conforme LGPD'}\nOrigem: Site via WhatsApp\nStatus: Aguardando contato do corretor`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formattedOutput);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleShareWhatsApp = () => {
    const encoded = encodeURIComponent(formattedOutput);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  const isMakeActive = Boolean(automationsConfig?.makeEnabled ?? automationsConfig?.n8nEnabled);
  const isEmailActive = Boolean(automationsConfig?.emailEnabled);
  const hasAnyAutomationEnabled = Boolean(isMakeActive || isEmailActive);

  return (
    <div id="broker-lead-card-root" className="flex flex-col h-full bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/70">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <h2 className="font-bold text-slate-800 text-sm sm:text-base">Painel do Corretor / CRM</h2>
          </div>
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
            {lead.isComplete ? 'Qualificado' : `${filledCount}/5 Dados`}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="mt-3">
          <div className="flex justify-between text-[11px] text-slate-500 font-medium mb-1">
            <span>Coleta de dados (Regra 4)</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                lead.isComplete ? 'bg-emerald-600' : 'bg-blue-600'
              }`}
              style={{ width: `${Math.max(8, progressPercent)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Body: Live Fields List */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
        {/* Status Pills */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-medium flex items-center gap-1.5">
            <span className="text-slate-400">Origem:</span>
            <span className="font-semibold text-slate-900">Site via WhatsApp</span>
          </div>
          <div className="px-2.5 py-1 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-medium flex items-center gap-1">
            <Clock className="w-3 h-3 text-amber-600" />
            <span>Aguardando contato do corretor</span>
          </div>
          {lead.humanRequested && (
            <div className="px-2.5 py-1 rounded-md bg-purple-50 text-purple-800 border border-purple-200 font-semibold flex items-center gap-1">
              <AlertCircle className="w-3 h-3 text-purple-600" />
              <span>Pedido de Corretor Humano</span>
            </div>
          )}
        </div>

        {/* Dynamic Fields Grid */}
        <div className="space-y-2">
          {fields.map((f) => {
            const Icon = f.icon;
            const hasVal = Boolean(f.value && f.value.trim().length > 0);
            return (
              <div
                key={f.key}
                className={`p-2.5 rounded-xl border text-xs transition-all ${
                  hasVal
                    ? 'bg-slate-50/80 border-slate-200 text-slate-800'
                    : 'bg-white border-dashed border-slate-200 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
                    <Icon className={`w-3.5 h-3.5 ${hasVal ? 'text-blue-600' : 'text-slate-300'}`} />
                    {f.label}
                  </span>
                  {hasVal && <Check className="w-3 h-3 text-emerald-600" />}
                </div>
                <div className="pl-5 font-medium break-words">
                  {hasVal ? (
                    <span className="text-slate-900">{f.value}</span>
                  ) : (
                    <span className="italic text-slate-400">Aguardando resposta do lead...</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* LGPD Consent Badge */}
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-slate-700 mb-1">
            <Shield className="w-3.5 h-3.5 text-emerald-600" />
            Consentimento LGPD (Regra 13)
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            {lead.consentimento || 'Pendente confirmação do cliente no chat.'}
          </p>
        </div>

        {/* AUTOMATION DISPATCH BOX (Sem intervenção humana) */}
        <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 text-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-800 flex items-center gap-1.5 text-xs uppercase tracking-wide">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Automações (Sem Intervenção)
            </span>
            {onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 hover:underline"
              >
                <Settings className="w-3 h-3" />
                Configurar
              </button>
            )}
          </div>

          {hasAnyAutomationEnabled ? (
            <div className="space-y-2">
              {/* Make.com Status */}
              {isMakeActive && (
                <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 text-[11px]">
                  <div className="flex items-center gap-1.5 font-medium text-slate-700">
                    <Webhook className="w-3.5 h-3.5 text-purple-600" />
                    <span>Webhook Make.com</span>
                  </div>
                  <div>
                    {(automationStatus?.make?.attempted ?? automationStatus?.n8n?.attempted) ? (
                      (automationStatus?.make?.success ?? automationStatus?.n8n?.success) ? (
                        <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-purple-600" />
                          Enviado ao Make
                        </span>
                      ) : (
                        <span
                          className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-semibold flex items-center gap-1"
                          title={automationStatus?.make?.message || automationStatus?.n8n?.message}
                        >
                          <XCircle className="w-3 h-3 text-rose-600" />
                          Falha no Make
                        </span>
                      )
                    ) : (
                      <span className="text-slate-400 font-medium">
                        {lead.isComplete ? 'Disparando...' : 'Aguardando lead'}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Email Status */}
              {automationsConfig?.emailEnabled && (
                <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 text-[11px]">
                  <div className="flex items-center gap-1.5 font-medium text-slate-700">
                    <Mail className="w-3.5 h-3.5 text-blue-600" />
                    <span>Envio por E-mail</span>
                  </div>
                  <div>
                    {automationStatus?.email?.attempted ? (
                      automationStatus.email.success ? (
                        <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-blue-600" />
                          Enviado
                        </span>
                      ) : (
                        <span
                          className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-semibold flex items-center gap-1"
                          title={automationStatus.email.message}
                        >
                          <XCircle className="w-3 h-3 text-rose-600" />
                          Falha no envio
                        </span>
                      )
                    ) : (
                      <span className="text-slate-400 font-medium">
                        {lead.isComplete ? 'Enviando...' : 'Aguardando lead'}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Trigger Again Button */}
              {onTriggerAutomations && (
                <button
                  type="button"
                  onClick={onTriggerAutomations}
                  disabled={automationStatus?.isDispatching}
                  className="w-full mt-1 py-1.5 px-2.5 rounded-lg border border-slate-300 hover:bg-slate-100/80 text-slate-700 font-medium text-[11px] flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <RefreshCw
                    className={`w-3 h-3 ${automationStatus?.isDispatching ? 'animate-spin text-purple-600' : ''}`}
                  />
                  <span>
                    {automationStatus?.isDispatching ? 'Disparando automações...' : 'Reenviar Automações Agora'}
                  </span>
                </button>
              )}
            </div>
          ) : (
            <div className="p-2.5 rounded-lg bg-purple-50/60 border border-purple-200 text-purple-900">
              <p className="text-[11px] leading-relaxed">
                As notificações automáticas de <strong>Make.com</strong> e <strong>E-mail</strong> ainda não foram ativadas.
              </p>
              {onOpenSettings && (
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="mt-1.5 text-[11px] font-bold text-purple-700 underline hover:text-purple-900"
                >
                  Ativar envio automático no Make.com e E-mail →
                </button>
              )}
            </div>
          )}
        </div>

        {/* Structured Output Card (Regra 10) */}
        <div className="pt-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <FileCheck className="w-4 h-4 text-emerald-600" />
              Resumo Formatado para o Corretor
            </span>
            <button
              id="copy-lead-summary-btn"
              onClick={handleCopy}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 hover:text-emerald-700 bg-slate-100 hover:bg-emerald-50 rounded-lg border border-slate-200 hover:border-emerald-200 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copiado!' : 'Copiar Texto'}</span>
            </button>
          </div>

          <div className="relative group">
            <pre
              id="structured-lead-output"
              className="p-3.5 rounded-xl bg-slate-900 text-emerald-400 text-[11px] font-mono whitespace-pre-wrap leading-relaxed border border-slate-800 selection:bg-emerald-800 selection:text-white"
            >
              {formattedOutput}
            </pre>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/70 flex flex-wrap items-center gap-2">
        <button
          id="copy-main-btn"
          onClick={handleCopy}
          className="flex-1 min-w-[130px] px-3 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-xs"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copiado para o Corretor' : 'Copiar Formato Lead'}
        </button>

        <button
          id="send-whatsapp-lead-btn"
          onClick={handleShareWhatsApp}
          className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs"
          title="Abrir no WhatsApp do Corretor"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Enviar WhatsApp</span>
        </button>

        <button
          id="save-lead-history-btn"
          onClick={onSaveToHistory}
          disabled={isSaved}
          className={`px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
            isSaved
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default'
              : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-300'
          }`}
          title="Salvar no Histórico Local"
        >
          <BookmarkCheck className="w-3.5 h-3.5" />
          <span>{isSaved ? 'Salvo no CRM' : 'Salvar Lead'}</span>
        </button>
      </div>
    </div>
  );
}
