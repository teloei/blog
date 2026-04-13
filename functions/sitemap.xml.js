const WORKER_ORIGIN = "https://blog.teloei35.workers.dev";

export async function onRequest(context) {
  const request = context.request;
  const url = new URL(request.url);
  const upstreamUrl = `${WORKER_ORIGIN}/blogApi?action=getSitemap`;

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.set("x-site-origin", `${url.protocol}//${url.host}`);

  try {
    const response = await fetch(upstreamUrl, {
      method: "GET",
      headers,
      redirect: "follow"
    });

    const outHeaders = new Headers(response.headers);
    outHeaders.set("content-type", "application/xml; charset=utf-8");
    outHeaders.set("cache-control", "public, max-age=600");

    return new Response(response.body, {
      status: response.status,
      headers: outHeaders
    });
  } catch (error) {
    return new Response("<?xml version=\"1.0\" encoding=\"UTF-8\"?><urlset></urlset>", {
      status: 502,
      headers: {
        "content-type": "application/xml; charset=utf-8"
      }
    });
  }
}
