// 浏览量统计 API
// GET  /api/views?slug=xxx        - 获取某篇文章的浏览量
// POST /api/views                 - 记录一次浏览 { slug }
// GET  /api/views?top=10          - 获取 Top N 热门文章

import type { APIRoute } from 'astro';
import { json } from '../../lib/utils';

export const GET: APIRoute = async ({ url, locals }) => {
  const db = locals.runtime.env.DB;
  const slug = url.searchParams.get('slug');
  const top = url.searchParams.get('top');

  if (slug) {
    const result = await db
      .prepare('SELECT count FROM views WHERE slug = ?')
      .bind(slug)
      .first<{ count: number }>();
    return json({ slug, views: result?.count || 0 });
  }

  if (top) {
    const limit = Math.min(parseInt(top) || 10, 50);
    const { results } = await db
      .prepare('SELECT slug, count FROM views ORDER BY count DESC LIMIT ?')
      .bind(limit)
      .all<{ slug: string; count: number }>();
    return json(results);
  }

  return json({ error: 'Missing slug or top parameter' }, 400);
};

export const POST: APIRoute = async ({ request, locals }) => {
  const db = locals.runtime.env.DB;
  const { slug } = await request.json();

  if (!slug) {
    return json({ error: 'Missing slug' }, 400);
  }

  // Upsert: 如果已存在则 +1，否则插入
  await db.prepare(
    `INSERT INTO views (slug, count, updated_at) VALUES (?, 1, datetime('now'))
     ON CONFLICT(slug) DO UPDATE SET count = count + 1, updated_at = datetime('now')`
  ).bind(slug).run();

  const result = await db
    .prepare('SELECT count FROM views WHERE slug = ?')
    .bind(slug)
    .first<{ count: number }>();

  return json({ slug, views: result?.count || 1 });
};
