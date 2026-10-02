-- Fixes the Supabase database advisor warnings that are actually worth fixing.
--
-- What is NOT here, and why
-- -------------------------
-- The advisor also reported ~70 "signed-in users can execute SECURITY DEFINER
-- function" warnings. Those are this application working as designed, and
-- "fixing" them would break it. PostgREST RPCs are the entire data layer: the
-- browser calls supabase.rpc('academy_exam_save_answer', ...) and similar, so
-- `authenticated` must hold EXECUTE on those functions. Revoking it, or switching
-- them to SECURITY INVOKER, breaks the app rather than securing it.
--
-- The advisory is written for projects where RPCs are not the data path. Here the
-- real controls are that every one of those functions performs its own
-- authorisation check inside the body (academy_require_teacher(), academy_is_teacher(),
-- academy_is_admin(), or binding auth.uid() and validating the caller), with RLS as
-- the backstop. The one thing genuinely missing across the whole surface was
-- search_path pinning, which is what this migration fixes for all of them at once.

-- ---------------------------------------------------------------------------
-- 1. Pin search_path on every function in the public schema.
--
-- Done with ALTER FUNCTION rather than by rewriting bodies, so nothing about the
-- logic can change. Without a pinned path, a function resolves unqualified names
-- through whatever path the caller happens to have, which is how a SECURITY
-- DEFINER function ends up executing something the schema owner did not intend.
--
-- `public, extensions, pg_temp` in that order: pg_temp last so a temporary object
-- can never shadow a real one, and extensions included because Supabase installs
-- pgcrypto and friends there and a few functions call them unqualified.
-- ---------------------------------------------------------------------------
do $$
declare
  target record;
begin
  for target in
    select n.nspname as schema_name,
           p.proname,
           pg_get_function_identity_arguments(p.oid) as identity_args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and not exists (
        select 1
        from unnest(coalesce(p.proconfig, '{}'::text[])) as cfg
        where cfg like 'search_path=%'
      )
  loop
    execute format(
      'alter function %I.%I(%s) set search_path = public, extensions, pg_temp',
      target.schema_name,
      target.proname,
      target.identity_args
    );
  end loop;
end $$;

comment on function public.academy_rechain_course_lessons(uuid) is
  'Recomputes the prerequisite chain for a course. SECURITY INVOKER, so the caller
is subject to RLS on academy_lessons, where writes require academy_is_teacher().
search_path pinned by 20261331000000.';

-- ---------------------------------------------------------------------------
-- 2. Stop `anon` calling academy_register_material_file.
--
-- The advisor flagged this one for anon specifically, and it was a real gap: the
-- function is SECURITY DEFINER and reachable at /rest/v1/rpc/... without signing
-- in. It did already refuse internally ("Not signed in."), so this is defence in
-- depth made structural rather than a live hole, but a function that can never be
-- reached is better than one that can be reached and rejects you.
--
-- Both overloads are covered because p_file_size_bytes exists as both bigint and
-- integer across migrations.
--
-- `revoke ... from public` rather than `from anon` on purpose: the default grant is
-- to PUBLIC, and revoking from the anon role alone would remove nothing, because
-- PUBLIC still grants it to every role including anon.
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
      and p.proname = 'academy_register_material_file'
  loop
    execute format('revoke execute on function %s from public', target.signature);
    -- Re-granted immediately: PUBLIC was the only thing granting it, and the admin
    -- materials page calls this as a signed-in teacher.
    execute format('grant execute on function %s to authenticated', target.signature);
  end loop;
end $$;
