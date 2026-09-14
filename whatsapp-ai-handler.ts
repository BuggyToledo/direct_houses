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
import {
  formatLancamentosForPrompt,
  getActiveLancamentos,
} from './lancamentos-service';

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

function buildSystemPrompt(session: WhatsAppChatSession, companyName: string = 'Direct Houses') {
  const hasValidPhone = isValidPhoneNumber(session.phone);
  const displayPhone = hasValidPhone ? formatPhoneForDisplay(session.phone) : '';
  const lancamentosText = formatLancamentosForPrompt();
  const userMsgs = session.messages.filter((m) => m.role === 'user');

  const hasName = Boolean(session.name && session.name !== 'Cliente' && !isGreetingOnly(session.name));
  const hasPhone = Boolean(hasValidPhone && userMsgs.length >= 2);
  const hasTipo = Boolean(session.extractedLead.tipoAtendimento);
  const hasProduto = Boolean(
    session.extractedLead.produtoImovel &&
      session.extractedLead.produtoImovel !== 'A combinar com corretor' &&
      session.extractedLead.produtoImovel !== 'Não informado'
  );
  const hasObs = Boolean(session.extractedLead.observacoes && userMsgs.length >= 4);

  let currentStepDirective = '';

  if (!hasName) {
    currentStepDirective = `👉 ETAPA ATUAL: ETAPA 1 (NOME DO CLIENTE)
- O cliente ainda não informou o nome.
- Ação: Cumprimente cordialmente e pergunte o *nome completo*. Faça SOMENTE esta pergunta.`;
  } else if (!hasPhone) {
    currentStepDirective = `👉 ETAPA ATUAL: ETAPA 2 (TELEFONE DO CLIENTE)
- O cliente se chama "${session.name}".
- Ação: ${
      hasValidPhone
        ? `Agradeça e confirme o número: "Muito prazer, ${session.name}! Identifiquei seu WhatsApp como ${displayPhone}. Este é o melhor telefone para contato ou prefere informar outro?"`
        : `Agradeça e pergunte o número: "Muito prazer, ${session.name}! Qual é o seu número de WhatsApp com DDD para o corretor entrar em contato com você?"`
    }
- Faça SOMENTE esta pergunta.`;
  } else if (!hasTipo) {
    currentStepDirective = `👉 ETAPA ATUAL: ETAPA 3 (TIPO DE ATENDIMENTO) - ⚠️ NÃO FINALIZE!
- O cliente já confirmou o telefone.
- Ação: Pergunte IMEDIATAMENTE qual tipo de atendimento ele busca:
  "Perfeito, ${session.name}! Como podemos te ajudar hoje?
  1️⃣ *Lançamentos (na planta / em construção)*
  2️⃣ *Comprar imóvel pronto*
  3️⃣ *Alugar*
  4️⃣ *Vender um imóvel*
  5️⃣ *Tirar dúvidas*"
⛔ PROIBIDO encerrar o atendimento agora! Faça apenas a pergunta das opções acima.`;
  } else if (!hasProduto) {
    currentStepDirective = `👉 ETAPA ATUAL: ETAPA 4 (DETALHES DO IMÓVEL OU ESCOLHA DO LANÇAMENTO)
- O cliente escolheu: "${session.extractedLead.tipoAtendimento}".
- Ação:
  * Se o cliente escolheu LANÇAMENTOS: Apresente os lançamentos disponíveis no catálogo acima e pergunte qual deles ele mais gostou ou que tipologia busca.
  * Se o cliente escolheu COMPRAR ou ALUGAR: Pergunte qual o tipo de imóvel (apartamento, casa, cobertura), quantos quartos e o bairro de preferência.
  * Se o cliente escolheu VENDER: Pergunte o tipo de imóvel e localização.
⛔ PROIBIDO encerrar o atendimento agora!`;
  } else if (!hasObs) {
    currentStepDirective = `👉 ETAPA ATUAL: ETAPA 5 (OBSERVAÇÕES E FAIXA DE VALOR)
- O cliente tem interesse em: "${session.extractedLead.produtoImovel}".
- Ação: Pergunte se há alguma preferência importante (como vaga de garagem, varanda, faixa de valor/investimento ou urgência para fechar).`;
  } else {
    currentStepDirective = `👉 ETAPA ATUAL: ETAPA 6 (FINALIZAÇÃO E ENCAMINHAMENTO)
- Todas as informações foram coletadas com sucesso!
- Ação: Agradeça ao cliente com entusiasmo e simpatia, e informe que o corretor especialista da ${companyName} entrará em contato em instantes para apresentar todas as informações.`;
  }

  return `Você é o assistente comercial virtual oficial da imobiliária ${companyName}.
Você está conversando DIRETAMENTE no WhatsApp com um cliente em tempo real.
Seu objetivo é conduzir um atendimento ágil, simpático e de alta conversão, avançando uma etapa por vez.

${session.initialMessage ? `[MENSAGEM INICIAL DO CLIENTE / LINK]: "${session.initialMessage}"` : ''}
[DADOS JÁ COLETADOS]:
- Nome: ${hasName ? session.name : 'Pendente'}
- Telefone: ${hasValidPhone ? displayPhone : 'Pendente'}
- Tipo de Atendimento: ${session.extractedLead.tipoAtendimento || 'Pendente'}
- Produto / Imóvel: ${session.extractedLead.produtoImovel || 'Pendente'}
- Observações: ${session.extractedLead.observacoes || 'Pendente'}

[CATÁLOGO DE LANÇAMENTOS IMOBILIÁRIOS ATIVOS]:
${lancamentosText}

============================================================
DIRETRIZ DA SUA PRÓXIMA RESPOSTA (SIGA OBRIGATORIAMENTE):
============================================================
${currentStepDirective}

REGRAS:
1. Responda em português brasileiro com simpatia e agilidade.
2. Faça UMA ÚNICA pergunta por vez.
3. NUNCA gere mensagens de encerramento se ainda estiver nas Etapas 1 a 5.`;
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

  // Check for explicit human broker request
  const isHumanReq =
    lowerLastMsg.includes('humano') ||
    lowerLastMsg.includes('falar com pessoa') ||
    lowerLastMsg.includes('falar com atendente') ||
    lowerLastMsg.includes('passar para corretor') ||
    lowerLastMsg.includes('quero um corretor');

  if (isHumanReq) {
    const verifiedPhone = formatPhoneForDisplay(session.phone) || 'A definir';
    return `Perfeito! Estou transferindo seu atendimento agora mesmo para um de nossos corretores especialistas da ${companyName}. Em instantes ele te chamará aqui no WhatsApp!`;
  }

  // Extract phone number from all user messages
  for (const m of userMsgs) {
    const detectedPhone = extractPhoneFromText(m.content);
    if (detectedPhone && isValidPhoneNumber(detectedPhone)) {
      session.phone = detectedPhone;
      session.extractedLead.telefone = formatPhoneForDisplay(detectedPhone);
    }
  }

  // Extract name if available
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

  // 1. Initial Greeting
  if (userMsgs.length === 1 && isGreetingOnly(lastUserMsg)) {
    return (
      `Olá! Seja muito bem-vindo(a) à *${companyName}*. 🏡\n\n` +
      `Sou o assistente virtual da Direct Houses. Vou fazer algumas perguntas rápidas para entender o seu objetivo e direcionar ao corretor ideal.\n\n` +
      `Para começarmos, qual é o seu *nome completo*?`
    );
  }

  // 2. Ask / Confirm Phone if not yet addressed
  const phoneDiscussed =
    userMsgs.length >= 2 &&
    (extractPhoneFromText(lastUserMsg) ||
      /\b(sim|este|esse|correto|pode ser|isso)\b/i.test(lastUserMsg) ||
      hasValidPhone);

  if (session.name !== 'Cliente' && !phoneDiscussed && !hasValidPhone) {
    return (
      `Muito prazer em falar com você, *${session.name}*! 😊\n\n` +
      `Qual é o seu *número de WhatsApp com DDD* para o corretor entrar em contato com você?`
    );
  }

  // Detect service type in conversation
  const fullUserText = userMsgs.map((m) => m.content).join(' ');
  if (!session.extractedLead.tipoAtendimento) {
    if (/\blan[çc]amento(s)?\b|na planta|em constru[çc][ãa]o|\b1\b/i.test(fullUserText)) session.extractedLead.tipoAtendimento = 'Lançamento na Planta';
    else if (/\bcompr(ar|a|o)?\b|\b2\b/i.test(fullUserText)) session.extractedLead.tipoAtendimento = 'Comprar Imóvel Pronto';
    else if (/\balug(ar|uel|o)?\b|\b3\b/i.test(fullUserText)) session.extractedLead.tipoAtendimento = 'Alugar';
    else if (/\bvend(er|a|o)?\b|\b4\b/i.test(fullUserText)) session.extractedLead.tipoAtendimento = 'Vender';
    else if (/d[uú]vida|\b5\b/i.test(fullUserText)) session.extractedLead.tipoAtendimento = 'Tirar Dúvidas';
  }

  // 3. Ask Service Type
  if (!session.extractedLead.tipoAtendimento) {
    return (
      `Excelente! Como podemos te ajudar hoje?\n\n` +
      `1️⃣ *Lançamentos (na planta / em construção)*\n` +
      `2️⃣ *Comprar imóvel pronto*\n` +
      `3️⃣ *Alugar*\n` +
      `4️⃣ *Vender um imóvel*\n` +
      `5️⃣ *Tirar dúvidas*`
    );
  }

  // 4. Ask Property Details or show Lançamentos
  if (!session.extractedLead.produtoImovel) {
    if (session.extractedLead.tipoAtendimento.includes('Lançamento')) {
      const activeLanc = getActiveLancamentos();
      if (activeLanc.length > 0) {
        const matched = activeLanc.find((l) => lowerLastMsg.includes(l.nome.toLowerCase()));
        if (matched) {
          session.extractedLead.produtoImovel = `Lançamento ${matched.nome} (${matched.tipologias})`;
        } else {
          return (
            `Temos excelentes opções de *Lançamentos na planta* disponíveis:\n\n` +
            activeLanc
              .map(
                (l, i) =>
                  `🏢 *${i + 1}. ${l.nome}* (${l.bairro})\n• Tipologias: ${l.tipologias}\n• Preço: ${l.precoAPartirDe || 'Sob consulta'}${
                    l.linkBookPdf ? `\n• Book: ${l.linkBookPdf}` : ''
                  }`
              )
              .join('\n\n') +
            `\n\nQual desses empreendimentos mais combina com o que você procura?`
          );
        }
      }
    }

    if (/(quarto|casa|apto|apartamento|cobertura|sala|terreno|lote|imovel|reserva|iconic|1|2|3|4)/i.test(lastUserMsg) && lastUserMsg.length > 2) {
      session.extractedLead.produtoImovel = lastUserMsg;
    } else {
      return `Excelente! Que tipo de imóvel você tem em mente? (Por exemplo: apartamento de 2 ou 3 quartos, casa em condomínio, ou bairro de preferência...)`;
    }
  }

  // 5. Ask Observations & Budget
  if (!session.extractedLead.observacoes) {
    if (userMsgs.length >= 4) {
      session.extractedLead.observacoes = lastUserMsg !== session.extractedLead.produtoImovel ? lastUserMsg : 'Sem observações adicionais.';
    } else {
      return `Perfeito! Há alguma preferência importante (como vaga de garagem, faixa de valor/investimento ou urgência)? Se não houver, pode me dizer apenas "sem observações".`;
    }
  }

  // 6. Final Closing message
  const finalNome = session.extractedLead.nome || session.name || 'Cliente';
  return (
    `Muito obrigado pelas informações, *${finalNome}*! 👍\n\n` +
    `Já registrei seu interesse e estou conectando você agora ao nosso corretor especialista da ${companyName}. Em instantes ele entrará em contato com você aqui no WhatsApp com todos os detalhes!`
  );
}

// Structured lead extractor based on conversation state
function extractLeadFromSession(session: WhatsAppChatSession) {
  const userMessages = session.messages.filter((m) => m.role === 'user');
  const userText = userMessages.map((m) => m.content).join(' ');

  // 1. Extract phone number from all user messages
  for (const m of userMessages) {
    const detected = extractPhoneFromText(m.content);
    if (detected && isValidPhoneNumber(detected)) {
      session.phone = detected;
    }
  }

  // 2. Extract name from first non-greeting message
  if (session.name === 'Cliente' || !session.name || isGreetingOnly(session.name)) {
    for (const msg of userMessages) {
      if (!isGreetingOnly(msg.content) && !extractPhoneFromText(msg.content)) {
        session.name = msg.content.trim().split('\n')[0].replace(/[!.,]/g, '');
        break;
      }
    }
  }
  if (!session.name || isGreetingOnly(session.name)) session.name = 'Cliente';

  // 3. Detect Tipo de Atendimento
  let tipo = session.extractedLead.tipoAtendimento || '';
  if (!tipo) {
    if (/\blan[çc]amento(s)?\b|na planta|em constru[çc][ãa]o|\b1\b/i.test(userText)) tipo = 'Lançamento na Planta';
    else if (/\bcompr(ar|a|o)?\b|\b2\b/i.test(userText)) tipo = 'Comprar Imóvel Pronto';
    else if (/\balug(ar|uel|o)?\b|\b3\b/i.test(userText)) tipo = 'Alugar';
    else if (/\bvend(er|a|o)?\b|\b4\b/i.test(userText)) tipo = 'Vender';
    else if (/d[uú]vida|\b5\b/i.test(userText)) tipo = 'Tirar Dúvidas';
  }

  // 4. Detect Produto / Imóvel
  let produto = session.extractedLead.produtoImovel || '';
  if (!produto && tipo) {
    const activeLanc = getActiveLancamentos();
    for (const l of activeLanc) {
      if (userText.toLowerCase().includes(l.nome.toLowerCase())) {
        produto = `Lançamento ${l.nome} (${l.tipologias})`;
        break;
      }
    }
    if (!produto) {
      for (let i = 1; i < userMessages.length; i++) {
        const txt = userMessages[i].content;
        if (
          /(quarto|casa|apto|apartamento|cobertura|sala|terreno|lote|reserva|iconic|bairro|barra|recreio)/i.test(txt) &&
          txt.length > 2 &&
          !extractPhoneFromText(txt)
        ) {
          produto = txt;
          break;
        }
      }
    }
  }

  // 5. Detect Observações
  let obs = session.extractedLead.observacoes || '';
  if (!obs && userMessages.length >= 4) {
    const lastMsg = userMessages[userMessages.length - 1].content;
    if (lastMsg !== produto && !extractPhoneFromText(lastMsg) && !isGreetingOnly(lastMsg)) {
      obs = lastMsg;
    }
  }

  // Strict check for explicit human broker request
  const humanRequested = /(falar\s*com\s*(um\s*)?(humano|corretor|pessoa|atendente)|passa(r)?\s*p(ra|ro)\s*(um\s*)?(humano|corretor|pessoa)|quero\s*(um\s*)?(humano|atendente)|chama(r)?\s*(um\s*)?corretor)/i.test(
    userText
  );

  const hasValidPhone = isValidPhoneNumber(session.phone);
  const displayPhone = hasValidPhone ? formatPhoneForDisplay(session.phone) : 'Não informado';

  // Lead is complete ONLY when all stages are completed or human was explicitly requested
  const isFullyQualified = Boolean(
    humanRequested ||
      (userMessages.length >= 4 &&
        session.name !== 'Cliente' &&
        hasValidPhone &&
        tipo &&
        produto &&
        produto !== 'A combinar com corretor')
  );

  session.extractedLead = {
    nome: session.name !== 'Cliente' ? session.name : 'Cliente WhatsApp',
    telefone: displayPhone,
    tipoAtendimento: tipo || session.extractedLead.tipoAtendimento || '',
    produtoImovel: produto || session.extractedLead.produtoImovel || '',
    observacoes: obs || session.extractedLead.observacoes || (session.initialMessage ? `Origem: "${session.initialMessage}"` : 'Nenhuma'),
    initialMessage: session.initialMessage,
    consentimento: 'Sim, autorizado conforme LGPD',
    origem: 'WhatsApp Web Direct Houses',
    status: isFullyQualified ? 'Qualificado - Aguardando corretor' : 'Em atendimento inicial',
    isComplete: isFullyQualified,
    humanRequested,
    finalStructuredText: `NOVO LEAD\nNome: ${session.name}\nTelefone: ${displayPhone}\nTipo de atendimento: ${tipo || 'Comprar'}\nProduto ou imóvel: ${produto || 'A combinar com corretor'}\nObservações: ${obs || 'Nenhuma'}\nConsentimento para contato: Sim, autorizado conforme LGPD\nOrigem: WhatsApp Web Direct Houses\nStatus: Aguardando contato do corretor`,
  };

  if (isFullyQualified && session.status === 'active') {
    session.status = 'qualified';
  }

  // Persist lead to .data/leads.json
  if (isFullyQualified || userMessages.length >= 2 || hasValidPhone) {
    recordLead({
      id: `lead-${session.jid.replace(/[^a-zA-Z0-9]/g, '')}`,
      nome: session.extractedLead.nome,
      telefone: session.extractedLead.telefone,
      tipoAtendimento: session.extractedLead.tipoAtendimento || 'Interesse Inicial',
      produtoImovel: session.extractedLead.produtoImovel || 'A combinar',
      observacoes: session.extractedLead.observacoes,
      initialMessage: session.initialMessage,
      origem: 'WhatsApp Web Direct Houses',
      status: isFullyQualified
        ? session.assignedBroker
          ? 'Direcionado na Roleta'
          : 'Qualificado'
        : 'Em Atendimento',
      assignedBroker: session.assignedBroker,
      rawStructuredText: session.extractedLead.finalStructuredText,
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

  // Record user message
  session.messages.push({
    id: `msg-${Date.now()}-user`,
    role: 'user',
    content: messageText,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  });
  session.lastActivity = new Date().toISOString();

  // Extract structured lead data before generating response so state is updated
  extractLeadFromSession(session);

  // Generate AI reply with candidate models fallback
  let replyText = '';
  const aiClient = getGeminiClient();

  if (aiClient) {
    const systemInstruction = buildSystemPrompt(session, companyName);
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

  // Anti-skip Safety Check: If AI generated premature closing before lead is fully qualified
  const userMessages = session.messages.filter((m) => m.role === 'user');
  const userText = userMessages.map((m) => m.content).join(' ');
  const isExplicitHuman = /(falar\s*com\s*(um\s*)?(humano|corretor|pessoa|atendente)|passa(r)?\s*p(ra|ro)\s*(um\s*)?(humano|corretor|pessoa)|quero\s*(um\s*)?(humano|atendente)|chama(r)?\s*(um\s*)?corretor)/i.test(userText);

  if (!session.extractedLead.isComplete && !isExplicitHuman && userMessages.length < 4 && /encaminhando|conectando|transferindo|NOVO LEAD/i.test(replyText)) {
    console.warn('⚠️ [WhatsApp AI] Resposta tentou finalizar antes da hora. Reorientando para a próxima pergunta de qualificação...');
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

  // Re-extract structured lead data
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

