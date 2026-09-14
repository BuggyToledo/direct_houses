import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface AuthorizedUser {
  email: string;
  name?: string;
  role: 'admin' | 'user';
  addedAt: string;
  isPermanentAdmin?: boolean;
}

export interface AuthSessionUser {
  email: string;
  name: string;
  picture?: string;
  role: 'admin' | 'user';
  token: string;
}

const DATA_DIR = path.join(process.cwd(), '.data');
const USERS_FILE = path.join(DATA_DIR, 'authorized-users.json');

// Global Permanent Admin Email
export const GLOBAL_ADMIN_EMAIL = 'toledo@icone-rio.com.br';

const DEFAULT_AUTHORIZED_USERS: AuthorizedUser[] = [
  {
    email: GLOBAL_ADMIN_EMAIL,
    name: 'Adriano Toledo',
    role: 'admin',
    addedAt: new Date().toISOString(),
    isPermanentAdmin: true,
  },
];

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function getAuthorizedUsers(): AuthorizedUser[] {
  ensureDataDir();
  try {
    if (fs.existsSync(USERS_FILE)) {
      const data = fs.readFileSync(USERS_FILE, 'utf-8');
      const users: AuthorizedUser[] = JSON.parse(data);
      // Guarantee global admin is always present
      if (!users.some((u) => u.email.toLowerCase() === GLOBAL_ADMIN_EMAIL.toLowerCase())) {
        users.unshift(DEFAULT_AUTHORIZED_USERS[0]);
        saveAuthorizedUsers(users);
      }
      return users;
    }
  } catch (err) {
    console.error('Erro ao ler usuários autorizados:', err);
  }
  saveAuthorizedUsers(DEFAULT_AUTHORIZED_USERS);
  return DEFAULT_AUTHORIZED_USERS;
}

export function saveAuthorizedUsers(users: AuthorizedUser[]): void {
  ensureDataDir();
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
  } catch (err) {
    console.error('Erro ao salvar usuários autorizados:', err);
  }
}

export function isEmailAuthorized(email: string): { authorized: boolean; user?: AuthorizedUser } {
  if (!email) return { authorized: false };
  const cleanEmail = email.trim().toLowerCase();

  if (cleanEmail === GLOBAL_ADMIN_EMAIL.toLowerCase()) {
    return {
      authorized: true,
      user: {
        email: GLOBAL_ADMIN_EMAIL,
        name: 'Adriano Toledo',
        role: 'admin',
        addedAt: new Date().toISOString(),
        isPermanentAdmin: true,
      },
    };
  }

  const users = getAuthorizedUsers();
  const match = users.find((u) => u.email.toLowerCase() === cleanEmail);
  return {
    authorized: Boolean(match),
    user: match,
  };
}

export function addAuthorizedUser(userData: { email: string; name?: string; role?: 'admin' | 'user' }): AuthorizedUser {
  const users = getAuthorizedUsers();
  const cleanEmail = userData.email.trim().toLowerCase();

  const existingIndex = users.findIndex((u) => u.email.toLowerCase() === cleanEmail);
  const newUser: AuthorizedUser = {
    email: cleanEmail,
    name: userData.name?.trim() || cleanEmail.split('@')[0],
    role: userData.role || 'user',
    addedAt: new Date().toISOString(),
    isPermanentAdmin: cleanEmail === GLOBAL_ADMIN_EMAIL.toLowerCase(),
  };

  if (existingIndex !== -1) {
    users[existingIndex] = { ...users[existingIndex], ...newUser };
  } else {
    users.push(newUser);
  }

  saveAuthorizedUsers(users);
  return newUser;
}

export function removeAuthorizedUser(email: string): boolean {
  const cleanEmail = email.trim().toLowerCase();
  if (cleanEmail === GLOBAL_ADMIN_EMAIL.toLowerCase()) {
    throw new Error('Não é permitido remover o Administrador Global permanente.');
  }

  const users = getAuthorizedUsers();
  const filtered = users.filter((u) => u.email.toLowerCase() !== cleanEmail);
  if (filtered.length === users.length) return false;

  saveAuthorizedUsers(filtered);
  return true;
}

// In-memory active session tokens
const activeSessions = new Map<string, AuthSessionUser>();

// Generate simple secure session token
export function createSession(user: { email: string; name: string; picture?: string; role: 'admin' | 'user' }): AuthSessionUser {
  const token = `dh_session_${crypto.randomBytes(32).toString('hex')}`;
  const sessionUser: AuthSessionUser = {
    ...user,
    token,
  };
  activeSessions.set(token, sessionUser);
  return sessionUser;
}

export function getSessionUser(token: string): AuthSessionUser | null {
  if (!token) return null;
  const cleanToken = token.replace(/^Bearer\s+/i, '').trim();
  return activeSessions.get(cleanToken) || null;
}

export function deleteSession(token: string): void {
  if (!token) return;
  const cleanToken = token.replace(/^Bearer\s+/i, '').trim();
  activeSessions.delete(cleanToken);
}

/**
 * Verifies a Google ID Token against Google's official OAuth2 endpoint
 */
export async function verifyGoogleIdToken(idToken: string): Promise<{
  success: boolean;
  email?: string;
  name?: string;
  picture?: string;
  error?: string;
}> {
  if (!idToken || !idToken.trim()) {
    return { success: false, error: 'Token do Google não fornecido.' };
  }

  try {
    const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken.trim())}`;
    const res = await fetch(url);
    if (!res.ok) {
      const errorText = await res.text();
      return { success: false, error: `Token do Google inválido ou expirado: ${errorText}` };
    }

    const payload: any = await res.json();

    if (!payload.email) {
      return { success: false, error: 'O Google não retornou o e-mail da conta.' };
    }

    const email = String(payload.email).toLowerCase();
    const name = payload.name || payload.given_name || email.split('@')[0];
    const picture = payload.picture || '';

    return {
      success: true,
      email,
      name,
      picture,
    };
  } catch (err: any) {
    console.error('Erro ao verificar token do Google:', err);
    return {
      success: false,
      error: `Falha na conexão com os servidores do Google: ${err.message || String(err)}`,
    };
  }
}
