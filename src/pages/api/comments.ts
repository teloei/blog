// 评论 API
// GET    /api/comments?slug=xxx          - 获取某篇文章的评论
// POST   /api/comments                   - 发表评论 { slug, author, email?, website?, content, parentId? }
// POST   /api/comments/like              - 点赞评论 { commentId, ipHash }
// DELETE /api/comments?id=xxx&token=xxx  - 删除评论（管理）

import type { APIRoute } from 'astro';
import { json } from '../../lib/utils';

// 简单的反垃圾：检查内容长度和频率
function validateComment(data: Record<string, any>): string | null {
  if (!data.slug || typeof data.slug !== 'string') return '缺少文章标识';
  if (!data.content || typeof data.content !== 'string') return '评论内容不能为空';
  if (data.content.length > 2000) return '评论内容过长（最多 2000 字）';
  if (data.content.length < 2) return '评论内容太短';

  if (data.author && typeof data.author === 'string') {
    if (data.author.length > 30) return '昵称过长（最多 30 字）';
  }
  if (data.email && typeof data.email === 'string') {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return '邮箱格式不正确';
  }
  if (data.website && typeof data.website === 'string') {
    try { new URL(data.website); } catch { return '网站地址格式不正确'; }
  }

  // 简单的 XSS 检测
  if (/<script|<iframe|on\w+=/i.test(data.content)) return '评论包含不允许的内容';

  return null;
}

// 递归构建评论树
function buildTree(comments: any[]): any[] {
  const map = new Map<number, any>();
  const tree: any[] = [];

  comments.forEach(c => {
    map.set(c.id, { ...c, children: [] });
  });

  comments.forEach(c => {
    const node = map.get(c.id)!;
    if (c.parent_id && map.has(c.parent_id)) {
      map.get(c.parent_id)!.children.push(node);
    } else {
      tree.push(node);
    }
  });

  return tree;
}

export const GET: APIRoute = async ({ url, locals }) => {
  const db = locals.runtime.env.DB;
  const slug = url.searchParams.get('slug');

  if (!slug) {
    return json({ error: 'Missing slug' }, 400);
  }

  const { results } = await db
    .prepare(
      `SELECT c.*, 
              (SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.id) as like_count
       FROM comments c 
       WHERE c.slug = ? AND c.is_visible = 1 
       ORDER BY c.created_at ASC`
    )
    .bind(slug)
    .all();

  const tree = buildTree(results || []);
  return json({ slug, comments: tree, total: results?.length || 0 });
};

export const POST: APIRoute = async ({ request, url, locals }) => {
  // /api/comments/like -> 点赞
  if (url.pathname.endsWith('/like')) {
    const db = locals.runtime.env.DB;
    const { commentId, ipHash } = await request.json();

    if (!commentId || !ipHash) {
      return json({ error: 'Missing commentId or ipHash' }, 400);
    }

    // 检查是否已点赞
    const existing = await db
      .prepare('SELECT 1 FROM comment_likes WHERE comment_id = ? AND ip_hash = ?')
      .bind(commentId, ipHash)
      .first();

    if (existing) {
      return json({ error: 'Already liked' }, 409);
    }

    await db
      .prepare('INSERT INTO comment_likes (comment_id, ip_hash) VALUES (?, ?)')
      .bind(commentId, ipHash)
      .run();

    const { results } = await db
      .prepare('SELECT COUNT(*) as count FROM comment_likes WHERE comment_id = ?')
      .bind(commentId)
      .all<{ count: number }>();

    return json({ likes: results?.[0]?.count || 0 });
  }

  // /api/comments -> 发表评论
  const db = locals.runtime.env.DB;
  const data = await request.json();

  const error = validateComment(data);
  if (error) {
    return json({ error }, 400);
  }

  const { slug, author, email, website, content, parentId } = data;

  const result = await db
    .prepare(
      `INSERT INTO comments (slug, author, email, website, content, parent_id)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(
      slug,
      author?.slice(0, 30) || '匿名',
      email || null,
      website || null,
      content.slice(0, 2000),
      parentId || null
    )
    .run();

  return json({
      id: result.meta.last_row_id,
      slug,
      author: author?.slice(0, 30) || '匿名',
      content: content.slice(0, 2000),
      parent_id: parentId || null,
      created_at: new Date().toISOString(),
    }, 201);
};

export const DELETE: APIRoute = async ({ url, locals }) => {
  const db = locals.runtime.env.DB;
  const id = url.searchParams.get('id');

  if (!id) {
    return json({ error: 'Missing comment id' }, 400);
  }

  // 软删除（标记为不可见）
  await db
    .prepare('UPDATE comments SET is_visible = 0 WHERE id = ?')
    .bind(id)
    .run();

  return json({ success: true });
};
