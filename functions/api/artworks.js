const FAMILY_CODE_HEADER = "X-Family-Code";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function isAuthorized(request, env) {
  const expectedCode = env.FAMILY_ACCESS_CODE;
  const providedCode = request.headers.get(FAMILY_CODE_HEADER);
  return Boolean(expectedCode && providedCode && providedCode === expectedCode);
}

function unauthorizedResponse() {
  return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
}

function notImplementedResponse() {
  return jsonResponse({ ok: false, error: "Not implemented" }, 501);
}

async function handleGet(env) {
  if (!env.DB) {
    return jsonResponse({ ok: false, error: "Database is not configured" }, 500);
  }

  const result = await env.DB.prepare(
    "SELECT id, title, image_key, child_name, age, created_date, memo, child_comment, tags_json, favorite, created_at, updated_at FROM artworks ORDER BY created_at DESC"
  ).all();

  return jsonResponse({ ok: true, artworks: result.results || [] });
}

export async function onRequest(context) {
  const { request, env } = context;

  if (!isAuthorized(request, env)) {
    return unauthorizedResponse();
  }

  if (request.method === "GET") return handleGet(env);
  if (["POST", "PUT", "DELETE"].includes(request.method)) return notImplementedResponse();

  return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
}
