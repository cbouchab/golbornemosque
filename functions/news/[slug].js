/*
 * Golborne Mosque — a News post at /news/<slug>.
 *
 * Built on Cloudflare from the news-post.html page, so search engines and
 * link previews (WhatsApp, Facebook…) see the post's title, summary and photo.
 * Drafts are shown only to someone signed in to the posting page.
 */

import { renderBody, excerpt, escapeHtml } from "../../js/news-format.js";
import { imageUrl, isSignedIn } from "../../lib/news-server.js";

const SITE_NAME = "Golborne Mosque";

async function notFound(env, request) {
  const page = await env.ASSETS.fetch(new URL("/404", request.url));
  return new Response(page.body, { status: 404, headers: { "content-type": "text/html; charset=utf-8" } });
}

const longDate = (iso) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export async function onRequestGet({ request, env, params }) {
  if (!env.DB) return notFound(env, request);

  const post = await env.DB.prepare(
    `SELECT p.*, i.width AS image_width, i.height AS image_height
     FROM posts p LEFT JOIN images i ON i.id = p.image_id WHERE p.slug = ?`
  )
    .bind(String(params.slug))
    .first();
  if (!post) return notFound(env, request);

  const draft = !post.published;
  if (draft && !(await isSignedIn(request, env))) return notFound(env, request);

  const origin = new URL(request.url).origin;
  const summary = excerpt(post.body, 160) || `News from ${SITE_NAME}, 76 Golborne Road, London W10.`;
  const photo = post.image_id
    ? { url: imageUrl(post.image_id), width: post.image_width, height: post.image_height, alt: post.image_alt || "" }
    : null;

  const template = await env.ASSETS.fetch(new URL("/news-post", request.url));
  const setAttr = (name, value) => ({ element: (el) => el.setAttribute(name, value) });

  let rewriter = new HTMLRewriter()
    .on("title", { element: (el) => el.setInnerContent(`${post.title} · ${SITE_NAME}`) })
    .on('meta[name="robots"]', { element: (el) => (draft ? null : el.remove()) })
    .on('meta[name="description"]', setAttr("content", summary))
    .on('meta[property="og:title"]', setAttr("content", post.title))
    .on('meta[property="og:description"]', setAttr("content", summary))
    .on('meta[property="og:url"]', setAttr("content", `${origin}/news/${post.slug}`))
    .on('meta[property="article:published_time"]', setAttr("content", post.published_on))
    .on("[data-post-title]", { element: (el) => el.setInnerContent(post.title) })
    .on("[data-post-date]", {
      element: (el) => {
        el.setAttribute("datetime", post.published_on);
        el.setInnerContent(longDate(post.published_on));
      },
    })
    .on("[data-post-body]", { element: (el) => el.setInnerContent(renderBody(post.body), { html: true }) })
    .on("[data-post-draft]", { element: (el) => (draft ? el.removeAttribute("hidden") : el.remove()) });

  if (photo) {
    rewriter = rewriter
      .on('meta[property="og:image"]', setAttr("content", origin + photo.url))
      .on('meta[property="og:image:width"]', setAttr("content", String(photo.width)))
      .on('meta[property="og:image:height"]', setAttr("content", String(photo.height)))
      .on('meta[property="og:image:alt"]', setAttr("content", photo.alt || post.title))
      .on("[data-post-photo]", {
        element: (el) => {
          el.removeAttribute("hidden");
          el.setInnerContent(
            `<img src="${photo.url}" width="${photo.width}" height="${photo.height}" alt="${escapeHtml(photo.alt)}" fetchpriority="high">`,
            { html: true }
          );
        },
      });
  } else {
    rewriter = rewriter.on("[data-post-photo]", { element: (el) => el.remove() });
  }

  const response = rewriter.transform(template);
  const headers = new Headers(response.headers);
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("cache-control", draft ? "private, no-store" : "public, max-age=0, must-revalidate");
  return new Response(response.body, { status: 200, headers });
}
