-- Restore the role RPC for databases where its original migration was recorded
-- as applied but the function is missing from PostgREST.
create or replace function public.academy_set_user_role(
  target_user_id uuid,
  target_role public.academy_role
)
returns public.academy_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_profile public.academy_profiles;
begin
  if not public.academy_is_admin() then
    raise exception 'Academy administrator access required';
  end if;

  update public.academy_profiles
     set role = target_role,
         updated_at = now()
   where id = target_user_id
  returning * into updated_profile;

  if updated_profile.id is null then
    raise exception 'Academy profile not found';
  end if;

  return updated_profile;
end;
$$;

revoke execute on function public.academy_set_user_role(uuid, public.academy_role)
  from public, anon;
grant execute on function public.academy_set_user_role(uuid, public.academy_role)
  to authenticated;

-- Preserve closed session rows: active_seconds is also the durable source for
-- the all-time learning totals shown to students and staff. Heartbeat events,
-- voice notes, and audio storage still follow their existing retention windows.
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

  delete from public.academy_learning_session_events
   where created_at < now() - interval '14 days';
end;
$$;

revoke execute on function public.academy_cleanup_live_data()
  from public, anon, authenticated;

notify pgrst, 'reload schema';
