// Pages Function: 代理 /blogApi 请求到 Cloudflare Worker
// 解决跨域和 API 统一入口问题

const WORKER_ORIGIN = "https://blog.teloei35.workers.dev";

// 严格 CORS 白名单
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://blog.03518888.xyz",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};

function buildCorsResponse(status = 204, body = null) {
  return new Response(body, { status, headers: CORS_HEADERS });
}

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  // ─── OPTIONS 预检请求 ───────────────────────────────────────
  if (request.method === "OPTIONS") {
    return buildCorsResponse();
  }

  // ─── 构造转发请求 ───────────────────────────────────────────
  const upstreamPath = url.pathname + url.search;
  const upstreamUrl = WORKER_ORIGIN + upstreamPath;

  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  headers.set("x-site-origin", `${url.protocol}//${url.host}`);

  // ─── 转发请求体（仅 POST）───────────────────────────────────
  let upstreamInit = {
    method: request.method,
    headers,
    redirect: "follow"
  };

  if (request.method === "POST") {
    try {
      const bodyText = await request.text();
      upstreamInit.body = bodyText;
    } catch {
      return new Response(JSON.stringify({ ok: false, message: "读取请求体失败" }), {
        status: 400,
        headers: { "Content-Type": "application/json; charset=utf-8", ...CORS_HEADERS }
      });
    }
  }

  // ─── 调用 Worker ───────────────────────────────────────────
  let upstreamResponse;
  try {
    upstreamResponse = await fetch(upstreamUrl, upstreamInit);
  } catch (err) {
    return new Response(JSON.stringify({
      ok: false,
      message: "API 服务暂时不可用，请稍后重试。"
    }), {
      status: 502,
      headers: { "Content-Type": "application/json; charset=utf-8", ...CORS_HEADERS }
    });
  }

  // ─── 提取响应体（克隆方式避免 body consumed 错误）───────────
  let responseBody;
  try {
    responseBody = await upstreamResponse.text();
  } catch {
    responseBody = "";
  }

  // ─── 重建响应头（确保 CORS）──────────────────────────────────
  const responseHeaders = new Headers();
  responseHeaders.set("Content-Type", "application/json; charset=utf-8");
  responseHeaders.set("Cache-Control", "no-store");

  // 透传关键头部
  const passHeaders = ["x-rateLimit-limit", "x-rateLimit-remaining", "x-rateLimit-window", "retry-after"];
  passHeaders.forEach(name => {
    const val = upstreamResponse.headers.get(name);
    if (val) responseHeaders.set(name, val);
  });

  // CORS（Worker 返回的 Allow-Origin 被覆盖）
  Object.entries(CORS_HEADERS).forEach(([k, v]) => responseHeaders.set(k, v));

  return new Response(responseBody, {
    status: upstreamResponse.status,
    headers: responseHeaders
  });
}
