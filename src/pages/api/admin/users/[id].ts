import type { APIRoute } from "astro";
import { authenticateRequest, hashPassword } from "../../../../lib/auth";

export const prerender = false;

export const PUT: APIRoute = async ({ request, params, locals }) => {
  const user = await authenticateRequest(request, locals.runtime.env as any);
  if (!user || user.role !== "admin") return json({ error: "Forbidden" }, 403);

  const id = params.id;
  if (!id) return json({ error: "Missing id" }, 400);

  const body = await request.json().catch(() => ({})) as any;
  const sets: string[] = [];
  const values: any[] = [];

  if (body.name !== undefined) {
    sets.push("name = ?");
    values.push(body.name);
  }
  if (body.role !== undefined) {
    sets.push("role = ?");
    values.push(body.role);
  }
  if (body.is_active !== undefined) {
    sets.push("is_active = ?");
    values.push(body.is_active ? 1 : 0);
  }
  if (body.password) {
    sets.push("password_hash = ?");
    values.push(await hashPassword(body.password));
  }
  if (!sets.length) return json({ error: "Nothing to update" }, 400);

  sets.push("updated_at = datetime('now')");
  await locals.runtime.env.DB.prepare(
    `UPDATE users SET ${sets.join(", ")} WHERE id = ?`
  ).bind(...values, id).run();

  return json({ success: true });
};

export const DELETE: APIRoute = async ({ request, params, locals }) => {
  const user = await authenticateRequest(request, locals.runtime.env as any);
  if (!user || user.role !== "admin") return json({ error: "Forbidden" }, 403);

  const id = params.id;
  if (!id) return json({ error: "Missing id" }, 400);
  if (parseInt(id, 10) === user.id) return json({ error: "Cannot delete yourself" }, 400);

  await locals.runtime.env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(id).run();
  await locals.runtime.env.DB.prepare("DELETE FROM users WHERE id = ?").bind(id).run();

  return json({ success: true });
};

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
