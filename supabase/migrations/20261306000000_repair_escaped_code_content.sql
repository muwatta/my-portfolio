-- Nearly half the C++ code examples were stored with the two characters \ and n
-- instead of a real newline, so they were a single long line and could never run.
-- 48 of 88 code blocks in the C++ course were affected; the Python course has 2
-- out of 131, so this is specific to how the C++ content was seeded.
--
-- A student opening "Level 3: Decision Making" saw one unbroken line of text where
-- a program should be, and the Run button either refused it or produced nonsense.
-- Unescaping is the whole fix: the code itself was correct.
--
-- The replacement is deliberately narrow. In a plain SQL string, '\n' is a
-- backslash followed by n, and E'\n' is an actual newline, so the pair of them
-- swaps exactly the broken encoding for the correct one and leaves every other
-- character, including a legitimate backslash elsewhere in a string literal,
-- untouched.

create or replace function public.academy_unescape_code_text(value text)
returns text
language sql
immutable
as $$
  select replace(value, '\n', E'\n');
$$;

-- examples is an array of strings; starter_code is a single string.
with repaired as (
  select
    l.id,
    case
      when jsonb_typeof(l.content->'examples') = 'array' then
        (select coalesce(jsonb_agg(
                  public.academy_unescape_code_text(item.value)
                  order by item.ordinality
                ), '[]'::jsonb)
         from jsonb_array_elements_text(l.content->'examples')
              with ordinality as item(value, ordinality))
      else l.content->'examples'
    end as examples,
    public.academy_unescape_code_text(l.content->>'starter_code') as starter_code
  from public.academy_lessons l
  where l.content ? 'examples' or l.content ? 'starter_code'
)
update public.academy_lessons l
set content = l.content
  || jsonb_strip_nulls(jsonb_build_object(
       'examples', case when r.examples is not null then r.examples else null end,
       'starter_code', r.starter_code
     )),
    updated_at = now()
from repaired r
where r.id = l.id
  and l.content is distinct from
      l.content || jsonb_strip_nulls(jsonb_build_object(
        'examples', case when r.examples is not null then r.examples else null end,
        'starter_code', r.starter_code
      ));

drop function public.academy_unescape_code_text(text);
