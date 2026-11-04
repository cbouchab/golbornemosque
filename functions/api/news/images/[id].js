/*
 * Golborne Mosque — a News photo. Each upload gets a new random id, so a
 * photo at a given address never changes and browsers may keep it for a year.
 *
 *   GET /api/news/images/<id>
 */

import { toBytes } from "../../../../lib/news-server.js";

const notFound = () => new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });

export async function onRequestGet({ request, env, params, waitUntil }) {
  if (!/^[0-9a-f]{32}$/.test(params.id) || !env.DB) return notFound();

  const cache = caches.default;
  const hit = await cache.match(request);
  if (hit) return hit;

  const row = await env.DB.prepare("SELECT type, data FROM images WHERE id = ?").bind(params.id).first();
  if (!row) return notFound();

  const response = new Response(toBytes(row.data), {
    headers: {
      "content-type": row.type,
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
  waitUntil(cache.put(request, response.clone()));
  return response;
}
