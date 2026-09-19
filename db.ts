import mysql from 'mysql2/promise';

let pool: mysql.Pool | null = null;

export interface DbConfig {
  host: string;
  port: number;
  user: string;
  password?: string;
  database: string;
}

export function isDbConfigured(): boolean {
  return Boolean(
    process.env.DB_HOST &&
    process.env.DB_USER &&
    process.env.DB_NAME
  );
}

export function getDbPool(): mysql.Pool | null {
  if (!isDbConfigured()) {
    return null;
  }

  if (!pool) {
    try {
      pool = mysql.createPool({
        host: process.env.DB_HOST || '127.0.0.1',
        port: parseInt(process.env.DB_PORT || '3306', 10),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'direct_houses',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        charset: 'utf8mb4',
      });
      console.log('[DB] Pool MySQL inicializado com sucesso.');
    } catch (err) {
      console.error('[DB] Erro ao inicializar Pool MySQL:', err);
      pool = null;
    }
  }

  return pool;
}

/**
 * Executa uma query com tratamento de erro e tipagem simples.
 */
export async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
  const p = getDbPool();
  if (!p) {
    throw new Error('MySQL não está configurado. Verifique as variáveis DB_HOST, DB_USER e DB_NAME no .env');
  }
  const [rows] = await p.execute(sql, params);
  return rows as T[];
}

/**
 * Testa a conexão com o MySQL.
 */
export async function testConnection(): Promise<{ success: boolean; message: string }> {
  if (!isDbConfigured()) {
    return {
      success: false,
      message: 'Banco MySQL não configurado. O sistema está operando em modo arquivos locais (.data/).',
    };
  }
  try {
    const p = getDbPool();
    if (!p) throw new Error('Não foi possível inicializar o pool MySQL.');
    await p.query('SELECT 1 + 1 AS result');
    return { success: true, message: 'Conexão com MySQL estabelecida com sucesso!' };
  } catch (err: any) {
    return { success: false, message: `Falha ao conectar no MySQL: ${err.message}` };
  }
}
