const FAMILY_CODE_HEADER = "X-Family-Code";
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const JPEG_DATA_URL_PREFIX = "data:image/jpeg;base64,";

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

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function decodeBase64Image(imageData) {
  if (typeof imageData !== "string" || !imageData.startsWith(JPEG_DATA_URL_PREFIX)) {
    return null;
  }

  try {
    const binary = atob(imageData.slice(JPEG_DATA_URL_PREFIX.length));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    return null;
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!isAuthorized(request, env)) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  }

  if (!env.ARTWORK_BUCKET) {
    return jsonResponse({ ok: false, error: "Storage is not configured" }, 500);
  }

  const input = await readJson(request);
  if (!input) {
    return jsonResponse({ ok: false, error: "Invalid JSON" }, 400);
  }

  const bytes = decodeBase64Image(input.imageData);
  if (!bytes || !bytes.byteLength || bytes.byteLength > MAX_UPLOAD_BYTES) {
    return jsonResponse({ ok: false, error: "Invalid image data" }, 400);
  }

  const imageKey = `artworks/${crypto.randomUUID()}.jpg`;

  await env.ARTWORK_BUCKET.put(imageKey, bytes, {
    httpMetadata: { contentType: "image/jpeg" },
    customMetadata: {
      originalFileName: String(input.fileName || "").slice(0, 120),
    },
  });

  return jsonResponse({ ok: true, imageKey }, 201);
}

export async function onRequest(context) {
  if (context.request.method === "POST") return onRequestPost(context);
  return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
}
