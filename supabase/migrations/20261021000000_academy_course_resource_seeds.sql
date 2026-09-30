-- Seed published course resources (student-facing PDFs) for the shipped
-- courses. The files live as static assets in public/course_material_assets/
-- so they are served by the static host and browsers auto-download them.
-- Idempotent: rows are keyed by the unique storage_path.
--
-- The robotics manual that used to be seeded here was removed, and this seed
-- with it. The file is no longer in the tree, so a fresh database would have
-- created a material row pointing at a file that 404s into the single-page app.
-- 20261327000000 removes the row on databases that already ran the old version.

insert into public.academy_materials (course_id, title, storage_path, mime_type, file_size_bytes, published, created_by)
select
  c.id,
  'Python Student Workbook (Young Innovators)',
  'course_material_assets/python-for-young-innovators-student-workbook_1.pdf',
  'application/pdf',
  8825813,
  true,
  u.id
from public.academy_courses c
cross join auth.users u
where c.slug = 'python-for-ai-machine-learning'
  and lower(u.email) = 'abdullahmusliudeen@gmail.com'
on conflict (storage_path) do nothing;