import type { APIRoute } from "astro";
import { verifyPassword, signJWT, createRefreshToken, hashPassword } from "../../../../lib/auth";
import { ensureDatabaseInitialized } from "../../../../lib/db-init";
import { json } from "../../../../lib/utils";

export const prerender = false;

// Default admin credentials (for first-time setup)
const DEFAULT_ADMIN = {
  email: "admin@blog.com",
  password: "admin123",
  name: "Admin",
  role: "admin"
};

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals || !locals.runtime) {
    return json({ error: "Cloudflare runtime not detected." }, 500);
  }
  const env = (locals.runtime?.env || {}) as any;
  const db = env.DB;
  
  if (!db) {
    return json({ error: "D1 database binding 'DB' not found in environment." }, 500);
  }
  
  // Ensure database is initialized
  await ensureDatabaseInitialized(db);
  
  const body = await request.json().catch(() => ({}));
  const { email, password } = body as any;

  if (!email || !password)
    return json({ error: "Email and password are required" }, 400);

  // Check if any user exists, if not create default admin
  const userCount = await db.prepare("SELECT COUNT(*) as count FROM users").first<{ count: number }>();
  if (!userCount || userCount.count === 0) {
    console.log("[Auth] No users found, creating default admin...");
    const passwordHash = await hashPassword(DEFAULT_ADMIN.password);
    await db.prepare(
      "INSERT INTO users (email, password_hash, name, role, is_active) VALUES (?, ?, ?, ?, 1)"
    ).bind(DEFAULT_ADMIN.email, passwordHash, DEFAULT_ADMIN.name, DEFAULT_ADMIN.role).run();
    console.log("[Auth] Default admin created:", DEFAULT_ADMIN.email);
  }

  const user = await db
    .prepare("SELECT * FROM users WHERE email = ? AND is_active = 1")
    .bind(email)
    .first<any>();

  if (!user || !(await verifyPassword(password, user.password_hash)))
    return json({ error: "Invalid email or password" }, 401);

  const accessToken = await signJWT(
    { sub: user.id, email: user.email, name: user.name, role: user.role },
    env
  );
  const refreshToken = await createRefreshToken(
    user.id, db,
    request.headers.get("User-Agent") ?? undefined,
    request.headers.get("CF-Connecting-IP") ?? undefined
  );

  await db.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").bind(user.id).run();

  const headers = new Headers({ "Content-Type": "application/json" });
  // Cloudflare always uses HTTPS in production
  // Check via X-Forwarded-Proto header or assume HTTPS for non-localhost
  const proto = request.headers.get('X-Forwarded-Proto') || '';
  const isHttps = proto === 'https' || request.url.startsWith('https://');
  const secureFlag = isHttps ? '; Secure' : '';
  headers.append("Set-Cookie", `access_token=${accessToken}; Path=/; HttpOnly; SameSite=Lax${secureFlag}; Max-Age=900`);
  headers.append("Set-Cookie", `refresh_token=${refreshToken}; Path=/; HttpOnly; SameSite=Lax${secureFlag}; Max-Age=2592000`);

  return new Response(
    JSON.stringify({ user: { id: user.id, email: user.email, name: user.name, role: user.role }, accessToken }),
    { headers }
  );
};
