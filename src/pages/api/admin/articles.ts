import type { APIRoute } from "astro";
import { authenticateRequest } from "../../../lib/auth";
import { getCollection } from "astro:content";

export const prerender = false;

export const GET: APIRoute = async ({ request, locals }) => {
  const user = await authenticateRequest(request, locals.runtime.env as any);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const db = locals.runtime.env.DB;
  const posts = await getCollection("blog");
  const sorted = posts.sort((a, b) =>
    new Date(b.data.pubDate).getTime() - new Date(a.data.pubDate).getTime()
  );

  const { results: views } = await db.prepare("SELECT slug, count FROM views").all<any>();
  const { results: comments } = await db.prepare(
    "SELECT slug, COUNT(*) as count FROM comments WHERE is_visible=1 GROUP BY slug"
  ).all<any>();

  const viewMap = new Map((views ?? []).map((v: any) => [v.slug, v.count]));
  const commentMap = new Map((comments ?? []).map((c: any) => [c.slug, c.count]));

  const articles = sorted.map(p => ({
    slug: p.slug,
    title: p.data.title,
    description: p.data.description ?? "",
    pubDate: p.data.pubDate,
    tags: p.data.tags ?? [],
    draft: (p.data as any).draft ?? false,
    views: viewMap.get(p.slug) ?? 0,
    comments: commentMap.get(p.slug) ?? 0,
  }));

  return json({ articles, total: articles.length });
};

export const DELETE: APIRoute = async ({ request, url, locals }) => {
  const user = await authenticateRequest(request, locals.runtime.env as any);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const segments = url.pathname.split("/");
  const slug = segments[segments.length - 1];
  if (!slug || slug === "articles") return json({ error: "Missing slug" }, 400);

  const db = locals.runtime.env.DB;
  await db.prepare("DELETE FROM views WHERE slug = ?").bind(slug).run();
  await db.prepare("DELETE FROM comments WHERE slug = ?").bind(slug).run();
  await db.prepare("INSERT INTO audit_log (user_id,action,target_type,target_id) VALUES (?,?,?,?)")
    .bind(user.id, "delete_article_data", "article", slug).run();

  return json({ success: true, message: "DB data cleared. Delete .md file via Git." });
};

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}