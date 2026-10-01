begin;
set local app.golf_target_project = 'tkmlnhmylqnttmnsnief';
do $$ begin
 if to_regclass('public.ufc_bouts') is null or to_regclass('public.pbe_sport_entitlements') is not null then raise exception 'SPORTS required'; end if;
end $$;
create table public.golf_source_state (
 source_id text primary key references golf_sources(id),
 status text not null default 'idle' check(status in ('idle','running','ok','error','blocked')),
 lease_until timestamptz,
 last_attempt timestamptz,
 last_capture timestamptz,
 last_parse timestamptz,
 last_write timestamptz,
 records_processed integer not null default 0,
 records_inserted integer not null default 0,
 records_updated integer not null default 0,
 records_held integer not null default 0,
 identity_conflicts integer not null default 0,
 source_errors integer not null default 0,
 last_error text,
 parser_version text not null,
 cadence_seconds integer not null check(cadence_seconds >= 86400)
);
alter table public.golf_source_state enable row level security;
revoke all on public.golf_source_state from public,anon,authenticated;
grant select,insert,update on public.golf_source_state to service_role;
create function public.golf_claim_source(p_source text) returns boolean language plpgsql set search_path=pg_catalog,public as $$
declare claimed text;
begin
 update public.golf_source_state set status='running',lease_until=now()+interval '5 minutes',last_attempt=now()
 where source_id=p_source and status<>'blocked' and (lease_until is null or lease_until<now())
 and (last_attempt is null or last_attempt < now()-interval '60 seconds') returning source_id into claimed;
 return claimed is not null;
end $$;
revoke all on function public.golf_claim_source(text) from public,anon,authenticated;
grant execute on function public.golf_claim_source(text) to service_role;
create function public.golf_write_batch(p_rows jsonb) returns jsonb language plpgsql set search_path=pg_catalog,public as $$
declare item jsonb; rowdata jsonb; oldrow jsonb; tab text; cols text; updates text; inserted integer:=0; updated integer:=0; unchanged integer:=0;
begin
 if jsonb_array_length(p_rows)>500 then raise exception 'batch bound';end if;
 for item in select value from jsonb_array_elements(p_rows) loop
  tab:=item->>'table'; rowdata:=item->'row';
  if tab<>all(array['golf_tours','golf_players','golf_player_identities','golf_identity_queue','golf_tournaments','golf_tournament_editions','golf_edition_tours','golf_courses','golf_course_layouts','golf_edition_courses','golf_entries','golf_results']) then raise exception 'table denied';end if;
  if not exists(select 1 from public.golf_source_captures c join public.golf_sources s on s.id=c.source_id where c.id=(rowdata->>'capture_id')::uuid and s.verdict='APPROVED' and s.automated_access) then raise exception 'unapproved capture';end if;
  execute format('select to_jsonb(t) from public.%I t where id=$1',tab) into oldrow using (rowdata->>'id')::uuid;
  if oldrow is not null and not exists(select 1 from jsonb_each(rowdata) r where r.key<>'capture_id' and oldrow->r.key is distinct from r.value) then unchanged:=unchanged+1;continue;end if;
  select string_agg(format('%I',key),','),string_agg(format('%I=excluded.%I',key,key),',') filter(where key<>'id') into cols,updates from jsonb_object_keys(rowdata) key;
  execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I,$1) on conflict(id) do update set %s',tab,cols,cols,tab,updates) using rowdata;
  if oldrow is null then inserted:=inserted+1;else
   updated:=updated+1;
   insert into public.golf_source_changes(capture_id,entity_table,entity_id,field_changes,previous_capture_id) values((rowdata->>'capture_id')::uuid,tab,(rowdata->>'id')::uuid,jsonb_build_object('before',oldrow,'after',rowdata),(oldrow->>'capture_id')::uuid);
  end if;
 end loop;
 return jsonb_build_object('inserted',inserted,'updated',updated,'unchanged',unchanged);
end $$;
revoke all on function public.golf_write_batch(jsonb) from public,anon,authenticated;
grant execute on function public.golf_write_batch(jsonb) to service_role;
-- Grants are limited to golf; direct browser access remains revoked with RLS enabled.
do $$ declare t text; begin
 for t in select tablename from pg_tables where schemaname='public' and tablename like 'golf\_%' escape '\' loop
 execute format('grant select,insert,update on public.%I to service_role',t);
 end loop;
end $$;
commit;
