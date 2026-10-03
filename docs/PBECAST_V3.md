# PBEcast Live V3: broadcast command center

Frontend only. It reads `GET /api/v1/live/:slug` and `GET /api/v1/live/:slug/movement`, which are unchanged. No golf-api, ingest or schema change.

Code: `src/lib/cast-v3.js` (pure derivations and renderers, unit-tested) and `src/lib/cast-v3-live.js` (controller: selection, diff updates, chart interaction, fullscreen). Wired from `hydrateLive()` in `src/main.ts`. Tests: `tests/pbecast-v3.test.mjs` (real fixture `tests/fixtures/pbecast-v3-bank-of-utah-r2.json`) and the `PBEcast V3 live` cases in `tests/browser/product.spec.js`, which skip when no tournament is in play.

## Truth levels

| Level | Fields |
|---|---|
| Observed (ESPN) | position, tie flag, total, today, thru, tee time, start hole, hole strokes, hole par, snapshot timestamps |
| Observed (published layout) | course hole par and yardage |
| Observed (NWS / MET Norway) | hourly forecast. Town-level is labelled "Town-level estimate" and is never called course weather |
| PBE-derived | tower movement arrows, run facts, live scoring tape, field snapshot, "next hole in order" |
| Reconstructed | the generic hole figure in the hole detail. Labelled `RECONSTRUCTED · Scorecard-based visualization · not shot tracking`. No ball, trail, landing zone or path is drawn |

Never produced: ball location, shot path, club, lie, carry, proximity, strokes gained, player walking location.

## Derivation rules

- **Tower movement (▲/▼)**: the latest movement observation minus the previous one. Shown only when the latest observation's position still equals the board row. One snapshot means no arrows.
- **Run facts**: counted from posted holes in play order. They are: trailing birdie streak of 2 or more ("Three straight birdies", or "straight holes under par" if an eagle is in it); 3 or more birdies-or-better in the last five; 2 or more over par in the last five; bogey-free through N when N is 9 or more and covers the whole round.
- **Live scoring (2026-10-03)**: the tape comes from the server (`GET /api/v1/live/<edition>/tape`, `workers/shared/tape.js`), derived from consecutive ~1-minute observations across the whole field (not only the top 40). Display: every non-par event; pars only for the top ten and the selected golfer; newest first; new rows flash once. A head line always says what the tape is and how fresh it is ("LIVE SCORING · HOLE-BY-HOLE · Last scoring observation 2 min ago", plus "Waiting for the next posted hole result" when nothing new has arrived since the page opened); stale / suspended / pre-round each have their own wording, never a blank module. The client polls every 30 s while the event is live and the tab is visible (2 min otherwise; a hidden tab pauses polling and refetches immediately when it becomes visible). Browsers may throttle timers in unfocused or automation-controlled windows (a QA session observed 60 s); 30 s is the intended cadence and was measured in a normal visible page. Client freshness: every 15 s the cast re-derives its state from the last observation, so a LIVE event whose observation is older than 5 minutes (the server live contract) shows ROUND N · SCORING UPDATE DELAYED even when no poll has succeeded; it shows LIVE again only after fresh data arrives. The original client pulse below is kept only as a fallback when the tape endpoint is unavailable.
- **Selected golfer**: position, total, today, thru, round, tee time / start hole, current hole (or first hole + tee time before starting), the current-round hole strip, latest scoring event and recent events from the tape, movement since the previous snapshot. Tours without hole cards say so explicitly ("round totals are shown").
- **Scoring pulse (fallback)**: built from consecutive observations in the same round only.
  - Lead change, or a tie for the lead, when the set of P1 players changes.
  - A hole result ("BIRDIE ON 15") only when thru increased, the posted holes `holes[prevThru..thru)` exist for the current round, and their total vs par equals the observed to-par change. Otherwise the pulse shows only the observed board move ("MOVES TO −16 · THRU 15").
  - Finished round when thru goes from under 18 to 18.
  - Into the top 5 or top 10 when the position crosses that line.
  - Scoring events cover players in the observed top 10 plus the selected golfer.
  - Cut status is not in the movement observations, so cut changes are not claimed.
- **Field snapshot**: computed from the current board's active players with a posted total.
  - Within 1/2/3 excludes the leaders.
  - The low round counts finished rounds only.
  - Biggest mover compares the first observation of the current round with the latest one.
  - Cut line is omitted: the live feed doesn't publish one, and no versioned PBE methodology exists.
- **Course local clock**: the forecast hour's UTC offset. It's omitted when there's no weather.

## Leaders over time

- Rendered at the measured pixel width (viewBox = pixels), so text never scales. Height comes from CSS (260px, or 220px at 600px and below), which reserves space and keeps CLS at zero.
- Rounds are laid out as separate time segments, so the overnight gap is not stretched across the axis.
- Monotone cubic curves pass through every observation and never overshoot. Dots are the observations. Curves break where a player is outside the observed top 40.
- Direct labels are limited to the selected golfer, the leader(s) and the biggest mover. They sit in a reserved right gutter with collision spacing and are truncated to fit. Everyone else is in the legend.
- Filters: Top 5 (desktop default), Top 10, Selected (default below 768px).
- Hover, tap or arrow keys show time, name, position, to-par and thru. A data table is in a `<details>` element.

## Refresh cadence (audited 2026-10-02)

- Ingest: cron every 10 minutes (stored snapshots are about 10 minutes apart).
- API: edge-cached 60 seconds (`s-maxage=60`).
- Page: polls every 120 seconds while visible, plus one catch-up when the tab becomes visible again. An in-flight guard stops overlapping polls.
- The "ESPN update N min ago" label ticks every 30 seconds from `fetched_at`.
- On a new snapshot, only regions whose HTML changed are replaced. Tower scroll, focus, selection and chart filter persist. Changed cells and new pulse rows flash once (disabled under reduced motion).
