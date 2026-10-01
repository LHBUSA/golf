create or replace function public.golf_write_batch(p_rows jsonb) returns jsonb language plpgsql set search_path=pg_catalog,public as $$
declare item jsonb; rowdata jsonb; oldrow jsonb; normalized jsonb; tab text; cols text; updates text; inserted integer:=0; updated integer:=0; unchanged integer:=0;
begin
 if jsonb_array_length(p_rows)>500 then raise exception 'batch bound';end if;
 for item in select value from jsonb_array_elements(p_rows) loop
  tab:=item->>'table'; rowdata:=item->'row';
  if tab<>all(array['golf_tours','golf_players','golf_player_identities','golf_identity_queue','golf_tournaments','golf_tournament_editions','golf_edition_tours','golf_courses','golf_course_layouts','golf_edition_courses','golf_entries','golf_results']) then raise exception 'table denied';end if;
  if not exists(select 1 from public.golf_source_captures c join public.golf_sources s on s.id=c.source_id where c.id=(rowdata->>'capture_id')::uuid and s.verdict='APPROVED' and s.automated_access) then raise exception 'unapproved capture';end if;
  execute format('select to_jsonb(t) from public.%I t where id=$1',tab) into oldrow using (rowdata->>'id')::uuid;
  execute format('select to_jsonb(jsonb_populate_record(null::public.%I,$1))',tab) into normalized using rowdata;
  if oldrow is not null and not exists(select 1 from jsonb_each(rowdata) r where r.key<>'capture_id' and oldrow->r.key is distinct from normalized->r.key) then unchanged:=unchanged+1;continue;end if;
  select string_agg(format('%I',key),','),string_agg(format('%I=excluded.%I',key,key),',') filter(where key<>'id') into cols,updates from jsonb_object_keys(rowdata) key;
  execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I,$1) on conflict(id) do update set %s',tab,cols,cols,tab,updates) using rowdata;
  if oldrow is null then inserted:=inserted+1;else
   updated:=updated+1;
   insert into public.golf_source_changes(capture_id,entity_table,entity_id,field_changes,previous_capture_id) values((rowdata->>'capture_id')::uuid,tab,(rowdata->>'id')::uuid,jsonb_build_object('before',oldrow,'after',rowdata),(oldrow->>'capture_id')::uuid);
  end if;
 end loop;
 return jsonb_build_object('inserted',inserted,'updated',updated,'unchanged',unchanged);
end $$;
