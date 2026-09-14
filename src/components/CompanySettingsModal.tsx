import React, { useState } from 'react';
import {
  X,
  Building2,
  PhoneCall,
  Volume2,
  VolumeX,
  Check,
  Webhook,
  Mail,
  Send,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Sparkles,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import { AppSettings } from '../types';

interface CompanySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSaveSettings: (newSettings: AppSettings) => void;
}

type TabType = 'general' | 'make' | 'email';

export function CompanySettingsModal({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
}: CompanySettingsModalProps) {
  const [form, setForm] = useState<AppSettings>({
    ...settings,
    makeEnabled: settings.makeEnabled ?? settings.n8nEnabled ?? false,
    makeWebhookUrl: settings.makeWebhookUrl || settings.n8nWebhookUrl || '',
    makeApiKey: settings.makeApiKey || settings.n8nSecretToken || '',
  });
  const [activeTab, setActiveTab] = useState<TabType>('make'); // Default to Make.com

  // Test states for Make.com
  const [isTestingMake, setIsTestingMake] = useState(false);
  const [makeTestResult, setMakeTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Test states for email
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [emailTestResult, setEmailTestResult] = useState<{ success: boolean; message: string } | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(form);
    onClose();
  };

  const handleTestMake = async () => {
    const urlToTest = form.makeWebhookUrl || form.n8nWebhookUrl;
    if (!urlToTest || !urlToTest.trim()) {
      setMakeTestResult({ success: false, message: 'Por favor, informe a URL do Webhook do Make.com antes de testar.' });
      return;
    }

    setIsTestingMake(true);
    setMakeTestResult(null);

    try {
      const res = await fetch('/api/automation/test-make', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl: urlToTest,
          apiKey: form.makeApiKey || form.n8nSecretToken,
          companyName: form.companyName,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setMakeTestResult({
          success: true,
          message: data.message || 'Conexão com o Make.com estabelecida com sucesso! O webhook recebeu o payload.',
        });
      } else {
        setMakeTestResult({
          success: false,
          message: data.message || data.error || 'Erro ao conectar com o Make.com.',
        });
      }
    } catch (err: any) {
      setMakeTestResult({
        success: false,
        message: `Falha na requisição: ${err.message || String(err)}`,
      });
    } finally {
      setIsTestingMake(false);
    }
  };

  const handleTestEmail = async () => {
    if (!form.emailRecipients || !form.emailRecipients.trim()) {
      setEmailTestResult({ success: false, message: 'Informe pelo menos um e-mail de destino para teste.' });
      return;
    }

    setIsTestingEmail(true);
    setEmailTestResult(null);

    try {
      const res = await fetch('/api/automation/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          smtp: {
            host: form.smtpHost,
            port: form.smtpPort,
            user: form.smtpUser,
            pass: form.smtpPass,
            secure: form.smtpSecure,
            senderName: form.smtpSenderName,
          },
          recipients: form.emailRecipients,
          companyName: form.companyName,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setEmailTestResult({
          success: true,
          message: data.message || 'E-mail de teste enviado com sucesso! Verifique sua caixa de entrada.',
        });
      } else {
        setEmailTestResult({
          success: false,
          message: data.message || data.error || 'Erro ao enviar e-mail via SMTP.',
        });
      }
    } catch (err: any) {
      setEmailTestResult({
        success: false,
        message: `Falha na requisição: ${err.message || String(err)}`,
      });
    } finally {
      setIsTestingEmail(false);
    }
  };

  const applySmtpPreset = (preset: 'gmail' | 'outlook' | 'hostinger') => {
    if (preset === 'gmail') {
      setForm((prev) => ({
        ...prev,
        smtpHost: 'smtp.gmail.com',
        smtpPort: 587,
        smtpSecure: false,
      }));
    } else if (preset === 'outlook') {
      setForm((prev) => ({
        ...prev,
        smtpHost: 'smtp.office365.com',
        smtpPort: 587,
        smtpSecure: false,
      }));
    } else if (preset === 'hostinger') {
      setForm((prev) => ({
        ...prev,
        smtpHost: 'smtp.hostinger.com',
        smtpPort: 465,
        smtpSecure: true,
      }));
    }
  };

  return (
    <div
      id="settings-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        id="settings-modal-content"
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shadow-xs">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-lg">Configurações & Automação</h3>
              <p className="text-xs text-slate-500">Envio de leads sem intervenção manual</p>
            </div>
          </div>
          <button
            id="close-settings-modal-btn"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 px-6 pt-3 border-b border-slate-200 bg-slate-50/40 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('make')}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-t-lg border-b-2 transition-colors ${
              activeTab === 'make'
                ? 'border-purple-600 text-purple-700 bg-white shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
            }`}
          >
            <Webhook className="w-3.5 h-3.5 text-purple-600" />
            <span>Webhook Make.com</span>
            {form.makeEnabled && (
              <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" title="Ativo" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('email')}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-t-lg border-b-2 transition-colors ${
              activeTab === 'email'
                ? 'border-blue-600 text-blue-700 bg-white shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
            }`}
          >
            <Mail className="w-3.5 h-3.5 text-blue-600" />
            <span>Envio por E-mail</span>
            {form.emailEnabled && (
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" title="Ativo" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-t-lg border-b-2 transition-colors ${
              activeTab === 'general'
                ? 'border-slate-800 text-slate-900 bg-white shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 text-slate-500" />
            <span>Geral & Empresa</span>
          </button>
        </div>

        {/* Form Body with Scroll */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* TAB 1: WEBHOOK MAKE.COM */}
          {activeTab === 'make' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-purple-50/70 border border-purple-200">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold text-purple-900 uppercase tracking-wide flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-purple-600" />
                      Disparo Automático para o Make.com (Integromat)
                    </span>
                    <p className="text-xs text-purple-800 mt-1 leading-relaxed">
                      Quando ativo, o assistente envia o JSON estruturado do lead diretamente para o seu cenário no <strong>Make.com</strong> assim que a qualificação for concluída, <strong>sem precisar de clique manual</strong>.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                    <input
                      id="settings-toggle-make"
                      type="checkbox"
                      checked={form.makeEnabled}
                      onChange={(e) => setForm({ ...form, makeEnabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>
              </div>

              {/* Guia Rápido Make */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1.5">
                <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-600"></span>
                  Como configurar no Make.com em 3 passos:
                </div>
                <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed text-slate-600 pl-1">
                  <li>No seu painel do <strong>Make.com</strong>, crie um novo Scenario e adicione o módulo <strong>Webhooks &gt; Custom webhook</strong>.</li>
                  <li>Clique em <strong>Add</strong> para gerar o link do webhook e copie a URL gerada (ex: <code>https://hook.eu1.make.com/...</code>).</li>
                  <li>Cole a URL no campo abaixo e clique em <strong>Testar Make</strong> para receber o payload de teste com todos os dados mapeados!</li>
                </ol>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                  URL do Webhook do Make.com (Custom Webhook) <span className="text-rose-500">*</span>
                </label>
                <input
                  id="settings-make-url-input"
                  type="url"
                  value={form.makeWebhookUrl || ''}
                  onChange={(e) => setForm({ ...form, makeWebhookUrl: e.target.value })}
                  placeholder="https://hook.eu1.make.com/sua-chave-webhook-aqui"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  O Make aceita requisições HTTP <code>POST</code> com JSON e distribui facilmente para Kommo, RD Station, Planilhas Google ou WhatsApp.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                  Chave de API / Header Token (Opcional)
                </label>
                <input
                  id="settings-make-secret-input"
                  type="password"
                  value={form.makeApiKey || ''}
                  onChange={(e) => setForm({ ...form, makeApiKey: e.target.value })}
                  placeholder="Ex: sua-chave-de-api-ou-token"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Enviado nos headers <code>Authorization: Bearer</code> e <code>x-make-apikey</code> caso seu webhook exija autenticação.
                </p>
              </div>

              {/* Live Test Action */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-semibold text-slate-700">Testar Disparo para o Make</span>
                    <p className="text-[11px] text-slate-500">Envia um evento de teste com lead simulado para o Make determinar a estrutura de dados</p>
                  </div>
                  <button
                    id="test-make-btn"
                    type="button"
                    onClick={handleTestMake}
                    disabled={isTestingMake || !form.makeWebhookUrl}
                    className="px-3.5 py-2 text-xs font-semibold bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-300 rounded-xl flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isTestingMake ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-700" />
                    ) : (
                      <Send className="w-3.5 h-3.5 text-purple-700" />
                    )}
                    <span>{isTestingMake ? 'Testando...' : 'Testar Make'}</span>
                  </button>
                </div>

                {makeTestResult && (
                  <div
                    className={`mt-3 p-3 rounded-xl border text-xs flex items-start gap-2 ${
                      makeTestResult.success
                        ? 'bg-purple-50 border-purple-200 text-purple-900'
                        : 'bg-rose-50 border-rose-200 text-rose-800'
                    }`}
                  >
                    {makeTestResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <span className="leading-relaxed">{makeTestResult.message}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: ENVIO POR E-MAIL */}
          {activeTab === 'email' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold text-blue-900 uppercase tracking-wide flex items-center gap-1.5">
                      <Mail className="w-4 h-4 text-blue-600" />
                      Disparo Automático por E-mail
                    </span>
                    <p className="text-xs text-blue-800 mt-1 leading-relaxed">
                      Envia a ficha estruturada do lead e a transcrição da conversa para os corretores e gerentes no momento da qualificação.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                    <input
                      id="settings-toggle-email"
                      type="checkbox"
                      checked={form.emailEnabled}
                      onChange={(e) => setForm({ ...form, emailEnabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                  E-mails de Destino (Corretores / Gerência) <span className="text-rose-500">*</span>
                </label>
                <input
                  id="settings-email-recipients-input"
                  type="text"
                  value={form.emailRecipients || ''}
                  onChange={(e) => setForm({ ...form, emailRecipients: e.target.value })}
                  placeholder="toledo@icone-rio.com.br, plantao@icone-rio.com.br"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Separe múltiplos endereços por vírgula.
                </p>
              </div>

              {/* SMTP Settings Box */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                    Servidor SMTP (Envio Direto)
                  </span>
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <span className="text-slate-500 font-medium">Preencher:</span>
                    <button
                      type="button"
                      onClick={() => applySmtpPreset('gmail')}
                      className="px-2 py-0.5 rounded-md bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium transition-colors"
                    >
                      Gmail
                    </button>
                    <button
                      type="button"
                      onClick={() => applySmtpPreset('outlook')}
                      className="px-2 py-0.5 rounded-md bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium transition-colors"
                    >
                      Outlook
                    </button>
                    <button
                      type="button"
                      onClick={() => applySmtpPreset('hostinger')}
                      className="px-2 py-0.5 rounded-md bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium transition-colors"
                    >
                      Hostinger
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Servidor SMTP (Host)
                    </label>
                    <input
                      id="settings-smtp-host"
                      type="text"
                      value={form.smtpHost || ''}
                      onChange={(e) => setForm({ ...form, smtpHost: e.target.value })}
                      placeholder="smtp.gmail.com"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Porta
                    </label>
                    <input
                      id="settings-smtp-port"
                      type="number"
                      value={form.smtpPort || 587}
                      onChange={(e) => setForm({ ...form, smtpPort: parseInt(e.target.value, 10) || 587 })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Usuário / E-mail Remetente
                    </label>
                    <input
                      id="settings-smtp-user"
                      type="text"
                      value={form.smtpUser || ''}
                      onChange={(e) => setForm({ ...form, smtpUser: e.target.value })}
                      placeholder="leads@icone-rio.com.br"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Senha ou Senha de App
                    </label>
                    <input
                      id="settings-smtp-pass"
                      type="password"
                      value={form.smtpPass || ''}
                      onChange={(e) => setForm({ ...form, smtpPass: e.target.value })}
                      placeholder="••••••••••••"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Nome do Remetente no E-mail
                  </label>
                  <input
                    id="settings-smtp-sender"
                    type="text"
                    value={form.smtpSenderName || ''}
                    onChange={(e) => setForm({ ...form, smtpSenderName: e.target.value })}
                    placeholder="Direct Houses - Plantão de Vendas"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800"
                  />
                </div>
              </div>

              {/* Live Test Action */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-semibold text-slate-700">Testar Envio de E-mail</span>
                    <p className="text-[11px] text-slate-500">Envia um e-mail de demonstração para o destinatário informado</p>
                  </div>
                  <button
                    id="test-email-btn"
                    type="button"
                    onClick={handleTestEmail}
                    disabled={isTestingEmail || !form.emailRecipients}
                    className="px-3.5 py-2 text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-300 rounded-xl flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isTestingEmail ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-700" />
                    ) : (
                      <Send className="w-3.5 h-3.5 text-blue-700" />
                    )}
                    <span>{isTestingEmail ? 'Enviando...' : 'Testar E-mail'}</span>
                  </button>
                </div>

                {emailTestResult && (
                  <div
                    className={`mt-3 p-3 rounded-xl border text-xs flex items-start gap-2 ${
                      emailTestResult.success
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-rose-50 border-rose-200 text-rose-800'
                    }`}
                  >
                    {emailTestResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <span className="leading-relaxed">{emailTestResult.message}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: GERAL */}
          {activeTab === 'general' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                  Nome da Empresa / Imobiliária
                </label>
                <input
                  id="settings-company-name-input"
                  type="text"
                  required
                  value={form.companyName}
                  onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                  placeholder="Ex: Direct Houses, Imobiliária Aliança"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Substitui a identidade da imobiliária nas saudações e nos textos enviados aos corretores.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <PhoneCall className="w-3.5 h-3.5 text-emerald-600" />
                      Regra 5: WhatsApp pré-cadastrado no sistema
                    </span>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      Quando ativo, o assistente sabe que o número já está registrado e valida com o cliente se pode utilizá-lo.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                    <input
                      id="settings-toggle-whatsapp-available"
                      type="checkbox"
                      checked={form.whatsappAvailableInSystem}
                      onChange={(e) => setForm({ ...form, whatsappAvailableInSystem: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                {form.whatsappAvailableInSystem && (
                  <div className="pt-2 border-t border-slate-200">
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Número de WhatsApp cadastrado:
                    </label>
                    <input
                      id="settings-system-whatsapp-input"
                      type="text"
                      value={form.systemWhatsappNumber}
                      onChange={(e) => setForm({ ...form, systemWhatsappNumber: e.target.value })}
                      placeholder="+55 (21) 98765-4321"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50/60">
                <div className="flex items-center gap-2.5">
                  {form.soundEnabled ? (
                    <Volume2 className="w-4 h-4 text-slate-700" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-slate-400" />
                  )}
                  <div>
                    <span className="text-xs font-semibold text-slate-700">Som de notificação de mensagens</span>
                    <p className="text-[11px] text-slate-500">Efeito sonoro sutil quando o assistente responde</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    id="settings-toggle-sound"
                    type="checkbox"
                    checked={form.soundEnabled}
                    onChange={(e) => setForm({ ...form, soundEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          )}

          {/* Modal Actions Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 shrink-0">
            <button
              id="cancel-settings-btn"
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              id="save-settings-btn"
              type="submit"
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all shadow-xs"
            >
              <Check className="w-4 h-4" />
              Salvar Alterações
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
