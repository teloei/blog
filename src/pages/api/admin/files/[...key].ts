import type { APIRoute } from "astro";
import { authenticateRequest } from "../../../../lib/auth";

export const prerender = false;

export const DELETE: APIRoute = async ({ request, params, locals }) => {
  const user = await authenticateRequest(request, locals.runtime.env as any);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const key = Array.isArray(params.key) ? params.key.join("/") : params.key;
  if (!key) return json({ error: "Missing key" }, 400);

  await locals.runtime.env.BUCKET.delete(key);
  await locals.runtime.env.DB.prepare(
    "INSERT INTO audit_log (user_id,action,target_type,target_id) VALUES (?,?,?,?)"
  ).bind(user.id, "delete_file", "file", key).run();

  return json({ success: true });
};

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
