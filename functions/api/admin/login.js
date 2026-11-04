/*
 * Golborne Mosque — signing in to the posting page.
 *
 *   POST /api/admin/login { password } → { ok } and a session cookie
 */

import { json, passwordMatches, sessionCookie, clientIp, tooManyFailures, recordFailure, clearFailures } from "../../../lib/news-server.js";

export async function onRequestPost({ request, env }) {
  const ip = clientIp(request);
  if (await tooManyFailures(env.DB, ip)) return json({ error: "too-many" }, 429);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "bad-request" }, 400);
  }

  if (!(await passwordMatches(env, (body && body.password) || ""))) {
    await recordFailure(env.DB, ip);
    return json({ error: "wrong-password" }, 401);
  }

  await clearFailures(env.DB, ip);
  return json({ ok: true }, 200, { "set-cookie": await sessionCookie(env) });
}
