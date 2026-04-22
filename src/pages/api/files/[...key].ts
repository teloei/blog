// R2 文件访问端点 (SSR only)
// GET /api/files/[...key]  - 获取 R2 存储的文件
export const prerender = false;

import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ params, locals }) => {
  const bucket = locals.runtime.env.BUCKET;
  const key = params.key;

  if (!key) {
    return new Response('Not found', { status: 404 });
  }

  const object = await bucket.get(key);

  if (!object) {
    return new Response('Not found', { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('ETag', object.httpEtag);

  return new Response(object.body, { headers });
};