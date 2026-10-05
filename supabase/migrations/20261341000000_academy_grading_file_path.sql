-- Include private attachment paths in the teacher-only grading queue so the
-- application can create short-lived signed links and request staff-side AI
-- grading without exposing storage objects publicly.

create or replace function public.academy_grading_queue(
  p_course_id uuid default null,
  p_topic_id uuid default null,
  p_student_id uuid default null,
  p_review_state text default null
)
returns setof jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.academy_is_teacher() then
    raise exception 'Teacher access required.' using errcode = '42501';
  end if;

  return query
  select jsonb_build_object(
    'submission_id', s.id,
    'assignment_id', s.assignment_id,
    'assignment_title', a.title,
    'lesson_id', a.lesson_id,
    'lesson_title', l.title,
    'course_id', coalesce(a.course_id, w.course_id),
    'course_title', c.title,
    'student_id', s.student_id,
    'student_name', coalesce(
      nullif(btrim(p.display_name), ''),
      split_part(coalesce(u.email, ''), '@', 1),
      'Student'
    ),
    'student_email', u.email,
    'attempt_number', s.attempt_number,
    'submission_status', s.status,
    'submitted_at', s.submitted_at,
    'source_code', s.source_code,
    'file_path', s.file_path,
    'original_filename', s.original_filename,
    'file_size_bytes', s.file_size_bytes,
    'grading_error', s.grading_error,
    'objective_score', r.objective_score,
    'objective_status', r.objective_status,
    'client_ran_tests', r.deterministic_source = 'client_reported',
    'client_passed', case
      when r.deterministic_source = 'client_reported' and r.test_summary is not null
        then (r.test_summary ->> 'passed')::integer
      else null
    end,
    'client_total', case
      when r.deterministic_source = 'client_reported' and r.test_summary is not null
        then (r.test_summary ->> 'total')::integer
      else null
    end,
    'teacher_score', r.teacher_score,
    'final_score', r.final_score,
    'max_score', coalesce(nullif(r.max_score, 0), a.points, 100),
    'rubric', a.rubric,
    'teacher_feedback', r.teacher_feedback,
    'rubric_feedback', r.rubric_feedback,
    'ai_feedback_status', r.ai_feedback_status,
    'review_state', coalesce(r.review_state, 'unreviewed'),
    'updated_at', greatest(coalesce(r.updated_at, r.created_at), s.submitted_at)
  )
  from public.academy_submissions s
  join public.academy_assignments a on a.id = s.assignment_id
  left join public.academy_lessons l on l.id = a.lesson_id
  left join public.academy_weeks w on w.id = l.week_id
  left join public.academy_courses c on c.id = coalesce(a.course_id, w.course_id)
  left join public.academy_submission_results r on r.submission_id = s.id
  left join public.academy_profiles p on p.id = s.student_id
  left join auth.users u on u.id = s.student_id
  where (p_course_id is null or coalesce(a.course_id, w.course_id) = p_course_id)
    and (p_topic_id is null or a.lesson_id = p_topic_id)
    and (p_student_id is null or s.student_id = p_student_id)
    and (
      p_review_state is null
      or coalesce(r.review_state, 'unreviewed') = p_review_state
    )
  order by greatest(coalesce(r.updated_at, r.created_at), s.submitted_at) desc;
end;
$$;

revoke execute on function public.academy_grading_queue(uuid, uuid, uuid, text) from public, anon;
grant execute on function public.academy_grading_queue(uuid, uuid, uuid, text) to authenticated;

notify pgrst, 'reload schema';
