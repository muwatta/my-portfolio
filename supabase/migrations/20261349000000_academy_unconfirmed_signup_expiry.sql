-- Expire pending student signups three hours after the latest confirmation
-- email. This makes the email available for a fresh signup while leaving
-- confirmed students and all staff accounts untouched.

create or replace function public.academy_release_provisional_registration_on_user_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.academy_registration_codes
  set status = 'available',
      claimed_by = null,
      claimed_at = null,
      updated_at = now()
  where claimed_by = old.id
    and status = 'provisional';

  return old;
end;
$$;

drop trigger if exists academy_release_provisional_registration_on_user_delete
  on auth.users;
create trigger academy_release_provisional_registration_on_user_delete
after delete on auth.users
for each row
execute function public.academy_release_provisional_registration_on_user_delete();

create or replace function public.academy_expire_unconfirmed_student_signups()
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  expired record;
  deleted_count integer := 0;
begin
  for expired in
    select
      u.id,
      u.email,
      coalesce(u.confirmation_sent_at, u.created_at) as confirmation_started_at,
      p.registration_code_id,
      codes.registration_number
    from auth.users as u
    join public.academy_profiles as p on p.id = u.id
    left join public.academy_registration_codes as codes
      on codes.id = p.registration_code_id
    where p.role = 'student'
      and u.email is not null
      and u.email_confirmed_at is null
      and coalesce(u.confirmation_sent_at, u.created_at)
        <= now() - interval '3 hours'
    order by coalesce(u.confirmation_sent_at, u.created_at)
    for update of u skip locked
  loop
    insert into public.academy_registration_audit (
      actor_id,
      student_id,
      registration_code_id,
      registration_number,
      action,
      reason,
      metadata
    ) values (
      null,
      expired.id,
      expired.registration_code_id,
      coalesce(expired.registration_number, 'UNASSIGNED'),
      'signup_expired',
      'Email confirmation was not completed within three hours.',
      jsonb_build_object(
        'email', expired.email,
        'confirmation_started_at', expired.confirmation_started_at,
        'expired_at', now()
      )
    );

    delete from auth.users
    where id = expired.id
      and email_confirmed_at is null;

    if found then
      deleted_count := deleted_count + 1;
    end if;
  end loop;

  return deleted_count;
end;
$$;

revoke all on function public.academy_expire_unconfirmed_student_signups()
  from public, anon, authenticated;
revoke all on function public.academy_release_provisional_registration_on_user_delete()
  from public, anon, authenticated;

-- Register once. unschedule first so re-running this migration cannot stack up
-- duplicate jobs. A missing pg_cron must not fail the migration, because that
-- leaves the version unrecorded and wedges every later `supabase db push`.
do $$
begin
  if to_regprocedure('cron.schedule(text,text,text)') is null then
    raise notice 'pg_cron is unavailable, unconfirmed Academy signup expiry will not run';
    return;
  end if;

  if exists (
    select 1 from cron.job
    where jobname = 'academy-expire-unconfirmed-signups'
  ) then
    perform cron.unschedule('academy-expire-unconfirmed-signups');
  end if;

  perform cron.schedule(
    'academy-expire-unconfirmed-signups',
    '*/5 * * * *',
    'select public.academy_expire_unconfirmed_student_signups()'
  );
exception when others then
  raise warning 'could not schedule academy-expire-unconfirmed-signups: %', sqlerrm;
end;
$$;
