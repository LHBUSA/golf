-- Golf live scoring observations (ESPN core snapshots), insert-only and bounded.
-- One header row per observed leaderboard change; one normalized row per competitor. No raw payloads:
-- the full source bundle is already archived in R2 (golf-source) and referenced by capture_id.
-- Never overwritten: service_role may select and insert only (no update/delete grants).
-- Retention (documented in docs/LIVE_SCORING.md): rows are written only when the leaderboard changes;
-- at most 600 snapshots per edition (enforced by the writer); golf_prune_live_snapshots() thins editions
-- that ended more than 60 days ago to the last snapshot of each round. Pruning is owner-run, never automatic.

create table if not exists public.golf_live_snapshots (
  id uuid primary key,
  edition_id uuid not null references public.golf_tournament_editions(id),
  captured_at timestamptz not null,
  source_updated_at timestamptz,
  status text not null,
  state text,
  round smallint,
  leaderboard_hash text not null,
  players smallint not null default 0,
  capture_id uuid references public.golf_source_captures(id),
  parser_version text not null,
  unique (edition_id, captured_at)
);
create index if not exists golf_live_snapshots_edition_time on public.golf_live_snapshots (edition_id, captured_at desc);

create table if not exists public.golf_live_snapshot_rows (
  snapshot_id uuid not null references public.golf_live_snapshots(id) on delete cascade,
  espn_id text not null,
  player_id uuid references public.golf_players(id),
  position smallint,
  tied boolean,
  position_display text,
  score_to_par smallint,
  today smallint,
  thru smallint,
  round smallint,
  status text not null check (status in ('active','cut','withdrawn','disqualified','dns')),
  primary key (snapshot_id, espn_id)
);
create index if not exists golf_live_snapshot_rows_player on public.golf_live_snapshot_rows (player_id);

alter table public.golf_live_snapshots enable row level security;
alter table public.golf_live_snapshot_rows enable row level security;
revoke all on public.golf_live_snapshots from public, anon, authenticated;
revoke all on public.golf_live_snapshot_rows from public, anon, authenticated;
grant select, insert on public.golf_live_snapshots to service_role;
grant select, insert on public.golf_live_snapshot_rows to service_role;

-- Owner-run retention: keep every snapshot for 60 days after the edition ends, then keep only the last
-- snapshot of each round. Returns the number of snapshot headers removed (rows cascade).
create or replace function public.golf_prune_live_snapshots(p_keep_days integer default 60)
returns integer language plpgsql security definer set search_path = public as $$
declare removed integer;
begin
  with ended as (
    select e.id from public.golf_tournament_editions e
    where e.ends_on is not null and e.ends_on < (current_date - p_keep_days)
  ), keep as (
    select distinct on (s.edition_id, s.round) s.id from public.golf_live_snapshots s
    join ended on ended.id = s.edition_id
    order by s.edition_id, s.round, s.captured_at desc
  )
  delete from public.golf_live_snapshots s
  using ended where s.edition_id = ended.id and s.id not in (select id from keep);
  get diagnostics removed = row_count;
  return removed;
end $$;
revoke all on function public.golf_prune_live_snapshots(integer) from public, anon, authenticated, service_role;
