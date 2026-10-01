# Golf live scoring (ESPN core)

Source: the owner-approved `sports.core.api.espn.com/v2/sports/golf` only. `site.api.espn.com` returns 403 to our identified client and is never used or bypassed.

## Lane

`golf-ingest` lane `live` (source `espn-live`, own lease) runs first on every 10-minute cron tick for editions whose dates cover today ±1 day. Per event: competition status, competitor list, then each competitor's `status` and `linescores` (pool of 3, 350 ms pacing, one retry on 5xx). Pre-round events refresh hourly; final events keep their final snapshot and are handed to the ingest lane immediately. Each snapshot is archived (R2 + `golf_source_captures`), published at `live/v1/events/<edition>.json` and `live/v1/current.json`, and appended to a bounded movement history (`live/v1/movement/<edition>.json`, 400 points; full snapshots in the private archive when the board changes).

Observed fields: event status/period/detail; per player position (display, tie flag), status (active/cut/WD/DQ/DNS), thru, current hole, start hole, tee time, playoff flag, round scores with completion, hole-by-hole for the current round where ESPN posts it (PGA TOUR: yes; LPGA: round totals only). ESPN exposes no scoring update timestamp, so freshness is measured from our fetch.

## Contract (`workers/shared/live.js`)

LIVE requires: ESPN in-progress status **and** posted scores **and** a snapshot ≤ 20 minutes old. 20–60 minutes: *Scoring update delayed* (never labelled live). Older or missing: unavailable. Suspended/delay statuses render as *Play suspended* only while fresh. Final is final. A date window alone is never live. Nulls stay null (thru, today, totals). Tested in `tests/live.test.mjs`.

## API and UI

`GET /v1/live` (all events, ordered live-first then by field size; no division preferred), `GET /v1/live/<edition>` (full board, hole scores, current-hour NWS weather with coordinate precision), `GET /v1/live/<edition>/movement`, `GET /v1/live?player=<slug>`. UI: homepage live hero + LIVE NOW rail, `/today`, `/live`, tournament live leaderboard, player current-tournament card, PBEcast *Observed scorecard data* panel. Refreshes every two minutes while visible; the API is edge-cached for one minute.

## Ingest integrity

A round counts only with all 18 holes posted, play past that round, or the event final. Results stay `unknown` (no position/total) until the event completes. ESPN may refresh rows it wrote earlier; other sources' values are never overwritten. Live events re-poll every 30 minutes in the event lane.
