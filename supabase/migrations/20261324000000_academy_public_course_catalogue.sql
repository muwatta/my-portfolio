-- The academy was not appearing in Google because of how the host serves it,
-- not because of anything on the page:
--
--   1. vercel.json falls back to index.html for any path with no file.
--   2. No academy route was prerendered, so /academy had no file.
--   3. Google therefore received index.html, which carries
--      <link rel="canonical" href="https://www.muwatta.com.ng/">.
--
-- That is an instruction to drop /academy and index the homepage instead, and it
-- is why the academy stayed out of the index however good the page looked. The
-- prerender in scripts/prerender.mjs now emits a real file per public route,
-- with its own self-referencing canonical. This migration is the other half: a
-- public course catalogue for those course pages to read.
--
-- Deliberately narrow. This is one table, published rows only, read only. A
-- course's title, summary, slug and length are the marketing copy for its own
-- landing page and have to be readable by a crawler that has never signed in.
-- Everything a student pays for is not here: weeks, lessons, exercises, source
-- code and materials live on their own tables, which stay authenticated-only.
-- curriculum is carried on this row but is not used for that, so nothing behind
-- the login is exposed by reading it.

drop policy if exists academy_courses_public_read on public.academy_courses;

create policy academy_courses_public_read
  on public.academy_courses
  for select
  to anon, authenticated
  using (published = true);
