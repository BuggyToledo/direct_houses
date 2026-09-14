import { GoogleGenAI } from '@google/genai';
import { whatsAppService, IncomingWhatsAppMessageEvent } from './whatsapp-service';
import {
  getNextBrokerInRoleta,
  getRoletaConfig,
  formatBrokerLeadMessage,
  formatClientAssignedMessage,
  cleanPhoneNumber,
  getBrokers,
} from './broker-roleta';

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

// In-memory sessions store
const sessions = new Map<string, WhatsAppChatSession>();

// Initialize Google GenAI client
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function buildSystemPrompt(companyName: string = 'Direct Houses', customerPhone: string) {
  return `Você é o assistente comercial oficial da imobiliária ${companyName}.
Você está conversando DIRETAMENTE no WhatsApp com o cliente (número: ${customerPhone}).

Sua missão é realizar o atendimento inicial, qualificar o interesse do cliente de forma calorosa, ágil e profissional, e preparar os dados para encaminhar a um de nossos corretores especialistas.

Regras Obrigatórias de Atendimento no WhatsApp:
1. Seja cordial, conciso e use formatação limpa e emojis moderados adequados ao WhatsApp.
2. Não envie blocos de texto gigantescos; envie mensagens diretas e agradáveis de ler no celular.
3. Faça UMA única pergunta por vez para não sobrecarregar o cliente.
4. Colete em ordem:
   - Nome completo do cliente (se ele ainda não informou);
   - Telefone de contato (confirme se o número atual do WhatsApp é o melhor para falar);
   - Tipo de atendimento desejado (Comprar, Alugar, Vender ou Tirar Dúvidas);
   - Perfil do imóvel ou produto de interesse (ex: apartamento 2 ou 3 quartos, casa em condomínio, bairro preferido, etc.);
   - Observações adicionais ou urgência (se houver).
5. Se o cliente solicitar atendimento humano / falar com corretor em qualquer momento, finalize educadamente dizendo que está transferindo para a equipe.
6. Nunca invente valores, disponibilidades ou dados inexistentes.
7. Antes de concluir, mostre um resumo dos dados coletados e peça a confirmação rápida do cliente.
8. Ao receber a confirmação final do cliente (ou se ele pediu atendente humano), emita no final da sua resposta o bloco estruturado exatamente assim:

NOVO LEAD
Nome: [Nome]
Telefone: [Telefone]
Tipo de atendimento: [Comprar, Vender, Alugar ou Dúvidas]
Produto ou imóvel: [Descrição do Imóvel]
Observações: [Observações ou Nenhuma]
Consentimento para contato: Sim, autorizado conforme LGPD
Origem: WhatsApp Web Direct Houses
Status: Aguardando contato do corretor`;
}

// Fallback rule-based bot for WhatsApp
function getFallbackReply(
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  customerName: string,
  customerPhone: string,
  companyName: string = 'Direct Houses'
): string {
  const userMsgs = history.filter((m) => m.role === 'user');
  const count = userMsgs.length;
  const lastMsg = (userMsgs[userMsgs.length - 1]?.content || '').toLowerCase();

  if (
    lastMsg.includes('humano') ||
    lastMsg.includes('corretor') ||
    lastMsg.includes('falar com pessoa') ||
    lastMsg.includes('atendente')
  ) {
    return `Perfeito! Estou transferindo seu atendimento agora mesmo para um de nossos corretores especialistas da ${companyName}.\n\nNOVO LEAD\nNome: ${customerName}\nTelefone: ${customerPhone}\nTipo de atendimento: Atendimento personalizado\nProduto ou imóvel: A definir com corretor\nObservações: Cliente solicitou contato com corretor.\nConsentimento para contato: Sim, autorizado conforme LGPD\nOrigem: WhatsApp Web Direct Houses\nStatus: Aguardando contato do corretor`;
  }

  switch (count) {
    case 1:
      return `Olá, ${customerName}! Seja muito bem-vindo(a) à *${companyName}*. 🏡\n\nSou o assistente comercial virtual. Vou fazer algumas perguntas rápidas para entender o seu objetivo e conectá-lo(a) ao corretor ideal.\n\nPara começarmos, qual é o seu *nome completo* e o melhor telefone de contato?`;
    case 2:
      return `Muito prazer! 😊\n\nQual tipo de atendimento você procura hoje: *Comprar*, *Alugar*, *Vender* um imóvel ou *Tirar dúvidas*?`;
    case 3:
      return `Excelente! Que tipo de imóvel você tem em mente? (Por exemplo: apartamento de 2 ou 3 quartos, casa em condomínio, sala comercial, região de preferência...)`;
    case 4:
      return `Perfeito! Há alguma observação adicional importante (como vaga de garagem, faixa de valor ou urgência)? Se não houver, pode apenas me dizer "sem observações".`;
    case 5:
      return `Ótimo! Antes de encaminhar ao corretor, por favor confirme se seus dados estão corretos:\n\n• Nome: ${customerName}\n• Telefone: ${customerPhone}\n• Interesse: ${userMsgs[2]?.content || 'Imobiliário'}\n• Imóvel: ${userMsgs[3]?.content || 'Conforme conversa'}\n\nVocê confirma esses dados e autoriza o contato do corretor?`;
    default:
      return `Muito obrigado pela confirmação! 👍\n\nEstou gerando a sua ficha de atendimento para o corretor responsável da ${companyName}.\n\nNOVO LEAD\nNome: ${customerName}\nTelefone: ${customerPhone}\nTipo de atendimento: ${userMsgs[2]?.content || 'Comprar/Alugar'}\nProduto ou imóvel: ${userMsgs[3]?.content || 'Imóvel residencial'}\nObservações: ${userMsgs[4]?.content || 'Nenhuma'}\nConsentimento para contato: Sim, autorizado conforme LGPD\nOrigem: WhatsApp Web Direct Houses\nStatus: Aguardando contato do corretor`;
  }
}

// Structured lead extractor
function extractLeadFromSession(session: WhatsAppChatSession) {
  const fullText = session.messages.map((m) => m.content).join('\n');
  const userText = session.messages
    .filter((m) => m.role === 'user')
    .map((m) => m.content)
    .join(' ');

  const hasNovoLead = fullText.includes('NOVO LEAD');
  let finalStructuredText = '';
  if (hasNovoLead) {
    const match = fullText.match(/NOVO LEAD[\s\S]*?(Status: Aguardando contato do corretor|$)/);
    if (match) finalStructuredText = match[0].trim();
  }

  const getField = (field: string) => {
    if (!finalStructuredText) return '';
    const regex = new RegExp(`(?:^|\\n)${field}:\\s*([^\\n]+)`, 'i');
    const m = finalStructuredText.match(regex);
    return m ? m[1].trim() : '';
  };

  const blockNome = getField('Nome');
  const blockTipo = getField('Tipo de atendimento');
  const blockProduto = getField('Produto ou imóvel');
  const blockObs = getField('Observações');

  let tipo = blockTipo;
  if (!tipo) {
    if (/\bcompr(ar|a|o)?\b/i.test(userText)) tipo = 'comprar';
    else if (/\balug(ar|uel|o)?\b/i.test(userText)) tipo = 'alugar';
    else if (/\bvend(er|a|o)?\b/i.test(userText)) tipo = 'vender';
    else if (/d[uú]vida/i.test(userText)) tipo = 'tirar dúvidas';
  }

  const humanRequested = /(atendente\s*humano|falar\s*com\s*(um\s*)?humano|falar\s*com\s*(uma\s*)?pessoa|corretor)/i.test(
    userText
  );
  const isFinished = hasNovoLead || humanRequested;

  session.extractedLead = {
    nome: blockNome || session.name || 'Cliente',
    telefone: session.phone,
    tipoAtendimento: tipo || 'Interesse imobiliário',
    produtoImovel: blockProduto || 'A combinar',
    observacoes: blockObs || (humanRequested ? 'Cliente solicitou falar com corretor.' : 'Nenhuma'),
    consentimento: 'Sim, autorizado conforme LGPD',
    origem: 'WhatsApp Web Direct Houses',
    status: isFinished ? 'Qualificado - Aguardando corretor' : 'Em atendimento inicial',
    isComplete: isFinished,
    humanRequested,
    finalStructuredText:
      finalStructuredText ||
      (isFinished
        ? `NOVO LEAD\nNome: ${blockNome || session.name || 'Cliente'}\nTelefone: ${session.phone}\nTipo de atendimento: ${
            tipo || 'Interesse imobiliário'
          }\nProduto ou imóvel: ${blockProduto || 'A combinar'}\nObservações: ${
            blockObs || 'Nenhuma'
          }\nConsentimento para contato: Sim, autorizado conforme LGPD\nOrigem: WhatsApp Web Direct Houses\nStatus: Aguardando contato do corretor`
        : ''),
  };

  if (isFinished && session.status === 'active') {
    session.status = 'qualified';
  }
}

/**
 * Handle incoming message from WhatsApp Webhook/Baileys
 */
export async function handleIncomingWhatsAppMessage(event: IncomingWhatsAppMessageEvent): Promise<void> {
  const { jid, senderPhone, senderName, messageText } = event;
  const companyName = process.env.COMPANY_NAME || 'Direct Houses';

  // Get or create session
  let session = sessions.get(jid);
  if (!session) {
    session = {
      jid,
      phone: senderPhone,
      name: senderName || 'Cliente',
      messages: [],
      extractedLead: {
        nome: senderName || 'Cliente',
        telefone: senderPhone,
        tipoAtendimento: '',
        produtoImovel: '',
        observacoes: '',
        consentimento: 'Sim, autorizado conforme LGPD',
        origem: 'WhatsApp Web Direct Houses',
        status: 'Em atendimento inicial',
        isComplete: false,
        humanRequested: false,
        finalStructuredText: '',
      },
      status: 'active',
      lastActivity: new Date().toISOString(),
    };
    sessions.set(jid, session);
  }

  // Record user message
  session.messages.push({
    id: `msg-${Date.now()}-user`,
    role: 'user',
    content: messageText,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  });
  session.lastActivity = new Date().toISOString();

  // Generate AI reply
  let replyText = '';
  const aiClient = getGeminiClient();

  if (aiClient) {
    try {
      const systemInstruction = buildSystemPrompt(companyName, senderPhone);
      const contents = session.messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

      const response = await aiClient.models.generateContent({
        model: 'gemini-2.5-flash',
        contents,
        config: {
          systemInstruction,
          temperature: 0.4,
          topP: 0.9,
        },
      });

      replyText = response.text?.trim() || '';
    } catch (err) {
      console.warn('Fallback ativado no WhatsApp AI:', err);
      replyText = getFallbackReply(session.messages, senderName, senderPhone, companyName);
    }
  } else {
    replyText = getFallbackReply(session.messages, senderName, senderPhone, companyName);
  }

  // Record assistant response
  session.messages.push({
    id: `msg-${Date.now()}-assistant`,
    role: 'assistant',
    content: replyText,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  });

  // Send response back to customer on WhatsApp
  await whatsAppService.sendTextMessage(jid, replyText);

  // Extract structured lead data
  extractLeadFromSession(session);

  // Check if lead was qualified/finished and if Auto Roleta is enabled
  const roletaConfig = getRoletaConfig();
  if (session.extractedLead.isComplete && session.status !== 'dispatched' && roletaConfig.autoDispatchEnabled) {
    await dispatchSessionLeadToRoleta(session, companyName);
  }
}

/**
 * Dispatch session lead to the next broker in Roleta
 */
export async function dispatchSessionLeadToRoleta(
  session: WhatsAppChatSession,
  companyName: string = 'Direct Houses'
): Promise<{ success: boolean; message: string; broker?: any }> {
  const chosenBroker = getNextBrokerInRoleta();

  if (!chosenBroker) {
    return {
      success: false,
      message: 'Nenhum corretor ativo na fila da Roleta.',
    };
  }

  // 1. Build and send dossier to broker's WhatsApp
  const brokerMessage = formatBrokerLeadMessage(session.extractedLead, companyName, session.phone);
  const sendRes = await whatsAppService.sendTextMessage(chosenBroker.phone, brokerMessage);

  if (sendRes.success) {
    session.status = 'dispatched';
    session.assignedBroker = {
      id: chosenBroker.id,
      name: chosenBroker.name,
      phone: chosenBroker.phone,
      assignedAt: new Date().toISOString(),
    };

    // 2. Optionally notify customer on WhatsApp with the broker's name
    const roletaConfig = getRoletaConfig();
    if (roletaConfig.notifyClientWithBrokerName) {
      const clientNotice = formatClientAssignedMessage(chosenBroker.name, companyName);
      await whatsAppService.sendTextMessage(session.jid, clientNotice);

      session.messages.push({
        id: `msg-${Date.now()}-broker-assigned`,
        role: 'assistant',
        content: clientNotice,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    }

    console.log(`🎯 [Roleta] Lead de ${session.extractedLead.nome} (${session.phone}) encaminhado para ${chosenBroker.name} (${chosenBroker.phone})`);
    return {
      success: true,
      message: `Lead encaminhado com sucesso para o corretor ${chosenBroker.name}.`,
      broker: chosenBroker,
    };
  } else {
    return {
      success: false,
      message: `Falha ao enviar mensagem para o WhatsApp do corretor ${chosenBroker.name}: ${sendRes.error}`,
      broker: chosenBroker,
    };
  }
}

/**
 * Dispatch session lead manually to a specific broker
 */
export async function dispatchSessionLeadToSpecificBroker(
  sessionJid: string,
  brokerId: string,
  companyName: string = 'Direct Houses'
): Promise<{ success: boolean; message: string; broker?: any }> {
  const session = sessions.get(sessionJid);
  if (!session) {
    return { success: false, message: 'Sessão de atendimento não encontrada.' };
  }

  const brokers = getBrokers();
  const chosenBroker = brokers.find((b) => b.id === brokerId);
  if (!chosenBroker) {
    return { success: false, message: 'Corretor não encontrado.' };
  }

  const brokerMessage = formatBrokerLeadMessage(session.extractedLead, companyName, session.phone);
  const sendRes = await whatsAppService.sendTextMessage(chosenBroker.phone, brokerMessage);

  if (sendRes.success) {
    chosenBroker.leadsReceived = (chosenBroker.leadsReceived || 0) + 1;
    chosenBroker.lastAssignedAt = new Date().toISOString();

    session.status = 'dispatched';
    session.assignedBroker = {
      id: chosenBroker.id,
      name: chosenBroker.name,
      phone: chosenBroker.phone,
      assignedAt: new Date().toISOString(),
    };

    const clientNotice = formatClientAssignedMessage(chosenBroker.name, companyName);
    await whatsAppService.sendTextMessage(session.jid, clientNotice);

    return {
      success: true,
      message: `Lead encaminhado com sucesso para ${chosenBroker.name}.`,
      broker: chosenBroker,
    };
  } else {
    return {
      success: false,
      message: `Falha ao enviar mensagem para o corretor: ${sendRes.error}`,
    };
  }
}

export function getAllWhatsAppSessions(): WhatsAppChatSession[] {
  return Array.from(sessions.values()).sort(
    (a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
  );
}

export function getWhatsAppSession(jid: string): WhatsAppChatSession | undefined {
  return sessions.get(jid);
}

// Hook message listener into WhatsApp service
whatsAppService.onMessage(handleIncomingWhatsAppMessage);
