-- Let students hand in screenshots, with a 5 MB ceiling that the server
-- enforces rather than the browser.
--
-- The client validator already allowed .png, .jpg and .jpeg, and both shipped
-- assignments list them, so a student with a screenshot had somewhere to put
-- it. Two gaps: modern phone photos (.webp, .heic) were rejected by the bucket
-- and by the assignments, and the real limit was the assignment's own 10 MB.
-- A browser check is only a suggestion, so a 5 MB ceiling for images is applied
-- in academy_register_submission, where a student cannot talk their way past it.

update storage.buckets
  set allowed_mime_types = array[
    'text/plain',
    'application/pdf',
    'application/json',
    'application/zip',
    'text/x-c',
    'text/x-c++',
    'text/x-python',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/heic',
    'image/heif',
    'video/mp4',
    'video/quicktime',
    'audio/webm',
    'audio/ogg',
    'audio/mpeg',
    'audio/mp4'
  ]
 where id = 'assignment-submissions';

-- Both shipped assignments already list .png, .jpg and .jpeg. Add the modern
-- phone formats so a screenshot taken on a current handset is not rejected.
update public.academy_assignments a
   set allowed_file_types = coalesce(a.allowed_file_types, '{}'::text[]) || coalesce(
     (select array_agg(candidate order by candidate)
        from unnest(array['.webp', '.heic', '.heif']::text[]) as candidate
       where not exists (
         select 1
           from unnest(coalesce(a.allowed_file_types, '{}'::text[])) as existing
          where lower(existing) = candidate
       )), '{}'::text[]);

create or replace function public.academy_register_submission(
  p_assignment_id uuid,
  p_source_code text default null,
  p_original_filename text default null,
  p_mime_type text default null,
  p_file_size_bytes bigint default null,
  p_client_operation_id text default null
)
returns public.academy_submissions
language plpgsql
security definer
set search_path = public
as $$
declare
  assignment public.academy_assignments%rowtype;
  allowed text[];
  extension text;
  next_attempt integer;
  result public.academy_submissions%rowtype;
  is_image boolean;
begin
  if p_client_operation_id is not null then
    select * into result
    from public.academy_submissions
    where student_id = auth.uid()
      and client_operation_id = p_client_operation_id;
    if result.id is not null then
      return result;
    end if;
  end if;

  select * into assignment
  from public.academy_assignments
  where id = p_assignment_id;

  if assignment.id is null then
    raise exception 'Assignment not found' using errcode = 'P0002';
  end if;

  if not public.academy_can_access_assignment(p_assignment_id, 'submit') then
    raise exception 'You cannot submit work for this assignment'
      using errcode = '42501';
  end if;

  if p_file_size_bytes is not null and p_file_size_bytes > 0 then
    if p_file_size_bytes > public.academy_file_ceiling() then
      raise exception 'That file is larger than the Academy allows.'
        using errcode = '22023';
    end if;
    if assignment.max_file_size_bytes is not null
       and p_file_size_bytes > assignment.max_file_size_bytes then
      raise exception 'That file is larger than this assignment allows, which is % MB.',
        assignment.max_file_size_bytes / 1048576
        using errcode = '22023';
    end if;

    extension := lower(coalesce(
      nullif(regexp_replace(coalesce(p_original_filename, ''), '^.*\.', ''), ''),
      split_part(coalesce(p_mime_type, ''), '/', 2)
    ));
    is_image := extension in ('png', 'jpg', 'jpeg', 'webp', 'heic', 'heif');

    -- A browser check is a suggestion. This is the limit that holds.
    if is_image and p_file_size_bytes > 5242880 then
      raise exception 'Images must be 5 MB or smaller. Try taking the photo again at a lower quality, or crop it first.'
        using errcode = '22023';
    end if;

    allowed := coalesce(assignment.allowed_file_types, '{}');
    if array_length(allowed, 1) > 0 and extension <> '' then
      if not exists (
        select 1 from unnest(allowed) as permitted
         where lower(permitted) = '.' || extension
            or lower(permitted) = extension
      ) then
        raise exception 'That file type is not accepted for this assignment.'
          using errcode = '22023';
      end if;
    end if;
  end if;

  if assignment.retry_limit is not null then
    select count(*) into next_attempt
    from public.academy_submissions
    where assignment_id = p_assignment_id
      and student_id = auth.uid();
    if next_attempt >= assignment.retry_limit then
      raise exception 'You have used all your attempts for this assignment.'
        using errcode = '22023';
    end if;
    next_attempt := next_attempt + 1;
  else
    next_attempt := 1;
  end if;

  insert into public.academy_submissions (
    assignment_id, student_id, source_code, attempt_number, status,
    original_filename, mime_type, file_size_bytes, client_operation_id
  ) values (
    p_assignment_id, auth.uid(), p_source_code, next_attempt, 'submitted',
    nullif(trim(coalesce(p_original_filename, '')), ''), p_mime_type,
    p_file_size_bytes, p_client_operation_id
  )
  returning * into result;

  return result;
end;
$$;

revoke execute on function public.academy_register_submission(uuid, text, text, text, bigint, text) from public, anon;
grant execute on function public.academy_register_submission(uuid, text, text, text, bigint, text) to authenticated;

notify pgrst, 'reload schema';
