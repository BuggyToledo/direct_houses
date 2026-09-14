import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  ShieldCheck,
  Settings,
  History,
  MessageSquare,
  FileCheck2,
  Sparkles,
  Webhook,
  Mail,
} from 'lucide-react';
import { Message, LeadData, AppSettings, SavedLead, AutomationStatus } from './types';
import { ChatWindow } from './components/ChatWindow';
import { BrokerLeadCard } from './components/BrokerLeadCard';
import { RulesModal } from './components/RulesModal';
import { CompanySettingsModal } from './components/CompanySettingsModal';
import { LeadHistoryModal } from './components/LeadHistoryModal';
import { playMessageSound } from './utils/audio';

const INITIAL_SETTINGS: AppSettings = {
  companyName: 'Direct Houses',
  whatsappAvailableInSystem: false,
  systemWhatsappNumber: '+55 (21) 98765-4321',
  soundEnabled: true,
  makeEnabled: false,
  makeWebhookUrl: '',
  makeApiKey: '',
  n8nEnabled: false,
  n8nWebhookUrl: '',
  n8nSecretToken: '',
  emailEnabled: false,
  emailRecipients: 'toledo@icone-rio.com.br',
  smtpHost: '',
  smtpPort: 587,
  smtpUser: '',
  smtpPass: '',
  smtpSecure: false,
  smtpSenderName: 'Direct Houses - Plantão de Vendas',
};

const EMPTY_LEAD: LeadData = {
  nome: '',
  telefone: '',
  tipoAtendimento: '',
  produtoImovel: '',
  regiao: '',
  faixaPreco: '',
  melhorHorario: '',
  observacoes: '',
  consentimento: '',
  origem: 'Site via WhatsApp',
  status: 'Aguardando contato do corretor',
  isComplete: false,
  confirmationRequested: false,
  confirmed: false,
  humanRequested: false,
  finalStructuredText: '',
};

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('assistente_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.companyName === 'Ícone Imóveis' || !parsed.companyName) {
          parsed.companyName = 'Direct Houses';
        }
        if (parsed.smtpSenderName === 'Ícone Imóveis - Plantão de Vendas' || !parsed.smtpSenderName) {
          parsed.smtpSenderName = 'Direct Houses - Plantão de Vendas';
        }
        // Seamlessly migrate any existing n8n settings to Make.com
        if (parsed.makeEnabled === undefined && parsed.n8nEnabled !== undefined) {
          parsed.makeEnabled = parsed.n8nEnabled;
        }
        if (!parsed.makeWebhookUrl && parsed.n8nWebhookUrl) {
          parsed.makeWebhookUrl = parsed.n8nWebhookUrl;
        }
        if (!parsed.makeApiKey && parsed.n8nSecretToken) {
          parsed.makeApiKey = parsed.n8nSecretToken;
        }
        return { ...INITIAL_SETTINGS, ...parsed };
      }
      return INITIAL_SETTINGS;
    } catch {
      return INITIAL_SETTINGS;
    }
  });

  const [savedLeads, setSavedLeads] = useState<SavedLead[]>(() => {
    try {
      const saved = localStorage.getItem('assistente_saved_leads');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [messages, setMessages] = useState<Message[]>([]);
  const [lead, setLead] = useState<LeadData>(EMPTY_LEAD);
  const [isLoading, setIsLoading] = useState(false);
  const [isSavedInCurrentSession, setIsSavedInCurrentSession] = useState(false);

  // Automation tracking
  const [automationStatus, setAutomationStatus] = useState<AutomationStatus>({});
  const [dispatchedLeadSession, setDispatchedLeadSession] = useState<string | null>(null);

  // Modals state
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // Mobile navigation tab
  const [mobileTab, setMobileTab] = useState<'chat' | 'crm'>('chat');

  // Load initial greeting
  const initGreeting = useCallback(async (currentSettings: AppSettings) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/greeting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: currentSettings.companyName }),
      });
      const data = await res.json();
      const initialMsg: Message = {
        id: 'msg-greeting',
        role: 'assistant',
        content:
          data.reply ||
          `Olá! Seja muito bem-vindo(a) à ${currentSettings.companyName}. Sou o assistente comercial virtual. Vou fazer algumas perguntas rápidas para entender o que você procura e encaminhá-lo ao corretor adequado. Para começarmos, qual é o seu nome completo?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        quickReplies: data.quickReplies || [],
      };
      setMessages([initialMsg]);
      setLead(EMPTY_LEAD);
      setIsSavedInCurrentSession(false);
      setAutomationStatus({});
      setDispatchedLeadSession(null);
    } catch {
      const fallbackMsg: Message = {
        id: 'msg-greeting',
        role: 'assistant',
        content: `Olá! Seja muito bem-vindo(a) à ${currentSettings.companyName}. Sou o assistente comercial virtual. Vou fazer algumas perguntas rápidas para entender o que você procura e encaminhá-lo ao corretor adequado. Para começarmos, qual é o seu nome completo?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        quickReplies: [],
      };
      setMessages([fallbackMsg]);
      setLead(EMPTY_LEAD);
      setIsSavedInCurrentSession(false);
      setAutomationStatus({});
      setDispatchedLeadSession(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    initGreeting(settings);
  }, [initGreeting]);

  // Persist settings
  const handleSaveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    localStorage.setItem('assistente_settings', JSON.stringify(newSettings));
  };

  // Dispatch Automations (Make.com Webhook and/or Email)
  const triggerAutomationDispatch = async (targetLead: LeadData, currentMsgs: Message[], force = false) => {
    const isMakeActive = Boolean(settings.makeEnabled ?? settings.n8nEnabled);
    if (!isMakeActive && !settings.emailEnabled) return;

    const leadSignature = (targetLead.nome || '') + (targetLead.telefone || '') + (targetLead.tipoAtendimento || '');
    if (!force && dispatchedLeadSession === leadSignature) return;

    setAutomationStatus((prev) => ({ ...prev, isDispatching: true }));

    try {
      const res = await fetch('/api/automation/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead: targetLead,
          messages: currentMsgs.map((m) => ({ role: m.role, content: m.content, timestamp: m.timestamp })),
          companyName: settings.companyName,
          automations: {
            makeEnabled: isMakeActive,
            makeWebhookUrl: settings.makeWebhookUrl || settings.n8nWebhookUrl,
            makeApiKey: settings.makeApiKey || settings.n8nSecretToken,
            n8nEnabled: isMakeActive,
            n8nWebhookUrl: settings.makeWebhookUrl || settings.n8nWebhookUrl,
            n8nSecretToken: settings.makeApiKey || settings.n8nSecretToken,
            emailEnabled: settings.emailEnabled,
            emailRecipients: settings.emailRecipients,
            smtpHost: settings.smtpHost,
            smtpPort: settings.smtpPort,
            smtpUser: settings.smtpUser,
            smtpPass: settings.smtpPass,
            smtpSecure: settings.smtpSecure,
            smtpSenderName: settings.smtpSenderName,
          },
        }),
      });

      const data = await res.json();
      setAutomationStatus({
        lastDispatchedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isDispatching: false,
        make: data.results?.make || data.results?.n8n,
        n8n: data.results?.make || data.results?.n8n,
        email: data.results?.email,
      });

      setDispatchedLeadSession(leadSignature);
    } catch (err: any) {
      setAutomationStatus((prev) => ({
        ...prev,
        isDispatching: false,
        make: prev.make || { attempted: true, success: false, message: err.message || 'Erro ao enviar para Make' },
        n8n: prev.n8n || { attempted: true, success: false, message: err.message || 'Erro ao enviar automação' },
        email: prev.email || { attempted: true, success: false, message: err.message || 'Erro ao enviar e-mail' },
      }));
    }
  };

  // Persist leads to localStorage
  const handleSaveLeadToHistory = () => {
    if (isSavedInCurrentSession) return;
    const newEntry: SavedLead = {
      id: 'lead-' + Date.now(),
      createdAt: new Date().toLocaleString('pt-BR'),
      companyName: settings.companyName,
      lead: { ...lead },
      formattedText:
        lead.finalStructuredText ||
        `NOVO LEAD\n\nNome: ${lead.nome || 'Não informado'}\nTelefone: ${lead.telefone || 'Não informado'}\nTipo de atendimento: ${lead.tipoAtendimento || 'Não informado'}\nProduto ou imóvel: ${lead.produtoImovel || 'Não informado'}\nObservações: ${lead.observacoes || 'Nenhuma'}\nConsentimento para contato: ${lead.consentimento || 'Sim, autorizado conforme LGPD'}\nOrigem: Site via WhatsApp\nStatus: Aguardando contato do corretor`,
      transcriptCount: messages.length,
    };

    const updated = [newEntry, ...savedLeads];
    setSavedLeads(updated);
    localStorage.setItem('assistente_saved_leads', JSON.stringify(updated));
    setIsSavedInCurrentSession(true);
  };

  const handleDeleteSavedLead = (id: string) => {
    const updated = savedLeads.filter((l) => l.id !== id);
    setSavedLeads(updated);
    localStorage.setItem('assistente_saved_leads', JSON.stringify(updated));
  };

  const handleClearAllHistory = () => {
    if (window.confirm('Tem certeza que deseja apagar todos os leads salvos no histórico?')) {
      setSavedLeads([]);
      localStorage.removeItem('assistente_saved_leads');
    }
  };

  // Handle sending message
  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = {
      id: 'msg-user-' + Date.now(),
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          companyName: settings.companyName,
          whatsappAvailable: settings.whatsappAvailableInSystem,
          whatsappNumber: settings.systemWhatsappNumber,
        }),
      });

      const data = await response.json();
      const assistantMsg: Message = {
        id: 'msg-assistant-' + Date.now(),
        role: 'assistant',
        content: data.reply || 'Entendido. Um momento enquanto verifico os dados.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        quickReplies: data.quickReplies || [],
        isFinalHandover: Boolean(data.reply && data.reply.includes('NOVO LEAD')),
      };

      const updatedMsgsWithAssistant = [...newMessages, assistantMsg];
      setMessages(updatedMsgsWithAssistant);

      if (data.extractedLead) {
        setLead(data.extractedLead);

        // AUTO DISPATCH: If the lead is complete or requested a human, automatically trigger n8n and/or email!
        if (data.extractedLead.isComplete || data.extractedLead.humanRequested) {
          triggerAutomationDispatch(data.extractedLead, updatedMsgsWithAssistant);
        }
      }

      if (settings.soundEnabled) {
        playMessageSound();
      }
    } catch (err) {
      console.warn('Chat request notice:', err);
      const errorMsg: Message = {
        id: 'msg-err-' + Date.now(),
        role: 'assistant',
        content: `Obrigado pelas informações! Estamos registrando seus dados para a equipe da ${settings.companyName}. Um de nossos corretores entrará em contato em breve.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetChat = () => {
    initGreeting(settings);
  };

  const handleSelectPresetScenario = (scenarioText: string) => {
    handleSendMessage(scenarioText);
  };

  return (
    <div id="app-root" className="min-h-screen flex flex-col bg-slate-100 text-slate-900 font-sans">
      {/* Top Application Navbar */}
      <header
        id="app-header"
        className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-2xs"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Brand Info */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-emerald-400 flex items-center justify-center shadow-xs">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-slate-900 text-base sm:text-lg leading-tight tracking-tight">
                  Assistente Comercial
                </h1>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Lead Qualifier AI
                </span>
                {(settings.makeEnabled || settings.n8nEnabled || settings.emailEnabled) && (
                  <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-800 border border-purple-200">
                    <Sparkles className="w-3 h-3 text-purple-600" />
                    Automação Ativa
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Atendimento e Encaminhamento de Leads • {settings.companyName}
              </p>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-2">
            <button
              id="open-rules-btn"
              onClick={() => setIsRulesModalOpen(true)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-emerald-700 bg-slate-50 hover:bg-emerald-50 rounded-xl border border-slate-200 hover:border-emerald-200 flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Ver as 13 Regras de Atendimento"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span className="hidden md:inline">13 Regras</span>
            </button>

            <button
              id="open-history-btn"
              onClick={() => setIsHistoryModalOpen(true)}
              className="relative px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-blue-700 bg-slate-50 hover:bg-blue-50 rounded-xl border border-slate-200 hover:border-blue-200 flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Histórico de Leads"
            >
              <History className="w-4 h-4 text-blue-600" />
              <span className="hidden md:inline">Leads Salvos</span>
              {savedLeads.length > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-blue-600 text-white text-[10px] font-bold">
                  {savedLeads.length}
                </span>
              )}
            </button>

            <button
              id="open-settings-btn"
              onClick={() => setIsSettingsModalOpen(true)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Configurações & Automações"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Configurações</span>
              {(settings.makeEnabled || settings.n8nEnabled || settings.emailEnabled) && (
                <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Tab Toggle */}
      <div className="lg:hidden bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-center gap-2">
        <button
          id="mobile-tab-chat"
          onClick={() => setMobileTab('chat')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all ${
            mobileTab === 'chat'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Chat com Lead</span>
        </button>
        <button
          id="mobile-tab-crm"
          onClick={() => setMobileTab('crm')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all ${
            mobileTab === 'crm'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <FileCheck2 className="w-3.5 h-3.5" />
          <span>Ficha do Corretor</span>
        </button>
      </div>

      {/* Main Workspace Layout (2 Columns on Desktop) */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 min-h-[calc(100vh-4.5rem)]">
        {/* Left Column: Chat Window (7 cols on lg) */}
        <section
          id="chat-column-section"
          className={`lg:col-span-7 h-[680px] lg:h-[calc(100vh-7rem)] ${
            mobileTab === 'chat' ? 'flex flex-col' : 'hidden lg:flex lg:flex-col'
          }`}
        >
          <ChatWindow
            messages={messages}
            isLoading={isLoading}
            onSendMessage={handleSendMessage}
            onResetChat={handleResetChat}
            settings={settings}
            onSelectPresetScenario={handleSelectPresetScenario}
          />
        </section>

        {/* Right Column: Broker Terminal / Lead Card (5 cols on lg) */}
        <section
          id="broker-column-section"
          className={`lg:col-span-5 h-[680px] lg:h-[calc(100vh-7rem)] ${
            mobileTab === 'crm' ? 'flex flex-col' : 'hidden lg:flex lg:flex-col'
          }`}
        >
          <BrokerLeadCard
            lead={lead}
            companyName={settings.companyName}
            onSaveToHistory={handleSaveLeadToHistory}
            isSaved={isSavedInCurrentSession}
            automationsConfig={{
              makeEnabled: settings.makeEnabled,
              makeWebhookUrl: settings.makeWebhookUrl,
              n8nEnabled: settings.n8nEnabled,
              emailEnabled: settings.emailEnabled,
              n8nWebhookUrl: settings.n8nWebhookUrl,
              emailRecipients: settings.emailRecipients,
            }}
            automationStatus={automationStatus}
            onTriggerAutomations={() => triggerAutomationDispatch(lead, messages, true)}
            onOpenSettings={() => setIsSettingsModalOpen(true)}
          />
        </section>
      </main>

      {/* Modals */}
      <RulesModal
        isOpen={isRulesModalOpen}
        onClose={() => setIsRulesModalOpen(false)}
        companyName={settings.companyName}
      />

      <CompanySettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={settings}
        onSaveSettings={handleSaveSettings}
      />

      <LeadHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        leads={savedLeads}
        onDeleteLead={handleDeleteSavedLead}
        onClearAll={handleClearAllHistory}
      />
    </div>
  );
}
