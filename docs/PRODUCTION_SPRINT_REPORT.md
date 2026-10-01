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

`storage-proof.json` proves typed idempotence, transaction/ledger rollback and capture/packet immutability on SPORTS. `raw-proof.json` proves a downloaded R2 dependency packet matches its canonical SHA-256. `api-proof.json` records production routes and signed-out/invalid authorization. Browser reports/screenshots record actual rendered pages.

Remaining external data gates: permitted current PGA TOUR and LPGA schedules, leaderboards, scorecards, tee times, detailed layouts, statistics and rankings. PGA TOUR’s prior 403 remains a hard stop; OWGR scraping remains rejected; other provider rights are unresolved. No public webpage or owner authorization was treated as a third-party commercial feed license. Source restrictions block those lanes without blocking the real metadata/history product.

## Rollback

Frontend baseline: Vercel `golf-2q42yfibk-justins-projects-ad4f4bb7.vercel.app`, Git `4ef1278`. Network auth baseline: Worker `b82680f8-445a-4fc6-a129-c6eaa531dce9`, Git `20f0075`. Exact final and previously verified Golf Worker revisions are captured in the deployment manifest. Disable the Wikidata source’s automated_access flag to prevent administrative ingestion; news publication is already disabled. Preserve SPORTS rows, immutable R2 captures and migration history. No destructive database rollback is recommended or executed.
