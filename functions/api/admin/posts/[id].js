/*
 * Golborne Mosque — one post, for editing on the posting page.
 * (Signed-in only: see ../_middleware.js.)
 *
 *   GET    /api/admin/posts/<id>          → { post }  everything needed to edit it
 *   PUT    /api/admin/posts/<id>  (form)  → { post }  saves changes
 *   DELETE /api/admin/posts/<id>          → { ok }    removes the post and its photo
 *
 * A post's address (its slug) is kept when its title changes, so links
 * already shared still work.
 */

import { json, imageUrl, readPostForm, FormError, insertImage } from "../../../../lib/news-server.js";

async function load(db, id) {
  if (!/^\d+$/.test(id)) return null;
  return db
    .prepare(
      `SELECT p.*, i.width AS image_width, i.height AS image_height
       FROM posts p LEFT JOIN images i ON i.id = p.image_id WHERE p.id = ?`
    )
    .bind(Number(id))
    .first();
}

const missing = () => json({ error: "not-found" }, 404);

export async function onRequestGet({ env, params }) {
  const row = await load(env.DB, params.id);
  if (!row) return missing();
  return json({
    post: {
      id: row.id,
      slug: row.slug,
      title: row.title,
      body: row.body,
      date: row.published_on,
      published: !!row.published,
      image: row.image_id ? { url: imageUrl(row.image_id), width: row.image_width, height: row.image_height, alt: row.image_alt } : null,
      imageAlt: row.image_alt,
    },
  });
}

export async function onRequestPut({ request, env, params }) {
  const db = env.DB;
  const row = await load(db, params.id);
  if (!row) return missing();

  let post;
  try {
    post = await readPostForm(request);
  } catch (e) {
    if (e instanceof FormError) return json({ error: "invalid", field: e.field, message: e.message }, 400);
    throw e;
  }

  let imageId = row.image_id;
  const statements = [];
  if (post.image) {
    statements.push(insertImage(db, post.image));
    imageId = post.image.id;
  } else if (post.removeImage) {
    imageId = null;
  }
  statements.push(
    db
      .prepare(
        `UPDATE posts SET title = ?, body = ?, published_on = ?, published = ?, image_id = ?, image_alt = ?,
         updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?`
      )
      .bind(post.title, post.body, post.date, post.published, imageId, imageId ? post.imageAlt : "", row.id)
  );
  // The photo it replaced is no longer used anywhere.
  if (row.image_id && row.image_id !== imageId) statements.push(db.prepare("DELETE FROM images WHERE id = ?").bind(row.image_id));
  await db.batch(statements);

  return json({ post: { id: row.id, slug: row.slug, published: !!post.published } });
}

export async function onRequestDelete({ env, params }) {
  const db = env.DB;
  const row = await load(db, params.id);
  if (!row) return missing();
  const statements = [db.prepare("DELETE FROM posts WHERE id = ?").bind(row.id)];
  if (row.image_id) statements.push(db.prepare("DELETE FROM images WHERE id = ?").bind(row.image_id));
  await db.batch(statements);
  return json({ ok: true });
}
