update public.academy_courses
set title = replace(title, '—', '-'),
    description = replace(description, '—', '-')
where title like '%—%' or description like '%—%';

update public.academy_weeks
set title = replace(title, '—', '-'),
    description = replace(description, '—', '-')
where title like '%—%' or description like '%—%';

update public.academy_lessons
set title = replace(title, '—', '-'),
    objectives = array(
      select replace(value, '—', '-')
      from unnest(objectives) as item(value)
    ),
    content = replace(content::text, '—', '-')::jsonb
where title like '%—%'
   or objectives::text like '%—%'
   or content::text like '%—%';

update public.academy_exercises
set title = replace(title, '—', '-'),
    instructions = replace(instructions, '—', '-'),
    starter_code = replace(starter_code, '—', '-'),
    expected_concepts = array(
      select replace(value, '—', '-')
      from unnest(expected_concepts) as item(value)
    ),
    hints = array(
      select replace(value, '—', '-')
      from unnest(hints) as item(value)
    ),
    explanation = replace(explanation, '—', '-'),
    solution_code = replace(solution_code, '—', '-')
where title like '%—%'
   or instructions like '%—%'
   or starter_code like '%—%'
   or expected_concepts::text like '%—%'
   or hints::text like '%—%'
   or explanation like '%—%'
   or solution_code like '%—%';
