/*
 * Golborne Mosque — removes a volunteer sign-up once it has been dealt with.
 * (Signed-in only: see ../_middleware.js.)
 *
 *   DELETE /api/admin/volunteers/<id> → { ok }
 */

import { json } from "../../../../lib/news-server.js";

export async function onRequestDelete({ env, params }) {
  if (!/^\d+$/.test(params.id)) return json({ error: "not-found" }, 404);
  const { meta } = await env.DB.prepare("DELETE FROM volunteers WHERE id = ?").bind(Number(params.id)).run();
  if (!meta || !meta.changes) return json({ error: "not-found" }, 404);
  return json({ ok: true });
}
