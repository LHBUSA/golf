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
