# Data model — Phase 2 (2026-10-01)

No schema change was applied this sprint. Rows now populate: `golf_tournaments`, `golf_tournament_editions` (rules JSON carries catalog fields, schedule fields and a `results` coverage object: article, revision, coverage class, field size, cut, rows listed/stored/held), `golf_edition_tours` (sanctioning from tour schedules), `golf_courses` + `golf_course_layouts` (one metadata layout per venue + one *championship setup* layout per edition, never mixed across years), `golf_holes` (per setup), `golf_entries`, `golf_results`, `golf_rounds`, `golf_scorecards` (one row per player round), `golf_hole_scores` (validated final-round cards), `golf_entity_media`, `golf_identity_queue`, `golf_news_packets`, `golf_articles`.

Coverage classes per edition: `full_field` (missed-cut rows listed and row count reaches the published field), `partial_field`, `made_cut`, `top_finishers`, `winner_only`, `schedule_only`. Starts-based rates and field-adjusted scoring use `full_field` only; top-10 membership and wins use every leaderboard.

Deterministic IDs: `stableId(table:key)` — players/courses/series by QID, Wikidata editions by QID, schedule-only editions by `wp:<series QID or title>:<year>`, entries by `edition:QID`, results by `edition:winner` (catalog-compatible) or `edition:QID`, scorecards by `edition:QID:R<n>`.

---

# Golf graph draft

Production update, 2026-10-01: the guarded foundation schema and reviewed runtime migrations are applied to SPORTS. `golf_source_state` adds durable source leases, errors, freshness and run counters, bringing the graph to fifty RLS tables. The bounded invoker `golf_write_batch` RPC retains typed idempotence and correction history; raw captures and news packets remain immutable. See [the production report](PRODUCTION_SPRINT_REPORT.md). The draft-only description below records the foundation sprint.

49 tables, all golf-prefixed, RLS enabled, public/anon/authenticated access revoked. Migration is draft only: no seeds, execution or graph creation. Target guard requires SPORTS project ref and known SPORTS marker tables, and rejects identity entitlement tables.

Players have canonical generated UUIDs. A verified unique (source, provider_id) crosswalk resolves a person; names never merge. DOB, nationality, official IDs and cross-source proof support review. Unknown identity goes to golf_identity_queue. Tour membership has validity intervals, independent of person identity. Player photos require verified person and image identity evidence.

Every sourced entity references immutable captures containing URL, hash, archive key, rights/parser versions and captured/effective dates. Source changes preserve revisions; source precedence and field-level conflict rules require source-specific review before ingestion.

Tours/seasons/tournaments/editions and edition_tours separate stable event identity from annual co-sanctioning. Courses/layouts/holes/edition_courses retain changing venues and renovations. Layout changes create a new version, never rewrite historical holes. Scorecards use actual round layout; composite FKs prevent joining hole facts across layouts.

Entries represent either players or teams; entry_members map team golfers. Groups and tee times belong to editions/rounds. Rounds support suspended, cancelled and shortened status. Scorecards, hole scores and shots store observed values. Shots preserve club, lie, result, distances/units and coordinate reference frame; no inferred paths. Penalties and conceded match holes require source-specific semantics.

Leaderboard snapshots plus entries preserve observed history. Results distinguish finished, cut, withdrawn, disqualified and unknown. Cuts distinguish official, source-projected and versioned model-projected. Playoff holes/scores remain separate from regulation. Matches/sessions/holes support team and match formats without inventing stroke totals.

Stat definitions carry unit, direction and version. Player round/edition/season statistics retain denominators/sample; course stats retain inputs/method. Ranking systems and dated snapshots precede player positions/points. Rankings from different systems never share movement calculations.

Historical queries: player → entries → editions → results for wins/top tens/cuts; course → layouts → edition_courses → scorecards for actual course-specific performance; edition → results/snapshots → entries for fields and leaderboards. Match/team wins are not individual stroke wins. Career highs/records disclose observed history start and gaps. Missing careers never become complete totals.

Media uses typed entity FKs or editorial-only scope. Packets link captures and remain immutable; articles carry validation/dedupe metadata. Methodology versions and analytics runs retain cohort/inputs/sample/coverage. Products/offers retain source, image rights, validity, retailer and disclosure.

Indexes cover edition dates, player event history, latest live snapshots, season stats and ranking history. Unique crosswalk/edition/scorecard/snapshot keys prevent duplicate observations. No destructive cascade deletes. SQL is structurally checked but not database-executed: owner-approved validation still needs SQL syntax/execution, privileges, source-verdict transactional enforcement, publication guards, retention and measured indexes. Ingestion remains disabled.

Full table inventory: [data/schema/tables.json](../data/schema/tables.json). Draft: [migration](../supabase/migrations/20260930150300_golf_foundation_draft.sql).
