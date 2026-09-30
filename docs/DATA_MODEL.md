# Golf graph draft

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
