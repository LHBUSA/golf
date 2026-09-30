# Sprint 1 delivery report

Date: 2026-09-30. Repository was empty at start.

## Source audit

24 registered source candidates: 3 APPROVED (restricted metadata/media pathways), 13 HOLD, 1 REJECT, 7 OWNER DECISION. Wikidata and Wikimedia Commons APIs returned 200 for bounded metadata-only canaries (hashes/status in source-canary.json); neither response was ingested. PGA TOUR terms returned 403 and the audit stopped. OWGR terms expressly prohibit website scraping/data mining, so OWGR website ingestion is REJECT. Public-facing leaderboard availability is not commercial permission. No automated scoring source was approved, robots checks for unapproved candidates were not made, and no paid API/contract was acquired.

Immediately possible: cited metadata candidates after per-record reference/identity review, plus individually rights-reviewed photos. No live scores, statistics or historical player data have been ingested.

## Foundation

49 golf_-prefixed canonical tables drafted with RLS, client access revoked, UUID identity/crosswalk and review queue, captured source provenance, annual editions, versioned course layouts, stroke/team/match/playoff and altered-round models, historical snapshots, statistics/ranking methodology and evidence-linked newsroom/media. Target is SPORTS only. SQL parsed as 163 statements, never executed against a database. 51 unit tests passed.

Vite renders 22 clean discovery/championship URLs. Today, Live, tournament, player, course, ranking, major, PBEcast, News, Intelligence and All Access views have honest empty states. The homepage has local real CC0 golf photography with author/source credit, byte hashes and responsive AVIF/WebP sizes. Initial screenshot artifacts: evidence/screenshots/home-390.png, home-1440.png, pbecast-1440.png. Browser QA verifies seven widths, heading/title per route, no overflow/console errors, axe WCAG checks, keyboard menu/filter and no-JavaScript output. Final browser run passed 151 of 151 checks: 147 route/viewport combinations plus four interaction/no-JavaScript checks. All seven widths (320, 360, 390, 430, 768, 1024, 1440) showed no horizontal overflow or console errors; axe WCAG 2.1 AA scans passed. Evidence: evidence/browser-results.json and the three screenshots in evidence/screenshots/.

All Access uses the existing network authority contract shape. Only server-verified all_access or owner grants; unknown/auth failure denies before protected data reads. No golf checkout/Stripe product. Real authority connection requires deployed same-origin proxy and owner approval.

golf-ingest and golf-news are disabled. golf-api returns no data. Three Wrangler dry runs succeeded; API AUTH binding types generated. No resource, deployment or external publication occurred. News packets are hash-linked/frozen; current validator can only validate/hold, never publish. Player DNA returns no fabricated percentile. Course DNA is blocked until real sample/layout coverage. Course Fit is designed as explained descriptive components, with no score/prediction. PBEcast displays no live action or shot path.

## Limitations / next approvals

No approved live scoring, tee-time, shot, statistical or ranking feed; no product data rows; no real-user identity session; no complete major archive. Photographs of named venues/players need per-asset proof. Required approvals: specific source rights, verified SPORTS migration validation/application, Cloudflare resources and deployment, Vercel/domain/proxy/deployment, network golf registration if needed, and future automated publishing/media policy. Full list is in RELEASE.md.
