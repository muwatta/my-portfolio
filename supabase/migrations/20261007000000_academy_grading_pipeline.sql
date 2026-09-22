-- Phase 4: deterministic-first grading with AI as supplemental feedback

create table if not exists public.academy_submission_results (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.academy_submissions(id) on delete cascade,
  assignment_id uuid not null references public.academy_assignments(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  objective_score numeric(5,2) not null default 0 check (objective_score >= 0 and objective_score <= 100),
  objective_status text not null default 'passed' check (objective_status in ('passed', 'partial', 'failed', 'pending', 'manual_review')),
  test_summary jsonb,
  passed_tests integer not null default 0,
  failed_tests integer not null default 0,
  deterministic_source text not null default 'local_tests',
  ai_feedback_status text not null default 'pending' check (ai_feedback_status in ('pending', 'available', 'failed', 'rate_limited', 'disabled')),
  ai_feedback text,
  rubric_feedback jsonb,
  teacher_feedback text,
  final_score numeric(5,2) check (final_score >= 0 and final_score <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (submission_id)
);

create table if not exists public.academy_submission_events (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.academy_submissions(id) on delete cascade,
  event_type text not null check (event_type in ('submitted', 'validated', 'tests_run', 'scored', 'ai_feedback_saved', 'teacher_reviewed', 'retry_created')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists academy_submission_results_submission_idx on public.academy_submission_results (submission_id, objective_score);
create index if not exists academy_submission_events_submission_idx on public.academy_submission_events (submission_id, created_at desc);

create or replace function public.academy_submission_result_is_authoritative()
returns trigger
language plpgsql
as $$
begin
  if new.objective_score is not null and (new.objective_score < 0 or new.objective_score > 100) then
    raise exception 'Objective score must be between 0 and 100.';
  end if;

  if new.final_score is not null and (new.final_score < 0 or new.final_score > 100) then
    raise exception 'Final score must be between 0 and 100.';
  end if;

  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists academy_submission_results_guard on public.academy_submission_results;
create trigger academy_submission_results_guard
before insert or update on public.academy_submission_results
for each row
execute function public.academy_submission_result_is_authoritative();

drop policy if exists academy_submission_results_student_read on public.academy_submission_results;
create policy academy_submission_results_student_read
on public.academy_submission_results
for select to authenticated
using (
  student_id = auth.uid()
  or public.academy_is_teacher()
  or public.academy_is_admin()
);

drop policy if exists academy_submission_results_teacher_write on public.academy_submission_results;
create policy academy_submission_results_teacher_write
on public.academy_submission_results
for insert to authenticated
with check (
  public.academy_is_teacher() or public.academy_is_admin()
);

drop policy if exists academy_submission_results_teacher_update on public.academy_submission_results;
create policy academy_submission_results_teacher_update
on public.academy_submission_results
for update to authenticated
using (
  public.academy_is_teacher() or public.academy_is_admin()
)
with check (
  public.academy_is_teacher() or public.academy_is_admin()
);

drop policy if exists academy_submission_events_student_read on public.academy_submission_events;
create policy academy_submission_events_student_read
on public.academy_submission_events
for select to authenticated
using (
  exists (
    select 1 from public.academy_submissions s
    where s.id = submission_id and s.student_id = auth.uid()
  )
  or public.academy_is_teacher()
  or public.academy_is_admin()
);
