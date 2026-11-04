/*
 * Golborne Mosque — signing out of the posting page.
 *
 *   POST /api/admin/logout → { ok } and the session cookie removed
 */

import { json, clearCookie } from "../../../lib/news-server.js";

export const onRequestPost = () => json({ ok: true }, 200, { "set-cookie": clearCookie() });
