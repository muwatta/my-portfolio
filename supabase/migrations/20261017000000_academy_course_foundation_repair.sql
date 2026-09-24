-- Phase 2: Course foundation — race-safe "exactly one active course per student"
-- + verified course metadata for both published curriculum paths.
--
-- Why a partial unique index instead of a BEFORE trigger:
-- A BEFORE trigger that checks for another active enrollment is not race-safe under
-- PostgreSQL's default READ COMMITTED isolation: two concurrent inserts can both pass
-- the check and commit, leaving a student with two active courses.
--
-- A partial unique index (student_id) where status = 'active' makes the constraint
-- atomic at storage level, so exactly one active enrollment per student is enforced
-- by the database regardless of concurrency. The existing BEFORE trigger is kept for
-- fast user-facing errors, but the index is the source of truth.
--
-- Both courses are programming courses. The index intentionally applies to active
-- enrollments of any course so the "one active path" rule covers all families.

-- 1. Clean up any existing rows that would violate the new constraint BEFORE the
--    index is created. The cleanup is deterministic: for each student, keep the
--    single most recently enrolled active enrollment and withdraw the others in
--    reverse-enrolled order. Idempotent for re-runs.
with ranked as (
  select
    e.id,
    e.student_id,
    row_number() over (
      partition by e.student_id
      order by e.enrolled_at desc, e.id desc
    ) as rn
  from public.academy_enrollments e
  where e.status = 'active'
)
update public.academy_enrollments e
set status = 'withdrawn'
from ranked r
where e.id = r.id
  and r.rn > 1;

-- 2. Add a partial unique index enforcing "one active course per student".
--    The predicate matches the existing status values that count as an open path
--    (active only; paused does not count as an open course).
do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'academy_enrollments_one_active_per_student_idx'
  ) then
    create unique index academy_enrollments_one_active_per_student_idx
      on public.academy_enrollments (student_id)
      where status = 'active';
  end if;
end;
$$;

-- 3. Course metadata: mark both published curriculum paths as programming courses
--    and give them deterministic sort order. Covers re-runs after the manual
--    curriculum migrations.
update public.academy_courses
set
  is_programming_course = true,
  course_family = 'programming',
  is_active = true,
  sort_order = case
    when slug = 'python-for-ai-machine-learning' then 1
    when slug = 'cpp-embedded-robotics' then 2
    else sort_order
  end
where slug in ('python-for-ai-machine-learning', 'cpp-embedded-robotics');

-- 4. Ensure the two courses map to the right subject so the foundation join
--    (python -> courses via subjects) holds.
with subject_map(slug, subject_slug) as (
  values
    ('python-for-ai-machine-learning', 'python'),
    ('cpp-embedded-robotics', 'cpp')
)
update public.academy_courses c
set subject_id = s.id
from subject_map m
join public.academy_subjects s on s.slug = m.subject_slug
where c.slug = m.slug and c.subject_id is distinct from s.id;
