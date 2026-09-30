-- Remove the probe fixtures left in the live database.
--
-- Building the engine needed real rows to test against: a probe subject, a probe
-- class, two questions, an active exam with a snapshot of both, a live attempt
-- from the attack run, and the two questions the import test actually wrote.
-- None of it belongs in a real question bank or class list, so it goes.
--
-- Only rows whose prompts and names match the fixtures exactly, so this cannot
-- touch a real question a teacher wrote.

delete from public.academy_exam_answers
 where question_id in (select id from public.academy_exam_questions
                        where prompt in ('Import probe one', 'Import probe two'));

delete from public.academy_exam_answers
 where attempt_id in (select id from public.academy_exam_attempts);

delete from public.academy_exam_events
 where exam_id in (select id from public.academy_exams where title = 'Probe Exam')
    or attempt_id in (select id from public.academy_exam_attempts);

delete from public.academy_exam_question_links
 where exam_id in (select id from public.academy_exams where title = 'Probe Exam');

delete from public.academy_exam_attempts
 where exam_id in (select id from public.academy_exams where title = 'Probe Exam');

delete from public.academy_exams where title = 'Probe Exam';

delete from public.academy_exam_questions
 where prompt in (
   'Import probe one', 'Import probe two', 'Bad row, no answer',
   'Which keyword defines a function?', 'Python lists are mutable.'
 );

delete from public.academy_class_members
 where class_id in (select id from public.academy_classes where name = 'Probe Class');

delete from public.academy_classes where name = 'Probe Class';
delete from public.academy_subjects where slug = 'probe-subject';

notify pgrst, 'reload schema';
