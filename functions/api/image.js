const FAMILY_CODE_HEADER = "X-Family-Code";
const ALLOWED_KEY_PREFIX = "artworks/";

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

function getImageKey(request) {
  const url = new URL(request.url);
  return url.searchParams.get("key") || "";
}

function isAllowedImageKey(key) {
  return key.startsWith(ALLOWED_KEY_PREFIX) && !key.includes("..") && !key.includes("\\");
}

async function handleGet(request, env) {
  if (!isAuthorized(request, env)) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  }

  if (!env.ARTWORK_BUCKET) {
    return jsonResponse({ ok: false, error: "Storage is not configured" }, 500);
  }

  const key = getImageKey(request);
  if (!key) {
    return jsonResponse({ ok: false, error: "Image key is required" }, 400);
  }

  if (!isAllowedImageKey(key)) {
    return jsonResponse({ ok: false, error: "Invalid image key" }, 400);
  }

  const object = await env.ARTWORK_BUCKET.get(key);
  if (!object) {
    return jsonResponse({ ok: false, error: "Image not found" }, 404);
  }

  return new Response(object.body, {
    status: 200,
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, max-age=3600",
    },
  });
}

export async function onRequest(context) {
  if (context.request.method === "GET") return handleGet(context.request, context.env);
  return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
}
