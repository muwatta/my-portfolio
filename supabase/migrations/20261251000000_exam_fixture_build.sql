-- Fixture for the assessment engine, written so it never raises.
--
-- A migration that raises is never recorded in schema_migrations, so db push
-- retries it forever. Every earlier attempt at seeding did exactly that, which
-- is why the probe exam kept coming back as missing. This one is idempotent and
-- returns normally.
--
-- The account owner is identified by pinned id, never by an address comparison:
-- probing lower(email) on this database has returned contradictory results more
-- than once in this project.

do $$
declare
  owner_id uuid := '45501f33-911d-495b-a994-ba654683e521';
  sub_id uuid; cls_id uuid; ex_id uuid; q1 uuid; q2 uuid; st uuid;
begin
  select id into sub_id from public.academy_subjects where slug = 'probe-subject';
  if sub_id is null then
    insert into public.academy_subjects (slug, name) values ('probe-subject', 'Probe Subject')
    returning id into sub_id;
  end if;

  select id into cls_id from public.academy_classes where name = 'Probe Class';
  if cls_id is null then
    insert into public.academy_classes (course_id, name, created_by)
    select (select id from public.academy_courses limit 1), 'Probe Class', owner_id
    returning id into cls_id;
  end if;

  select id into st from public.academy_profiles p
   where p.role = 'student'
     and not exists (select 1 from public.academy_admins a where a.user_id = p.id)
   order by p.created_at limit 1;
  insert into public.academy_class_members (class_id, student_id)
  values (cls_id, st) on conflict do nothing;

  if not exists (select 1 from public.academy_exam_questions
                 where prompt = 'Which keyword defines a function?') then
    insert into public.academy_exam_questions
      (subject_id, topic, difficulty, question_type, prompt, options, correct_key, marks, created_by)
    values (sub_id, 'Basics', 'easy', 'mcq', 'Which keyword defines a function?',
            '[{"key":"A","label":"function"},{"key":"B","label":"def"},{"key":"C","label":"func"}]',
            'B', 1, owner_id)
    returning id into q1;
    insert into public.academy_exam_questions
      (subject_id, topic, difficulty, question_type, prompt, options, correct_key, marks, created_by)
    values (sub_id, 'Basics', 'easy', 'true_false', 'Python lists are mutable.',
            '[{"key":"A","label":"True"},{"key":"B","label":"False"}]',
            'A', 1, owner_id)
    returning id into q2;
  else
    select id into q1 from public.academy_exam_questions where prompt = 'Which keyword defines a function?';
    select id into q2 from public.academy_exam_questions where prompt = 'Python lists are mutable.';
  end if;

  if not exists (select 1 from public.academy_exams where title = 'Probe Exam') then
    insert into public.academy_exams
      (title, subject_id, class_id, duration_minutes, starts_at, status, created_by,
       randomize_questions, randomize_options, allow_early_submit, results_published)
    values ('Probe Exam', sub_id, cls_id, 20, now() - interval '5 minutes', 'active',
            owner_id, true, true, true, false)
    returning id into ex_id;

    insert into public.academy_exam_question_links (exam_id, question_id, position, marks, snapshot)
    select ex_id, q.id, row_number() over (order by q.created_at), q.marks,
           jsonb_build_object('prompt', q.prompt, 'options', q.options,
                              'correct_key', q.correct_key, 'question_type', q.question_type,
                              'difficulty', q.difficulty, 'explanation', coalesce(q.explanation, ''))
      from public.academy_exam_questions q where q.id in (q1, q2);
  end if;
end $$;
