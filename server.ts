import express from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { dispatchToMake, dispatchToN8n, dispatchToEmail, SmtpConfig, LeadAutomationPayload } from './server-automation';
import { whatsAppService } from './whatsapp-service';
import {
  getAllWhatsAppSessions,
  getWhatsAppSession,
  dispatchSessionLeadToRoleta,
  dispatchSessionLeadToSpecificBroker,
} from './whatsapp-ai-handler';
import {
  getBrokers,
  addBroker,
  updateBroker,
  deleteBroker,
  getRoletaConfig,
  saveRoletaConfig,
  getNextBrokerInRoleta,
  formatBrokerLeadMessage,
  formatClientAssignedMessage,
} from './broker-roleta';
import {
  verifyGoogleIdToken,
  isEmailAuthorized,
  createSession,
  getSessionUser,
  deleteSession,
  getAuthorizedUsers,
  addAuthorizedUser,
  removeAuthorizedUser,
  GLOBAL_ADMIN_EMAIL,
} from './auth-service';
import {
  getPersistentLeads,
  recordLead,
  updateLead,
  updateLeadStage,
  addLeadNote,
  addLeadDistribution,
  deletePersistentLead,
  clearAllPersistentLeads,
  getLeadsMetrics,
} from './leads-service';
import {
  getRoletaDistributionHistory,
  recordDistributionLog,
  clearRoletaDistributionHistory,
  getRoletaDistributionStats,
} from './roleta-history-service';
import {
  getLancamentos,
  addLancamento,
  updateLancamento,
  deleteLancamento,
  getActiveLancamentos,
  getPublicLancamentosForAI,
  runGovernanceSecurityTests,
  sanitizeAndAuditAIResponse,
  getAIViolations,
  clearAIViolations,
} from './lancamentos-service';
import { isDbConfigured, testConnection } from './db';

dotenv.config();

const app = express();
const PORT = 3000;

const UPLOAD_DIR = path.join(process.cwd(), '.data', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/uploads', express.static(UPLOAD_DIR));

// Initialize Google GenAI client lazily or with User-Agent header
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

const DEFAULT_COMPANY = 'Direct Houses';

function buildSystemPrompt(companyName: string, whatsappAvailable: boolean, whatsappNumber: string) {
  return `Você é o assistente comercial da ${companyName || DEFAULT_COMPANY}.

Sua função é atender leads recebidos pelo site, coletar os dados principais e preparar o encaminhamento para um corretor.

Conduza a conversa de forma cordial, objetiva e natural.

Regras:
1. Cumprimente o cliente na primeira mensagem.
2. Explique que fará algumas perguntas rápidas para encaminhá-lo ao corretor adequado.
3. Faça apenas uma pergunta por vez.
4. Colete os dados abaixo:
   - nome completo;
   - telefone para contato;
   - tipo de atendimento: comprar, vender, alugar ou tirar dúvidas;
   - produto ou imóvel de interesse;
   - observações adicionais.
5. Considere o número de WhatsApp do cliente como telefone somente se ele estiver disponível no sistema.
${
  whatsappAvailable
    ? `[INFORMAÇÃO DO SISTEMA]: O número de WhatsApp do cliente já está cadastrado no sistema (${whatsappNumber}). Você pode confirmar com o cliente se este é o melhor telefone para contato.`
    : `[INFORMAÇÃO DO SISTEMA]: Não há número de WhatsApp pré-cadastrado no sistema. Você deve perguntar o telefone de contato ao cliente.`
}
6. Nunca invente preços, imóveis, disponibilidade ou informações sobre produtos.
7. Se o cliente não quiser responder alguma pergunta, continue com os dados disponíveis.
8. Se o cliente pedir um atendente humano, finalize a coleta com as informações disponíveis imediatamente.
9. Antes de concluir, mostre um resumo dos dados e peça confirmação.
10. Depois da confirmação (ou se o cliente confirmar ou pedir corretor humano), gere um resumo estruturado para o corretor exatamente no formato solicitado abaixo.
11. Informar ao cliente que os dados foram encaminhados e que um corretor entrará em contato.
12. Não diga que a conversa foi transferida automaticamente.
13. Inclua uma observação de consentimento para contato comercial conforme a LGPD.

Quando a coleta for concluída e confirmada pelo cliente (ou quando for finalizada por solicitação de atendente humano), retorne os dados no seguinte formato exato no corpo da mensagem ou em bloco de texto:

NOVO LEAD

Nome: [Nome coletado ou Não informado]
Telefone: [Telefone coletado ou Não informado]
Tipo de atendimento: [comprar, vender, alugar ou tirar dúvidas]
Produto ou imóvel: [descrição do imóvel de interesse ou Não informado]
Observações: [observações adicionais ou Nenhuma]
Consentimento para contato: [Sim, autorizado pelo cliente conforme LGPD / Registrado no chat]
Origem: Site via WhatsApp
Status: Aguardando contato do corretor

Lembre-se:
- Faça apenas UMA pergunta por vez.
- Mantenha tom profissional, caloroso e conciso.`;
}

// Candidate models in order of resilience and speed.
// Using standard supported aliases from gemini-api skill:
// 'gemini-2.5-flash', 'gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-flash-latest'
const CANDIDATE_MODELS = [
  'gemini-2.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-3.8-flash',
  'gemini-flash-latest',
];

async function generateWithFallback(
  client: GoogleGenAI,
  options: {
    contents: any;
    config?: any;
  }
) {
  let lastError: any = null;
  for (const model of CANDIDATE_MODELS) {
    // Attempt up to 2 times per model if temporary 503/high demand occurs
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await client.models.generateContent({
          model,
          contents: options.contents,
          config: options.config,
        });
        if (response && response.text) {
          return response;
        }
      } catch (err: any) {
        lastError = err;
        const errMsg = err?.message || String(err);
        const is503OrOverloaded =
          err?.status === 503 ||
          err?.code === 503 ||
          errMsg.includes('503') ||
          errMsg.includes('high demand') ||
          errMsg.includes('UNAVAILABLE');

        if (is503OrOverloaded && attempt === 0) {
          // Brief backoff before retrying once
          await new Promise((resolve) => setTimeout(resolve, 350));
          continue;
        }
        // Break to try the next model candidate
        break;
      }
    }
  }
  throw lastError;
}

// Helper to determine quick replies based on conversation stage and message content
function deduceQuickReplies(replyText: string): string[] {
  if (!replyText) return [];
  if (replyText.includes('NOVO LEAD')) {
    return ['Muito obrigado!', 'Fico no aguardo'];
  }
  const lower = replyText.toLowerCase();
  if (lower.includes('comprar') && lower.includes('alugar') && lower.includes('vender')) {
    return ['Comprar', 'Alugar', 'Vender', 'Tirar dúvidas'];
  }
  if (lower.includes('confirma') || lower.includes('está correto') || lower.includes('confirmação')) {
    return ['Sim, está tudo correto!', 'Preciso alterar um dado', 'Pode encaminhar ao corretor'];
  }
  if (lower.includes('observação') || lower.includes('observações') || lower.includes('destacar') || lower.includes('adicional')) {
    return ['Nenhuma observação', 'Tenho urgência', 'Preciso com vaga de garagem'];
  }
  if (lower.includes('consentimento') || lower.includes('lgpd') || lower.includes('autoriza')) {
    return ['Sim, autorizo o contato comercial', 'Autorizado via WhatsApp'];
  }
  return [];
}

// Server-side fallback rule-based assistant in case API key is not configured or fails
function fallbackRuleBasedAssistant(
  history: Array<{ role: 'user' | 'assistant' | string; content: string }>,
  companyName: string,
  whatsappAvailable: boolean,
  whatsappNumber: string
): { reply: string; quickReplies: string[] } {
  const company = companyName || DEFAULT_COMPANY;
  const userMessages = (history || []).filter((m) => m && m.role === 'user');
  const count = userMessages.length;
  const lastUserMsg = userMessages[userMessages.length - 1]?.content?.toLowerCase() || '';

  // Rule 8: If client requests human agent
  if (
    lastUserMsg.includes('humano') ||
    lastUserMsg.includes('corretor') ||
    lastUserMsg.includes('falar com uma pessoa') ||
    lastUserMsg.includes('atendente')
  ) {
    return {
      reply: `Com certeza! Estou finalizando o seu atendimento aqui e registrando os dados para o corretor da ${company}. Um corretor especialista da nossa equipe entrará em contato com você o mais breve possível para dar continuidade. Agradecemos o seu contato!\n\nNOVO LEAD\nNome: ${userMessages[0]?.content || 'Cliente'}\nTelefone: ${whatsappAvailable ? whatsappNumber : 'Registrado no canal'}\nTipo de atendimento: Atendimento personalizado\nProduto ou imóvel: A definir com corretor\nObservações: Cliente solicitou atendimento com corretor humano.\nConsentimento para contato: Sim, autorizado conforme LGPD\nOrigem: Site via WhatsApp\nStatus: Aguardando contato do corretor`,
      quickReplies: ['Obrigado!', 'No aguardo'],
    };
  }

  // Sequential question flow adhering to rules 1-13
  switch (count) {
    case 0:
    case 1:
      return {
        reply: whatsappAvailable
          ? `Prazer em falar com você! Identifiquei seu número de WhatsApp no sistema (${whatsappNumber}). Este é o melhor telefone para o corretor falar com você, ou prefere informar outro?`
          : `Muito prazer! Para que o corretor possa entrar em contato com você no momento oportuno, qual é o seu telefone com DDD?`,
        quickReplies: whatsappAvailable ? ['Sim, pode ser este número', 'Prefiro informar outro'] : [],
      };
    case 2:
      return {
        reply: `Perfeito! Qual tipo de atendimento você procura hoje: comprar, alugar, vender um imóvel ou tirar dúvidas?`,
        quickReplies: ['Comprar', 'Alugar', 'Vender', 'Tirar dúvidas'],
      };
    case 3:
      return {
        reply: `Excelente! Que tipo de imóvel ou produto você tem em mente? (Por exemplo: apartamento de 2 ou 3 quartos, casa em condomínio, sala comercial, cobertura...)`,
        quickReplies: ['Apartamento 2 quartos', 'Apartamento 3 quartos', 'Casa em condomínio', 'Sala comercial'],
      };
    case 4:
      return {
        reply: `Perfeito! Há alguma observação adicional ou detalhe importante sobre o que você procura que gostaria de destacar? (Se preferir, podemos seguir adiante sem observações).`,
        quickReplies: ['Nenhuma observação', 'Aceito permuta', 'Preciso com vaga de garagem', 'Tenho urgência'],
      };
    case 5:
      return {
        reply: `Excelente! Antes de encaminharmos, por favor confirme se os dados estão corretos:\n\n• Nome: ${userMessages[0]?.content || 'Cliente'}\n• Telefone: ${whatsappAvailable ? whatsappNumber : userMessages[1]?.content || 'Informado'}\n• Atendimento: ${userMessages[2]?.content || 'Interesse imobiliário'}\n• Imóvel: ${userMessages[3]?.content || 'Conforme conversa'}\n• Observações: ${userMessages[4]?.content || 'Nenhuma'}\n\nVocê confirma esses dados e autoriza o contato comercial do nosso corretor conforme as diretrizes da LGPD?`,
        quickReplies: ['Sim, confirmo e autorizo', 'Gostaria de corrigir um dado'],
      };
    default:
      return {
        reply: `Muito obrigado pela confirmação! Seus dados foram encaminhados com sucesso e um corretor da equipe da ${company} entrará em contato com você em breve para apresentar as melhores opções. Tenha um excelente dia!\n\nNOVO LEAD\n\nNome: ${userMessages[0]?.content || 'Cliente'}\nTelefone: ${whatsappAvailable ? whatsappNumber : userMessages[1]?.content || 'Aguardando'}\nTipo de atendimento: ${userMessages[2]?.content || 'Comprar/Alugar'}\nProduto ou imóvel: ${userMessages[3]?.content || 'Imóvel residencial/comercial'}\nObservações: ${userMessages[4]?.content || 'Sem observações'}\nConsentimento para contato: Sim, autorizado pelo cliente conforme LGPD\nOrigem: Site via WhatsApp\nStatus: Aguardando contato do corretor`,
        quickReplies: ['Muito obrigado!', 'Fico no aguardo'],
      };
  }
}

// Real-time structured extraction from chat transcript
async function extractLeadStructured(
  messages: Array<{ role: string; content: string }>,
  whatsappAvailable: boolean,
  whatsappNumber: string
) {
  return parseLeadFromTranscriptLocally(messages, whatsappAvailable, whatsappNumber);
}

function parseLeadFromTranscriptLocally(
  messages: Array<{ role: string; content: string }>,
  whatsappAvailable: boolean,
  whatsappNumber: string
) {
  const safeMessages = messages || [];
  const fullText = safeMessages.map((m) => m?.content || '').join('\n');
  const userMsgs = safeMessages.filter((m) => m && m.role === 'user').map((m) => m.content || '');

  // Check if final NOVO LEAD block exists
  const hasSummary = fullText.includes('NOVO LEAD');
  let finalStructuredText = '';
  if (hasSummary) {
    const match = fullText.match(/NOVO LEAD[\s\S]*?(Status: Aguardando contato do corretor|$)/);
    if (match) {
      finalStructuredText = match[0].trim();
    }
  }

  const getFieldFromBlock = (field: string) => {
    if (!finalStructuredText) return '';
    const regex = new RegExp(`(?:^|\\n)${field}:\\s*([^\\n]+)`, 'i');
    const m = finalStructuredText.match(regex);
    return m ? m[1].trim() : '';
  };

  const blockNome = getFieldFromBlock('Nome');
  const blockTelefone = getFieldFromBlock('Telefone');
  const blockTipo = getFieldFromBlock('Tipo de atendimento');
  const blockProduto = getFieldFromBlock('Produto ou imóvel');
  const blockObs = getFieldFromBlock('Observações');

  // Phone regex search across transcript
  const phoneMatch = fullText.match(/(\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4})/);
  const detectedPhone = blockTelefone || (phoneMatch ? phoneMatch[0] : whatsappAvailable ? whatsappNumber : '');

  // Determine tipo from user responses
  let tipo = blockTipo;
  const userCombinedText = userMsgs.join(' ');
  if (!tipo) {
    if (/\bcompr(ar|a|o)?\b/i.test(userCombinedText)) tipo = 'comprar';
    else if (/\balug(ar|uel|o)?\b/i.test(userCombinedText)) tipo = 'alugar';
    else if (/\bvend(er|a|o)?\b/i.test(userCombinedText)) tipo = 'vender';
    else if (/d[uú]vida/i.test(userCombinedText)) tipo = 'tirar dúvidas';
  }

  // Name candidate extraction: filter out pure greetings
  let nome = blockNome || '';
  if (!nome) {
    for (const msg of userMsgs) {
      const candidate = msg
        .replace(/^(meu\s+nome\s+[ée]|sou\s+o|sou\s+a|me\s+chamo|ol[áa]|oi|bom\s+dia|boa\s+tarde|boa\s+noite)\s*/i, '')
        .trim();
      const lower = candidate.toLowerCase();
      if (
        candidate.length >= 2 &&
        !['olá', 'ola', 'oi', 'tudo bem', 'sim', 'não', 'nao', 'ok', 'comprar', 'alugar', 'vender', 'tirar dúvidas'].includes(lower) &&
        !/\d{5}/.test(candidate)
      ) {
        nome = candidate;
        break;
      }
    }
  }

  const confirmationReq =
    fullText.toLowerCase().includes('confirma') &&
    (fullText.toLowerCase().includes('dados') || fullText.toLowerCase().includes('corretos'));
  const confirmed = userMsgs.some((m) => /sim|correto|pode|autorizo|confirmo|está certo|esta certo/i.test(m));
  const human = /(atendente\s*humano|falar\s*com\s*(um\s*)?humano|falar\s*com\s*(uma\s*)?pessoa|atendimento\s*humano)/i.test(userCombinedText);

  let produto = blockProduto;
  let obs = blockObs;

  // Search question-answer pairs if not in block
  for (let i = 0; i < safeMessages.length - 1; i++) {
    if (safeMessages[i]?.role === 'assistant' && safeMessages[i + 1]?.role === 'user') {
      const q = (safeMessages[i]?.content || '').toLowerCase();
      const a = (safeMessages[i + 1]?.content || '').trim();
      if ((q.includes('produto') || q.includes('tipo de imóvel') || q.includes('em mente')) && !produto) {
        produto = a;
      } else if (q.includes('observação') && !obs) {
        obs = a;
      }
    }
  }

  const isFinished = hasSummary || (confirmed && confirmationReq);

  let finalBlock = finalStructuredText;
  if (!finalBlock && isFinished) {
    finalBlock = `NOVO LEAD\n\nNome: ${nome || 'Cliente'}\nTelefone: ${
      detectedPhone || (whatsappAvailable ? whatsappNumber : 'Não informado')
    }\nTipo de atendimento: ${tipo || 'Interesse imobiliário'}\nProduto ou imóvel: ${
      produto || 'A definir'
    }\nObservações: ${obs || 'Nenhuma'}\nConsentimento para contato: Sim, autorizado pelo cliente conforme LGPD\nOrigem: Site via WhatsApp\nStatus: Aguardando contato do corretor`;
  }

  return {
    nome: nome || '',
    telefone: detectedPhone || '',
    tipoAtendimento: tipo || '',
    produtoImovel: produto || '',
    regiao: '',
    faixaPreco: '',
    melhorHorario: '',
    observacoes: obs || '',
    consentimento: isFinished || confirmed ? 'Sim, autorizado pelo cliente conforme LGPD' : '',
    origem: 'Site via WhatsApp',
    status: 'Aguardando contato do corretor',
    isComplete: isFinished,
    confirmationRequested: confirmationReq,
    confirmed,
    humanRequested: human,
    finalStructuredText: finalBlock,
  };
}

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', hasGeminiKey: Boolean(process.env.GEMINI_API_KEY) });
});

// Database status & health check
app.get('/api/db/status', async (req, res) => {
  try {
    const configured = isDbConfigured();
    const test = await testConnection();
    res.json({
      configured,
      ...test,
    });
  } catch (err: any) {
    res.status(500).json({ configured: false, success: false, error: err.message });
  }
});

// ==========================================
// Google Authentication & Whitelist Endpoints
// ==========================================

// Return Google Client ID for frontend GIS
app.get('/api/auth/config', (req, res) => {
  res.json({
    googleClientId: process.env.GOOGLE_CLIENT_ID || '',
    globalAdmin: GLOBAL_ADMIN_EMAIL,
  });
});

// Authenticate with Google ID Token & Whitelist check
app.post('/api/auth/google', async (req, res) => {
  try {
    const { credential } = req.body || {};
    const verifyRes = await verifyGoogleIdToken(credential);

    if (!verifyRes.success || !verifyRes.email) {
      return res.status(401).json({
        success: false,
        error: verifyRes.error || 'Autenticação Google falhou.',
      });
    }

    const authCheck = isEmailAuthorized(verifyRes.email);
    if (!authCheck.authorized) {
      return res.status(403).json({
        success: false,
        error: `O e-mail ${verifyRes.email} não possui autorização de acesso ao sistema Direct Houses. Entre em contato com o administrador (${GLOBAL_ADMIN_EMAIL}).`,
      });
    }

    const sessionUser = createSession({
      email: verifyRes.email,
      name: verifyRes.name || authCheck.user?.name || verifyRes.email.split('@')[0],
      picture: verifyRes.picture,
      role: authCheck.user?.role || 'user',
    });

    res.json({ success: true, user: sessionUser });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Erro ao processar login Google.' });
  }
});

// Direct email whitelist verification
app.post('/api/auth/direct-verify', (req, res) => {
  try {
    const { email } = req.body || {};
    const authCheck = isEmailAuthorized(email);

    if (!authCheck.authorized || !authCheck.user) {
      return res.status(403).json({
        success: false,
        error: `O e-mail ${email || ''} não possui autorização de acesso. Entre em contato com o administrador (${GLOBAL_ADMIN_EMAIL}).`,
      });
    }

    const sessionUser = createSession({
      email: authCheck.user.email,
      name: authCheck.user.name || authCheck.user.email.split('@')[0],
      role: authCheck.user.role || 'user',
    });

    res.json({ success: true, user: sessionUser });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get current logged-in user profile
app.get('/api/auth/me', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Não autenticado' });
  const user = getSessionUser(authHeader);
  if (!user) return res.status(401).json({ error: 'Sessão expirada ou inválida' });
  res.json({ success: true, user });
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader) deleteSession(authHeader);
  res.json({ success: true, message: 'Sessão encerrada com sucesso.' });
});

// List authorized users (Admin only)
app.get('/api/auth/users', (req, res) => {
  const authHeader = req.headers.authorization;
  const user = getSessionUser(authHeader || '');
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso restrito a administradores.' });
  }
  res.json(getAuthorizedUsers());
});

// Add authorized user to whitelist (Admin only)
app.post('/api/auth/users', (req, res) => {
  const authHeader = req.headers.authorization;
  const user = getSessionUser(authHeader || '');
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso restrito a administradores.' });
  }

  try {
    const { email, name, role } = req.body || {};
    if (!email) {
      return res.status(400).json({ error: 'E-mail é obrigatório.' });
    }
    const added = addAuthorizedUser({ email, name, role });
    res.json({ success: true, user: added, users: getAuthorizedUsers() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Remove authorized user from whitelist (Admin only)
app.delete('/api/auth/users/:email', (req, res) => {
  const authHeader = req.headers.authorization;
  const user = getSessionUser(authHeader || '');
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso restrito a administradores.' });
  }

  try {
    const { email } = req.params;
    removeAuthorizedUser(email);
    res.json({ success: true, users: getAuthorizedUsers(), message: 'Usuário removido da lista autorizada.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Initial greeting route
app.post('/api/greeting', (req, res) => {
  try {
    const { companyName } = req.body || {};
    const company = companyName || DEFAULT_COMPANY;
    const greeting = `Olá! Seja muito bem-vindo(a) à ${company}. Sou o assistente comercial virtual. Vou fazer algumas perguntas rápidas para entender suas preferências e encaminhá-lo ao corretor mais adequado para você. Para começarmos, qual é o seu nome completo?`;
    res.json({
      reply: greeting,
      quickReplies: [],
    });
  } catch (err: any) {
    res.json({
      reply: `Olá! Seja muito bem-vindo(a) à ${DEFAULT_COMPANY}. Sou o assistente comercial virtual. Para começarmos, qual é o seu nome completo?`,
      quickReplies: [],
    });
  }
});

// Main Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, companyName, whatsappAvailable, whatsappNumber } = req.body || {};
    const company = companyName || DEFAULT_COMPANY;
    const client = getGeminiClient();

    let replyText = '';
    let quickReplies: string[] = [];

    if (client) {
      try {
        const systemInstruction = buildSystemPrompt(company, Boolean(whatsappAvailable), whatsappNumber || '');
        const contents = (messages || []).map((m: { role: string; content: string }) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content || '' }],
        }));

        const geminiResponse = await generateWithFallback(client, {
          contents,
          config: {
            systemInstruction,
            temperature: 0.4,
            topP: 0.9,
          },
        });

        replyText = geminiResponse.text?.trim() || '';
        quickReplies = deduceQuickReplies(replyText);
      } catch (geminiErr: any) {
        console.warn('Gemini generate fallback invoked:', geminiErr?.message || geminiErr);
        const fallbackResult = fallbackRuleBasedAssistant(
          messages || [],
          company,
          Boolean(whatsappAvailable),
          whatsappNumber || ''
        );
        replyText = fallbackResult.reply;
        quickReplies = fallbackResult.quickReplies;
      }
    } else {
      const fallbackResult = fallbackRuleBasedAssistant(
        messages || [],
        company,
        Boolean(whatsappAvailable),
        whatsappNumber || ''
      );
      replyText = fallbackResult.reply;
      quickReplies = fallbackResult.quickReplies;
    }

    // Real-time structured lead update
    const allMsgsWithLatest = [...(messages || []), { role: 'assistant', content: replyText }];
    const extractedLead = parseLeadFromTranscriptLocally(
      allMsgsWithLatest,
      Boolean(whatsappAvailable),
      whatsappNumber || ''
    );

    res.json({
      reply: replyText,
      quickReplies,
      extractedLead,
    });
  } catch (err: any) {
    console.error('Fatal /api/chat error:', err);
    const safeCompany = req.body?.companyName || DEFAULT_COMPANY;
    res.json({
      reply: `Obrigado pelas informações! Estamos registrando seu contato para a equipe da ${safeCompany}. Um corretor especialista entrará em contato em breve.`,
      quickReplies: ['Obrigado!', 'No aguardo'],
      extractedLead: {
        nome: '',
        telefone: req.body?.whatsappNumber || '',
        tipoAtendimento: '',
        produtoImovel: '',
        regiao: '',
        faixaPreco: '',
        melhorHorario: '',
        observacoes: '',
        consentimento: 'Sim, autorizado conforme LGPD',
        origem: 'Site via WhatsApp',
        status: 'Aguardando contato do corretor',
        isComplete: false,
        confirmationRequested: false,
        confirmed: false,
        humanRequested: false,
        finalStructuredText: '',
      },
    });
  }
});

// Endpoint to force re-extraction or lead export
app.post('/api/extract-lead', async (req, res) => {
  try {
    const { messages, whatsappAvailable, whatsappNumber } = req.body;
    const extracted = await extractLeadStructured(messages || [], Boolean(whatsappAvailable), whatsappNumber || '');
    res.json(extracted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Automation Endpoint: Dispatches lead automatically to Make.com and/or Email
app.post('/api/automation/dispatch', async (req, res) => {
  try {
    const { lead, messages, companyName, automations } = req.body || {};

    if (!lead) {
      return res.status(200).json({
        success: false,
        error: 'Dados do lead não fornecidos.',
        results: {
          make: { attempted: false, success: false, message: 'Dados do lead não fornecidos.' },
          n8n: { attempted: false, success: false, message: 'Dados do lead não fornecidos.' },
          email: { attempted: false, success: false, message: 'Dados do lead não fornecidos.' },
        },
      });
    }

    const payload: LeadAutomationPayload = {
      companyName: companyName || DEFAULT_COMPANY,
      lead,
      messages: messages || [],
      timestamp: new Date().toISOString(),
    };

    const results: {
      make?: { attempted: boolean; success: boolean; message: string; statusCode?: number };
      n8n?: { attempted: boolean; success: boolean; message: string; statusCode?: number };
      email?: { attempted: boolean; success: boolean; message: string; messageId?: string };
    } = {};

    // 1. Dispatch to Make.com Webhook (Custom Webhook)
    const makeUrl =
      automations?.makeWebhookUrl ||
      automations?.n8nWebhookUrl ||
      process.env.MAKE_WEBHOOK_URL ||
      process.env.N8N_WEBHOOK_URL;
    const makeEnabled =
      Boolean(automations?.makeEnabled ?? automations?.n8nEnabled) ||
      Boolean(process.env.MAKE_WEBHOOK_URL || process.env.N8N_WEBHOOK_URL);

    if (makeEnabled && makeUrl) {
      const makeApiKey =
        automations?.makeApiKey ||
        automations?.n8nSecretToken ||
        process.env.MAKE_API_KEY ||
        process.env.N8N_WEBHOOK_SECRET;

      const makeRes = await dispatchToMake(makeUrl, makeApiKey, payload);
      results.make = {
        attempted: true,
        success: makeRes.success,
        message: makeRes.message,
        statusCode: makeRes.statusCode,
      };
      // Backward compatibility alias for n8n status listeners
      results.n8n = results.make;
    } else {
      results.make = {
        attempted: false,
        success: false,
        message: 'Webhook do Make.com desativado ou URL não configurada.',
      };
      results.n8n = results.make;
    }

    // 2. Dispatch to Email
    const emailEnabled = Boolean(automations?.emailEnabled) || Boolean(process.env.LEAD_EMAIL_RECIPIENTS);
    const emailRecipients = automations?.emailRecipients || process.env.LEAD_EMAIL_RECIPIENTS;

    if (emailEnabled && emailRecipients) {
      const smtpConfig: SmtpConfig = {
        host: automations?.smtpHost || process.env.SMTP_HOST,
        port: automations?.smtpPort || (process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587),
        user: automations?.smtpUser || process.env.SMTP_USER,
        pass: automations?.smtpPass || process.env.SMTP_PASS,
        secure: typeof automations?.smtpSecure === 'boolean' ? automations?.smtpSecure : undefined,
        senderName: automations?.smtpSenderName || `${companyName || DEFAULT_COMPANY} Leads`,
        from: process.env.SMTP_FROM,
      };

      const emailRes = await dispatchToEmail(smtpConfig, emailRecipients, payload);
      results.email = {
        attempted: true,
        success: emailRes.success,
        message: emailRes.message,
        messageId: emailRes.messageId,
      };
    } else {
      results.email = {
        attempted: false,
        success: false,
        message: 'Envio por e-mail desativado ou destinatários não configurados.',
      };
    }

    res.json({
      success: Boolean(
        (results.make?.attempted && results.make?.success) ||
        (results.email?.attempted && results.email?.success)
      ),
      results,
    });
  } catch (err: any) {
    console.error('Automation dispatch error:', err);
    res.json({
      success: false,
      error: err.message || 'Erro ao processar automações',
      results: {
        make: { attempted: false, success: false, message: err.message || 'Erro ao processar automações' },
        n8n: { attempted: false, success: false, message: err.message || 'Erro ao processar automações' },
        email: { attempted: false, success: false, message: err.message || 'Erro ao processar automações' },
      },
    });
  }
});

// Test Make.com Webhook Endpoint
app.post('/api/automation/test-make', async (req, res) => {
  try {
    const { webhookUrl, apiKey, secretToken, companyName } = req.body || {};
    const url = webhookUrl || req.body?.n8nWebhookUrl;
    if (!url || !url.trim()) {
      return res.json({ success: false, message: 'URL do Webhook do Make.com é obrigatória para teste.' });
    }

    const testPayload: LeadAutomationPayload = {
      companyName: companyName || DEFAULT_COMPANY,
      lead: {
        nome: 'Lead de Teste (Lucas Toledo)',
        telefone: '(21) 98765-4321',
        tipoAtendimento: 'comprar',
        produtoImovel: 'Apartamento de 3 quartos com varanda',
        observacoes: 'Teste de disparo automático para o Make.com',
        consentimento: 'Sim, autorizado conforme LGPD',
        origem: 'Teste de Automação Make.com',
        status: 'Aguardando contato do corretor',
        finalStructuredText: 'NOVO LEAD [TESTE MAKE.COM]\n\nNome: Lucas Toledo\nTelefone: (21) 98765-4321\nTipo: Comprar\nStatus: Teste Concluído',
      },
      messages: [
        { role: 'assistant', content: 'Olá! Qual é o seu nome completo?' },
        { role: 'user', content: 'Lucas Toledo' },
        { role: 'assistant', content: 'Qual tipo de imóvel você busca?' },
        { role: 'user', content: 'Apartamento de 3 quartos' },
      ],
      timestamp: new Date().toISOString(),
    };

    const token = apiKey || secretToken;
    const result = await dispatchToMake(url, token, testPayload);
    res.json(result);
  } catch (err: any) {
    res.json({ success: false, message: err.message || 'Erro ao testar conexão com Make.com' });
  }
});

// Test n8n Webhook Endpoint (backward compatibility)
app.post('/api/automation/test-n8n', async (req, res) => {
  try {
    const { webhookUrl, secretToken, companyName } = req.body || {};
    if (!webhookUrl || !webhookUrl.trim()) {
      return res.json({ success: false, message: 'URL do Webhook é obrigatória para teste.' });
    }

    const testPayload: LeadAutomationPayload = {
      companyName: companyName || DEFAULT_COMPANY,
      lead: {
        nome: 'Lead de Teste (Lucas Toledo)',
        telefone: '(21) 98765-4321',
        tipoAtendimento: 'comprar',
        produtoImovel: 'Apartamento de 3 quartos com varanda',
        observacoes: 'Teste de disparo automático',
        consentimento: 'Sim, autorizado conforme LGPD',
        origem: 'Teste de Automação',
        status: 'Aguardando contato do corretor',
        finalStructuredText: 'NOVO LEAD [TESTE]\n\nNome: Lead de Teste\nTelefone: (21) 98765-4321\nTipo: Comprar\nStatus: Teste Concluído',
      },
      messages: [
        { role: 'assistant', content: 'Olá! Qual é o seu nome completo?' },
        { role: 'user', content: 'Lucas Toledo' },
        { role: 'assistant', content: 'Qual tipo de imóvel você busca?' },
        { role: 'user', content: 'Apartamento de 3 quartos' },
      ],
      timestamp: new Date().toISOString(),
    };

    const result = await dispatchToMake(webhookUrl, secretToken, testPayload);
    res.json(result);
  } catch (err: any) {
    res.json({ success: false, message: err.message || 'Erro ao testar conexão' });
  }
});

// Test Email Endpoint
app.post('/api/automation/test-email', async (req, res) => {
  try {
    const { smtp, recipients, companyName } = req.body || {};
    if (!recipients || !recipients.trim()) {
      return res.json({ success: false, message: 'Pelo menos um e-mail de destinatário é necessário.' });
    }

    const testPayload: LeadAutomationPayload = {
      companyName: companyName || DEFAULT_COMPANY,
      lead: {
        nome: 'Lead de Teste (Lucas Toledo)',
        telefone: '(21) 98765-4321',
        tipoAtendimento: 'comprar',
        produtoImovel: 'Apartamento de 3 quartos com varanda',
        observacoes: 'Teste de disparo automático de e-mail',
        consentimento: 'Sim, autorizado conforme LGPD',
        origem: 'Teste de Automação E-mail',
        status: 'Aguardando contato do corretor',
        finalStructuredText: 'NOVO LEAD [TESTE E-MAIL]\n\nNome: Lead de Teste\nTelefone: (21) 98765-4321\nTipo: Comprar\nStatus: Teste Concluído',
      },
      messages: [
        { role: 'assistant', content: 'Olá! Qual é o seu nome completo?' },
        { role: 'user', content: 'Lucas Toledo' },
        { role: 'assistant', content: 'Qual tipo de imóvel você busca?' },
        { role: 'user', content: 'Apartamento de 3 quartos' },
      ],
      timestamp: new Date().toISOString(),
    };

    const smtpConfig: SmtpConfig = {
      host: smtp?.host || process.env.SMTP_HOST,
      port: smtp?.port || (process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587),
      user: smtp?.user || process.env.SMTP_USER,
      pass: smtp?.pass || process.env.SMTP_PASS,
      secure: typeof smtp?.secure === 'boolean' ? smtp.secure : undefined,
      senderName: smtp?.senderName || `${companyName || DEFAULT_COMPANY} Leads`,
      from: process.env.SMTP_FROM,
    };

    const result = await dispatchToEmail(smtpConfig, recipients, testPayload);
    res.json(result);
  } catch (err: any) {
    res.json({ success: false, message: err.message || 'Erro ao testar envio de e-mail via SMTP' });
  }
});

// ==========================================
// WhatsApp Web Integration Endpoints
// ==========================================

// Get current WhatsApp connection status & QR code
app.get('/api/whatsapp/status', (req, res) => {
  res.json(whatsAppService.getStatus());
});

// Start WhatsApp connection (initializes socket & generates QR code)
app.post('/api/whatsapp/connect', async (req, res) => {
  try {
    const force = Boolean(req.body?.force || req.query?.force);
    const status = await whatsAppService.connect(force);
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao conectar WhatsApp' });
  }
});

// Disconnect WhatsApp session
app.post('/api/whatsapp/disconnect', async (req, res) => {
  try {
    await whatsAppService.disconnect();
    res.json({ success: true, message: 'WhatsApp desconectado com sucesso.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao desconectar WhatsApp' });
  }
});

// Send test message via WhatsApp
app.post(['/api/whatsapp/send-test', '/api/whatsapp/test-send'], async (req, res) => {
  try {
    const { phone, message } = req.body || {};
    if (!phone) {
      return res.status(400).json({ success: false, message: 'Número de telefone é obrigatório.' });
    }
    const textToSend = message || 'Teste de envio automático do Assistente Comercial Direct Houses.';
    const result = await whatsAppService.sendTextMessage(phone, textToSend);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Erro ao enviar mensagem' });
  }
});

// Get all active WhatsApp live chat sessions
app.get('/api/whatsapp/chats', (req, res) => {
  res.json(getAllWhatsAppSessions());
});

// Manual dispatch of a WhatsApp chat session to a broker
app.post('/api/whatsapp/chats/:jid/dispatch', async (req, res) => {
  try {
    const { jid } = req.params;
    const { brokerId, companyName } = req.body || {};
    const company = companyName || DEFAULT_COMPANY;

    if (brokerId) {
      const result = await dispatchSessionLeadToSpecificBroker(jid, brokerId, company);
      return res.json(result);
    } else {
      const session = getWhatsAppSession(jid);
      if (!session) {
        return res.status(404).json({ success: false, message: 'Sessão não encontrada.' });
      }
      const result = await dispatchSessionLeadToRoleta(session, company);
      return res.json(result);
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Erro ao encaminhar sessão' });
  }
});

// ==========================================
// Persistent Leads Management & CRM Endpoints
// ==========================================

// Get all persistent leads with optional filters
app.get('/api/leads', (req, res) => {
  try {
    let leads = getPersistentLeads();
    const { search, status, temperatura, brokerId } = req.query as Record<string, string>;

    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      leads = leads.filter(
        (l) =>
          (l.nome && l.nome.toLowerCase().includes(q)) ||
          (l.telefone && l.telefone.includes(q)) ||
          (l.produtoImovel && l.produtoImovel.toLowerCase().includes(q)) ||
          (l.tipoAtendimento && l.tipoAtendimento.toLowerCase().includes(q)) ||
          (l.assignedBroker?.name && l.assignedBroker.name.toLowerCase().includes(q))
      );
    }

    if (status && status !== 'all') {
      leads = leads.filter((l) => (l.status || '').toLowerCase() === status.toLowerCase());
    }

    if (temperatura && temperatura !== 'all') {
      leads = leads.filter((l) => (l.temperatura || '').toLowerCase() === temperatura.toLowerCase());
    }

    if (brokerId && brokerId !== 'all') {
      leads = leads.filter((l) => l.assignedBroker?.id === brokerId);
    }

    res.json(leads);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get Leads Metrics
app.get('/api/leads/metrics', (req, res) => {
  try {
    res.json(getLeadsMetrics());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Export Leads in CSV format (UTF-8 with BOM for Excel)
app.get('/api/leads/export/csv', (req, res) => {
  try {
    const leads = getPersistentLeads();
    const header = [
      'ID',
      'Data de Criação',
      'Nome do Cliente',
      'Telefone',
      'Email',
      'Etapa/Status',
      'Temperatura',
      'Tipo de Atendimento',
      'Imóvel/Produto',
      'Valor de Interesse',
      'Corretor Atribuído',
      'Telefone do Corretor',
      'Origem',
      'Observações',
    ];

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = leads.map((l) => [
      l.id,
      new Date(l.createdAt).toLocaleString('pt-BR'),
      l.nome,
      l.telefone,
      l.email || '',
      l.status,
      l.temperatura || 'morno',
      l.tipoAtendimento,
      l.produtoImovel,
      l.valorInteresse || '',
      l.assignedBroker?.name || 'Não Atribuído',
      l.assignedBroker?.phone || '',
      l.origem,
      l.observacoes,
    ]);

    const csvContent = '\uFEFF' + [header, ...rows].map((r) => r.map(escapeCsv).join(';')).join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="leads-direct-houses.csv"');
    res.send(csvContent);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Save or create new lead
app.post('/api/leads', (req, res) => {
  try {
    const lead = recordLead(req.body || {});
    res.json(lead);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update lead details
app.put('/api/leads/:id', (req, res) => {
  try {
    const updated = updateLead(req.params.id, req.body || {});
    if (!updated) {
      return res.status(404).json({ error: 'Lead não encontrado.' });
    }
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Quick update of lead stage/status (Kanban drag or stage select)
app.patch('/api/leads/:id/stage', (req, res) => {
  try {
    const { stage } = req.body || {};
    if (!stage) {
      return res.status(400).json({ error: 'Etapa é obrigatória.' });
    }
    const updated = updateLeadStage(req.params.id, stage);
    if (!updated) {
      return res.status(404).json({ error: 'Lead não encontrado.' });
    }
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Add internal note to a lead
app.post('/api/leads/:id/notes', (req, res) => {
  try {
    const { texto, autor } = req.body || {};
    if (!texto || !texto.trim()) {
      return res.status(400).json({ error: 'Texto da nota é obrigatório.' });
    }
    const updated = addLeadNote(req.params.id, { texto, autor: autor || 'Equipe Comercial' });
    if (!updated) {
      return res.status(404).json({ error: 'Lead não encontrado.' });
    }
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Redistribute an existing lead in the Roleta (to next broker or specific broker)
app.post('/api/leads/:id/redistribute', async (req, res) => {
  try {
    const { id } = req.params;
    const { brokerId, motivo, companyName } = req.body || {};
    const company = companyName || DEFAULT_COMPANY;

    const leads = getPersistentLeads();
    const lead = leads.find((l) => l.id === id);
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead não encontrado.' });
    }

    let broker: any = null;
    if (brokerId) {
      const brokers = getBrokers();
      broker = brokers.find((b) => b.id === brokerId);
    } else {
      broker = getNextBrokerInRoleta();
    }

    if (!broker) {
      return res.status(400).json({ success: false, message: 'Nenhum corretor ativo disponível na roleta.' });
    }

    const brokerMessage = formatBrokerLeadMessage(
      {
        nome: lead.nome,
        telefone: lead.telefone,
        tipoAtendimento: lead.tipoAtendimento,
        produtoImovel: lead.produtoImovel,
        observacoes: `${lead.observacoes || ''}\n[Redistribuição: ${motivo || 'Reatribuição pela gerência comercial'}]`,
        origem: lead.origem,
        trilhaNavegacao: lead.trilhaNavegacao,
        resumoNavegacao: lead.resumoNavegacao,
        historicoMensagens: lead.historicoMensagens,
      },
      company,
      lead.telefone
    );

    let sentViaWhatsApp = false;
    let whatsappError = '';
    const waStatus = whatsAppService.getStatus();

    if (waStatus.state === 'connected') {
      const sendRes = await whatsAppService.sendTextMessage(broker.phone, brokerMessage);
      sentViaWhatsApp = sendRes.success;
      if (!sendRes.success) whatsappError = sendRes.error || '';
    }

    // Record in Roleta Distribution History
    const distLog = recordDistributionLog({
      leadId: lead.id,
      leadNome: lead.nome,
      leadTelefone: lead.telefone,
      brokerId: broker.id,
      brokerNome: broker.name,
      brokerTelefone: broker.phone,
      tipoDistribuicao: 'redistribuicao',
      statusEnvioWhatsApp: sentViaWhatsApp ? 'enviado' : 'link_gerado',
      motivo: motivo || 'Redistribuição manual solicitada pelo operador',
      produtoImovel: lead.produtoImovel,
    });

    // Update lead with distribution record
    const updatedLead = addLeadDistribution(lead.id, {
      brokerId: broker.id,
      brokerName: broker.name,
      brokerPhone: broker.phone,
      tipo: 'redistribuicao',
      statusEnvioWhatsApp: sentViaWhatsApp ? 'enviado' : 'link_gerado',
    });

    res.json({
      success: true,
      lead: updatedLead,
      broker,
      sentViaWhatsApp,
      whatsappError: whatsappError || undefined,
      distLog,
      waLink: `https://wa.me/${broker.phone}?text=${encodeURIComponent(brokerMessage)}`,
      message: sentViaWhatsApp
        ? `Lead redistribuído com sucesso para ${broker.name} via WhatsApp!`
        : `Lead redistribuído para ${broker.name}. (WhatsApp desconectado, link direto gerado).`,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Erro ao redistribuir lead' });
  }
});

// Delete specific lead
app.delete('/api/leads/:id', (req, res) => {
  try {
    const success = deletePersistentLead(req.params.id);
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Clear all leads
app.delete('/api/leads', (req, res) => {
  try {
    const success = clearAllPersistentLeads();
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// Histórico de Distribuição na Roleta Endpoints
// ==========================================

// Get Roleta distribution history
app.get('/api/roleta/history', (req, res) => {
  try {
    let history = getRoletaDistributionHistory();
    const { brokerId, search, statusEnvio } = req.query as Record<string, string>;

    if (brokerId && brokerId !== 'all') {
      history = history.filter((h) => h.brokerId === brokerId);
    }
    if (statusEnvio && statusEnvio !== 'all') {
      history = history.filter((h) => h.statusEnvioWhatsApp === statusEnvio);
    }
    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      history = history.filter(
        (h) =>
          h.leadNome.toLowerCase().includes(q) ||
          h.leadTelefone.includes(q) ||
          h.brokerNome.toLowerCase().includes(q) ||
          (h.motivo && h.motivo.toLowerCase().includes(q)) ||
          (h.produtoImovel && h.produtoImovel.toLowerCase().includes(q))
      );
    }

    res.json({
      history,
      stats: getRoletaDistributionStats(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get Roleta distribution stats
app.get('/api/roleta/history/stats', (req, res) => {
  try {
    res.json(getRoletaDistributionStats());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Clear Roleta distribution history (Admin)
app.delete('/api/roleta/history', (req, res) => {
  try {
    const success = clearRoletaDistributionHistory();
    res.json({ success, message: 'Histórico da roleta reiniciado com sucesso.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Export Roleta distribution history to CSV
app.get('/api/roleta/history/export/csv', (req, res) => {
  try {
    const history = getRoletaDistributionHistory();
    const header = [
      'ID Distribuição',
      'Data e Hora',
      'Nome do Lead',
      'Telefone do Lead',
      'Imóvel de Interesse',
      'Corretor que Recebeu',
      'Telefone do Corretor',
      'Tipo de Distribuição',
      'Envio no WhatsApp',
      'Motivo / Observação',
      'Tempo de Resposta SLA',
    ];

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = history.map((h) => [
      h.id,
      new Date(h.timestamp).toLocaleString('pt-BR'),
      h.leadNome,
      h.leadTelefone,
      h.produtoImovel || '',
      h.brokerNome,
      h.brokerTelefone,
      h.tipoDistribuicao,
      h.statusEnvioWhatsApp,
      h.motivo || '',
      h.tempoSLA || '',
    ]);

    const csvContent = '\uFEFF' + [header, ...rows].map((r) => r.map(escapeCsv).join(';')).join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="historico-roleta-direct-houses.csv"');
    res.send(csvContent);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// Lançamentos Imobiliários & Governança de Dados
// ==========================================

// Get all lançamentos (Base completa com histórico)
app.get('/api/lancamentos', (req, res) => {
  try {
    res.json(getLancamentos());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get public catalog for AI (Base de Conteúdo Publicável)
app.get('/api/lancamentos/public-ai', (req, res) => {
  try {
    res.json(getPublicLancamentosForAI());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Add new lançamento com governança e versionamento
app.post('/api/lancamentos', (req, res) => {
  try {
    const { nome, bairro, usuarioResponsavel } = req.body || {};
    if (!nome || !bairro) {
      return res.status(400).json({ error: 'Nome do empreendimento e bairro são obrigatórios.' });
    }
    const item = addLancamento(req.body, usuarioResponsavel || 'Equipe Direct House');
    res.json(item);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update lançamento com auditoria de versão
app.put('/api/lancamentos/:id', (req, res) => {
  try {
    const { usuarioResponsavel } = req.body || {};
    const updated = updateLancamento(req.params.id, req.body || {}, usuarioResponsavel || 'Equipe Direct House');
    if (!updated) {
      return res.status(404).json({ error: 'Lançamento não encontrado.' });
    }
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update status rápido do catálogo (Ativo, Inativo, Em processamento, Atualização pendente, Arquivado)
app.patch('/api/lancamentos/:id/status', (req, res) => {
  try {
    const { status, usuarioResponsavel } = req.body || {};
    if (!status) {
      return res.status(400).json({ error: 'Status é obrigatório.' });
    }
    const updated = updateLancamento(
      req.params.id,
      { status },
      usuarioResponsavel || 'Equipe Direct House'
    );
    if (!updated) {
      return res.status(404).json({ error: 'Lançamento não encontrado.' });
    }
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete lançamento
app.delete('/api/lancamentos/:id', (req, res) => {
  try {
    const success = deleteLancamento(req.params.id);
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Executa suíte de 12 testes de governança e segurança da IA
app.post('/api/lancamentos/governance-test', (req, res) => {
  try {
    const results = runGovernanceSecurityTests();
    const allPassed = results.every((t) => t.passed);
    res.json({
      success: allPassed,
      totalTests: results.length,
      passedCount: results.filter((t) => t.passed).length,
      tests: results,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Simula auditoria de texto em tempo real com o filtro DLP
app.post('/api/lancamentos/simulate-audit', (req, res) => {
  try {
    const { prompt, generatedText, companyName } = req.body || {};
    const audit = sanitizeAndAuditAIResponse(
      generatedText || prompt || '',
      prompt || '',
      companyName || 'Direct Houses'
    );
    res.json(audit);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Lista o histórico de violações e tentativas de vazamento bloqueadas pela IA (DLP Audit Log)
app.get('/api/lancamentos/violations', (req, res) => {
  try {
    res.json(getAIViolations());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Limpa o registro de violações de IA
app.delete('/api/lancamentos/violations', (req, res) => {
  try {
    clearAIViolations();
    res.json({ success: true, message: 'Log de violações DLP limpo com sucesso.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Upload direto de arquivos (Fotos e Book PDF) para armazenamento local e envio no WhatsApp
app.post('/api/upload', async (req, res) => {
  try {
    const { filename, dataUrl, type } = req.body || {};
    if (!filename || !dataUrl) {
      return res.status(400).json({ error: 'Arquivo inválido ou ausente.' });
    }

    // Extract base64 data
    const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    let buffer: Buffer;
    let mimeType = 'application/octet-stream';

    if (matches && matches.length === 3) {
      mimeType = matches[1];
      buffer = Buffer.from(matches[2], 'base64');
    } else {
      buffer = Buffer.from(dataUrl, 'base64');
    }

    const cleanName = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
    const uniqueName = `${Date.now()}_${cleanName}`;
    const filePath = path.join(UPLOAD_DIR, uniqueName);

    fs.writeFileSync(filePath, buffer);

    const publicUrl = `/uploads/${uniqueName}`;

    res.json({
      success: true,
      filename: uniqueName,
      originalName: filename,
      url: publicUrl,
      path: filePath,
      size: buffer.length,
      mimeType,
      type: type || (mimeType.startsWith('image/') ? 'image' : 'document'),
    });
  } catch (err: any) {
    console.error('Erro no upload de arquivo:', err);
    res.status(500).json({ error: err.message || 'Erro ao processar upload.' });
  }
});

// ==========================================
// Broker Management & Roleta Endpoints
// ==========================================

// Get all brokers
app.get('/api/brokers', (req, res) => {
  res.json(getBrokers());
});

// Add new broker
app.post('/api/brokers', (req, res) => {
  try {
    const { name, phone, email, active } = req.body || {};
    if (!name || !phone) {
      return res.status(400).json({ error: 'Nome e telefone são obrigatórios.' });
    }
    const broker = addBroker({ name, phone, email, active });
    res.json(broker);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update existing broker
app.put('/api/brokers/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updated = updateBroker(id, req.body || {});
    if (!updated) {
      return res.status(404).json({ error: 'Corretor não encontrado.' });
    }
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete broker
app.delete('/api/brokers/:id', (req, res) => {
  try {
    const { id } = req.params;
    deleteBroker(id);
    res.json({ success: true, brokers: getBrokers(), message: 'Corretor removido com sucesso.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get Roleta configuration
app.get('/api/roleta/config', (req, res) => {
  res.json(getRoletaConfig());
});

// Update Roleta configuration
app.post('/api/roleta/config', (req, res) => {
  try {
    const updated = saveRoletaConfig(req.body || {});
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Dispatch any lead (from web UI or system) to the next Roleta broker or specific broker
app.post('/api/roleta/dispatch-lead', async (req, res) => {
  try {
    const { lead, brokerId, companyName } = req.body || {};
    const company = companyName || DEFAULT_COMPANY;

    if (!lead) {
      return res.status(400).json({ success: false, message: 'Dados do lead não fornecidos.' });
    }

    let broker: any = null;
    if (brokerId) {
      const brokers = getBrokers();
      broker = brokers.find((b) => b.id === brokerId);
    } else {
      broker = getNextBrokerInRoleta();
    }

    if (!broker) {
      return res.status(400).json({
        success: false,
        message: 'Nenhum corretor disponível ou ativo na fila.',
      });
    }

    const brokerMessage = formatBrokerLeadMessage(lead, company, lead.telefone);
    const waStatus = whatsAppService.getStatus();

    let sentViaWhatsApp = false;
    let whatsappError = '';

    if (waStatus.state === 'connected') {
      const sendRes = await whatsAppService.sendTextMessage(broker.phone, brokerMessage);
      sentViaWhatsApp = sendRes.success;
      if (!sendRes.success) {
        whatsappError = sendRes.error || '';
      }
    }

    // Record distribution log in history
    const distLog = recordDistributionLog({
      leadId: lead.id || `lead-${Date.now()}`,
      leadNome: lead.nome || 'Cliente',
      leadTelefone: lead.telefone || '',
      brokerId: broker.id,
      brokerNome: broker.name,
      brokerTelefone: broker.phone,
      tipoDistribuicao: brokerId ? 'manual_operador' : 'automatica_roleta',
      statusEnvioWhatsApp: sentViaWhatsApp ? 'enviado' : 'link_gerado',
      motivo: brokerId ? 'Direcionamento manual para corretor' : 'Distribuição via Roleta de Atendimento',
      produtoImovel: lead.produtoImovel,
    });

    // If lead exists in persistent leads, update it with broker assignment
    if (lead.id) {
      addLeadDistribution(lead.id, {
        brokerId: broker.id,
        brokerName: broker.name,
        brokerPhone: broker.phone,
        tipo: brokerId ? 'manual_operador' : 'automatica_roleta',
        statusEnvioWhatsApp: sentViaWhatsApp ? 'enviado' : 'link_gerado',
      });
    }

    res.json({
      success: true,
      broker,
      distLog,
      sentViaWhatsApp,
      whatsappError: whatsappError || undefined,
      formattedMessage: brokerMessage,
      waLink: `https://wa.me/${broker.phone}?text=${encodeURIComponent(brokerMessage)}`,
      message: sentViaWhatsApp
        ? `Lead enviado diretamente para o WhatsApp de ${broker.name} (${broker.phone})!`
        : `Lead direcionado para ${broker.name}. (WhatsApp não conectado no momento, link direto disponível).`,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Erro ao processar envio para corretor' });
  }
});

// Test Roleta dispatch with mock lead
app.post('/api/roleta/test-dispatch', async (req, res) => {
  try {
    const { brokerId, companyName } = req.body || {};
    const testLead = {
      nome: 'Lead de Teste (Lucas Toledo)',
      telefone: '21987654321',
      tipoAtendimento: 'comprar',
      produtoImovel: 'Apartamento de 3 quartos com varanda e vaga',
      observacoes: 'Teste de distribuição em Roleta para corretores',
      origem: 'Teste Painel Web Direct Houses',
    };

    const company = companyName || DEFAULT_COMPANY;
    let broker: any = null;

    if (brokerId) {
      const brokers = getBrokers();
      broker = brokers.find((b) => b.id === brokerId);
    } else {
      broker = getNextBrokerInRoleta();
    }

    if (!broker) {
      return res.json({ success: false, message: 'Nenhum corretor ativo na fila.' });
    }

    const brokerMessage = formatBrokerLeadMessage(testLead, company, testLead.telefone);
    const waStatus = whatsAppService.getStatus();

    let sentViaWhatsApp = false;
    if (waStatus.state === 'connected') {
      const sendRes = await whatsAppService.sendTextMessage(broker.phone, brokerMessage);
      sentViaWhatsApp = sendRes.success;
    }

    // Log test distribution
    recordDistributionLog({
      leadId: `test-lead-${Date.now()}`,
      leadNome: testLead.nome,
      leadTelefone: testLead.telefone,
      brokerId: broker.id,
      brokerNome: broker.name,
      brokerTelefone: broker.phone,
      tipoDistribuicao: brokerId ? 'manual_operador' : 'automatica_roleta',
      statusEnvioWhatsApp: sentViaWhatsApp ? 'enviado' : 'link_gerado',
      motivo: 'Disparo de teste da Roleta via painel web',
      produtoImovel: testLead.produtoImovel,
    });

    res.json({
      success: true,
      broker,
      sentViaWhatsApp,
      formattedMessage: brokerMessage,
      message: sentViaWhatsApp
        ? `Mensagem de teste enviada com sucesso para o WhatsApp de ${broker.name}!`
        : `Corretor selecionado: ${broker.name}. Conecte o WhatsApp para disparo direto.`,
    });
  } catch (err: any) {
    res.json({ success: false, message: err.message || 'Erro ao testar envio' });
  }
});

// Fallback for unmatched API routes - ALWAYS return JSON 404, never fallback to SPA HTML
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: 'Endpoint não encontrado', path: req.path });
});

// Keep the process alive on unexpected errors (PM2 can still restart if it exits)
process.on('unhandledRejection', (reason) => {
  console.error('[Process] unhandledRejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[Process] uncaughtException:', err);
});

// Vite middleware setup
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    // Auto-connect WhatsApp if saved session exists
    try {
      const authCredsPath = path.join(process.cwd(), '.whatsapp_auth', 'creds.json');
      if (fs.existsSync(authCredsPath)) {
        console.log('📱 [WhatsApp] Sessão salva encontrada. Conectando automaticamente...');
        whatsAppService.connect();
      }
    } catch (e) {
      console.warn('Erro ao verificar sessão salva do WhatsApp:', e);
    }
  });
}

startServer();
