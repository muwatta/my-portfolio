-- Seed published course resources (student-facing PDFs) for the two shipped
-- courses. The files live as static assets in public/course_material_assets/
-- so they are served by the static host and browsers auto-download them.
-- Idempotent: rows are keyed by the unique storage_path.

insert into public.academy_materials (course_id, title, storage_path, mime_type, file_size_bytes, published, created_by)
select
  c.id,
  'Robotics Manual (C++ Embedded Systems)',
  'course_material_assets/ATE_Robotics_Manual_Mr_Muwatta.pdf',
  'application/pdf',
  1905173,
  true,
  u.id
from public.academy_courses c
cross join auth.users u
where c.slug = 'cpp-embedded-robotics'
  and lower(u.email) = 'abdullahmusliudeen@gmail.com'
on conflict (storage_path) do nothing;

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