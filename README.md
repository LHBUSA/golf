# PropBetEdge Golf Intelligence

Premium global golf intelligence. PGA TOUR is the primary men's product; LPGA and women's majors share first-class coverage architecture. Golf belongs to existing PropBetEdge All Access / Pro Club. No golf checkout.

Node 24+. Run `npm ci`, `npm run dev` (127.0.0.1:5173). `npm run build` creates prerendered Vite pages. Small TypeScript enhancements add navigation and filters; built shells work without JavaScript.

Checks: `npm run check`, `npm run build`, `npm run test`, `npm run qa:browser`, `npm run guard`. Registry: `npm run audit:sources`. Approved metadata-only probes: `npm run canary:sources`.

Production sprint: SPORTS now stores a real CC0 metadata and major-history graph. Golf Workers read and ingest canonical data; Vercel uses the same-origin `/api` proxy. The static snapshot is exported from SPORTS and progressively refreshed through the public API. The current slice contains nine players, eight editions, four venues and eight source-reported winner assertions. It is an incomplete archive, not a live scoring feed. Missing scores, statistics and rankings remain unavailable; incomplete pages remain noindex. No database credentials reach the browser.

Read [production sprint](docs/PRODUCTION_SPRINT_REPORT.md), [source decisions](docs/SOURCE_DECISIONS.md), [architecture](docs/ARCHITECTURE.md), [release boundary](docs/RELEASE.md) and [AGENTS.md](AGENTS.md). FIRST_SPRINT_REPORT.md describes the earlier undeployed foundation, not the current production state.

Operational scripts run from the repository root. `node scripts/ops.mjs bootstrap` executes an authenticated, fixed, bounded Wikidata bootstrap through golf-api → golf-ingest. `node scripts/export-public.mjs` exports the canonical public projection before the frontend build. `node scripts/ops.mjs shadow` creates held newsroom packets, never publishes. Local credential files are ignored. `node scripts/verify-storage.mjs`, `node scripts/verify-raw.mjs` and `node scripts/prove-api.mjs` record production evidence without printing secrets. Migrations require independently verified SPORTS targeting; the foundation migration additionally requires `app.golf_target_project` set to the SPORTS ref in its transaction. No automatic migrations or Worker GitHub Actions exist.
