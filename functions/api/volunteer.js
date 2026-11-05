/*
 * Golborne Mosque — volunteer sign-ups from the Volunteer page.
 *
 *   POST /api/volunteer { firstName, lastName, email, phone, interests } → { ok }
 *
 * Each sign-up is saved in the News database (D1) and listed on the private
 * /admin page. Emailing them to info@ can be added once that mailbox exists.
 *
 * Kept simple for people, awkward for spam: the request must come from this
 * website; a hidden field that only bots fill in, or a form sent within two
 * seconds of opening, is quietly dropped; and one connection can send at most
 * five sign-ups an hour.
 */

import { json, sameOrigin, clientIp } from "../../lib/news-server.js";

const HOUR = 3600000;
const MAX_PER_HOUR = 5;
const EMAIL = /^[^\s@<>()]+@[^\s@<>()]+\.[^\s@<>()]{2,}$/;
const PHONE = /^[0-9+()\-.\s]{6,30}$/;

const clean = (value, max) =>
  String(value == null ? "" : value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, max);

async function hashIp(ip) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`golborne-volunteer:${ip}`));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
  if (!env.DB) return json({ error: "unavailable" }, 503);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "bad-request" }, 400);
  }

  // Bots: answer as if all went well, so they learn nothing, but keep nothing.
  const startedAt = Number(body && body.startedAt);
  if (clean(body && body.company, 200) || (Number.isFinite(startedAt) && Date.now() - startedAt < 2000)) {
    return json({ ok: true });
  }

  const v = {
    firstName: clean(body.firstName, 80),
    lastName: clean(body.lastName, 80),
    email: clean(body.email, 200).toLowerCase(),
    phone: clean(body.phone, 30),
    interests: clean(body.interests, 2000).replace(/\r\n?/g, "\n"),
  };
  if (!v.firstName) return json({ error: "invalid", field: "firstName", message: "Please enter your first name." }, 400);
  if (!v.lastName) return json({ error: "invalid", field: "lastName", message: "Please enter your last name." }, 400);
  if (!EMAIL.test(v.email)) return json({ error: "invalid", field: "email", message: "Please check your email address." }, 400);
  if (v.phone && !PHONE.test(v.phone)) return json({ error: "invalid", field: "phone", message: "Please check your phone number." }, 400);

  try {
    const ipHash = await hashIp(clientIp(request));
    const recent = await env.DB.prepare("SELECT COUNT(*) AS n FROM form_submissions WHERE ip_hash = ? AND at > ?")
      .bind(ipHash, Date.now() - HOUR)
      .first();
    if ((recent && recent.n) >= MAX_PER_HOUR) {
      return json({ error: "too-many", message: "Thank you, we already have your details. Please try again later if you need to." }, 429);
    }

    await env.DB.batch([
      env.DB.prepare("INSERT INTO volunteers (first_name, last_name, email, phone, interests) VALUES (?, ?, ?, ?, ?)").bind(
        v.firstName,
        v.lastName,
        v.email,
        v.phone,
        v.interests
      ),
      env.DB.prepare("INSERT INTO form_submissions (ip_hash, at) VALUES (?, ?)").bind(ipHash, Date.now()),
      env.DB.prepare("DELETE FROM form_submissions WHERE at < ?").bind(Date.now() - 24 * HOUR),
    ]);
  } catch (e) {
    console.error("volunteer sign-up:", e);
    return json({ error: "unavailable" }, 503);
  }

  return json({ ok: true });
}
