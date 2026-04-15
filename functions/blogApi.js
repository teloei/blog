const WORKER_ORIGIN = "https://blog.teloei35.workers.dev";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};

export async function onRequest(context) {
  const request = context.request;
  const url = new URL(request.url);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const upstreamUrl = `${WORKER_ORIGIN}${url.pathname}${url.search}`;

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.set("x-site-origin", `${url.protocol}//${url.host}`);

  const init = {
    method: request.method,
    headers,
    redirect: "follow"
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
  }

  try {
    const upstreamResponse = await fetch(upstreamUrl, init);
    const responseHeaders = new Headers(upstreamResponse.headers);

    Object.keys(CORS_HEADERS).forEach((key) => {
      responseHeaders.set(key, CORS_HEADERS[key]);
    });

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: responseHeaders
    });
  } catch (error) {
    return new Response(JSON.stringify({
      ok: false,
      message: "API 网关无法连接 Worker，请稍后重试。"
    }), {
      status: 502,
      headers: {
        "content-type": "application/json; charset=utf-8",
        ...CORS_HEADERS
      }
    });
  }
}
