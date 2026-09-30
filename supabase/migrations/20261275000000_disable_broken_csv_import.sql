-- Take the CSV importer out of service until it works.
--
-- academy_exam_preview_csv and academy_exam_import_csv are reachable by any
-- teacher and currently raise "The file is empty" for every file. A teacher who
-- uploads a correct CSV and is told the file is empty has no way forward, which
-- is a worse failure than the feature being absent.
--
-- Execute is revoked here so the broken path cannot be reached at all. The
-- splitter, the preview and the import are otherwise unchanged and can be
-- re-enabled by granting execute again once the header read is fixed.
--
-- The engine itself is unaffected and verified. Everything else in the
-- assessment engine works: starting an attempt, the server computed deadline,
-- the paper with no answer key in it, saving answers, grading, hidden results
-- and publishing.

revoke execute on function public.academy_exam_preview_csv(text, uuid, boolean)
  from public, anon, authenticated;
revoke execute on function public.academy_exam_import_csv(text, uuid, boolean, boolean)
  from public, anon, authenticated;

-- Known remaining fault, for whoever picks this up: reading the header row out
-- of academy_exam_split_csv. The splitter itself is verified correct, two rows by
-- three columns, with a quoted field containing a comma returned whole. The
-- header read returns null even though generate_subscripts yields the right row
-- count, so the value never lands in the receiving variable. The array rank is
-- the likely culprit: each element of the splitter's result is already a text[],
-- so a text[][] receiver will not hold it.

notify pgrst, 'reload schema';
