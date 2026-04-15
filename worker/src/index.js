import { SAMPLE_POSTS } from "./sample-posts.js";

// 仅允许以下域名跨域访问 API（安全：防止其他网站调用）
const ALLOWED_ORIGINS = [
  "https://blog.03518888.xyz",        // 自定义域名（主要）
  "https://blog.teloei35.workers.dev" // Worker 直连域名
];

// 当前请求的 origin，fetch 入口处设置，供 json() 使用
let _currentOrigin = ALLOWED_ORIGINS[0];

// 速率限制信息，由 checkRateLimit 设置，json() 读取并注入响应头
let _rateLimitInfo = null;

function buildCorsHeaders(origin) {
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : (ALLOWED_ORIGINS[0] || "");
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Max-Age": "86400"
  };
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGINS[0],
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400"
};

const MAX_PAGE_SIZE = 50;
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

const MIME_TO_EXT = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "image/avif": "avif"
};

// 图片文件头魔数验证（防扩展名伪造）
const MAGIC_NUMBERS = {
  jpg:  [0xFF, 0xD8, 0xFF],
  jpeg: [0xFF, 0xD8, 0xFF],
  png:  [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
  webp: [0x52, 0x49, 0x46, 0x46],  // RIFF....WEBP
  gif:  [0x47, 0x49, 0x46, 0x38],  // GIF8
  avif: [0x00, 0x00, 0x00],        // 需要检测 ftyp box
  svg:  null                         // SVG 是文本，不做二进制验证
};

function validateMagicNumber(bytes, extension) {
  const magic = MAGIC_NUMBERS[extension];
  if (!magic) return false;

  // SVG：检查是否为 XML 文本
  if (extension === "svg") {
    const text = new TextDecoder("utf-8", { fatal: false })
      .decode(bytes.slice(0, 4096));
    return text.trim().startsWith("<svg") || text.trim().startsWith("<?xml");
  }

  // AVIF：检查是否为 MP4/MIFF 文件（avif 实际是 HEIF 容器）
  if (extension === "avif") {
    // 跳过前 4 字节 size，检查 ftyp box
    if (bytes.length < 12) return false;
    const ftyp = String.fromCharCode(
      bytes[4], bytes[5], bytes[6], bytes[7]
    );
    return ftyp === "ftyp";
  }

  // 其他格式：前缀匹配
  for (let i = 0; i < magic.length; i++) {
    if (bytes[i] !== magic[i]) return false;
  }
  return true;
}

const hmacKeyCache = new Map();

// ─── 速率限制配置 ───────────────────────────────────────────────
const RATE_LIMIT_KV = "ratelimit";  // KV 命名空间名称（需在 wrangler.toml 绑定）
const RATE_WINDOW_MS = 60_000;      // 时间窗口：60 秒
const RATE_MAX_REQUESTS = 30;        // 每窗口最多请求次数（安全阈值）
const RATE_MAX_AUTH = 5;            // 登录接口更严格：5次/分钟

function getRateLimitKey(ip, action) {
  const bucket = Math.floor(Date.now() / RATE_WINDOW_MS);
  return `rl:${bucket}:${ip}:${action || "default"}`;
}

async function checkRateLimit(request, action, env) {
  const ip = getClientIp(request);
  const key = getRateLimitKey(ip, action);
  const max = (action === "adminLogin") ? RATE_MAX_AUTH : RATE_MAX_REQUESTS;

  try {
    const kv = env[RATE_LIMIT_KV];
    if (!kv) {
      // 未绑定 KV 时跳过限流（本地开发友好）
      _rateLimitInfo = { remaining: max, limit: max, skipped: true };
      return;
    }

    const raw = await kv.get(key);
    const count = raw ? parseInt(raw, 10) : 0;

    if (count >= max) {
      const retryAfter = Math.ceil(RATE_WINDOW_MS / 1000);
      throw new ApiError(
        `请求过于频繁，请 ${retryAfter} 秒后再试（${count}/${max}）`,
        429
      );
    }

    // 递增计数，设置窗口期 +5s TTL 自动过期
    await kv.put(key, String(count + 1), {
      expirationTtl: Math.ceil(RATE_WINDOW_MS / 1000) + 5
    });

    _rateLimitInfo = { remaining: Math.max(0, max - count - 1), limit: max };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.warn("[RateLimit] KV error:", error.message);
    _rateLimitInfo = { remaining: max, limit: max, skipped: true };
  }
}

function getClientIp(request) {
  // 优先从 CF-Connecting-IP 取真实 IP（Cloudflare 代理）
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  // 其次从 X-Forwarded-For 取第一个 IP
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();

  // 最后用 X-Real-IP
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  return "unknown";
}

// 响应头注入限流信息
function addRateLimitHeaders(headers, info) {
  if (!info) return;
  headers.set("X-RateLimit-Limit", String(info.limit));
  headers.set("X-RateLimit-Remaining", String(info.remaining));
  headers.set("X-RateLimit-Window", String(Math.ceil(RATE_WINDOW_MS / 1000)));
}

class ApiError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      _currentOrigin = request.headers.get("origin") || ALLOWED_ORIGINS[0];
      const dynamicCors = buildCorsHeaders(_currentOrigin);

      if (request.method === "OPTIONS" && url.pathname === "/blogApi") {
        return new Response(null, { status: 204, headers: dynamicCors });
      }

      if (url.pathname === "/blogApi") {
        return await handleBlogApi(request, env);
      }

      if (url.pathname.startsWith("/uploads/")) {
        return await handleUploads(request, env, url.pathname);
      }

      return new Response("Not Found", { status: 404 });
    } catch (error) {
      const status = error instanceof ApiError ? error.status : 500;
      const message = error instanceof ApiError
        ? error.message
        : (error && error.message) || "服务器内部错误";

      // 重置全局状态
      _currentOrigin = ALLOWED_ORIGINS[0];
      _rateLimitInfo = null;

      // 429 Too Many Requests 需要特殊处理
      const headers = new Headers(buildCorsHeaders(_currentOrigin));
      if (status === 429) {
        headers.set("Retry-After", String(Math.ceil(RATE_WINDOW_MS / 1000)));
        console.warn(`[RateLimit] Blocked: ${getClientIp(request)} - ${message}`);
      }

      if (_rateLimitInfo) {
        addRateLimitHeaders(headers, _rateLimitInfo);
      }

      // 把 RateLimit headers 加进来
      const responseHeaders = new Headers({
        "content-type": "application/json; charset=utf-8",
        ...Object.fromEntries(headers.entries())
      });

      console.error("Worker Error", error);
      return new Response(JSON.stringify({ ok: false, message }), {
        status,
        headers: responseHeaders
      });
    }
  }
};

async function handleBlogApi(request, env) {
  if (request.method === "GET") {
    const url = new URL(request.url);
    const action = (url.searchParams.get("action") || "").trim();

    if (action === "getRss") {
      return await handleGetRss(request, env);
    }

    throw new ApiError("GET 仅支持 action=getRss", 405);
  }

  if (request.method !== "POST") {
    throw new ApiError("仅支持 GET/POST", 405);
  }

  const body = await request.json().catch(() => null);
  assert(body && typeof body === "object", "请求体必须是 JSON 对象");

  const action = String(body.action || "").trim();
  assert(action, "缺少 action 参数");

  // ─── 速率限制检查（POST 请求）───────────────────────────────────
  await checkRateLimit(request, action, env);

  const handlers = {
    listPosts: handleListPosts,
    getPost: handleGetPost,
    getTags: handleGetTags,
    createComment: handleCreateComment,
    adminLogin: handleAdminLogin,
    adminListPosts: handleAdminListPosts,
    adminSavePost: handleAdminSavePost,
    adminDeletePost: handleAdminDeletePost,
    adminListComments: handleAdminListComments,
    adminUpdateCommentStatus: handleAdminUpdateCommentStatus,
    adminUploadImage: handleAdminUploadImage,
    seedSamplePosts: handleSeedSamplePosts,

    // 调试端点：检查密码配置状态（仅在日志中输出，不暴露密码）
    _debugPassword: async (_payload, _request, env) => {
      const configuredPassword = String(env.ADMIN_PASSWORD || "").trim();
      return {
        hasPassword: Boolean(configuredPassword),
        passwordLength: configuredPassword.length,
        minLength: 12,
        isValid: configuredPassword.length >= 12,
        note: "密码已配置成功！"
      };
    }
  };

  const handler = handlers[action];
  assert(typeof handler === "function", `不支持的 action: ${action}`);

  const result = await handler(body, request, env);
  return json({ ok: true, ...(result || {}) });
}

async function handleListPosts(payload, _request, env) {
  const db = getDb(env);
  const page = normalizeInt(payload.page, 1, 1, 999999);
  const pageSize = normalizeInt(payload.pageSize, 10, 1, MAX_PAGE_SIZE);
  const offset = (page - 1) * pageSize;
  const search = sanitizeText(payload.search, 100);
  
  let whereClause = "status = 'published'";
  let searchParam = null;
  
  if (search) {
    whereClause += " AND (title LIKE ?1 OR content LIKE ?1 OR excerpt LIKE ?1)";
    searchParam = `%${search}%`;
  }

  // 根据是否有搜索参数，使用不同的查询
  let listResult, countResult;
  
  if (searchParam) {
    listResult = await db
      .prepare(`
        SELECT id, slug, title, excerpt, content, status, published_at, updated_at
        FROM posts
        WHERE ${whereClause}
        ORDER BY published_at DESC
        LIMIT ?2 OFFSET ?3
      `)
      .bind(searchParam, pageSize, offset)
      .all();

    countResult = await db
      .prepare(`SELECT COUNT(*) AS total FROM posts WHERE ${whereClause}`)
      .bind(searchParam)
      .first();
  } else {
    listResult = await db
      .prepare(`
        SELECT id, slug, title, excerpt, content, status, published_at, updated_at
        FROM posts
        WHERE status = 'published'
        ORDER BY published_at DESC
        LIMIT ?1 OFFSET ?2
      `)
      .bind(pageSize, offset)
      .all();

    countResult = await db
      .prepare(`SELECT COUNT(*) AS total FROM posts WHERE status = 'published'`)
      .first();
  }

  const posts = (listResult.results || []).map(mapPostRow);
  const total = Number((countResult && countResult.total) || 0);

  return { posts, total };
}

async function handleGetTags(payload, _request, env) {
  const db = getDb(env);
  
  // 简单实现：从文章内容中提取标签
  const result = await db
    .prepare(`
      SELECT tags FROM posts 
      WHERE status = 'published' AND tags != '[]'
    `)
    .all();
  
  const tagCount = {};
  (result.results || []).forEach(function(row) {
    try {
      const tags = JSON.parse(row.tags || "[]");
      tags.forEach(function(tag) {
        tagCount[tag] = (tagCount[tag] || 0) + 1;
      });
    } catch (e) {}
  });
  
  const tags = Object.entries(tagCount)
    .map(function(entry) {
      return { name: entry[0], count: entry[1] };
    })
    .sort(function(a, b) {
      return b.count - a.count;
    });
  
  return { tags };
}

async function handleGetPost(payload, _request, env) {
  const db = getDb(env);
  const identifier = firstNonEmpty(payload.id, payload.slug);
  assert(identifier, "缺少文章标识");

  const postRow = await db
    .prepare(`
      SELECT id, slug, title, excerpt, content, status, published_at, updated_at
      FROM posts
      WHERE status = 'published' AND (id = ?1 OR slug = ?1)
      LIMIT 1
    `)
    .bind(identifier)
    .first();

  if (!postRow) {
    return { post: null, comments: [] };
  }

  const post = mapPostRow(postRow);

  const commentsResult = await db
    .prepare(`
      SELECT
        c.id,
        c.post_id,
        c.parent_id,
        c.author,
        c.author_role,
        c.content,
        c.status,
        c.created_at,
        c.updated_at,
        p.slug AS post_slug,
        p.title AS post_title
      FROM comments c
      LEFT JOIN posts p ON p.id = c.post_id
      WHERE c.post_id = ?1 AND c.status = 'visible'
      ORDER BY c.created_at DESC
    `)
    .bind(post.id)
    .all();

  const comments = (commentsResult.results || []).map(mapCommentRow);
  return { post, comments };
}

async function handleCreateComment(payload, _request, env) {
  const db = getDb(env);

  const post = await getTargetPost(db, payload.postId, payload.slug);
  assert(post, "文章不存在或未发布", 404);

  const adminPayload = await verifyAdminOrNull(payload.token, env);
  const isAdmin = Boolean(adminPayload);

  const content = sanitizeText(payload.content, 600);
  assert(content, "内容不能为空");

  // ─── 垃圾评论过滤（管理员除外）──────────────────────────────────
  if (!isAdmin) {
    const spamPatterns = [
      /\b(微信|wechat|qq号|qq\s*\d|电话号码|手机号|联系我)\b/gi,
      /\b(兼职|刷单|日结|日赚|躺赚|投资回报)\b/gi,
      /\b(http|https|www\.)\S{30,}/gi,  // 超长 URL
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{5,}/g  // 邮箱地址
    ];

    for (const pattern of spamPatterns) {
      if (pattern.test(content)) {
        throw new ApiError("内容包含敏感信息，提交失败");
      }
    }
  }

  const author = isAdmin
    ? "忒卷"
    : sanitizeText(payload.author, 24);

  assert(author, "名字不能为空");

  const parentId = sanitizeText(payload.parentId, 80);
  if (parentId) {
    const parent = await db
      .prepare("SELECT id, post_id, status FROM comments WHERE id = ?1 LIMIT 1")
      .bind(parentId)
      .first();

    assert(parent && parent.status === "visible", "父评论不存在", 404);
    assert(parent.post_id === post.id, "父评论与文章不匹配");
  }

  const now = nowShanghaiIso();
  const id = crypto.randomUUID();

  // ─── 新评论默认待审核（pending），管理员除外 ────────────────────
  const status = isAdmin ? "visible" : "pending";

  await db
    .prepare(`
      INSERT INTO comments (
        id, post_id, parent_id, author, author_role, content, status, created_at, updated_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)
    `)
    .bind(id, post.id, parentId || null, author, isAdmin ? "author" : "visitor", content, status, now)
    .run();

  const message = isAdmin
    ? "留言已提交，已显示在下方。"
    : "留言已提交，待管理员审核后显示。";

  return {
    message,
    comment: {
      id,
      postId: post.id,
      postSlug: post.slug,
      postTitle: post.title,
      parentId: parentId || "",
      author,
      authorRole: isAdmin ? "author" : "visitor",
      isAuthor: isAdmin,
      content,
      status,
      createdAt: now,
      updatedAt: now
    }
  };
}

async function handleAdminLogin(payload, _request, env) {
  const password = sanitizeText(payload.password, 128);
  assert(password, "请输入后台口令");

  const configuredPassword = String(env.ADMIN_PASSWORD || "").trim();
  assert(configuredPassword, "未配置后台口令，请在 Cloudflare 环境变量中设置 ADMIN_PASSWORD", 500);
  assert(configuredPassword.length >= 12, "后台口令长度不能少于 12 位", 500);

  // 调试：返回实际密码长度和首尾字符（仅开发调试用，生产后删除）
  console.log("[DEBUG] Input password length:", password.length);
  console.log("[DEBUG] Configured password length:", configuredPassword.length);
  console.log("[DEBUG] Input password bytes:", [...password].map(c => c.charCodeAt(0)));
  console.log("[DEBUG] Config password bytes:", [...configuredPassword].map(c => c.charCodeAt(0)));
  console.log("[DEBUG] Passwords equal:", password === configuredPassword);

  assert(password === configuredPassword, "口令错误", 401);

  const ttlDays = normalizeInt(env.ADMIN_TOKEN_TTL_DAYS, 30, 1, 180);
  const expiresAt = Date.now() + ttlDays * 24 * 60 * 60 * 1000;

  const token = await signAdminToken(
    {
      role: "admin",
      exp: expiresAt,
      iat: Date.now()
    },
    getAdminSecret(env)
  );

  return { token, expiresAt: new Date(expiresAt).toISOString() };
}

async function handleAdminListPosts(payload, _request, env) {
  await requireAdmin(payload.token, env);
  const db = getDb(env);

  const result = await db
    .prepare(`
      SELECT id, slug, title, excerpt, content, status, published_at, updated_at
      FROM posts
      WHERE status != 'deleted'
      ORDER BY updated_at DESC
    `)
    .all();

  return { posts: (result.results || []).map(mapPostRow) };
}

async function handleAdminSavePost(payload, _request, env) {
  await requireAdmin(payload.token, env);
  const db = getDb(env);

  const incoming = payload.post;
  assert(incoming && typeof incoming === "object", "缺少文章数据");

  const title = sanitizeText(incoming.title, 180);
  const content = sanitizeText(incoming.content, 200000);
  assert(title && content, "标题和正文都要填");

  const postId = sanitizeText(incoming.id, 80) || crypto.randomUUID();
  const now = nowShanghaiIso();
  const initialSlug = sanitizeSlug(incoming.slug || buildSlug(title) || `post-${Date.now()}`);
  const slug = await ensureUniqueSlug(db, initialSlug, postId);
  const excerpt = sanitizeText(incoming.excerpt, 220) || excerptFromContent(content);

  const existing = await db
    .prepare("SELECT id, published_at FROM posts WHERE id = ?1 LIMIT 1")
    .bind(postId)
    .first();

  const publishedAt = sanitizeText(incoming.publishedAt, 40)
    || (existing && existing.published_at)
    || now;

  if (existing) {
    await db
      .prepare(`
        UPDATE posts
        SET slug = ?1, title = ?2, excerpt = ?3, content = ?4, status = 'published', published_at = ?5, updated_at = ?6
        WHERE id = ?7
      `)
      .bind(slug, title, excerpt, content, publishedAt, now, postId)
      .run();
  } else {
    await db
      .prepare(`
        INSERT INTO posts (id, slug, title, excerpt, content, status, published_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, 'published', ?6, ?7)
      `)
      .bind(postId, slug, title, excerpt, content, publishedAt, now)
      .run();
  }

  const row = await db
    .prepare(`
      SELECT id, slug, title, excerpt, content, status, published_at, updated_at
      FROM posts
      WHERE id = ?1
      LIMIT 1
    `)
    .bind(postId)
    .first();

  return { post: row ? mapPostRow(row) : null };
}

async function handleAdminDeletePost(payload, _request, env) {
  await requireAdmin(payload.token, env);
  const db = getDb(env);

  const postId = sanitizeText(payload.id, 80);
  assert(postId, "缺少文章 ID");

  const existing = await db
    .prepare("SELECT id FROM posts WHERE id = ?1 LIMIT 1")
    .bind(postId)
    .first();

  assert(existing, "文章不存在", 404);

  const now = nowShanghaiIso();
  await db.batch([
    db
      .prepare("UPDATE posts SET status = 'deleted', updated_at = ?2 WHERE id = ?1")
      .bind(postId, now),
    db
      .prepare("UPDATE comments SET status = 'deleted', updated_at = ?2 WHERE post_id = ?1")
      .bind(postId, now)
  ]);

  return { message: "文章已删除" };
}

async function handleAdminListComments(payload, _request, env) {
  await requireAdmin(payload.token, env);
  const db = getDb(env);

  const result = await db
    .prepare(`
      SELECT
        c.id,
        c.post_id,
        c.parent_id,
        c.author,
        c.author_role,
        c.content,
        c.status,
        c.created_at,
        c.updated_at,
        p.slug AS post_slug,
        p.title AS post_title
      FROM comments c
      LEFT JOIN posts p ON p.id = c.post_id
      WHERE c.status = 'visible'
      ORDER BY c.created_at DESC
    `)
    .all();

  return { comments: (result.results || []).map(mapCommentRow) };
}

async function handleAdminUpdateCommentStatus(payload, _request, env) {
  await requireAdmin(payload.token, env);
  const db = getDb(env);

  const id = sanitizeText(payload.id, 80);
  const status = sanitizeText(payload.status, 32);

  assert(id, "缺少评论 ID");
  assert(status, "缺少状态");

  const target = await db
    .prepare("SELECT id, post_id FROM comments WHERE id = ?1 LIMIT 1")
    .bind(id)
    .first();

  assert(target, "评论不存在", 404);

  const now = nowShanghaiIso();

  if (status !== "deleted") {
    await db
      .prepare("UPDATE comments SET status = ?2, updated_at = ?3 WHERE id = ?1")
      .bind(id, status, now)
      .run();

    return { updated: 1 };
  }

  const rows = await db
    .prepare("SELECT id, parent_id FROM comments WHERE post_id = ?1 AND status != 'deleted'")
    .bind(target.post_id)
    .all();

  const nodes = rows.results || [];
  const byParent = new Map();

  for (const row of nodes) {
    const parentId = row.parent_id || "";
    if (!byParent.has(parentId)) byParent.set(parentId, []);
    byParent.get(parentId).push(row.id);
  }

  const toDelete = new Set();
  const queue = [id];

  while (queue.length) {
    const current = queue.shift();
    if (toDelete.has(current)) continue;
    toDelete.add(current);

    const children = byParent.get(current) || [];
    for (const childId of children) queue.push(childId);
  }

  const statements = [];
  for (const commentId of toDelete) {
    statements.push(
      db
        .prepare("UPDATE comments SET status = 'deleted', updated_at = ?2 WHERE id = ?1")
        .bind(commentId, now)
    );
  }

  if (statements.length) {
    await db.batch(statements);
  }

  return { updated: statements.length };
}

async function handleAdminUploadImage(payload, request, env) {
  await requireAdmin(payload.token, env);

  assert(env.UPLOADS_BUCKET, "未绑定 R2 存储桶 UPLOADS_BUCKET", 500);

  const base64 = String(payload.base64 || "").replace(/\s+/g, "");
  assert(base64, "缺少图片数据");
  assert(base64.length <= 30 * 1024 * 1024, "图片不能超过 20MB");

  const mimeType = normalizeMimeType(payload.mimeType);
  const extension = normalizeExtension(payload.filename, mimeType);
  assert(extension, "仅支持 JPG/PNG/WebP/GIF/SVG/AVIF 格式");

  let bytes;
  try {
    bytes = decodeBase64ToBytes(base64);
  } catch {
    throw new ApiError("图片编码无效");
  }

  assert(bytes.byteLength > 0, "图片内容为空");
  assert(bytes.byteLength <= MAX_UPLOAD_BYTES, "图片不能超过 20MB");

  // ─── Magic Number 验证（防扩展名伪造）────────────────────────────
  if (!validateMagicNumber(bytes, extension)) {
    throw new ApiError("图片内容与文件格式不匹配");
  }

  // ─── SVG 安全检查（防止 XSS）────────────────────────────────────
  if (extension === "svg") {
    const text = new TextDecoder("utf-8", { fatal: false })
      .decode(bytes.slice(0, 8192));
    // 禁止 SVG 中的脚本和外部引用
    if (/script|xlink:href|on\w+=|data:image|import\s/i.test(text)) {
      throw new ApiError("SVG 文件包含危险内容，禁止上传");
    }
  }

  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const randomPart = crypto.randomUUID().slice(0, 8);
  const key = `images/${year}/${month}/${Date.now()}-${randomPart}.${extension}`;

  await env.UPLOADS_BUCKET.put(key, bytes, {
    httpMetadata: {
      contentType: mimeType || guessMimeByExt(extension)
    }
  });

  return {
    url: buildUploadUrl(request, env, key),
    key
  };
}

async function handleSeedSamplePosts(payload, _request, env) {
  await requireAdmin(payload.token, env);
  const db = getDb(env);

  let inserted = 0;

  for (const sample of SAMPLE_POSTS) {
    const baseSlug = sanitizeSlug(sample.slug || buildSlug(sample.title));
    const slug = await ensureUniqueSlug(db, baseSlug || `sample-${Date.now()}`, "");

    const existingByTitle = await db
      .prepare("SELECT id FROM posts WHERE title = ?1 AND status != 'deleted' LIMIT 1")
      .bind(sample.title)
      .first();

    if (existingByTitle) {
      continue;
    }

    const now = nowShanghaiIso();
    await db
      .prepare(`
        INSERT INTO posts (id, slug, title, excerpt, content, status, published_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, 'published', ?6, ?7)
      `)
      .bind(
        crypto.randomUUID(),
        slug,
        sample.title,
        sample.excerpt || excerptFromContent(sample.content),
        sample.content,
        now,
        now
      )
      .run();

    inserted += 1;
  }

  return {
    inserted,
    message: inserted ? "示例文章已导入" : "示例文章已存在"
  };
}

async function handleGetRss(request, env) {
  const db = getDb(env);

  const result = await db
    .prepare(`
      SELECT id, slug, title, excerpt, content, status, published_at, updated_at
      FROM posts
      WHERE status = 'published'
      ORDER BY published_at DESC
      LIMIT 50
    `)
    .all();

  const posts = (result.results || []).map(mapPostRow);
  const siteTitle = String(env.SITE_TITLE || "忒卷");
  const baseUrl = getSiteBaseUrl(request, env);
  const channelLink = `${baseUrl}/`;

  const itemsXml = posts
    .map((post) => {
      const postLink = `${baseUrl}/post.html?id=${encodeURIComponent(post.id)}`;
      return [
        "<item>",
        `<title>${escapeXml(post.title)}</title>`,
        `<link>${escapeXml(postLink)}</link>`,
        `<guid isPermaLink=\"false\">${escapeXml(post.id)}</guid>`,
        `<pubDate>${escapeXml(toRfc2822(post.publishedAt))}</pubDate>`,
        `<description>${escapeXml(post.excerpt || "")}</description>`,
        "</item>"
      ].join("");
    })
    .join("");

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    "<channel>",
    `<title>${escapeXml(siteTitle)}</title>`,
    `<link>${escapeXml(channelLink)}</link>`,
    `<description>${escapeXml(siteTitle)} 的 RSS 订阅</description>`,
    `<lastBuildDate>${escapeXml(new Date().toUTCString())}</lastBuildDate>`,
    itemsXml,
    "</channel>",
    "</rss>"
  ].join("");

  return new Response(xml, {
    status: 200,
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "public, max-age=300",
      ...buildCorsHeaders(request.headers.get("origin") || "")
    }
  });
}

async function handleUploads(request, env, pathname) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!env.UPLOADS_BUCKET) {
    return new Response("Not Found", { status: 404 });
  }

  const key = decodeURIComponent(pathname.replace(/^\/uploads\//, "")).trim();
  if (!key) {
    return new Response("Not Found", { status: 404 });
  }

  const object = await env.UPLOADS_BUCKET.get(key);
  if (!object) {
    return new Response("Not Found", { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");

  if (!headers.get("content-type")) {
    headers.set("content-type", guessMimeByExt(getExtensionFromPath(key)));
  }

  if (request.method === "HEAD") {
    return new Response(null, { headers, status: 200 });
  }

  return new Response(object.body, { headers, status: 200 });
}

async function getTargetPost(db, postId, slug) {
  const byId = sanitizeText(postId, 80);
  const bySlug = sanitizeText(slug, 180);

  if (byId) {
    const row = await db
      .prepare(`
        SELECT id, slug, title, excerpt, content, status, published_at, updated_at
        FROM posts
        WHERE status = 'published' AND id = ?1
        LIMIT 1
      `)
      .bind(byId)
      .first();

    if (row) return mapPostRow(row);
  }

  if (bySlug) {
    const row = await db
      .prepare(`
        SELECT id, slug, title, excerpt, content, status, published_at, updated_at
        FROM posts
        WHERE status = 'published' AND slug = ?1
        LIMIT 1
      `)
      .bind(bySlug)
      .first();

    if (row) return mapPostRow(row);
  }

  return null;
}

async function ensureUniqueSlug(db, rawSlug, currentPostId) {
  const base = sanitizeSlug(rawSlug || "") || `post-${Date.now()}`;
  let candidate = base;

  let index = 1;
  while (true) {
    const exists = await db
      .prepare("SELECT id FROM posts WHERE slug = ?1 AND id != ?2 LIMIT 1")
      .bind(candidate, currentPostId || "")
      .first();

    if (!exists) return candidate;

    index += 1;
    candidate = `${base}-${index}`;
  }
}

function getDb(env) {
  assert(env.DB, "未绑定 D1 数据库（DB）", 500);
  return env.DB;
}

function buildSlug(title) {
  return String(title || "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[/?#%]/g, "");
}

function sanitizeSlug(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[/?#%]/g, "")
    .slice(0, 180);
}

function excerptFromContent(content) {
  const plain = String(content || "")
    .replace(/^>\s?/gm, "")
    .replace(/\s+/g, " ")
    .trim();

  const maxLength = 90;
  if (plain.length <= maxLength) return plain;

  let sentenceEnd = -1;
  const punctuation = ["。", "！", "？", ".", "!", "?"];
  for (const mark of punctuation) {
    const index = plain.lastIndexOf(mark, maxLength);
    if (index > sentenceEnd) sentenceEnd = index;
  }

  if (sentenceEnd >= 24) {
    return plain.slice(0, sentenceEnd + 1).trim();
  }

  return plain.slice(0, maxLength).trim();
}

function mapPostRow(row) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt || "",
    content: row.content || "",
    status: row.status || "published",
    publishedAt: row.published_at,
    updatedAt: row.updated_at
  };
}

function mapCommentRow(row) {
  const role = row.author_role || "visitor";
  return {
    id: row.id,
    postId: row.post_id,
    postSlug: row.post_slug || "",
    postTitle: row.post_title || "",
    parentId: row.parent_id || "",
    author: row.author || "匿名",
    authorRole: role,
    isAuthor: role === "author",
    content: row.content || "",
    status: row.status || "visible",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function nowShanghaiIso(date = new Date()) {
  const shanghai = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return `${shanghai.toISOString().slice(0, 19)}+08:00`;
}

function toRfc2822(value) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) {
    return new Date().toUTCString();
  }
  return date.toUTCString();
}

function normalizeInt(value, defaultValue, min, max) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (Number.isNaN(parsed)) return defaultValue;
  return Math.min(max, Math.max(min, parsed));
}

function sanitizeText(value, maxLength = 1000) {
  return String(value || "")
    .trim()
    .slice(0, maxLength);
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const text = sanitizeText(value, 300);
    if (text) return text;
  }
  return "";
}

function json(payload, status = 200) {
  // 确保是 Headers 实例（.set() 方法需要）
  const headers = new Headers(buildCorsHeaders(_currentOrigin));
  headers.set("content-type", "application/json; charset=utf-8");
  // 注入速率限制信息到响应头
  if (_rateLimitInfo && !_rateLimitInfo.skipped) {
    addRateLimitHeaders(headers, _rateLimitInfo);
  }
  // 重置，避免影响下一次请求
  _rateLimitInfo = null;
  return new Response(JSON.stringify(payload), { status, headers });
}

function assert(condition, message, status = 400) {
  if (!condition) {
    throw new ApiError(message, status);
  }
}

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function getSiteBaseUrl(request, env) {
  const custom = String(env.SITE_URL || "").trim();
  if (custom) return custom.replace(/\/+$/, "");

  const forwarded = getForwardedSiteOrigin(request);
  if (forwarded) return forwarded;

  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

function getAdminSecret(env) {
  const secret = String(env.ADMIN_SECRET || env.ADMIN_PASSWORD || "").trim();
  assert(secret, "请先配置 ADMIN_SECRET 或 ADMIN_PASSWORD", 500);
  return secret;
}

async function requireAdmin(token, env) {
  const payload = await verifyAdminOrNull(token, env);
  assert(payload, "登录已失效，请重新输入口令。", 401);
  return payload;
}

async function verifyAdminOrNull(token, env) {
  const value = String(token || "").trim();
  if (!value) return null;

  const secret = getAdminSecret(env);
  const payload = await verifyAdminToken(value, secret);
  if (!payload) return null;
  return payload;
}

async function signAdminToken(payload, secret) {
  const encodedPayload = encodeBase64UrlText(JSON.stringify(payload));
  const signature = await signHmac(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

async function verifyAdminToken(token, secret) {
  const parts = String(token || "").split(".");
  if (parts.length !== 2) return null;

  const [encodedPayload, signature] = parts;
  if (!encodedPayload || !signature) return null;

  const expected = await signHmac(encodedPayload, secret);
  if (!timingSafeEqual(signature, expected)) return null;

  let payload;
  try {
    payload = JSON.parse(decodeBase64UrlText(encodedPayload));
  } catch {
    return null;
  }

  if (!payload || payload.role !== "admin") return null;
  if (typeof payload.exp !== "number" || Date.now() > payload.exp) return null;

  return payload;
}

async function signHmac(input, secret) {
  const key = await getHmacKey(secret);
  const data = new TextEncoder().encode(input);
  const signature = await crypto.subtle.sign("HMAC", key, data);
  return encodeBase64UrlBytes(new Uint8Array(signature));
}

async function getHmacKey(secret) {
  if (hmacKeyCache.has(secret)) {
    return hmacKeyCache.get(secret);
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  hmacKeyCache.set(secret, key);
  return key;
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let mismatch = 0;

  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return mismatch === 0;
}

function encodeBase64UrlText(value) {
  return encodeBase64UrlBytes(new TextEncoder().encode(value));
}

function decodeBase64UrlText(value) {
  const bytes = decodeBase64UrlToBytes(value);
  return new TextDecoder().decode(bytes);
}

function encodeBase64UrlBytes(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeBase64UrlToBytes(value) {
  const normalized = String(value || "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const pad = normalized.length % 4 ? "=".repeat(4 - (normalized.length % 4)) : "";
  const binary = atob(normalized + pad);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function decodeBase64ToBytes(base64) {
  const compact = String(base64 || "").replace(/\s+/g, "");
  const binary = atob(compact);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function normalizeMimeType(mimeType) {
  const value = String(mimeType || "").trim().toLowerCase();
  if (!value) return "";
  return MIME_TO_EXT[value] ? value : "";
}

function normalizeExtension(filename, mimeType) {
  if (mimeType && MIME_TO_EXT[mimeType]) {
    return MIME_TO_EXT[mimeType];
  }

  const ext = getExtensionFromPath(filename || "");
  if (ext === "jpeg") return "jpg";

  return ["jpg", "png", "webp", "gif", "svg", "avif"].includes(ext) ? ext : "";
}

function getExtensionFromPath(pathLike) {
  const value = String(pathLike || "");
  const index = value.lastIndexOf(".");
  if (index < 0) return "";
  return value.slice(index + 1).trim().toLowerCase();
}

function guessMimeByExt(ext) {
  const value = String(ext || "").toLowerCase();
  if (value === "jpg" || value === "jpeg") return "image/jpeg";
  if (value === "png") return "image/png";
  if (value === "webp") return "image/webp";
  if (value === "gif") return "image/gif";
  if (value === "svg") return "image/svg+xml";
  if (value === "avif") return "image/avif";
  return "application/octet-stream";
}

function buildUploadUrl(request, env, key) {
  const customBase = String(env.R2_PUBLIC_URL || "").trim();
  if (customBase) {
    return `${customBase.replace(/\/+$/, "")}/${key}`;
  }

  const forwarded = getForwardedSiteOrigin(request);
  if (forwarded) {
    return `${forwarded}/uploads/${key}`;
  }

  const baseUrl = getSiteBaseUrl(request, env);
  return `${baseUrl}/uploads/${key}`;
}

function getForwardedSiteOrigin(request) {
  const raw = String(request.headers.get("x-site-origin") || "").trim();
  if (!raw) return "";

  try {
    const parsed = new URL(raw);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return "";
  }
}

