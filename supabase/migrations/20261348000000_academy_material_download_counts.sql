-- Keep an atomic total for completed student material downloads.
alter table public.academy_materials
  add column if not exists download_count integer not null default 0
  check (download_count >= 0);

create or replace function public.academy_record_material_download(p_material_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  result integer;
begin
  if auth.uid() is null then
    raise exception 'Sign in to download course materials.';
  end if;

  update public.academy_materials
     set download_count = download_count + 1
   where id = p_material_id
     and (published or public.academy_is_teacher())
  returning download_count into result;

  if result is null then
    raise exception 'This material is unavailable.';
  end if;

  return result;
end;
$$;

revoke execute on function public.academy_record_material_download(uuid)
  from public, anon;
grant execute on function public.academy_record_material_download(uuid)
  to authenticated;
