create or replace function public.academy_grading_filters()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.academy_can_grade() then
    raise exception 'Superadmin or appointed grader access required.' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'courses', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'title', c.title) order by c.title)
      from public.academy_courses c
    ), '[]'::jsonb),
    'topics', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', l.id, 'title', l.title,
        'academy_weeks', jsonb_build_object(
          'title', w.title, 'week_number', w.week_number,
          'academy_courses', jsonb_build_object('id', c.id, 'title', c.title)
        )
      ) order by c.title, w.week_number, l.lesson_number)
      from public.academy_lessons l
      join public.academy_weeks w on w.id = l.week_id
      join public.academy_courses c on c.id = w.course_id
    ), '[]'::jsonb),
    'students', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'display_name', coalesce(nullif(btrim(p.display_name), ''), split_part(coalesce(u.email, ''), '@', 1), 'Student')
      ) order by coalesce(nullif(btrim(p.display_name), ''), u.email))
      from public.academy_profiles p
      join auth.users u on u.id = p.id
      where exists (select 1 from public.academy_submissions s where s.student_id = p.id)
    ), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.academy_grading_filters() from public, anon;
grant execute on function public.academy_grading_filters() to authenticated;
notify pgrst, 'reload schema';
