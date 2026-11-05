-- More photos for a News post, shown as a small gallery under its text.
-- (A post's main photo stays on posts.image_id.)

CREATE TABLE post_photos (
  post_id INTEGER NOT NULL,           -- posts.id
  position INTEGER NOT NULL,          -- order in the gallery, from 0
  image_id TEXT NOT NULL,             -- images.id
  alt TEXT NOT NULL DEFAULT '',       -- a description for people who can't see it
  PRIMARY KEY (post_id, position)
);

CREATE INDEX post_photos_image ON post_photos (image_id);
