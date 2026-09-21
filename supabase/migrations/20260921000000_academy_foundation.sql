create type public.academy_role as enum ('student', 'teacher');

create table public.academy_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  role public.academy_role not null default 'student',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.academy_courses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null default '',
  duration_weeks smallint not null check (duration_weeks > 0),
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.academy_weeks (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.academy_courses(id) on delete cascade,
  week_number smallint not null check (week_number between 1 and 52),
  title text not null,
  unique (course_id, week_number)
);

create table public.academy_lessons (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references public.academy_weeks(id) on delete cascade,
  title text not null,
  slug text not null,
  lesson_number smallint not null check (lesson_number > 0),
  objectives text[] not null default '{}',
  content jsonb not null default '{}'::jsonb,
  published boolean not null default false,
  unique (week_id, slug),
  unique (week_id, lesson_number)
);

create table public.academy_lesson_progress (
  lesson_id uuid not null references public.academy_lessons(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (lesson_id, student_id)
);

create table public.academy_exercises (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.academy_lessons(id) on delete cascade,
  title text not null,
  instructions text not null,
  starter_code text not null default '',
  difficulty text not null default 'beginner' check (difficulty in ('beginner', 'developing', 'challenge')),
  expected_concepts text[] not null default '{}',
  hints text[] not null default '{}',
  tests jsonb not null default '[]'::jsonb,
  solution_code text,
  explanation text
);

create table public.academy_assignments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.academy_courses(id) on delete cascade,
  lesson_id uuid references public.academy_lessons(id) on delete set null,
  title text not null,
  instructions text not null,
  due_at timestamptz,
  points smallint not null default 10 check (points > 0),
  allowed_submission_types text[] not null default '{code}',
  starter_code text not null default '',
  tests jsonb not null default '[]'::jsonb,
  rubric jsonb not null default '{}'::jsonb,
  retry_limit smallint not null default 3 check (retry_limit >= 0),
  ai_feedback_enabled boolean not null default true,
  published boolean not null default false,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.academy_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.academy_assignments(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  attempt_number smallint not null check (attempt_number > 0),
  source_code text,
  file_path text,
  original_filename text,
  mime_type text,
  file_size_bytes integer check (file_size_bytes is null or file_size_bytes >= 0),
  status text not null default 'submitted' check (status in ('submitted', 'processing', 'graded', 'returned')),
  submitted_at timestamptz not null default now(),
  unique (assignment_id, student_id, attempt_number)
);

create table public.academy_submission_results (
  submission_id uuid primary key references public.academy_submissions(id) on delete cascade,
  score numeric(5, 2) not null check (score >= 0),
  max_score numeric(5, 2) not null check (max_score > 0),
  tests_passed integer not null default 0 check (tests_passed >= 0),
  tests_total integer not null default 0 check (tests_total >= 0),
  deterministic_feedback jsonb not null default '{}'::jsonb,
  ai_feedback jsonb,
  teacher_feedback text,
  teacher_score numeric(5, 2),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.academy_projects (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.academy_courses(id) on delete cascade,
  title text not null,
  description text not null default '',
  created_at timestamptz not null default now()
);

create table public.academy_project_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.academy_projects(id) on delete cascade,
  milestone_number smallint not null check (milestone_number between 1 and 20),
  title text not null,
  unique (project_id, milestone_number)
);

create table public.academy_project_progress (
  milestone_id uuid not null references public.academy_project_milestones(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  completed_at timestamptz,
  notes text,
  primary key (milestone_id, student_id)
);

create index academy_weeks_course_idx on public.academy_weeks(course_id, week_number);
create index academy_lessons_week_idx on public.academy_lessons(week_id, lesson_number);
create index academy_progress_student_idx on public.academy_lesson_progress(student_id);
create index academy_submissions_student_idx on public.academy_submissions(student_id, submitted_at desc);
create index academy_submissions_assignment_idx on public.academy_submissions(assignment_id, student_id);

create or replace function public.academy_is_teacher()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.academy_profiles
    where id = auth.uid() and role = 'teacher'
  );
$$;

create or replace function public.academy_create_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.academy_profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_academy_profile on auth.users;
create trigger on_auth_user_created_academy_profile
after insert on auth.users
for each row execute procedure public.academy_create_profile();

alter table public.academy_profiles enable row level security;
alter table public.academy_courses enable row level security;
alter table public.academy_weeks enable row level security;
alter table public.academy_lessons enable row level security;
alter table public.academy_lesson_progress enable row level security;
alter table public.academy_exercises enable row level security;
alter table public.academy_assignments enable row level security;
alter table public.academy_submissions enable row level security;
alter table public.academy_submission_results enable row level security;
alter table public.academy_projects enable row level security;
alter table public.academy_project_milestones enable row level security;
alter table public.academy_project_progress enable row level security;

create policy academy_profiles_self_read on public.academy_profiles for select to authenticated using (id = auth.uid() or public.academy_is_teacher());
create policy academy_profiles_teacher_update on public.academy_profiles for update to authenticated using (public.academy_is_teacher()) with check (public.academy_is_teacher());
create policy academy_content_read on public.academy_courses for select to authenticated using (published or public.academy_is_teacher());
create policy academy_content_manage on public.academy_courses for all to authenticated using (public.academy_is_teacher()) with check (public.academy_is_teacher());
create policy academy_weeks_read on public.academy_weeks for select to authenticated using (exists (select 1 from public.academy_courses c where c.id = course_id and (c.published or public.academy_is_teacher())));
create policy academy_weeks_manage on public.academy_weeks for all to authenticated using (public.academy_is_teacher()) with check (public.academy_is_teacher());
create policy academy_lessons_read on public.academy_lessons for select to authenticated using (published or public.academy_is_teacher());
create policy academy_lessons_manage on public.academy_lessons for all to authenticated using (public.academy_is_teacher()) with check (public.academy_is_teacher());
create policy academy_exercises_read on public.academy_exercises for select to authenticated using (exists (select 1 from public.academy_lessons l where l.id = lesson_id and (l.published or public.academy_is_teacher())));
create policy academy_exercises_manage on public.academy_exercises for all to authenticated using (public.academy_is_teacher()) with check (public.academy_is_teacher());
create policy academy_lesson_progress_self on public.academy_lesson_progress for all to authenticated using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy academy_lesson_progress_teacher on public.academy_lesson_progress for select to authenticated using (public.academy_is_teacher());
create policy academy_assignments_read on public.academy_assignments for select to authenticated using (published or public.academy_is_teacher());
create policy academy_assignments_manage on public.academy_assignments for all to authenticated using (public.academy_is_teacher()) with check (public.academy_is_teacher());
create policy academy_submissions_self on public.academy_submissions for select to authenticated using (student_id = auth.uid());
create policy academy_submissions_create on public.academy_submissions for insert to authenticated with check (student_id = auth.uid());
create policy academy_submissions_teacher on public.academy_submissions for select to authenticated using (public.academy_is_teacher());
create policy academy_submission_results_self on public.academy_submission_results for select to authenticated using (exists (select 1 from public.academy_submissions s where s.id = submission_id and s.student_id = auth.uid()));
create policy academy_submission_results_teacher on public.academy_submission_results for all to authenticated using (public.academy_is_teacher()) with check (public.academy_is_teacher());
create policy academy_projects_read on public.academy_projects for select to authenticated using (true);
create policy academy_projects_manage on public.academy_projects for all to authenticated using (public.academy_is_teacher()) with check (public.academy_is_teacher());
create policy academy_milestones_read on public.academy_project_milestones for select to authenticated using (true);
create policy academy_milestones_manage on public.academy_project_milestones for all to authenticated using (public.academy_is_teacher()) with check (public.academy_is_teacher());
create policy academy_project_progress_self on public.academy_project_progress for all to authenticated using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy academy_project_progress_teacher on public.academy_project_progress for select to authenticated using (public.academy_is_teacher());
