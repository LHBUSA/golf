# PropBetEdge Golf Intelligence

Premium global golf intelligence. PGA TOUR is the primary men's product; LPGA and women's majors share first-class coverage architecture. Golf belongs to existing PropBetEdge All Access / Pro Club. No golf checkout.

Node 24+. Run `npm ci`, `npm run dev` (127.0.0.1:5173). `npm run build` creates prerendered Vite pages. Small TypeScript enhancements add navigation and filters; built shells work without JavaScript.

Checks: `npm run check`, `npm run build`, `npm run test`, `npm run qa:browser`, `npm run guard`. Registry: `npm run audit:sources`. Approved metadata-only probes: `npm run canary:sources`.

Phase 2 (2026-10-01): Golf runs on real data. Scheduled golf-ingest lanes pull Wikidata (CC0: every edition and champion of the nine majors and The Players, player and venue identities), Wikipedia (CC BY-SA 4.0, owner approved: leaderboards, round scores, fields, cuts, setups, PGA TOUR/LPGA 2024–2026 schedules) and Wikimedia Commons (per-image CC0/BY/BY-SA photographs). Responses are archived to R2 before parsing; canonical rows land in SPORTS `golf_*` with a correction ledger; a versioned projection in R2 feeds golf-api (`golf-public/2.0.0`) and the prerendered Vercel site. Live scoring, tee times, shot data and strokes-gained categories remain unavailable from approved sources and are shown as such.

Operations: `node scripts/ops.mjs seed` (source registry rows), `bash scripts/backfill.sh results N` and `bash scripts/media-loop.sh N` (bounded admin runs), `node scripts/media-derivatives.mjs` (hash-verified AVIF/WebP), `POST /admin/run?lane=project` (projection), `POST /admin/news-shadow` then `/admin/news-publish`. Build: `npm run build` exports the live projection then prerenders; `npm run build:local` reuses `data/public/bundle.json`.

Read [production sprint](docs/PRODUCTION_SPRINT_REPORT.md), [source decisions](docs/SOURCE_DECISIONS.md), [architecture](docs/ARCHITECTURE.md), [release boundary](docs/RELEASE.md) and [AGENTS.md](AGENTS.md). FIRST_SPRINT_REPORT.md describes the earlier undeployed foundation, not the current production state.

Operational scripts run from the repository root. `node scripts/ops.mjs bootstrap` executes an authenticated, fixed, bounded Wikidata bootstrap through golf-api → golf-ingest. `node scripts/export-public.mjs` exports the canonical public projection before the frontend build. `node scripts/ops.mjs shadow` creates held newsroom packets, never publishes. Local credential files are ignored. `node scripts/verify-storage.mjs`, `node scripts/verify-raw.mjs` and `node scripts/prove-api.mjs` record production evidence without printing secrets. Migrations require independently verified SPORTS targeting; the foundation migration additionally requires `app.golf_target_project` set to the SPORTS ref in its transaction. No automatic migrations or Worker GitHub Actions exist.
