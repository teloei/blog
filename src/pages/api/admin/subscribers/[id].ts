import type { APIRoute } from "astro";
import { authenticateRequest } from "../../../../lib/auth";

export const prerender = false;

export const DELETE: APIRoute = async ({ request, params, locals }) => {
  const user = await authenticateRequest(request, locals.runtime.env as any);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const id = params.id;
  if (!id) return json({ error: "Missing id" }, 400);

  await locals.runtime.env.DB.prepare("DELETE FROM newsletter WHERE id = ?").bind(id).run();
  return json({ success: true });
};

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
