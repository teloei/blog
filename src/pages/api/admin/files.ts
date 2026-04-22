import type { APIRoute } from "astro";
import { authenticateRequest } from "../../../lib/auth";

export const prerender = false;

export const GET: APIRoute = async ({ request, url, locals }) => {
  const user = await authenticateRequest(request, locals.runtime.env as any);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const bucket = locals.runtime.env.BUCKET;
  if (!bucket) return json({ error: "R2 not configured" }, 500);

  const prefix = url.searchParams.get("prefix") ?? "";
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 100);
  const cursor = url.searchParams.get("cursor") ?? undefined;

  const listed = await bucket.list({ prefix, limit, cursor });
  return json({
    files: listed.objects.map((o: any) => ({
      key: o.key, size: o.size,
      uploaded: o.uploaded instanceof Date ? o.uploaded.toISOString() : o.uploaded,
      contentType: o.httpMetadata?.contentType ?? "",
    })),
    truncated: listed.truncated,
    cursor: (listed as any).cursor,
  });
};

export const DELETE: APIRoute = async ({ request, url, locals }) => {
  const user = await authenticateRequest(request, locals.runtime.env as any);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const key = decodeURIComponent(url.pathname.replace(/.*\/admin\/files\/?/, ""));
  if (!key) return json({ error: "Missing key" }, 400);

  await locals.runtime.env.BUCKET.delete(key);
  await locals.runtime.env.DB.prepare("INSERT INTO audit_log (user_id,action,target_type,target_id) VALUES (?,?,?,?)")
    .bind(user.id, "delete_file", "file", key).run();
  return json({ success: true });
};

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}