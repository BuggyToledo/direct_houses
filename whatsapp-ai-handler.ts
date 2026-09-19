import fs from 'fs';
import path from 'path';
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
import { recordLead, addLeadDistribution } from './leads-service';
import { recordDistributionLog } from './roleta-history-service';
import {
  formatLancamentosForPrompt,
  getActiveLancamentos,
  getPublicLancamentosForAI,
  sanitizeAndAuditAIResponse,
  Lancamento,
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
    selectedLancamentoId?: string;
    selectedLancamentoNome?: string;
    phoneConfirmed?: boolean;
    trilhaNavegacao: string[];
    resumoNavegacao?: string;
    historicoMensagens?: Array<{ role: string; content: string; timestamp: string }>;
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

// Sessions store (memory + disk under .data)
const sessions = new Map<string, WhatsAppChatSession>();
const DATA_DIR = path.join(process.cwd(), '.data');
const SESSIONS_FILE = path.join(DATA_DIR, 'whatsapp-sessions.json');
let sessionsSaveTimer: ReturnType<typeof setTimeout> | null = null;

function ensureSessionsDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadSessionsFromDisk() {
  try {
    ensureSessionsDataDir();
    if (!fs.existsSync(SESSIONS_FILE)) return;
    const raw = fs.readFileSync(SESSIONS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return;
    const entries: Array<[string, WhatsAppChatSession]> = Array.isArray(parsed)
      ? parsed
      : Object.entries(parsed);
    let loaded = 0;
    for (const [jid, session] of entries) {
      if (jid && session && typeof session === 'object') {
        sessions.set(jid, session as WhatsAppChatSession);
        loaded++;
      }
    }
    console.log(`💾 [WhatsApp AI] ${loaded} sessão(ões) restaurada(s) do disco`);
  } catch (err) {
    console.warn('⚠️ [WhatsApp AI] Falha ao carregar sessões do disco:', err);
  }
}

function persistSessionsToDiskNow() {
  try {
    ensureSessionsDataDir();
    const obj: Record<string, WhatsAppChatSession> = {};
    for (const [jid, session] of sessions.entries()) {
      obj[jid] = session;
    }
    const tmp = `${SESSIONS_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), 'utf8');
    fs.renameSync(tmp, SESSIONS_FILE);
  } catch (err) {
    console.warn('⚠️ [WhatsApp AI] Falha ao salvar sessões no disco:', err);
  }
}

/** Debounced persist so we don't thrash disk on every message */
function scheduleSessionsPersist() {
  if (sessionsSaveTimer) clearTimeout(sessionsSaveTimer);
  sessionsSaveTimer = setTimeout(() => {
    sessionsSaveTimer = null;
    persistSessionsToDiskNow();
  }, 750);
}

loadSessionsFromDisk();

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

function isExplicitCloseRequest(msg: string): boolean {
  const t = (msg || '').toLowerCase().trim();
  // Só mensagem curta e clara — NÃO varre o histórico inteiro
  if (t === '1') return true;
  if (/^(aguard(o|ar)(\s+o?\s*contato)?|s[oó] isso|pode chamar(\s+o corretor)?|valeu|obrigad[oa])\.?$/i.test(t)) {
    return true;
  }
  // Pedido explícito de humano (frase completa, não palavra isolada)
  if (/(falar\s+com\s+(um\s+)?(corretor|atendente|humano)|passa\s+pro?\s+corretor|quero\s+(um\s+)?corretor|transferir\s+para\s+corretor)/i.test(t)) {
    return true;
  }
  return false;
}

function buildSystemPrompt(session: WhatsAppChatSession, companyName: string = 'Direct Houses') {
  const hasValidPhone = isValidPhoneNumber(session.phone);
  const displayPhone = hasValidPhone ? formatPhoneForDisplay(session.phone) : '';
  const lancamentosText = formatLancamentosForPrompt();
  const userMsgs = session.messages.filter((m) => m.role === 'user');
  const activeLancamentos = getActiveLancamentos();

  const hasName = Boolean(session.name && session.name !== 'Cliente' && !isGreetingOnly(session.name));
  const isPhoneSettled = Boolean(hasValidPhone && (session.extractedLead.phoneConfirmed || userMsgs.length >= 2));
  const hasTipo = Boolean(session.extractedLead.tipoAtendimento);
  const hasProduto = Boolean(
    session.extractedLead.produtoImovel &&
      session.extractedLead.produtoImovel !== 'A combinar com corretor' &&
      session.extractedLead.produtoImovel !== 'Não informado'
  );
  const isLancamentoFlow = session.extractedLead.tipoAtendimento?.toLowerCase().includes('lançamento');
  const selectedLanc = session.extractedLead.selectedLancamentoNome || session.extractedLead.produtoImovel;

  let currentStepDirective = '';

  if (!hasValidPhone && !hasName) {
    currentStepDirective = `👉 ETAPA ATUAL: ETAPA 1 (SAUDAÇÃO, NOME & TELEFONE)
- O número de WhatsApp do cliente NÃO foi detectado automaticamente e ainda não sabemos o nome dele.
- Ação: Cumprimente com simpatia e solicite o NOME COMPLETO e o NÚMERO DE WHATSAPP COM DDD:
  "Olá! Seja muito bem-vindo(a) à ${companyName}. 🏡
  Para começarmos o seu atendimento exclusivo, qual é o seu *nome completo* e o seu *número de WhatsApp com DDD*?"
- Faça SOMENTE esta pergunta inicial.
⛔ REGRA OBRIGATÓRIA: NUNCA avance para menus sem que o cliente informe o telefone com DDD!`;
  } else if (!hasValidPhone && hasName) {
    currentStepDirective = `👉 ETAPA ATUAL: ETAPA 1B (SOLICITAÇÃO DO TELEFONE COM DDD)
- O cliente se chama "${session.name}", mas AINDA NÃO temos o número de WhatsApp dele.
- Ação: Cumprimente pelo nome e solicite o NÚMERO DE WHATSAPP COM DDD:
  "Muito prazer em falar com você, ${session.name}! 😊
  Para que possamos te passar todos os detalhes, fotos e condições com nossos corretores, qual é o seu *número de WhatsApp com DDD*?"
- Faça SOMENTE esta solicitação.
⛔ REGRA OBRIGATÓRIA: NUNCA avance para o Menu Decisório nem encerre o atendimento sem obter o número de telefone!`;
  } else if (hasValidPhone && !hasName) {
    currentStepDirective = `👉 ETAPA ATUAL: ETAPA 1C (CONFIRMAÇÃO DO WHATSAPP IDENTIFICADO + NOME)
- O número de WhatsApp do cliente foi identificado automaticamente como "${displayPhone}".
- Ação: Cumprimente com simpatia, cite o WhatsApp já identificado e pergunte o *nome completo*:
  "Olá! Seja muito bem-vindo(a) à ${companyName}. 🏡
  Identifiquei seu WhatsApp como *${displayPhone}*.
  Para começarmos, qual é o seu *nome completo*?"
- Faça SOMENTE esta pergunta.`;
  } else if (hasValidPhone && !isPhoneSettled && userMsgs.length <= 2 && !hasTipo) {
    currentStepDirective = `👉 ETAPA ATUAL: ETAPA 2 (CONFIRMAÇÃO DO NÚMERO IDENTIFICADO)
- O cliente se chama "${session.name}" e o WhatsApp dele foi detectado automaticamente como "${displayPhone}".
- Ação: Confirme o número já identificado de forma rápida e cordial:
  "Muito prazer, ${session.name}! Identifiquei seu WhatsApp como *${displayPhone}*. Este é o seu melhor telefone para contato ou prefere informar outro?"
- Faça SOMENTE esta confirmação.`;
  } else if (!hasTipo) {
    const originImovelNotice = session.extractedLead.produtoImovel && session.extractedLead.produtoImovel !== 'A combinar com corretor' && session.extractedLead.produtoImovel !== 'Não informado'
      ? ` referente ao seu interesse no imóvel *${session.extractedLead.produtoImovel}*`
      : '';

    currentStepDirective = `👉 ETAPA ATUAL: ETAPA 3 (CONFIRMAÇÃO DE CAPTURA + MENU DECISÓRIO)
- O cliente já forneceu/confirmou o telefone (${displayPhone}). O LEAD ESTÁ CAPTURADO COM SUCESSO!
- Ação: Confirme o registro com simpatia e apresente o MENU DECISÓRIO DE PROSSEGUIMENTO:
  "Perfeito, ${session.name}! Já registrei seu contato com sucesso${originImovelNotice}. Nosso consultor especialista entrará em contato com você em instantes! 👍

Enquanto preparamos o seu atendimento, como prefere prosseguir?
1️⃣ *Aguardar contato do corretor* (Já é o suficiente, aguardo a mensagem)
2️⃣ *Conhecer nossos Lançamentos na Planta* (Fotos, plantas e valores no chat)
3️⃣ *Buscar Imóveis Prontos* (Comprar ou alugar)
4️⃣ *Tirar uma dúvida rápida agora*"

⛔ REGRA DE FECHAMENTO IMEDIATO:
- Se o cliente responder "1", "aguardo", "só isso", "pode chamar", "corretor", "obrigado", "valeu": Finalize o atendimento cordialmente informando que o corretor já está com o contato dele. NUNCA faça novas perguntas nem reinicie menus!`;
  } else if (isLancamentoFlow && !session.extractedLead.selectedLancamentoNome) {
    currentStepDirective = `👉 ETAPA ATUAL: ETAPA 4A (ESCOLHA DO LANÇAMENTO)
- O cliente quer ver Lançamentos na Planta.
- Ação: Apresente a lista numerada dos lançamentos ativos autorizados abaixo e pergunte qual deles ele gostaria de conhecer:
${activeLancamentos.map((l, i) => `  ${i + 1}️⃣ *${l.nome}* (${l.bairro}) - ${l.tipologias}`).join('\n')}
⛔ PROIBIDO encerrar o atendimento agora! Pergunte qual empreendimento ele deseja explorar.`;
  } else if (isLancamentoFlow && session.extractedLead.selectedLancamentoNome) {
    currentStepDirective = `👉 ETAPA ATUAL: ETAPA 4B (SUB-MENU INTERATIVO DO LANÇAMENTO "${selectedLanc}")
- O cliente está explorando o empreendimento: "${selectedLanc}".
- Você tem à sua disposição as informações autorizadas: Fotos, Descrição do projeto, Localidade/Referências, Vizinhança e Lazer, Valores e Condições.
- Ação:
  * Se o cliente fez uma pergunta específica (ex: pediu fotos, perguntou o preço, localização, lazer, etc.): Responda IMEDIATAMENTE com os dados autorizados do catálogo e ofereça para ver outro tópico ou falar com o corretor especialista.
  * Se o cliente acabou de escolher o empreendimento: Apresente um resumo rápido e o SUB-MENU INTERATIVO:
    "O *${selectedLanc}* é uma excelente oportunidade! 🏢✨
    O que você gostaria de conferir agora?
    1️⃣ 📸 *Fotos e Imagens*
    2️⃣ 📝 *Descrição e Conceito do Projeto*
    3️⃣ 📍 *Localização e Pontos de Referência*
    4️⃣ 🌳 *Vizinhança e Lazer do Condomínio*
    5️⃣ 💰 *Valores e Condições Comerciais*
    6️⃣ 💬 *Falar com um Corretor Especialista / Agendar Visita*"
⛔ PROIBIDO voltar para o menu principal de serviços ou repetir perguntas já respondidas!`;
  } else if (!hasProduto) {
    currentStepDirective = `👉 ETAPA ATUAL: ETAPA 4 (DETALHES DO IMÓVEL BUSCADO)
- O cliente escolheu: "${session.extractedLead.tipoAtendimento}".
- Ação: Pergunte qual o tipo de imóvel (apartamento, casa, cobertura), quantos quartos e o bairro de preferência.
⛔ PROIBIDO encerrar o atendimento agora!`;
  } else if (!session.extractedLead.observacoes || userMsgs.length < 4) {
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
Seu objetivo é qualificar o lead com simpatia, naturalidade e eficiência comercial, coletando as informações necessárias para que nossos corretores plantonistas façam o atendimento perfeito.

DIRETRIZES FUNDAMENTAIS:
1. Responda em Português do Brasil de forma acolhedora, concisa e profissional. Use emojis com elegância.
2. NUNCA faça mais de uma pergunta por mensagem. Mantenha as mensagens curtas e objetivas para leitura fácil no celular.
3. Se o cliente solicitar atendimento humano, finalize com educação imediatamente informando o contato do corretor.
4. Respeite estritamente a ETAPA ATUAL indicada abaixo.

${currentStepDirective}

BASE DE CONHECIMENTO DE LANÇAMENTOS AUTORIZADA:
${lancamentosText}

INFORMAÇÕES COLETADAS ATÉ AGORA:
- Nome: ${session.name}
- Telefone: ${displayPhone || 'Pendente de coleta'}
- Tipo de Atendimento: ${session.extractedLead.tipoAtendimento || 'Pendente'}
- Imóvel de Interesse: ${session.extractedLead.produtoImovel || 'Pendente'}`;
}

/**
 * Robust Dialog State Machine for fallback when AI is offline or processing simple steps
 */
function getFallbackReply(
  session: WhatsAppChatSession,
  companyName: string = 'Direct Houses'
): string {
  const userMsgs = session.messages.filter((m) => m.role === 'user');
  const lastUserMsg = userMsgs[userMsgs.length - 1]?.content.trim() || '';
  const lowerLastMsg = lastUserMsg.toLowerCase();
  const activeLanc = getActiveLancamentos();
  const hasValidPhone = isValidPhoneNumber(session.phone);

  // Check if user requested human broker
  const isHumanReq = isExplicitCloseRequest(lowerLastMsg) || lowerLastMsg === '6';

  if (isHumanReq) {
    session.extractedLead.humanRequested = true;
    const finalNome = session.name !== 'Cliente' ? session.name : 'Cliente';
    return `Perfeito, *${finalNome}*! Estou transferindo seu atendimento agora mesmo para um de nossos corretores especialistas da ${companyName}. Em instantes ele te chamará aqui no WhatsApp com todo o material! 👍`;
  }

  // Extract phone number from all user messages
  for (const m of userMsgs) {
    const detectedPhone = extractPhoneFromText(m.content);
    if (detectedPhone && isValidPhoneNumber(detectedPhone)) {
      session.phone = detectedPhone;
      session.extractedLead.telefone = formatPhoneForDisplay(detectedPhone);
      session.extractedLead.phoneConfirmed = true;
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

  const displayPhone = hasValidPhone ? formatPhoneForDisplay(session.phone) : '';

  // 1. Initial Greeting
  if (userMsgs.length === 1) {
    if (hasValidPhone) {
      if (session.name && session.name !== 'Cliente' && !isGreetingOnly(session.name)) {
        return (
          `Olá, *${session.name}*! Seja muito bem-vindo(a) à *${companyName}*. 🏡\n\n` +
          `Identifiquei seu número de WhatsApp como *${displayPhone}*. Este é o seu melhor telefone para contato ou prefere informar outro?`
        );
      } else {
        return (
          `Olá! Seja muito bem-vindo(a) à *${companyName}*. 🏡\n\n` +
          `Identifiquei seu WhatsApp como *${displayPhone}*.\n` +
          `Para começarmos nosso atendimento, qual é o seu *nome completo*?`
        );
      }
    } else {
      if (session.name && session.name !== 'Cliente' && !isGreetingOnly(session.name)) {
        return (
          `Olá, *${session.name}*! Seja muito bem-vindo(a) à *${companyName}*. 🏡\n\n` +
          `Para podermos te atender e encaminhar fotos e detalhes dos imóveis, qual é o seu *número de WhatsApp com DDD*?`
        );
      } else {
        return (
          `Olá! Seja muito bem-vindo(a) à *${companyName}*. 🏡\n\n` +
          `Para começarmos o seu atendimento exclusivo, qual é o seu *nome completo* e o seu *número de WhatsApp com DDD*?`
        );
      }
    }
  }

  // 2. Need Phone (Patch F)
  if (!hasValidPhone) {
    return (
      `Olá${session.name !== 'Cliente' ? `, *${session.name}*` : ''}! 😊\n\n` +
      `Para eu te conectar ao corretor certo, me confirma seu *WhatsApp com DDD*? ` +
      `(ex: 21 99999-9999)`
    );
  }

  // 2B. Confirm Phone if user just provided name or phone wasn't confirmed
  const phoneConfirmed =
    session.extractedLead.phoneConfirmed ||
    /\b(sim|este|esse|correto|pode ser|isso|ok|beleza|perfeito|certo)\b/i.test(lastUserMsg);

  if (session.name !== 'Cliente' && !phoneConfirmed && userMsgs.length === 2 && !session.extractedLead.tipoAtendimento) {
    return (
      `Muito prazer em falar com você, *${session.name}*! 😊\n\n` +
      `Identifiquei seu número de WhatsApp como *${displayPhone}*. Está correto para o corretor entrar em contato ou prefere informar outro?`
    );
  }

  // 3. Confirm Capture & Stage 3 Decision Menu
  if (hasValidPhone && !session.extractedLead.tipoAtendimento) {
    const lastIsOption1 = isExplicitCloseRequest(lowerLastMsg);
    const lastIsOption2 =
      lowerLastMsg === '2' ||
      /\blan[çc]amento(s)?\b|na planta|em constru[çc][ãa]o/i.test(lowerLastMsg);
    const lastIsOption3 =
      lowerLastMsg === '3' ||
      /\bcompr(ar|a|o)?\b|\balug(ar|uel|o)?\b|im[oó]ve(l|is) pronto(s)?/i.test(lowerLastMsg);
    const lastIsOption4 =
      lowerLastMsg === '4' ||
      /d[uú]vida/i.test(lowerLastMsg);

    if (lastIsOption1) {
      session.extractedLead.tipoAtendimento = 'Aguardando contato do corretor';
      session.extractedLead.isComplete = true;
      if (!session.extractedLead.trilhaNavegacao.includes('Optou por aguardar contato do corretor')) {
        session.extractedLead.trilhaNavegacao.push('Optou por aguardar contato do corretor');
      }
      return (
        `Perfeito, *${session.name}*! 👍\n\n` +
        `Sua solicitação já foi registrada e encaminhada ao nosso corretor especialista da ${companyName}.\n` +
        `Em instantes ele entrará em contato com você aqui no WhatsApp para te dar todo o atendimento e suporte! 🏡 Tenha um excelente dia!`
      );
    } else if (lastIsOption2) {
      session.extractedLead.tipoAtendimento = 'Lançamento na Planta';
      if (!session.extractedLead.trilhaNavegacao.includes('Interesse: Lançamentos na Planta')) {
        session.extractedLead.trilhaNavegacao.push('Interesse: Lançamentos na Planta');
      }
      return (
        `Excelente! Conheça nossos lançamentos exclusivos na planta:\n\n` +
        activeLanc.map((l, i) => `${i + 1}️⃣ *${l.nome}* (${l.bairro}) - ${l.tipologias}`).join('\n') +
        `\n\nQual desses empreendimentos você gostaria de conhecer melhor? (Digite o número ou o nome)`
      );
    } else if (lastIsOption3) {
      session.extractedLead.tipoAtendimento = 'Comprar ou Alugar Imóvel Pronto';
      if (!session.extractedLead.trilhaNavegacao.includes('Interesse: Imóveis Prontos')) {
        session.extractedLead.trilhaNavegacao.push('Interesse: Imóveis Prontos');
      }
      return `Perfeito! Que tipo de imóvel você tem em mente (apartamento, casa ou cobertura) e qual a sua região ou bairro de preferência?`;
    } else if (lastIsOption4) {
      session.extractedLead.tipoAtendimento = 'Tirar Dúvidas';
      if (!session.extractedLead.trilhaNavegacao.includes('Interesse: Tirar Dúvidas')) {
        session.extractedLead.trilhaNavegacao.push('Interesse: Tirar Dúvidas');
      }
      return `Com certeza, *${session.name}*! Como posso te ajudar? Pode enviar sua dúvida aqui que te responderei imediatamente.`;
    }

    // Se acabou de informar o telefone, envia o Menu Decisório Inteligente:
    const originNotice =
      session.extractedLead.produtoImovel &&
      session.extractedLead.produtoImovel !== 'A combinar com corretor' &&
      session.extractedLead.produtoImovel !== 'Não informado'
        ? ` referente ao seu interesse no imóvel *${session.extractedLead.produtoImovel}*`
        : '';

    return (
      `Perfeito, *${session.name}*! Já registrei seu contato com sucesso${originNotice}. Nosso consultor especialista entrará em contato com você em instantes! 👍\n\n` +
      `Enquanto preparamos o seu atendimento, como prefere prosseguir?\n\n` +
      `1️⃣ *Aguardar contato do corretor* (Já é o suficiente, aguardo a mensagem)\n` +
      `2️⃣ *Conhecer nossos Lançamentos na Planta* (Fotos, plantas e valores no chat)\n` +
      `3️⃣ *Buscar Imóveis Prontos* (Comprar ou alugar)\n` +
      `4️⃣ *Tirar uma dúvida rápida agora*`
    );
  }

  // 4. LANÇAMENTOS SUB-MENU & EXPLORATION FLOW
  if (session.extractedLead.tipoAtendimento.includes('Lançamento')) {
    // 4A. Se nenhum lançamento foi selecionado ainda:
    if (!session.extractedLead.selectedLancamentoNome) {
      // Verificar se a mensagem atual é uma seleção (ex: "1", "2", ou nome)
      let selected: Lancamento | undefined;
      const numChoice = parseInt(lastUserMsg.replace(/\D/g, ''), 10);
      if (!isNaN(numChoice) && numChoice >= 1 && numChoice <= activeLanc.length) {
        selected = activeLanc[numChoice - 1];
      } else {
        selected = activeLanc.find(
          (l) =>
            lowerLastMsg.includes(l.nome.toLowerCase()) ||
            (l.bairro && lowerLastMsg.includes(l.bairro.toLowerCase()))
        );
      }

      if (selected) {
        session.extractedLead.selectedLancamentoId = selected.id;
        session.extractedLead.selectedLancamentoNome = selected.nome;
        session.extractedLead.produtoImovel = `Lançamento ${selected.nome} (${selected.tipologias})`;
        if (!session.extractedLead.trilhaNavegacao.includes(`Selecionou: ${selected.nome}`)) {
          session.extractedLead.trilhaNavegacao.push(`Selecionou: ${selected.nome}`);
        }

        return (
          `Excelente escolha! O *${selected.nome}* é um empreendimento espetacular em ${selected.bairro}. 🏢✨\n\n` +
          `• *Tipologias:* ${selected.tipologias}\n` +
          (selected.metragens ? `• *Metragens:* ${selected.metragens}\n` : '') +
          (selected.precoAPartirDe ? `• *Valores:* A partir de ${selected.precoAPartirDe}\n\n` : '\n') +
          `O que você gostaria de conferir agora?\n\n` +
          `1️⃣ 📸 *Fotos e Imagens*\n` +
          `2️⃣ 📝 *Descrição e Conceito do Projeto*\n` +
          `3️⃣ 📍 *Localização e Pontos de Referência*\n` +
          `4️⃣ 🌳 *Vizinhança e Lazer do Condomínio*\n` +
          `5️⃣ 💰 *Valores e Condições de Pagamento*\n` +
          `6️⃣ 💬 *Falar com um Corretor Especialista / Agendar Visita*`
        );
      } else {
        return (
          `Temos excelentes opções de *Lançamentos na planta* disponíveis:\n\n` +
          activeLanc
            .map(
              (l, i) =>
                `🏢 *${i + 1}️⃣ ${l.nome}* (${l.bairro})\n• Tipologias: ${l.tipologias}\n• Preço: ${
                  l.precoAPartirDe || 'Sob consulta'
                }`
            )
            .join('\n\n') +
          `\n\nQual desses lançamentos você gostaria de conhecer? (Responda com o número ou nome)`
        );
      }
    }

    // 4B. Lançamento já selecionado - Processar Submenu
    const currentLanc =
      activeLanc.find((l) => l.id === session.extractedLead.selectedLancamentoId) ||
      activeLanc.find((l) => l.nome === session.extractedLead.selectedLancamentoNome) ||
      activeLanc[0];

    if (currentLanc) {
      // Opção 1: Fotos
      if (lowerLastMsg === '1' || lowerLastMsg.includes('foto') || lowerLastMsg.includes('imagem') || lowerLastMsg.includes('galeria') || lowerLastMsg.includes('perspectiva')) {
        if (!session.extractedLead.trilhaNavegacao.includes(`Consultou Fotos (${currentLanc.nome})`)) {
          session.extractedLead.trilhaNavegacao.push(`Consultou Fotos (${currentLanc.nome})`);
        }
        
        let fotosMsg = '';
        if (currentLanc.fotosUpload && currentLanc.fotosUpload.length > 0) {
          fotosMsg = `Acabei de enviar as fotos e perspectivas oficiais do projeto diretamente aqui no nosso chat! 📲\n`;
          if (currentLanc.urlPublicaDirectHouse) {
            fotosMsg += `\nVocê também pode conferir mais fotos e tour virtual no link oficial:\n${currentLanc.urlPublicaDirectHouse}\n`;
          }
        } else {
          const fotosInfo = currentLanc.fotos || currentLanc.urlPublicaDirectHouse || 'Fotos e perspectivas disponíveis com o consultor.';
          fotosMsg = `Confira as imagens autorizadas do projeto:\n${fotosInfo}\n`;
        }

        return (
          `📸 *Fotos e Perspectivas do ${currentLanc.nome}:*\n\n` +
          `${fotosMsg}\n` +
          `Gostaria de ver outro detalhe do projeto?\n` +
          `2️⃣ Descrição | 3️⃣ Localização | 4️⃣ Vizinhança/Lazer | 5️⃣ Valores | 6️⃣ Falar com Corretor`
        );
      }

      // Opção 2: Descrição / Conceito
      if (lowerLastMsg === '2' || lowerLastMsg.includes('descri') || lowerLastMsg.includes('conceito') || lowerLastMsg.includes('projeto') || lowerLastMsg.includes('planta')) {
        if (!session.extractedLead.trilhaNavegacao.includes(`Consultou Descrição (${currentLanc.nome})`)) {
          session.extractedLead.trilhaNavegacao.push(`Consultou Descrição (${currentLanc.nome})`);
        }
        const descInfo = currentLanc.descricao || currentLanc.conteudoPublicoAutorizado || `Empreendimento moderno em ${currentLanc.bairro} com alto padrão de acabamento.`;
        return (
          `📝 *Conceito do Projeto - ${currentLanc.nome}:*\n\n` +
          `${descInfo}\n\n` +
          `Deseja conferir mais alguma informação?\n` +
          `1️⃣ Fotos | 3️⃣ Localização | 4️⃣ Vizinhança/Lazer | 5️⃣ Valores | 6️⃣ Falar com Corretor`
        );
      }

      // Opção 3: Localização / Referências
      if (lowerLastMsg === '3' || lowerLastMsg.includes('local') || lowerLastMsg.includes('onde fica') || lowerLastMsg.includes('bairro') || lowerLastMsg.includes('referencia') || lowerLastMsg.includes('referência')) {
        if (!session.extractedLead.trilhaNavegacao.includes(`Consultou Localização (${currentLanc.nome})`)) {
          session.extractedLead.trilhaNavegacao.push(`Consultou Localização (${currentLanc.nome})`);
        }
        const locInfo = currentLanc.localidade || `${currentLanc.bairro} (${currentLanc.cidade})`;
        return (
          `📍 *Localização e Referências - ${currentLanc.nome}:*\n\n` +
          `${locInfo}\n\n` +
          `Deseja conferir mais alguma informação?\n` +
          `1️⃣ Fotos | 2️⃣ Descrição | 4️⃣ Vizinhança/Lazer | 5️⃣ Valores | 6️⃣ Falar com Corretor`
        );
      }

      // Opção 4: Vizinhança / Lazer
      if (lowerLastMsg === '4' || lowerLastMsg.includes('vizinhan') || lowerLastMsg.includes('lazer') || lowerLastMsg.includes('diferencia') || lowerLastMsg.includes('piscina') || lowerLastMsg.includes('academia')) {
        if (!session.extractedLead.trilhaNavegacao.includes(`Consultou Lazer/Vizinhança (${currentLanc.nome})`)) {
          session.extractedLead.trilhaNavegacao.push(`Consultou Lazer/Vizinhança (${currentLanc.nome})`);
        }
        const lazerInfo = currentLanc.diferenciais || 'Lazer completo e infraestrutura moderna de condomínio.';
        const vizInfo = currentLanc.vizinhanca ? `\n\n🌳 *Vizinhança e Entorno:*\n${currentLanc.vizinhanca}` : '';
        return (
          `🏊 *Lazer e Diferenciais - ${currentLanc.nome}:*\n\n` +
          `${lazerInfo}${vizInfo}\n\n` +
          `Deseja conferir mais alguma informação?\n` +
          `1️⃣ Fotos | 2️⃣ Descrição | 3️⃣ Localização | 5️⃣ Valores | 6️⃣ Falar com Corretor`
        );
      }

      // Opção 5: Valores / Condições
      if (lowerLastMsg === '5' || lowerLastMsg.includes('valor') || lowerLastMsg.includes('preco') || lowerLastMsg.includes('preço') || lowerLastMsg.includes('quanto') || lowerLastMsg.includes('condi') || lowerLastMsg.includes('pagamento')) {
        if (!session.extractedLead.trilhaNavegacao.includes(`Consultou Valores/Condições (${currentLanc.nome})`)) {
          session.extractedLead.trilhaNavegacao.push(`Consultou Valores/Condições (${currentLanc.nome})`);
        }
        const precoInfo = currentLanc.precoAPartirDe || 'Valores sob consulta com nossos especialistas.';
        const condicoesInfo = currentLanc.condicoesComerciais ? `\n• *Condições:* ${currentLanc.condicoesComerciais}` : '';
        return (
          `💰 *Valores e Condições - ${currentLanc.nome}:*\n\n` +
          `• *Preço:* A partir de ${precoInfo}${condicoesInfo}\n\n` +
          `Gostaria de solicitar uma simulação personalizada com o corretor responsável?\n` +
          `Digite *6* para falar com o corretor ou escolha outra opção (1️⃣ Fotos | 2️⃣ Descrição | 3️⃣ Localização | 4️⃣ Lazer).`
        );
      }
    }
  }

  // 4. Imóveis Prontos / Venda / Locação
  if (!session.extractedLead.produtoImovel) {
    if (/(quarto|casa|apto|apartamento|cobertura|sala|terreno|lote|imovel|reserva|iconic|bairro|barra|botafogo)/i.test(lastUserMsg) && lastUserMsg.length > 2) {
      session.extractedLead.produtoImovel = lastUserMsg;
      if (!session.extractedLead.trilhaNavegacao.includes(`Informou imóvel: ${lastUserMsg}`)) {
        session.extractedLead.trilhaNavegacao.push(`Informou imóvel: ${lastUserMsg}`);
      }
    } else {
      return `Excelente! Que tipo de imóvel você tem em mente? (Por exemplo: apartamento de 2 ou 3 quartos, casa em condomínio, ou bairro de preferência...)`;
    }
  }

  // 5. Observações & Budget
  if (!session.extractedLead.observacoes) {
    if (userMsgs.length >= 4) {
      session.extractedLead.observacoes = lastUserMsg !== session.extractedLead.produtoImovel ? lastUserMsg : 'Sem observações adicionais.';
      if (!session.extractedLead.trilhaNavegacao.includes(`Observação: ${session.extractedLead.observacoes}`)) {
        session.extractedLead.trilhaNavegacao.push(`Observação: ${session.extractedLead.observacoes}`);
      }
    } else {
      return `Perfeito! Há alguma preferência importante (como vaga de garagem, faixa de valor/investimento ou urgência)? Se não houver, pode me dizer apenas "sem observações".`;
    }
  }

  // 6. Encerramento oficial
  const finalNome = session.extractedLead.nome || session.name || 'Cliente';
  return (
    `Muito obrigado por todas as informações, *${finalNome}*! 👍\n\n` +
    `Já registrei seu interesse e estou conectando você agora ao nosso corretor especialista da ${companyName}. Em instantes ele entrará em contato com você aqui no WhatsApp com todos os detalhes e materiais exclusivos!`
  );
}

// Structured lead extractor based on conversation state
async function extractLeadFromSession(session: WhatsAppChatSession) {
  const userMessages = session.messages.filter((m) => m.role === 'user');
  const userText = userMessages.map((m) => m.content).join(' ');
  const activeLanc = getActiveLancamentos();

  if (!Array.isArray(session.extractedLead.trilhaNavegacao)) {
    session.extractedLead.trilhaNavegacao = [];
  }

  // 1. Extract phone number from all user messages
  for (const m of userMessages) {
    const detected = extractPhoneFromText(m.content);
    if (detected && isValidPhoneNumber(detected)) {
      session.phone = detected;
      session.extractedLead.telefone = formatPhoneForDisplay(detected);
      session.extractedLead.phoneConfirmed = true;
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

  let hasValidPhone = isValidPhoneNumber(session.phone);
  const displayPhone = hasValidPhone ? formatPhoneForDisplay(session.phone) : 'Não informado';

  // 3. Detect origin property from initial message if available
  let produto = session.extractedLead.produtoImovel || '';
  let selectedLancNome = session.extractedLead.selectedLancamentoNome || '';
  let selectedLancId = session.extractedLead.selectedLancamentoId || '';

  if (!produto || produto === 'Não informado' || produto === 'A combinar com corretor') {
    const initMsg = session.initialMessage || '';
    for (const l of activeLanc) {
      if (initMsg.toLowerCase().includes(l.nome.toLowerCase())) {
        selectedLancNome = l.nome;
        selectedLancId = l.id;
        produto = `Lançamento ${l.nome} (${l.tipologias})`;
        break;
      }
    }
    if (!produto && (initMsg.includes('http') || /(apartamento|casa|cobertura|imovel|imóvel|reserva|lote)/i.test(initMsg))) {
      produto = initMsg.length > 90 ? initMsg.substring(0, 90) + '...' : initMsg;
    }
  }

  // 4. Detect Tipo de Atendimento & Decisão do Lead
  let tipo = session.extractedLead.tipoAtendimento || '';
  const lastUserMsg = userMessages[userMessages.length - 1]?.content.toLowerCase().trim() || '';

  // Check phone confirmation keywords
  if (
    hasValidPhone &&
    /\b(sim|este|esse|correto|pode ser|isso|ok|beleza|perfeito|certo|exato|positivo|pode ser esse|meu zap|meu whatsapp)\b/i.test(lastUserMsg)
  ) {
    session.extractedLead.phoneConfirmed = true;
  }

  // Se o telefone foi fornecido/confirmado e o tipo ainda não foi definido:
  if (!tipo && hasValidPhone && userMessages.length >= 2) {
    if (isExplicitCloseRequest(lastUserMsg)) {
      tipo = 'Aguardando contato do corretor';
      session.extractedLead.humanRequested = true;
      if (!session.extractedLead.trilhaNavegacao.includes('Optou por aguardar contato direto do corretor')) {
        session.extractedLead.trilhaNavegacao.push('Optou por aguardar contato direto do corretor');
      }
    } else if (lastUserMsg === '2' || /\blan[çc]amento(s)?\b|na planta|em constru[çc][ãa]o/i.test(lastUserMsg)) {
      tipo = 'Lançamento na Planta';
      if (!session.extractedLead.trilhaNavegacao.includes('Interesse: Lançamentos na Planta')) {
        session.extractedLead.trilhaNavegacao.push('Interesse: Lançamentos na Planta');
      }
    } else if (lastUserMsg === '3' || /\bcompr(ar|a|o)?\b|\balug(ar|uel|o)?\b|im[oó]ve(l|is) pronto(s)?/i.test(lastUserMsg)) {
      tipo = 'Comprar ou Alugar Imóvel Pronto';
      if (!session.extractedLead.trilhaNavegacao.includes('Interesse: Comprar ou Alugar Imóvel Pronto')) {
        session.extractedLead.trilhaNavegacao.push('Interesse: Comprar ou Alugar Imóvel Pronto');
      }
    } else if (lastUserMsg === '4' || /d[uú]vida/i.test(lastUserMsg)) {
      tipo = 'Tirar Dúvidas';
      if (!session.extractedLead.trilhaNavegacao.includes('Interesse: Tirar Dúvidas')) {
        session.extractedLead.trilhaNavegacao.push('Interesse: Tirar Dúvidas');
      }
    }
  } else if (!tipo) {
    if (/\blan[çc]amento(s)?\b|na planta|em constru[çc][ãa]o/i.test(userText)) {
      tipo = 'Lançamento na Planta';
    } else if (/\bcompr(ar|a|o)?\b/i.test(userText)) {
      tipo = 'Comprar Imóvel Pronto';
    } else if (/\balug(ar|uel|o)?\b/i.test(userText)) {
      tipo = 'Alugar';
    }
  }

  // 5. Detect Launch or Property mentioned in text
  for (const l of activeLanc) {
    if (userText.toLowerCase().includes(l.nome.toLowerCase())) {
      selectedLancNome = l.nome;
      selectedLancId = l.id;
      produto = `Lançamento ${l.nome} (${l.tipologias})`;
      if (!session.extractedLead.trilhaNavegacao.includes(`Empreendimento: ${l.nome}`)) {
        session.extractedLead.trilhaNavegacao.push(`Empreendimento: ${l.nome}`);
      }
      break;
    }
  }

  // Detect Submenu interactions in conversation
  for (const m of userMessages) {
    const txt = m.content.toLowerCase();
    if (txt.includes('foto') || txt.includes('imagem')) {
      if (!session.extractedLead.trilhaNavegacao.includes('Consultou Fotos')) session.extractedLead.trilhaNavegacao.push('Consultou Fotos');
    }
    if (txt.includes('descri') || txt.includes('conceito') || txt.includes('projeto')) {
      if (!session.extractedLead.trilhaNavegacao.includes('Consultou Descrição/Conceito')) session.extractedLead.trilhaNavegacao.push('Consultou Descrição/Conceito');
    }
    if (txt.includes('local') || txt.includes('onde fica') || txt.includes('referencia')) {
      if (!session.extractedLead.trilhaNavegacao.includes('Consultou Localização')) session.extractedLead.trilhaNavegacao.push('Consultou Localização');
    }
    if (txt.includes('vizinhan') || txt.includes('lazer') || txt.includes('piscina') || txt.includes('academia')) {
      if (!session.extractedLead.trilhaNavegacao.includes('Consultou Vizinhança/Lazer')) session.extractedLead.trilhaNavegacao.push('Consultou Vizinhança/Lazer');
    }
    if (txt.includes('valor') || txt.includes('preco') || txt.includes('preço') || txt.includes('condi')) {
      if (!session.extractedLead.trilhaNavegacao.includes('Consultou Valores/Condições')) session.extractedLead.trilhaNavegacao.push('Consultou Valores/Condições');
    }
  }

  if (!produto && tipo) {
    for (let i = 1; i < userMessages.length; i++) {
      const txt = userMessages[i].content;
      if (
        /(quarto|casa|apto|apartamento|cobertura|sala|terreno|lote|reserva|iconic|bairro|barra|recreio|botafogo)/i.test(txt) &&
        txt.length > 2 &&
        !extractPhoneFromText(txt)
      ) {
        produto = txt;
        break;
      }
    }
  }

  // 6. Detect Observações
  let obs = session.extractedLead.observacoes || '';
  if (!obs && userMessages.length >= 4) {
    const lastMsg = userMessages[userMessages.length - 1].content;
    if (lastMsg !== produto && !extractPhoneFromText(lastMsg) && !isGreetingOnly(lastMsg)) {
      obs = lastMsg;
    }
  }

  // Patch B: isComplete só com telefone real + intenção clara
  hasValidPhone = isValidPhoneNumber(session.phone);

  const lastMsg = userMessages[userMessages.length - 1]?.content || '';
  const explicitClose = isExplicitCloseRequest(lastMsg);

  const isFullyQualified = Boolean(
    hasValidPhone &&
    (
      explicitClose ||
      (
        userMessages.length >= 4 &&
        session.name !== 'Cliente' &&
        !isGreetingOnly(session.name) &&
        Boolean(tipo) &&
        Boolean(produto) &&
        produto !== 'A combinar com corretor' &&
        produto !== 'Imóvel sob consulta'
      )
    )
  );

  const humanRequested = explicitClose || tipo === 'Aguardando contato do corretor';

  // Build complete transcript for broker
  const historicoMensagens = session.messages.map((m) => ({
    role: m.role,
    content: m.content,
    timestamp: m.timestamp,
  }));

  const resumoNavegacao = session.extractedLead.trilhaNavegacao.length > 0
    ? session.extractedLead.trilhaNavegacao.join(' ➔ ')
    : (tipo ? `Interesse em ${tipo}` : 'Atendimento inicial');

  session.extractedLead = {
    nome: session.name !== 'Cliente' ? session.name : 'Cliente WhatsApp',
    telefone: displayPhone,
    tipoAtendimento: tipo || session.extractedLead.tipoAtendimento || '',
    produtoImovel: produto || session.extractedLead.produtoImovel || 'Imóvel sob consulta',
    selectedLancamentoId: selectedLancId || session.extractedLead.selectedLancamentoId,
    selectedLancamentoNome: selectedLancNome || session.extractedLead.selectedLancamentoNome,
    phoneConfirmed: session.extractedLead.phoneConfirmed || false,
    trilhaNavegacao: session.extractedLead.trilhaNavegacao,
    resumoNavegacao,
    historicoMensagens,
    observacoes: obs || session.extractedLead.observacoes || (session.initialMessage ? `Origem: "${session.initialMessage}"` : 'Nenhuma'),
    initialMessage: session.initialMessage,
    consentimento: 'Sim, autorizado conforme LGPD',
    origem: 'WhatsApp Web Direct Houses',
    status: isFullyQualified ? 'Qualificado - Aguardando corretor' : 'Em atendimento inicial',
    isComplete: isFullyQualified,
    humanRequested,
    finalStructuredText: `NOVO LEAD\nNome: ${session.name}\nTelefone: ${displayPhone}\nTipo de atendimento: ${tipo || 'Aguardando corretor'}\nProduto ou imóvel: ${produto || 'A combinar com corretor'}\nTrilha de navegação: ${resumoNavegacao}\nObservações: ${obs || 'Nenhuma'}\nConsentimento para contato: Sim, autorizado conforme LGPD\nOrigem: WhatsApp Web Direct Houses\nStatus: Aguardando contato do corretor`,
  };

  if (isFullyQualified && session.status === 'active') {
    session.status = 'qualified';
  }

  // Patch C: canRecordLead só quando realmente qualificado OU (telefone + nome + tipo)
  const canRecordLead =
    hasValidPhone &&
    session.name !== 'Cliente' &&
    !isGreetingOnly(session.name) &&
    (isFullyQualified || (Boolean(tipo) && userMessages.length >= 4));

  if (canRecordLead) {
    await recordLead({
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
      trilhaNavegacao: session.extractedLead.trilhaNavegacao,
      resumoNavegacao,
      historicoMensagens,
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
        trilhaNavegacao: [],
      },
      status: 'active',
      lastActivity: new Date().toISOString(),
    };
    sessions.set(jid, session);
  }

  // Patch F: Atualiza telefone se Baileys mandar um PN válido depois
  if (isValidPhoneNumber(senderPhone) && !isValidPhoneNumber(session.phone)) {
    session.phone = cleanPhoneNumber(senderPhone);
    session.extractedLead.telefone = formatPhoneForDisplay(session.phone);
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
  await extractLeadFromSession(session);
  scheduleSessionsPersist();

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

  // Patch E — Anti-skip mais forte (resposta da IA)
  const prematureClose =
    /encaminhando|conectando|transferindo|NOVO LEAD|corretor.*entrar[áa] em contato|já registrei seu contato/i.test(replyText);

  const tooEarly =
    !session.extractedLead.isComplete ||
    !isValidPhoneNumber(session.phone) ||
    session.name === 'Cliente' ||
    isGreetingOnly(session.name);

  if (tooEarly && prematureClose) {
    console.warn('[WhatsApp AI] Fechamento prematuro bloqueado. Forçando próxima pergunta.');
    replyText = getFallbackReply(session, companyName);
  }

  // 🛡️ Data Loss Prevention (DLP) & Filtro de Governança de Saída:
  const governanceAudit = sanitizeAndAuditAIResponse(replyText, {
    userPrompt: messageText,
    companyName,
    whatsappJid: session.jid,
    leadId: session.extractedLead?.nome ? `lead-${session.jid.replace(/[^a-zA-Z0-9]/g, '')}` : null,
    modelUsed: 'gemini-2.5-flash',
  });
  if (governanceAudit.wasModified) {
    console.warn(
      `🛡️ [Governança ${companyName}] Resposta filtrada e higienizada. Violações:`,
      governanceAudit.violationsDetected
    );
    replyText = governanceAudit.sanitizedText;
  }

  // Record assistant response
  session.messages.push({
    id: `msg-${Date.now()}-assistant`,
    role: 'assistant',
    content: replyText,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  });
  scheduleSessionsPersist();

  // 📲 Envio nativo de mídias (Fotos e Book PDF) pelo WhatsApp
  try {
    const lowerUserMsg = messageText.toLowerCase();
    const activeLanc = getActiveLancamentos();
    const targetLanc =
      activeLanc.find((l) => l.id === session.extractedLead.selectedLancamentoId) ||
      activeLanc.find((l) => l.nome === session.extractedLead.selectedLancamentoNome) ||
      (activeLanc.length === 1 ? activeLanc[0] : undefined);

    if (targetLanc) {
      // 1. Envio nativo de Fotos
      const isRequestingPhotos =
        lowerUserMsg === '1' ||
        lowerUserMsg.includes('foto') ||
        lowerUserMsg.includes('imagem') ||
        lowerUserMsg.includes('imagens') ||
        lowerUserMsg.includes('galeria') ||
        lowerUserMsg.includes('perspectiva');

      if (isRequestingPhotos && targetLanc.fotosUpload && targetLanc.fotosUpload.length > 0) {
        for (const foto of targetLanc.fotosUpload.slice(0, 4)) {
          await whatsAppService.sendImageMessage(
            jid,
            foto.path || foto.url,
            `📸 ${targetLanc.nome} - Direct Houses`
          );
        }
      }

      // 2. Envio nativo de Book PDF
      const isRequestingBook =
        lowerUserMsg.includes('book') ||
        lowerUserMsg.includes('pdf') ||
        lowerUserMsg.includes('apresenta') ||
        lowerUserMsg.includes('material completo');

      if (isRequestingBook && targetLanc.bookPdfUpload && (targetLanc.bookPdfUpload.path || targetLanc.bookPdfUpload.url)) {
        await whatsAppService.sendDocumentMessage(
          jid,
          targetLanc.bookPdfUpload.path || targetLanc.bookPdfUpload.url,
          targetLanc.bookPdfUpload.originalName || `${targetLanc.nome}_Apresentacao.pdf`,
          `📄 Apresentação Comercial Oficial - ${targetLanc.nome}`
        );
      }
    }
  } catch (mediaErr) {
    console.warn('⚠️ [WhatsApp AI] Erro ao enviar mídia nativa:', mediaErr);
  }

  // Send response back to customer on WhatsApp
  await whatsAppService.sendTextMessage(jid, replyText);

  // Re-extract structured lead data with updated assistant response
  await extractLeadFromSession(session);

  // Check if lead was qualified/finished and if Auto Roleta is enabled
  const roletaConfig = await getRoletaConfig();
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
  // Patch C: Nunca despachar sem telefone válido
  if (!isValidPhoneNumber(session.phone)) {
    console.warn('[Roleta] Bloqueado: lead sem telefone válido. Continuando qualificação.');
    return { success: false, message: 'Telefone obrigatório antes do despacho.' };
  }

  const chosenBroker = await getNextBrokerInRoleta();

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
    const roletaConfig = await getRoletaConfig();
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
    
    const leadId = `lead-${session.jid.replace(/[^a-zA-Z0-9]/g, '')}`;

    // Record in Roleta Distribution History
    await recordDistributionLog({
      leadId,
      leadNome: session.extractedLead.nome || session.name || 'Cliente WhatsApp',
      leadTelefone: session.extractedLead.telefone || session.phone,
      brokerId: chosenBroker.id,
      brokerNome: chosenBroker.name,
      brokerTelefone: chosenBroker.phone,
      tipoDistribuicao: 'automatica_roleta',
      statusEnvioWhatsApp: sendRes.success ? 'enviado' : 'falha',
      motivo: 'Qualificação completa via IA no WhatsApp',
      produtoImovel: session.extractedLead.produtoImovel || 'A combinar',
    });

    // Update persistent lead
    await recordLead({
      id: leadId,
      nome: session.extractedLead.nome,
      telefone: session.extractedLead.telefone || session.phone,
      tipoAtendimento: session.extractedLead.tipoAtendimento,
      produtoImovel: session.extractedLead.produtoImovel,
      observacoes: session.extractedLead.observacoes,
      initialMessage: session.initialMessage,
      origem: 'WhatsApp Web Direct Houses',
      status: 'em_atendimento',
      temperatura: 'quente',
      assignedBroker: session.assignedBroker,
      rawStructuredText: session.extractedLead.finalStructuredText,
      historicoDistribuicoes: [
        {
          id: `dist-${Date.now()}`,
          brokerId: chosenBroker.id,
          brokerName: chosenBroker.name,
          brokerPhone: chosenBroker.phone,
          data: new Date().toISOString(),
          tipo: 'automatica_roleta',
          statusEnvioWhatsApp: sendRes.success ? 'enviado' : 'falha',
        },
      ],
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

  if (!isValidPhoneNumber(session.phone)) {
    console.warn('[Roleta Manual] Bloqueado: lead sem telefone válido.');
    return { success: false, message: 'Telefone obrigatório antes do despacho.' };
  }

  const brokers = await getBrokers();
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

    const leadId = `lead-${session.jid.replace(/[^a-zA-Z0-9]/g, '')}`;

    // Record in Roleta Distribution History
    await recordDistributionLog({
      leadId,
      leadNome: session.extractedLead.nome || session.name || 'Cliente WhatsApp',
      leadTelefone: session.extractedLead.telefone || session.phone,
      brokerId: chosenBroker.id,
      brokerNome: chosenBroker.name,
      brokerTelefone: chosenBroker.phone,
      tipoDistribuicao: 'manual_operador',
      statusEnvioWhatsApp: sendRes.success ? 'enviado' : 'falha',
      motivo: 'Direcionamento específico pelo operador',
      produtoImovel: session.extractedLead.produtoImovel || 'A combinar',
    });

    // Update persistent lead
    await recordLead({
      id: leadId,
      nome: session.extractedLead.nome,
      telefone: session.extractedLead.telefone || session.phone,
      tipoAtendimento: session.extractedLead.tipoAtendimento,
      produtoImovel: session.extractedLead.produtoImovel,
      observacoes: session.extractedLead.observacoes,
      initialMessage: session.initialMessage,
      origem: 'WhatsApp Web Direct Houses',
      status: 'em_atendimento',
      temperatura: 'quente',
      assignedBroker: session.assignedBroker,
      rawStructuredText: session.extractedLead.finalStructuredText,
      historicoDistribuicoes: [
        {
          id: `dist-${Date.now()}`,
          brokerId: chosenBroker.id,
          brokerName: chosenBroker.name,
          brokerPhone: chosenBroker.phone,
          data: new Date().toISOString(),
          tipo: 'manual_operador',
          statusEnvioWhatsApp: sendRes.success ? 'enviado' : 'falha',
        },
      ],
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
  const roletaConfig = await getRoletaConfig();

  if (!roletaConfig.autoDispatchEnabled) return;

  for (const session of sessions.values()) {
    if (session.status === 'active' && session.messages.length > 0) {
      const lastActivityTime = new Date(session.lastActivity).getTime();
      if (now - lastActivityTime >= INACTIVITY_TIMEOUT_MS) {
        await extractLeadFromSession(session);

        // Patch D — Timeout de inatividade: não despachar frio
        // Só despacha se tiver telefone + pelo menos nome ou tipo
        const canDispatch =
          isValidPhoneNumber(session.phone) &&
          (
            (session.name && session.name !== 'Cliente' && !isGreetingOnly(session.name)) ||
            Boolean(session.extractedLead.tipoAtendimento)
          );

        if (!canDispatch) {
          continue;
        }

        console.log(
          `⏱️ [Inatividade] Sessão de ${session.name} (${session.phone}) inativa há mais de 5 min. Despachando na Roleta para não perder o lead...`
        );

        const chosenBroker = await getNextBrokerInRoleta();

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
          scheduleSessionsPersist();

          const leadId = `lead-${session.jid.replace(/[^a-zA-Z0-9]/g, '')}`;

          await recordDistributionLog({
            leadId,
            leadNome: session.extractedLead.nome || session.name || 'Cliente WhatsApp',
            leadTelefone: session.extractedLead.telefone || session.phone,
            brokerId: chosenBroker.id,
            brokerNome: chosenBroker.name,
            brokerTelefone: chosenBroker.phone,
            tipoDistribuicao: 'timeout_recuperacao',
            statusEnvioWhatsApp: 'enviado',
            motivo: 'Recuperação por inatividade (> 5 min sem resposta)',
            produtoImovel: session.extractedLead.produtoImovel || 'A combinar com corretor',
          });

          // Update persistent lead
          await recordLead({
            id: leadId,
            nome: session.extractedLead.nome || session.name || 'Cliente WhatsApp',
            telefone: session.extractedLead.telefone || session.phone,
            tipoAtendimento: session.extractedLead.tipoAtendimento || 'Interesse Comercial Inicial',
            produtoImovel: session.extractedLead.produtoImovel || 'A combinar com corretor',
            observacoes: 'Cliente parou de responder após 5 minutos. Lead recuperado e direcionado na roleta.',
            initialMessage: session.initialMessage || session.messages[0]?.content || '',
            origem: 'WhatsApp Web Direct Houses',
            status: 'em_atendimento',
            temperatura: 'quente',
            assignedBroker: session.assignedBroker,
            historicoDistribuicoes: [
              {
                id: `dist-${Date.now()}`,
                brokerId: chosenBroker.id,
                brokerName: chosenBroker.name,
                brokerPhone: chosenBroker.phone,
                data: new Date().toISOString(),
                tipo: 'timeout_recuperacao',
                statusEnvioWhatsApp: 'enviado',
              },
            ],
          });

          console.log(`✅ [Inatividade] Lead recuperado e enviado com sucesso para ${chosenBroker.name} (${chosenBroker.phone})`);
        }
      }
    }
  }
}

// Check every 30 seconds
setInterval(checkInactiveSessions, 30000);

process.on('beforeExit', () => {
  persistSessionsToDiskNow();
});
process.on('SIGTERM', () => {
  persistSessionsToDiskNow();
});
process.on('SIGINT', () => {
  persistSessionsToDiskNow();
});

// Hook message listener into WhatsApp service
whatsAppService.onMessage(handleIncomingWhatsAppMessage);

