-- Application contracts for course selection, official assignment, and grading.

create or replace function public.academy_select_course(
  target_student_id uuid,
  target_course_id uuid
)
returns public.academy_enrollments
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_enrollment public.academy_enrollments;
begin
  if auth.uid() <> target_student_id then
    raise exception 'Students may only select a course for themselves.';
  end if;
  if not exists (select 1 from public.academy_profiles where id = target_student_id and role = 'student') then
    raise exception 'Only student profiles can select a course.';
  end if;
  if not exists (select 1 from public.academy_courses where id = target_course_id and published and is_active) then
    raise exception 'Course is not available.';
  end if;

  update public.academy_enrollments
  set status = 'completed'
  where student_id = target_student_id and status = 'active' and course_id <> target_course_id;

  insert into public.academy_enrollments (student_id, course_id, status)
  values (target_student_id, target_course_id, 'active')
  on conflict (student_id, course_id) do update set status = 'active';

  select * into selected_enrollment from public.academy_enrollments
  where student_id = target_student_id and course_id = target_course_id;
  return selected_enrollment;
end;
$$;

create or replace function public.academy_assign_student_course(
  target_student_id uuid,
  target_course_id uuid
)
returns public.academy_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  assigned_profile public.academy_profiles;
begin
  if not public.academy_is_teacher() and not public.academy_is_admin() then
    raise exception 'Only teachers and admins can assign courses.';
  end if;
  if target_course_id is not null and not exists (select 1 from public.academy_courses where id = target_course_id and is_active) then
    raise exception 'Course is not available.';
  end if;

  update public.academy_enrollments set status = 'completed'
  where student_id = target_student_id and status = 'active';
  if target_course_id is not null then
    insert into public.academy_enrollments (student_id, course_id, status)
    values (target_student_id, target_course_id, 'active')
    on conflict (student_id, course_id) do update set status = 'active';
  end if;

  update public.academy_profiles set current_course_id = target_course_id
  where id = target_student_id returning * into assigned_profile;
  return assigned_profile;
end;
$$;

create or replace function public.academy_grade_submission(
  target_submission_id uuid,
  target_objective_score numeric,
  target_final_score numeric,
  target_teacher_feedback text,
  target_ai_feedback text,
  target_ai_feedback_status text
)
returns public.academy_submission_results
language plpgsql
security definer
set search_path = public
as $$
declare
  result_row public.academy_submission_results;
  submission_row public.academy_submissions;
begin
  if not public.academy_is_teacher() and not public.academy_is_admin() then
    raise exception 'Only teachers and admins can grade submissions.';
  end if;
  select * into submission_row from public.academy_submissions where id = target_submission_id;
  if submission_row.id is null then raise exception 'Submission not found.'; end if;

  insert into public.academy_submission_results (
    submission_id, assignment_id, student_id, objective_score, objective_status,
     final_score, score, max_score, teacher_feedback, ai_feedback, ai_feedback_status
  ) values (
    submission_row.id, submission_row.assignment_id, submission_row.student_id,
    target_objective_score,
    case when target_objective_score >= 70 then 'passed' when target_objective_score > 0 then 'partial' else 'failed' end,
    target_final_score, coalesce(target_final_score, target_objective_score), 100, target_teacher_feedback,
    case when target_ai_feedback is null then null else to_jsonb(target_ai_feedback) end,
    target_ai_feedback_status
  ) on conflict (submission_id) do update set
    objective_score = excluded.objective_score, objective_status = excluded.objective_status,
     final_score = excluded.final_score, score = excluded.score, max_score = excluded.max_score, teacher_feedback = excluded.teacher_feedback,
    ai_feedback = excluded.ai_feedback, ai_feedback_status = excluded.ai_feedback_status,
    updated_at = now()
  returning * into result_row;

  update public.academy_submissions set status = 'graded' where id = submission_row.id;
  insert into public.academy_submission_events (submission_id, event_type, payload)
  values (submission_row.id, 'scored', jsonb_build_object('objective_score', target_objective_score));
  return result_row;
end;
$$;

revoke execute on function public.academy_select_course(uuid, uuid) from public, anon;
grant execute on function public.academy_select_course(uuid, uuid) to authenticated;
revoke execute on function public.academy_assign_student_course(uuid, uuid) from public, anon;
grant execute on function public.academy_assign_student_course(uuid, uuid) to authenticated;
revoke execute on function public.academy_grade_submission(uuid, numeric, numeric, text, text, text) from public, anon;
grant execute on function public.academy_grade_submission(uuid, numeric, numeric, text, text, text) to authenticated;

revoke update (student_level, current_course_id, role) on public.academy_profiles from authenticated;

do $$
begin
  begin alter publication supabase_realtime add table public.academy_leaderboard_points; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.academy_activity_feed; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.academy_live_messages; exception when duplicate_object then null; end;
end;
$$;