-- Restore the table privileges required by the staff exam builder.
--
-- RLS policies decide which rows staff may access, but a matching table grant
-- is also required. The question bank contains answer keys, so keep its access
-- restricted by the existing academy_exam_questions_staff policy. Students
-- must continue to use the safe paper and result functions instead.
grant select, insert, update, delete
  on public.academy_exam_questions to authenticated;

-- The exam list is safe to select under the existing staff/student RLS
-- policies; question snapshots and answer keys live in separate protected
-- tables and functions.
grant select on public.academy_exams to authenticated;

notify pgrst, 'reload schema';
