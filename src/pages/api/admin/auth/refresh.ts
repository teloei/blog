import type { APIRoute } from "astro";
import { validateRefreshToken, signJWT } from "../../../../lib/auth";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const cookie = request.headers.get("Cookie") ?? "";
  const match = cookie.match(/refresh_token=([^;]+)/);
  if (!match) return json({ error: "No refresh token" }, 401);

  const env = (locals.runtime?.env || {}) as any;
  const db = env.DB;
  
  if (!db) {
    return json({ error: "D1 database binding 'DB' not found in environment." }, 500);
  }
  
  const userId = await validateRefreshToken(match[1], db);
  if (!userId) return json({ error: "Invalid or expired refresh token" }, 401);

  const user = await db.prepare("SELECT * FROM users WHERE id = ? AND is_active = 1").bind(userId).first<any>();
  if (!user) return json({ error: "User not found" }, 401);

  const accessToken = await signJWT(
    { sub: user.id, email: user.email, name: user.name, role: user.role }, env
  );

  const headers = new Headers({ "Content-Type": "application/json" });
  // Cloudflare always uses HTTPS in production
  const proto = request.headers.get('X-Forwarded-Proto') || '';
  const isHttps = proto === 'https' || request.url.startsWith('https://');
  const secureFlag = isHttps ? '; Secure' : '';
  headers.append("Set-Cookie", `access_token=${accessToken}; Path=/; HttpOnly; SameSite=Lax${secureFlag}; Max-Age=900`);
  return new Response(
    JSON.stringify({ user: { id: user.id, email: user.email, name: user.name, role: user.role }, accessToken }),
    { headers }
  );
};

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}