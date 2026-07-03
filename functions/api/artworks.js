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

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function stringOrNull(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text || null;
}

function normalizeTagsJson(input) {
  if (typeof input.tags_json === "string") return input.tags_json;
  if (Array.isArray(input.tags)) return JSON.stringify(input.tags);
  return "[]";
}

function normalizeFavorite(value) {
  return value === true || value === 1 || value === "1" || value === "true" ? 1 : 0;
}

function normalizeArtwork(input = {}) {
  const now = new Date().toISOString();
  return {
    id: stringOrNull(input.id) || crypto.randomUUID(),
    title: stringOrNull(input.title),
    image_key: stringOrNull(input.image_key || input.imageKey),
    child_name: stringOrNull(input.child_name || input.childName || input.artist),
    age: stringOrNull(input.age),
    created_date: stringOrNull(input.created_date || input.createdDate || input.date),
    memo: stringOrNull(input.memo || input.comment),
    child_comment: stringOrNull(input.child_comment || input.childComment || input.story),
    tags_json: normalizeTagsJson(input),
    favorite: normalizeFavorite(input.favorite),
    created_at: stringOrNull(input.created_at) || now,
    updated_at: now,
  };
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

async function handlePost(request, env) {
  if (!env.DB) {
    return jsonResponse({ ok: false, error: "Database is not configured" }, 500);
  }

  const input = await readJson(request);
  if (!input) {
    return jsonResponse({ ok: false, error: "Invalid JSON" }, 400);
  }

  const artwork = normalizeArtwork(input);
  if (!artwork.title) {
    return jsonResponse({ ok: false, error: "Title is required" }, 400);
  }

  await env.DB.prepare(
    "INSERT INTO artworks (id, title, image_key, child_name, age, created_date, memo, child_comment, tags_json, favorite, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(
      artwork.id,
      artwork.title,
      artwork.image_key,
      artwork.child_name,
      artwork.age,
      artwork.created_date,
      artwork.memo,
      artwork.child_comment,
      artwork.tags_json,
      artwork.favorite,
      artwork.created_at,
      artwork.updated_at
    )
    .run();

  return jsonResponse({ ok: true, artwork }, 201);
}

function getArtworkId(request) {
  const url = new URL(request.url);
  return stringOrNull(url.searchParams.get("id"));
}

function isAllowedImageKey(key) {
  return typeof key === "string" && key.startsWith("artworks/") && !key.includes("..") && !key.includes("\\");
}

async function deleteArtworkImage(env, imageKey) {
  if (!isAllowedImageKey(imageKey) || !env.ARTWORK_BUCKET) return;

  try {
    await env.ARTWORK_BUCKET.delete(imageKey);
  } catch {
    // Continue deleting the D1 record; do not expose storage internals to the client.
  }
}

async function handleDelete(request, env) {
  if (!env.DB) {
    return jsonResponse({ ok: false, error: "Database is not configured" }, 500);
  }

  const id = getArtworkId(request);
  if (!id) {
    return jsonResponse({ ok: false, error: "Artwork id is required" }, 400);
  }

  const artwork = await env.DB.prepare("SELECT id, image_key FROM artworks WHERE id = ?").bind(id).first();
  if (!artwork) {
    return jsonResponse({ ok: false, error: "Artwork not found" }, 404);
  }

  await deleteArtworkImage(env, artwork.image_key || artwork.imageKey);
  await env.DB.prepare("DELETE FROM artworks WHERE id = ?").bind(id).run();

  return jsonResponse({ ok: true, deletedId: id });
}

export async function onRequest(context) {
  const { request, env } = context;

  if (!isAuthorized(request, env)) {
    return unauthorizedResponse();
  }

  if (request.method === "GET") return handleGet(env);
  if (request.method === "POST") return handlePost(request, env);
  if (request.method === "DELETE") return handleDelete(request, env);
  if (request.method === "PUT") return notImplementedResponse();

  return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
}
