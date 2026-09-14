import nodemailer from 'nodemailer';

export interface SmtpConfig {
  host?: string;
  port?: number;
  user?: string;
  pass?: string;
  secure?: boolean;
  senderName?: string;
  from?: string;
}

export interface LeadAutomationPayload {
  companyName: string;
  lead: {
    nome: string;
    telefone: string;
    tipoAtendimento: string;
    produtoImovel: string;
    observacoes: string;
    consentimento: string;
    origem: string;
    status: string;
    finalStructuredText?: string;
  };
  messages: Array<{ role: string; content: string; timestamp?: string }>;
  timestamp?: string;
}

/**
 * Clean phone number for international WhatsApp link
 */
function formatWhatsAppUrl(rawPhone: string): string {
  const digits = (rawPhone || '').replace(/\D/g, '');
  if (!digits) return '';
  // If Brazilian number without country code, prepend 55
  const fullDigits = digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${fullDigits}`;
}

/**
 * Dispatches the qualified lead to Make.com Webhook (Custom Webhook)
 */
export async function dispatchToMake(
  webhookUrl: string,
  apiKeyOrSecret: string | undefined,
  data: LeadAutomationPayload
): Promise<{ success: boolean; statusCode?: number; message: string }> {
  if (!webhookUrl || !webhookUrl.trim()) {
    return {
      success: false,
      message: 'URL do Webhook do Make.com não configurada.',
    };
  }

  const url = webhookUrl.trim();
  const cleanPhone = (data.lead.telefone || '').replace(/\D/g, '');
  const waLink = formatWhatsAppUrl(data.lead.telefone);

  const payload = {
    event: 'novo_lead_qualificado',
    plataforma: 'Make.com',
    origem: data.lead.origem || 'Site via WhatsApp',
    imobiliaria: data.companyName || 'Direct Houses',
    timestamp: data.timestamp || new Date().toISOString(),
    lead: {
      nome: data.lead.nome || 'Não informado',
      telefone: data.lead.telefone || 'Não informado',
      tipoAtendimento: data.lead.tipoAtendimento || 'Não informado',
      produtoImovel: data.lead.produtoImovel || 'Não informado',
      observacoes: data.lead.observacoes || 'Nenhuma',
      consentimento: data.lead.consentimento || 'Sim, autorizado conforme LGPD',
      status: data.lead.status || 'Aguardando contato do corretor',
      telefoneApenasDigitos: cleanPhone,
      linkWhatsAppDireto: waLink,
    },
    textoEstruturado:
      data.lead.finalStructuredText ||
      `NOVO LEAD\n\nNome: ${data.lead.nome}\nTelefone: ${data.lead.telefone}\nTipo de atendimento: ${data.lead.tipoAtendimento}\nProduto ou imóvel: ${data.lead.produtoImovel}\nObservações: ${data.lead.observacoes}\nConsentimento para contato: Sim, autorizado conforme LGPD\nOrigem: Site via WhatsApp\nStatus: Aguardando contato do corretor`,
    historicoConversa: (data.messages || []).map((m) => ({
      origem: m.role === 'assistant' ? 'Assistente Virtual' : 'Cliente Lead',
      mensagem: m.content,
      hora: m.timestamp || '',
    })),
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'DirectHouses-Make-Integration/1.0',
  };

  if (apiKeyOrSecret && apiKeyOrSecret.trim()) {
    const token = apiKeyOrSecret.trim();
    headers['Authorization'] = `Bearer ${token}`;
    headers['x-make-apikey'] = token;
    headers['x-webhook-token'] = token;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseText = await response.text();

    if (response.ok) {
      return {
        success: true,
        statusCode: response.status,
        message: `Disparado com sucesso para o Make.com (HTTP ${response.status}: ${responseText.trim() || 'Accepted'})`,
      };
    } else {
      return {
        success: false,
        statusCode: response.status,
        message: `Make.com respondeu com erro HTTP ${response.status}: ${responseText.slice(0, 150)}`,
      };
    }
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      return {
        success: false,
        message: 'Tempo limite esgotado ao conectar ao Webhook do Make.com (Timeout 10s).',
      };
    }
    return {
      success: false,
      message: `Falha ao conectar com Make.com: ${err.message || String(err)}`,
    };
  }
}

/**
 * Backward compatibility alias for dispatchToMake
 */
export const dispatchToN8n = dispatchToMake;

/**
 * Builds HTML Email Template for Lead Notification
 */
function buildLeadEmailHtml(data: LeadAutomationPayload): string {
  const { lead, companyName, messages } = data;
  const waLink = formatWhatsAppUrl(lead.telefone);

  const transcriptRows = (messages || [])
    .map((m) => {
      const isAssistant = m.role === 'assistant';
      return `
        <div style="margin-bottom: 12px; padding: 10px 14px; border-radius: 8px; background: ${
          isAssistant ? '#f1f5f9' : '#e0f2fe'
        }; border-left: 4px solid ${isAssistant ? '#64748b' : '#0284c7'};">
          <div style="font-size: 11px; font-weight: bold; color: ${
            isAssistant ? '#475569' : '#0369a1'
          }; margin-bottom: 3px;">
            ${isAssistant ? 'Assistente Virtual (' + companyName + ')' : 'Cliente (' + (lead.nome || 'Lead') + ')'}
          </div>
          <div style="font-size: 13px; color: #1e293b; line-height: 1.5; white-space: pre-wrap;">${escapeHtml(
            m.content
          )}</div>
        </div>
      `;
    })
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Novo Lead Qualificado</title>
</head>
<body style="margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #0f172a;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    
    <!-- Top Header -->
    <div style="background: #0f172a; padding: 24px; text-align: center; color: #ffffff;">
      <div style="display: inline-block; padding: 4px 12px; border-radius: 9999px; background: rgba(16, 185, 129, 0.2); color: #34d399; font-size: 12px; font-weight: 600; margin-bottom: 8px; border: 1px solid rgba(16, 185, 129, 0.3);">
        ✦ LEAD QUALIFICADO AUTOMATICAMENTE
      </div>
      <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #ffffff;">${escapeHtml(companyName)}</h1>
      <p style="margin: 6px 0 0 0; font-size: 13px; color: #94a3b8;">Notificação imediata para plantão de vendas e corretores</p>
    </div>

    <!-- Main Content -->
    <div style="padding: 24px;">
      
      <!-- Lead Highlights Card -->
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 24px;">
        <h2 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 700; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
          Ficha do Cliente
        </h2>

        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 6px 0; color: #64748b; width: 35%; font-weight: 500;">Nome:</td>
            <td style="padding: 6px 0; color: #0f172a; font-weight: 700;">${escapeHtml(lead.nome || 'Não informado')}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b; font-weight: 500;">Telefone:</td>
            <td style="padding: 6px 0; color: #0f172a; font-weight: 700;">
              ${escapeHtml(lead.telefone || 'Não informado')}
            </td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b; font-weight: 500;">Tipo de Atendimento:</td>
            <td style="padding: 6px 0; color: #0284c7; font-weight: 700; text-transform: uppercase;">
              ${escapeHtml(lead.tipoAtendimento || 'Não informado')}
            </td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b; font-weight: 500;">Imóvel / Interesse:</td>
            <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">${escapeHtml(lead.produtoImovel || 'Não informado')}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b; font-weight: 500;">Observações:</td>
            <td style="padding: 6px 0; color: #0f172a;">${escapeHtml(lead.observacoes || 'Nenhuma')}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b; font-weight: 500;">Consentimento LGPD:</td>
            <td style="padding: 6px 0; color: #059669; font-weight: 600;">Sim, autorizado pelo cliente</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b; font-weight: 500;">Origem:</td>
            <td style="padding: 6px 0; color: #475569;">Site via WhatsApp</td>
          </tr>
        </table>
      </div>

      <!-- Quick Action Buttons -->
      ${
        waLink
          ? `
      <div style="text-align: center; margin-bottom: 24px;">
        <a href="${waLink}" target="_blank" style="display: inline-block; background: #25d366; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 14px; padding: 14px 28px; border-radius: 10px; box-shadow: 0 4px 6px rgba(37, 211, 102, 0.2);">
          💬 Abrir Conversa no WhatsApp do Cliente
        </a>
        <div style="font-size: 12px; color: #64748b; margin-top: 6px;">Clique para iniciar o contato com o lead imediatamente</div>
      </div>
      `
          : ''
      }

      <!-- Formatted Output Block -->
      <div style="margin-bottom: 24px;">
        <div style="font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 8px;">
          Texto Padronizado para Copiar e Colar no CRM:
        </div>
        <pre style="background: #0f172a; color: #f1f5f9; padding: 14px; border-radius: 8px; font-size: 12px; font-family: monospace; white-space: pre-wrap; margin: 0; line-height: 1.4;">${escapeHtml(
          data.lead.finalStructuredText ||
            `NOVO LEAD\n\nNome: ${lead.nome}\nTelefone: ${lead.telefone}\nTipo de atendimento: ${lead.tipoAtendimento}\nProduto ou imóvel: ${lead.produtoImovel}\nObservações: ${lead.observacoes}\nConsentimento para contato: Sim, autorizado pelo cliente conforme LGPD\nOrigem: Site via WhatsApp\nStatus: Aguardando contato do corretor`
        )}</pre>
      </div>

      <!-- Transcript Section -->
      <div>
        <div style="font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 10px;">
          Transcrição Completa da Conversa:
        </div>
        <div style="max-height: 300px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background: #ffffff;">
          ${transcriptRows}
        </div>
      </div>

    </div>

    <!-- Footer -->
    <div style="background: #f1f5f9; padding: 16px 24px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0;">
      Este e-mail foi enviado automaticamente pelo <strong>Assistente Comercial de Atendimento</strong> da ${escapeHtml(
        companyName
      )}.<br>
      Conforme diretrizes da LGPD (Lei Geral de Proteção de Dados).
    </div>

  </div>
</body>
</html>
  `;
}

function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Dispatches the qualified lead via Email (Nodemailer / SMTP)
 */
export async function dispatchToEmail(
  smtpConfig: SmtpConfig,
  recipients: string,
  data: LeadAutomationPayload
): Promise<{ success: boolean; messageId?: string; message: string }> {
  const host = smtpConfig.host || process.env.SMTP_HOST;
  const user = smtpConfig.user || process.env.SMTP_USER;
  const pass = smtpConfig.pass || process.env.SMTP_PASS;
  const port = smtpConfig.port || (process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587);
  const secure = typeof smtpConfig.secure === 'boolean' ? smtpConfig.secure : port === 465;
  const senderName = smtpConfig.senderName || `${data.companyName} Leads`;
  const fromAddress = smtpConfig.from || user || process.env.SMTP_FROM || 'leads@directhouses.com.br';

  const toRecipients = recipients || process.env.LEAD_EMAIL_RECIPIENTS;

  if (!toRecipients || !toRecipients.trim()) {
    return {
      success: false,
      message: 'Nenhum e-mail de destinatário configurado para receber os leads.',
    };
  }

  if (!host || !user || !pass) {
    return {
      success: false,
      message:
        'Servidor SMTP não configurado completamente (preencha Host, Usuário e Senha de Aplicativo nas Configurações).',
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
      tls: {
        rejectUnauthorized: false, // Prevents self-signed cert blocks on custom mail servers
      },
      connectionTimeout: 10000,
    });

    const subject = `🏡 NOVO LEAD: ${data.lead.nome || 'Cliente'} (${data.lead.tipoAtendimento || 'Imobiliário'}) - ${
      data.companyName
    }`;
    const html = buildLeadEmailHtml(data);
    const text = `NOVO LEAD QUALIFICADO\n\nImobiliária: ${data.companyName}\nNome: ${data.lead.nome}\nTelefone: ${
      data.lead.telefone
    }\nTipo de Atendimento: ${data.lead.tipoAtendimento}\nImóvel: ${data.lead.produtoImovel}\nObservações: ${
      data.lead.observacoes
    }\nConsentimento: Sim (LGPD)\nOrigem: Site via WhatsApp\n\nLink WhatsApp: ${formatWhatsAppUrl(
      data.lead.telefone
    )}\n\nTexto para CRM:\n${data.lead.finalStructuredText || ''}`;

    const info = await transporter.sendMail({
      from: `"${senderName}" <${fromAddress}>`,
      to: toRecipients,
      subject,
      text,
      html,
    });

    return {
      success: true,
      messageId: info.messageId,
      message: `E-mail enviado com sucesso para: ${toRecipients}`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Erro ao enviar e-mail via SMTP: ${err.message || String(err)}`,
    };
  }
}
