-- Repair the course-driven Academy schema when earlier migrations were not
-- applied to an existing production project. This is intentionally idempotent.

create table if not exists public.academy_schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  state text not null default '',
  city text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.academy_schools
  add column if not exists name text not null default '',
  add column if not exists code text,
  add column if not exists state text not null default '',
  add column if not exists city text not null default '',
  add column if not exists is_active boolean not null default true,
  add column if not exists created_at timestamptz not null default now();

alter table public.academy_profiles
  add column if not exists school_id uuid,
  add column if not exists current_course_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'academy_profiles_school_id_fkey'
      and conrelid = 'public.academy_profiles'::regclass
  ) then
    alter table public.academy_profiles
      add constraint academy_profiles_school_id_fkey
      foreign key (school_id) references public.academy_schools(id)
      on delete set null;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'academy_profiles_current_course_id_fkey'
      and conrelid = 'public.academy_profiles'::regclass
  ) then
    alter table public.academy_profiles
      add constraint academy_profiles_current_course_id_fkey
      foreign key (current_course_id) references public.academy_courses(id)
      on delete set null;
  end if;
end;
$$;

alter table public.academy_courses
  add column if not exists course_family text
    check (course_family in ('programming', 'robotics', 'general')),
  add column if not exists is_programming_course boolean not null default false,
  add column if not exists is_active boolean not null default true,
  add column if not exists sort_order integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'academy_enrollments_course_id_fkey'
      and conrelid = 'public.academy_enrollments'::regclass
  ) then
    alter table public.academy_enrollments
      add constraint academy_enrollments_course_id_fkey
      foreign key (course_id) references public.academy_courses(id)
      on delete cascade;
  end if;
end;
$$;

alter table public.academy_schools enable row level security;

drop policy if exists academy_schools_read on public.academy_schools;
create policy academy_schools_read
on public.academy_schools
for select to authenticated
using (is_active or public.academy_is_teacher() or public.academy_is_admin());

notify pgrst, 'reload schema';
