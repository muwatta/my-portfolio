create or replace function public.academy_weekly_leaderboard(p_period_id uuid default null)
returns table (
  student_id uuid,
  display_name text,
  points bigint,
  rank bigint
)
language sql
security definer
set search_path = public
as $$
  with standings as (
    select
      points.student_id,
      profiles.display_name,
      sum(points.points) as points
    from public.academy_leaderboard_points points
    join public.academy_profiles profiles on profiles.id = points.student_id
    where points.verification_status = 'verified'
      and points.period_id = coalesce(
        p_period_id,
        (
          select id
          from public.academy_leaderboard_periods
          where status = 'active'
          order by starts_at desc
          limit 1
        )
      )
      and profiles.role = 'student'
    group by points.student_id, profiles.display_name
  ),
  ranked as (
    select
      standings.student_id,
      standings.display_name,
      standings.points::bigint as points,
      row_number() over (
        order by standings.points desc, standings.student_id
      )::bigint as rank
    from standings
  )
  select ranked.student_id, ranked.display_name, ranked.points, ranked.rank
  from ranked
  where ranked.rank <= 10
  order by ranked.rank;
$$;

revoke execute on function public.academy_weekly_leaderboard(uuid)
  from public, anon;
grant execute on function public.academy_weekly_leaderboard(uuid)
  to authenticated;

update public.academy_assignments assignment
set title = 'C++ Week 9: average two distances',
    instructions = 'Read two distance readings and print their average to two decimal places. Use the starter code to focus on the calculation and output.',
    starter_code = E'#include <iomanip>\n#include <iostream>\nusing namespace std;\n\nint main() {\n    double first = 0;\n    double second = 0;\n    cin >> first >> second;\n    // TODO: calculate and print the average to two decimal places\n    return 0;\n}',
    automated_tests = E'[{"name":"averages two readings","input":["10","30"],"expected":"20.00"},{"name":"works with another pair","input":["20","50"],"expected":"35.00"}]'::jsonb,
    updated_at = now()
from public.academy_courses course
where assignment.course_id = course.id
  and course.slug = 'cpp-embedded-robotics'
  and assignment.title = 'C++ Week 9: average five distances';

update public.academy_assignments assignment
set instructions = 'Print the motor speed values 0, 50, 100, 150, 200, and 250, one value per line. Use one simple loop. The motor must not go above 250.',
    updated_at = now()
from public.academy_courses course
where assignment.course_id = course.id
  and course.slug = 'cpp-embedded-robotics'
  and assignment.title = 'C++ Week 10: a safe motor ramp';

notify pgrst, 'reload schema';
