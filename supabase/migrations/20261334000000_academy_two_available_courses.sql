update public.academy_courses
set
  title = case slug
    when 'python-for-ai-machine-learning' then 'Python for AI and ML'
    when 'cpp-embedded-robotics' then 'C++ for Embedded Systems'
  end,
  published = true,
  is_active = true
where slug in (
  'python-for-ai-machine-learning',
  'cpp-embedded-robotics'
);

update public.academy_courses
set
  published = false,
  is_active = false
where slug not in (
  'python-for-ai-machine-learning',
  'cpp-embedded-robotics'
)
and (published or is_active);
