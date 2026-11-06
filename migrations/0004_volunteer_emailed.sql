-- When each volunteer sign-up was emailed to info@. Empty means the email didn't
-- go, and the posting page marks that sign-up "Not emailed".

ALTER TABLE volunteers ADD COLUMN emailed_at TEXT;
