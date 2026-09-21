-- Enable Realtime for temporary classroom messages and attendance.
do $$
begin
  alter publication supabase_realtime add table public.academy_live_messages;
  alter publication supabase_realtime add table public.academy_live_attendance;
exception when duplicate_object then null;
end $$;

create or replace function public.academy_cleanup_live_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.academy_live_messages where created_at < now() - interval '60 days';
  delete from public.academy_live_attendance where joined_at < now() - interval '60 days';
end;
$$;

revoke execute on function public.academy_cleanup_live_data() from public, anon, authenticated;
