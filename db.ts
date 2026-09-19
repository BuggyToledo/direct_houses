import mysql from 'mysql2/promise';
import type { Pool, PoolOptions, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

let pool: Pool | null = null;

export function isDbConfigured(): boolean {
  return Boolean(
    process.env.DB_HOST &&
    process.env.DB_USER &&
    process.env.DB_NAME
  );
}

export function getDbPool(): Pool | null {
  if (!isDbConfigured()) return null;

  if (!pool) {
    try {
      const options: PoolOptions = {
        host: process.env.DB_HOST || '127.0.0.1',
        port: parseInt(process.env.DB_PORT || '3306', 10),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'direct_houses',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        charset: 'utf8mb4',
        timezone: 'Z',
        // DreamHost / produção com SSL (ative se necessário)
        // ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
      };

      // SSL opcional via env
      if (process.env.DB_SSL === 'true') {
        options.ssl = { rejectUnauthorized: false };
      }

      pool = mysql.createPool(options);
      console.log('[DB] Pool MySQL inicializado com sucesso.');
    } catch (err) {
      console.error('[DB] Erro ao inicializar Pool MySQL:', err);
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
 * Helper para services: tenta MySQL; se não configurado ou falhar, usa fallback (JSON).
 */
export async function withDbOrFallback<T>(
  dbFn: () => Promise<T>,
  fallbackFn: () => Promise<T> | T
): Promise<T> {
  if (!isDbConfigured()) {
    return fallbackFn();
  }
  try {
    return await dbFn();
  } catch (err) {
    console.error('[DB] Falha na operação MySQL, usando fallback JSON:', err);
    return fallbackFn();
  }
}

export async function testConnection(): Promise<{ success: boolean; message: string; mode: 'mysql' | 'json' }> {
  if (!isDbConfigured()) {
    return {
      success: false,
      message: 'MySQL não configurado. Sistema em modo arquivos locais (.data/).',
      mode: 'json',
    };
  }
  try {
    const p = getDbPool();
    if (!p) throw new Error('Não foi possível inicializar o pool.');
    await p.query('SELECT 1');
    return {
      success: true,
      message: 'Conexão com MySQL estabelecida com sucesso!',
      mode: 'mysql',
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Falha ao conectar no MySQL: ${err.message}`,
      mode: 'json',
    };
  }
}
