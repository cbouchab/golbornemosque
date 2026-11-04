/*
 * Golborne Mosque — shared pieces for News on Cloudflare (functions/).
 * Not published as a file: Cloudflare bundles it into the functions.
 *
 * Posting is protected by one shared password, the NEWS_PASSWORD secret
 * (README → News). Signing in sets a cookie holding an expiry time and a
 * signature made with that password, so changing the password signs
 * everyone out.
 */

import { excerpt } from "../js/news-format.js";

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });

// Requests that change anything must come from a page on this website.
export function sameOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch (e) {
    return false;
  }
}

/* ---------- signing in ---------- */

const COOKIE = "gm_news";
const SESSION_DAYS = 14;
const encoder = new TextEncoder();

async function hmac(secret, message) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
}

const hex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

function equalBytes(a, b) {
  if (a.length !== b.length) return false;
  return crypto.subtle.timingSafeEqual(a, b);
}

export async function passwordMatches(env, given) {
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(String(given))),
    crypto.subtle.digest("SHA-256", encoder.encode(String(env.NEWS_PASSWORD))),
  ]);
  return equalBytes(new Uint8Array(a), new Uint8Array(b));
}

export async function sessionCookie(env) {
  const expires = Date.now() + SESSION_DAYS * 86400000;
  const sig = hex(await hmac(env.NEWS_PASSWORD, `news-session:${expires}`));
  return `${COOKIE}=${expires}.${sig}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_DAYS * 86400}`;
}

export const clearCookie = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;

export async function isSignedIn(request, env) {
  if (!env.NEWS_PASSWORD) return false;
  const cookies = request.headers.get("cookie") || "";
  const match = new RegExp(`(?:^|;\\s*)${COOKIE}=(\\d+)\\.([0-9a-f]{64})`).exec(cookies);
  if (!match) return false;
  const expires = Number(match[1]);
  if (!(expires > Date.now())) return false;
  const expected = await hmac(env.NEWS_PASSWORD, `news-session:${expires}`);
  const given = new Uint8Array(match[2].match(/../g).map((h) => parseInt(h, 16)));
  return equalBytes(expected, given);
}

// After 10 wrong passwords in 15 minutes, that connection has to wait.
const WINDOW = 15 * 60000;
const MAX_FAILURES = 10;

export const clientIp = (request) => request.headers.get("cf-connecting-ip") || "local";

export async function tooManyFailures(db, ip) {
  const row = await db.prepare("SELECT COUNT(*) AS n FROM login_failures WHERE ip = ? AND at > ?").bind(ip, Date.now() - WINDOW).first();
  return (row && row.n) >= MAX_FAILURES;
}

export async function recordFailure(db, ip) {
  await db.batch([
    db.prepare("INSERT INTO login_failures (ip, at) VALUES (?, ?)").bind(ip, Date.now()),
    db.prepare("DELETE FROM login_failures WHERE at < ?").bind(Date.now() - 86400000),
  ]);
}

export const clearFailures = (db, ip) => db.prepare("DELETE FROM login_failures WHERE ip = ?").bind(ip).run();

/* ---------- posts ---------- */

export const imageUrl = (id) => `/api/news/images/${id}`;

// The columns a list of posts needs, with the photo's size for its width/height.
export const CARD_COLUMNS =
  "p.id, p.slug, p.title, p.body, p.published_on, p.published, p.image_alt, i.id AS image_id, i.width AS image_width, i.height AS image_height";

export function card(row) {
  return {
    slug: row.slug,
    title: row.title,
    date: row.published_on,
    excerpt: excerpt(row.body),
    image: row.image_id ? { url: imageUrl(row.image_id), width: row.image_width, height: row.image_height, alt: row.image_alt || "" } : null,
  };
}

export function todayInLondon() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function slugify(title) {
  const slug = String(title)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[‘’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70)
    .replace(/-+$/, "");
  return slug || "post";
}

export async function uniqueSlug(db, base) {
  const { results } = await db.prepare("SELECT slug FROM posts WHERE slug = ? OR slug LIKE ?").bind(base, `${base}-%`).all();
  const taken = new Set(results.map((r) => r.slug));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}

export class FormError extends Error {
  constructor(field, message) {
    super(message);
    this.field = field;
  }
}

const IMAGE_TYPES = ["image/webp", "image/jpeg", "image/png"];
const MAX_IMAGE_BYTES = 1800000;

// Reads the posting page's form: the post's fields and, optionally, a new photo.
export async function readPostForm(request) {
  let form;
  try {
    form = await request.formData();
  } catch (e) {
    throw new FormError("form", "The post couldn't be read. Please try again.");
  }
  const text = (name, max) => String(form.get(name) || "").trim().slice(0, max);

  const title = text("title", 200);
  if (!title) throw new FormError("title", "Please give the post a title.");
  let date = text("date", 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) date = todayInLondon();

  let image = null;
  const file = form.get("image");
  if (file && typeof file === "object" && file.size) {
    if (!IMAGE_TYPES.includes(file.type)) throw new FormError("image", "The photo must be a JPEG, PNG or WebP image.");
    if (file.size > MAX_IMAGE_BYTES) throw new FormError("image", "The photo is too large. Please choose a smaller one.");
    const width = parseInt(form.get("image_width"), 10);
    const height = parseInt(form.get("image_height"), 10);
    if (!(width > 0 && width <= 5000 && height > 0 && height <= 5000)) throw new FormError("image", "The photo's size is missing.");
    image = { id: crypto.randomUUID().replace(/-/g, ""), type: file.type, width, height, data: await file.arrayBuffer() };
  }

  return {
    title,
    date,
    body: String(form.get("body") || "").replace(/\r\n?/g, "\n").slice(0, 50000),
    published: form.get("published") === "1" ? 1 : 0,
    imageAlt: text("image_alt", 300),
    removeImage: form.get("remove_image") === "1",
    image,
  };
}

export const insertImage = (db, image) =>
  db.prepare("INSERT INTO images (id, type, width, height, data) VALUES (?, ?, ?, ?, ?)").bind(image.id, image.type, image.width, image.height, image.data);

// D1 may hand back a BLOB as an ArrayBuffer or as an array of numbers.
export const toBytes = (data) => (data instanceof ArrayBuffer ? new Uint8Array(data) : ArrayBuffer.isView(data) ? data : new Uint8Array(data));
