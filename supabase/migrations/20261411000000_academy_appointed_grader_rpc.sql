-- Appointed graders may review/publish, but do not receive curriculum-admin powers.
create or replace function public.academy_review_submission(
  p_submission_id uuid,
  p_teacher_score numeric,
  p_teacher_feedback text default null,
  p_rubric_feedback jsonb default null
)
returns public.academy_submission_results
language plpgsql
security definer
set search_path = public
as $$
declare
  assignment_points numeric;
  saved public.academy_submission_results;
begin
  if not public.academy_can_grade() then
    raise exception 'Superadmin or appointed grader access required.' using errcode = '42501';
  end if;

  select coalesce(a.points, 100) into assignment_points
    from public.academy_assignments a
    join public.academy_submissions s on s.assignment_id = a.id
   where s.id = p_submission_id;

  if assignment_points is null then
    raise exception 'Submission not found.' using errcode = 'P0002';
  end if;
  if p_teacher_score is null or p_teacher_score < 0 or p_teacher_score > assignment_points then
    raise exception 'The mark must be between 0 and %.', assignment_points using errcode = '22023';
  end if;

  insert into public.academy_submission_results (
    submission_id, assignment_id, student_id,
    teacher_score, final_score, score, max_score,
    teacher_feedback, rubric_feedback,
    reviewed_at, reviewed_by, review_state
  )
  select s.id, s.assignment_id, s.student_id,
         p_teacher_score, p_teacher_score, p_teacher_score, assignment_points,
         nullif(btrim(coalesce(p_teacher_feedback, '')), ''), p_rubric_feedback,
         now(), auth.uid(), 'reviewed'
    from public.academy_submissions s
   where s.id = p_submission_id
  on conflict (submission_id) do update
    set teacher_score = excluded.teacher_score,
        final_score = excluded.final_score,
        score = excluded.score,
        max_score = excluded.max_score,
        teacher_feedback = excluded.teacher_feedback,
        rubric_feedback = excluded.rubric_feedback,
        reviewed_at = now(),
        reviewed_by = auth.uid(),
        review_state = 'reviewed',
        updated_at = now()
  returning * into saved;

  insert into public.academy_submission_events (submission_id, event_type, payload)
  values (p_submission_id, 'teacher_reviewed',
          jsonb_build_object('score', p_teacher_score, 'max', assignment_points));
  return saved;
end;
$$;

create or replace function public.academy_publish_result(p_submission_id uuid)
returns public.academy_submission_results
language plpgsql
security definer
set search_path = public
as $$
declare
  saved public.academy_submission_results;
  student uuid;
  assignment_title text;
  scored numeric;
  maximum numeric;
  a_title text;
begin
  if not public.academy_can_grade() then
    raise exception 'Superadmin or appointed grader access required.' using errcode = '42501';
  end if;

  select r.student_id, r.final_score, r.max_score, a.title
    into student, scored, maximum, a_title
    from public.academy_submission_results r
    join public.academy_submissions s on s.id = r.submission_id
    join public.academy_assignments a on a.id = s.assignment_id
   where r.submission_id = p_submission_id
   for update of r;

  if student is null then
    raise exception 'Submission not found.' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.academy_submission_results
    where submission_id = p_submission_id and review_state in ('reviewed', 'published')
  ) then
    raise exception 'Review this submission before publishing it.' using errcode = '22023';
  end if;

  update public.academy_submission_results
     set review_state = 'published', published_at = now(),
         published_by = auth.uid(), updated_at = now()
   where submission_id = p_submission_id
  returning * into saved;

  update public.academy_submissions set status = 'graded' where id = p_submission_id;
  insert into public.academy_submission_events (submission_id, event_type, payload)
  values (p_submission_id, 'scored',
          jsonb_build_object('published', true, 'score', scored));

  insert into public.academy_notifications (user_id, type, title, message)
  values (student, 'feedback', 'Your mark for ' || assignment_title,
          'You scored ' || coalesce(scored::text, 'a mark') ||
            ' out of ' || coalesce(maximum::text, 'the maximum') || '. Open the task to read the feedback.');

  return saved;
end;
$$;
