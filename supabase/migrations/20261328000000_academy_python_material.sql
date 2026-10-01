-- Registers Python_for_Young_Innovators.pdf so students can open it.
--
-- The file was committed with no database row pointing at it, which is the same
-- fault as the electronics handout: it sits in the tree, the static host serves
-- it, and no query can ever return it, so nobody sees it.
--
-- Checked against the workbook that is already registered, because a second copy
-- of the same document would be worse than none. They are not the same file:
-- 59 pages against 42, different sizes, different hashes. Both were written by
-- pypdf, which is presumably a compression or reformatting script, and that is
-- the only thing they share.
--
-- The title comes from the filename. No PDF text extractor was available where
-- this was written, and the document's fonts are subset-encoded, so its actual
-- contents could not be read and a more descriptive title would have been a
-- guess. Rename it in the admin Materials page if something better fits.

insert into public.academy_materials (
  course_id, title, storage_path, storage_kind, mime_type,
  file_size_bytes, original_filename, published, created_by, updated_at
)
select
  c.id,
  'Python for Young Innovators',
  'course_material_assets/Python_for_Young_Innovators.pdf',
  'static',
  'application/pdf',
  284131,
  'Python_for_Young_Innovators.pdf',
  true,
  u.id,
  now()
from public.academy_courses c
cross join auth.users u
where c.slug = 'python-for-ai-machine-learning'
  and lower(u.email) = 'abdullahmusliudeen@gmail.com'
on conflict (storage_path) do update
  set course_id = excluded.course_id,
      lesson_id = null,
      title = excluded.title,
      storage_kind = 'static',
      mime_type = excluded.mime_type,
      file_size_bytes = excluded.file_size_bytes,
      original_filename = excluded.original_filename,
      published = true,
      updated_at = now();

-- The allow list from 20261327000000, with this file added. Kept as a running
-- check rather than a one-off: a static material whose file is not in the tree
-- hands a student the single-page app's index.html in place of a PDF, which is
-- the failure the whole storage_kind column exists to prevent.
delete from public.academy_materials
 where storage_kind = 'static'
   and storage_path like 'course_material_assets/%'
   and storage_path not in (
     'course_material_assets/Cpp_for_Embedded_Systems_and_Robotics.pdf',
     'course_material_assets/Electronics_and_Wiring_for_Beginners.pdf',
     'course_material_assets/Python_for_Young_Innovators.pdf',
     'course_material_assets/python-for-young-innovators-student-workbook_1.pdf'
   );