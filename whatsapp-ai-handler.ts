import { GoogleGenAI } from '@google/genai';
import { whatsAppService, IncomingWhatsAppMessageEvent } from './whatsapp-service';
import {
  getNextBrokerInRoleta,
  getRoletaConfig,
  formatBrokerLeadMessage,
  formatClientAssignedMessage,
  cleanPhoneNumber,
  formatPhoneForDisplay,
  isValidPhoneNumber,
  extractPhoneFromText,
  getBrokers,
} from './broker-roleta';
import { recordLead } from './leads-service';

export interface WhatsAppChatSession {
  jid: string;
  phone: string;
  name: string;
  initialMessage: string;
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
    initialMessage?: string;
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

const CANDIDATE_MODELS = [
  'gemini-2.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-3.8-flash',
  'gemini-flash-latest',
];

function isGreetingOnly(text: string): boolean {
  const t = text.trim().toLowerCase().replace(/[!.?,]/g, '');
  const greetings = [
    'oi',
    'ola',
    'olá',
    'bom dia',
    'boa tarde',
    'boa noite',
    'opa',
    'ola bom dia',
    'oi bom dia',
    'olá bom dia',
    'ola boa tarde',
    'oi boa tarde',
    'tudo bem',
    'ola tudo bem',
    'oi tudo bem',
  ];
  return greetings.includes(t) || t.length <= 3;
}

function buildSystemPrompt(companyName: string = 'Direct Houses', customerPhone: string, initialMessage: string = '') {
  const hasValidPhone = isValidPhoneNumber(customerPhone);
  const displayPhone = hasValidPhone ? formatPhoneForDisplay(customerPhone) : '';

  return `Você é o assistente comercial oficial da imobiliária ${companyName}.
Você está conversando DIRETAMENTE no WhatsApp com um cliente que entrou em contato.

${initialMessage ? `[PRIMEIRA MENSAGEM DO CLIENTE / LINK DE ANÚNCIO]: "${initialMessage}"` : ''}
${
  hasValidPhone
    ? `[TELEFONE DO CLIENTE DETECTADO AUTOMATICAMENTE]: ${displayPhone}`
    : `[TELEFONE DO CLIENTE]: Não detectado automaticamente. Você deve solicitar o número com DDD.`
}

MISSÃO:
Realizar o atendimento inicial com simpatia e agilidade, coletar o nome, confirmar/coletar o telefone, entender a intenção (Comprar/Alugar/Vender) e o imóvel de interesse, anotar observações e preparar a ficha do lead para o corretor.

REGRAS OBRIGATÓRIAS:
1. Faça UMA única pergunta por vez. Mensagens concisas, profissionais e com emojis moderados.
2. NUNCA confunda os campos:
   - "Nome": O nome completo real do cliente (ex: Adriano Toledo). NUNCA coloque saudações ("Oi", "bom dia") como Nome!
   - "Telefone": O número com DDD (ex: (21) 97202-0348). NUNCA coloque o telefone no campo Tipo de Atendimento!
   - "Tipo de atendimento": Comprar, Alugar, Vender ou Tirar Dúvidas.
   - "Produto ou imóvel": Apartamento 2 quartos, Casa, etc.
   - "Observações": Detalhes adicionais, link/código do imóvel enviado, ou preferências.
3. FLUXO CONVERSACIONAL:
   - Se o cliente mandou apenas uma saudação ("bom dia", "olá"): Cumprimente de volta e pergunte o Nome Completo dele.
   - Assim que o cliente disser o Nome:
     ${
       hasValidPhone
         ? `Agradeça e confirme o telefone: "Prazer em falar com você, [Nome]! Identifiquei seu número de WhatsApp como ${displayPhone}. Este é o melhor telefone para o corretor falar com você ou você prefere informar outro número?"`
         : `Agradeça e peça o telefone com DDD: "Prazer em falar com você, [Nome]! Qual é o seu número de WhatsApp com DDD para o corretor entrar em contato com você?"`
     }
   - Quando o telefone for confirmado/informado: Pergunte o Tipo de Atendimento (*Comprar*, *Alugar*, *Vender* ou *Tirar Dúvidas*).
   - Em seguida: Pergunte o tipo de imóvel (ex: quantos quartos, bairro de interesse...).
   - Em seguida: Pergunte se há alguma observação adicional importante.
   - Ao final: Mostre um resumo breve dos dados e peça a confirmação.
4. Se o cliente pedir corretor humano a qualquer momento, finalize educadamente dizendo que está transferindo.
5. Quando o cliente confirmar ou pedir corretor, emita OBRIGATORIAMENTE no final da resposta o seguinte bloco:

NOVO LEAD
Nome: [Nome real do cliente]
Telefone: [Telefone com DDD]
Tipo de atendimento: [Comprar, Vender, Alugar ou Tirar Dúvidas]
Produto ou imóvel: [Descrição do imóvel]
Observações: [Observações do cliente e link do imóvel se houver]
Consentimento para contato: Sim, autorizado conforme LGPD
Origem: WhatsApp Web Direct Houses
Status: Aguardando contato do corretor`;
}

/**
 * Robust Dialog State Machine for fallback when AI is offline or processing simple steps
 */
function getFallbackReply(
  session: WhatsAppChatSession,
  companyName: string = 'Direct Houses'
): string {
  const userMsgs = session.messages.filter((m) => m.role === 'user');
  const lastUserMsg = (userMsgs[userMsgs.length - 1]?.content || '').trim();
  const lowerLastMsg = lastUserMsg.toLowerCase();

  // Check for human broker request
  if (
    lowerLastMsg.includes('humano') ||
    lowerLastMsg.includes('corretor') ||
    lowerLastMsg.includes('falar com pessoa') ||
    lowerLastMsg.includes('atendente')
  ) {
    const verifiedPhone = formatPhoneForDisplay(session.phone) || 'A definir';
    return (
      `Perfeito! Estou transferindo seu atendimento agora mesmo para um de nossos corretores especialistas da ${companyName}.\n\n` +
      `NOVO LEAD\n` +
      `Nome: ${session.name !== 'Cliente' ? session.name : 'Cliente WhatsApp'}\n` +
      `Telefone: ${verifiedPhone}\n` +
      `Tipo de atendimento: Atendimento personalizado\n` +
      `Produto ou imóvel: ${session.extractedLead.produtoImovel || 'A combinar com corretor'}\n` +
      `Observações: ${session.extractedLead.observacoes || 'Cliente solicitou falar com corretor.'}\n` +
      `Consentimento para contato: Sim, autorizado conforme LGPD\n` +
      `Origem: WhatsApp Web Direct Houses\n` +
      `Status: Aguardando contato do corretor`
    );
  }

  // Extract any phone number present in user messages
  for (const m of userMsgs) {
    const detectedPhone = extractPhoneFromText(m.content);
    if (detectedPhone && isValidPhoneNumber(detectedPhone)) {
      session.phone = detectedPhone;
      session.extractedLead.telefone = formatPhoneForDisplay(detectedPhone);
    }
  }

  // Extract name if available (first non-greeting message)
  if (session.name === 'Cliente' || !session.name) {
    for (const m of userMsgs) {
      if (!isGreetingOnly(m.content) && !extractPhoneFromText(m.content)) {
        session.name = m.content.trim().split('\n')[0].replace(/[!.,]/g, '');
        session.extractedLead.nome = session.name;
        break;
      }
    }
  }

  const hasValidPhone = isValidPhoneNumber(session.phone);
  const displayPhone = hasValidPhone ? formatPhoneForDisplay(session.phone) : '';

  // 1. Initial Greeting if user just said hello
  if (userMsgs.length === 1 && isGreetingOnly(lastUserMsg)) {
    return (
      `Olá! Seja muito bem-vindo(a) à *${companyName}*. 🏡\n\n` +
      `Sou o assistente comercial virtual. Vou fazer algumas perguntas rápidas para entender o que você procura e conectá-lo(a) ao corretor ideal.\n\n` +
      `Para começarmos, qual é o seu *nome completo*?`
    );
  }

  // 2. Name just provided, ask / confirm phone
  if (session.name !== 'Cliente' && !session.extractedLead.tipoAtendimento) {
    if (hasValidPhone && !session.extractedLead.telefone) {
      session.extractedLead.telefone = displayPhone;
      return (
        `Muito prazer em falar com você, *${session.name}*! 😊\n\n` +
        `Identifiquei seu número de WhatsApp como *${displayPhone}*.\n\n` +
        `Este é o melhor telefone para o corretor falar com você ou você prefere informar outro número?`
      );
    }

    // If phone was not pre-detected and not yet given
    if (!hasValidPhone) {
      return (
        `Muito prazer em falar com você, *${session.name}*! 😊\n\n` +
        `Qual é o seu *número de WhatsApp com DDD* para o corretor entrar em contato com você?`
      );
    }
  }

  // Detect service type in conversation
  const fullUserText = userMsgs.map((m) => m.content).join(' ');
  if (!session.extractedLead.tipoAtendimento) {
    if (/\bcompr(ar|a|o)?\b/i.test(fullUserText)) session.extractedLead.tipoAtendimento = 'Comprar';
    else if (/\balug(ar|uel|o)?\b/i.test(fullUserText)) session.extractedLead.tipoAtendimento = 'Alugar';
    else if (/\bvend(er|a|o)?\b/i.test(fullUserText)) session.extractedLead.tipoAtendimento = 'Vender';
    else if (/d[uú]vida/i.test(fullUserText)) session.extractedLead.tipoAtendimento = 'Tirar Dúvidas';
  }

  // 3. Ask Service Type
  if (!session.extractedLead.tipoAtendimento) {
    return `Excelente! Qual tipo de atendimento você procura hoje: *Comprar*, *Alugar*, *Vender* um imóvel ou *Tirar dúvidas*?`;
  }

  // 4. Ask Property Details
  if (!session.extractedLead.produtoImovel) {
    // If last message has property hints (e.g. 2 quartos, casa, apto)
    if (/(quarto|casa|apto|apartamento|cobertura|sala|terreno|lote|imovel)/i.test(lastUserMsg)) {
      session.extractedLead.produtoImovel = lastUserMsg;
    } else {
      return `Excelente! Que tipo de imóvel você tem em mente? (Por exemplo: apartamento de 2 ou 3 quartos, casa em condomínio, sala comercial, bairro de preferência...)`;
    }
  }

  // 5. Ask Observations
  if (!session.extractedLead.observacoes) {
    return `Perfeito! Há alguma observação adicional importante (como vaga de garagem, faixa de valor ou urgência)? Se não houver, pode me dizer apenas "sem observações".`;
  }

  // 6. Confirmation & Summary
  const finalNome = session.extractedLead.nome || session.name || 'Cliente';
  const finalPhone = session.extractedLead.telefone || displayPhone || 'A definir';
  const finalTipo = session.extractedLead.tipoAtendimento || 'Comprar';
  const finalImovel = session.extractedLead.produtoImovel || 'Imóvel residencial';
  const finalObs = session.extractedLead.observacoes || (session.initialMessage ? `Origem: ${session.initialMessage}` : 'Nenhuma');

  return (
    `Muito obrigado pela confirmação! 👍\n\n` +
    `Estou gerando a sua ficha de atendimento para o corretor especialista da ${companyName}.\n\n` +
    `NOVO LEAD\n` +
    `Nome: ${finalNome}\n` +
    `Telefone: ${finalPhone}\n` +
    `Tipo de atendimento: ${finalTipo}\n` +
    `Produto ou imóvel: ${finalImovel}\n` +
    `Observações: ${finalObs}\n` +
    `Consentimento para contato: Sim, autorizado conforme LGPD\n` +
    `Origem: WhatsApp Web Direct Houses\n` +
    `Status: Aguardando contato do corretor`
  );
}

// Structured lead extractor
function extractLeadFromSession(session: WhatsAppChatSession) {
  const fullText = session.messages.map((m) => m.content).join('\n');
  const userText = session.messages
    .filter((m) => m.role === 'user')
    .map((m) => m.content)
    .join(' ');

  // Extract any phone number mentioned in chat
  for (const m of session.messages.filter((msg) => msg.role === 'user')) {
    const detected = extractPhoneFromText(m.content);
    if (detected && isValidPhoneNumber(detected)) {
      session.phone = detected;
    }
  }

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
  const blockTelefone = getField('Telefone');
  const blockTipo = getField('Tipo de atendimento');
  const blockProduto = getField('Produto ou imóvel');
  const blockObs = getField('Observações');

  let tipo = blockTipo;
  if (!tipo) {
    if (/\bcompr(ar|a|o)?\b/i.test(userText)) tipo = 'Comprar';
    else if (/\balug(ar|uel|o)?\b/i.test(userText)) tipo = 'Alugar';
    else if (/\bvend(er|a|o)?\b/i.test(userText)) tipo = 'Vender';
    else if (/d[uú]vida/i.test(userText)) tipo = 'Tirar Dúvidas';
  }

  const humanRequested = /(atendente\s*humano|falar\s*com\s*(um\s*)?humano|falar\s*com\s*(uma\s*)?pessoa|corretor)/i.test(
    userText
  );
  const isFinished = hasNovoLead || humanRequested;

  // Clean and format telephone
  let finalPhone = blockTelefone;
  if (finalPhone && extractPhoneFromText(finalPhone)) {
    finalPhone = formatPhoneForDisplay(extractPhoneFromText(finalPhone)!);
  } else if (isValidPhoneNumber(session.phone)) {
    finalPhone = formatPhoneForDisplay(session.phone);
  } else {
    finalPhone = 'Não informado';
  }

  // Clean Name so greetings are never names
  let finalName = blockNome || session.name || '';
  if (isGreetingOnly(finalName) || !finalName || finalName === 'Cliente') {
    // Search user messages for a valid name
    for (const msg of session.messages.filter((m) => m.role === 'user')) {
      if (!isGreetingOnly(msg.content) && !extractPhoneFromText(msg.content)) {
        finalName = msg.content.trim().split('\n')[0].replace(/[!.,]/g, '');
        break;
      }
    }
  }
  if (!finalName) finalName = 'Cliente WhatsApp';

  // Build observations including initial message if any
  let obs = blockObs || (humanRequested ? 'Cliente solicitou falar com corretor.' : '');
  if (session.initialMessage && !obs.includes(session.initialMessage) && session.initialMessage !== finalName) {
    obs = obs ? `${obs} | Mensagem inicial: "${session.initialMessage}"` : `Mensagem inicial: "${session.initialMessage}"`;
  }
  if (!obs) obs = 'Nenhuma';

  session.extractedLead = {
    nome: finalName,
    telefone: finalPhone,
    tipoAtendimento: tipo || 'Comprar',
    produtoImovel: blockProduto || 'A combinar com corretor',
    observacoes: obs,
    initialMessage: session.initialMessage,
    consentimento: 'Sim, autorizado conforme LGPD',
    origem: 'WhatsApp Web Direct Houses',
    status: isFinished ? 'Qualificado - Aguardando corretor' : 'Em atendimento inicial',
    isComplete: isFinished,
    humanRequested,
    finalStructuredText:
      finalStructuredText ||
      (isFinished
        ? `NOVO LEAD\nNome: ${finalName}\nTelefone: ${finalPhone}\nTipo de atendimento: ${
            tipo || 'Comprar'
          }\nProduto ou imóvel: ${blockProduto || 'A combinar com corretor'}\nObservações: ${obs}\nConsentimento para contato: Sim, autorizado conforme LGPD\nOrigem: WhatsApp Web Direct Houses\nStatus: Aguardando contato do corretor`
        : ''),
  };

  if (isFinished && session.status === 'active') {
    session.status = 'qualified';
  }

  // Persist lead to .data/leads.json
  if (isFinished || session.messages.length >= 2 || session.phone) {
    recordLead({
      id: `lead-${session.jid.replace(/[^a-zA-Z0-9]/g, '')}`,
      nome: finalName,
      telefone: finalPhone,
      tipoAtendimento: tipo || 'Comprar',
      produtoImovel: blockProduto || 'A combinar',
      observacoes: obs,
      initialMessage: session.initialMessage,
      origem: 'WhatsApp Web Direct Houses',
      status: isFinished
        ? session.assignedBroker
          ? 'Direcionado na Roleta'
          : 'Qualificado'
        : 'Em Atendimento',
      assignedBroker: session.assignedBroker,
      rawStructuredText: finalStructuredText,
    });
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
      phone: isValidPhoneNumber(senderPhone) ? senderPhone : '',
      name: senderName && senderName !== 'Cliente' ? senderName : 'Cliente',
      initialMessage: messageText,
      messages: [],
      extractedLead: {
        nome: senderName && senderName !== 'Cliente' ? senderName : 'Cliente',
        telefone: isValidPhoneNumber(senderPhone) ? formatPhoneForDisplay(senderPhone) : '',
        tipoAtendimento: '',
        produtoImovel: '',
        observacoes: '',
        initialMessage: messageText,
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

  // If first message of session wasn't set, set it
  if (!session.initialMessage) {
    session.initialMessage = messageText;
  }

  // Check if this message contains a phone number
  const detectedPhone = extractPhoneFromText(messageText);
  if (detectedPhone && isValidPhoneNumber(detectedPhone)) {
    session.phone = detectedPhone;
    session.extractedLead.telefone = formatPhoneForDisplay(detectedPhone);
  }

  // Record user message
  session.messages.push({
    id: `msg-${Date.now()}-user`,
    role: 'user',
    content: messageText,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  });
  session.lastActivity = new Date().toISOString();

  // Generate AI reply with candidate models fallback
  let replyText = '';
  const aiClient = getGeminiClient();

  if (aiClient) {
    const systemInstruction = buildSystemPrompt(companyName, session.phone, session.initialMessage);
    const contents = session.messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    for (const model of CANDIDATE_MODELS) {
      try {
        const response = await aiClient.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction,
            temperature: 0.3,
            topP: 0.85,
          },
        });
        if (response && response.text) {
          replyText = response.text.trim();
          break;
        }
      } catch (err) {
        console.warn(`Tentativa com modelo ${model} falhou no WhatsApp AI:`, err);
      }
    }
  }

  if (!replyText) {
    replyText = getFallbackReply(session, companyName);
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
    
    // Update persistent lead
    recordLead({
      id: `lead-${session.jid.replace(/[^a-zA-Z0-9]/g, '')}`,
      nome: session.extractedLead.nome,
      telefone: session.extractedLead.telefone || session.phone,
      tipoAtendimento: session.extractedLead.tipoAtendimento,
      produtoImovel: session.extractedLead.produtoImovel,
      observacoes: session.extractedLead.observacoes,
      initialMessage: session.initialMessage,
      origem: 'WhatsApp Web Direct Houses',
      status: 'Direcionado na Roleta',
      assignedBroker: session.assignedBroker,
      rawStructuredText: session.extractedLead.finalStructuredText,
    });

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

    // Update persistent lead
    recordLead({
      id: `lead-${session.jid.replace(/[^a-zA-Z0-9]/g, '')}`,
      nome: session.extractedLead.nome,
      telefone: session.extractedLead.telefone || session.phone,
      tipoAtendimento: session.extractedLead.tipoAtendimento,
      produtoImovel: session.extractedLead.produtoImovel,
      observacoes: session.extractedLead.observacoes,
      initialMessage: session.initialMessage,
      origem: 'WhatsApp Web Direct Houses',
      status: 'Direcionado na Roleta',
      assignedBroker: session.assignedBroker,
      rawStructuredText: session.extractedLead.finalStructuredText,
    });

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

/**
 * Inactivity Monitor: Automatically dispatches active sessions that stopped responding for 5 minutes
 */
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

async function checkInactiveSessions() {
  const now = Date.now();
  const companyName = process.env.COMPANY_NAME || 'Direct Houses';
  const roletaConfig = getRoletaConfig();

  if (!roletaConfig.autoDispatchEnabled) return;

  for (const session of sessions.values()) {
    if (session.status === 'active' && session.messages.length > 0) {
      const lastActivityTime = new Date(session.lastActivity).getTime();
      if (now - lastActivityTime >= INACTIVITY_TIMEOUT_MS) {
        console.log(
          `⏱️ [Inatividade] Sessão de ${session.name} (${session.phone}) inativa há mais de 5 min. Despachando na Roleta para não perder o lead...`
        );

        extractLeadFromSession(session);
        const chosenBroker = getNextBrokerInRoleta();

        if (chosenBroker) {
          const brokerMsg = formatBrokerLeadMessage(
            {
              nome: session.extractedLead.nome || session.name || 'Cliente WhatsApp',
              telefone: session.extractedLead.telefone || session.phone,
              tipoAtendimento: session.extractedLead.tipoAtendimento || 'Interesse Comercial Inicial',
              produtoImovel: session.extractedLead.produtoImovel || 'A combinar com corretor',
              observacoes: 'Cliente iniciou contato no WhatsApp mas parou de responder às perguntas da IA.',
              isTimeoutRecovery: true,
              initialMessage: session.messages[0]?.content || '',
            },
            companyName,
            session.phone
          );

          await whatsAppService.sendTextMessage(chosenBroker.phone, brokerMsg);

          session.status = 'dispatched';
          session.assignedBroker = {
            id: chosenBroker.id,
            name: chosenBroker.name,
            phone: chosenBroker.phone,
            assignedAt: new Date().toISOString(),
          };

          // Update persistent lead
          recordLead({
            id: `lead-${session.jid.replace(/[^a-zA-Z0-9]/g, '')}`,
            nome: session.extractedLead.nome || session.name || 'Cliente WhatsApp',
            telefone: session.extractedLead.telefone || session.phone,
            tipoAtendimento: session.extractedLead.tipoAtendimento || 'Interesse Comercial Inicial',
            produtoImovel: session.extractedLead.produtoImovel || 'A combinar com corretor',
            observacoes: 'Cliente parou de responder após 5 minutos. Lead recuperado e direcionado na roleta.',
            initialMessage: session.initialMessage || session.messages[0]?.content || '',
            origem: 'WhatsApp Web Direct Houses',
            status: 'Recuperado por Inatividade',
            assignedBroker: session.assignedBroker,
          });

          console.log(`✅ [Inatividade] Lead recuperado e enviado com sucesso para ${chosenBroker.name} (${chosenBroker.phone})`);
        }
      }
    }
  }
}

// Check every 30 seconds
setInterval(checkInactiveSessions, 30000);

// Hook message listener into WhatsApp service
whatsAppService.onMessage(handleIncomingWhatsAppMessage);

