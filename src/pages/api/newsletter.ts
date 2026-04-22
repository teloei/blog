// Newsletter 订阅 API
// POST /api/newsletter    - 订阅 { email }
// POST /api/newsletter/confirm  - 确认订阅 { token }

import type { APIRoute } from 'astro';
import { json } from '../../lib/utils';

function generateToken(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}

export const POST: APIRoute = async ({ request, url, locals }) => {
  const db = locals.runtime.env.DB;

  // /api/newsletter/confirm -> 确认
  if (url.pathname.endsWith('/confirm')) {
    const { token } = await request.json();
    if (!token) {
      return json({ error: 'Missing token' }, 400);
    }

    const result = await db
      .prepare('UPDATE newsletter SET confirmed = 1, confirmed_at = datetime(\'now\') WHERE confirm_token = ? AND confirmed = 0')
      .bind(token)
      .run();

    if (result.meta.changes === 0) {
      return json({ error: 'Invalid or already confirmed token' }, 400);
    }

    return json({ success: true });
  }

  // /api/newsletter -> 订阅
  const { email } = await request.json();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: '请输入有效的邮箱地址' }, 400);
  }

  const token = generateToken();

  try {
    await db
      .prepare('INSERT INTO newsletter (email, confirm_token) VALUES (?, ?)')
      .bind(email, token)
      .run();

    return json({ success: true });
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) {
      return json({ error: '该邮箱已订阅' }, 400);
    }
    return json({ error: '订阅失败，请稍后再试' }, 500);
  }
};
