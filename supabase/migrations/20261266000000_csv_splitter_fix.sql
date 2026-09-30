-- Correct academy_exam_split_csv.
--
-- It appended a row with "rows_out := rows_out || current_row", but rows_out is
-- text[][] and current_row is text[], so the concatenation flattened the result
-- to a single dimension and the first append raised "malformed array literal".
-- No file could be parsed at all.
--
-- Wrapping the row before appending keeps both dimensions: ARRAY[current_row]
-- is a one element text[][].

create or replace function public.academy_exam_split_csv(p_csv text)
returns text[][]
language plpgsql
immutable
as $$
declare
  rows_out text[][] := '{}';
  current_row text[] := '{}';
  field text := '';
  in_quotes boolean := false;
  ch text;
  i integer;
  len integer;
begin
  len := length(p_csv);
  i := 1;
  while i <= len loop
    ch := substr(p_csv, i, 1);
    if in_quotes then
      if ch = '"' then
        if i < len and substr(p_csv, i + 1, 1) = '"' then
          field := field || '"';
          i := i + 1;
        else
          in_quotes := false;
        end if;
      else
        field := field || ch;
      end if;
    else
      if ch = '"' then
        in_quotes := true;
      elsif ch = ',' then
        current_row := current_row || field;
        field := '';
      elsif ch = E'\n' then
        current_row := current_row || field;
        rows_out := rows_out || ARRAY[current_row];
        current_row := '{}';
        field := '';
      elsif ch = E'\r' then
        null;
      else
        field := field || ch;
      end if;
    end if;
    i := i + 1;
  end loop;
  if field <> '' or array_length(current_row, 1) > 0 then
    current_row := current_row || field;
    rows_out := rows_out || ARRAY[current_row];
  end if;
  return rows_out;
end;
$$;

revoke execute on function public.academy_exam_split_csv(text) from public, anon, authenticated;

notify pgrst, 'reload schema';
