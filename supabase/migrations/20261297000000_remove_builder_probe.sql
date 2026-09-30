-- Remove the exam builder probe rows.
--
-- Building and testing the builder left a probe subject, three questions, a
-- draft exam with four questions in it, and the audit events for it. None of it
-- is real course content.
--
-- Matched on the exact fixture names so this cannot touch anything a teacher
-- wrote.

delete from public.academy_exam_events
 where exam_id in (select id from public.academy_exams where title = 'Builder Probe Exam');

delete from public.academy_exam_question_links
 where exam_id in (select id from public.academy_exams where title = 'Builder Probe Exam');

delete from public.academy_exams where title = 'Builder Probe Exam';

delete from public.academy_exam_questions
 where prompt in (
   'Odd keys question', 'Second easy-ish question', 'Tuples are immutable.'
 );

delete from public.academy_subjects where slug = 'builder-probe';

notify pgrst, 'reload schema';
