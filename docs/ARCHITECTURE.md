# Architecture — Phase 2 (2026-10-01)

```text
Wikidata WDQS ─┐                       ┌─ golf_* canonical graph (SPORTS tkmln)
Wikipedia API ─┼─ golf-ingest lanes ───┤   (golf_write_batch RPC + ledgered direct writer)
Commons API ───┘  capture → R2 raw     └─ golf_source_changes correction ledger
                         │
                 projection builder (golf-ingest, after writes)
                         │  versioned public documents → R2 golf-public/projection/v2/*
                         ▼
golf-api (golf-api.propbetedge.ai) ── /v1/* public contract golf-public/2.0.0
                         │            /v1/intelligence/* (All Access, authorized before any read)
                         ▼
Vercel golf project: build = export projection → Vite → prerender (all entity pages, sitemap)
                     /api/* same-origin proxy; /matchups/:a/:b → client view
golf-news: projection → frozen packets → gates → publish to R2 news/v1 (manual admin runs)
```

Lanes (one lease per source, `golf_claim_source`): `catalog` (Wikidata, daily), `schedule` (Wikipedia season articles, 6 h), `results` (edition articles; 6 h for recent editions, 30 days for history, revision-checked first), `media` (Commons, daily). Cron `*/10` picks the most-due lane; each run is time-boxed (200 s) inside a 5-minute lease. Item cursors live in KV `golf-state` (`items:v1`); an item that dies mid-run is marked and counted as a failed attempt (3 attempts then weekly retry). 401/403/407/429, redirects, challenges and unapproved hosts latch the source `blocked` until reviewed.

Every response is archived to R2 `golf-source` by SHA-256 before parsing (SPARQL query text archived by hash) and registered in `golf_source_captures` with parser and rights versions. Writes: the reviewed `golf_write_batch` RPC for identity/edition/result tables; `golf_rounds`, `golf_scorecards`, `golf_holes`, `golf_hole_scores` and `golf_entity_media` use a JS writer with the same typed comparison and before/after ledger (the RPC allowlist migration is prepared but was not applied; see report).

The projection is the only thing the API and frontend read: per-player, per-edition and per-course documents plus an index. Premium values exist only in R2 documents and are split by `workers/shared/views.js`, which both the API and the static prerender use, so static HTML never contains premium values.

---

# Architecture

Production update, 2026-10-01: the metadata/history graph is applied to independently verified SPORTS, Workers and R2 are deployed, and Vercel serves populated canonical pages through `/api`. Network auth has additive Golf registration. The remaining foundation discussion below records the earlier draft state; [the production report](PRODUCTION_SPRINT_REPORT.md) and deployment manifest describe the implemented runtime and its explicit data limits.

GitHub = source. Vercel = frontend. Cloudflare Workers = runtime/automation. Supabase SPORTS = canonical golf graph. R2 = immutable evidence/media. KV = disposable cache/state.

```text
approved source → golf-ingest → immutable capture → parser → identity → SPORTS golf_*
SPORTS → golf-api → same-origin Vercel proxy → prerendered Vite frontend
SPORTS → golf-news → frozen packet → facts → editorial → validation → hold/publish
network auth-magic → sports-billing All Access verdict → golf-api premium gate
```

Read-only sibling findings: soccer docs identify SPORTS `tkmlnhmylqnttmnsnief`, distinct from identity/billing `rlfy*`. This sprint did not independently contact either project. Soccer uses prefixed tables, RLS without client policies, immutable captures, pure parsers and identity crosswalks. Tennis informs historical prerendering, evidence, media and PBEcast patterns. No sibling modification.

Workers are deliberately undeployed. golf-ingest has a disabled scheduler and health/status surface; golf-news cannot publish; golf-api returns explicit unavailable collections and gates premium requests before reading values. Configs have no crons/resource IDs and disable workers.dev/previews. Proposed AUTH binding points to existing propbetedge-auth-magic, which was not changed.

Future ingestion: source registry permission → bounded honest request → immutable archive before parsing → versioned parser → evidence capture → identity resolution/review → transaction/upsert → source change ledger. Access barriers disable the lane until reviewed; no retries or evasion. Distributed per-host rate limits and durable block latches are prerequisites to cron enablement.

SPORTS alone receives golf tables. Browser never calls providers/Supabase or holds a service key. Scoped server grants need separate review. Raw path: `golf/raw/{source}/sha256/{hash}`; create-if-absent. Preserve hash, URL, captured/effective times, parser and rights versions. Media derivatives use content hashes plus transform versions. KV never becomes identity/source truth or sole duplicate authority.

Future cache: live 15–30 seconds only within allowed cadence; tee times five minutes; rankings one hour after updates; history long-lived with revision invalidation. Keys include edition/round/schema/source revision. Premium and membership use private no-store initially, never shared cache. Health does not claim graph connectivity.

Frontend: Vite, TypeScript DOM enhancements, shared render components and local CSS tokens. All shells are prerendered with first-response metadata/canonical; zero foundation fetches, no blocker/waterfall. Analytics will load separately after entitlement. Public and premium projection contracts stay separate.

SEO: entity UUID slugs, valid Person/SportsEvent/Article data only when actual evidence exists. Foundation noindex and robots disallow prevent thin-page indexing. No sitemap until quality gates pass. Static 404 with no wildcard SPA rewrite. Same-origin API/auth proxy is a production integration task after owner-approved deployment.
