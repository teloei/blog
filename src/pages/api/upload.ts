// 图片上传 API (R2 存储)
// POST /api/upload  - 上传图片（multipart/form-data，字段名: file）
// GET  /api/upload?url=xxx  - 获取已上传文件的 URL

import type { APIRoute } from 'astro';

const ALLOWED_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
]);
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

// 简单的文件名清理
function sanitizeFilename(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || 'png';
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  return `uploads/${timestamp}-${random}.${ext}`;
}

export const POST: APIRoute = async ({ request, locals }) => {
  const bucket = locals.runtime.env.BUCKET;

  const formData = await request.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return new Response(JSON.stringify({ error: 'No file provided' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return new Response(JSON.stringify({ error: 'File type not allowed. Use JPEG, PNG, GIF, WebP, or SVG.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (file.size > MAX_SIZE) {
    return new Response(JSON.stringify({ error: 'File too large. Maximum 5MB.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const key = sanitizeFilename(file.name);
  await bucket.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
  });

  const url = `/api/files/${key}`;
  return new Response(
    JSON.stringify({ success: true, key, url }),
    { status: 201, headers: { 'Content-Type': 'application/json' } }
  );
};
