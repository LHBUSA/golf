# Golf Picks V1 (LHBUSA/golf#7)

Status 2026-10-09: **RESEARCH / SHADOW**. Code, backtest and tests are on branch `golf-picks-v1`. Nothing is deployed:
AGENTS.md requires explicit owner approval for any production deployment (see "Release gate" below).

## Model: Golf Probability Model V1 (`golf-prob/1.0.0`)
- **Inputs:** observed round scores from `full_field` editions only (every missed cut listed, field complete).
  Partial rounds (<55 strokes, mid-round WD) are dropped. No strokes-gained, OWGR or other rankings, Data Golf,
  odds or weather. Course fit is not a feature (still descriptive).
- **Rating:** round residual = (strokes - round field mean) + mean pre-event rating of that round's players
  (field-strength adjustment). Exponential time decay (tau days), shrinkage toward a prior with k pseudo-rounds,
  and per-player round SD shrunk toward 2.9 strokes with kv pseudo-rounds. PGA and LPGA never share a field.
- **Simulation:** one joint Monte Carlo (20,000 sims at lock) of 4 rounds (3 when the prior edition was 54 holes),
  integer strokes (so ties happen), a cut after 36 holes when the format has one (top 65 and ties; men's majors
  Masters 50 / U.S. Open 60 / Open 70 / PGA 70; women's majors 70), and a uniform playoff among those tied first.
  Winner, top 10, top 20, make cut and head to head all come from the same simulated finishes. Seeded by
  edition + model version, so a lock reproduces bit for bit.
- **Cut detection:** a cut counts only when at least 5 rows and 10% of the field are marked cut. ESPN marks a lone
  early WD "cut" in no-cut events (Baycurrent 2024, Shanghai 2023/2025). That is treated as a withdrawal.
- **Frozen params** (tuned on the 2024 fold only): tau 730, k 3, mu0 0.5, kv 40, spread 1.0, rating-uncertainty 0.
  Stage A: Gaussian NLL of 29,880 round residuals over 108 configs. Stage B: sim log loss, 6 configs, 3,000 sims.

### BACKTEST: walk-forward evaluation (historical research, NOT prospective or verified performance)
Chronological only. An edition is predicted from editions that ended at least a day before it started.
Leaderboard rows are shuffled before evaluation, so nothing can tie-break on finishing order.
Folds: tune 2024 (82 editions), validate 2025-01-01..06-30 (46), **holdout 2025-07-01..2026-10-05 (99)**.
Bundle `data/public/bundle.json` as of 2026-10-05T17:47:50Z (sha256 a91ff677...acc1), 385 full-field editions.
Evidence: `docs/evidence/picks-v1-backtest.json` (all strata, reliability bins, per-edition rows, policy replay).
Script: `node scripts/picks-backtest.mjs <bundle> <out> all 10000`.

Baselines:
- `field_equal`: 1/N and so on.
- `naive_history`: smoothed empirical win, top-10, top-20 and cut rates over prior full-field starts.
- `naive_rating`: undecayed, unshrunk and unadjusted mean vs-field, run through the same simulation.
- Market: Kalshi and Polymarket winner snapshots exist only from 2026-10-03/05, so **n = 0 exact-contract
  snapshots at lock in the holdout**. Golf is RULE_MISMATCH (owner, 2026-10-05): the two venues are never
  combined and never called an edge.

BACKTEST holdout (10,000 sims). These numbers are never shown in the product or the track record. Lower LL/Brier is better. Winner n=98, top-10 rows 11,398, cut rows 9,118, H2H pairs 4,963 (190 void).

### all:holdout
| model | n ed | winner LL | winner Brier | top-1 | T10 LL | T10 Brier | T10 ECE | P@10 | T20 LL | T20 Brier | P@20 | cut LL | cut Brier | cut ECE | H2H acc | H2H LL |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| model | 99 | 3.9782 | 0.9563 | 0.1327 | 0.2684 | 0.0755 | 0.0079 | 0.2818 | 0.4053 | 0.1255 | 0.3753 | 0.6538 | 0.2291 | 0.0362 | 0.6395 | 0.6322 |
| naive_rating | 99 | 4.1743 | 0.9665 | 0.1531 | 0.2765 | 0.0771 | 0.0075 | 0.2545 | 0.4176 | 0.1289 | 0.3621 | 0.6676 | 0.2352 | 0.042 | 0.6253 | 0.6543 |
| naive_history | 99 | 4.4729 | 0.9613 | 0.1633 | 0.2854 | 0.0779 | 0.0107 | 0.2455 | 0.4246 | 0.1308 | 0.3515 | 0.6662 | 0.2368 | 0.0382 | 0.5 | 0.6931 |
| field_equal | 99 | 4.7144 | 0.9903 | 0.0097 | 0.3002 | 0.0816 | 0.0054 | 0.0939 | 0.4488 | 0.1385 | 0.1889 | 0.6982 | 0.2508 | 0.0203 | 0.5 | 0.6931 |
### PGA:holdout
| model | n ed | winner LL | winner Brier | top-1 | T10 LL | T10 Brier | T10 ECE | P@10 | T20 LL | T20 Brier | P@20 | cut LL | cut Brier | cut ECE | H2H acc | H2H LL |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| model | 60 | 4.1632 | 0.9597 | 0.1525 | 0.2662 | 0.0736 | 0.0141 | 0.2467 | 0.4075 | 0.126 | 0.3342 | 0.6666 | 0.2338 | 0.0335 | 0.6255 | 0.6431 |
| naive_rating | 60 | 4.4851 | 0.9718 | 0.1356 | 0.2758 | 0.0754 | 0.0137 | 0.22 | 0.4222 | 0.1298 | 0.3158 | 0.6816 | 0.2407 | 0.039 | 0.6067 | 0.6675 |
| naive_history | 60 | 4.5413 | 0.9734 | 0.1186 | 0.2829 | 0.0759 | 0.0159 | 0.2067 | 0.4249 | 0.1301 | 0.315 | 0.67 | 0.2386 | 0.0253 | 0.5 | 0.6931 |
| field_equal | 60 | 4.6981 | 0.99 | 0.01 | 0.2898 | 0.0778 | 0.0076 | 0.0867 | 0.4414 | 0.1353 | 0.18 | 0.7057 | 0.2534 | 0.0303 | 0.5 | 0.6931 |
### LPGA:holdout
| model | n ed | winner LL | winner Brier | top-1 | T10 LL | T10 Brier | T10 ECE | P@10 | T20 LL | T20 Brier | P@20 | cut LL | cut Brier | cut ECE | H2H acc | H2H LL |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| model | 39 | 3.6983 | 0.9511 | 0.1026 | 0.2717 | 0.0782 | 0.0063 | 0.3359 | 0.4021 | 0.1249 | 0.4385 | 0.634 | 0.222 | 0.0444 | 0.6591 | 0.617 |
| naive_rating | 39 | 3.7043 | 0.9584 | 0.1795 | 0.2774 | 0.0796 | 0.0086 | 0.3077 | 0.4106 | 0.1274 | 0.4333 | 0.6462 | 0.2266 | 0.0535 | 0.6514 | 0.6359 |
| naive_history | 39 | 4.3693 | 0.9429 | 0.2308 | 0.2892 | 0.0811 | 0.0128 | 0.3051 | 0.424 | 0.132 | 0.4077 | 0.6605 | 0.234 | 0.0609 | 0.5 | 0.6931 |
| field_equal | 39 | 4.739 | 0.9908 | 0.0092 | 0.3157 | 0.0874 | 0.0141 | 0.1051 | 0.4599 | 0.1434 | 0.2026 | 0.6867 | 0.2468 | 0.005 | 0.5 | 0.6931 |

BACKTEST validation (2025 H1, scored before the holdout with the same frozen params):

| model | n ed | winner LL | winner Brier | top-1 | T10 LL | T10 Brier | T10 ECE | P@10 | T20 LL | T20 Brier | P@20 | cut LL | cut Brier | cut ECE | H2H acc | H2H LL |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| model | 46 | 4.0073 | 0.9675 | 0.1087 | 0.2594 | 0.0712 | 0.0129 | 0.2652 | 0.3984 | 0.1226 | 0.3533 | 0.6443 | 0.2253 | 0.0514 | 0.6471 | 0.6357 |
| naive_rating | 46 | 4.1429 | 0.9739 | 0.087 | 0.2665 | 0.0724 | 0.0124 | 0.2457 | 0.4093 | 0.125 | 0.3435 | 0.6608 | 0.2326 | 0.0553 | 0.6203 | 0.6601 |
| naive_history | 46 | 4.9648 | 0.9873 | 0.087 | 0.2712 | 0.0734 | 0.0174 | 0.2261 | 0.4114 | 0.1258 | 0.3565 | 0.6545 | 0.2312 | 0.0457 | 0.5 | 0.6931 |
| field_equal | 46 | 4.73 | 0.9905 | 0.0095 | 0.2851 | 0.0765 | 0.0008 | 0.1 | 0.4386 | 0.1348 | 0.1891 | 0.687 | 0.2455 | 0.0215 | 0.5 | 0.6931 |

How to read it:
- The model beats every baseline on winner, top-10, top-20 and make-cut log loss and Brier in the holdout, for PGA
  and LPGA separately.
- Top-10 calibration is tight up to p~0.45: ECE 0.008, with mean p versus observed by bin of 0.047/0.042,
  0.140/0.126, 0.240/0.237, 0.338/0.332 and 0.439/0.429. Above 0.6 it is overconfident (n=29).
- Winner top-1 is lower than naive_rating/naive_history in the LPGA (0.10 vs 0.18/0.23), but the log loss is
  better. That gap is a known weakness.
- Outside the chalk: for the golfers the model ranks 11th-30th by win probability, top-10 mean p is 0.171 against
  0.156 observed (n=1,955), so it is slightly overconfident there.
- Small fields (<90) with a cut: make-cut LL is 1.47 (n=116, every model is bad). That is a format-detection weakness.
- BACKTEST policy replay on the holdout (never in the record), wins against expected:
  - winner: 14/96 graded against 9.4 expected
  - top 10: 84/276 against 88.8
  - top 20: 137/282 against 121.9
  - make cut: 175/224 against 170.5
  - H2H: 36/60 against 38.0
  - Top 10 picks outside the top 5 by win probability: 16/39 against 10.9.

### Honesty notes (read before quoting any number)
1. **Not VALIDATED.** No gate was registered before the holdout was scored, so V1 is RESEARCH. The prospective
   gate below is registered now, before any prospective lock.
2. The holdout was looked at twice: once by a 300-sim, untuned code sanity run, and once by the frozen run
   above. The sanity run surfaced only a baseline-metric bug (equal-probability rank ties and a finishing-order
   leak in field_equal precision), which was fixed. No model design or parameter changed after any holdout look.
3. mu0 is a gauge: all ratings are field-relative, so the stage-A NLL is identical for every mu0. It does not act
   as a newcomer penalty. The V1.1 challenger should express the prior relative to the field mean.
4. Stage A chose the grid edge (tau 730, k 3, kv 40). Widening the grid is a V1.1 challenger item. The holdout was
   not used.
5. The policy replay rows were simulated with the pre-freeze defaults for spread/uncertainty (1.0/1.0). The
   frozen lock uses 1.0/0. The model metrics tables use the frozen values.

### Prospective activation gate (registered 2026-10-09, before the first lock)
V1 may be called VALIDATED only after **>= 20 prospective locked tournaments** (locked_at < first tee proven) with:
- winner, top-10, top-20 and make-cut log loss lower than both field_equal and naive_rating on the same locks,
  with a paired-bootstrap 90% CI that excludes 0;
- top-10 ECE <= 0.03.

Until then every surface says RESEARCH. Passing does not mean profitable trading.

## Publication policy V1 (`golf-picks-policy/1.0.0`, frozen)
- **Eligibility:** individual stroke play (team, match-play and exhibition formats excluded), a published field of
  at least 30, and at least 60% of the field with 12 or more rated rounds. Selections need 12 or more rated rounds.
- **Winner:** the single highest modeled probability, shown with its probability and never called a strong pick.
  The full field distribution is locked with it.
- **Top 10 and top 20:** 3 each with p >= 0.20 and p >= 0.30, excluding golfers already selected.
- **Make cut:** 3 with p >= 0.60, cut events only.
- **H2H:** neighbours in expected finish among the top 40; the 3 most decisive pairs with p >= 0.55.

## Grading (`golf-picks-grade/1.0.0`, frozen): WIN / LOSS / VOID / PENDING
- **Winner:** WIN for the official winner, playoff winner included. Co-winners without a playoff -> VOID.
  DNS -> VOID. WD/DQ after starting -> LOSS.
- **Top 10 / Top 20:** WIN when position <= N, ties included (T10 is a top 10). MC -> LOSS. WD/DQ after starting
  -> LOSS. DNS -> VOID.
- **Make cut:** WIN when the golfer made the cut, even if they withdrew later. MC -> LOSS. WD/DQ/DNS before the
  cut -> VOID. No cut made -> VOID.
- **H2H:** the better official position wins. A made cut beats a missed cut. If both missed, the lower 36-hole
  total wins. Same position or total -> VOID. Either golfer WD/DQ/DNS -> VOID.
- **Event:** cancelled, abandoned or under 36 holes -> all VOID.
- PENDING until the projection edition is `completed` with a full or partial leaderboard.
- Corrections are appended as revisions (r002...) that name the revision they supersede. A lock is never rewritten.

## Lock timing
A lock is written by the existing golf-ingest full tick (minute%10==0 of the `* * * * *` cron; no new cron). It
needs all of the following:
- the edition's ESPN live snapshot is in `pre` state, at most 70 minutes old, with no posted scores;
- the time is no later than **first sourced R1 tee time - 30 min**. With no tee time, the deadline is the start
  date at 00:00 UTC+14, otherwise HOLD;
- the model store is complete.

The lock records `start_evidence` (first tee, snapshot time and capture id), feature cutoff (editions used and the
hash of their slugs), model and params, policy, and the market snapshot when the propsports-markets binding answers
(verbatim, flagged RULE_MISMATCH). It is sealed with sha256 over canonical JSON.

## Ledger and storage (private only)
Everything lives in R2 `golf-source` (private: r2.dev disabled, no custom domain) under `picks/v1/`:
- `locks/<edition>.json` (create-only, `If-None-Match: *` plus read-back);
- `grades/<edition>/rNNN.json` (create-only revisions);
- `model/editions.json` (compact full-field store);
- `reports/<week>.json` (weekly calibration, human review, no auto-reweighting);
- `index.json` (derived cache, rebuilt from the ledger).

Nothing is written to `golf-public`, the projection, the static build or the sitemap (tests assert this).

## API and UI
- `GET /v1/picks` and `GET /v1/picks/track-record`: All Access or owner only (`golfAccess`, fail closed), always
  `no-store`. Guest, expired, sport-only and auth-outage requests get 403 with no values.
- `GET /v1/picks/preview`: public counts only (tournaments locked, graded selections, model). No golfer,
  selection or probability.
- Page `/picks` (noindex, not in the sitemap): the method plus an All Access lock. For members, each selection
  card reads "Our selection / Forecast probability / Actual finish / Result", followed by the probability table
  and the track record by family. Nav item "Picks".

## Release state (2026-10-09 13:35Z): RESEARCH, picks lane OFF pending the Shanghai gate (owner hold)
- **golf-ingest** `bf77c279` (main fc61bb7, `PICKS_ENABLED=0`): read-only gate and health step on the existing
  full tick.
  - It was enabled as `0392a3b4` from 12:54 to 13:02Z. The single tick that ran in that window (13:00) locked
    nothing; it only built the model store.
  - Rollbacks: `15a28c30` (picks off, no health step), `6e0bed35` (pre-picks).
- **golf-api** `3327842b` (main fc61bb7). Rollbacks: `82cc361c`, then `d1e4961f` (pre-picks).
- **Vercel** `dpl_8aauPr5GHjd6uySudeWmRZwK5Xpx` (main bac9fb2, All Access repairs).
  Rollbacks: `dpl_G27XDHiUYvm4924PVfDKXD1bz42q` (fc61bb7), then `dpl_HbWcG8D81ZXWcthCijzfeK8yKMSu` (pre-picks).
- **Real R2 create-only proof** (`POST /admin/picks-selftest`, 2 runs): `ok:true`.
- **Production-verified access** (real requests, no mocks):
  - `/v1/picks` and `/v1/picks/track-record` return 403 with no values for a guest and for an invalid session,
    both directly and through golf.propbetedge.ai/api. All of these responses are `no-store`.
  - The preview returns counts only.
  - `/picks` is noindex and not in the sitemap.
  - The projection and index snapshot contain no picks.
- **Simulated-membership QA (NOT a production access test):** the member card, track record and probability-table
  layout were checked by browser QA with membership mocked at the network edge. A real signed-in All Access check
  in production is still owed.
- **Monitoring** (KV `picks:health:v1`, private R2 `picks/v1/health/latest.json`, aggregate on
  `/v1/source-health` `.picks`):
  - Every full tick checks: next-event gate, each lock re-hashed from its stored bytes, locked before its sourced
    start, and graded after the official result.
  - First real tick record: 2026-10-09T13:16:53Z, PASS, enabled=false, Shanghai NOT_READY.
  - No alert channel is bound in this repo, so a FAIL is recorded and surfaced, not pushed.

### Re-enable procedure (owner/coordinator, only when the gate is READY)
1. `node scripts/picks-gate.mjs` must print `READY` (exit 0). Admin: `POST https://golf-api.propbetedge.ai/admin/picks-gate`.
2. Set `"PICKS_ENABLED": "1"` in `workers/golf-ingest/wrangler.jsonc`, run `npm test`, commit and push, then
   `npx wrangler deploy -c workers/golf-ingest/wrangler.jsonc`. Do this before the gate's `before_lock_cutoff`
   time. The next full tick locks.
3. Verify the lock with `node scripts/picks-gate.mjs --health`. It must show the lock, `seal_verified:true` and
   `locked_before_start:true`.

For Shanghai: ESPN had published 0 entrants at 2026-10-09 13:05Z. The live window opens 2026-10-14 00:00Z, and
the cutoff is the first sourced R1 tee − 30 min (about 22:30–23:00Z). If the gate is not READY in time: HOLD.

## Release gate (original)

AGENTS.md: "No production deployment ... without owner approval." The owner needs to approve:
1. A golf-ingest deploy. It adds the `MARKETS` service binding, `PICKS_ENABLED=1` and the picks step on the full
   tick. Then run `POST /admin/picks-selftest`, which must return `ok:true` to prove create-only on real R2.
2. A golf-api deploy (adds the `PICKS` R2 binding to `golf-source` and the routes).
3. A Vercel push of main. `render.js` NAV changed, so golf-api must ship from the same commit (the deploy rule).

First target: 2026 Buick LPGA Shanghai, starts 2026-10-15 (Thursday local, UTC+8). The live window opens
2026-10-14 00:00Z. The lock must land before the first R1 tee - 30 min, about 2026-10-14 23:00Z if tee times
start near 07:30 local. Shanghai has no cut (2023/2025 had a lone WD marked "cut"), so the make-cut family is
excluded there. Next: Butterfield Bermuda Championship and BMW Ladies Championship (2026-10-22).
Kill switch: `PICKS_ENABLED` in workers/golf-ingest/wrangler.jsonc. Ships as `0` (off); set to `1` only after the storage and timing gates pass, then redeploy golf-ingest.
