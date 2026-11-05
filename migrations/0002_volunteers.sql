-- Volunteer sign-ups from the Volunteer page (/volunteer). The trust sees them
-- on the private /admin page and removes each one once it has been dealt with.

CREATE TABLE volunteers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  interests TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- Recent sign-ups per connection (a one-way hash, never the address itself),
-- to stop anyone flooding the form. Rows older than a day are cleared.
CREATE TABLE form_submissions (
  ip_hash TEXT NOT NULL,
  at INTEGER NOT NULL                 -- milliseconds since 1970
);

CREATE INDEX form_submissions_ip ON form_submissions (ip_hash, at);
