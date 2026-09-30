-- DRAFT ONLY. Do not apply without owner approval. No seeds, resources or identity changes.
-- Target: SPORTS tkmlnhmylqnttmnsnief, confirmed in read-only sibling architecture.
-- Owner must verify target independently before authorizing application.
begin;
do $guard$
begin
 if current_setting('app.golf_target_project', true) is distinct from 'tkmlnhmylqnttmnsnief'
    or to_regclass('public.ufc_bouts') is null
    or to_regclass('public.ufc_model_versions') is null
    or to_regclass('public.pbe_sport_entitlements') is not null then
  raise exception 'Golf migrations require verified SPORTS project; identity/billing forbidden';
 end if;
end $guard$;

create table public.golf_sources (
  id text primary key,
  name text not null,
  owner text not null,
  verdict text not null check(verdict in ('APPROVED','HOLD','REJECT','OWNER DECISION')),
  registry_version text not null,
  terms_url text not null,
  automated_access boolean not null default false,
  rights_assessment jsonb not null,
  reviewed_at timestamptz not null
);

create table public.golf_source_captures (
  id uuid primary key default gen_random_uuid(),
  source_id text not null references golf_sources(id),
  source_url text not null,
  captured_at timestamptz not null,
  effective_at timestamptz,
  http_status integer not null check(http_status=200),
  sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'),
  archive_key text not null,
  parser_version text not null,
  rights_version text not null,
  unique(source_id,
  source_url,
  captured_at)
);

create table public.golf_tours (
  id uuid primary key default gen_random_uuid(),
  capture_id uuid not null references golf_source_captures(id),
  name text not null,
  slug text not null unique,
  division text not null check(division in ('men','women','mixed')),
  organizer text
);

create table public.golf_seasons (
  id uuid primary key default gen_random_uuid(),
  capture_id uuid not null references golf_source_captures(id),
  tour_id uuid not null references golf_tours(id),
  label text not null,
  starts_on date,
  ends_on date,
  unique(tour_id,label),
  check(ends_on is null or starts_on is null or ends_on>=starts_on)
);

create table public.golf_players (
  id uuid primary key default gen_random_uuid(),
  capture_id uuid not null references golf_source_captures(id),
  full_name text not null,
  slug text not null unique,
  birth_date date,
  nationality_code text,
  identity_status text not null check(identity_status in ('verified','review')),
  biography text
);

create table public.golf_player_identities (
  id uuid primary key default gen_random_uuid(),
  capture_id uuid not null references golf_source_captures(id),
  player_id uuid not null references golf_players(id),
  source_id text not null references golf_sources(id),
  provider_id text not null,
  evidence jsonb not null,
  verified_at timestamptz not null,
  unique(source_id,provider_id)
);

create table public.golf_identity_queue (
  id uuid primary key default gen_random_uuid(),
  capture_id uuid not null references golf_source_captures(id),
  source_id text not null references golf_sources(id),
  provider_id text not null,
  candidates jsonb not null default '[]',
  evidence jsonb not null,
  status text not null default 'pending' check(status in ('pending','resolved','rejected')),
  resolution_player_id uuid references golf_players(id),
  unique(source_id,provider_id),
  check(status <> 'resolved' or resolution_player_id is not null)
);

create table public.golf_player_tour_memberships (
  id uuid primary key default gen_random_uuid(),
  capture_id uuid not null references golf_source_captures(id),
  player_id uuid not null references golf_players(id),
  tour_id uuid not null references golf_tours(id),
  valid_from date not null,
  valid_to date,
  membership_type text not null,
  check(valid_to is null or valid_to>=valid_from),
  unique(player_id,tour_id,valid_from)
);

create table public.golf_tournaments (
  id uuid primary key default gen_random_uuid(),
  capture_id uuid not null references golf_source_captures(id),
  name text not null,
  slug text not null unique,
  major_division text check(major_division in ('men','women')),
  organizer text not null
);

create table public.golf_tournament_editions (
  id uuid primary key default gen_random_uuid(),
  capture_id uuid not null references golf_source_captures(id),
  tournament_id uuid not null references golf_tournaments(id),
  season_id uuid references golf_seasons(id),
  edition_key text not null,
  starts_on date,
  ends_on date,
  timezone text,
  status text not null check(status in ('scheduled','in_progress','suspended','completed','cancelled','unknown')),
  format text not null check(format in ('stroke','match','team_stroke','team_match','stableford','mixed','other')),
  scheduled_rounds integer check(scheduled_rounds>0),
  completed_rounds integer check(completed_rounds>=0),
  cut_policy jsonb,
  rules jsonb not null default '{}',
  unique(tournament_id,edition_key),
  check(ends_on is null or starts_on is null or ends_on>=starts_on)
);

create table public.golf_edition_tours (
  id uuid primary key default gen_random_uuid(),
  capture_id uuid not null references golf_source_captures(id),
  edition_id uuid not null references golf_tournament_editions(id),
  tour_id uuid not null references golf_tours(id),
  unique(edition_id,tour_id)
);

create table public.golf_courses (
  id uuid primary key default gen_random_uuid(),
  capture_id uuid not null references golf_source_captures(id),
  name text not null,
  slug text not null unique,
  country_code text,
  locality text,
  latitude numeric check(latitude between -90 and 90),
  longitude numeric check(longitude between -180 and 180)
);

create table public.golf_course_layouts (
  id uuid primary key default gen_random_uuid(),
  capture_id uuid not null references golf_source_captures(id),
  course_id uuid not null references golf_courses(id),
  version_label text not null,
  valid_from date,
  valid_to date,
  par integer check(par>0),
  yardage integer check(yardage>0),
  routing_basis text,
  specifications jsonb not null default '{}',
  unique(course_id,version_label),
  check(valid_to is null or valid_from is null or valid_to>=valid_from)
);

create table public.golf_holes (
  id uuid primary key default gen_random_uuid(),
  capture_id uuid not null references golf_source_captures(id),
  layout_id uuid not null references golf_course_layouts(id),
  hole_number integer not null check(hole_number>0),
  par integer check(par>0),
  yardage integer check(yardage>0),
  routing jsonb,
  routing_observed boolean not null default false,
  unique(layout_id,hole_number),
  unique(id,layout_id)
);

create table public.golf_edition_courses (
  id uuid primary key default gen_random_uuid(),
  capture_id uuid not null references golf_source_captures(id),
  edition_id uuid not null references golf_tournament_editions(id),
  layout_id uuid not null references golf_course_layouts(id),
  usage_role text not null,
  unique(edition_id,layout_id)
);

create table public.golf_entries (
  id uuid primary key default gen_random_uuid(),
  capture_id uuid not null references golf_source_captures(id),
  edition_id uuid not null references golf_tournament_editions(id),
  player_id uuid references golf_players(id),
  team_name text,
  status text not null check(status in ('entered','active','cut','withdrawn','disqualified','finished','unknown')),
  check((player_id is not null)::integer + (team_name is not null)::integer=1),
  unique(edition_id,player_id),
  unique(id,edition_id)
);

create table public.golf_entry_members (
  id uuid primary key default gen_random_uuid(),
  capture_id uuid not null references golf_source_captures(id),
  entry_id uuid not null references golf_entries(id),
  player_id uuid not null references golf_players(id),
  unique(entry_id,player_id)
);

create table public.golf_groups (
  id uuid primary key default gen_random_uuid(),
  capture_id uuid not null references golf_source_captures(id),
  edition_id uuid not null references golf_tournament_editions(id),
  round_number integer not null check(round_number>0),
  source_group_key text not null,
  unique(edition_id,round_number,source_group_key),
  unique(id,edition_id)
);

create table public.golf_tee_times (
  id uuid primary key default gen_random_uuid(),
  capture_id uuid not null references golf_source_captures(id),
  group_id uuid not null,
  edition_id uuid not null,
  entry_id uuid not null,
  tee_at timestamptz,
  starting_hole integer check(starting_hole>0),
  foreign key(group_id,edition_id) references golf_groups(id,edition_id),
  foreign key(entry_id,edition_id) references golf_entries(id,edition_id),
  unique(group_id,entry_id)
);

create table public.golf_rounds (
  id uuid primary key default gen_random_uuid(),
  capture_id uuid not null references golf_source_captures(id),
  edition_id uuid not null references golf_tournament_editions(id),
  round_number integer not null check(round_number>0),
  status text not null check(status in ('scheduled','in_progress','suspended','completed','cancelled','shortened','unknown')),
  started_at timestamptz,
  completed_at timestamptz,
  regulation_holes integer check(regulation_holes>0),
  unique(edition_id,round_number),
  unique(id,edition_id)
);

create table public.golf_scorecards (
  id uuid primary key default gen_random_uuid(),
  capture_id uuid not null references golf_source_captures(id),
  edition_id uuid not null,
  round_id uuid not null,
  entry_id uuid not null,
  layout_id uuid not null,
  strokes integer check(strokes>0),
  score_to_par integer,
  holes_completed integer check(holes_completed>=0),
  status text not null,
  foreign key(round_id,edition_id) references golf_rounds(id,edition_id),
  foreign key(entry_id,edition_id) references golf_entries(id,edition_id),
  foreign key(edition_id,layout_id) references golf_edition_courses(edition_id,layout_id),
  unique(round_id,entry_id),
  unique(id,layout_id)
);

create table public.golf_hole_scores (
  id uuid primary key default gen_random_uuid(),
  capture_id uuid not null references golf_source_captures(id),
  scorecard_id uuid not null,
  layout_id uuid not null,
  hole_id uuid not null,
  strokes integer check(strokes>0),
  score_to_par integer,
  status text not null check(status in ('not_started','in_progress','completed','conceded','unknown')),
  foreign key(scorecard_id,layout_id) references golf_scorecards(id,layout_id),
  foreign key(hole_id,layout_id) references golf_holes(id,layout_id),
  unique(scorecard_id,hole_id)
);

create table public.golf_shots (
  id uuid primary key default gen_random_uuid(),
  capture_id uuid not null references golf_source_captures(id),
  hole_score_id uuid not null references golf_hole_scores(id),
  shot_number integer not null check(shot_number>0),
  observed_at timestamptz,
  club text,
  lie text,
  result text,
  distance numeric check(distance>=0),
  remaining_distance numeric check(remaining_distance>=0),
  distance_unit text check(distance_unit in ('yards','meters','feet')),
  coordinate_system text,
  observed_coordinates jsonb,
  provider_event_id text not null,
  unique(hole_score_id,provider_event_id),
  check(observed_coordinates is null or coordinate_system is not null)
);

create table public.golf_leaderboard_snapshots (
  id uuid primary key default gen_random_uuid(),
  capture_id uuid not null references golf_source_captures(id),
  edition_id uuid not null references golf_tournament_editions(id),
  observed_at timestamptz not null,
  source_status text not null,
  is_final boolean not null default false,
  unique(edition_id,observed_at),
  unique(id,edition_id)
);

create table public.golf_leaderboard_entries (
  id uuid primary key default gen_random_uuid(),
  capture_id uuid not null references golf_source_captures(id),
  snapshot_id uuid not null,
  edition_id uuid not null,
  entry_id uuid not null,
  position integer check(position>0),
  tied boolean,
  score_to_par integer,
  total_strokes integer check(total_strokes>0),
  round_score integer,
  current_hole integer check(current_hole>0),
  thru integer check(thru>=0),
  movement integer,
  status text not null,
  foreign key(snapshot_id,edition_id) references golf_leaderboard_snapshots(id,edition_id),
  foreign key(entry_id,edition_id) references golf_entries(id,edition_id),
  unique(snapshot_id,entry_id)
);

create table public.golf_results (
  id uuid primary key default gen_random_uuid(),
  capture_id uuid not null references golf_source_captures(id),
  edition_id uuid not null,
  entry_id uuid not null,
  position integer check(position>0),
  tied boolean,
  strokes integer check(strokes>0),
  score_to_par integer,
  finish_status text not null check(finish_status in ('finished','cut','withdrawn','disqualified','unknown')),
  winner boolean,
  winning_margin numeric,
  foreign key(entry_id,edition_id) references golf_entries(id,edition_id),
  unique(edition_id,entry_id)
);

create table public.golf_cuts (
  id uuid primary key default gen_random_uuid(),
  capture_id uuid not null references golf_source_captures(id),
  edition_id uuid not null references golf_tournament_editions(id),
  after_round integer not null check(after_round>0),
  score_to_par integer,
  strokes integer,
  cut_type text not null check(cut_type in ('official','source_projected','model_projected')),
  methodology_version text,
  check(cut_type <> 'model_projected' or methodology_version is not null),
  unique(edition_id,after_round,cut_type)
);

create table public.golf_playoffs (
  id uuid primary key default gen_random_uuid(),
  capture_id uuid not null references golf_source_captures(id),
  edition_id uuid not null references golf_tournament_editions(id),
  format text not null,
  winning_entry_id uuid,
  foreign key(winning_entry_id,edition_id) references golf_entries(id,edition_id),
  unique(id,edition_id)
);

create table public.golf_playoff_holes (
  id uuid primary key default gen_random_uuid(),
  capture_id uuid not null references golf_source_captures(id),
  playoff_id uuid not null,
  edition_id uuid not null,
  sequence integer not null check(sequence>0),
  layout_id uuid not null,
  hole_id uuid not null,
  foreign key(playoff_id,edition_id) references golf_playoffs(id,edition_id),
  foreign key(edition_id,layout_id) references golf_edition_courses(edition_id,layout_id),
  foreign key(hole_id,layout_id) references golf_holes(id,layout_id),
  unique(playoff_id,sequence),
  unique(id,edition_id)
);

create table public.golf_playoff_scores (
  id uuid primary key default gen_random_uuid(),
  capture_id uuid not null references golf_source_captures(id),
  playoff_hole_id uuid not null,
  edition_id uuid not null,
  entry_id uuid not null,
  strokes integer check(strokes>0),
  foreign key(entry_id,edition_id) references golf_entries(id,edition_id),
  foreign key(playoff_hole_id,edition_id) references golf_playoff_holes(id,edition_id),
  unique(playoff_hole_id,entry_id)
);

create table public.golf_matches (
  id uuid primary key default gen_random_uuid(),
  capture_id uuid not null references golf_source_captures(id),
  edition_id uuid not null references golf_tournament_editions(id),
  session_key text not null,
  match_key text not null,
  format text not null,
  status text not null,
  side_a_entry_id uuid not null,
  side_b_entry_id uuid not null,
  winner_entry_id uuid,
  result_label text,
  points_a numeric,
  points_b numeric,
  foreign key(side_a_entry_id,edition_id) references golf_entries(id,edition_id),
  foreign key(side_b_entry_id,edition_id) references golf_entries(id,edition_id),
  foreign key(winner_entry_id,edition_id) references golf_entries(id,edition_id),
  check(side_a_entry_id<>side_b_entry_id),
  check(winner_entry_id is null or winner_entry_id in (side_a_entry_id,side_b_entry_id)),
  unique(edition_id,session_key,match_key)
);

create table public.golf_match_holes (
  id uuid primary key default gen_random_uuid(),
  capture_id uuid not null references golf_source_captures(id),
  match_id uuid not null references golf_matches(id),
  sequence integer not null check(sequence>0),
  hole_id uuid references golf_holes(id),
  result_label text,
  status text not null,
  unique(match_id,sequence)
);

create table public.golf_stat_definitions (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  version text not null,
  name text not null,
  unit text not null,
  direction text not null check(direction in ('higher','lower','neutral')),
  definition text not null,
  unique(code,version)
);

create table public.golf_player_stats (
  id uuid primary key default gen_random_uuid(),
  capture_id uuid not null references golf_source_captures(id),
  player_id uuid not null references golf_players(id),
  edition_id uuid not null references golf_tournament_editions(id),
  round_id uuid,
  foreign key(round_id,edition_id) references golf_rounds(id,edition_id),
  stat_id uuid not null references golf_stat_definitions(id),
  value numeric,
  numerator numeric,
  denominator numeric,
  sample_size integer check(sample_size>=0),
  definition_version text not null
);

create table public.golf_player_season_stats (
  id uuid primary key default gen_random_uuid(),
  capture_id uuid not null references golf_source_captures(id),
  player_id uuid not null references golf_players(id),
  season_id uuid not null references golf_seasons(id),
  stat_id uuid not null references golf_stat_definitions(id),
  effective_on date not null,
  value numeric,
  numerator numeric,
  denominator numeric,
  sample_size integer check(sample_size>=0),
  definition_version text not null,
  unique(player_id,season_id,stat_id,effective_on)
);

create table public.golf_course_stats (
  id uuid primary key default gen_random_uuid(),
  capture_id uuid not null references golf_source_captures(id),
  layout_id uuid not null references golf_course_layouts(id),
  hole_id uuid,
  edition_id uuid references golf_tournament_editions(id),
  stat_id uuid not null references golf_stat_definitions(id),
  value numeric,
  sample_size integer not null check(sample_size>0),
  methodology_version text not null,
  input_capture_ids uuid[] not null,
  foreign key(hole_id,layout_id) references golf_holes(id,layout_id)
);

create table public.golf_ranking_systems (
  id uuid primary key default gen_random_uuid(),
  capture_id uuid not null references golf_source_captures(id),
  name text not null,
  code text not null unique,
  tour_id uuid references golf_tours(id),
  rules_version text,
  scope text not null
);

create table public.golf_ranking_snapshots (
  id uuid primary key default gen_random_uuid(),
  capture_id uuid not null references golf_source_captures(id),
  system_id uuid not null references golf_ranking_systems(id),
  season_id uuid references golf_seasons(id),
  effective_on date not null,
  unique(system_id,effective_on)
);

create table public.golf_rankings (
  id uuid primary key default gen_random_uuid(),
  capture_id uuid not null references golf_source_captures(id),
  snapshot_id uuid not null references golf_ranking_snapshots(id),
  player_id uuid not null references golf_players(id),
  position integer not null check(position>0),
  points numeric,
  average_points numeric,
  events_count integer check(events_count>=0),
  unique(snapshot_id,player_id)
);

create table public.golf_source_changes (
  id uuid primary key default gen_random_uuid(),
  capture_id uuid not null references golf_source_captures(id),
  entity_table text not null check(left(entity_table,5)='golf_'),
  entity_id uuid not null,
  field_changes jsonb not null,
  previous_capture_id uuid references golf_source_captures(id),
  recorded_at timestamptz not null default now()
);

create table public.golf_weather_observations (
  id uuid primary key default gen_random_uuid(),
  capture_id uuid not null references golf_source_captures(id),
  edition_id uuid not null references golf_tournament_editions(id),
  observed_at timestamptz not null,
  station_id text,
  location_basis text not null,
  temperature_c numeric,
  wind_speed_mps numeric,
  precipitation_mm numeric,
  source_report text
);

create table public.golf_entity_media (
  id uuid primary key default gen_random_uuid(),
  capture_id uuid not null references golf_source_captures(id),
  player_id uuid references golf_players(id),
  course_id uuid references golf_courses(id),
  tournament_id uuid references golf_tournaments(id),
  editorial_only boolean not null default false,
  source_url text not null,
  author text not null,
  licence text not null,
  licence_url text not null,
  attribution text not null,
  identity_proof jsonb not null,
  archive_key text not null,
  sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'),
  width integer not null check(width>0),
  height integer not null check(height>0),
  rights_status text not null check(rights_status in ('approved','hold','revoked')),
  review_version text not null,
  check((player_id is not null)::integer+(course_id is not null)::integer+(tournament_id is not null)::integer+editorial_only::integer=1)
);

create table public.golf_methodology_versions (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  version text not null,
  specification jsonb not null,
  reviewed_at timestamptz,
  status text not null check(status in ('draft','validated','retired')),
  unique(code,version)
);

create table public.golf_analytics_runs (
  id uuid primary key default gen_random_uuid(),
  methodology_id uuid not null references golf_methodology_versions(id),
  ran_at timestamptz not null,
  input_capture_ids uuid[] not null,
  cohort jsonb not null,
  sample jsonb not null,
  coverage jsonb not null,
  result jsonb,
  status text not null check(status in ('hold','validated'))
);

create table public.golf_news_packets (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  sha256 text not null unique check(sha256 ~ '^[0-9a-f]{64}$'),
  packet_version text not null,
  frozen_at timestamptz not null default now(),
  materiality text not null,
  facts jsonb not null,
  evidence jsonb not null
);

create table public.golf_news_packet_captures (
  packet_id uuid not null references golf_news_packets(id),
  capture_id uuid not null references golf_source_captures(id),
  primary key(packet_id,capture_id)
);

create table public.golf_articles (
  id uuid primary key default gen_random_uuid(),
  packet_id uuid not null references golf_news_packets(id),
  slug text not null unique,
  headline text not null,
  body jsonb not null,
  status text not null default 'held' check(status in ('held','validated','published','retracted')),
  hold_reasons jsonb not null default '[]',
  dedupe_key text not null unique,
  numeric_claims jsonb not null,
  editorial_version text not null,
  quality_version text not null,
  media_id uuid references golf_entity_media(id),
  published_at timestamptz,
  check(status <> 'published' or published_at is not null)
);

create table public.golf_gear_products (
  id uuid primary key default gen_random_uuid(),
  capture_id uuid not null references golf_source_captures(id),
  brand text not null,
  name text not null,
  category text not null check(category in ('drivers','fairway_woods','hybrids','irons','wedges','putters','balls','bags','rangefinders','apparel')),
  official_url text not null,
  image_media_id uuid references golf_entity_media(id),
  image_rights jsonb not null,
  relationship text not null default 'none'
);

create table public.golf_gear_offers (
  id uuid primary key default gen_random_uuid(),
  capture_id uuid not null references golf_source_captures(id),
  product_id uuid not null references golf_gear_products(id),
  retailer text not null,
  partner_contract text,
  official_url text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  price numeric check(price>=0),
  currency text,
  promotion text not null,
  disclosure text not null,
  status text not null default 'held' check(status in ('held','approved','expired','revoked')),
  check(ends_at>starts_at),
  check(price is null or currency is not null)
);

create index golf_results_player_history on golf_results(entry_id, edition_id);
create index golf_entries_player_editions on golf_entries(player_id,edition_id);
create index golf_editions_dates on golf_tournament_editions(starts_on desc);
create index golf_snapshots_latest on golf_leaderboard_snapshots(edition_id,observed_at desc);
create index golf_rankings_player_history on golf_rankings(player_id,snapshot_id);
create index golf_stats_player_season on golf_player_season_stats(player_id,season_id,stat_id,effective_on desc);
create index golf_media_rights on golf_entity_media(rights_status);
create index golf_articles_published on golf_articles(published_at desc) where status='published';

create function public.golf_reject_evidence_mutation() returns trigger
language plpgsql set search_path = pg_catalog, public as $body$
begin raise exception 'Frozen evidence is append-only'; end $body$;
revoke all on function public.golf_reject_evidence_mutation() from public, anon, authenticated;
create trigger golf_packet_immutable before update or delete on golf_news_packets for each row execute function golf_reject_evidence_mutation();
create trigger golf_capture_immutable before update or delete on golf_source_captures for each row execute function golf_reject_evidence_mutation();
create trigger golf_packet_links_immutable before update or delete on golf_news_packet_captures for each row execute function golf_reject_evidence_mutation();

-- Deny direct clients. Worker roles/grants require separate scoped review.
alter table public.golf_sources enable row level security;
revoke all on table public.golf_sources from public, anon, authenticated;
alter table public.golf_source_captures enable row level security;
revoke all on table public.golf_source_captures from public, anon, authenticated;
alter table public.golf_tours enable row level security;
revoke all on table public.golf_tours from public, anon, authenticated;
alter table public.golf_seasons enable row level security;
revoke all on table public.golf_seasons from public, anon, authenticated;
alter table public.golf_players enable row level security;
revoke all on table public.golf_players from public, anon, authenticated;
alter table public.golf_player_identities enable row level security;
revoke all on table public.golf_player_identities from public, anon, authenticated;
alter table public.golf_identity_queue enable row level security;
revoke all on table public.golf_identity_queue from public, anon, authenticated;
alter table public.golf_player_tour_memberships enable row level security;
revoke all on table public.golf_player_tour_memberships from public, anon, authenticated;
alter table public.golf_tournaments enable row level security;
revoke all on table public.golf_tournaments from public, anon, authenticated;
alter table public.golf_tournament_editions enable row level security;
revoke all on table public.golf_tournament_editions from public, anon, authenticated;
alter table public.golf_edition_tours enable row level security;
revoke all on table public.golf_edition_tours from public, anon, authenticated;
alter table public.golf_courses enable row level security;
revoke all on table public.golf_courses from public, anon, authenticated;
alter table public.golf_course_layouts enable row level security;
revoke all on table public.golf_course_layouts from public, anon, authenticated;
alter table public.golf_holes enable row level security;
revoke all on table public.golf_holes from public, anon, authenticated;
alter table public.golf_edition_courses enable row level security;
revoke all on table public.golf_edition_courses from public, anon, authenticated;
alter table public.golf_entries enable row level security;
revoke all on table public.golf_entries from public, anon, authenticated;
alter table public.golf_entry_members enable row level security;
revoke all on table public.golf_entry_members from public, anon, authenticated;
alter table public.golf_groups enable row level security;
revoke all on table public.golf_groups from public, anon, authenticated;
alter table public.golf_tee_times enable row level security;
revoke all on table public.golf_tee_times from public, anon, authenticated;
alter table public.golf_rounds enable row level security;
revoke all on table public.golf_rounds from public, anon, authenticated;
alter table public.golf_scorecards enable row level security;
revoke all on table public.golf_scorecards from public, anon, authenticated;
alter table public.golf_hole_scores enable row level security;
revoke all on table public.golf_hole_scores from public, anon, authenticated;
alter table public.golf_shots enable row level security;
revoke all on table public.golf_shots from public, anon, authenticated;
alter table public.golf_leaderboard_snapshots enable row level security;
revoke all on table public.golf_leaderboard_snapshots from public, anon, authenticated;
alter table public.golf_leaderboard_entries enable row level security;
revoke all on table public.golf_leaderboard_entries from public, anon, authenticated;
alter table public.golf_results enable row level security;
revoke all on table public.golf_results from public, anon, authenticated;
alter table public.golf_cuts enable row level security;
revoke all on table public.golf_cuts from public, anon, authenticated;
alter table public.golf_playoffs enable row level security;
revoke all on table public.golf_playoffs from public, anon, authenticated;
alter table public.golf_playoff_holes enable row level security;
revoke all on table public.golf_playoff_holes from public, anon, authenticated;
alter table public.golf_playoff_scores enable row level security;
revoke all on table public.golf_playoff_scores from public, anon, authenticated;
alter table public.golf_matches enable row level security;
revoke all on table public.golf_matches from public, anon, authenticated;
alter table public.golf_match_holes enable row level security;
revoke all on table public.golf_match_holes from public, anon, authenticated;
alter table public.golf_stat_definitions enable row level security;
revoke all on table public.golf_stat_definitions from public, anon, authenticated;
alter table public.golf_player_stats enable row level security;
revoke all on table public.golf_player_stats from public, anon, authenticated;
alter table public.golf_player_season_stats enable row level security;
revoke all on table public.golf_player_season_stats from public, anon, authenticated;
alter table public.golf_course_stats enable row level security;
revoke all on table public.golf_course_stats from public, anon, authenticated;
alter table public.golf_ranking_systems enable row level security;
revoke all on table public.golf_ranking_systems from public, anon, authenticated;
alter table public.golf_ranking_snapshots enable row level security;
revoke all on table public.golf_ranking_snapshots from public, anon, authenticated;
alter table public.golf_rankings enable row level security;
revoke all on table public.golf_rankings from public, anon, authenticated;
alter table public.golf_source_changes enable row level security;
revoke all on table public.golf_source_changes from public, anon, authenticated;
alter table public.golf_weather_observations enable row level security;
revoke all on table public.golf_weather_observations from public, anon, authenticated;
alter table public.golf_entity_media enable row level security;
revoke all on table public.golf_entity_media from public, anon, authenticated;
alter table public.golf_methodology_versions enable row level security;
revoke all on table public.golf_methodology_versions from public, anon, authenticated;
alter table public.golf_analytics_runs enable row level security;
revoke all on table public.golf_analytics_runs from public, anon, authenticated;
alter table public.golf_news_packets enable row level security;
revoke all on table public.golf_news_packets from public, anon, authenticated;
alter table public.golf_news_packet_captures enable row level security;
revoke all on table public.golf_news_packet_captures from public, anon, authenticated;
alter table public.golf_articles enable row level security;
revoke all on table public.golf_articles from public, anon, authenticated;
alter table public.golf_gear_products enable row level security;
revoke all on table public.golf_gear_products from public, anon, authenticated;
alter table public.golf_gear_offers enable row level security;
revoke all on table public.golf_gear_offers from public, anon, authenticated;
commit;
