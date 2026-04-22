import type { APIRoute } from "astro";
import { authenticateRequest } from "../../../lib/auth";

export const prerender = false;

export const GET: APIRoute = async ({ request, url, locals }) => {
  const user = await authenticateRequest(request, locals.runtime.env as any);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const db = locals.runtime.env.DB;
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20"), 100);
  const status = url.searchParams.get("status");
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: any[] = [];
  if (status === "confirmed") { conditions.push("confirmed = 1"); }
  else if (status === "pending") { conditions.push("confirmed = 0"); }
  const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";

  const countRow = await db.prepare(`SELECT COUNT(*) as total FROM newsletter ${where}`).bind(...params).first<{ total: number }>();
  const { results } = await db.prepare(
    `SELECT * FROM newsletter ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).bind(...params, limit, offset).all<any>();

  return json({
    subscribers: results ?? [],
    pagination: { page, limit, total: Number(countRow?.total) || 0, totalPages: Math.ceil((Number(countRow?.total) || 0) / limit) },
  });
};

export const DELETE: APIRoute = async ({ request, url, locals }) => {
  const user = await authenticateRequest(request, locals.runtime.env as any);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const segments = url.pathname.split("/");
  const id = segments[segments.length - 1];
  if (!id || id === "subscribers") return json({ error: "Missing id" }, 400);

  await locals.runtime.env.DB.prepare("DELETE FROM newsletter WHERE id = ?").bind(id).run();
  return json({ success: true });
};

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}