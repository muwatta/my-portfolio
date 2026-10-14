create or replace function public.academy_require_prior_cpp_assignments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_course_id uuid;
  target_week_number integer;
  target_language text;
begin
  if auth.uid() is null
     or new.student_id <> auth.uid()
     or public.academy_is_teacher()
     or public.academy_is_admin()
  then
    return new;
  end if;

  select assignment.course_id, week.week_number, course.language
    into target_course_id, target_week_number, target_language
    from public.academy_assignments assignment
    join public.academy_courses course on course.id = assignment.course_id
    left join public.academy_weeks week on week.id = assignment.week_id
   where assignment.id = new.assignment_id;

  if target_language <> 'cpp' or target_week_number is null then
    return new;
  end if;

  if exists (
    select 1
      from public.academy_assignments prior
      join public.academy_weeks prior_week on prior_week.id = prior.week_id
     where prior.course_id = target_course_id
       and prior_week.week_number < target_week_number
       and prior.published
       and not prior.is_draft
       and prior.status = 'published'
       and (prior.release_at is null or prior.release_at <= now())
       and not exists (
         select 1
           from public.academy_submissions submission
           join public.academy_submission_results result
             on result.submission_id = submission.id
          where submission.assignment_id = prior.id
            and submission.student_id = new.student_id
            and submission.status = 'graded'
            and result.final_score is not null
       )
  ) then
    raise exception 'The previous C++ week assignment must be marked before starting this one.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke execute on function public.academy_require_prior_cpp_assignments()
  from public, anon, authenticated;

drop trigger if exists academy_require_prior_cpp_assignments
  on public.academy_submissions;
create trigger academy_require_prior_cpp_assignments
  before insert on public.academy_submissions
  for each row execute function public.academy_require_prior_cpp_assignments();

notify pgrst, 'reload schema';
