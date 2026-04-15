const WORKER_ORIGIN = "https://blog.teloei35.workers.dev";

export async function onRequest(context) {
  const request = context.request;
  const url = new URL(request.url);
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
    return await fetch(upstreamUrl, init);
  } catch (error) {
    return new Response("Upload proxy error", { status: 502 });
  }
}
