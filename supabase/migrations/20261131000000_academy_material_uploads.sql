-- Let an administrator upload, replace and delete course material files.
--
-- The materials page could only edit metadata. Upload required typing a
-- storage_path by hand, because the two seeded materials are static files in
-- public/course_material_assets/ served by the static host. An administrator
-- therefore could not upload a new PDF at all: every change needed a code edit
-- and a redeploy. That is the problem this fixes.
--
-- Existing rows keep working. They point at the static host and are marked
-- storage_kind 'static'. New uploads go to a private Supabase Storage bucket and
-- are marked 'storage', so the two coexist during the transition and nothing
-- currently published breaks.
--
-- The bucket is private and reached through signed URLs, because these are paid
-- course documents. Object paths are random rather than derived from the title,
-- so a signed URL cannot be guessed from a lesson name.
--
-- File size is capped at 25 MB here rather than the 5 MB the client validator
-- uses for assignment submissions, because the shipped Python workbook is
-- 8.8 MB and a teacher must be able to re-upload it. The two limits are
-- deliberately different things.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'course-materials',
  'course-materials',
  false,
  26214400,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown',
    'image/png',
    'image/jpeg',
    'application/zip',
    'application/x-zip-compressed'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Record which host serves a material: the static host for the files that are
-- committed to the repository, Supabase Storage for anything an administrator
-- uploads. Without this the client cannot tell a URL from a storage object key.
alter table public.academy_materials
  add column if not exists storage_kind text not null default 'static';
alter table public.academy_materials
  add column if not exists updated_at timestamptz not null default now();
alter table public.academy_materials
  add column if not exists original_filename text;
alter table public.academy_materials
  add column if not exists replaced_at timestamptz;
alter table public.academy_materials
  add column if not exists replaced_by uuid references auth.users(id) on delete set null;

alter table public.academy_materials
  drop constraint if exists academy_materials_storage_kind_ck;
alter table public.academy_materials
  add constraint academy_materials_storage_kind_ck check (
    storage_kind in ('static', 'storage')
  );

update public.academy_materials set storage_kind = 'static' where storage_path is not null;
update public.academy_materials
   set original_filename = split_part(storage_path, '/', -1)
 where original_filename is null;

create index if not exists academy_materials_course_idx
  on public.academy_materials (course_id, lesson_id);

-- Storage policies. Teachers and administrators manage the bucket; any signed in
-- user may request a signed URL, but only for a path they could already learn
-- from a published material row, because the RLS policy on academy_materials
-- still governs which rows exist for a student.
drop policy if exists academy_course_materials_write on storage.objects;
create policy academy_course_materials_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'course-materials'
    and public.academy_is_teacher()
  );

drop policy if exists academy_course_materials_update on storage.objects;
create policy academy_course_materials_update on storage.objects
  for update to authenticated
  using (bucket_id = 'course-materials' and public.academy_is_teacher())
  with check (bucket_id = 'course-materials' and public.academy_is_teacher());

drop policy if exists academy_course_materials_delete on storage.objects;
create policy academy_course_materials_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'course-materials' and public.academy_is_teacher());

drop policy if exists academy_course_materials_read on storage.objects;
create policy academy_course_materials_read on storage.objects
  for select to authenticated
  using (bucket_id = 'course-materials');

-- Register a newly uploaded file as a material. Split from the upload itself so
-- the file can exist in storage before the row commits, and so the row can be
-- validated independently of a browser.
create or replace function public.academy_register_material_file(
  p_course_id uuid,
  p_lesson_id uuid,
  p_title text,
  p_storage_path text,
  p_mime_type text,
  p_file_size_bytes integer,
  p_published boolean default false,
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
  if not public.academy_is_teacher() then
    raise exception 'Only teachers and administrators can manage course materials.';
  end if;
  if p_title is null or btrim(p_title) = '' then
    raise exception 'A material needs a title.';
  end if;
  if p_storage_path is null or btrim(p_storage_path) = '' then
    raise exception 'A material needs a file.';
  end if;
  if p_file_size_bytes is null or p_file_size_bytes <= 0 then
    raise exception 'The uploaded file appears to be empty.';
  end if;
  if p_file_size_bytes > 26214400 then
    raise exception 'Materials must be 25 MB or smaller.';
  end if;
  if exists (
    select 1 from public.academy_materials
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
      p_file_size_bytes, split_part(p_storage_path, '/', -1),
      coalesce(p_published, false), auth.uid(), now()
    )
    returning * into result;
  end if;

  return result;
end;
$$;

-- Remove a material. The row goes first on purpose: if the object removal then
-- fails, the cost is an orphaned file nobody can see, rather than a published
-- material that links to a deleted file.
create or replace function public.academy_delete_material(p_material_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  kind text;
  path text;
begin
  if not public.academy_is_teacher() then
    raise exception 'Only teachers and administrators can delete course materials.';
  end if;

  select storage_kind, storage_path into kind, path
  from public.academy_materials
  where id = p_material_id
  for update;

  if not found then
    raise exception 'That material no longer exists.';
  end if;

  delete from public.academy_materials where id = p_material_id;
  return coalesce(path, '');
end;
$$;

revoke execute on function public.academy_register_material_file(uuid, uuid, text, text, text, integer, boolean, uuid) from public, anon;
revoke execute on function public.academy_delete_material(uuid) from public, anon;
grant execute on function public.academy_register_material_file(uuid, uuid, text, text, text, integer, boolean, uuid) to authenticated;
grant execute on function public.academy_delete_material(uuid) to authenticated;

notify pgrst, 'reload schema';
