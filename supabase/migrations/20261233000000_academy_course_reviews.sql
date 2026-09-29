-- Let students review and rate a course, and see everyone else's in real time.
--
-- There was no way to leave any feedback at all, so the only signal a teacher
-- had about how a course landed was a grade.
--
-- One review per person per course, enforced by a unique index rather than by
-- whichever screen happened to check. That matters for the offline queue too:
-- a retry after reconnecting must update the existing review, not fail.
--
-- Added to the realtime publication so a rating appears for everyone else as
-- soon as it is written, instead of on their next page load.

create table if not exists public.academy_course_reviews (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.academy_courses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  body text not null default '' check (char_length(body) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists academy_course_reviews_once_per_user
  on public.academy_course_reviews (course_id, user_id);

create index if not exists academy_course_reviews_course_idx
  on public.academy_course_reviews (course_id, created_at desc);

alter table public.academy_course_reviews enable row level security;

-- Everyone signed in can read reviews. Feedback is not private, and hiding it
-- would make the page look empty and hide the very thing being collected.
drop policy if exists academy_course_reviews_read on public.academy_course_reviews;
create policy academy_course_reviews_read
  on public.academy_course_reviews
  for select to authenticated
  using (true);

-- A review can only ever be written as yourself. The rating is the only thing
-- a student is allowed to speak for.
drop policy if exists academy_course_reviews_self_write on public.academy_course_reviews;
create policy academy_course_reviews_self_write
  on public.academy_course_reviews
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists academy_course_reviews_self_update on public.academy_course_reviews;
create policy academy_course_reviews_self_update
  on public.academy_course_reviews
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- You can take your own back. Teachers can remove anything.
drop policy if exists academy_course_reviews_delete on public.academy_course_reviews;
create policy academy_course_reviews_delete
  on public.academy_course_reviews
  for delete to authenticated
  using (user_id = auth.uid() or public.academy_is_teacher());

-- The rating summary below filters unpublished courses, so a draft course
-- cannot attract reviews through the summary even though the rows are readable.

-- Averages, computed in one round trip so a list of courses does not turn into
-- a query per row.
create or replace function public.academy_course_rating_summary()
returns table (
  course_id uuid,
  average_rating numeric,
  review_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    reviews.course_id,
    round(avg(reviews.rating)::numeric, 2),
    count(*)
  from public.academy_course_reviews reviews
  where exists (
    select 1 from public.academy_courses c
     where c.id = reviews.course_id and (c.published or public.academy_is_teacher())
  )
  group by reviews.course_id;
$$;

revoke execute on function public.academy_course_rating_summary() from public, anon;
grant execute on function public.academy_course_rating_summary() to authenticated;

-- Adding a table to a publication that already has it raises, so the
-- duplicate is caught rather than failing the whole migration.
do $$
begin
  begin
    alter publication supabase_realtime add table public.academy_course_reviews;
  exception when duplicate_object then null;
  end;
end;
$$;

notify pgrst, 'reload schema';
