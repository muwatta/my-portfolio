-- Restrict temporary classroom access to teachers, admins, and enrolled
-- students whose published schedule owns the room.

create or replace function public.academy_can_access_live_room(target_room_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    auth.uid() is not null
    and (
      public.academy_is_teacher()
      or public.academy_is_admin()
      or exists (
        select 1
        from public.academy_live_rooms r
        join public.academy_schedules s on s.id = r.schedule_id
        join public.academy_enrollments e
          on e.course_id = s.course_id
         and e.student_id = auth.uid()
         and e.status = 'active'
        where r.id = target_room_id
          and r.status <> 'ended'
          and s.published
      )
    );
$$;

drop policy if exists academy_live_rooms_read on public.academy_live_rooms;
create policy academy_live_rooms_read
on public.academy_live_rooms
for select to authenticated
using (public.academy_can_access_live_room(id));

drop policy if exists academy_live_messages_read on public.academy_live_messages;
create policy academy_live_messages_read
on public.academy_live_messages
for select to authenticated
using (public.academy_can_access_live_room(room_id));

drop policy if exists academy_live_messages_self_insert on public.academy_live_messages;
create policy academy_live_messages_self_insert
on public.academy_live_messages
for insert to authenticated
with check (
  sender_id = auth.uid()
  and public.academy_can_access_live_room(room_id)
);

drop policy if exists academy_live_attendance_self_read on public.academy_live_attendance;
create policy academy_live_attendance_self_read
on public.academy_live_attendance
for select to authenticated
using (
  student_id = auth.uid()
  or public.academy_is_teacher()
  or public.academy_is_admin()
);

drop policy if exists academy_live_attendance_self_insert on public.academy_live_attendance;
create policy academy_live_attendance_self_insert
on public.academy_live_attendance
for insert to authenticated
with check (
  student_id = auth.uid()
  and public.academy_can_access_live_room(room_id)
);

drop policy if exists academy_live_attendance_self_update on public.academy_live_attendance;
create policy academy_live_attendance_self_update
on public.academy_live_attendance
for update to authenticated
using (student_id = auth.uid())
with check (student_id = auth.uid());

create or replace function public.academy_leave_live_room(target_room_id uuid)
returns public.academy_live_attendance
language plpgsql
security definer
set search_path = public
as $$
declare
  attendance_row public.academy_live_attendance;
begin
  update public.academy_live_attendance
  set left_at = coalesce(left_at, now())
  where room_id = target_room_id
    and student_id = auth.uid()
  returning * into attendance_row;
  return attendance_row;
end;
$$;

revoke execute on function public.academy_leave_live_room(uuid) from public, anon;
grant execute on function public.academy_leave_live_room(uuid) to authenticated;

alter table public.academy_submission_results
  drop constraint if exists academy_submission_results_ai_feedback_status_check;

alter table public.academy_submission_results
  add constraint academy_submission_results_ai_feedback_status_check
  check (
    ai_feedback_status in (
      'pending',
      'available',
      'failed',
      'rate_limited',
      'timeout',
      'disabled'
    )
  );
