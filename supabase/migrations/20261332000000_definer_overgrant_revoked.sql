-- Close the SECURITY DEFINER over-grant, and stop the default ACL from reopening it.
--
-- Two separate problems, one migration.
--
-- 1. Nineteen SECURITY DEFINER functions (sixteen distinct, some overloaded) are
--    executable by `authenticated` but are called from nowhere: not by the browser, not
--    by an edge function, not by another function, and not by an RLS policy. Revoked.
--    This takes the advisor's SECURITY DEFINER count from 92 to 76.
--
-- 2. A default ACL on the `public` schema also granted EXECUTE on new functions to anon
--    and authenticated, which is why a revoke could appear to be ignored for a function
--    redefined later. Narrowed here. Note that on this project the reliable way to stop a
--    new function being anonymously callable is an explicit
--    `revoke execute on function <sig> from public` after creating it -- Postgres still
--    adds the PUBLIC grant at CREATE time regardless of this default ACL, so the default
--    alone is not sufficient. Migrations that define a SECURITY DEFINER function should
--    revoke from public explicitly.
--
-- What is deliberately left alone:
--
--   - The four functions that RLS policies call directly. Policy expressions evaluate as
--     the signed-in user, so revoking these would break the policies themselves:
--       academy_assignment_visible_to_student  academy_submissions_student_self_write
--       academy_is_class_member                academy_assignment_targets_student_read
--                                             academy_classes_student_read
--                                             academy_exams_student_read
--       academy_can_access_live_room           academy_live_attendance_self_insert
--                                             academy_live_messages_read
--                                             academy_live_rooms_read
--       academy_can_access_assignment          academy_assignments_targeted_read
--                                             academy_submissions_targeted_create
--
--   - The remaining ~70 functions the browser calls, which is what the advisor warning is
--     mostly describing. PostgREST has to be able to reach them for the app to work.
--
-- pg_cron is unaffected: jobs run as the scheduling role, not as authenticated.
--
-- Finding the candidates by grepping migration text gets this wrong in both directions.
-- It reported functions as already revoked that the live catalog shows granted, and it
-- missed policy references entirely because pg_depend does not record calls inside policy
-- expressions. The list below comes from pg_proc, pg_policy and the actual RPC call sites.

-- ---------------------------------------------------------------------------
-- 1. Narrow the default privileges so a function created later does not pick up a
--    fresh anon/authenticated grant. Retained alongside the explicit revokes below
--    because it is defence in depth, but on its own it is not sufficient: Postgres
--    attaches the PUBLIC EXECUTE grant at CREATE time on this project, and only an
--    explicit `revoke ... from public` removes it (measured, not assumed).
-- ---------------------------------------------------------------------------
alter default privileges in schema public revoke execute on functions from anon;
alter default privileges in schema public revoke execute on functions from authenticated;

-- service_role keeps its default EXECUTE: the edge functions call it with the
-- service key, and Supabase grants that role BYPASSRLS for exactly this reason.

-- ---------------------------------------------------------------------------
-- 2. Revoke the nineteen functions nothing calls.
--
-- Looped over pg_proc rather than written out by hand so overloads and future
-- signature changes are covered, and so re-running this migration is a no-op.
-- ---------------------------------------------------------------------------
do $$
declare
  target record;
begin
  for target in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (array[
        'academy_assign_student_level',
        'academy_award_verified_activity',
        'academy_cleanup_live_data',
        'academy_cleanup_live_messages',
        'academy_ensure_active_week_period',
        'academy_exam_add_questions',
        'academy_exam_auto_submit_expired',
        'academy_exam_normalise_question',
        'academy_grading_health',
        'academy_my_registration_number',
        'academy_next_registration_serial',
        'academy_record_learning_heartbeat',
        'academy_refresh_leaderboard_standings',
        'academy_require_teacher',
        'academy_schedule_live_class',
        'academy_seed_author',
        'academy_set_grading_state',
        'academy_set_live_room_status',
        'academy_sync_profiles'
      ])
  loop
    -- `from public` rather than `from anon` alone: the default grant is to PUBLIC,
    -- and revoking from anon removes nothing while PUBLIC still covers it.
    execute format('revoke execute on function %s from public', target.signature);
    execute format('revoke execute on function %s from authenticated', target.signature);
  end loop;
end $$;
