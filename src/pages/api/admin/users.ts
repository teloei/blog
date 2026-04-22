import type { APIRoute } from "astro";
import { authenticateRequest, hashPassword } from "../../../lib/auth";

export const prerender = false;

export const GET: APIRoute = async ({ request, locals }) => {
  const user = await authenticateRequest(request, locals.runtime.env as any);
  if (!user || user.role !== "admin") return json({ error: "Forbidden" }, 403);

  const { results } = await locals.runtime.env.DB.prepare(
    "SELECT id,email,name,role,avatar,is_active,last_login,created_at FROM users ORDER BY created_at DESC"
  ).all<any>();
  return json({ users: results ?? [] });
};

export const POST: APIRoute = async ({ request, locals }) => {
  const user = await authenticateRequest(request, locals.runtime.env as any);
  if (!user || user.role !== "admin") return json({ error: "Forbidden" }, 403);

  const db = locals.runtime.env.DB;
  const body = await request.json().catch(() => ({})) as any;
  const { email, password, name, role } = body;
  if (!email || !password) return json({ error: "Email and password required" }, 400);

  const existing = await db.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
  if (existing) return json({ error: "Email already exists" }, 409);

  const hash = await hashPassword(password);
  await db.prepare("INSERT INTO users (email,password_hash,name,role) VALUES (?,?,?,?)")
    .bind(email, hash, name ?? "", role ?? "editor").run();
  return json({ success: true }, 201);
};

export const PUT: APIRoute = async ({ request, url, locals }) => {
  const user = await authenticateRequest(request, locals.runtime.env as any);
  if (!user || user.role !== "admin") return json({ error: "Forbidden" }, 403);

  const db = locals.runtime.env.DB;
  const segments = url.pathname.split("/");
  const id = segments[segments.length - 1];
  if (!id || id === "users") return json({ error: "Missing id" }, 400);

  const body = await request.json().catch(() => ({})) as any;
  const sets: string[] = [];
  const params: any[] = [];
  if (body.name !== undefined) { sets.push("name = ?"); params.push(body.name); }
  if (body.role !== undefined) { sets.push("role = ?"); params.push(body.role); }
  if (body.is_active !== undefined) { sets.push("is_active = ?"); params.push(body.is_active ? 1 : 0); }
  if (body.password) { sets.push("password_hash = ?"); params.push(await hashPassword(body.password)); }
  if (!sets.length) return json({ error: "Nothing to update" }, 400);

  sets.push("updated_at = datetime('now')");
  params.push(id);
  await db.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`).bind(...params).run();
  return json({ success: true });
};

export const DELETE: APIRoute = async ({ request, url, locals }) => {
  const user = await authenticateRequest(request, locals.runtime.env as any);
  if (!user || user.role !== "admin") return json({ error: "Forbidden" }, 403);

  const segments = url.pathname.split("/");
  const id = segments[segments.length - 1];
  if (!id || id === "users") return json({ error: "Missing id" }, 400);
  if (parseInt(id) === user.id) return json({ error: "Cannot delete yourself" }, 400);

  const db = locals.runtime.env.DB;
  await db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(id).run();
  await db.prepare("DELETE FROM users WHERE id = ?").bind(id).run();
  return json({ success: true });
};

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}