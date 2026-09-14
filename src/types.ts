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
