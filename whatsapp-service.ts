import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  WAMessage,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import { cleanPhoneNumber } from './broker-roleta';

export type WhatsAppState = 'disconnected' | 'connecting' | 'qr_ready' | 'connected';

export interface WhatsAppStatus {
  state: WhatsAppState;
  qrCodeDataUrl: string | null;
  connectedPhone: string | null;
  connectedName: string | null;
  lastConnectedAt?: string;
  errorMessage?: string | null;
}

export interface IncomingWhatsAppMessageEvent {
  jid: string;
  senderPhone: string;
  senderName: string;
  messageText: string;
  timestamp: number;
  fromMe: boolean;
  isGroup: boolean;
}

type MessageHandler = (event: IncomingWhatsAppMessageEvent) => Promise<void>;

const AUTH_DIR = path.join(process.cwd(), '.whatsapp_auth');

class WhatsAppService {
  private sock: any = null;
  private state: WhatsAppState = 'disconnected';
  private qrCodeDataUrl: string | null = null;
  private connectedPhone: string | null = null;
  private connectedName: string | null = null;
  private lastConnectedAt?: string;
  private errorMessage: string | null = null;
  private messageHandlers: MessageHandler[] = [];
  private isConnecting: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;

  constructor() {
    this.ensureAuthDir();
  }

  private ensureAuthDir() {
    if (!fs.existsSync(AUTH_DIR)) {
      fs.mkdirSync(AUTH_DIR, { recursive: true });
    }
  }

  public getStatus(): WhatsAppStatus {
    return {
      state: this.state,
      qrCodeDataUrl: this.qrCodeDataUrl,
      connectedPhone: this.connectedPhone,
      connectedName: this.connectedName,
      lastConnectedAt: this.lastConnectedAt,
      errorMessage: this.errorMessage,
    };
  }

  public onMessage(handler: MessageHandler) {
    this.messageHandlers.push(handler);
  }

  public async connect(): Promise<WhatsAppStatus> {
    if (this.sock && this.state === 'connected') {
      return this.getStatus();
    }

    if (this.isConnecting) {
      return this.getStatus();
    }

    this.isConnecting = true;
    this.state = 'connecting';
    this.errorMessage = null;

    try {
      this.ensureAuthDir();
      const { state: authState, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
      const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1015901307] as any }));

      const logger = pino({ level: 'silent' });

      this.sock = makeWASocket({
        version,
        logger,
        printQRInTerminal: false,
        auth: {
          creds: authState.creds,
          keys: makeCacheableSignalKeyStore(authState.keys, logger),
        },
        generateHighQualityLinkPreview: false,
        syncFullHistory: false,
        markOnlineOnConnect: true,
      });

      this.sock.ev.on('creds.update', saveCreds);

      this.sock.ev.on('connection.update', async (update: any) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          try {
            this.qrCodeDataUrl = await QRCode.toDataURL(qr, {
              margin: 2,
              scale: 8,
              color: {
                dark: '#0f172a',
                light: '#ffffff',
              },
            });
            this.state = 'qr_ready';
            console.log('⚡ [WhatsApp] Novo QR Code pronto para leitura.');
          } catch (qrErr) {
            console.error('Erro ao gerar imagem de QR Code:', qrErr);
          }
        }

        if (connection === 'open') {
          this.state = 'connected';
          this.qrCodeDataUrl = null;
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.errorMessage = null;
          this.lastConnectedAt = new Date().toISOString();

          const user = this.sock.user;
          this.connectedPhone = user?.id ? user.id.split(':')[0].replace(/\D/g, '') : null;
          this.connectedName = user?.name || 'Direct Houses WhatsApp';
          console.log(`✅ [WhatsApp] Conectado com sucesso! Número: +${this.connectedPhone}`);
        } else if (connection === 'close') {
          this.isConnecting = false;
          const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

          console.log(`🔌 [WhatsApp] Conexão fechada. Motivo: ${statusCode}. Reconectar: ${shouldReconnect}`);

          if (statusCode === DisconnectReason.loggedOut) {
            this.state = 'disconnected';
            this.connectedPhone = null;
            this.connectedName = null;
            this.qrCodeDataUrl = null;
            this.errorMessage = 'Sessão encerrada no celular. Escaneie o QR Code novamente.';
            this.clearAuthDir();
          } else if (shouldReconnect) {
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
              this.reconnectAttempts++;
              console.log(`🔄 [WhatsApp] Tentando reconectar (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
              setTimeout(() => this.connect(), 3000);
            } else {
              this.state = 'disconnected';
              this.errorMessage = 'Limite de tentativas de reconexão excedido. Clique para reconectar.';
            }
          } else {
            this.state = 'disconnected';
          }
        }
      });

      // Handle Incoming Messages
      this.sock.ev.on('messages.upsert', async (chatUpdate: { messages: WAMessage[]; type: string }) => {
        if (chatUpdate.type !== 'notify' && chatUpdate.type !== 'append') return;

        for (const msg of chatUpdate.messages) {
          if (!msg.message) continue;
          if (msg.key.fromMe) continue; // Ignore bot's own messages

          const jid = msg.key.remoteJid;
          if (!jid) continue;
          if (jid.endsWith('@g.us')) continue; // Ignore group messages
          if (jid === 'status@broadcast') continue; // Ignore status broadcasts

          // Extract text content
          const messageText =
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text ||
            msg.message.imageMessage?.caption ||
            msg.message.buttonsResponseMessage?.selectedDisplayText ||
            msg.message.templateButtonReplyMessage?.selectedId ||
            '';

          if (!messageText.trim()) continue;

          let senderPhone = '';
          if (jid.endsWith('@s.whatsapp.net')) {
            senderPhone = jid.split('@')[0].replace(/\D/g, '');
          } else {
            const participant =
              msg.key.participant ||
              (msg.key as any).participantPnJid ||
              (msg.key as any).remoteJidPn ||
              (msg as any).senderPnJid;
            if (participant && typeof participant === 'string' && participant.endsWith('@s.whatsapp.net')) {
              senderPhone = participant.split('@')[0].replace(/\D/g, '');
            }
          }

          // If the extracted phone is a 15-digit WhatsApp LID or invalid, clear it
          if (senderPhone.length >= 15 || (senderPhone.startsWith('192878') && senderPhone.length >= 14) || senderPhone.length < 8) {
            senderPhone = '';
          }

          const senderName = msg.pushName || 'Cliente';
          const timestamp = Number(msg.messageTimestamp) * 1000 || Date.now();

          const event: IncomingWhatsAppMessageEvent = {
            jid,
            senderPhone,
            senderName,
            messageText: messageText.trim(),
            timestamp,
            fromMe: Boolean(msg.key.fromMe),
            isGroup: jid.endsWith('@g.us'),
          };

          // Dispatch to listeners
          for (const handler of this.messageHandlers) {
            try {
              await handler(event);
            } catch (handlerErr) {
              console.error('Erro no processador de mensagem do WhatsApp:', handlerErr);
            }
          }
        }
      });

      return this.getStatus();
    } catch (err: any) {
      this.isConnecting = false;
      this.state = 'disconnected';
      this.errorMessage = err.message || 'Falha ao iniciar conexão com WhatsApp';
      console.error('Erro ao conectar WhatsApp Baileys:', err);
      return this.getStatus();
    }
  }

  public async disconnect(): Promise<void> {
    try {
      if (this.sock) {
        await this.sock.logout().catch(() => {});
        this.sock.end(undefined);
        this.sock = null;
      }
    } catch (err) {
      console.error('Erro ao desconectar socket:', err);
    } finally {
      this.state = 'disconnected';
      this.qrCodeDataUrl = null;
      this.connectedPhone = null;
      this.connectedName = null;
      this.isConnecting = false;
      this.clearAuthDir();
    }
  }

  private clearAuthDir() {
    try {
      if (fs.existsSync(AUTH_DIR)) {
        fs.rmSync(AUTH_DIR, { recursive: true, force: true });
      }
    } catch (e) {
      console.error('Erro ao limpar pasta de auth:', e);
    }
  }

  /**
   * Send WhatsApp text message to any phone number
   */
  public async sendTextMessage(phoneOrJid: string, text: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.sock || this.state !== 'connected') {
      return {
        success: false,
        error: 'WhatsApp não está conectado. Escaneie o QR Code primeiro.',
      };
    }

    try {
      let targetJid = phoneOrJid;
      if (!targetJid.includes('@')) {
        const clean = cleanPhoneNumber(phoneOrJid);
        if (!clean) {
          return { success: false, error: 'Número de telefone inválido.' };
        }
        targetJid = `${clean}@s.whatsapp.net`;
      }

      const sentMsg = await this.sock.sendMessage(targetJid, { text });
      return {
        success: true,
        messageId: sentMsg?.key?.id,
      };
    } catch (err: any) {
      console.error(`Erro ao enviar mensagem WhatsApp para ${phoneOrJid}:`, err);
      return {
        success: false,
        error: err.message || 'Erro ao enviar mensagem via WhatsApp.',
      };
    }
  }
}

// Export singleton instance
export const whatsAppService = new WhatsAppService();
