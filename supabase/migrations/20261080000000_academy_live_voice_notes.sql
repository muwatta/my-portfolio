-- Voice notes in the live room.
--
-- The room was a text box. It becomes audio and voice notes only: the browser
-- records, the audio is stored privately, and the message row points at the
-- object. Nothing here replaces the WebRTC call that is already in the room;
-- this is the message list beside it.
--
-- Two things are deliberate.
--
-- Text is closed off at the privilege level, not just in the interface. Direct
-- insert is revoked, so the only way to post is academy_post_voice_note, which
-- refuses anything that is not audio. A "voice only" rule enforced only by
-- hiding the text box would be one UI change away from being wrong.
--
-- Existing rows keep working. body becomes nullable so a voice note needs no
-- text, but the old text messages are left alone and age out through the
-- existing fourteen day cleanup.

alter table public.academy_live_messages
  add column if not exists audio_path text,
  add column if not exists audio_mime text,
  add column if not exists duration_seconds integer,
  add column if not exists size_bytes bigint;

alter table public.academy_live_messages
  alter column body drop not null;

comment on column public.academy_live_messages.audio_path is
  'Path of the recorded note inside the private live-voice-notes bucket.';

-- Private bucket. A voice note is a student's voice, so it is never public.
insert into storage.buckets (id, name, public)
values ('live-voice-notes', 'live-voice-notes', false)
on conflict (id) do update set public = excluded.public;

-- Each sender may only write inside their own folder, and may only read inside
-- a room they can reach. Teachers read everything in the bucket.
drop policy if exists academy_voice_notes_self_insert on storage.objects;
create policy academy_voice_notes_self_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'live-voice-notes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists academy_voice_notes_self_read on storage.objects;
create policy academy_voice_notes_self_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'live-voice-notes'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.academy_is_teacher()
    )
  );

drop policy if exists academy_voice_notes_teacher_read on storage.objects;
create policy academy_voice_notes_teacher_read on storage.objects
  for select to authenticated
  using (bucket_id = 'live-voice-notes' and public.academy_is_teacher());

-- Post a voice note. This is the only route into the table now.
create or replace function public.academy_post_voice_note(
  p_room_id uuid,
  p_audio_path text,
  p_audio_mime text,
  p_duration_seconds integer,
  p_size_bytes bigint
)
returns public.academy_live_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  created public.academy_live_messages;
  required_prefix text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '28000';
  end if;
  if not public.academy_can_access_live_room(p_room_id) then
    raise exception 'You cannot post in this room.' using errcode = '42501';
  end if;

  -- Five minutes and two megabytes. A voice note that runs longer is a call,
  -- and the room already has one.
  if p_duration_seconds is null
     or p_duration_seconds <= 0
     or p_duration_seconds > 300 then
    raise exception 'A voice note can be at most 5 minutes.' using errcode = '22023';
  end if;
  if p_size_bytes is null or p_size_bytes <= 0 or p_size_bytes > 2097152 then
    raise exception 'A voice note can be at most 2 MB.' using errcode = '22023';
  end if;

  -- Only the audio types a browser actually produces.
  if p_audio_mime is null
     or p_audio_mime !~ '^(audio/(webm|ogg|mp4|mpeg|wav|x-wav))' then
    raise exception 'Unsupported audio format.' using errcode = '22023';
  end if;

  -- The path must be inside the sender's own folder, so one member cannot post
  -- a note attributed to another.
  required_prefix := auth.uid()::text || '/';
  if p_audio_path is null or p_audio_path not like required_prefix || '%' then
    raise exception 'The audio must be stored in your own folder.' using errcode = '42501';
  end if;

  insert into public.academy_live_messages (
    room_id, sender_id, body, audio_path, audio_mime,
    duration_seconds, size_bytes
  )
  values (
    p_room_id, auth.uid(), null, p_audio_path, p_audio_mime,
    p_duration_seconds, p_size_bytes
  )
  returning * into created;

  return created;
end;
$$;

-- Text can no longer be posted directly, so the old policy is retired rather
-- than left as a way around academy_post_voice_note.
drop policy if exists academy_live_messages_self_insert on public.academy_live_messages;

revoke execute on function public.academy_post_voice_note(uuid, text, text, integer, bigint) from public, anon;
grant execute on function public.academy_post_voice_note(uuid, text, text, integer, bigint) to authenticated;

-- Retention has to cover the audio as well as the row. Deleting the message row
-- and leaving the object behind would keep every recording forever, which is the
-- opposite of what the fourteen day window is for.

create or replace function public.academy_cleanup_live_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  stale_paths text[];
begin
  select coalesce(array_agg(audio_path), '{}')
    into stale_paths
    from public.academy_live_messages
   where audio_path is not null
     and created_at < now() - interval '14 days';

  -- Remove the recordings for messages that are about to go.
  if coalesce(array_length(stale_paths, 1), 0) > 0 then
    delete from storage.objects
     where bucket_id = 'live-voice-notes'
       and name = any (stale_paths);
  end if;

  delete from public.academy_live_messages
    where created_at < now() - interval '14 days';

  delete from public.academy_learning_sessions
    where is_active is false
      and coalesce(ended_at, last_heartbeat_at, started_at) < now() - interval '14 days';

  delete from public.academy_learning_session_events
    where created_at < now() - interval '14 days';
end;
$$;

revoke execute on function public.academy_cleanup_live_data() from public, anon, authenticated;

notify pgrst, 'reload schema';
