-- News posts, written on the posting page (/admin) and shown on /news and the home page.

CREATE TABLE images (
  id TEXT PRIMARY KEY,                -- random, so an image's address never changes
  type TEXT NOT NULL,                 -- image/webp, image/jpeg or image/png
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  data BLOB NOT NULL,                 -- resized in the browser before upload, well under D1's 2 MB row limit
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,          -- the post's address, /news/<slug>; set once, so shared links keep working
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',      -- simple formatting, see js/news-format.js
  published_on TEXT NOT NULL,         -- YYYY-MM-DD, shown as the post's date
  published INTEGER NOT NULL DEFAULT 1, -- 0 = draft, only visible on the posting page
  image_id TEXT REFERENCES images(id),
  image_alt TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX posts_listing ON posts (published, published_on DESC, id DESC);

-- Failed sign-ins, to slow down anyone guessing the password.
CREATE TABLE login_failures (
  ip TEXT NOT NULL,
  at INTEGER NOT NULL                 -- milliseconds since 1970
);

CREATE INDEX login_failures_ip ON login_failures (ip, at);
