import type { APIRoute } from "astro";
import { authenticateRequest } from "../../../../lib/auth";

export const prerender = false;

export const DELETE: APIRoute = async ({ request, params, locals }) => {
  const user = await authenticateRequest(request, locals.runtime.env as any);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const slug = params.slug;
  if (!slug) return json({ error: "Missing slug" }, 400);

  await locals.runtime.env.DB.prepare("DELETE FROM views WHERE slug = ?").bind(slug).run();
  await locals.runtime.env.DB.prepare("DELETE FROM comments WHERE slug = ?").bind(slug).run();
  await locals.runtime.env.DB.prepare(
    "INSERT INTO audit_log (user_id,action,target_type,target_id) VALUES (?,?,?,?)"
  ).bind(user.id, "delete_article_data", "article", slug).run();

  return json({ success: true, message: "DB data cleared. Delete .md file via Git." });
};

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
