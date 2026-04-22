import type { APIRoute } from "astro";
import { authenticateRequest } from "../../../../lib/auth";

export const prerender = false;

export const PUT: APIRoute = async ({ request, params, locals }) => {
  const user = await authenticateRequest(request, locals.runtime.env as any);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const id = params.id;
  if (!id) return json({ error: "Missing id" }, 400);

  const body = await request.json().catch(() => ({})) as any;
  const sets: string[] = [];
  const values: any[] = [];

  if (body.is_visible !== undefined) {
    sets.push("is_visible = ?");
    values.push(body.is_visible ? 1 : 0);
  }
  if (body.content !== undefined) {
    sets.push("content = ?");
    values.push(body.content);
  }
  if (!sets.length) return json({ error: "Nothing to update" }, 400);

  await locals.runtime.env.DB.prepare(
    `UPDATE comments SET ${sets.join(", ")} WHERE id = ?`
  ).bind(...values, id).run();

  await locals.runtime.env.DB.prepare(
    "INSERT INTO audit_log (user_id,action,target_type,target_id,detail) VALUES (?,?,?,?,?)"
  ).bind(user.id, "update_comment", "comment", id, JSON.stringify(body)).run();

  return json({ success: true });
};

export const DELETE: APIRoute = async ({ request, params, locals }) => {
  const user = await authenticateRequest(request, locals.runtime.env as any);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const id = params.id;
  if (!id) return json({ error: "Missing id" }, 400);

  await locals.runtime.env.DB.prepare("DELETE FROM comments WHERE id = ?").bind(id).run();
  await locals.runtime.env.DB.prepare(
    "INSERT INTO audit_log (user_id,action,target_type,target_id) VALUES (?,?,?,?)"
  ).bind(user.id, "delete_comment", "comment", id).run();

  return json({ success: true });
};

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
