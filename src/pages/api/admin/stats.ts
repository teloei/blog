import type { APIRoute } from "astro";
import { authenticateRequest } from "../../../lib/auth";
import { json } from "../../../lib/utils";

export const prerender = false;

export const GET: APIRoute = async ({ request, locals }) => {
  const user = await authenticateRequest(request, locals.runtime.env as any);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const db = locals.runtime.env.DB;
  
  const [articleCount, commentStats, subStats, topArticles, recentComments] = await Promise.all([
    db.prepare("SELECT COUNT(*) as n FROM blog_posts WHERE draft = 0").all(),
    db.prepare("SELECT COUNT(*) as total, SUM(CASE WHEN is_visible = 0 THEN 1 ELSE 0 END) as pending FROM comments").first(),
    db.prepare("SELECT COUNT(*) as total, SUM(CASE WHEN confirmed = 1 THEN 1 ELSE 0 END) as confirmed FROM newsletter").first(),
    db.prepare("SELECT slug, count FROM views ORDER BY count DESC LIMIT 5").all(),
    db.prepare("SELECT c.*, b.title as post_title FROM comments c LEFT JOIN blog_posts b ON c.slug = b.slug ORDER BY c.created_at DESC LIMIT 5").all()
  ]);

  // Last 7 days trend
  const trend = [];
  for(let i=6; i>=0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const v = await db.prepare("SELECT SUM(count) as n FROM views WHERE date(updated_at) = ?").bind(dateStr).first();
    trend.push({ date: dateStr, views: (v as any)?.n || 0 });
  }

  return json({
    overview: {
      totalViews: trend.reduce((a, b) => a + (b.views || 0), 0),
      totalArticles: (articleCount.results?.[0] as any)?.n || 0,
      totalComments: Number((commentStats as any)?.total) || 0,
      pendingComments: Number((commentStats as any)?.pending) || 0,
      totalSubscribers: Number((subStats as any)?.total) || 0,
      confirmedSubscribers: Number((subStats as any)?.confirmed) || 0,
    },
    topArticles: topArticles.results || [],
    recentComments: recentComments.results || [],
    viewsTrend: trend || [],
  });
};