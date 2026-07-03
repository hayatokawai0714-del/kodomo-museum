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

function requireAuth(request, env) {
  if (isAuthorized(request, env)) return null;
  return jsonResponse({ error: "Unauthorized" }, 401);
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function normalizeArtwork(input = {}) {
  const now = new Date().toISOString();
  return {
    id: input.id || crypto.randomUUID(),
    title: String(input.title || "").trim(),
    image_key: input.image_key || null,
    child_name: input.child_name || null,
    age: input.age || null,
    created_date: input.created_date || null,
    memo: input.memo || null,
    child_comment: input.child_comment || null,
    tags_json: Array.isArray(input.tags) ? JSON.stringify(input.tags) : input.tags_json || "[]",
    favorite: input.favorite ? 1 : 0,
    created_at: input.created_at || now,
    updated_at: now,
  };
}

async function handleGet(env) {
  const result = await env.DB.prepare(
    "SELECT id, title, image_key, child_name, age, created_date, memo, child_comment, tags_json, favorite, created_at, updated_at FROM artworks ORDER BY created_at DESC"
  ).all();

  return jsonResponse({ artworks: result.results || [] });
}

async function handlePost(request, env) {
  const input = await readJson(request);
  if (!input) return jsonResponse({ error: "Invalid JSON" }, 400);

  const artwork = normalizeArtwork(input);
  if (!artwork.title) return jsonResponse({ error: "Title is required" }, 400);

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

  return jsonResponse({ artwork }, 201);
}

async function handlePut(request, env) {
  const input = await readJson(request);
  if (!input || !input.id) return jsonResponse({ error: "Artwork id is required" }, 400);

  const artwork = normalizeArtwork(input);
  artwork.id = input.id;

  await env.DB.prepare(
    "UPDATE artworks SET title = ?, image_key = ?, child_name = ?, age = ?, created_date = ?, memo = ?, child_comment = ?, tags_json = ?, favorite = ?, updated_at = ? WHERE id = ?"
  )
    .bind(
      artwork.title,
      artwork.image_key,
      artwork.child_name,
      artwork.age,
      artwork.created_date,
      artwork.memo,
      artwork.child_comment,
      artwork.tags_json,
      artwork.favorite,
      artwork.updated_at,
      artwork.id
    )
    .run();

  return jsonResponse({ artwork });
}

async function handleDelete(request, env) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return jsonResponse({ error: "Artwork id is required" }, 400);

  await env.DB.prepare("DELETE FROM artworks WHERE id = ?").bind(id).run();
  return jsonResponse({ ok: true });
}

export async function onRequest(context) {
  const authResponse = requireAuth(context.request, context.env);
  if (authResponse) return authResponse;

  const { request, env } = context;

  if (request.method === "GET") return handleGet(env);
  if (request.method === "POST") return handlePost(request, env);
  if (request.method === "PUT") return handlePut(request, env);
  if (request.method === "DELETE") return handleDelete(request, env);

  return jsonResponse({ error: "Method not allowed" }, 405);
}
