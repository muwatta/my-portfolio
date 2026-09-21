-- Award progression only from database-recorded activity.
create or replace function public.academy_award_lesson_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.completed_at is not null and (old.completed_at is null or old.completed_at is distinct from new.completed_at) then
    perform public.academy_award_verified_activity(new.student_id, 'lesson', new.lesson_id, 10, 'first-lesson');
  end if;
  return new;
end;
$$;

drop trigger if exists academy_lesson_points on public.academy_lesson_progress;
create trigger academy_lesson_points
after insert or update on public.academy_lesson_progress
for each row execute procedure public.academy_award_lesson_points();

create or replace function public.academy_award_practice_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.passed > 0 then
    perform public.academy_award_verified_activity(new.student_id, 'practice', new.id, 5, 'first-practice');
  end if;
  return new;
end;
$$;

drop trigger if exists academy_practice_points on public.academy_exercise_attempts;
create trigger academy_practice_points
after insert on public.academy_exercise_attempts
for each row execute procedure public.academy_award_practice_points();
