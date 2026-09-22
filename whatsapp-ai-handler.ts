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
  /** Display/working name — may be pushName until confirmed or overwritten by typed name */
  name: string;
  /** Baileys pushName — never treated as confirmed lead name until confirmation step */
  pushName?: string;
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
    /** Confirmed only after explicit SIM / correction step (B) */
    nameConfirmed?: boolean;
    phoneConfirmed?: boolean;
    dadosNaoConfirmados?: boolean;
    trilhaNavegacao: string[];
    resumoNavegacao?: string;
    historicoMensagens?: Array<{ role: string; content: string; timestamp: string }>;
    codigoImovel?: string;
    linkImovel?: string;
    intencaoAtual?: 'aguardar_corretor' | 'lancamentos_na_planta' | 'imoveis_prontos' | 'duvida' | 'atendimento_humano' | string;
    estadoAtendimento?: string;
    informacoesColetadas?: {
      finalidade?: string;
      regiao?: string;
      tipoImovel?: string;
      faixaValor?: string;
      quantidadeQuartos?: string;
      formaPagamento?: string;
      duvidaTexto?: string;
      [key: string]: any;
    };
  };
  assignedBroker?: {
    id: string;
    name: string;
    phone: string;
    assignedAt: string;
  };
  status: 'active' | 'validating' | 'qualified' | 'dispatched' | 'closed';
  lastActivity: string;
  lastDispatchedAt?: string;
  lastDispatchedMessageIndex?: number;
  technicalValidationPassed?: boolean;
  technicalValidationErrors?: string[];
  /** Early contact confirmation gate (name + phone) before menu/trail */
  awaitingContactConfirmation?: boolean;
  contactConfirmationAsked?: boolean;
  contactConfirmationNudgedOnInactivity?: boolean;
}

// Sessions store (memory + disk under .data)
const sessions = new Map<string, WhatsAppChatSession>();
// Active timers for delayed dispatch (temporizador antes do envio ao corretor)
const activeDispatchTimers = new Map<string, ReturnType<typeof setTimeout>>();
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

/**
 * Limpa todas as sessões ativas do WhatsApp e remove o arquivo de persistência do disco.
 */
export function clearAllWhatsAppSessions(): boolean {
  for (const timer of activeDispatchTimers.values()) {
    clearTimeout(timer);
  }
  activeDispatchTimers.clear();
  sessions.clear();
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      fs.unlinkSync(SESSIONS_FILE);
    }
    console.log('🧹 [WhatsApp AI] Todas as sessões em memória e disco foram limpas.');
  } catch (err) {
    console.warn('⚠️ [WhatsApp AI] Erro ao remover SESSIONS_FILE:', err);
  }
  return true;
}

/**
 * Extrai apenas o histórico alterado / incremental de mensagens da sessão,
 * evitando mensagens gigantes no WhatsApp do corretor e no banco de dados.
 */
export function getAlteredSessionHistory(
  session: WhatsAppChatSession
): Array<{ role: string; content: string; timestamp: string }> {
  const allMessages = session.messages || [];
  if (allMessages.length === 0) return [];

  let relevantMessages: typeof allMessages = [];

  // Se a sessão já foi despachada anteriormente, pega estritamente as mensagens adicionadas/alteradas após o último despacho
  if (
    typeof session.lastDispatchedMessageIndex === 'number' &&
    session.lastDispatchedMessageIndex >= 0 &&
    session.lastDispatchedMessageIndex < allMessages.length - 1
  ) {
    relevantMessages = allMessages.slice(session.lastDispatchedMessageIndex + 1);
  } else if (session.lastDispatchedAt) {
    // Fallback por timestamp se lastDispatchedMessageIndex não estiver gravado
    const lastDispTime = new Date(session.lastDispatchedAt).getTime();
    relevantMessages = allMessages.filter(
      (m) => new Date(m.timestamp).getTime() > lastDispTime
    );
  }

  // seleciona apenas as últimas mensagens mais recentes e relevantes (máx 4)
  if (relevantMessages.length === 0) {
    relevantMessages = allMessages.slice(-4);
  } else {
    relevantMessages = relevantMessages.slice(-4);
  }

  // Sanitiza e compacta respostas longas da IA para manter a mensagem do corretor limpa e concisa
  return relevantMessages.map((m) => {
    let cleanContent = (m.content || '').trim();
    if (cleanContent.length > 120) {
      cleanContent = cleanContent.substring(0, 117).trim() + '...';
    }
    return {
      role: m.role,
      content: cleanContent,
      timestamp: m.timestamp,
    };
  });
}

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

// Prefer currently listed Gemini Flash endpoints (docs 2026-09). Keep legacy 2.5 last —
// some accounts get 404 on gemini-2.5-flash when access is limited to prior users.
const CANDIDATE_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-flash-latest',
  'gemini-2.5-flash',
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

/** True when the message is only a phone number (with optional spaces/punctuation). */
function isPhoneOnlyMessage(text: string): boolean {
  const t = (text || '').trim();
  if (!t) return false;
  const digits = t.replace(/\D/g, '');
  if (!isValidPhoneNumber(digits) && digits.length < 10) return false;
  const withoutPhoneNoise = t.replace(/[\d\s()+\-.]/g, '');
  return withoutPhoneNoise.length <= 2;
}

/** Affirmative confirmation (SIM / OK / 👍 etc.) for the early contact step. */
function isContactConfirmationReply(text: string): boolean {
  const t = (text || '').trim().toLowerCase().replace(/[!.,]/g, '');
  if (!t) return false;
  if (/^(sim|ok|okay|certo|isso|perfeito|pode|pode ser|confirmo|confirmado|correto|exato|beleza|positivo|👍|👍🏻|👍🏼|👍🏽|👍🏾|👍🏿)$/i.test(t)) {
    return true;
  }
  return /\b(sim[,!]?\s*(est[aá]\s*)?(correto|certo|pode)|confirmo|dados?\s*corretos?)\b/i.test(t);
}

/**
 * Detects a typed personal name (1–4 words). Excludes greetings, phones, menu digits,
 * property URLs, and explicit close/intent phrases.
 */
export function looksLikeTypedFullName(text: string): boolean {
  const clean = (text || '').trim().split('\n')[0].replace(/[!.,?]/g, '').trim();
  if (!clean || clean.length < 2 || clean.length > 60) return false;
  if (isGreetingOnly(clean)) return false;
  if (isPhoneOnlyMessage(clean) || extractPhoneFromText(clean)) return false;
  if (isExplicitCloseRequest(clean)) return false;
  if (/^[1-6]$/.test(clean)) return false;
  if (/https?:\/\/|www\.|directhouses\.com/i.test(clean)) return false;
  if (classifyIntent(clean)) return false;
  if (isContactConfirmationReply(clean)) return false;
  // Prefer multi-word full names; allow single token if alphabetic and longer than nicknames
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length < 1 || words.length > 5) return false;
  if (!/^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'\-\s]+$/.test(clean)) return false;
  if (words.length === 1 && clean.length < 4) return false;
  return true;
}

/** Extract property URL (normalized) from text for cycle/product comparison. */
export function extractPropertyUrlKey(text: string): string {
  if (!text) return '';
  const { link } = extractPropertyCodeAndLink(text);
  if (!link) return '';
  return link.replace(/[.,!?;:)]$/, '').toLowerCase().replace(/\/$/, '');
}

function propertyContextDiffers(a?: string, b?: string): boolean {
  const ua = extractPropertyUrlKey(a || '');
  const ub = extractPropertyUrlKey(b || '');
  if (ua && ub && ua !== ub) return true;
  const ca = extractPropertyCodeAndLink(a || '').code;
  const cb = extractPropertyCodeAndLink(b || '').code;
  if (ca && cb && ca !== cb) return true;
  return false;
}

function suggestedDisplayName(session: WhatsAppChatSession): string {
  if (session.name && session.name !== 'Cliente' && !isGreetingOnly(session.name)) {
    return session.name;
  }
  if (session.pushName && session.pushName !== 'Cliente' && !isGreetingOnly(session.pushName)) {
    return session.pushName;
  }
  return '';
}

function hasConfirmedContact(session: WhatsAppChatSession): boolean {
  return Boolean(session.extractedLead.nameConfirmed && session.extractedLead.phoneConfirmed);
}

/**
 * Clears product/trail/tipo and incremental history for a new attendance cycle.
 * Keeps jid/phone; does not inherit confirmed name from pushName.
 */
export function resetSessionForNewCycle(
  session: WhatsAppChatSession,
  messageText: string,
  opts?: { keepPushNameHint?: boolean }
): void {
  const pushName = opts?.keepPushNameHint === false ? undefined : session.pushName;
  session.status = 'active';
  session.initialMessage = messageText;
  session.assignedBroker = undefined;
  session.technicalValidationPassed = false;
  session.technicalValidationErrors = [];
  session.awaitingContactConfirmation = true;
  session.contactConfirmationAsked = false;
  session.contactConfirmationNudgedOnInactivity = false;
  // New cycle: do not carry over previous typed/confirmed name as confirmed
  session.name = 'Cliente';
  session.extractedLead = {
    nome: 'Cliente',
    telefone: isValidPhoneNumber(session.phone) ? formatPhoneForDisplay(session.phone) : '',
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
    nameConfirmed: false,
    phoneConfirmed: false,
    dadosNaoConfirmados: false,
    trilhaNavegacao: [],
    resumoNavegacao: undefined,
    historicoMensagens: [],
    codigoImovel: undefined,
    linkImovel: undefined,
    intencaoAtual: undefined,
    estadoAtendimento: 'confirmacao_contato',
    informacoesColetadas: {},
    selectedLancamentoId: undefined,
    selectedLancamentoNome: undefined,
  };
  // Keep pushName as hint only for the confirmation prompt
  if (pushName) session.pushName = pushName;
  // Seed property context from the new initial message
  const prop = extractPropertyCodeAndLink(messageText);
  if (prop.code) session.extractedLead.codigoImovel = prop.code;
  if (prop.link) {
    session.extractedLead.linkImovel = prop.link;
    session.extractedLead.produtoImovel = prop.code
      ? `Imóvel Cód. ${prop.code}`
      : `Imóvel: ${prop.link}`;
  }
  // Truncate history to this new cycle (incremental from here)
  session.messages = [];
  session.lastDispatchedMessageIndex = session.messages.length - 1;
}

function buildWelcomeMessage(session: WhatsAppChatSession, companyName: string): string {
  const prop = extractPropertyCodeAndLink(session.initialMessage || '');
  const codigo = session.extractedLead.codigoImovel || prop.code;
  const link = session.extractedLead.linkImovel || prop.link;
  let context = '';
  if (codigo || link) {
    context =
      `\nVi que você veio pelo ${codigo ? `imóvel *${codigo}*` : 'link do imóvel'}` +
      (link ? `: ${link}` : '') +
      '.\n';
  }
  return (
    `Olá! Seja bem-vindo(a) à *${companyName}*. 🏡` +
    context +
    `\nVou te atender por aqui de forma rápida.`
  );
}

function buildContactConfirmationPrompt(session: WhatsAppChatSession): string {
  const nome = suggestedDisplayName(session) || 'seu nome';
  const hasPhone = isValidPhoneNumber(session.phone);
  const tel = hasPhone ? formatPhoneForDisplay(session.phone) : 'seu WhatsApp';
  if (!suggestedDisplayName(session) && !hasPhone) {
    return (
      `Para seguirmos, me confirma seu *nome completo* e *WhatsApp com DDD*?\n` +
      `Pode responder com o nome e o número, ou diga *SIM* se os dados estiverem corretos.`
    );
  }
  if (!suggestedDisplayName(session)) {
    return (
      `Confirma seus dados?\n` +
      `📱 *Telefone:* ${tel}\n\n` +
      `Responde *SIM* se o telefone está certo, ou me envia seu *nome completo* (e corrija o telefone se precisar).`
    );
  }
  if (!hasPhone) {
    return (
      `Confirma seus dados?\n` +
      `👤 *Nome:* ${nome}\n\n` +
      `Responde *SIM* e me informe seu *WhatsApp com DDD*, ou corrija o nome se estiver errado.`
    );
  }
  return (
    `Confirma seus dados?\n` +
    `👤 *${nome}* · 📱 *${tel}*\n\n` +
    `Responde *SIM* ou corrija o nome/telefone.`
  );
}

function buildMenuAfterConfirmation(session: WhatsAppChatSession): string {
  const nome = session.name && session.name !== 'Cliente' ? session.name : 'tudo certo';
  const codigo = session.extractedLead.codigoImovel;
  const link = session.extractedLead.linkImovel;
  const imovelNotif = codigo
    ? `\nVocê demonstrou interesse no imóvel *${codigo}*${link ? ` (${link})` : ''}.\n`
    : link
    ? `\nVocê demonstrou interesse neste imóvel: ${link}.\n`
    : '';
  return (
    `Perfeito, *${nome}*! Contato confirmado.${imovelNotif}\n` +
    `Como prefere continuar?\n\n` +
    `1️⃣ Aguardar o contato do consultor\n` +
    `2️⃣ Conhecer lançamentos na planta\n` +
    `3️⃣ Buscar imóveis prontos para comprar ou alugar\n` +
    `4️⃣ Tirar uma dúvida agora\n\n` +
    `Responda com o número da opção ou escreva o que deseja.`
  );
}

/**
 * Applies a typed full name from user messages — always overwrites pushName/unconfirmed name.
 * Skips phone-only and greeting-only messages.
 */
function applyTypedNameFromMessages(session: WhatsAppChatSession, userMessages: Array<{ content: string }>): boolean {
  let applied = false;
  for (const m of userMessages) {
    const clean = m.content.trim().split('\n')[0].replace(/[!.,?]/g, '').trim();
    if (!looksLikeTypedFullName(clean)) continue;
    // Prefer multi-word names when overwriting an existing suggested pushName
    const words = clean.split(/\s+/).filter(Boolean);
    const currentIsConfirmed = Boolean(session.extractedLead.nameConfirmed);
    if (currentIsConfirmed && words.length === 1 && (session.name || '').split(/\s+/).length >= 2) {
      continue;
    }
    session.name = clean;
    session.extractedLead.nome = clean;
    applied = true;
  }
  return applied;
}

/**
 * Handles early name/phone confirmation gate. Returns reply text if this turn
 * should short-circuit before menu/AI trail; otherwise null.
 */
function processContactConfirmationGate(
  session: WhatsAppChatSession,
  messageText: string,
  companyName: string
): string | null {
  if (hasConfirmedContact(session)) {
    session.awaitingContactConfirmation = false;
    return null;
  }

  const last = (messageText || '').trim();

  // Phone typed in this message
  const detectedPhone = extractPhoneFromText(last);
  if (detectedPhone && isValidPhoneNumber(detectedPhone)) {
    session.phone = detectedPhone;
    session.extractedLead.telefone = formatPhoneForDisplay(detectedPhone);
  }

  // Typed name always preferred over pushName
  if (looksLikeTypedFullName(last) && !isPhoneOnlyMessage(last)) {
    session.name = last.trim().split('\n')[0].replace(/[!.,?]/g, '').trim();
    session.extractedLead.nome = session.name;
  }

  // Seed display name from pushName for the prompt only (not confirmed)
  if ((!session.name || session.name === 'Cliente') && session.pushName && session.pushName !== 'Cliente') {
    session.name = session.pushName;
    session.extractedLead.nome = session.pushName;
  }

  const hasPhone = isValidPhoneNumber(session.phone);
  const hasNameHint = Boolean(suggestedDisplayName(session));

  // Affirmative confirmation
  if (isContactConfirmationReply(last) && hasPhone && hasNameHint) {
    session.extractedLead.nameConfirmed = true;
    session.extractedLead.phoneConfirmed = true;
    session.extractedLead.dadosNaoConfirmados = false;
    session.awaitingContactConfirmation = false;
    session.contactConfirmationAsked = true;
    session.extractedLead.estadoAtendimento = 'menu_inicial';
    if (!session.extractedLead.trilhaNavegacao.includes('Contato confirmado (nome + telefone)')) {
      session.extractedLead.trilhaNavegacao.push('Contato confirmado (nome + telefone)');
    }
    return buildMenuAfterConfirmation(session);
  }

  // User sent a clear full name + we already have phone → treat as correction/confirm
  if (looksLikeTypedFullName(last) && hasPhone && !isContactConfirmationReply(last) && session.contactConfirmationAsked) {
    session.extractedLead.nameConfirmed = true;
    session.extractedLead.phoneConfirmed = true;
    session.extractedLead.dadosNaoConfirmados = false;
    session.awaitingContactConfirmation = false;
    session.extractedLead.estadoAtendimento = 'menu_inicial';
    if (!session.extractedLead.trilhaNavegacao.includes('Nome corrigido e confirmado pelo cliente')) {
      session.extractedLead.trilhaNavegacao.push('Nome corrigido e confirmado pelo cliente');
    }
    return buildMenuAfterConfirmation(session);
  }

  // First turn of cycle: welcome + confirmation in one reply
  if (!session.contactConfirmationAsked) {
    session.awaitingContactConfirmation = true;
    session.contactConfirmationAsked = true;
    session.extractedLead.estadoAtendimento = 'confirmacao_contato';
    const welcome = buildWelcomeMessage(session, companyName);
    const confirm = buildContactConfirmationPrompt(session);
    return `${welcome}\n\n${confirm}`;
  }

  // Still awaiting — re-prompt confirmation (do not open menu)
  session.awaitingContactConfirmation = true;
  return buildContactConfirmationPrompt(session);
}

function isExplicitCloseRequest(msg: string): boolean {
  const t = (msg || '').toLowerCase().trim();
  if (t === '1' || t === '1️⃣' || t === '5' || t === '6') return true;
  if (
    /^(op[çc][ãa]o\s*1|1\s*[-–.]?\s*aguard(ar|o)|1\s*[-–.]?\s*contato|aguard(o|ar)(\s+o?\s*(contato|retorno))?|s[oó] isso|pode chamar(\s+o?\s*(corretor|consultor))?|valeu|obrigad[oa])\.?$/i.test(
      t
    )
  ) {
    return true;
  }
  if (
    /(falar\s+com\s+(uma?\s+)?(corretor|consultor|atendente|humano|pessoa)|passa\s+pro?\s+(corretor|consultor|atendente|humano)|quero\s+(um\s+)?(corretor|consultor|humano)|transferir\s+para\s+(corretor|consultor)|atendimento\s+humano|pessoa\s+de\s+verdade|pode\s+me\s+ligar|me\s+chama\s+no\s+zap)/i.test(
      t
    )
  ) {
    return true;
  }
  return false;
}

export function extractPropertyCodeAndLink(text: string): { code?: string; link?: string } {
  if (!text) return {};
  let link: string | undefined;
  let code: string | undefined;

  const linkMatch = text.match(/https?:\/\/[^\s]+|(?:www\.)[^\s]+|directhouses\.com\.br\/[^\s]+/i);
  if (linkMatch) {
    link = linkMatch[0].replace(/[.,!?;:)]$/, '');
  }

  const codeMatch = text.match(/\b(?:c[oó]d(?:igo)?\.?|ref\.?|im[oó]vel|an[úu]ncio)\s*[:#]?\s*([A-Za-z0-9_-]{2,15})\b/i);
  if (codeMatch) {
    code = codeMatch[1].toUpperCase();
  } else {
    const directCodeMatch = text.match(/\b(DH-?\d{2,8})\b/i);
    if (directCodeMatch) {
      code = directCodeMatch[1].toUpperCase();
    }
  }

  return { code, link };
}

export function classifyIntent(text: string): 'aguardar_corretor' | 'lancamentos_na_planta' | 'imoveis_prontos' | 'duvida' | 'atendimento_humano' | null {
  const t = (text || '').toLowerCase().trim();

  // Atendimento humano
  if (
    /(falar\s+com\s+(uma?\s+)?(pessoa|humano|atendente|corretor|consultor)|atendente\s+humano|quero\s+(um\s+)?humano|passa\s+pro?\s+(atendente|humano|corretor)|pessoa\s+de\s+verdade)/i.test(t) ||
    t === '5'
  ) {
    return 'atendimento_humano';
  }

  // Aguardar corretor
  if (
    t === '1' ||
    /^(1|aguard(o|ar)(\s+o?\s*contato)?|pode\s+pedir\s+para\s+o\s+corretor\s+me\s+chamar|s[oó] isso|pode\s+chamar|valeu|obrigad[oa])\.?$/i.test(t) ||
    /aguard(ar|o)\s+(o\s+)?(contato|consultor|corretor)/i.test(t)
  ) {
    return 'aguardar_corretor';
  }

  // Lançamentos na planta
  if (
    t === '2' ||
    /\b(lan[çc]amento(s)?|na\s+planta|em\s+constru[çc][ãa]o|apartamento(s)?\s+novo(s)?|novos)\b/i.test(t) ||
    /conhecer\s+lan[çc]amentos/i.test(t)
  ) {
    return 'lancamentos_na_planta';
  }

  // Imóveis prontos
  if (
    t === '3' ||
    /\b(im[oó]ve(l|is)\s+pronto(s)?|comprar|alugar|procurando\s+(uma?\s+)?casa|apartamento\s+pronto|buscar\s+im[oó]veis)\b/i.test(t)
  ) {
    return 'imoveis_prontos';
  }

  // Dúvida
  if (
    t === '4' ||
    /^(4|d[uú]vida|tirar\s+uma?\s+d[uú]vida|pergunt(a|ar)|aceita\s+financiamento|informa[çc][õo]es)\b/i.test(t) ||
    (t.endsWith('?') && t.length > 5)
  ) {
    return 'duvida';
  }

  return null;
}

export function extractCollectedInfo(
  text: string,
  currentInfo: {
    finalidade?: string;
    regiao?: string;
    tipoImovel?: string;
    faixaValor?: string;
    quantidadeQuartos?: string;
    formaPagamento?: string;
    duvidaTexto?: string;
  } = {}
) {
  const t = (text || '').trim();
  const lower = t.toLowerCase();
  const updated = { ...currentInfo };

  // 1. Finalidade
  if (!updated.finalidade) {
    if (/\b(morar|moradia|residir|resid[êe]ncia)\b/i.test(lower)) {
      updated.finalidade = 'morar';
    } else if (/\b(investir|investimento|rentabilidade|renda|loca[çc][ãa]o\s+por\s+temporada|airbnb)\b/i.test(lower)) {
      updated.finalidade = 'investir';
    } else if (/\b(comprar|compra|aquisi[çc][ãa]o)\b/i.test(lower)) {
      updated.finalidade = 'comprar';
    } else if (/\b(alugar|loca[çc][ãa]o|aluguel)\b/i.test(lower)) {
      updated.finalidade = 'alugar';
    } else if (/\b(avaliando|ainda\s+n[ãa]o\s+decidi|n[ãa]o\s+sei|indeciso)\b/i.test(lower)) {
      updated.finalidade = 'ainda não decidiu';
    }
  }

  // 2. Tipo de imóvel
  if (!updated.tipoImovel) {
    if (/\b(apartamento|apto|flat|studio|est[úu]dio)\b/i.test(lower)) {
      updated.tipoImovel = 'apartamento';
    } else if (/\b(casa|sobrado|mans[ãa]o)\b/i.test(lower)) {
      updated.tipoImovel = 'casa';
    } else if (/\b(cobertura)\b/i.test(lower)) {
      updated.tipoImovel = 'cobertura';
    } else if (/\b(sala|loja|comercial|escrit[oó]rio)\b/i.test(lower)) {
      updated.tipoImovel = 'sala ou loja comercial';
    } else if (/\b(terreno|lote)\b/i.test(lower)) {
      updated.tipoImovel = 'terreno';
    }
  }

  // 3. Região / Bairro
  if (!updated.regiao) {
    const bairrosConhecidos = [
      'barra da tijuca', 'barra', 'recreio dos bandeirantes', 'recreio', 'jacarepaguá', 'jacarepagua',
      'botafogo', 'ipanema', 'leblon', 'copacabana', 'flamengo', 'laranjeiras', 'humaitá', 'humaita',
      'tijuca', 'maracanã', 'maracana', 'vila isabel', 'grajaú', 'grajau', 'lagoa', 'gávea', 'gavea',
      'niterói', 'niteroi', 'icarai', 'icaraí', 'centro', 'zona sul', 'zona oeste', 'zona norte'
    ];
    for (const b of bairrosConhecidos) {
      if (lower.includes(b)) {
        updated.regiao = b.charAt(0).toUpperCase() + b.slice(1);
        break;
      }
    }
    if (!updated.regiao) {
      const regMatch = lower.match(/\b(?:em|na|no|para)\s+([a-záàâãéèêíïóôõöúçñ\s]{3,25})\b/i);
      if (regMatch && !/(morar|investir|comprar|alugar|apartamento|casa)/i.test(regMatch[1])) {
        updated.regiao = regMatch[1].trim();
      }
    }
  }

  // 4. Quantidade de quartos / tamanho
  if (!updated.quantidadeQuartos) {
    if (/\b(1|um)\s*quarto(s)?\b/i.test(lower) || /\b(studio|est[úu]dio)\b/i.test(lower)) {
      updated.quantidadeQuartos = '1 quarto';
    } else if (/\b(2|dois)\s*quarto(s)?\b/i.test(lower)) {
      updated.quantidadeQuartos = '2 quartos';
    } else if (/\b(3|tr[êe]s)\s*quarto(s)?\b/i.test(lower)) {
      updated.quantidadeQuartos = '3 quartos';
    } else if (/\b(4|quatro|5|cinco)\s*quarto(s)?\b/i.test(lower) || /4\s*ou\s*mais/i.test(lower)) {
      updated.quantidadeQuartos = '4 ou mais quartos';
    } else if (/\b(ainda\s+n[ãa]o\s+defini|n[ãa]o\s+sei|indiferente)\b/i.test(lower)) {
      updated.quantidadeQuartos = 'Ainda não defini';
    }
  }

  // 5. Faixa de valor
  if (!updated.faixaValor) {
    if (/at[eé]\s*(r\$)?\s*300\s*(mil)?/i.test(lower)) {
      updated.faixaValor = 'Até R$ 300 mil';
    } else if (/300\s*(mil)?\s*a\s*500\s*(mil)?/i.test(lower)) {
      updated.faixaValor = 'De R$ 300 mil a R$ 500 mil';
    } else if (/500\s*(mil)?\s*a\s*800\s*(mil)?/i.test(lower)) {
      updated.faixaValor = 'De R$ 500 mil a R$ 800 mil';
    } else if (/acima\s*de\s*(r\$)?\s*800\s*(mil)?/i.test(lower)) {
      updated.faixaValor = 'Acima de R$ 800 mil';
    } else if (/\b(ainda\s+n[ãa]o\s+defini|a\s+definir|sob\s+consulta)\b/i.test(lower)) {
      updated.faixaValor = 'Ainda não defini';
    } else {
      const valMatch = t.match(/(?:at[eé]|faixa|de|em\s*torno\s*de|r\$)\s*([0-9.,]+(?:\s*(?:mil|milh[õo]es|k))?)/i);
      if (valMatch && valMatch[1].length >= 2) {
        updated.faixaValor = valMatch[0].trim();
      }
    }
  }

  // 6. Forma de pagamento
  if (!updated.formaPagamento) {
    if (/\b([àa]\s*vista|recursos\s*pr[oó]prios)\b/i.test(lower)) {
      updated.formaPagamento = 'à vista';
    } else if (/\b(financiar|financiamento|financiado|banco|caixa|parcel(ar|ado|amento))\b/i.test(lower)) {
      updated.formaPagamento = 'financiar';
    } else if (/\b(ainda\s+n[ãa]o\s+decidi|avaliando)\b/i.test(lower)) {
      updated.formaPagamento = 'ainda não decidiu';
    }
  }

  return updated;
}

function buildSystemPrompt(session: WhatsAppChatSession, companyName: string = 'Direct Houses'): string {
  const nomeCliente = session.name && session.name !== 'Cliente' && !isGreetingOnly(session.name) ? session.name : 'Cliente';
  const hasValidPhone = isValidPhoneNumber(session.phone);
  const telefoneCliente = hasValidPhone ? formatPhoneForDisplay(session.phone) : 'Pendente de validação';

  const codigoImovel = session.extractedLead.codigoImovel || session.extractedLead.selectedLancamentoNome || 'Não informado';
  const linkImovel = session.extractedLead.linkImovel || 'Link não informado';
  const intencaoAtual = session.extractedLead.intencaoAtual || 'Pendente de identificação';
  const estadoAtendimento = session.extractedLead.estadoAtendimento || 'cadastro';
  const info = session.extractedLead.informacoesColetadas || {};

  const infoList: string[] = [];
  if (info.finalidade) infoList.push(`Finalidade: ${info.finalidade}`);
  if (info.regiao) infoList.push(`Região: ${info.regiao}`);
  if (info.tipoImovel) infoList.push(`Tipo de Imóvel: ${info.tipoImovel}`);
  if (info.quantidadeQuartos) infoList.push(`Quartos/Tamanho: ${info.quantidadeQuartos}`);
  if (info.faixaValor) infoList.push(`Faixa de Valor: ${info.faixaValor}`);
  if (info.formaPagamento) infoList.push(`Forma de Pagamento: ${info.formaPagamento}`);
  if (info.duvidaTexto) infoList.push(`Dúvida Registrada: ${info.duvidaTexto}`);
  const informacoesColetadas = infoList.length > 0 ? infoList.join(' | ') : 'Nenhuma informação específica fornecida ainda';

  const lancamentosCatalogo = formatLancamentosForPrompt();

  return `Você é a assistente virtual da ${companyName}, especializada em atendimento imobiliário.

Seu objetivo é conduzir o cliente de forma objetiva, organizada e comercial, sem se perder, sem repetir perguntas e sem inventar informações.

## REGRAS GERAIS

1. Faça somente uma pergunta principal por mensagem.
2. Nunca repita uma pergunta que o cliente já respondeu.
3. Aproveite todas as informações fornecidas pelo cliente, mesmo quando ele responder várias coisas de uma vez.
4. Aceite respostas por número, texto livre ou frases incompletas.
5. Não obrigue o cliente a responder exatamente no formato das opções.
6. Confirme brevemente o que entendeu antes de fazer a próxima pergunta.
7. Mantenha o imóvel de origem vinculado ao atendimento.
8. Não misture o imóvel de origem com uma nova busca sem confirmar a intenção do cliente.
9. Não invente preço, disponibilidade, metragem, localização, condições de financiamento ou características de imóveis.
10. Quando não tiver certeza, informe que a confirmação será feita por um consultor.
11. Depois de duas tentativas sem entender a resposta, ofereça atendimento humano.
12. Não faça um interrogatório. Colete apenas as informações necessárias para o próximo passo.
13. Se o cliente mudar de assunto, identifique a nova intenção e conduza o fluxo correspondente.
14. Se o cliente fornecer todas as informações necessárias, não continue fazendo perguntas desnecessárias.

## DADOS DO ATENDIMENTO

Variáveis atuais do cliente (preserve e utilize):
- Nome do cliente: {{nome_cliente}} = "${nomeCliente}"
- Telefone: {{telefone_cliente}} = "${telefoneCliente}"
- Código do imóvel de origem: {{codigo_imovel}} = "${codigoImovel}"
- Link do imóvel de origem: {{link_imovel}} = "${linkImovel}"
- Intenção atual: {{intencao_atual}} = "${intencaoAtual}"
- Informações já fornecidas: {{informacoes_coletadas}} = "${informacoesColetadas}"
- Estado do atendimento: {{estado_atendimento}} = "${estadoAtendimento}"

## ETAPA DE CADASTRO INICIAL (NOME E TELEFONE)
- O sistema já realiza a confirmação antecipada de nome (pushName) + telefone do WhatsApp.
- Se nameConfirmed e phoneConfirmed já estiverem verdadeiros, NÃO peça nome/telefone de novo.
- NUNCA trate o pushName do WhatsApp como nome confirmado sem a etapa de confirmação.
- Só apresente o menu (opções 1–4) DEPOIS da confirmação de nome e telefone.
- Se o cliente corrigir o nome, sobrescreva imediatamente.

## PRIMEIRA MENSAGEM APÓS O CADASTRO
Assim que o contato estiver cadastrado (nome e telefone conhecidos) e nenhuma opção de menu foi escolhida ainda, envie:

"Perfeito, ${nomeCliente}! Seu contato foi registrado com sucesso.
${codigoImovel !== 'Não informado' ? `\nVocê demonstrou interesse no imóvel ${codigoImovel}${linkImovel !== 'Link não informado' ? `, enviado neste link: ${linkImovel}` : ''}.\n` : ''}
Como prefere continuar?

1️⃣ Aguardar o contato do consultor
2️⃣ Conhecer lançamentos na planta
3️⃣ Buscar imóveis prontos para comprar ou alugar
4️⃣ Tirar uma dúvida agora

Responda com o número da opção ou escreva diretamente o que você deseja."

## IDENTIFICAÇÃO DA INTENÇÃO
Classifique a resposta do cliente em uma destas intenções:
- aguardar_corretor
- lancamentos_na_planta
- imoveis_prontos
- duvida
- atendimento_humano

Interprete também frases como:
- "Pode pedir para o corretor me chamar" = aguardar_corretor
- "Quero ver apartamentos novos" = lancamentos_na_planta
- "Estou procurando uma casa para comprar" = imoveis_prontos
- "Esse imóvel aceita financiamento?" = duvida
- "Quero falar com uma pessoa" = atendimento_humano

Se houver dúvida sobre a intenção, faça apenas uma pergunta de esclarecimento.

## FLUXO 1 — AGUARDAR O CORRETOR
Se o cliente escolher essa opção, responda:
"Perfeito, ${nomeCliente}. Seu interesse no imóvel ${codigoImovel !== 'Não informado' ? codigoImovel : 'de interesse'} já foi encaminhado ao consultor responsável.

Ele continuará o atendimento e poderá informar os próximos passos. Se precisar de algo, você também pode enviar uma mensagem por aqui."

Depois disso:
- Defina o estado como aguardando_corretor.
- Não apresente novamente o menu imediatamente.
- Não faça novas perguntas.
- Não prometa prazo de contato, salvo se houver um prazo definido pelo sistema.

## FLUXO 2 — LANÇAMENTOS NA PLANTA
Colete as informações uma por vez, nesta ordem:
1. Finalidade (se ainda não informou):
   - morar
   - investir
   - ainda não decidiu
   Pergunte: "Ótimo! Você procura um lançamento na planta para morar, investir ou ainda está avaliando?"

2. Região (se ainda não informou):
   "Em qual cidade ou região você gostaria de encontrar o lançamento?"

3. Faixa de valor (se ainda não informou):
   "Qual faixa de valor você pretende considerar?"
   Opções sugeridas:
   - Até R$ 300 mil
   - De R$ 300 mil a R$ 500 mil
   - De R$ 500 mil a R$ 800 mil
   - Acima de R$ 800 mil
   - Ainda não defini

4. Quantidade de quartos (se ainda não informou):
   "Você procura um imóvel com quantos quartos?"
   Opções sugeridas:
   - 1 quarto
   - 2 quartos
   - 3 quartos
   - 4 ou mais quartos
   - Ainda não defini

5. Forma de pagamento, somente se necessário:
   "Você pretende comprar à vista, financiar ou ainda não decidiu?"

Quando tiver informações suficientes, diga:
"Entendi. Você procura um imóvel para {{finalidade}}, em {{regiao}}, com {{quantidade_quartos}} quartos e na faixa de {{faixa_valor}}. Vou verificar as opções compatíveis para esse perfil."
E em seguida, apresente os lançamentos autorizados do catálogo abaixo que melhor combinam com essa busca.
Não repita perguntas já respondidas.

## FLUXO 3 — IMÓVEIS PRONTOS
Colete as informações uma por vez, nesta ordem:
1. Finalidade (se ainda não informou):
   "Você procura um imóvel pronto para comprar ou alugar?" (Comprar | Alugar | Ainda não decidi)

2. Região (se ainda não informou):
   "Em qual cidade ou região você deseja procurar?"

3. Tipo de imóvel (se ainda não informou):
   "Qual tipo de imóvel você procura?" (Apartamento | Casa | Sala ou loja comercial | Terreno | Outro)

4. Quartos ou tamanho (se ainda não informou):
   "Você precisa de quantos quartos ou qual tamanho aproximado?"

5. Faixa de valor (se ainda não informou):
   "Qual faixa de valor pretende considerar?"

Quando tiver informações suficientes, confirme:
"Entendi. Você procura {{tipo_imovel}} para {{finalidade}}, em {{regiao}}, com a necessidade de {{quartos_ou_tamanho}}, na faixa de {{faixa_valor}}."
Depois, informe que as opções compatíveis serão verificadas e encaminhadas por nossos consultores.

## FLUXO 4 — TIRAR UMA DÚVIDA
Responda:
"Claro. Escreva sua dúvida em uma única mensagem. Posso ajudar com informações sobre o imóvel, localização, documentação, financiamento, valores ou processo de compra e aluguel."

Ao receber a dúvida:
1. Responda somente o que puder afirmar com segurança com base no catálogo autorizado.
2. Não invente dados comerciais.
3. Se depender de confirmação, diga claramente que será necessário consultar o corretor.
4. Mantenha o imóvel ${codigoImovel !== 'Não informado' ? codigoImovel : 'de interesse'} como referência, salvo se o cliente indicar outro imóvel.
5. Se a dúvida exigir análise jurídica, documental ou financeira específica, encaminhe para um consultor.

## FLUXO 5 — ATENDIMENTO HUMANO
Se o cliente pedir uma pessoa, corretor ou consultor, responda:
"Claro. Vou encaminhar seu atendimento para um consultor da ${companyName}. Ele continuará o contato com você e terá acesso às informações já registradas."

Depois:
- Defina o estado como atendimento_humano.
- Não faça novas perguntas.
- Não reinicie o fluxo.
- Preserve todas as informações já coletadas.

## CORREÇÃO DE RESPOSTAS
Se o cliente responder algo incompleto, não reinicie o atendimento. Confirme brevemente e faça apenas a próxima pergunta pendente.
Se o cliente responder várias informações juntas em uma frase, registre todas e faça apenas a pergunta que ainda seja necessária.

## TOM DE VOZ
- profissional;
- direto;
- cordial;
- comercial;
- empático;
- organizado.
Evite: textos longos; excesso de emojis; repetir o menu; fazer quatro ou cinco perguntas na mesma mensagem; promessas que não possam ser cumpridas; respostas genéricas; inventar informações sobre imóveis.

BASE DE CONHECIMENTO DE LANÇAMENTOS AUTORIZADA DA ${companyName}:
${lancamentosCatalogo}`;
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
  // Extract phone number from all user messages (capture only — confirm in gate)
  for (const m of userMsgs) {
    const detectedPhone = extractPhoneFromText(m.content);
    if (detectedPhone && isValidPhoneNumber(detectedPhone)) {
      session.phone = detectedPhone;
      session.extractedLead.telefone = formatPhoneForDisplay(detectedPhone);
    }
  }

  // Extract name if available — typed full names always overwrite pushName / unconfirmed name
  applyTypedNameFromMessages(session, userMsgs);
  if (
    (!session.name || session.name === 'Cliente' || isGreetingOnly(session.name)) &&
    session.pushName &&
    session.pushName !== 'Cliente'
  ) {
    session.name = session.pushName;
    session.extractedLead.nome = session.pushName;
  }

  const hasValidPhone = isValidPhoneNumber(session.phone);
  const displayPhone = hasValidPhone ? formatPhoneForDisplay(session.phone) : '';
  const hasName = Boolean(session.name && session.name !== 'Cliente' && !isGreetingOnly(session.name));

  // Early gate: confirm name + phone before menu / trail
  if (!hasConfirmedContact(session)) {
    const gateReply = processContactConfirmationGate(session, lastUserMsg, companyName);
    if (gateReply) return gateReply;
  }

  // 1. If no valid phone after confirmation path quirks, ask for phone
  const isHumanReq = isExplicitCloseRequest(lowerLastMsg) || lowerLastMsg === '5' || lowerLastMsg === '6';
  if (!hasValidPhone) {
    if (isHumanReq) {
      return (
        `Com certeza${hasName ? `, *${session.name}*` : ''}! 😊\n\n` +
        `Para que eu possa transferir seu atendimento para o consultor especialista da ${companyName}, qual é o seu *número de WhatsApp com DDD*? (ex: 21 99999-9999)`
      );
    }
    return (
      `Olá${hasName ? `, *${session.name}*` : ''}! Seja muito bem-vindo(a) à ${companyName}. 🏡\n\n` +
      `Para começarmos o seu atendimento exclusivo e passarmos todos os detalhes dos imóveis, qual é o seu *número de WhatsApp com DDD*? (ex: 21 99999-9999)`
    );
  }

  // 2. Name check: if phone is known but name is not
  if (!hasName) {
    return (
      `Olá! Seja muito bem-vindo(a) à ${companyName}. 🏡\n\n` +
      `Identifiquei seu WhatsApp como *${displayPhone}*.\n` +
      `Para começarmos, qual é o seu *nome completo*?`
    );
  }

  // Ensure extracted property code & link are up to date
  const propInfo = extractPropertyCodeAndLink(session.initialMessage + ' ' + lastUserMsg);
  if (propInfo.code && !session.extractedLead.codigoImovel) session.extractedLead.codigoImovel = propInfo.code;
  if (propInfo.link && !session.extractedLead.linkImovel) session.extractedLead.linkImovel = propInfo.link;

  const codigoImovel = session.extractedLead.codigoImovel || session.extractedLead.selectedLancamentoNome || 'Não informado';
  const linkImovel = session.extractedLead.linkImovel || 'Link não informado';

  // Extract ongoing collected information
  session.extractedLead.informacoesColetadas = extractCollectedInfo(lastUserMsg, session.extractedLead.informacoesColetadas);
  const info = session.extractedLead.informacoesColetadas || {};

  // Check intent detection
  const detectedIntent = classifyIntent(lastUserMsg);
  if (detectedIntent) {
    session.extractedLead.intencaoAtual = detectedIntent;
  }

  const currentIntent = session.extractedLead.intencaoAtual;

  // 3. Hand off to human (FLUXO 5)
  if (currentIntent === 'atendimento_humano' || isHumanReq) {
    session.extractedLead.intencaoAtual = 'atendimento_humano';
    session.extractedLead.estadoAtendimento = 'atendimento_humano';
    session.extractedLead.tipoAtendimento = 'Atendimento Humano';
    session.extractedLead.isComplete = true;
    session.extractedLead.humanRequested = true;
    return `Claro. Vou encaminhar seu atendimento para um consultor da ${companyName}. Ele continuará o contato com você e terá acesso às informações já registradas.`;
  }

  // 4. Aguardar corretor (FLUXO 1)
  if (currentIntent === 'aguardar_corretor') {
    session.extractedLead.intencaoAtual = 'aguardar_corretor';
    session.extractedLead.estadoAtendimento = 'aguardando_corretor';
    session.extractedLead.tipoAtendimento = 'Aguardando contato do corretor';
    session.extractedLead.isComplete = true;
    session.extractedLead.humanRequested = true;
    return (
      `Perfeito, ${session.name}. Seu interesse no imóvel ${codigoImovel !== 'Não informado' ? codigoImovel : 'de interesse'} já foi encaminhado ao consultor responsável.\n\n` +
      `Ele continuará o atendimento e poderá informar os próximos passos. Se precisar de algo, você também pode enviar uma mensagem por aqui.`
    );
  }

  // 5. Lançamentos na Planta (FLUXO 2)
  if (currentIntent === 'lancamentos_na_planta') {
    session.extractedLead.estadoAtendimento = 'coletando_lancamento';
    session.extractedLead.tipoAtendimento = 'Lançamento na Planta';

    if (!info.finalidade) {
      return `Ótimo! Você procura um lançamento na planta para morar, investir ou ainda está avaliando?`;
    }
    if (!info.regiao) {
      return `Em qual cidade ou região você gostaria de encontrar o lançamento?`;
    }
    if (!info.faixaValor) {
      return (
        `Qual faixa de valor você pretende considerar?\n\n` +
        `• Até R$ 300 mil\n` +
        `• De R$ 300 mil a R$ 500 mil\n` +
        `• De R$ 500 mil a R$ 800 mil\n` +
        `• Acima de R$ 800 mil\n` +
        `• Ainda não defini`
      );
    }
    if (!info.quantidadeQuartos) {
      return (
        `Você procura um imóvel com quantos quartos?\n\n` +
        `• 1 quarto\n` +
        `• 2 quartos\n` +
        `• 3 quartos\n` +
        `• 4 ou mais quartos\n` +
        `• Ainda não defini`
      );
    }
    if (!info.formaPagamento && userMsgs.length < 5) {
      return `Você pretende comprar à vista, financiar ou ainda não decidiu?`;
    }

    session.extractedLead.isComplete = true;
    session.extractedLead.estadoAtendimento = 'lancamentos_concluido';
    const lancList = activeLanc.map((l, i) => `${i + 1}️⃣ *${l.nome}* (${l.bairro}) - ${l.tipologias}`).join('\n');
    return (
      `Entendi. Você procura um imóvel para ${info.finalidade || 'morar ou investir'}, em ${info.regiao || 'região de preferência'}, com ${info.quantidadeQuartos || 'quartos a definir'} e na faixa de ${info.faixaValor || 'valor a combinar'}. Vou verificar as opções compatíveis para esse perfil.\n\n` +
      `Temos opções autorizadas de lançamentos que podem te interessar:\n\n` +
      `${lancList}\n\n` +
      `Qual desses empreendimentos gostaria de conhecer melhor ou prefere que nosso consultor envie a apresentação completa?`
    );
  }

  // 6. Imóveis Prontos (FLUXO 3)
  if (currentIntent === 'imoveis_prontos') {
    session.extractedLead.estadoAtendimento = 'coletando_prontos';
    session.extractedLead.tipoAtendimento = 'Imóveis Prontos';

    if (!info.finalidade) {
      return (
        `Você procura um imóvel pronto para comprar ou alugar?\n\n` +
        `• Comprar\n` +
        `• Alugar\n` +
        `• Ainda não decidi`
      );
    }
    if (!info.regiao) {
      return `Em qual cidade ou região você deseja procurar?`;
    }
    if (!info.tipoImovel) {
      return (
        `Qual tipo de imóvel você procura?\n\n` +
        `• Apartamento\n` +
        `• Casa\n` +
        `• Sala ou loja comercial\n` +
        `• Terreno\n` +
        `• Outro`
      );
    }
    if (!info.quantidadeQuartos) {
      return `Você precisa de quantos quartos ou qual tamanho aproximado?`;
    }
    if (!info.faixaValor) {
      return `Qual faixa de valor pretende considerar?`;
    }

    session.extractedLead.isComplete = true;
    session.extractedLead.estadoAtendimento = 'prontos_concluido';
    return (
      `Entendi. Você procura ${info.tipoImovel || 'imóvel pronto'} para ${info.finalidade || 'comprar ou alugar'}, em ${info.regiao || 'região informada'}, com a necessidade de ${info.quantidadeQuartos || 'tamanho adequado'}, na faixa de ${info.faixaValor || 'valor informado'}.\n\n` +
      `Vou verificar as opções compatíveis para esse perfil e nosso consultor entrará em contato em instantes com a seleção ideal para você.`
    );
  }

  // 7. Tirar uma Dúvida (FLUXO 4)
  if (currentIntent === 'duvida') {
    session.extractedLead.estadoAtendimento = 'respondendo_duvida';
    session.extractedLead.tipoAtendimento = 'Dúvidas sobre Imóvel';

    const isJustOption4 = /^(4|d[uú]vida|tirar\s+uma?\s+d[uú]vida)$/i.test(lastUserMsg);
    if (isJustOption4 && !info.duvidaTexto) {
      return `Claro, ${session.name}! Qual é a sua dúvida sobre o imóvel ou sobre as condições de compra? Pode escrever aqui que te respondo na hora. 😊`;
    }

    const matchedLanc = activeLanc.find(
      (l) =>
        lowerLastMsg.includes(l.nome.toLowerCase()) ||
        (codigoImovel !== 'Não informado' && l.nome.toLowerCase().includes(codigoImovel.toLowerCase()))
    );

    if (matchedLanc) {
      if (/pre[çc]o|valor|quanto\s+custa|tabela|entrada/i.test(lowerLastMsg)) {
        return `O *${matchedLanc.nome}* possui unidades a partir de *${matchedLanc.precoAPartirDe || 'sob consulta'}* com tipologias ${matchedLanc.tipologias}. Condições: ${matchedLanc.condicoesComerciais || 'Consulte nosso corretor'}.\n\nGostaria de ver as fotos e plantas ou prefere agendar uma apresentação?`;
      }
      if (/onde\s+fica|localiza[çc][ãa]o|bairro|endere[çc]o/i.test(lowerLastMsg)) {
        return `O *${matchedLanc.nome}* fica localizado na região nobre de *${matchedLanc.bairro}* (${matchedLanc.localidade || matchedLanc.cidade}).\n\nDeseja receber os detalhes das unidades disponíveis?`;
      }
      if (/lazer|diferencia(l|is)|piscina|academia|vaga/i.test(lowerLastMsg)) {
        return `Os principais diferenciais do *${matchedLanc.nome}* são: ${matchedLanc.diferenciais}.\n\nQuer que eu te envie as fotos das áreas comuns?`;
      }
    }

    info.duvidaTexto = lastUserMsg;
    session.extractedLead.isComplete = true;
    return (
      `Registrei sua pergunta sobre "${lastUserMsg}".\n\n` +
      `Para te passar todos os detalhes e valores atualizados com precisão, nosso consultor responsável da ${companyName} entrará em contato com você por aqui em instantes!`
    );
  }

  // 8. PRIMEIRA MENSAGEM APÓS O CADASTRO (quando telefone e nome já estão cadastrados, mas sem intenção selecionada)
  session.extractedLead.estadoAtendimento = 'menu_inicial';
  const imovelNotif = codigoImovel !== 'Não informado'
    ? `\n\nVocê demonstrou interesse no imóvel ${codigoImovel}${linkImovel !== 'Link não informado' ? `, enviado neste link: ${linkImovel}` : ''}.`
    : '';

  return (
    `Perfeito, ${session.name}! Seu contato foi registrado com sucesso.${imovelNotif}\n\n` +
    `Como prefere continuar?\n\n` +
    `1️⃣ Aguardar o contato do consultor\n` +
    `2️⃣ Conhecer lançamentos na planta\n` +
    `3️⃣ Buscar imóveis prontos para comprar ou alugar\n` +
    `4️⃣ Tirar uma dúvida agora\n\n` +
    `Responda com o número da opção ou escreva diretamente o que você deseja.`
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

  // 1. Extract phone number from all user messages (capture only — confirm in gate)
  for (const m of userMessages) {
    const detected = extractPhoneFromText(m.content);
    if (detected && isValidPhoneNumber(detected)) {
      session.phone = detected;
      session.extractedLead.telefone = formatPhoneForDisplay(detected);
    }
  }

  // 2. Typed full name always overwrites pushName / unconfirmed name (never phone/greeting-only)
  applyTypedNameFromMessages(session, userMessages);
  if (
    (!session.name || session.name === 'Cliente' || isGreetingOnly(session.name)) &&
    session.pushName &&
    session.pushName !== 'Cliente'
  ) {
    // Hint only — not confirmed until confirmation step
    session.name = session.pushName;
  }
  if (!session.name || isGreetingOnly(session.name)) session.name = 'Cliente';

  let hasValidPhone = isValidPhoneNumber(session.phone);
  const displayPhone = hasValidPhone ? formatPhoneForDisplay(session.phone) : 'Não informado';

  // 3. Detect origin property from initial message if available
  const propInfo = extractPropertyCodeAndLink(session.initialMessage + ' ' + userText);
  if (propInfo.code && !session.extractedLead.codigoImovel) session.extractedLead.codigoImovel = propInfo.code;
  if (propInfo.link && !session.extractedLead.linkImovel) session.extractedLead.linkImovel = propInfo.link;

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
    if (!produto && propInfo.code) {
      produto = `Imóvel Cód. ${propInfo.code}`;
    }
  }

  // Extract info and intent across conversation
  session.extractedLead.informacoesColetadas = extractCollectedInfo(userText, session.extractedLead.informacoesColetadas);
  const detectedIntent = classifyIntent(userText);
  if (detectedIntent && !session.extractedLead.intencaoAtual) {
    session.extractedLead.intencaoAtual = detectedIntent;
  }

  // 4. Detect Tipo de Atendimento & Decisão do Lead
  let tipo = session.extractedLead.tipoAtendimento || '';
  const lastUserMsg = userMessages[userMessages.length - 1]?.content.toLowerCase().trim() || '';

  // Check phone confirmation keywords only when already in confirmation gate
  if (
    hasValidPhone &&
    session.awaitingContactConfirmation &&
    isContactConfirmationReply(lastUserMsg)
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

  // Patch B: isComplete com telefone real + qualquer trilha/intenção concluída
  hasValidPhone = isValidPhoneNumber(session.phone);
  const hasRealName = Boolean(session.name && session.name !== 'Cliente' && !isGreetingOnly(session.name));

  const lastMsg = userMessages[userMessages.length - 1]?.content || '';
  const explicitClose = isExplicitCloseRequest(lastMsg);
  const info = session.extractedLead.informacoesColetadas || {};

  const currentIntent = session.extractedLead.intencaoAtual || detectedIntent;
  const currentEstado = session.extractedLead.estadoAtendimento;

  const isBrokerOrHumanIntent = Boolean(
    currentIntent === 'aguardar_corretor' ||
      currentIntent === 'atendimento_humano' ||
      currentEstado === 'aguardando_corretor' ||
      currentEstado === 'atendimento_humano' ||
      explicitClose ||
      (tipo && (tipo.includes('corretor') || tipo.includes('Humano')))
  );

  const isLancamentosComplete = Boolean(
    currentEstado === 'lancamentos_concluido' ||
      (currentIntent === 'lancamentos_na_planta' &&
        (info.finalidade || info.regiao || session.extractedLead.selectedLancamentoNome))
  );

  const isProntosComplete = Boolean(
    currentEstado === 'prontos_concluido' ||
      (currentIntent === 'imoveis_prontos' && (info.tipoImovel || info.finalidade || info.regiao))
  );

  const isDuvidaComplete = Boolean(
    currentEstado === 'respondendo_duvida' && (info.duvidaTexto || userMessages.length >= 2)
  );

  const isGeneralQualified = Boolean(
    userMessages.length >= 3 &&
      hasRealName &&
      (tipo || session.extractedLead.produtoImovel || session.extractedLead.codigoImovel || session.extractedLead.selectedLancamentoNome)
  );

  const isFullyQualified = Boolean(
    hasValidPhone &&
      hasConfirmedContact(session) &&
      (
        session.extractedLead.isComplete ||
        session.status === 'qualified' ||
        session.status === 'dispatched' ||
        isBrokerOrHumanIntent ||
        isLancamentosComplete ||
        isProntosComplete ||
        isDuvidaComplete ||
        isGeneralQualified
      )
  );

  const humanRequested = isBrokerOrHumanIntent || Boolean(session.extractedLead.humanRequested);

  // Build altered / compact history for broker (only altered/recent messages, avoiding huge payloads)
  const historicoMensagens = getAlteredSessionHistory(session);

  const resumoNavegacao = session.extractedLead.trilhaNavegacao.length > 0
    ? session.extractedLead.trilhaNavegacao.join(' ➔ ')
    : (tipo ? `Interesse em ${tipo}` : 'Atendimento inicial');

  session.extractedLead = {
    nome: session.name && session.name !== 'Cliente' ? session.name : 'Cliente WhatsApp',
    telefone: displayPhone,
    tipoAtendimento: tipo || session.extractedLead.tipoAtendimento || '',
    produtoImovel: produto || session.extractedLead.produtoImovel || 'Imóvel sob consulta',
    codigoImovel: session.extractedLead.codigoImovel || (propInfo.code ? propInfo.code : undefined),
    linkImovel: session.extractedLead.linkImovel || (propInfo.link ? propInfo.link : undefined),
    intencaoAtual: session.extractedLead.intencaoAtual || detectedIntent || undefined,
    estadoAtendimento: session.extractedLead.estadoAtendimento || (isFullyQualified ? 'qualificado' : 'em_atendimento'),
    informacoesColetadas: session.extractedLead.informacoesColetadas || {},
    selectedLancamentoId: selectedLancId || session.extractedLead.selectedLancamentoId,
    selectedLancamentoNome: selectedLancNome || session.extractedLead.selectedLancamentoNome,
    nameConfirmed: session.extractedLead.nameConfirmed || false,
    phoneConfirmed: session.extractedLead.phoneConfirmed || false,
    dadosNaoConfirmados: session.extractedLead.dadosNaoConfirmados || false,
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
    finalStructuredText: `NOVO LEAD DIRECT HOUSES\nNome: ${session.name && session.name !== 'Cliente' ? session.name : 'Cliente WhatsApp'}${session.extractedLead.nameConfirmed ? ' (confirmado)' : ' (não confirmado)'}\nTelefone: ${displayPhone}${session.extractedLead.phoneConfirmed ? ' (confirmado)' : ''}\nCódigo do Imóvel: ${session.extractedLead.codigoImovel || 'Não informado'}\nLink do Imóvel: ${session.extractedLead.linkImovel || 'Não informado'}\nIntenção Atual: ${session.extractedLead.intencaoAtual || tipo || 'Aguardando corretor'}\nTipo de Atendimento: ${tipo || 'Aguardando corretor'}\nProduto/Imóvel: ${produto || 'A combinar com corretor'}\nConsentimento para contato: Sim, autorizado conforme LGPD\nOrigem: WhatsApp Web Direct Houses\nStatus: Aguardando contato do corretor`,
  };

  // Se o lead atingiu critérios de qualificação completa, aciona a bateria de validação técnica com estado 'validating'
  if (isFullyQualified && session.status !== 'dispatched') {
    await performTechnicalLeadValidation(session);
  }
}

/**
 * Executa as verificações técnicas de qualificação e transita para o estado 'validating' antes de gravar o lead no sistema (recordLead).
 * Garante que o lead esteja tecnicamente consistente e persistido antes de qualquer encaminhamento para a Roleta.
 */
export async function performTechnicalLeadValidation(
  session: WhatsAppChatSession
): Promise<{ passed: boolean; errors: string[] }> {
  const errors: string[] = [];

  // Se o lead já foi formalmente despachado e validado anteriormente, mantém o estado
  if (session.status === 'dispatched' && session.technicalValidationPassed) {
    return { passed: true, errors: [] };
  }

  // 1. Entra imediatamente no estado de validação técnica
  const previousStatus = session.status;
  session.status = 'validating';

  // 2. Verificação Técnica 1: Validação rigorosa de telefone (E.164 com DDD)
  const hasValidPhone = isValidPhoneNumber(session.phone);
  if (!hasValidPhone) {
    errors.push('Telefone inválido ou não informado com DDD.');
  }

  // 3. Verificação Técnica 2: Nome e dados mínimos de interesse comercial
  const hasRealName = Boolean(session.name && session.name !== 'Cliente' && !isGreetingOnly(session.name));
  const hasCommercialData = Boolean(
    session.extractedLead.produtoImovel ||
    session.extractedLead.tipoAtendimento ||
    session.extractedLead.codigoImovel ||
    session.extractedLead.intencaoAtual ||
    session.extractedLead.selectedLancamentoNome ||
    (session.extractedLead.informacoesColetadas && Object.keys(session.extractedLead.informacoesColetadas).length > 0)
  );

  const isCompleteOrTransferRequested = Boolean(
    session.extractedLead.isComplete ||
    session.extractedLead.humanRequested ||
    session.extractedLead.intencaoAtual === 'aguardar_corretor' ||
    session.extractedLead.intencaoAtual === 'atendimento_humano'
  );

  if (!hasCommercialData && !isCompleteOrTransferRequested && !hasRealName) {
    errors.push('Lead sem informações comerciais mínimas para atendimento pelo corretor.');
  }

  // Se alguma verificação de qualificação falhar, aborta a validação técnica
  if (errors.length > 0) {
    console.warn(`⚠️ [WhatsApp AI] Validação técnica do lead falhou para ${session.phone}:`, errors);
    session.status = previousStatus === 'validating' ? 'active' : previousStatus;
    session.technicalValidationPassed = false;
    session.technicalValidationErrors = errors;
    session.extractedLead.isComplete = false;
    return { passed: false, errors };
  }

  // 4. Verificação Técnica 3: Persistência técnica formal no sistema (recordLead)
  try {
    const leadId = `lead-${session.jid.replace(/[^a-zA-Z0-9]/g, '')}`;
    const displayPhone = formatPhoneForDisplay(session.phone);

    await recordLead({
      id: leadId,
      nome: session.extractedLead.nome || (hasRealName ? session.name : 'Cliente WhatsApp'),
      telefone: session.extractedLead.telefone || displayPhone,
      tipoAtendimento: session.extractedLead.tipoAtendimento || 'Interesse Imobiliário',
      produtoImovel: session.extractedLead.produtoImovel || 'A combinar com corretor',
      observacoes: session.extractedLead.observacoes,
      initialMessage: session.initialMessage,
      origem: 'WhatsApp Web Direct Houses',
      status: session.assignedBroker ? 'Direcionado na Roleta' : 'Qualificado',
      assignedBroker: session.assignedBroker,
      rawStructuredText: session.extractedLead.finalStructuredText,
      trilhaNavegacao: session.extractedLead.trilhaNavegacao,
      resumoNavegacao: session.extractedLead.resumoNavegacao,
      historicoMensagens: session.extractedLead.historicoMensagens || getAlteredSessionHistory(session),
    });

    // 5. Sucesso completo: Registro técnico concluído no sistema. Promove para 'qualified'
    session.status = 'qualified';
    session.technicalValidationPassed = true;
    session.technicalValidationErrors = [];
    session.extractedLead.isComplete = true;
    session.extractedLead.estadoAtendimento = 'qualificado';
    scheduleSessionsPersist();

    console.log(
      `✅ [WhatsApp AI] Estado de validação concluído com sucesso. Lead técnico persistido no sistema: ID ${leadId} (${session.phone})`
    );
    return { passed: true, errors: [] };
  } catch (err: any) {
    console.error(`❌ [WhatsApp AI] Erro durante o registro técnico do lead (${session.phone}):`, err);
    session.status = 'active';
    session.technicalValidationPassed = false;
    session.technicalValidationErrors = [err.message || 'Falha ao gravar lead no banco/JSON local.'];
    return { passed: false, errors: session.technicalValidationErrors };
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
    const prop = extractPropertyCodeAndLink(messageText);
    session = {
      jid,
      phone: isValidPhoneNumber(senderPhone) ? senderPhone : '',
      // Never treat pushName as confirmed lead name — store as hint only
      name: 'Cliente',
      pushName: senderName && senderName !== 'Cliente' ? senderName : undefined,
      initialMessage: messageText,
      messages: [],
      extractedLead: {
        nome: 'Cliente',
        telefone: isValidPhoneNumber(senderPhone) ? formatPhoneForDisplay(senderPhone) : '',
        tipoAtendimento: '',
        produtoImovel: prop.code
          ? `Imóvel Cód. ${prop.code}`
          : prop.link
          ? `Imóvel: ${prop.link}`
          : '',
        observacoes: '',
        initialMessage: messageText,
        consentimento: 'Sim, autorizado conforme LGPD',
        origem: 'WhatsApp Web Direct Houses',
        status: 'Em atendimento inicial',
        isComplete: false,
        humanRequested: false,
        finalStructuredText: '',
        nameConfirmed: false,
        phoneConfirmed: false,
        dadosNaoConfirmados: false,
        trilhaNavegacao: [],
        codigoImovel: prop.code,
        linkImovel: prop.link,
        estadoAtendimento: 'confirmacao_contato',
        informacoesColetadas: {},
      },
      status: 'active',
      lastActivity: new Date().toISOString(),
      awaitingContactConfirmation: true,
      contactConfirmationAsked: false,
      contactConfirmationNudgedOnInactivity: false,
    };
    sessions.set(jid, session);
  } else {
    // 🔄 Suporte a testes com o mesmo telefone / novo ciclo:
    // Se a sessão já foi despachada, reabre e limpa produto/trilha/histórico incremental.
    const roletaConfig = await getRoletaConfig();
    const cooldownSec = roletaConfig.cooldownBetweenDispatchesSeconds ?? 15;
    const cooldownMs = cooldownSec * 1000;
    const now = Date.now();
    const lastDispTime = session.lastDispatchedAt ? new Date(session.lastDispatchedAt).getTime() : 0;
    const newPropertyCycle =
      propertyContextDiffers(messageText, session.initialMessage) ||
      propertyContextDiffers(messageText, session.extractedLead.initialMessage);

    if (
      session.status === 'dispatched' &&
      (now - lastDispTime >= cooldownMs || isGreetingOnly(messageText) || newPropertyCycle)
    ) {
      console.log(
        `🔄 [WhatsApp AI] Reabrindo sessão de ${session.phone || jid} para novo ciclo (produto/trilha limpos).`
      );
      if (senderName && senderName !== 'Cliente') session.pushName = senderName;
      resetSessionForNewCycle(session, messageText);
    } else if (session.status === 'active' && newPropertyCycle && messageText) {
      // Same active session but a different property URL in a new initial-style message
      console.log(
        `🔄 [WhatsApp AI] Novo imóvel detectado na sessão ${session.phone || jid} — resetando produto/trilha.`
      );
      if (senderName && senderName !== 'Cliente') session.pushName = senderName;
      resetSessionForNewCycle(session, messageText);
    } else if (senderName && senderName !== 'Cliente' && !session.pushName) {
      session.pushName = senderName;
    }
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

  // PRIORITY B: early name/phone confirmation before menu / Gemini trail
  let replyText = '';
  const earlyGate = processContactConfirmationGate(session, messageText, companyName);
  if (earlyGate) {
    replyText = earlyGate;
  }

  // Generate AI reply only after contact is confirmed
  const aiClient = getGeminiClient();

  if (!replyText && hasConfirmedContact(session) && aiClient) {
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

  // Guarda de encerramento sem telefone: se o telefone ainda não foi capturado, não permitir que a IA finalize sem pedir telefone
  const hasValidPhone = isValidPhoneNumber(session.phone);
  const isFinalTransferWithoutPhone =
    !hasValidPhone &&
    /(NOVO LEAD|atendimento (conclu[íi]do|encerrado)|dados foram encaminhados ao consultor|corretor entrar[áa] em contato)/i.test(
      replyText
    );

  if (isFinalTransferWithoutPhone) {
    console.warn('[WhatsApp AI] Bloqueando encerramento antes de capturar telefone do lead. Solicitando telefone.');
    replyText = getFallbackReply(session, companyName);
  }

  // 🛡️ Data Loss Prevention (DLP) & Filtro de Governança de Saída:
  const governanceAudit = sanitizeAndAuditAIResponse(replyText, {
    userPrompt: messageText,
    companyName,
    whatsappJid: session.jid,
    leadId: session.extractedLead?.nome ? `lead-${session.jid.replace(/[^a-zA-Z0-9]/g, '')}` : null,
    modelUsed: CANDIDATE_MODELS[0],
  });
  if (governanceAudit.wasModified) {
    console.warn(
      `🛡️ [Governança ${companyName}] Resposta filtrada e higienizada. Violações:`,
      governanceAudit.violationsDetected
    );
    replyText = governanceAudit.sanitizedText;
  }

  // 🤖 Interceptador de Validação Técnica Pré-Resposta:
  // Evitar que o bot diga "ok, vou encaminhar" sem antes completar as verificações de qualificação e o registro técnico no sistema
  const aiMentionsTransfer = /(vou\s+(te\s+)?encaminhar|encaminhei|encaminhando|estou\s+encaminhando|transferindo|passando\s+seu\s+contato|consultor\s+entrar[áa]\s+em\s+contato|corretor\s+entrar[áa]\s+em\s+contato|atendimento\s+foi\s+encaminhado|dados\s+foram\s+encaminhados|equipe\s+comercial\s+entrar[áa]\s+em\s+contato|plant[ãa]o\s+vai\s+te\s+atender)/i.test(
    replyText
  );

  if (aiMentionsTransfer) {
    // Dispara a validação técnica no estado 'validating' antes de permitir o envio da resposta com promessa de encaminhamento
    const validationResult = await performTechnicalLeadValidation(session);

    if (!validationResult.passed) {
      console.warn(
        `🛡️ [WhatsApp AI Guard] A IA gerou intenção de encaminhamento verbal, mas a validação técnica/registro do lead não foi concluída:`,
        validationResult.errors
      );

      // Substitui por mensagem que conduz o lead a completar os dados faltantes
      if (!isValidPhoneNumber(session.phone)) {
        replyText = `Com certeza, ${session.name !== 'Cliente' ? session.name : ''}! Para que eu conclua a validação do seu cadastro no sistema e encaminhe seu atendimento com prioridade ao nosso corretor de plantão, por favor me informe o seu *número de WhatsApp com DDD*. 😊`;
      } else {
        replyText = `Com certeza, ${session.name !== 'Cliente' ? session.name : ''}! Para que eu finalize seu registro no sistema e passe sua ficha completa ao consultor responsável, por favor me informe qual tipo de imóvel ou região você procura.`;
      }
    }
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
  const shouldDispatch =
    roletaConfig.autoDispatchEnabled &&
    session.technicalValidationPassed &&
    session.status === 'qualified' &&
    isValidPhoneNumber(session.phone);

  if (shouldDispatch) {
    const delaySeconds = roletaConfig.dispatchDelaySeconds ?? 3;
    const delayMs = Math.max(500, delaySeconds * 1000);

    console.log(
      `⏱️ [Roleta] Temporizador ativo: agendando encaminhamento de ${session.phone} para corretor na Roleta em ${delaySeconds}s...`
    );

    // Cancelar timer anterior se houver (debounce se o usuário digitar rapidamente outra mensagem)
    if (activeDispatchTimers.has(session.jid)) {
      clearTimeout(activeDispatchTimers.get(session.jid)!);
      activeDispatchTimers.delete(session.jid);
    }

    const timer = setTimeout(async () => {
      activeDispatchTimers.delete(session.jid);
      try {
        console.log(
          `🚀 [Roleta] Temporizador (${delaySeconds}s) concluído! Executando despacho do lead de ${session.phone} para a Roleta...`
        );
        const dispRes = await dispatchSessionLeadToRoleta(session, companyName);
        console.log(`✅ [Roleta] Despacho automático finalizado:`, dispRes.message);
      } catch (dispErr) {
        console.error('❌ [Roleta] Erro ao despachar lead após temporizador:', dispErr);
      }
    }, delayMs);

    activeDispatchTimers.set(session.jid, timer);
  }
}

/**
 * Dispatch session lead to the next broker in Roleta
 */
export async function dispatchSessionLeadToRoleta(
  session: WhatsAppChatSession,
  companyName: string = 'Direct Houses'
): Promise<{ success: boolean; message: string; broker?: any }> {
  // Limpar qualquer timer pendente para evitar execuções duplicadas
  if (activeDispatchTimers.has(session.jid)) {
    clearTimeout(activeDispatchTimers.get(session.jid)!);
    activeDispatchTimers.delete(session.jid);
  }

  // 1. Verificação Rigorosa: Assegurar que as verificações de qualificação e o registro técnico no sistema foram concluídos
  if (!session.technicalValidationPassed || session.status !== 'qualified') {
    console.log(`[Roleta Dispatch] Executando validação técnica de qualificação pré-despacho para ${session.phone}...`);
    const valResult = await performTechnicalLeadValidation(session);
    if (!valResult.passed) {
      console.warn(`🚫 [Roleta Dispatch] Despacho bloqueado: Lead não concluiu as verificações de qualificação:`, valResult.errors);
      return {
        success: false,
        message: `Encaminhamento bloqueado: ${valResult.errors.join('; ')}`,
      };
    }
  }

  // 2. Verificação de telefone válido
  if (!isValidPhoneNumber(session.phone)) {
    console.warn('[Roleta Dispatch] Bloqueado: lead sem telefone válido.');
    return { success: false, message: 'Telefone obrigatório e validado antes do despacho.' };
  }

  const chosenBroker = await getNextBrokerInRoleta();

  if (!chosenBroker) {
    return {
      success: false,
      message: 'Nenhum corretor ativo na fila da Roleta.',
    };
  }

  // 3. Build and send dossier to broker's WhatsApp com histórico alterado
  const alteredHistory = getAlteredSessionHistory(session);
  const isIncremental = Boolean(
    session.lastDispatchedAt ||
    (typeof session.lastDispatchedMessageIndex === 'number' && session.lastDispatchedMessageIndex >= 0)
  );

  session.status = 'dispatched';
  session.lastDispatchedAt = new Date().toISOString();
  session.lastDispatchedMessageIndex = session.messages.length - 1;
  session.assignedBroker = {
    id: chosenBroker.id,
    name: chosenBroker.name,
    phone: chosenBroker.phone,
    assignedAt: new Date().toISOString(),
  };

  const leadDataForBroker = {
    ...session.extractedLead,
    historicoMensagens: alteredHistory,
    isIncrementalUpdate: isIncremental,
  };

  const brokerMessage = formatBrokerLeadMessage(leadDataForBroker, companyName, session.phone);
  const sendRes = await whatsAppService.sendTextMessage(chosenBroker.phone, brokerMessage);

  // 4. Optionally notify customer on WhatsApp with the broker's name
  const roletaConfig = await getRoletaConfig();
  if (sendRes.success && roletaConfig.notifyClientWithBrokerName) {
    const clientNotice = formatClientAssignedMessage(chosenBroker.name, companyName);
    await whatsAppService.sendTextMessage(session.jid, clientNotice);

    session.messages.push({
      id: `msg-${Date.now()}-broker-assigned`,
      role: 'assistant',
      content: clientNotice,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });
  }

  console.log(`🎯 [Roleta] Lead de ${session.extractedLead.nome} (${session.phone}) direcionado para ${chosenBroker.name} (${chosenBroker.phone}). Status envio: ${sendRes.success ? 'OK' : 'Falha'}`);
  
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
    motivo: 'Qualificação técnica completa via IA no WhatsApp',
    produtoImovel: session.extractedLead.produtoImovel || 'A combinar',
  });

  // Update persistent lead com status Direcionado na Roleta e corretor vinculado
  await recordLead({
    id: leadId,
    nome: session.extractedLead.nome,
    telefone: session.extractedLead.telefone || session.phone,
    tipoAtendimento: session.extractedLead.tipoAtendimento,
    produtoImovel: session.extractedLead.produtoImovel,
    observacoes: session.extractedLead.observacoes,
    initialMessage: session.initialMessage,
    origem: 'WhatsApp Web Direct Houses',
    status: 'Direcionado na Roleta',
    temperatura: 'quente',
    assignedBroker: session.assignedBroker,
    rawStructuredText: session.extractedLead.finalStructuredText,
    trilhaNavegacao: session.extractedLead.trilhaNavegacao,
    resumoNavegacao: session.extractedLead.resumoNavegacao,
    historicoMensagens: alteredHistory,
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

  scheduleSessionsPersist();

  if (!sendRes.success) {
    console.warn(`⚠️ [Roleta] Aviso: Lead registrado para ${chosenBroker.name}, mas envio via WhatsApp falhou: ${sendRes.error}`);
  }

  return {
    success: true,
    message: sendRes.success
      ? `Lead encaminhado com sucesso para o corretor ${chosenBroker.name}.`
      : `Lead distribuído para ${chosenBroker.name} no painel (envio WhatsApp pendente: ${sendRes.error}).`,
    broker: chosenBroker,
  };
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

  const alteredHistory = getAlteredSessionHistory(session);
  const isIncremental = Boolean(
    session.lastDispatchedAt ||
    (typeof session.lastDispatchedMessageIndex === 'number' && session.lastDispatchedMessageIndex >= 0)
  );

  chosenBroker.leadsReceived = (chosenBroker.leadsReceived || 0) + 1;
  chosenBroker.lastAssignedAt = new Date().toISOString();

  session.status = 'dispatched';
  session.lastDispatchedAt = new Date().toISOString();
  session.lastDispatchedMessageIndex = session.messages.length - 1;
  session.assignedBroker = {
    id: chosenBroker.id,
    name: chosenBroker.name,
    phone: chosenBroker.phone,
    assignedAt: new Date().toISOString(),
  };

  const leadDataForBroker = {
    ...session.extractedLead,
    historicoMensagens: alteredHistory,
    isIncrementalUpdate: isIncremental,
  };

  const brokerMessage = formatBrokerLeadMessage(leadDataForBroker, companyName, session.phone);
  const sendRes = await whatsAppService.sendTextMessage(chosenBroker.phone, brokerMessage);

  if (sendRes.success) {
    const clientNotice = formatClientAssignedMessage(chosenBroker.name, companyName);
    await whatsAppService.sendTextMessage(session.jid, clientNotice);
  }

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
    historicoMensagens: alteredHistory,
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
    message: sendRes.success
      ? `Lead direcionado com sucesso para ${chosenBroker.name}.`
      : `Lead vinculado a ${chosenBroker.name} no painel (envio WhatsApp: ${sendRes.error}).`,
    broker: chosenBroker,
  };
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
 * Inactivity Monitor: Automatically dispatches active sessions that stopped responding.
 * Prefers confirmed name+phone; otherwise nudges confirmation once, then dispatches
 * a slim dossier marked "dados não confirmados" if contact is still usable.
 */
async function checkInactiveSessions() {
  const now = Date.now();
  const companyName = process.env.COMPANY_NAME || 'Direct Houses';
  const roletaConfig = await getRoletaConfig();

  if (!roletaConfig.autoDispatchEnabled) return;

  const timeoutSec = roletaConfig.inactivityTimeoutSeconds || roletaConfig.timeoutSeconds || 120;
  const inactivityTimeoutMs = timeoutSec * 1000;

  for (const session of sessions.values()) {
    if (session.status === 'active' && session.messages.length > 0) {
      const lastActivityTime = new Date(session.lastActivity).getTime();
      if (now - lastActivityTime >= inactivityTimeoutMs) {
        await extractLeadFromSession(session);

        const hasPhone = isValidPhoneNumber(session.phone);
        const hasNameHint = Boolean(suggestedDisplayName(session));
        const confirmed = hasConfirmedContact(session);

        // Prefer usable contact early: nudge confirmation once before dispatching unconfirmed
        if (hasPhone && !confirmed && !session.contactConfirmationNudgedOnInactivity) {
          session.contactConfirmationNudgedOnInactivity = true;
          session.awaitingContactConfirmation = true;
          session.contactConfirmationAsked = true;
          session.lastActivity = new Date().toISOString();
          const nudge =
            `Antes de te conectar a um consultor, confirma seus dados?\n` +
            buildContactConfirmationPrompt(session).replace(/^Confirma seus dados\?\n?/, '');
          try {
            await whatsAppService.sendTextMessage(session.jid, nudge);
            session.messages.push({
              id: `msg-${Date.now()}-inactivity-nudge`,
              role: 'assistant',
              content: nudge,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            });
            scheduleSessionsPersist();
          } catch (err) {
            console.warn('⚠️ [Inatividade] Falha ao enviar nudge de confirmação:', err);
          }
          continue;
        }

        // Dispatch only with phone + (confirmed OR clearly captured name/tipo)
        const canDispatch =
          hasPhone &&
          (confirmed ||
            hasNameHint ||
            Boolean(session.extractedLead.tipoAtendimento) ||
            Boolean(session.extractedLead.produtoImovel) ||
            Boolean(session.extractedLead.linkImovel));

        if (!canDispatch) {
          continue;
        }

        if (!confirmed) {
          session.extractedLead.dadosNaoConfirmados = true;
          // Seed name from pushName hint for dossier if still Cliente
          if ((!session.name || session.name === 'Cliente') && session.pushName) {
            session.name = session.pushName;
            session.extractedLead.nome = session.pushName;
          }
        }

        console.log(
          `⏱️ [Inatividade] Sessão de ${session.name} (${session.phone}) inativa há mais de ${timeoutSec}s. Despachando na Roleta...`
        );

        const chosenBroker = await getNextBrokerInRoleta();

        if (chosenBroker) {
          const alteredHistory = getAlteredSessionHistory(session).slice(-4);
          const brokerMsg = formatBrokerLeadMessage(
            {
              nome: session.extractedLead.nome || session.name || 'Cliente WhatsApp',
              telefone: session.extractedLead.telefone || session.phone,
              tipoAtendimento: session.extractedLead.tipoAtendimento || 'Interesse Comercial Inicial',
              produtoImovel: session.extractedLead.produtoImovel || 'A combinar com corretor',
              observacoes: confirmed
                ? 'Inatividade após confirmação de contato.'
                : 'Dados não confirmados — lead recuperado por inatividade.',
              isTimeoutRecovery: true,
              initialMessage: session.initialMessage || session.messages[0]?.content || '',
              historicoMensagens: alteredHistory,
              nameConfirmed: session.extractedLead.nameConfirmed,
              phoneConfirmed: session.extractedLead.phoneConfirmed,
              dadosNaoConfirmados: session.extractedLead.dadosNaoConfirmados,
              linkImovel: session.extractedLead.linkImovel,
              codigoImovel: session.extractedLead.codigoImovel,
            },
            companyName,
            session.phone
          );

          await whatsAppService.sendTextMessage(chosenBroker.phone, brokerMsg);

          session.status = 'dispatched';
          session.lastDispatchedAt = new Date().toISOString();
          session.lastDispatchedMessageIndex = session.messages.length - 1;
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
            motivo: confirmed
              ? 'Recuperação por inatividade (contato confirmado)'
              : 'Recuperação por inatividade (dados não confirmados)',
            produtoImovel: session.extractedLead.produtoImovel || 'A combinar com corretor',
          });

          await recordLead({
            id: leadId,
            nome: session.extractedLead.nome || session.name || 'Cliente WhatsApp',
            telefone: session.extractedLead.telefone || session.phone,
            tipoAtendimento: session.extractedLead.tipoAtendimento || 'Interesse Comercial Inicial',
            produtoImovel: session.extractedLead.produtoImovel || 'A combinar com corretor',
            observacoes: confirmed
              ? 'Cliente parou de responder após confirmação. Lead recuperado na roleta.'
              : 'Dados não confirmados. Cliente parou de responder. Lead recuperado na roleta.',
            initialMessage: session.initialMessage || session.messages[0]?.content || '',
            origem: 'WhatsApp Web Direct Houses',
            status: 'em_atendimento',
            temperatura: 'quente',
            assignedBroker: session.assignedBroker,
            historicoMensagens: alteredHistory,
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

