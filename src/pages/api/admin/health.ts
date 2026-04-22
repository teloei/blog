import type { APIRoute } from "astro";
import { ensureDatabaseInitialized } from "../../../lib/db-init";
import { authenticateRequest } from "../../../lib/auth";
import { json } from "../../../lib/utils";

export const prerender = false;

export const GET: APIRoute = async ({ locals, request }) => {
  if (!locals || !locals.runtime) {
    return json({ 
      ok: false, 
      error: "Cloudflare runtime not detected." 
    }, 500);
  }

  const env = (locals.runtime?.env || {}) as any;

  // Protect this route
  const user = await authenticateRequest(request, env);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
    checks: {}
  };

  // Check DB and initialize if needed
  try {
    const db = env.DB;
    if (!db) {
      results.checks.database = { ok: false, error: "DB binding not found" };
    } else {
      // Auto-initialize
      await ensureDatabaseInitialized(db);
      
      const tables = await db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
      const usersCount = await db.prepare("SELECT COUNT(*) as count FROM users").first<{ count: number }>();
      
      results.checks.database = { 
        ok: true, 
        tables: tables.results?.map((r: any) => r.name) || [],
        usersCount: usersCount?.count || 0
      };
    }
  } catch (e: any) {
    results.checks.database = { ok: false, error: e.message };
  }

  // Check R2
  try {
    const bucket = env.BUCKET;
    if (!bucket) {
      results.checks.storage = { ok: false, error: "BUCKET binding not found" };
    } else {
      results.checks.storage = { ok: true };
    }
  } catch (e: any) {
    results.checks.storage = { ok: false, error: e.message };
  }

  // Check JWT_SECRET
  const jwtSecret = env.JWT_SECRET;
  results.checks.jwt = {
    ok: !!jwtSecret,
    note: jwtSecret ? "JWT_SECRET is set" : "JWT_SECRET not set (using default)"
  };

  return json(results);
};
