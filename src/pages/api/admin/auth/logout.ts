import type { APIRoute } from "astro";
import { revokeRefreshToken } from "../../../../lib/auth";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const cookie = request.headers.get("Cookie") ?? "";
  const match = cookie.match(/refresh_token=([^;]+)/);
  if (match) await revokeRefreshToken(match[1], locals.runtime.env.DB);

  const headers = new Headers({ "Content-Type": "application/json" });
  // Cloudflare uses HTTPS, so we need Secure flag
  const isProd = request.url.startsWith('https://');
  const secureFlag = isProd ? '; Secure' : '';
  headers.append("Set-Cookie", `access_token=; Path=/; HttpOnly; SameSite=Lax${secureFlag}; Max-Age=0`);
  headers.append("Set-Cookie", `refresh_token=; Path=/; HttpOnly; SameSite=Lax${secureFlag}; Max-Age=0`);
  return new Response(JSON.stringify({ success: true }), { headers });
};