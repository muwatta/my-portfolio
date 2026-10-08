-- The idempotent version accepts a third optional argument. Remove the
-- original two-argument overload so PostgREST can resolve student submissions.
drop function if exists public.academy_submit_objective_answer(uuid, text);

notify pgrst, 'reload schema';
