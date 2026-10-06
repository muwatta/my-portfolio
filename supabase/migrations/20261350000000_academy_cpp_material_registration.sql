-- Publish the C++ course book. The PDF is committed in public/ and served as a
-- static app asset, but earlier migrations only included its path in cleanup
-- allowlists; none actually inserted a material row for it.

insert into public.academy_materials (
  course_id,
  title,
  storage_path,
  storage_kind,
  mime_type,
  file_size_bytes,
  original_filename,
  published,
  created_by,
  updated_at
)
select
  c.id,
  'C++ for Embedded Systems and Robotics',
  'course_material_assets/Cpp_for_Embedded_Systems_and_Robotics.pdf',
  'static',
  'application/pdf',
  249406,
  'Cpp_for_Embedded_Systems_and_Robotics.pdf',
  true,
  u.id,
  now()
from public.academy_courses as c
cross join auth.users as u
where c.slug = 'cpp-embedded-robotics'
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
