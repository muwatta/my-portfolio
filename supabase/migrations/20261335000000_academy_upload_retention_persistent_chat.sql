-- Cap every assignment upload at 5 MiB and retain text chat until an admin
-- explicitly removes it. Assignment files are removed through Storage API by
-- the scheduled cleanup Edge Function after their submission is 30 days old.

update storage.buckets
   set file_size_limit = 5242880,
       allowed_mime_types = array[
         'text/plain',
         'text/markdown',
         'text/csv',
         'application/pdf',
         'application/json',
         'application/zip',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
         'application/zip',
         'text/x-c',
         'text/x-c++',
         'text/x-python',
         'application/octet-stream',
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

create or replace function public.academy_file_ceiling()
returns bigint
language sql
immutable
as $$
  select 5242880;
$$;

revoke execute on function public.academy_file_ceiling()
  from public, anon, authenticated;

-- Students may post and read room chat, but only administrators may remove it.
drop policy if exists academy_live_messages_teacher_delete
  on public.academy_live_messages;
drop policy if exists academy_live_messages_admin_delete
  on public.academy_live_messages;
create policy academy_live_messages_admin_delete
  on public.academy_live_messages
  for delete to authenticated
  using (public.academy_is_admin());

-- Realtime needs the row's room id when an administrator removes a message so
-- other open chat panels can remove it from view without reloading the room.
alter table public.academy_live_messages replica identity full;

-- Keep the existing cleanup schedule and voice-note/session policies, while
-- excluding persistent text messages from the age-based cleanup.
create or replace function public.academy_cleanup_live_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  stale_voice_paths text[];
begin
  select coalesce(array_agg(audio_path), '{}')
    into stale_voice_paths
    from public.academy_live_messages
   where audio_path is not null
     and created_at < now() - interval '14 days';

  if coalesce(array_length(stale_voice_paths, 1), 0) > 0 then
    delete from storage.objects
     where bucket_id = 'live-voice-notes'
       and name = any (stale_voice_paths);
  end if;

  update public.academy_live_messages
     set audio_path = null
   where audio_path is not null
     and created_at < now() - interval '14 days';

  delete from public.academy_live_messages
   where body is null
     and created_at < now() - interval '14 days';

  delete from public.academy_learning_sessions
   where is_active is false
     and coalesce(ended_at, last_heartbeat_at, started_at)
         < now() - interval '14 days';

  delete from public.academy_learning_session_events
   where created_at < now() - interval '14 days';
end;
$$;

revoke execute on function public.academy_cleanup_live_data()
  from public, anon, authenticated;

-- Existing administrator delegation UI is available to every current admin.
-- Keep the primary administrator protected while allowing admins to delegate.
create or replace function public.academy_set_user_admin(
  target_user_id uuid,
  should_be_admin boolean
)
returns public.academy_admins
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.academy_admins;
begin
  if not public.academy_is_admin() then
    raise exception 'Administrator access required';
  end if;

  if target_user_id = public.academy_primary_admin_id()
     and not should_be_admin then
    raise exception 'The primary administrator cannot be removed';
  end if;

  if should_be_admin then
    insert into public.academy_admins (user_id)
    values (target_user_id)
    on conflict (user_id) do update set user_id = excluded.user_id
    returning * into result;
  else
    delete from public.academy_admins
     where user_id = target_user_id
    returning * into result;
  end if;

  return result;
end;
$$;

revoke execute on function public.academy_set_user_admin(uuid, boolean)
  from public, anon;
grant execute on function public.academy_set_user_admin(uuid, boolean)
  to authenticated;

notify pgrst, 'reload schema';
