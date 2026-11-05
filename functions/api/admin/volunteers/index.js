/*
 * Golborne Mosque — volunteer sign-ups, newest first, for the posting page.
 * (Signed-in only: see ../_middleware.js.)
 *
 *   GET /api/admin/volunteers → { volunteers: [{ id, firstName, lastName, email, phone, interests, createdAt }] }
 */

import { json } from "../../../../lib/news-server.js";

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    "SELECT id, first_name, last_name, email, phone, interests, created_at FROM volunteers ORDER BY created_at DESC, id DESC"
  ).all();
  return json({
    volunteers: results.map((r) => ({
      id: r.id,
      firstName: r.first_name,
      lastName: r.last_name,
      email: r.email,
      phone: r.phone,
      interests: r.interests,
      createdAt: r.created_at,
    })),
  });
}
