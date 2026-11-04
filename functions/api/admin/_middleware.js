/*
 * Golborne Mosque — guards everything under /api/admin (the posting page's API).
 * Changes must come from this website, and everything except signing in and
 * out needs a valid session.
 */

import { json, isSignedIn, sameOrigin } from "../../../lib/news-server.js";

const OPEN = new Set(["/api/admin/login", "/api/admin/logout"]);

export async function onRequest({ request, env, next }) {
  if (request.method !== "GET" && request.method !== "HEAD" && !sameOrigin(request)) {
    return json({ error: "forbidden" }, 403);
  }
  if (!env.NEWS_PASSWORD) return json({ error: "not-configured" }, 503);
  if (!env.DB) return json({ error: "no-database" }, 503);
  if (OPEN.has(new URL(request.url).pathname)) return next();
  if (!(await isSignedIn(request, env))) return json({ error: "signed-out" }, 401);
  return next();
}
