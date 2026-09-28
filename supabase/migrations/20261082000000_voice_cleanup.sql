-- Clears anything the voice note probe left behind, in case it was interrupted.
--
-- No storage rows are removed here. The probe only inserted message rows and
-- never uploaded an object, and Supabase refuses a direct delete from
-- storage.objects anyway, so a leftover recording would have to be removed
-- through the Storage API. The fourteen day cleanup removes them properly.
delete from public.academy_live_messages where room_id in (
  select r.id from public.academy_live_rooms r
  where r.title = 'Voice probe room'
);
delete from public.academy_live_rooms where title = 'Voice probe room';
delete from public.academy_schedules where title = 'Voice probe schedule';
