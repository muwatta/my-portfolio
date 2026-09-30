-- Three fixes to the course materials, all found by looking at what the admin
-- Materials page actually showed.
--
-- 1. The C++ course had a materials PDF sitting in the repository that no
--    database row pointed at, so no student could ever see it. It is now
--    registered, as a static row served from the app like the Python workbook.
--
-- 2. original_filename was the storage path with the directory stripped, and a
--    new upload's last path segment is "<random-uuid>-<sanitised name>". So every
--    uploaded material recorded its own UUID as the filename, and the admin page
--    showed "a2e9e486-f6a7-4be1-8deb-3b62f6250914-Cpp_for_Embedded_Systems_and_
--    Robotics.pdf" where a teacher expected to see a filename. The random prefix
--    is deliberate, so that a signed URL cannot be guessed from a lesson name;
--    it just must not be recorded as the name of the file.
--
-- 3. A seed migration still pointed at course_material_assets/
--    ATE_Robotics_Manual_Mr_Muwatta.pdf, which was deleted when its material was
--    removed. On this database the row was already gone, so nothing dangles, but
--    a fresh database would re-create a row pointing at a file that is not in the
--    tree. The seed itself is fixed in 20261021000000; this removes anything a
--    database that already ran the old seed is still carrying.

-- ---------------------------------------------------------------------------
-- 1. Register the electronics handout so students can actually open it.
-- ---------------------------------------------------------------------------
-- Static rather than a storage upload: the bytes are in the repository and are
-- served by the app, which is exactly how the Python workbook is registered.
-- Idempotent, and it repairs a row that exists but is unpublished or has no
-- course, so re-running is always safe.
insert into public.academy_materials (
  course_id, title, storage_path, storage_kind, mime_type,
  file_size_bytes, original_filename, published, created_by, updated_at
)
select
  c.id,
  'Electronics and Wiring for Beginners',
  'course_material_assets/Electronics_and_Wiring_for_Beginners.pdf',
  'static',
  'application/pdf',
  256437,
  'Electronics_and_Wiring_for_Beginners.pdf',
  true,
  u.id,
  now()
from public.academy_courses c
cross join auth.users u
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

-- ---------------------------------------------------------------------------
-- 2. Strip the random prefix when recording the original filename.
-- ---------------------------------------------------------------------------
-- Only the leading "<uuid>-" is removed. The name has already been sanitised by
-- the client, so this recovers the readable part without attempting to guess a
-- path it does not have.
create or replace function public.academy_material_original_filename(p_storage_path text)
returns text
language sql
immutable
as $$
  select regexp_replace(
    split_part(coalesce(p_storage_path, ''), '/', -1),
    '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-',
    ''
  );
$$;

comment on function public.academy_material_original_filename(text) is
  'The file name to show an administrator, with the random upload prefix removed. The prefix is deliberate, so a signed URL cannot be guessed from a lesson name.';

-- Backfill the rows that already have the UUID in them.
update public.academy_materials
   set original_filename = public.academy_material_original_filename(storage_path),
       updated_at = now()
 where storage_kind = 'storage'
   and original_filename is distinct from public.academy_material_original_filename(storage_path);

-- The function itself has to change, not just the data, or the next upload
-- records the UUID again.
create or replace function public.academy_register_material_file(
  p_course_id uuid,
  p_lesson_id uuid,
  p_title text,
  p_storage_path text,
  p_mime_type text,
  p_file_size_bytes bigint,
  p_published boolean,
  p_material_id uuid default null
)
returns public.academy_materials
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.academy_materials;
begin
  if auth.uid() is null then
    raise exception 'Not signed in.';
  end if;

  if p_storage_path is null or btrim(p_storage_path) = '' then
    raise exception 'No file was given.';
  end if;

  if btrim(coalesce(p_title, '')) = '' then
    raise exception 'A title is required.';
  end if;

  if p_file_size_bytes is null or p_file_size_bytes <= 0 then
    raise exception 'That file is empty.';
  end if;

  if exists (
    select 1
    from public.academy_materials
    where storage_path = p_storage_path
      and (p_material_id is null or id <> p_material_id)
  ) then
    raise exception 'That file is already attached to another material.';
  end if;

  if p_material_id is not null then
    update public.academy_materials
    set course_id = p_course_id,
        lesson_id = p_lesson_id,
        title = btrim(p_title),
        storage_path = p_storage_path,
        storage_kind = 'storage',
        mime_type = p_mime_type,
        file_size_bytes = p_file_size_bytes,
        original_filename = public.academy_material_original_filename(p_storage_path),
        published = coalesce(p_published, false),
        replaced_at = now(),
        replaced_by = auth.uid(),
        updated_at = now()
    where id = p_material_id
    returning * into result;

    if result.id is null then
      raise exception 'That material no longer exists.';
    end if;
  else
    insert into public.academy_materials (
      course_id, lesson_id, title, storage_path, storage_kind, mime_type,
      file_size_bytes, original_filename, published, created_by, updated_at
    ) values (
      p_course_id, p_lesson_id, btrim(p_title), p_storage_path, 'storage', p_mime_type,
      p_file_size_bytes, public.academy_material_original_filename(p_storage_path),
      coalesce(p_published, false), auth.uid(), now()
    )
    returning * into result;
  end if;

  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Drop rows still pointing at the robotics manual that was removed.
-- ---------------------------------------------------------------------------
delete from public.academy_materials
 where storage_path = 'course_material_assets/ATE_Robotics_Manual_Mr_Muwatta.pdf';

-- Nothing may point at a file that is not in the tree. A student who opened
-- this link before it was removed would have been handed the single-page app's
-- index.html in place of a PDF, which is the failure this whole column exists to
-- prevent.
delete from public.academy_materials
 where storage_kind = 'static'
   and storage_path like 'course_material_assets/%'
   and storage_path not in (
     'course_material_assets/Cpp_for_Embedded_Systems_and_Robotics.pdf',
     'course_material_assets/Electronics_and_Wiring_for_Beginners.pdf',
     'course_material_assets/python-for-young-innovators-student-workbook_1.pdf'
   );
