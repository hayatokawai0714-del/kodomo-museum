const FAMILY_CODE_HEADER = "X-Family-Code";
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

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

function getExtension(contentType) {
  if (contentType === "image/jpeg") return "jpg";
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  return "";
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!isAuthorized(request, env)) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const contentType = request.headers.get("Content-Type") || "";
  const extension = getExtension(contentType);
  if (!extension) {
    return jsonResponse({ error: "Unsupported image type" }, 400);
  }

  const body = await request.arrayBuffer();
  if (!body.byteLength || body.byteLength > MAX_UPLOAD_BYTES) {
    return jsonResponse({ error: "Invalid upload size" }, 400);
  }

  const imageKey = `artworks/${crypto.randomUUID()}.${extension}`;

  // ARTWORK_BUCKET is an R2 binding. Keep real bucket names in Cloudflare settings.
  await env.ARTWORK_BUCKET.put(imageKey, body, {
    httpMetadata: { contentType },
  });

  return jsonResponse({ image_key: imageKey }, 201);
}

export async function onRequest(context) {
  if (context.request.method === "POST") return onRequestPost(context);
  return jsonResponse({ error: "Method not allowed" }, 405);
}
