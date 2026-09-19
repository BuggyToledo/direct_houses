export interface Message {
  id: string;
  role: 'assistant' | 'user' | 'system';
  content: string;
  timestamp: string;
  quickReplies?: string[];
  isSummaryProposal?: boolean;
  isFinalHandover?: boolean;
}

export interface LeadData {
  nome: string;
  telefone: string;
  tipoAtendimento: 'comprar' | 'vender' | 'alugar' | 'tirar dúvidas' | string;
  produtoImovel: string;
  observacoes: string;
  regiao?: string;
  faixaPreco?: string;
  melhorHorario?: string;
  consentimento: string;
  origem: string;
  status: string;
  isComplete: boolean;
  confirmationRequested: boolean;
  confirmed: boolean;
  humanRequested: boolean;
  finalStructuredText: string;
  trilhaNavegacao?: string[];
  resumoNavegacao?: string;
  historicoMensagens?: Array<{ role: string; content: string; timestamp: string }>;
}

export interface AutomationStatus {
  lastDispatchedAt?: string;
  isDispatching?: boolean;
  make?: {
    attempted: boolean;
    success: boolean;
    message: string;
    timestamp?: string;
    statusCode?: number;
  };
  n8n?: {
    attempted: boolean;
    success: boolean;
    message: string;
    timestamp?: string;
    statusCode?: number;
  };
  email?: {
    attempted: boolean;
    success: boolean;
    message: string;
    timestamp?: string;
    messageId?: string;
  };
}

export interface AppSettings {
  companyName: string;
  whatsappAvailableInSystem: boolean;
  systemWhatsappNumber: string;
  soundEnabled: boolean;

  // Automação Webhook Make.com (Integromat)
  makeEnabled: boolean;
  makeWebhookUrl: string;
  makeApiKey?: string;

  // Compatibilidade anterior n8n
  n8nEnabled?: boolean;
  n8nWebhookUrl?: string;
  n8nSecretToken?: string;

  // Automação E-mail
  emailEnabled: boolean;
  emailRecipients: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  smtpSecure?: boolean;
  smtpSenderName?: string;
}

export interface SavedLead {
  id: string;
  createdAt: string;
  companyName: string;
  lead: LeadData;
  formattedText: string;
  transcriptCount: number;
}

export interface Broker {
  id: string;
  name: string;
  phone: string;
  email?: string;
  active: boolean;
  leadsReceived: number;
  lastAssignedAt?: string;
  createdAt: string;
}

export interface RoletaConfig {
  autoDispatchEnabled: boolean;
  notifyClientWithBrokerName: boolean;
  lastAssignedIndex: number;
  timeoutSeconds?: number;
  dispatchDelaySeconds?: number;
  inactivityTimeoutSeconds?: number;
  cooldownBetweenDispatchesSeconds?: number;
}

export type WhatsAppState = 'disconnected' | 'connecting' | 'qr_ready' | 'connected';

export interface WhatsAppStatus {
  state: WhatsAppState;
  qrCodeDataUrl: string | null;
  connectedPhone: string | null;
  connectedName: string | null;
  lastConnectedAt?: string;
  errorMessage?: string | null;
}

export interface WhatsAppChatSession {
  jid: string;
  phone: string;
  name: string;
  messages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }>;
  extractedLead: {
    nome: string;
    telefone: string;
    tipoAtendimento: string;
    produtoImovel: string;
    observacoes: string;
    consentimento: string;
    origem: string;
    status: string;
    isComplete: boolean;
    humanRequested: boolean;
    finalStructuredText: string;
  };
  assignedBroker?: {
    id: string;
    name: string;
    phone: string;
    assignedAt: string;
  };
  status: 'active' | 'qualified' | 'dispatched' | 'closed';
  lastActivity: string;
}

export interface AuthUser {
  email: string;
  name: string;
  picture?: string;
  role: 'admin' | 'user';
  token: string;
}

export interface AuthorizedUser {
  email: string;
  name?: string;
  role: 'admin' | 'user';
  addedAt: string;
  isPermanentAdmin?: boolean;
}

export type LeadStage =
  | 'novo'
  | 'qualificado'
  | 'roleta'
  | 'em_atendimento'
  | 'visita_agendada'
  | 'proposta'
  | 'fechado'
  | 'perdido';

export type LeadTemperatura = 'quente' | 'morno' | 'frio';

export interface LeadNotaInterna {
  id: string;
  data: string;
  autor: string;
  texto: string;
}

export interface LeadDistribuicaoItem {
  id: string;
  brokerId: string;
  brokerName: string;
  brokerPhone: string;
  data: string;
  tipo: 'automatica_roleta' | 'manual_operador' | 'timeout_recuperacao' | 'redistribuicao';
  statusEnvioWhatsApp: 'enviado' | 'link_gerado' | 'falha';
}

export interface PersistentLead {
  id: string;
  nome: string;
  telefone: string;
  email?: string;
  tipoAtendimento: string;
  produtoImovel: string;
  observacoes: string;
  initialMessage?: string;
  origem: string;
  status: string | LeadStage;
  temperatura?: LeadTemperatura;
  tags?: string[];
  valorInteresse?: string;
  createdAt: string;
  updatedAt?: string;
  assignedBroker?: {
    id: string;
    name: string;
    phone: string;
    assignedAt?: string;
  };
  rawStructuredText?: string;
  trilhaNavegacao?: string[];
  resumoNavegacao?: string;
  historicoMensagens?: Array<{ role: string; content: string; timestamp: string }>;
  notasInternas?: LeadNotaInterna[];
  historicoDistribuicoes?: LeadDistribuicaoItem[];
}

export interface RoletaDistributionLog {
  id: string;
  timestamp: string;
  leadId: string;
  leadNome: string;
  leadTelefone: string;
  brokerId: string;
  brokerNome: string;
  brokerTelefone: string;
  tipoDistribuicao: 'automatica_roleta' | 'manual_operador' | 'timeout_recuperacao' | 'redistribuicao';
  statusEnvioWhatsApp: 'enviado' | 'link_gerado' | 'falha';
  motivo?: string;
  produtoImovel?: string;
  tempoSLA?: string;
}

export interface RoletaStats {
  totalDistribuicoes: number;
  enviadosWhatsApp: number;
  linksGerados: number;
  falhas: number;
  porTipo: {
    automatica_roleta: number;
    manual_operador: number;
    timeout_recuperacao: number;
    redistribuicao: number;
  };
  distribuicoesPorCorretor: Record<string, number>;
}



