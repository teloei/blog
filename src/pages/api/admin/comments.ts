import type { APIRoute } from "astro";
import { authenticateRequest } from "../../../lib/auth";

export const prerender = false;

export const GET: APIRoute = async ({ request, url, locals }) => {
  const user = await authenticateRequest(request, locals.runtime.env as any);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const db = locals.runtime.env.DB;
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20"), 100);
  const status = url.searchParams.get("status") ?? "all";
  const slug = url.searchParams.get("slug");
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: any[] = [];
  if (status === "visible") { conditions.push("is_visible = 1"); }
  else if (status === "hidden") { conditions.push("is_visible = 0"); }
  if (slug) { conditions.push("slug = ?"); params.push(slug); }
  const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";

  const countRow = await db.prepare(`SELECT COUNT(*) as total FROM comments ${where}`).bind(...params).first<{ total: number }>();
  const { results } = await db.prepare(
    `SELECT c.*, (SELECT COUNT(*) FROM comment_likes WHERE comment_id=c.id) as like_count
     FROM comments c ${where} ORDER BY c.created_at DESC LIMIT ? OFFSET ?`
  ).bind(...params, limit, offset).all<any>();

  return json({
    comments: results ?? [],
    pagination: { page, limit, total: Number(countRow?.total) || 0, totalPages: Math.ceil((Number(countRow?.total) || 0) / limit) },
  });
};

export const PUT: APIRoute = async ({ request, url, locals }) => {
  const user = await authenticateRequest(request, locals.runtime.env as any);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const db = locals.runtime.env.DB;
  const segments = url.pathname.split("/");
  const id = segments[segments.length - 1];
  if (!id || id === "comments") return json({ error: "Missing id" }, 400);

  const body = await request.json().catch(() => ({})) as any;
  const sets: string[] = [];
  const params: any[] = [];
  if (body.is_visible !== undefined) { sets.push("is_visible = ?"); params.push(body.is_visible ? 1 : 0); }
  if (body.content !== undefined) { sets.push("content = ?"); params.push(body.content); }
  if (!sets.length) return json({ error: "Nothing to update" }, 400);

  params.push(id);
  await db.prepare(`UPDATE comments SET ${sets.join(", ")} WHERE id = ?`).bind(...params).run();
  await db.prepare("INSERT INTO audit_log (user_id,action,target_type,target_id,detail) VALUES (?,?,?,?,?)")
    .bind(user.id, "update_comment", "comment", id, JSON.stringify(body)).run();

  return json({ success: true });
};

export const DELETE: APIRoute = async ({ request, url, locals }) => {
  const user = await authenticateRequest(request, locals.runtime.env as any);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const db = locals.runtime.env.DB;
  const segments = url.pathname.split("/");
  const id = segments[segments.length - 1];
  if (!id || id === "comments") return json({ error: "Missing id" }, 400);

  await db.prepare("DELETE FROM comments WHERE id = ?").bind(id).run();
  await db.prepare("INSERT INTO audit_log (user_id,action,target_type,target_id) VALUES (?,?,?,?)")
    .bind(user.id, "delete_comment", "comment", id).run();

  return json({ success: true });
};

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}