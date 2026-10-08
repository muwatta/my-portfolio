create table if not exists public.academy_practice_sessions (
  id uuid primary key,
  student_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.academy_lessons(id) on delete cascade,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, student_id, lesson_id)
);

alter table public.academy_exercises
  add column if not exists practice_session_id uuid
    references public.academy_practice_sessions(id) on delete cascade,
  add column if not exists practice_question_number smallint;

create unique index if not exists academy_exercises_practice_session_question_idx
  on public.academy_exercises (practice_session_id, practice_question_number)
  where practice_session_id is not null;

create index if not exists academy_practice_sessions_student_lesson_idx
  on public.academy_practice_sessions (student_id, lesson_id, completed_at);

alter table public.academy_practice_sessions enable row level security;

drop policy if exists academy_practice_sessions_student_read
  on public.academy_practice_sessions;
create policy academy_practice_sessions_student_read
  on public.academy_practice_sessions
  for select to authenticated
  using (student_id = auth.uid() or public.academy_is_teacher());

revoke all on public.academy_practice_sessions from anon, authenticated;
grant select on public.academy_practice_sessions to authenticated;
grant select (practice_session_id, practice_question_number)
  on public.academy_exercises to authenticated;

drop policy if exists academy_exercises_read on public.academy_exercises;
create policy academy_exercises_read on public.academy_exercises
  for select to authenticated using (
    public.academy_is_teacher()
    or (
      status = 'published'
      and (release_at is null or release_at <= now())
      and exists (
        select 1
        from public.academy_lessons lesson
        where lesson.id = academy_exercises.lesson_id
          and lesson.status = 'published'
          and (lesson.release_at is null or lesson.release_at <= now())
          and public.academy_lesson_is_unlocked_for_student(auth.uid(), lesson.id)
      )
      and (
        academy_exercises.practice_session_id is null
        or exists (
          select 1
          from public.academy_practice_sessions practice_session
          where practice_session.id = academy_exercises.practice_session_id
            and practice_session.lesson_id = academy_exercises.lesson_id
            and practice_session.student_id = auth.uid()
        )
      )
    )
  );

create or replace function public.academy_practice_session_attempt_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_session_id uuid;
  target_lesson_id uuid;
  question_count integer;
begin
  select exercise.practice_session_id, exercise.lesson_id
    into target_session_id, target_lesson_id
  from public.academy_exercises exercise
  where exercise.id = new.exercise_id;

  if target_session_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.academy_practice_sessions practice_session
    where practice_session.id = target_session_id
      and practice_session.student_id = new.student_id
      and practice_session.lesson_id = target_lesson_id
  ) then
    raise exception 'This practice question does not belong to your session.';
  end if;

  if new.passed > 0 then
    select count(*) into question_count
    from public.academy_exercises question
    where question.practice_session_id = target_session_id;

    if question_count <> 5 then
      return new;
    end if;

    update public.academy_practice_sessions practice_session
    set completed_at = now()
    where practice_session.id = target_session_id
      and practice_session.student_id = new.student_id
      and practice_session.completed_at is null
      and not exists (
        select 1
        from public.academy_exercises question
        where question.practice_session_id = target_session_id
          and not exists (
            select 1
            from public.academy_exercise_attempts attempt
            where attempt.exercise_id = question.id
              and attempt.student_id = new.student_id
              and attempt.passed > 0
          )
      );
  end if;

  return new;
end;
$$;

drop trigger if exists academy_practice_session_attempt_guard
  on public.academy_exercise_attempts;
create trigger academy_practice_session_attempt_guard
  after insert on public.academy_exercise_attempts
  for each row execute function public.academy_practice_session_attempt_guard();
revoke execute on function public.academy_practice_session_attempt_guard()
  from public, anon, authenticated;

create or replace function public.academy_lesson_required_activities_complete(
  target_student_id uuid,
  target_lesson_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_student_id is not null
    and target_lesson_id is not null
    and not exists (
      select 1
      from public.academy_lesson_activities activity
      where activity.lesson_id = target_lesson_id
        and activity.required_for_completion
        and activity.status = 'published'
        and (activity.release_at is null or activity.release_at <= now())
        and (
          (
            activity.kind = 'practice'
            and exists (
              select 1
              from public.academy_exercises exercise
              where exercise.id = activity.ref_id
                and exercise.published
                and exercise.status = 'published'
                and (exercise.release_at is null or exercise.release_at <= now())
            )
            -- A completed generated set satisfies the lesson's practice requirement.
            and not exists (
              select 1
              from public.academy_practice_sessions practice_session
              where practice_session.student_id = target_student_id
                and practice_session.lesson_id = target_lesson_id
                and practice_session.completed_at is not null
            )
            and not exists (
              select 1
              from public.academy_exercise_attempts attempt
              where attempt.exercise_id = activity.ref_id
                and attempt.student_id = target_student_id
                and attempt.passed > 0
            )
          )
          or (
            activity.kind = 'assignment'
            and exists (
              select 1
              from public.academy_assignments assignment
              where assignment.id = activity.ref_id
                and assignment.published
                and not assignment.is_draft
                and assignment.status = 'published'
                and (assignment.release_at is null or assignment.release_at <= now())
            )
            and not exists (
              select 1
              from public.academy_submissions submission
              where submission.assignment_id = activity.ref_id
                and submission.student_id = target_student_id
            )
          )
        )
    );
$$;

revoke execute on function public.academy_lesson_required_activities_complete(uuid, uuid)
  from public, anon, authenticated;

create or replace function public.academy_staff_exercise_list()
returns table (
  id uuid,
  lesson_id uuid,
  title text,
  instructions text,
  starter_code text,
  difficulty text,
  expected_concepts text[],
  hints text[],
  tests jsonb,
  solution_code text,
  explanation text,
  question_type text,
  choices jsonb,
  correct_answer text,
  attempt_limit smallint,
  published boolean,
  sort_order integer,
  updated_at timestamptz,
  lesson_title text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (public.academy_is_admin() or public.academy_is_teacher()) then
    raise exception 'Academy staff access required to view exercise answer keys.';
  end if;

  return query
  select
    exercise.id,
    exercise.lesson_id,
    exercise.title,
    exercise.instructions,
    exercise.starter_code,
    exercise.difficulty,
    exercise.expected_concepts,
    exercise.hints,
    exercise.tests,
    exercise.solution_code,
    exercise.explanation,
    exercise.question_type,
    exercise.choices,
    exercise.correct_answer,
    exercise.attempt_limit,
    exercise.published,
    exercise.sort_order,
    exercise.updated_at,
    lesson.title
  from public.academy_exercises exercise
  left join public.academy_lessons lesson on lesson.id = exercise.lesson_id
  where exercise.practice_session_id is null
  order by exercise.title;
end;
$$;

revoke execute on function public.academy_staff_exercise_list() from public, anon;
grant execute on function public.academy_staff_exercise_list() to authenticated;
notify pgrst, 'reload schema';
