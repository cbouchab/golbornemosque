/*
 * Golborne Mosque — every post, drafts included, for the posting page.
 * (Signed-in only: see ../_middleware.js.)
 *
 *   GET  /api/admin/posts             → { posts: [{ id, slug, title, date, published, image }] }
 *   POST /api/admin/posts  (form)     → { post }  creates a post
 */

import { json, card, CARD_COLUMNS, readPostForm, FormError, insertImage, slugify, uniqueSlug } from "../../../../lib/news-server.js";

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    `SELECT ${CARD_COLUMNS} FROM posts p LEFT JOIN images i ON i.id = p.image_id ORDER BY p.published_on DESC, p.id DESC`
  ).all();
  return json({ posts: results.map((row) => ({ id: row.id, published: !!row.published, ...card(row) })) });
}

export async function onRequestPost({ request, env }) {
  let post;
  try {
    post = await readPostForm(request);
  } catch (e) {
    if (e instanceof FormError) return json({ error: "invalid", field: e.field, message: e.message }, 400);
    throw e;
  }

  const db = env.DB;
  const slug = await uniqueSlug(db, slugify(post.title));
  const statements = [];
  if (post.image) statements.push(insertImage(db, post.image));
  statements.push(
    db
      .prepare("INSERT INTO posts (slug, title, body, published_on, published, image_id, image_alt) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id")
      .bind(slug, post.title, post.body, post.date, post.published, post.image ? post.image.id : null, post.imageAlt)
  );
  const results = await db.batch(statements);
  const id = results[results.length - 1].results[0].id;
  return json({ post: { id, slug, published: !!post.published } }, 201);
}
