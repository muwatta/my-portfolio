-- Assessment engine: schema.
--
-- Reuses the existing Academy rather than creating a parallel system. Subject
-- comes from academy_subjects, class from academy_classes and
-- academy_class_members, level from academy_levels, and every permission check
-- goes through academy_is_teacher / academy_is_admin / academy_is_class_member.
-- There is no second auth system and no second class list.
--
-- The question bank is deliberately not academy_exercises. Exercises are
-- lesson scoped, their difficulty is limited to beginner, developing and
-- challenge, and each one already owns an attempt limit, a grade and a points
-- award, all of which would fight an examination's own deadline and attempt
-- rules. A teacher editing a lesson exercise would also silently change a
-- published examination. So exam questions are independent of lessons, which is
-- what section 4 asks for anyway.
--
-- Nothing here trusts the browser. Deadlines are computed in the database, the
-- correct answer never leaves it, and an attempt is only ever created or
-- answered through a security definer function that re-checks the rules.

-- ---------------------------------------------------------------- question bank

create table if not exists public.academy_exam_questions (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.academy_subjects(id) on delete cascade,
  topic text not null default '',
  difficulty text not null default 'easy'
    check (difficulty in ('easy', 'medium', 'hard')),
  -- Open ended on purpose: a new question type is a new value here plus a
  -- rendering branch, not a schema rewrite.
  question_type text not null default 'mcq'
    check (question_type in ('mcq', 'true_false')),
  prompt text not null,
  -- [{ "key": "A", "label": "function" }, ...] so option order can be shuffled
  -- per attempt without changing the stored answer.
  options jsonb not null default '[]'::jsonb,
  correct_key text,
  explanation text,
  marks numeric(6,2) not null default 1 check (marks > 0),
  status text not null default 'active'
    check (status in ('draft', 'active', 'archived')),
  -- md5 of the normalised prompt, so a re-import of the same file is detected
  -- rather than silently doubling the bank.
  fingerprint text,
  source_import_id uuid,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint academy_exam_questions_options_ck
    check (jsonb_typeof(options) = 'array'),
  constraint academy_exam_questions_mcq_ck
    check (question_type <> 'mcq' or jsonb_array_length(options) between 2 and 8),
  constraint academy_exam_questions_true_false_ck
    check (
      question_type <> 'true_false'
      or jsonb_array_length(options) = 2
    )
);

create unique index if not exists academy_exam_questions_fingerprint_key
  on public.academy_exam_questions (fingerprint)
  where fingerprint is not null and status <> 'archived';

create index if not exists academy_exam_questions_pool_idx
  on public.academy_exam_questions (subject_id, status, difficulty, question_type);

-- ------------------------------------------------------------------- the exam

create table if not exists public.academy_exams (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subject_id uuid references public.academy_subjects(id) on delete set null,
  class_id uuid references public.academy_classes(id) on delete set null,
  level_id uuid references public.academy_levels(id) on delete set null,
  instructions text not null default '',
  -- Per examination, because a Python paper and a Robotics paper are not the
  -- same length. Section 1 is explicit that this must not be global.
  duration_minutes integer not null check (duration_minutes between 1 and 600),
  starts_at timestamptz not null,
  ends_at timestamptz,
  pass_mark numeric(6,2),
  randomize_questions boolean not null default false,
  randomize_options boolean not null default false,
  allow_review boolean not null default true,
  allow_early_submit boolean not null default true,
  results_published boolean not null default false,
  max_attempts integer not null default 1 check (max_attempts between 1 and 20),
  status text not null default 'draft'
    check (status in (
      'draft', 'scheduled', 'active', 'closed',
      'graded', 'results_published', 'archived'
    )),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint academy_exams_window_ck
    check (ends_at is null or ends_at > starts_at),
  constraint academy_exams_published_needs_window_ck
    check (status = 'draft' or starts_at is not null)
);

create index if not exists academy_exams_live_idx
  on public.academy_exams (status, starts_at, ends_at);

create index if not exists academy_exams_class_idx
  on public.academy_exams (class_id, starts_at desc);

-- ------------------------------------------------- exam to question, with a copy
--
-- The snapshot is the point of section 4: editing a question in the bank later
-- must not change an examination that already exists. Grading reads the
-- snapshot, never the live row, so a teacher can fix a typo in the bank without
-- invalidating a paper a student has already sat.

create table if not exists public.academy_exam_question_links (
  exam_id uuid not null references public.academy_exams(id) on delete cascade,
  question_id uuid not null references public.academy_exam_questions(id) on delete restrict,
  position integer not null check (position > 0),
  marks numeric(6,2) not null check (marks > 0),
  snapshot jsonb not null,
  primary key (exam_id, question_id),
  unique (exam_id, position)
);

-- ------------------------------------------------------------------- attempts

create table if not exists public.academy_exam_attempts (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.academy_exams(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  attempt_number integer not null check (attempt_number > 0),
  started_at timestamptz not null default now(),
  -- Set once, by the database, at the moment the attempt is created. The
  -- browser is told this value and counts down from it, but never supplies it.
  deadline_at timestamptz not null,
  submitted_at timestamptz,
  submit_reason text check (submit_reason in ('student', 'timeout', 'admin')),
  -- The student's own clock at submission, kept for the record so an offline
  -- finish is not mistaken for a late one, and never used to decide validity.
  client_submitted_at timestamptz,
  synced_at timestamptz,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'submitted', 'graded')),
  -- Fixes the order for this attempt. Derived once and stored, so a refresh or
  -- a reconnect shows the same paper rather than a new shuffle.
  random_seed bigint not null,
  score numeric(8,2),
  total_marks numeric(8,2),
  correct_count integer,
  incorrect_count integer,
  unanswered_count integer,
  percentage numeric(5,2),
  graded_at timestamptz,

  constraint academy_exam_attempts_number_key unique (exam_id, student_id, attempt_number)
);

-- Two live attempts on one exam is never valid, whatever max_attempts says.
-- The attempt limit is about sequential retries, not parallel ones. A plain
-- unique (exam_id, student_id) would wrongly stop a permitted second attempt
-- once the first is graded, so this only covers attempts still in progress, and
-- it is in the database because a second browser tab would otherwise sail past
-- an application level check.
create unique index if not exists academy_exam_attempts_one_live_idx
  on public.academy_exam_attempts (exam_id, student_id)
  where status = 'in_progress';

create index if not exists academy_exam_attempts_exam_idx
  on public.academy_exam_attempts (exam_id, submitted_at desc);

create index if not exists academy_exam_attempts_student_idx
  on public.academy_exam_attempts (student_id, started_at desc);

-- ------------------------------------------------------------------- answers

create table if not exists public.academy_exam_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.academy_exam_attempts(id) on delete cascade,
  question_id uuid not null references public.academy_exam_questions(id) on delete restrict,
  selected_key text,
  is_correct boolean,
  marks_awarded numeric(6,2) not null default 0,
  -- When the student says they answered. Recorded for the audit trail and used
  -- only to resolve a sync conflict.
  client_answered_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);

create index if not exists academy_exam_answers_attempt_idx
  on public.academy_exam_answers (attempt_id);

-- ---------------------------------------------------------------- audit trail
--
-- Section 25. One row per meaningful event, no more. Not every keystroke.

create table if not exists public.academy_exam_events (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid references public.academy_exams(id) on delete cascade,
  attempt_id uuid references public.academy_exam_attempts(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  student_id uuid references auth.users(id) on delete set null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists academy_exam_events_exam_idx
  on public.academy_exam_events (exam_id, created_at desc);
