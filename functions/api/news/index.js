/*
 * Golborne Mosque — published News posts, newest first, for the News page
 * and the home page.
 *
 *   GET /api/news?limit=12&offset=0 → { posts: [{ slug, title, date, excerpt, image }], more }
 */

import { json, card, CARD_COLUMNS } from "../../../lib/news-server.js";

const int = (value, fallback) => {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
};

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ posts: [], more: false });
  const url = new URL(request.url);
  const limit = Math.min(Math.max(int(url.searchParams.get("limit"), 12), 1), 24);
  const offset = Math.min(Math.max(int(url.searchParams.get("offset"), 0), 0), 100000);

  try {
    const { results } = await env.DB.prepare(
      `SELECT ${CARD_COLUMNS} FROM posts p LEFT JOIN images i ON i.id = p.image_id
       WHERE p.published = 1 ORDER BY p.published_on DESC, p.id DESC LIMIT ? OFFSET ?`
    )
      .bind(limit + 1, offset)
      .all();
    return json({ posts: results.slice(0, limit).map(card), more: results.length > limit }, 200, { "cache-control": "no-cache" });
  } catch (e) {
    console.error("news list:", e);
    return json({ posts: [], more: false, error: "unavailable" }, 503);
  }
}
