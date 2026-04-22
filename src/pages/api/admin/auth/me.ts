import type { APIRoute } from "astro";
import { authenticateRequest } from "../../../../lib/auth";
import { ensureDatabaseInitialized } from "../../../../lib/db-init";

export const prerender = false;

export const GET: APIRoute = async ({ request, locals }) => {
  if (!locals || !locals.runtime) {
    return json({ error: "Cloudflare runtime not detected. Check your adapter configuration." }, 500);
  }
  const env = (locals.runtime?.env || {}) as any;
  const db = env.DB;
  
  if (!db) {
    return json({ error: "D1 database binding 'DB' not found in environment. Ensure you have bound the D1 database to your Pages project." }, 500);
  }
  
  // Ensure database is initialized
  await ensureDatabaseInitialized(db);
  
  const user = await authenticateRequest(request, env);
  if (!user) return json({ error: "Unauthorized" }, 401);
  return json({ user });
};

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}
