# Golf live scoring (ESPN core)

Source: the owner-approved `sports.core.api.espn.com/v2/sports/golf` only. `site.api.espn.com` returns 403 to our identified client and is never used or bypassed.

## Lane and cadence (2026-10-03)

`golf-ingest` cron runs **every minute** (`* * * * *`).

- **Minutes divisible by 10 — full tick** (unchanged lanes): the live lane does a **full refresh** of every window edition (today ±1 day): competition status, competitor list, then every competitor's `status` and `linescores` (~2 requests per competitor; ~242 requests / ~87 s for a 120-player field), followed by the other due lanes.
- **Every other minute — fast tick**, live lane only, and only for editions where play can be changing (`fastEligible`): event in progress, a whole-field round-complete with anyone still on course, within 15 minutes of the round's first tee, or suspended/delayed (re-checked every 5 minutes only). Pre-round editions stay on the hourly refresh; completed events are never polled. The gate is one R2 read of `live/v1/current.json` when nothing is in play.
- **Fast tick fetch plan**: competition status + the competitor list (ESPN leaderboard `order` for the whole field) + `status` only for competitors who can be changing (`isHot`: on course, teeing off within 10 minutes, or top ten) + `linescores` only when the status shows a card change (`cardChanged`: thru, round or status changed). Everyone else carries their last observation with its own `observed_at`. Measured on 2026 Bank of Utah R3 (live): **77 requests / 27 s** per fast tick (66 statuses, 9 cards) vs 242 / 87 s for a full refresh. Pacing (350 ms between request starts, one retry on 5xx, `UpstreamBusy` circuit) is unchanged.
- **Load**: during an event day with ~9 h of play, ~54 fast ticks/hour × ~77 requests ≈ +37k core-API requests per event-day versus the old 10-minute cadence; zero extra requests outside play. Worker CPU per fast tick is dominated by JSON parsing (sub-second); no new resources.
- **Persistence**: the published snapshot `live/v1/events/<edition>.json` is rewritten every observation (freshness = our fetch time); provenance archives (R2 `golf-source` + `golf_source_captures`) are written only when the board changed; movement history and durable snapshot rows stay change-only and bounded.

Observed fields: event status/period/detail; per player position (display, tie flag), status (active/cut/WD/DQ/DNS), thru, current hole, start hole, tee time, playoff flag, ESPN leaderboard order, round scores with completion, hole-by-hole for the current round where the tour publishes it. A round ESPN has opened but the golfer has not started (`value 0`, displayValue `-`, no holes) is "not started" and never nulls the total.

## Scoring tape (`workers/shared/tape.js`)

Separate from the movement history (a bounded top-40 leaderboard timeline), the **scoring tape** records observed scoring changes across the **whole live field**, derived only from provable deltas between consecutive snapshots of the same round:

- hole results (eagle or better, birdie, par, bogey, double+) named only from holes posted in the newer card that the older card did not have; the running total is shown only when it reconciles with both snapshots;
- round completed; into top 10 / top 5; meaningful movement (≥5 places, inside the top 25) for golfers re-observed in that snapshot;
- takes / ties / loses the lead (ESPN position 1, never a minimum over partial totals);
- CUT / WD / DQ only when the competitor status changed.

Each event carries the observation time (`t`) and the previous observation (`prev_t`): the hole was posted in between. Bounded to 3,000 events per edition in R2 `live/v1/tape/<edition>.json`; nothing crosses a round boundary; nothing is invented.

## Contract (`workers/shared/live.js`)

LIVE SCORING requires: ESPN in-progress status **and** posted scores **and** a last observation ≤ **5 minutes** old (`LIVE_FRESH_SECONDS`); beyond that the round is shown as *Scoring update delayed*. Other states keep the earlier contract (fresh ≤ 20 min, stale ≤ 60 min, then unavailable). Suspended/delay statuses show *Play suspended* with the status text quoted.

## API and UI

`GET /v1/live` (all events, ordered live-first then by field size; no division preferred), `GET /v1/live/<edition>` (full board, hole scores, current-hour NWS weather with coordinate precision), `GET /v1/live/<edition>/tape` (scoring tape, newest last, optional `?since=<iso>`; 20 s edge cache), `GET /v1/live/<edition>/movement`, `GET /v1/live?player=<slug>`. UI: homepage live hero + LIVE NOW rail, `/today`, `/live`, tournament live leaderboard, player current-tournament card, PBEcast *Observed scorecard data* panel. Refreshes every two minutes while visible; the API is edge-cached for one minute.

## Ingest integrity

A round counts only with all 18 holes posted, play past that round, or the event final. Results stay `unknown` (no position/total) until the event completes. ESPN may refresh rows it wrote earlier; other sources' values are never overwritten. Live events re-poll every 30 minutes in the event lane.
