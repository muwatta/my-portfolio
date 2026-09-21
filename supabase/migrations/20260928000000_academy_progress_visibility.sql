-- P3 verified progression and private notifications.
create table if not exists public.academy_points (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  points integer not null check (points > 0),
  source_type text not null check (source_type in ('lesson', 'practice', 'assignment', 'project')),
  source_id uuid not null,
  created_at timestamptz not null default now(),
  unique (student_id, source_type, source_id)
);

create table if not exists public.academy_notifications (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('lesson', 'assignment', 'feedback', 'badge', 'live_class', 'announcement')),
  title text not null,
  body text not null default '',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists academy_points_leaderboard_idx
  on public.academy_points(student_id, created_at desc);
create index if not exists academy_notifications_student_idx
  on public.academy_notifications(student_id, created_at desc);

alter table public.academy_points enable row level security;
alter table public.academy_notifications enable row level security;

create policy academy_points_public_read on public.academy_points
  for select to authenticated using (true);
create policy academy_points_teacher_manage on public.academy_points
  for all to authenticated using (public.academy_is_teacher()) with check (public.academy_is_teacher());
create policy academy_notifications_self_read on public.academy_notifications
  for select to authenticated using (student_id = auth.uid() or public.academy_is_teacher());
create policy academy_notifications_self_update on public.academy_notifications
  for update to authenticated using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy academy_notifications_teacher_insert on public.academy_notifications
  for insert to authenticated with check (public.academy_is_teacher());

create or replace function public.academy_award_verified_activity(
  target_student_id uuid,
  target_source_type text,
  target_source_id uuid,
  target_points integer,
  target_badge_slug text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare badge_id uuid;
begin
  if auth.uid() is null or (auth.uid() <> target_student_id and not public.academy_is_teacher()) then
    raise exception 'Academy authorization required';
  end if;
  insert into public.academy_points(student_id, points, source_type, source_id)
  values (target_student_id, target_points, target_source_type, target_source_id)
  on conflict (student_id, source_type, source_id) do nothing;
  if target_badge_slug is not null then
    select id into badge_id from public.academy_badges where slug = target_badge_slug and active;
    if badge_id is not null then
      insert into public.academy_student_badges(student_id, badge_id)
      values (target_student_id, badge_id)
      on conflict do nothing;
    end if;
  end if;
end;
$$;

create or replace function public.academy_leaderboard()
returns table (student_id uuid, display_name text, level_name text, points bigint, rank bigint)
language sql
security definer
set search_path = public
as $$
  select p.id, p.display_name, l.name,
    coalesce(sum(ap.points), 0)::bigint,
    dense_rank() over (order by coalesce(sum(ap.points), 0) desc)
  from public.academy_profiles p
  left join public.academy_levels l on l.id = p.level_id
  left join public.academy_points ap on ap.student_id = p.id
  where p.role = 'student'
  group by p.id, p.display_name, l.name
  order by points desc, p.display_name;
$$;

revoke execute on function public.academy_award_verified_activity(uuid, text, uuid, integer, text) from public, anon;
grant execute on function public.academy_award_verified_activity(uuid, text, uuid, integer, text) to authenticated;
revoke execute on function public.academy_leaderboard() from public, anon;
grant execute on function public.academy_leaderboard() to authenticated;
