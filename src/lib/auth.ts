// ============================================
// Auth Library - JWT + Password Hashing
// Cloudflare Workers compatible (Web Crypto API)
// ============================================

const JWT_SECRET_KEY = 'JWT_SECRET';
const REFRESH_TOKEN_EXPIRY_DAYS = 30;
const ACCESS_TOKEN_EXPIRY_MINUTES = 15;

// ---- Password Hashing (PBKDF2 via Web Crypto) ----

interface PasswordHash {
  algorithm: string;
  iterations: number;
  salt: string;
  hash: string;
}

export function parsePasswordHash(stored: string): PasswordHash {
  const parts = stored.split(':');
  if (parts.length !== 5 || parts[0] !== 'pbkdf2') {
    throw new Error('Invalid password hash format');
  }
  return {
    algorithm: parts[1],
    iterations: parseInt(parts[2]),
    salt: parts[3],
    hash: parts[4],
  };
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const parsed = parsePasswordHash(stored);
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']
    );
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: encoder.encode(parsed.salt),
        iterations: parsed.iterations,
        hash: parsed.algorithm.toUpperCase().replace('SHA', 'SHA-'),
      },
      keyMaterial,
      512 // 64 bytes = 512 bits
    );
    const hashArray = Array.from(new Uint8Array(derivedBits));
    const computedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return computedHash === parsed.hash;
  } catch {
    return false;
  }
}

export async function hashPassword(password: string): Promise<string> {
  const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0')).join('');
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: encoder.encode(salt), iterations: 100000, hash: 'SHA-512' },
    keyMaterial, 512
  );
  const hashArray = Array.from(new Uint8Array(derivedBits));
  const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return `pbkdf2:sha512:100000:${salt}:${hash}`;
}

// ---- JWT (Web Crypto based) ----

function base64UrlEncode(data: ArrayBuffer | Uint8Array | string): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
  let binary = '';
  bytes.forEach(b => binary += String.fromCharCode(b));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): string {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return atob(str);
}

async function getSigningKey(env: Record<string, any>, forSigning: boolean): Promise<CryptoKey> {
  const secret = env[JWT_SECRET_KEY];
  if (!secret) {
    console.warn(`[Auth] Warning: ${JWT_SECRET_KEY} not found in environment. Using a fallback secret is insecure.`);
  }
  const effectiveSecret = secret || 'insecure-default-secret-must-change';
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    'raw', encoder.encode(effectiveSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    forSigning ? ['sign'] : ['verify']
  );
}

export async function signJWT(payload: Record<string, any>, env: Record<string, any>, expiresInMinutes: number = ACCESS_TOKEN_EXPIRY_MINUTES): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + expiresInMinutes * 60 };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(body));
  const message = `${headerB64}.${payloadB64}`;

  const key = await getSigningKey(env, true);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));

  return `${message}.${base64UrlEncode(signature)}`;
}

export async function verifyJWT(token: string, env: Record<string, any>): Promise<Record<string, any> | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;
    const message = `${headerB64}.${payloadB64}`;

    const key = await getSigningKey(env, false);
    const signatureStr = base64UrlDecode(signatureB64);
    const signatureBytes = new Uint8Array(signatureStr.length);
    for (let i = 0; i < signatureStr.length; i++) signatureBytes[i] = signatureStr.charCodeAt(i);

    const valid = await crypto.subtle.verify('HMAC', key, signatureBytes, new TextEncoder().encode(message));
    if (!valid) return null;

    const payload = JSON.parse(base64UrlDecode(payloadB64));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch {
    return null;
  }
}

// ---- Auth Middleware ----

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'editor';
}

export async function authenticateRequest(request: Request, env: Record<string, any>): Promise<AuthUser | null> {
  // Try Authorization header first
  const authHeader = request.headers.get('Authorization');
  let token: string | null = null;

  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  }

  // Try cookie
  if (!token) {
    const cookieHeader = request.headers.get('Cookie') || '';
    const match = cookieHeader.match(/access_token=([^;]+)/);
    if (match) token = match[1];
  }

  if (!token) return null;

  const payload = await verifyJWT(token, env);
  if (!payload) return null;

  return {
    id: payload.sub,
    email: payload.email,
    name: payload.name,
    role: payload.role,
  };
}

export function requireAuth(roles: string[] = ['admin', 'editor']) {
  return async (request: Request, env: Record<string, any>): Promise<{ user: AuthUser } | { error: Response }> => {
    const user = await authenticateRequest(request, env);
    if (!user) {
      return { error: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } }) };
    }
    if (!roles.includes(user.role)) {
      return { error: new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } }) };
    }
    return { user };
  };
}

// ---- Refresh Token ----

export async function createRefreshToken(userId: number, db: any, userAgent?: string, ip?: string): Promise<string> {
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0')).join('');
  const tokenHash = await hashString(token);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 86400000).toISOString();

  await db.prepare(
    'INSERT INTO sessions (user_id, token_hash, user_agent, ip, expires_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(userId, tokenHash, userAgent || null, ip || null, expiresAt).run();

  return token;
}

export async function validateRefreshToken(token: string, db: any): Promise<number | null> {
  const tokenHash = await hashString(token);
  const session = await db.prepare(
    'SELECT user_id, expires_at FROM sessions WHERE token_hash = ?'
  ).bind(tokenHash).first<{ user_id: number; expires_at: string }>();

  if (!session) return null;
  if (new Date(session.expires_at) < new Date()) {
    await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
    return null;
  }

  return session.user_id;
}

export async function revokeRefreshToken(token: string, db: any): Promise<void> {
  const tokenHash = await hashString(token);
  await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
}

async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}