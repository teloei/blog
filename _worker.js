/**
 * _worker.js — 忒卷博客 SSR + Auth 中间件
 * 
 * 部署位置: Cloudflare Pages 项目根目录
 * Cloudflare Pages Functions 入口
 * 
 * 功能:
 *  1. SSR 注入：拦截 / 和 /post.html → 请求 Worker API → 注入数据到 HTML
 *  2. Auth 保护：/admin.html 未登录自动跳转
 *  3. %YEAR% 替换：模板变量在 Worker 层面处理
 *  4. OG Meta + JSON-LD：SSR 时直接写入 HTML
 *  5. 自定义域绑定：统一入口，支持多域名配置
 * 
 * 依赖:
 *  - WORKER_API 常量指向 Worker 端点（生产环境改为自定义域名后同步更新）
 *  - Worker 端点需正确配置 CORS（Access-Control-Allow-Origin）
 */

// ─── 配置 ───────────────────────────────────────────────────
const SITE_URL    = 'https://blog.teloei35.workers.dev'; // SSR 回退源
const WORKER_API  = 'https://blog.teloei35.workers.dev/blogApi';
const SITE_TITLE  = '忒卷';
const SITE_DESC   = '忒卷的个人博客，记录技术、生活、思考。';
const SITE_AUTHOR = '忒卷';
const ADMIN_TOKEN_TTL_DAYS = 30;

// ─── 环境变量读取（Pages Functions env） ───────────────────
function getEnv(env) {
  return {
    siteUrl:   env.SITE_URL   || SITE_URL,
    workerApi: env.WORKER_API  || WORKER_API,
    siteTitle: env.SITE_TITLE  || SITE_TITLE,
    siteDesc:  env.SITE_DESC  || SITE_DESC,
    adminTtl:  parseInt(env.ADMIN_TOKEN_TTL_DAYS || String(ADMIN_TOKEN_TTL_DAYS), 10)
  };
}

// ─── 内部 API 调用（避免跨域 + 复用 Worker 逻辑） ──────────
async function apiPost(path, body, env) {
  const cfg = getEnv(env);
  const url = `${cfg.workerApi.replace(/\/blogApi$/, '')}${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) return null;
  try { return await res.json(); } catch (_) { return null; }
}

// ─── Admin 鉴权（Pages Function 与 Worker 同域，直接读取 Cookie） ──
async function adminAuth(request, env) {
  const cookieHeader = request.headers.get('Cookie') || '';
  const match = cookieHeader.match(/xiaogai_admin_token=([^;]+)/);
  const token = match ? decodeURIComponent(match[1]) : '';
  if (!token) return null;

  // Pages Function 无独立 DB，直接信任 Worker 签发的 token
  // Worker 的 handleAdminLogin 会验证 token 有效性
  // 此处只检查 token 存在，Worker 侧负责真正的验证
  return token;
}

// ─── 工具函数 ──────────────────────────────────────────────
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      year: 'numeric', month: '2-digit', day: '2-digit'
    });
  } catch (_) { return dateStr; }
}

// ─── 替换 HTML 中的 OG meta placeholders ──────────────────
function fillPostMeta(html, post, cfg, idOrSlug) {
  const ogImage = cfg.siteUrl + '/og-image.png';
  const canonical = `${cfg.siteUrl}/post.html?id=${idOrSlug}`;
  const publishedTime = post.publishedAt || post.updatedAt || new Date().toISOString();
  const updatedTime   = post.updatedAt   || publishedTime;

  const replacements = [
    [/<title>文章 \| 忒卷<\/title>/,
     `<title>${escapeHtml(post.title)} | ${cfg.siteTitle}</title>`],
    [/<meta property="og:title" content="">/,
     `<meta property="og:title" content="${escapeHtml(post.title)}">`],
    [/<meta property="og:description" content="">/,
     `<meta property="og:description" content="${escapeHtml(post.excerpt || '')}">`],
    [/<meta property="og:url" content="">/,
     `<meta property="og:url" content="${canonical}">`],
    [/<meta property="og:image" content="">/,
     `<meta property="og:image" content="${ogImage}">`],
    [/<meta property="article:published_time" content="">/,
     `<meta property="article:published_time" content="${publishedTime}">`],
    [/<meta name="twitter:title" content="">/,
     `<meta name="twitter:title" content="${escapeHtml(post.title)}">`],
    [/<meta name="twitter:description" content="">/,
     `<meta name="twitter:description" content="${escapeHtml(post.excerpt || '')}">`],
    [/<meta name="twitter:image" content="">/,
     `<meta name="twitter:image" content="${ogImage}">`],
  ];

  let result = html;
  for (const [pattern, replacement] of replacements) {
    result = result.replace(pattern, replacement);
  }

  // JSON-LD
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    'headline': post.title,
    'description': post.excerpt || '',
    'datePublished': publishedTime,
    'dateModified': updatedTime,
    'author': { '@type': 'Person', 'name': SITE_AUTHOR },
    'publisher': {
      '@type': 'Organization',
      'name': cfg.siteTitle,
      'url': cfg.siteUrl
    },
    'url': canonical,
    'image': ogImage,
    'mainEntityOfPage': {
      '@type': 'WebPage',
      '@id': canonical
    }
  };
  result = result.replace(
    /<script type="application\/ld\+json" id="article-json-ld">[\s\S]*?<\/script>/,
    `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`
  );

  return result;
}

// ─── 渲染首页 HTML ─────────────────────────────────────────
async function renderHomePage(request, env) {
  const cfg = getEnv(env);
  const url = new URL(request.url);
  const year = new Date().getFullYear();

  // 请求 Worker API 获取首页数据
  let posts = [], tags = [];
  try {
    const res = await fetch(cfg.workerApi, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'listPosts', page: 1, pageSize: 9 })
    });
    if (res.ok) {
      const data = await res.json();
      posts = (data.posts || []).slice(0, 9);
    }
  } catch (_) {}

  try {
    const res = await fetch(cfg.workerApi, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'getTags' })
    });
    if (res.ok) {
      const data = await res.json();
      tags = (data.tags || []).map(function (t) { return typeof t === 'string' ? t : t.tag; });
    }
  } catch (_) {}

  // 获取 HTML 模板
  let html;
  try {
    const templateUrl = url.origin + '/index.html';
    const res = await fetch(templateUrl);
    if (res.ok) {
      html = await res.text();
    } else {
      return new Response('index.html not found', { status: 404 });
    }
  } catch (_) {
    return fetch(request);
  }

  // 注入 SSR 数据
  const initData = {
    posts: posts,
    tags:  tags,
    page:  1,
    totalPages: Math.max(1, Math.ceil(posts.length / 9)),
    siteTitle: cfg.siteTitle,
    siteDesc:  cfg.siteDesc,
    siteUrl:   cfg.siteUrl,
    year: year
  };

  const configScript = `<script>
window.__BLOG_CONFIG__=${JSON.stringify({
  siteTitle: cfg.siteTitle,
  siteUrl:   cfg.siteUrl,
  apiUrl:    cfg.workerApi,
  year:      year
})};
window.__SSR_DATA__=${JSON.stringify(initData)};
<\/script>`;

  html = html
    .replace('</head>', `${configScript}</head>`)
    .replace('%YEAR%', String(year));

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
      'X-SSR': 'home'
    }
  });
}

// ─── 渲染文章页 HTML ───────────────────────────────────────
async function renderPostPage(request, env) {
  const cfg = getEnv(env);
  const url = new URL(request.url);
  const idOrSlug = url.searchParams.get('id') || url.searchParams.get('slug');
  if (!idOrSlug) {
    return Response.redirect(cfg.siteUrl + '/index.html', 302);
  }

  // 请求 Worker API 获取文章数据
  let post = null, comments = [];
  try {
    const res = await fetch(cfg.workerApi, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'getPost', id: idOrSlug })
    });
    if (res.ok) {
      const data = await res.json();
      post     = data.post     || null;
      comments = data.comments || [];
    }
  } catch (_) {}

  // 获取 HTML 模板
  let html;
  try {
    const templateUrl = url.origin + '/post.html';
    const res = await fetch(templateUrl);
    if (res.ok) {
      html = await res.text();
    } else {
      return new Response('post.html not found', { status: 404 });
    }
  } catch (_) {
    return fetch(request);
  }

  // 填充 OG meta + JSON-LD
  if (post) {
    html = fillPostMeta(html, post, cfg, idOrSlug);
  }

  // 注入 SSR 数据
  const initData = { post, comments, siteUrl: cfg.siteUrl };
  const configScript = `<script>
window.__BLOG_CONFIG__=${JSON.stringify({
  siteTitle: cfg.siteTitle,
  siteUrl:   cfg.siteUrl,
  apiUrl:    cfg.workerApi
})};
window.__SSR_DATA__=${JSON.stringify(initData)};
<\/script>`;
  html = html.replace('</head>', `${configScript}</head>`);

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': post
        ? 'public, max-age=300, stale-while-revalidate=3600'
        : 'no-cache',
      'X-SSR': post ? 'post:' + post.id : 'post:404'
    }
  });
}

// ─── Admin 鉴权处理 ────────────────────────────────────────
async function handleAdminPage(request, env) {
  const cfg = getEnv(env);
  const token = await adminAuth(request, env);
  let html;

  try {
    const res = await fetch(new URL(request.url).origin + '/admin.html');
    html = await res.text();
  } catch (_) {
    return new Response('admin.html not found', { status: 404 });
  }

  if (!token) {
    // 未登录：注入 JS → 自动跳转登录页
    const redirect = `<script>
(function(){
  var redirect = new URLSearchParams(window.location.search).get('redirect')
               || window.location.pathname + window.location.search;
  window.location.href = '/admin-login.html?redirect=' + encodeURIComponent(redirect);
})();
<\/script>`;
    html = html.replace('</body>', `${redirect}</body>`);
    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store'
      }
    });
  }

  // 已登录：注入 token，Set-Cookie 续期
  const expires = new Date(Date.now() + cfg.adminTtl * 864e5).toUTCString();
  const injectScript = `<script>window.__ADMIN_TOKEN__=${JSON.stringify(token)};<\/script>`;
  html = html.replace('</head>', `${injectScript}</head>`);

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Set-Cookie': `xiaogai_admin_token=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Expires=${expires}`,
      'Cache-Control': 'private, no-store'
    }
  });
}

// ─── 主入口 ─────────────────────────────────────────────────
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  // 静态资源 → 直接透传
  const staticExts = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg',
    '.ico', '.woff', '.woff2', '.ttf', '.eot', '.mp4', '.webm', '.mp3', '.webp'];
  const ext = pathname.includes('.') ? '.' + pathname.split('.').pop().split('?')[0] : '';
  if (staticExts.includes(ext)) {
    return fetch(request);
  }

  // /admin.html → 鉴权
  if (pathname === '/admin.html' || pathname.endsWith('/admin.html')) {
    return handleAdminPage(request, env);
  }

  // /admin-login.html → 直接透传（无鉴权）
  if (pathname === '/admin-login.html') {
    const res = await fetch(request);
    return new Response(await res.text(), {
      headers: {
        ...Object.fromEntries(res.headers.entries()),
        'Cache-Control': 'no-store'
      }
    });
  }

  // /index.html 或 / → 首页 SSR
  if (pathname === '/' || pathname === '/index.html') {
    return renderHomePage(request, env);
  }

  // /post.html?id=xxx → 文章页 SSR
  if (pathname === '/post.html' || pathname.startsWith('/post.html')) {
    return renderPostPage(request, env);
  }

  // 其他 → 透传
  return fetch(request);
}
