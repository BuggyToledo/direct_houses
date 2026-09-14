import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { dispatchToMake, dispatchToN8n, dispatchToEmail, SmtpConfig, LeadAutomationPayload } from './server-automation';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

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
  });
}

startServer();
