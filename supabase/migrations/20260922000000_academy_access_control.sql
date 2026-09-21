create table if not exists public.academy_classes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.academy_courses(id) on delete cascade,
  name text not null,
  description text not null default '',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.academy_class_members (
  class_id uuid not null references public.academy_classes(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'inactive')),
  joined_at timestamptz not null default now(),
  primary key (class_id, student_id)
);

create table if not exists public.academy_assignment_targets (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.academy_assignments(id) on delete cascade,
  class_id uuid references public.academy_classes(id) on delete cascade,
  student_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint academy_assignment_target_exactly_one check (
    (class_id is not null and student_id is null)
    or (class_id is null and student_id is not null)
  ),
  unique (assignment_id, class_id),
  unique (assignment_id, student_id)
);

alter table public.academy_assignments
  add column if not exists hints text[] not null default '{}';

create table if not exists public.academy_exercise_attempts (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.academy_exercises(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  code text not null,
  passed integer not null default 0 check (passed >= 0),
  total integer not null default 0 check (total >= 0),
  output text,
  created_at timestamptz not null default now()
);

create index if not exists academy_classes_course_idx
  on public.academy_classes(course_id);
create index if not exists academy_class_members_student_idx
  on public.academy_class_members(student_id, status);
create index if not exists academy_assignment_targets_assignment_idx
  on public.academy_assignment_targets(assignment_id);
create index if not exists academy_assignment_targets_student_idx
  on public.academy_assignment_targets(student_id);
create index if not exists academy_assignment_targets_class_idx
  on public.academy_assignment_targets(class_id);
create index if not exists academy_exercise_attempts_student_idx
  on public.academy_exercise_attempts(student_id, created_at desc);

create or replace function public.academy_is_class_member(
  target_class_id uuid,
  target_student_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.academy_class_members m
    where m.class_id = target_class_id
      and m.student_id = target_student_id
      and m.status = 'active'
  );
$$;

create or replace function public.academy_can_access_assignment(target_assignment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.academy_is_teacher()
    or exists (
      select 1
      from public.academy_assignment_targets t
      where t.assignment_id = target_assignment_id
        and (
          t.student_id = auth.uid()
          or public.academy_is_class_member(t.class_id, auth.uid())
        )
    );
$$;

alter table public.academy_classes enable row level security;
alter table public.academy_class_members enable row level security;
alter table public.academy_assignment_targets enable row level security;
alter table public.academy_exercise_attempts enable row level security;

create policy academy_classes_student_read
  on public.academy_classes for select to authenticated
  using (public.academy_is_teacher() or public.academy_is_class_member(id));

create policy academy_classes_teacher_manage
  on public.academy_classes for all to authenticated
  using (public.academy_is_teacher())
  with check (public.academy_is_teacher());

create policy academy_class_members_self_read
  on public.academy_class_members for select to authenticated
  using (student_id = auth.uid() or public.academy_is_teacher());

create policy academy_class_members_teacher_manage
  on public.academy_class_members for all to authenticated
  using (public.academy_is_teacher())
  with check (public.academy_is_teacher());

create policy academy_assignment_targets_student_read
  on public.academy_assignment_targets for select to authenticated
  using (
    student_id = auth.uid()
    or public.academy_is_class_member(class_id, auth.uid())
    or public.academy_is_teacher()
  );

create policy academy_assignment_targets_teacher_manage
  on public.academy_assignment_targets for all to authenticated
  using (public.academy_is_teacher())
  with check (public.academy_is_teacher());

create policy academy_exercise_attempts_self
  on public.academy_exercise_attempts for all to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

create policy academy_exercise_attempts_teacher_read
  on public.academy_exercise_attempts for select to authenticated
  using (public.academy_is_teacher());

drop policy if exists academy_assignments_read on public.academy_assignments;
create policy academy_assignments_targeted_read
  on public.academy_assignments for select to authenticated
  using (
    public.academy_can_access_assignment(id)
    and (published or public.academy_is_teacher())
  );

drop policy if exists academy_submissions_create on public.academy_submissions;
create policy academy_submissions_targeted_create
  on public.academy_submissions for insert to authenticated
  with check (
    student_id = auth.uid()
    and public.academy_can_access_assignment(assignment_id)
  );

-- Browser clients receive exercise prompts but never the stored solution.
revoke select on public.academy_exercises from anon, authenticated;
grant select (
  id,
  lesson_id,
  title,
  instructions,
  starter_code,
  difficulty,
  expected_concepts,
  hints,
  tests,
  explanation
) on public.academy_exercises to authenticated;

insert into storage.buckets (id, name, public)
values ('assignment-submissions', 'assignment-submissions', false)
on conflict (id) do update set public = excluded.public;

create policy academy_submission_files_self_read
  on storage.objects for select to authenticated
  using (
    bucket_id = 'assignment-submissions'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.academy_is_teacher())
  );

create policy academy_submission_files_self_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'assignment-submissions'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy academy_submission_files_self_delete
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'assignment-submissions'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
