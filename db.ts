import mysql from 'mysql2/promise';
import type { Pool, PoolOptions, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

let pool: Pool | null = null;
let isMysqlAvailable: boolean | null = null;
let isAuthDenied = false;
let lastFailureTime = 0;
const FAILURE_RETRY_INTERVAL_MS = 300000; // 5 minutos entre tentativas se houver falha temporária

/**
 * Sanitiza o DB_HOST removendo protocolos (http://, https://, mysql://),
 * barras finais ou caminhos, e portas anexadas indevidamente.
 */
export function sanitizeDbHost(rawHost: string | undefined): string {
  if (!rawHost) return '127.0.0.1';
  let h = rawHost.trim();
  // Remove protocolo (ex: http://, https://, mysql://)
  h = h.replace(/^[a-zA-Z0-9+.-]+:\/\//, '');
  // Remove caminhos ou barras finais (ex: mysql.icone-rio.com.br/ -> mysql.icone-rio.com.br)
  h = h.replace(/\/.*$/, '');
  // Se contiver porta no host (ex: host:3306), remove a porta
  if (h.includes(':')) {
    h = h.split(':')[0];
  }
  return h.trim() || '127.0.0.1';
}

/**
 * Sanitiza e extrai a porta do MySQL a partir de DB_PORT ou de DB_HOST se fornecido como host:porta.
 */
export function sanitizeDbPort(rawPort: string | undefined, rawHost: string | undefined): number {
  if (rawHost) {
    const withoutProto = rawHost.trim().replace(/^[a-zA-Z0-9+.-]+:\/\//, '');
    const withoutPath = withoutProto.replace(/\/.*$/, '');
    const colonIdx = withoutPath.indexOf(':');
    if (colonIdx !== -1) {
      const p = parseInt(withoutPath.slice(colonIdx + 1), 10);
      if (!isNaN(p) && p > 0) return p;
    }
  }
  const parsed = parseInt(rawPort || '3306', 10);
  return isNaN(parsed) ? 3306 : parsed;
}

export function isDbConfigured(): boolean {
  if (process.env.DB_ENABLED === 'false' || process.env.USE_MYSQL === 'false') {
    return false;
  }
  // Se DB_ENABLED estiver explicitamente como 'true', exige as variáveis mínimas
  if (process.env.DB_ENABLED === 'true') {
    return Boolean(process.env.DB_HOST && process.env.DB_USER && process.env.DB_NAME);
  }
  // Se não foi explicitamente ativado por DB_ENABLED=true:
  // Se a senha estiver vazia ou o host for localhost/127.0.0.1 sem DB_ENABLED=true, opera em modo local JSON
  if (!process.env.DB_PASSWORD && (!process.env.DB_HOST || process.env.DB_HOST === '127.0.0.1' || process.env.DB_HOST === 'localhost')) {
    return false;
  }
  return Boolean(
    process.env.DB_HOST &&
    process.env.DB_USER &&
    process.env.DB_NAME
  );
}

export function resetDbPool(): void {
  if (pool) {
    try {
      pool.end().catch(() => {});
    } catch {}
    pool = null;
  }
  isMysqlAvailable = null;
  isAuthDenied = false;
  lastFailureTime = 0;
}

export function getDbPool(): Pool | null {
  if (!isDbConfigured()) return null;

  if (!pool) {
    try {
      const cleanHost = sanitizeDbHost(process.env.DB_HOST);
      const cleanPort = sanitizeDbPort(process.env.DB_PORT, process.env.DB_HOST);

      const options: PoolOptions = {
        host: cleanHost,
        port: cleanPort,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'direct_houses',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        charset: 'utf8mb4',
        timezone: 'Z',
        connectTimeout: 8000,
      };

      // SSL opcional via env
      if (process.env.DB_SSL === 'true') {
        options.ssl = { rejectUnauthorized: false };
      }

      pool = mysql.createPool(options);
      console.log(`[DB] Pool MySQL configurado para ${options.user}@${cleanHost}:${cleanPort}/${options.database}`);
    } catch (err) {
      console.info('[DB] Inicialização do Pool MySQL adiada, operando em modo local (.data/).');
      pool = null;
    }
  }

  return pool;
}

/** SELECT — retorna array de linhas */
export async function query<T extends RowDataPacket = RowDataPacket>(
  sql: string,
  params?: any[]
): Promise<T[]> {
  const p = getDbPool();
  if (!p) {
    throw new Error('MySQL não configurado. Verifique DB_HOST, DB_USER e DB_NAME no .env');
  }
  const [rows] = await p.execute<T[]>(sql, params);
  return rows;
}

/** INSERT / UPDATE / DELETE — retorna ResultSetHeader */
export async function execute(
  sql: string,
  params?: any[]
): Promise<ResultSetHeader> {
  const p = getDbPool();
  if (!p) {
    throw new Error('MySQL não configurado. Verifique DB_HOST, DB_USER e DB_NAME no .env');
  }
  const [result] = await p.execute<ResultSetHeader>(sql, params);
  return result;
}

/**
 * Helper para services: tenta MySQL; se não configurado, com erro de autenticação/conexão recente ou falhar, usa fallback (JSON).
 */
export async function withDbOrFallback<T>(
  dbFn: () => Promise<T>,
  fallbackFn: () => Promise<T> | T
): Promise<T> {
  if (!isDbConfigured()) {
    return fallbackFn();
  }

  // Circuit breaker: se já sabemos que o MySQL está indisponível ou acesso foi negado pelo host remoto
  const now = Date.now();
  if (isMysqlAvailable === false) {
    if (isAuthDenied || (now - lastFailureTime) < FAILURE_RETRY_INTERVAL_MS) {
      return fallbackFn();
    }
  }

  try {
    const result = await dbFn();
    isMysqlAvailable = true;
    isAuthDenied = false;
    return result;
  } catch (err: any) {
    const isFirstFailure = isMysqlAvailable !== false;
    isMysqlAvailable = false;
    lastFailureTime = now;

    if (err.code === 'ER_ACCESS_DENIED_ERROR' || (err.message && err.message.includes('Access denied'))) {
      isAuthDenied = true;
    }

    if (isFirstFailure) {
      console.info(
        `[DB] Persistência ativa em arquivos locais (.data/). Modo fallback ativado.`
      );
    }
    return fallbackFn();
  }
}

export async function testConnection(): Promise<{ success: boolean; message: string; mode: 'mysql' | 'json'; errorDetails?: string }> {
  if (!isDbConfigured()) {
    return {
      success: false,
      message: 'MySQL desativado ou não configurado. O sistema está operando com persistência em arquivos locais (.data/).',
      mode: 'json',
    };
  }
  try {
    const cleanHost = sanitizeDbHost(process.env.DB_HOST);
    const cleanPort = sanitizeDbPort(process.env.DB_PORT, process.env.DB_HOST);
    const p = getDbPool();
    if (!p) throw new Error('Não foi possível inicializar o pool.');
    await p.query('SELECT 1');
    isMysqlAvailable = true;
    isAuthDenied = false;
    return {
      success: true,
      message: `Conexão com MySQL (${cleanHost}:${cleanPort}) estabelecida com sucesso!`,
      mode: 'mysql',
    };
  } catch (err: any) {
    isMysqlAvailable = false;
    const cleanHost = sanitizeDbHost(process.env.DB_HOST);
    let detailedMsg = err.message || 'Erro desconhecido';

    if (err.code === 'ER_ACCESS_DENIED_ERROR' || detailedMsg.includes('Access denied')) {
      isAuthDenied = true;
      detailedMsg = `Acesso negado (${err.message}). Se estiver usando DreamHost, libere o host remoto '%' nos 'Allowable Hosts' do usuário MySQL. O sistema continuará operando com segurança no modo local (.data/).`;
    } else if (err.code === 'ENOTFOUND') {
      detailedMsg = `Host não encontrado (${cleanHost}). Verifique se o endereço não contém http:// ou caracteres inválidos.`;
    } else if (err.code === 'ETIMEDOUT') {
      detailedMsg = `Tempo limite esgotado ao conectar em ${cleanHost}. Verifique se a porta 3306 está acessível.`;
    }

    return {
      success: false,
      message: `MySQL externo: ${detailedMsg}`,
      mode: 'json',
      errorDetails: err.code || err.message,
    };
  }
}
