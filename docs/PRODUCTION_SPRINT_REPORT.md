# Golf Phase 2 — product depth (2026-10-01)

Owner decisions this sprint: Wikipedia CC BY-SA 4.0 approved as a results source; Wikimedia Commons CC BY / CC BY-SA photographs approved with attribution. No paid source, licence purchase, Stripe product or billing change. PGA TOUR (403), OWGR (scraping banned), ESPN, LPGA site and Data Golf untouched.

## Production

| Component | Version | Rollback |
|---|---|---|
| main | final commit of this sprint (see git log) | 136f16b |
| Vercel `golf` | production deployment of final main (786d3fe = dpl_9VwDinnNosxqKg6PPc86SJhBPndS verified 158/158) | dpl_2esZmJj7uHEQrGAYSuZes9sZzUBJ (136f16b) |
| golf-api | 80cfc31a-25c6-4211-9d09-8cfb66075122 | 20f3cc91-95d2-4430-982d-fd8673d57f8a |
| golf-ingest (cron */10) | 00e6048b-e764-4ca0-8316-da5d5ba57572 | 8d9ccf92-20b2-4e37-87a3-4fa3b3126bc3 (manual-only bootstrap) |
| golf-news (PUBLISH_ENABLED, manual runs) | 2055a4bd-840d-4725-91ac-b9f8bc1a50fb | 1724136b-690b-4165-8bab-6d8af3c43869 |

New resources: KV `golf-state` (734f4f363026466da1f505da5f338dfc), R2 `golf-public` (projection, derivatives, news). SPORTS rows are append/update with ledger; nothing destructive to roll back. To stop ingestion set `golf_sources.automated_access=false` for a source (each lane checks before claiming its lease).

## Data (projection 2026-10-01 18:51 UTC)

| Measure | Before | Now |
|---|---:|---:|
| Players (verified Wikidata humans in golf) | 9 | 1,786 |
| Tournaments (series) | 6 | 115 |
| Editions | 8 | 997 (763 championship editions 1860–2026 + 234 PGA TOUR/LPGA 2024–26 schedule events) |
| Leaderboards | 0 | 247 (100 full field; men 130 / 91, women 117 / 9) |
| Results (finishes) | 8 | 15,327 |
| Player rounds | 0 | 44,447 |
| Hole scores (validated final-round cards) | 0 | 17,190 |
| Courses / venues | 4 | 151; 235 versioned championship setups |
| Men's majors / women's majors editions | 4 / 4 | 479 / 235 (leaderboards for every major 2000–2026: 107 men, 117 women) |
| Photos (rights-approved, displayed) | 0 | 712 players + 60 courses |
| Published stories | 0 | 2 (2026 Open; 2026 Women's British Open) |

Player media coverage: 39.9% of all 1,786 players; top-50 active men 70%, top-50 active women 64%, major champions 71.1% (of 360), 2026 leaderboard fields 45.5% (257 players), prominent players (home, recent winners, featured matchups) 67.3% — below the 80% soft target because Wikidata P18 images do not exist for the rest; every other player gets the identity treatment. Course media 39.7%; recent major venues 12/19.

Player DNA (Results DNA): 8 dimensions live, 13 held (shot statistics and par-type scoring have no approved source). Eligible (Limited+ confidence, 24 months): men 140 (Medium 60, Limited 80), women 27 (Limited 27). No player reaches High in 24 months because majors + The Players supply about 40 rounds at most; regular PGA TOUR/LPGA events in 2024–26 mostly have no per-event Wikipedia article (82+ verified missing), and women have only 9 full-field leaderboards. Course DNA: 13 courses with ≥2 full-field editions (percentiles), 36 with ≥1. Course Fit: 208 player×course pairs, components only, overall score not published.

Current events: PGA TOUR and LPGA 2024–2026 schedules (dates, locations, champions) refresh every 6 h; 12 upcoming events listed; status labels come from schedule dates only. Live scoring, tee times, groups, shot data and rankings: unavailable, shown as explicit unavailable states.

## Known gaps and holds

- `golf_write_batch` allowlist migration (rounds/scorecards/holes/media through the transactional RPC) prepared but NOT applied: the Management API path requires a credential the agent was not permitted to read. Those tables use the JS writer with the same comparison and ledger. Owner can apply when convenient.
- 5 historical edition articles hit timeouts and retry automatically; 2 held (no leaderboard table), 2 Tour Championship articles held (article winner ≠ schedule winner), rows whose published rounds do not sum are held (finish kept).
- Real subscriber / revoked-session production proof: still unavailable (accepted gap). Signed-out and invalid-session premium requests return 403 with no data (verified in production).
- propbetedge.ai home does not link Golf (read-only check). Cross-repo task for the network home, not changed here.

## QA

Unit 92/92 (parsers on CC BY-SA fixtures, planners, writer, DNA tiers/cohorts/time safety, views, news gates, access, source safety). Production browser 158/158 at 320/360/390/430/768/1024/1440: axe WCAG 2.1 AA, no overflow, no console errors, no broken images, no inline styles (CSP), menu/filters/search/matchup canonicalization/PBEcast/no-JS/premium denial/links/SEO. Coverage evidence: `docs/evidence/phase2-coverage.json`.

---

# Golf production sprint — 2026-10-01

The sprint implemented real canonical storage, ingestion, public APIs, populated static pages with progressive canonical refresh, network All Access registration, observed PBEcast archive context and a held newsroom pipeline. This is a real metadata and selected major-history product. It is not accepted as a complete live golf product: no permitted current schedule/scoring feed or comparable statistical sample has been established.

## Infrastructure

SPORTS `tkmlnhmylqnttmnsnief` was independently identified through Supabase project discovery and marker-table queries. The identity/billing project was not used for golf data. The reviewed foundation migration applied transactionally with its SPORTS marker and identity-table guards. The additional source-state table and invoker RPCs bring the total to fifty golf tables. All have RLS; public, anon and authenticated have zero direct table grants. Server queries are constrained to golf tables/RPCs and the exact SPORTS URL. No security-definer functions were added.

Cloudflare resources were inventoried before creation. No Golf Workers or Golf R2 bucket existed. `golf-source` now contains immutable raw source bytes and full dependency evidence packets. `golf-api` has the custom domain `golf-api.propbetedge.ai`; ingestion and news are private service bindings with no public Worker URLs, preview URLs or cron. Credentials remain Worker secrets, never frontend assets. No paid data, contracts, recurring source subscription, Stripe products or billing changes occurred.

The existing Vercel `golf` project was inspected. Pre-sprint production was `golf-2q42yfibk-justins-projects-ad4f4bb7.vercel.app`, repository commit `4ef1278`. The release keeps Vercel as the frontend and proxies `/api/:path*` to the Golf API.

## Data and rights

Production source: Wikimedia Foundation/contributors, Wikidata structured main-namespace data under CC0. Documented `wbsearchentities` discovery and `wbgetentities` captures supply selected identities, birth dates, citizenship labels, courses, edition dates and winner assertions. No Wikipedia prose, linked-site content, cleared athlete portraits, provider rankings or live scoring is imported. Community assertions are clearly labeled; retaining reference statements does not claim independent official verification.

The source registry documents ownership, URLs, fields, history, access evidence, rights, redistribution, cadence, identity, correction behavior and parser version. Final parser: `wikidata-golf/1.1.0`. Earlier unchanged records correctly retain the original parser/capture provenance. Missing source effective timestamps remain null. Month/year dates are not expanded into invented calendar days.

The fixed bootstrap covers sixteen selected seed entities plus at most two bounded dependency requests. Requests use an honest User-Agent, forty-entity maximum, three-megabyte response bounds and at least 1.1-second spacing. Large country claim payloads were narrowed to label-only dependencies after the bound rejected them. The source is manual only; a durable lease excludes concurrent runs and enforces separation. 401/403/429, redirects and challenges latch a blocked source state. No source retry loop, hidden endpoint discovery or access-control evasion exists.

Current graph:

| Entity | Count | Coverage |
|---|---:|---|
| Tours | 2 | PGA Tour and LPGA Tour identities |
| Players | 9 | Human + golf classification + day-precision DOB; distinct Wikidata crosswalks |
| Championships | 6 | Masters, Open, Chevron, U.S. Women’s Open, Women’s PGA, Evian |
| Editions | 8 | Selected 2024–2026 records; four men’s and four women’s editions |
| Courses | 4 | Augusta National, Erin Hills, Royal Portrush, Evian Resort |
| Venue metadata records | 4 | Par, yardage, holes and actual layout versions unavailable |
| Winner assertions | 8 | Position derived only from winner assertion; strokes, to-par and margin null |
| Rounds/scorecards/shots | 0 | Unavailable |
| Identity conflicts | 0 | Unresolved new identities would enter the review queue |

No person is merged by name. Typed transactional writes compare actual PostgreSQL representations, preventing timezone-format changes from generating false updates. Corrections retain before/after records in `golf_source_changes`. Removed winner assertions are excluded from the public winner projection; absent venue claims project unavailable. Raw captures, packets and packet capture links reject update/delete operations.

Repeated bootstrap proved 64 processed, zero inserted, zero updated and 64 unchanged. Successful parse/write time, per-run counters, held records, identity conflicts, errors, parser version and source age are available through source health. The final graph `as_of` represents the last successful canonical validation. Failed new captures cannot make the previous canonical graph look fresh. Every entity separately exposes its original captured evidence timestamp and hash.

## API and product

Public collection endpoints: today, live, tournaments, players, courses, rankings, news and graph. Singular player/course/tournament endpoints and history paths return canonical entities and selected winner history. Unsupported leaderboards, fields and rounds return explicit unavailable coverage, not a winner row disguised as a complete leaderboard. Responses disclose source, as_of, availability, coverage, provenance, freshness and contract version.

Premium Player DNA, Course DNA, Course Fit, PBEcast intelligence and history paths validate network authority before any protected read. Insufficient statistical samples return null after authorization. No guessed percentiles, equal-weight composites, win probabilities or shot trajectories exist.

The homepage uses the latest captured major edition, real venue/date precision and source-reported winner. It contains actual results, men’s/women’s editions, players and course links. The daily desk explicitly states that current PGA TOUR/LPGA schedules and scoring are unavailable. The frontend has twenty-one populated entity pages plus discovery/championship routes. Course pages distinguish a venue identity from a verified tournament layout. Player pages show source identity, citizenship/birth date and the observed major sample, never career totals from this partial archive.

PBEcast is an observed archive selector: real edition, date/status, source-reported winner and venue context, including women’s majors. Active holes, scorecards, pulse and shots remain unavailable. The original decorative course simulation is not shown on the populated archive view.

Frozen public snapshots are exported from SPORTS for the immediate no-JavaScript response. A bounded same-origin request progressively refreshes the canonical projection. Errors preserve the saved capture with an explicit API-unavailable label. No provider or database calls originate in the browser. The membership page reflects the authority verdict and fails closed on transport/format errors.

## All Access

Deployed auth-magic source was downloaded and compared to its repository before the additive change. Only Golf’s membership allowlist, CORS origin, safe return host and display label changed. Existing billing checks, subscription semantics, cookie signing, product key and authority bindings remain intact. Network repository commit: `afa521d`. Deployment: `d77fa76e-9eeb-4ef9-a4fb-6473c213b2f5`. Thirty-eight authority tests pass, including active All Access, owner, canceled/expired, sport-only, invalid session and billing outage.

Production API signed-out and invalid-session tests deny premium requests without values and use `Cache-Control: no-store`. Real signed-in subscriber/revoked-account browser proof remains unverified because no authenticated account session is available to this agent. Synthetic test sessions are not described as production subscriber proof. Golf has no separate account, purchase product or Stripe checkout.

## News and network

Eight frozen historical packets and eight held articles were created in shadow mode. A second run suppressed all eight duplicates. Numeric edition claims are fact references; unsupported prose, missing facts and nonmaterial events hold. Historical metadata is not mislabeled as current news. Packet evidence includes player/tournament/course links, coverage and correction predecessors. No article was published and there is no publish endpoint or automatic schedule.

Golf links to network Home, existing All Access, Learn and `@PROPBETEDGE`. It uses the existing network GA4 property `G-BRS48R8PG9` on the production host, with no personal/session data in event parameters. Canonicals, OG/share metadata and conservative sourced Person/Place/SportsEvent schema are present. Incomplete metadata/entity pages remain noindex; robots disallows indexing and no thin-page sitemap is submitted. The read-only network-home check found no Golf link in its server HTML; sibling/newsroom repositories were not modified.

## Evidence and release limits

Required gates: check, build, test, qa:browser and guard. Expanded browser coverage exercises all twenty-one entity pages at 320, 360, 390, 430, 768, 1024 and 1440, including axe WCAG checks, keyboard filters, PBEcast selection, no-JavaScript content, same-origin API and premium denial. Final release/production results are recorded in `docs/evidence` and the final deployment manifest.

Final result: all five required gates passed. Golf has 68 passing unit tests; network authority has 38. The local browser suite passed 306 checks. After the CSP fix, production passed 217 page/width combinations across all seven widths, with zero axe violations, horizontal overflows or browser console/page errors. Production keyboard filters, women’s PBEcast selection, no-JavaScript entity content, signed-out membership and unknown-entity 404s also passed. Maximum observed synthetic CLS was 0.01385. Existing GA4 loaded on the production host. Canonical/OG/schema checks passed; partial pages remain intentionally noindex.

Live frontend product revision: `4bde24bf3aa230eeb329914a229ddeaadd2351d5`, including the initial product commit `6bdd1a2`. Vercel production deployment: `dpl_ACpEMBhBTjCt8ZpGCcF5dXb9yLdv`, `https://golf-x8s3clsi8-justins-projects-ad4f4bb7.vercel.app`, aliased to `https://golf.propbetedge.ai`. Final Worker versions: API `20f3cc91-95d2-4430-982d-fd8673d57f8a`; ingestion `8d9ccf92-20b2-4e37-87a3-4fa3b3126bc3`; shadow news `1724136b-690b-4165-8bab-6d8af3c43869`. Network auth revision is recorded above. The proof/report commit adds no frontend or Worker behavior; the deployment manifest identifies the tested product revision separately.

`storage-proof.json` proves typed idempotence, transaction/ledger rollback and capture/packet immutability on SPORTS. `raw-proof.json` proves a downloaded R2 dependency packet matches its canonical SHA-256. `api-proof.json` records production routes and signed-out/invalid authorization. Browser reports/screenshots record actual rendered pages.

Remaining external data gates: permitted current PGA TOUR and LPGA schedules, leaderboards, scorecards, tee times, detailed layouts, statistics and rankings. PGA TOUR’s prior 403 remains a hard stop; OWGR scraping remains rejected; other provider rights are unresolved. No public webpage or owner authorization was treated as a third-party commercial feed license. Source restrictions block those lanes without blocking the real metadata/history product.

The final approved-source check found 2026 PGA TOUR and LPGA season identities, but neither entity supplied constituent tournament records, fields or scoring. The LPGA season boundaries were not substituted for individual event dates. Three bounded searches for specific late-season events returned no matches. `evidence/current-feed-discovery.json` retains the exact inspected property coverage and raw capture hash. Current/next event coverage is therefore unestablished, not silently treated as complete.

Production QA initially caught Google Analytics image requests to its documented script host being blocked by CSP. The fix permits that exact image origin and adds a transport regression check; script and connection origins remain scoped. The production suite was rerun after deployment. Layout-shift observations are synthetic browser measurements, not field Core Web Vitals.

Acceptance: canonical storage/provenance, real entity pages, winner history, public API, populated homepage, free-reader premium denial, mobile and deployed production are proved. Full acceptance is incomplete: a current tournament/scoring lane is absent, PBEcast provides archive context rather than live play, statistical intelligence remains unavailable, and real subscriber/revoked-session production proof is missing. No current schedule or statistical claim is fabricated to satisfy those gates.

## Rollback

Frontend baseline: Vercel `golf-2q42yfibk-justins-projects-ad4f4bb7.vercel.app`, Git `4ef1278`. Network auth baseline: Worker `b82680f8-445a-4fc6-a129-c6eaa531dce9`, Git `20f0075`. Exact final and previously verified Golf Worker revisions are captured in the deployment manifest. Disable the Wikidata source’s automated_access flag to prevent administrative ingestion; news publication is already disabled. Preserve SPORTS rows, immutable R2 captures and migration history. No destructive database rollback is recommended or executed.

Known-good recovery commands, provided for an owner-initiated rollback and not executed during this release:

```powershell
npx.cmd vercel rollback golf-2q42yfibk-justins-projects-ad4f4bb7.vercel.app --yes
npx.cmd wrangler rollback e8fd399e-dd19-426c-b02b-752d138dc0ea --config workers/golf-api/wrangler.jsonc --yes
npx.cmd wrangler rollback b0056111-9545-4603-96de-6762503d77f8 --config workers/golf-ingest/wrangler.jsonc --yes
npx.cmd wrangler rollback 1724136b-690b-4165-8bab-6d8af3c43869 --config workers/golf-news/wrangler.jsonc --yes
npx.cmd wrangler rollback b82680f8-445a-4fc6-a129-c6eaa531dce9 --name propbetedge-auth-magic --yes
```

Restoring the network auth baseline removes Golf registration and makes Golf premium access fail closed. Existing billing semantics are unchanged by either revision. Golf had no pre-sprint deployed Workers; the Golf Worker recovery targets above are earlier verified sprint revisions. Configs remain manual, with no cron; disabling the approved source stops subsequent bootstrap requests without deleting evidence.
