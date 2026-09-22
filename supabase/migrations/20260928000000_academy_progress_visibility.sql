-- P3: private notifications and compatibility layer.
--
-- The old academy_points leaderboard has been retired.
-- Weekly verified progression is implemented later by:
-- 20261008000000_academy_weekly_leaderboard.sql
--
-- Keep notifications in this migration because they are independent
-- of the leaderboard implementation.

create table if not exists public.academy_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (
    type in (
      'lesson',
      'assignment',
      'feedback',
      'badge',
      'live_class',
      'announcement'
    )
  ),
  title text not null,
  message text not null default '',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists academy_notifications_user_idx
  on public.academy_notifications(user_id, created_at desc);

alter table public.academy_notifications enable row level security;

create policy academy_notifications_self_read
on public.academy_notifications
for select to authenticated
using (
  user_id = auth.uid()
  or public.academy_is_teacher()
  or public.academy_is_admin()
);

create policy academy_notifications_self_update
on public.academy_notifications
for update to authenticated
using (
  user_id = auth.uid()
)
with check (
  user_id = auth.uid()
);

create policy academy_notifications_teacher_insert
on public.academy_notifications
for insert to authenticated
with check (
  public.academy_is_teacher()
  or public.academy_is_admin()
);

-- Compatibility function.
--
-- Verified activity is awarded by the weekly leaderboard system
-- introduced later in the migration chain. This function remains
-- temporarily available so earlier migrations can reference it
-- without maintaining the obsolete academy_points table.

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
begin
  if auth.uid() is null then
    raise exception 'Academy authorization required';
  end if;

  if auth.uid() <> target_student_id
     and not public.academy_is_teacher()
     and not public.academy_is_admin()
  then
    raise exception 'Academy authorization required';
  end if;

  -- The actual verified point award is handled by the later
  -- weekly leaderboard migration.
  return;
end;
$$;

revoke execute
on function public.academy_award_verified_activity(
  uuid,
  text,
  uuid,
  integer,
  text
)
from public, anon;

grant execute
on function public.academy_award_verified_activity(
  uuid,
  text,
  uuid,
  integer,
  text
)
to authenticated;

-- Temporary compatibility version of the old leaderboard RPC.
--
-- The authoritative leaderboard is replaced by the weekly leaderboard
-- implementation in 20261008000000.

create or replace function public.academy_leaderboard()
returns table (
  student_id uuid,
  display_name text,
  level_name text,
  points bigint,
  rank bigint
)
language sql
security definer
set search_path = public
as $$
  select
    p.id as student_id,
    p.display_name,
    null::text as level_name,
    0::bigint as points,
    0::bigint as rank
  from public.academy_profiles p
  where p.role = 'student'
  order by p.display_name;
$$;

revoke execute
on function public.academy_leaderboard()
from public, anon;

grant execute
on function public.academy_leaderboard()
to authenticated;