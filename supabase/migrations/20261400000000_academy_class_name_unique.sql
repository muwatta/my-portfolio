-- Prevent duplicate class names within the same course, while cleaning up any
-- existing duplicates that were created before this guard existed.

with ranked as (
  select
    c.id,
    row_number() over (
      partition by c.course_id, lower(trim(regexp_replace(c.name, '\s+', ' ', 'g')))
      order by c.created_at asc, c.id asc
    ) as rn
  from public.academy_classes c
)
delete from public.academy_classes c
using ranked r
where c.id = r.id
  and r.rn > 1;

create unique index if not exists academy_classes_course_name_key
  on public.academy_classes (course_id, lower(trim(regexp_replace(name, '\s+', ' ', 'g'))));
