-- Server side limits on what a student can upload.
--
-- max_file_size_bytes and allowed_file_types on an assignment were only ever
-- checked in the browser, so a direct call to the Storage API bypassed them
-- entirely and a student could put an arbitrarily large file, or any file at
-- all, into a private submission bucket. That is a storage bill and a
-- moderation problem, and the browser check was never a security control.
--
-- Three layers, because any one of them alone has a gap:
--
--   1. the bucket refuses anything over the ceiling, whatever the route in
--   2. a SECURITY DEFINER function validates the recorded size and type
--      against what the assignment actually allows
--   3. the submission row is only accepted through that function
--
-- The bucket ceiling is deliberately looser than any assignment so a teacher can
-- raise a per assignment limit without a migration, but tight enough to cap the
-- damage from a direct call.

update storage.buckets
   set file_size_limit = 26214400,
       allowed_mime_types = array[
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
         'video/mp4',
         'video/quicktime',
         'audio/webm',
         'audio/ogg',
         'audio/mpeg',
         'audio/mp4'
       ]
 where id = 'assignment-submissions';

-- The hard ceiling a single submission may claim, applied by the database
-- whatever the assignment says.
create or replace function public.academy_file_ceiling()
returns bigint
language sql
immutable
as $$
  select 20971520; -- 20 MB
$$;

-- Record a submission and validate the upload against the assignment.

create or replace function public.academy_register_submission(
  p_assignment_id uuid,
  p_source_code text default null,
  p_file_path text default null,
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
  student uuid := auth.uid();
  assignment public.academy_assignments;
  created public.academy_submissions;
  next_attempt integer;
  allowed text[];
  ceiling bigint;
begin
  if student is null then
    raise exception 'Authentication required.' using errcode = '28000';
  end if;

  select * into assignment from public.academy_assignments where id = p_assignment_id;
  if assignment.id is null then
    raise exception 'Assignment not found.' using errcode = 'P0002';
  end if;
  if assignment.status <> 'published' then
    raise exception 'This assignment is not open.' using errcode = '22023';
  end if;

  ceiling := public.academy_file_ceiling();

  -- Retry safety. A queued submission replayed after reconnect returns the row
  -- it already made rather than creating a second attempt.
  if p_client_operation_id is not null then
    select * into created
      from public.academy_submissions
     where student_id = student
       and client_operation_id = p_client_operation_id;
    if created.id is not null then
      return created;
    end if;
  end if;

  if p_file_path is not null then
    -- The path must sit inside the caller's own folder.
    if p_file_path not like student::text || '/%' then
      raise exception 'The file must be in your own folder.' using errcode = '42501';
    end if;

    if p_file_size_bytes is null or p_file_size_bytes <= 0 then
      raise exception 'The file size was not recorded.' using errcode = '22023';
    end if;

    if p_file_size_bytes > ceiling then
      raise exception 'That file is larger than the % MB limit.', ceiling / 1048576
        using errcode = '22023';
    end if;

    -- Take the tighter of the bucket ceiling and what the assignment allows.
    if assignment.max_file_size_bytes is not null
       and p_file_size_bytes > assignment.max_file_size_bytes then
      raise exception 'That file is larger than this assignment allows, which is % MB.',
        assignment.max_file_size_bytes / 1048576
        using errcode = '22023';
    end if;

    allowed := coalesce(assignment.allowed_file_types, '{}');
    if array_length(allowed, 1) > 0 then
      declare extension text := lower(coalesce(
        nullif(regexp_replace(p_original_filename, '^.*\.', ''), ''),
        split_part(coalesce(p_mime_type, ''), '/', 2)
      ));
      begin
        if not exists (
          select 1 from unnest(allowed) as permitted
           where lower(permitted) = '.' || extension
              or lower(permitted) = extension
        ) then
          raise exception 'That file type is not accepted for this assignment.'
            using errcode = '22023';
        end if;
      end;
    end if;
  end if;

  if assignment.retry_limit is not null then
    select count(*) into next_attempt
      from public.academy_submissions
     where assignment_id = p_assignment_id
       and student_id = student;
    if next_attempt >= assignment.retry_limit then
      raise exception 'You have used all % attempts for this assignment.',
        assignment.retry_limit using errcode = '22023';
    end if;
    next_attempt := next_attempt + 1;
  else
    select coalesce(max(attempt_number), 0) + 1 into next_attempt
      from public.academy_submissions
     where assignment_id = p_assignment_id
       and student_id = student;
  end if;

  insert into public.academy_submissions (
    assignment_id, student_id, attempt_number, source_code, file_path,
    original_filename, mime_type, file_size_bytes, status, client_operation_id
  )
  values (
    p_assignment_id, student, next_attempt, p_source_code, p_file_path,
    nullif(trim(coalesce(p_original_filename, '')), ''), p_mime_type,
    p_file_size_bytes, 'submitted', p_client_operation_id
  )
  returning * into created;

  insert into public.academy_submission_events (submission_id, event_type, payload)
  values (
    created.id,
    'submitted',
    jsonb_build_object(
      'source', case when p_file_path is null then 'code' else 'file' end,
      'bytes', p_file_size_bytes
    )
  );

  return created;
end;
$$;

revoke execute on function public.academy_file_ceiling() from public, anon, authenticated;
revoke execute on function public.academy_register_submission(uuid, text, text, text, text, bigint, text) from public, anon;
grant execute on function public.academy_register_submission(uuid, text, text, text, text, bigint, text) to authenticated;

notify pgrst, 'reload schema';
