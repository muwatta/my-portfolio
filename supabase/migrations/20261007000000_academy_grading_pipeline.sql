-- Phase 4: deterministic-first grading with AI as supplemental feedback.
--
-- The Academy foundation migration already created:
--   academy_submissions
--   academy_submission_results
--
-- This migration upgrades those existing tables rather than attempting to
-- recreate them with a different schema.

-- ============================================================
-- 1. Upgrade submissions
-- ============================================================

alter table public.academy_submissions
  add column if not exists status text;

alter table public.academy_submissions
  add column if not exists source_code text;

alter table public.academy_submissions
  add column if not exists file_path text;

alter table public.academy_submissions
  add column if not exists original_filename text;

alter table public.academy_submissions
  add column if not exists mime_type text;

alter table public.academy_submissions
  add column if not exists file_size_bytes integer;

alter table public.academy_submissions
  add column if not exists submitted_at timestamptz;

-- Normalize existing rows before adding stricter defaults/constraints.

update public.academy_submissions
set status = 'submitted'
where status is null;

update public.academy_submissions
set submitted_at = now()
where submitted_at is null;

alter table public.academy_submissions
  alter column status set default 'submitted';

alter table public.academy_submissions
  alter column status set not null;

alter table public.academy_submissions
  alter column submitted_at set default now();

alter table public.academy_submissions
  alter column submitted_at set not null;

-- The original foundation schema already has attempt_number and the
-- uniqueness constraint. Keep those historical definitions intact.

-- ============================================================
-- 2. Upgrade submission results
-- ============================================================

alter table public.academy_submission_results
  add column if not exists id uuid;

alter table public.academy_submission_results
  add column if not exists assignment_id uuid;

alter table public.academy_submission_results
  add column if not exists student_id uuid;

alter table public.academy_submission_results
  add column if not exists objective_score numeric(5,2);

alter table public.academy_submission_results
  add column if not exists objective_status text;

alter table public.academy_submission_results
  add column if not exists test_summary jsonb;

alter table public.academy_submission_results
  add column if not exists passed_tests integer;

alter table public.academy_submission_results
  add column if not exists failed_tests integer;

alter table public.academy_submission_results
  add column if not exists deterministic_source text;

alter table public.academy_submission_results
  add column if not exists ai_feedback_status text;

alter table public.academy_submission_results
  add column if not exists rubric_feedback jsonb;

alter table public.academy_submission_results
  add column if not exists final_score numeric(5,2);

alter table public.academy_submission_results
  add column if not exists updated_at timestamptz;

-- Map the old foundation score into the new objective score.

update public.academy_submission_results
set objective_score = coalesce(
  objective_score,
  score,
  0
)
where objective_score is null;

update public.academy_submission_results
set objective_status =
  case
    when objective_status is not null then objective_status
    when score >= max_score then 'passed'
    when score > 0 then 'partial'
    else 'failed'
  end
where objective_status is null;

update public.academy_submission_results
set passed_tests = coalesce(passed_tests, tests_passed, 0)
where passed_tests is null;

update public.academy_submission_results
set failed_tests = coalesce(
  failed_tests,
  greatest(tests_total - tests_passed, 0),
  0
)
where failed_tests is null;

update public.academy_submission_results
set test_summary = coalesce(
  test_summary,
  deterministic_feedback,
  '{}'::jsonb
)
where test_summary is null;

update public.academy_submission_results
set deterministic_source = 'local_tests'
where deterministic_source is null;

update public.academy_submission_results
set ai_feedback_status =
  case
    when ai_feedback is not null then 'available'
    else 'pending'
  end
where ai_feedback_status is null;

update public.academy_submission_results
set final_score = objective_score
where final_score is null;

update public.academy_submission_results
set updated_at = created_at
where updated_at is null;

-- Add defaults after existing rows have been normalized.

alter table public.academy_submission_results
  alter column objective_score set default 0;

alter table public.academy_submission_results
  alter column objective_score set not null;

alter table public.academy_submission_results
  alter column objective_status set default 'pending';

alter table public.academy_submission_results
  alter column objective_status set not null;

alter table public.academy_submission_results
  alter column passed_tests set default 0;

alter table public.academy_submission_results
  alter column passed_tests set not null;

alter table public.academy_submission_results
  alter column failed_tests set default 0;

alter table public.academy_submission_results
  alter column failed_tests set not null;

alter table public.academy_submission_results
  alter column deterministic_source set default 'local_tests';

alter table public.academy_submission_results
  alter column deterministic_source set not null;

alter table public.academy_submission_results
  alter column ai_feedback_status set default 'pending';

alter table public.academy_submission_results
  alter column ai_feedback_status set not null;

alter table public.academy_submission_results
  alter column updated_at set default now();

alter table public.academy_submission_results
  alter column updated_at set not null;

-- Populate identity columns for the existing foundation rows.

update public.academy_submission_results
set id = gen_random_uuid()
where id is null;

update public.academy_submission_results r
set assignment_id = s.assignment_id
from public.academy_submissions s
where r.submission_id = s.id
  and r.assignment_id is null;

update public.academy_submission_results r
set student_id = s.student_id
from public.academy_submissions s
where r.submission_id = s.id
  and r.student_id is null;

-- These columns are now derivable from the submission relationship.

alter table public.academy_submission_results
  alter column id set default gen_random_uuid();

alter table public.academy_submission_results
  alter column id set not null;

alter table public.academy_submission_results
  alter column assignment_id set not null;

alter table public.academy_submission_results
  alter column student_id set not null;

-- ============================================================
-- 3. Constraints for the upgraded grading model
-- ============================================================

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'academy_submission_results_objective_score_check'
      and conrelid = 'public.academy_submission_results'::regclass
  ) then
    alter table public.academy_submission_results
      add constraint academy_submission_results_objective_score_check
      check (objective_score >= 0 and objective_score <= 100);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'academy_submission_results_objective_status_check'
      and conrelid = 'public.academy_submission_results'::regclass
  ) then
    alter table public.academy_submission_results
      add constraint academy_submission_results_objective_status_check
      check (
        objective_status in (
          'passed',
          'partial',
          'failed',
          'pending',
          'manual_review'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'academy_submission_results_ai_feedback_status_check'
      and conrelid = 'public.academy_submission_results'::regclass
  ) then
    alter table public.academy_submission_results
      add constraint academy_submission_results_ai_feedback_status_check
      check (
        ai_feedback_status in (
          'pending',
          'available',
          'failed',
          'rate_limited',
          'disabled'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'academy_submission_results_final_score_check'
      and conrelid = 'public.academy_submission_results'::regclass
  ) then
    alter table public.academy_submission_results
      add constraint academy_submission_results_final_score_check
      check (final_score >= 0 and final_score <= 100);
  end if;
end
$$;

-- ============================================================
-- 4. Submission events
-- ============================================================

create table if not exists public.academy_submission_events (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null
    references public.academy_submissions(id)
    on delete cascade,
  event_type text not null check (
    event_type in (
      'submitted',
      'validated',
      'tests_run',
      'scored',
      'ai_feedback_saved',
      'teacher_reviewed',
      'retry_created'
    )
  ),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 5. Indexes
-- ============================================================

create index if not exists academy_submission_results_submission_idx
  on public.academy_submission_results (
    submission_id,
    objective_score
  );

create index if not exists academy_submission_results_student_idx
  on public.academy_submission_results (
    student_id,
    created_at desc
  );

create index if not exists academy_submission_results_assignment_idx
  on public.academy_submission_results (
    assignment_id,
    created_at desc
  );

create index if not exists academy_submission_events_submission_idx
  on public.academy_submission_events (
    submission_id,
    created_at desc
  );

-- ============================================================
-- 6. Grading integrity trigger
-- ============================================================

create or replace function public.academy_submission_result_is_authoritative()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.objective_score is not null
     and (new.objective_score < 0 or new.objective_score > 100) then
    raise exception 'Objective score must be between 0 and 100.';
  end if;

  if new.final_score is not null
     and (new.final_score < 0 or new.final_score > 100) then
    raise exception 'Final score must be between 0 and 100.';
  end if;

  new.updated_at = now();

  return new;
end;
$$;

drop trigger if exists academy_submission_results_guard
on public.academy_submission_results;

create trigger academy_submission_results_guard
before insert or update
on public.academy_submission_results
for each row
execute function public.academy_submission_result_is_authoritative();

-- ============================================================
-- 7. RLS
-- ============================================================

alter table public.academy_submission_results enable row level security;
alter table public.academy_submission_events enable row level security;

drop policy if exists academy_submission_results_self_read
on public.academy_submission_results;

drop policy if exists academy_submission_results_self
on public.academy_submission_results;

drop policy if exists academy_submission_results_student_read
on public.academy_submission_results;

create policy academy_submission_results_student_read
on public.academy_submission_results
for select to authenticated
using (
  student_id = auth.uid()
  or public.academy_is_teacher()
  or public.academy_is_admin()
);

drop policy if exists academy_submission_results_teacher_write
on public.academy_submission_results;

create policy academy_submission_results_teacher_write
on public.academy_submission_results
for insert to authenticated
with check (
  public.academy_is_teacher()
  or public.academy_is_admin()
);

drop policy if exists academy_submission_results_teacher_update
on public.academy_submission_results;

create policy academy_submission_results_teacher_update
on public.academy_submission_results
for update to authenticated
using (
  public.academy_is_teacher()
  or public.academy_is_admin()
)
with check (
  public.academy_is_teacher()
  or public.academy_is_admin()
);

drop policy if exists academy_submission_events_student_read
on public.academy_submission_events;

create policy academy_submission_events_student_read
on public.academy_submission_events
for select to authenticated
using (
  exists (
    select 1
    from public.academy_submissions s
    where s.id = submission_id
      and s.student_id = auth.uid()
  )
  or public.academy_is_teacher()
  or public.academy_is_admin()
);