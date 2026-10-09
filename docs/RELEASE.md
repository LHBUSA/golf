# Release — Phase 2 (2026-10-01)

Order: deploy golf-ingest → run lanes → build projection (`/admin/run?lane=project`) → deploy golf-api / golf-news → push main (Vercel production build exports the projection; a failed export fails the build and leaves the previous deployment live). Derivatives: `node scripts/media-derivatives.mjs` (hash-verified, resize-only) then rebuild projection. News: `/admin/news-shadow`, then `/admin/news-publish`. Rollback targets are in the Phase 2 section of PRODUCTION_SPRINT_REPORT.md.

---

# Release boundary

Production update, 2026-10-01: the owner explicitly authorized the production sprint, including reviewed SPORTS schema application, normal infrastructure configuration, controlled ingestion, Workers/Vercel deployments and safe main pushes. Those actions are complete for the metadata/selected-major-history slice. Paid data, new paid agreements, billing changes, access evasion and uncontrolled news publication remain prohibited. Current release proof and exact rollback revisions are in [the production report](PRODUCTION_SPRINT_REPORT.md) and `evidence/deployment-manifest.json`. The original foundation-only boundary below is historical and does not revoke the explicit sprint authorization.

No resources created, migrations applied, Workers/frontend deployed, articles published, paid data purchased, licences accepted or Stripe products created. No GitHub Actions Worker deployments.

Required owner approvals:

1. Specific source/provider conversation or permitted feed, including public/premium/derived/news/archive rights and cadence. OWGR website remains rejected.
2. Independently verified SPORTS project tkmlnhmylqnttmnsnief; reviewed SQL/privileges and explicit migration application. Validate in an approved test DB first; never identity/billing.
3. Cloudflare Workers and R2/KV creation, scoped secrets/AUTH binding and deployment. Schedules require reviewed source limits and operational canaries.
4. Vercel/domain/project and production frontend/proxy. Confirm whether pushing main triggers production; pushes are source-authorized, production deployment is not. Keep noindex until useful data/SEO review.
5. Network golf registration if required and real-session All Access proof; no billing product.
6. External automated news publication after shadow proof. Purchased media or CC BY/SA obligation policy needs separate rights review.

Preflight: five required checks; refreshed registry/terms; SQL/RLS/transaction proof; honest canaries and durable rate/block latch; real free/member/revoked sessions; no shared premium cache; correction/retraction/media provenance; responsive performance and SEO gates.

Rollback stops ingestion/news, restores prior frontend and revokes source lane. Database rollback requires reviewed migration, never drop sourced history. No auto-deploy commands included. Local commits/pushes are authorized but must not implicitly deploy production.

## Deployment rule: server-rendered SEO and articles

Golf news HTML (every `/news/*` page, its JSON-LD, Open Graph tags and article body) is rendered by the
`golf-api` Worker (`workers/golf-api/src/news-ssr.js` imports `src/lib/render.js`, `src/lib/seo.js` and
`src/lib/article.js`). Static pages (players, courses, tournaments, majors) are prerendered by the Vercel build.

Any change to Golf server-side SEO or article rendering (`src/lib/render.js`, `seo.js`, `article.js`,
`image-metadata.js`, `charts.js`, `movement.js`, `ui.js`, or styles they emit) therefore requires BOTH:

1. the frontend/Vercel deployment (push to main), when static pages are affected, and
2. a fresh `golf-api` deployment built from that same main commit.

A Vercel push alone leaves news pages on the old renderer. Verify with a cache-busted `/news/<slug>` fetch after
deploying. `tests/deploy-rule.test.mjs` fails if `golf-api` stops sharing the site renderer.

## Final production state (Golf closed 2026-10-02)

- main `ff255a9`; golf-api `362c2efb` at 100% (rollback `92e78500`)
- unit tests 166/166; production QA 158/158; ImageObject production proof 5/5 pages clean
- Newsroom: final, preview and course intelligence publishing (deterministic Golf Desk v5, $0 API cost);
  round recap SHADOW (2 real completed-round packets)
- Only intentional follow-up: when a third real completed-round packet exists, run the round-recap canary on all
  three real packets and promote round recap only if the factual and editorial gates pass.
- An OpenAI writer comparison is an optional future experiment, not a release blocker.

## Pre-existing gate failures (documented 2026-10-09, Golf Picks release)

Both reproduce on an untouched `origin/main` (f3e7bba) build. Golf Picks does not touch the files involved. Both
are left for the All Access owner session, because fixing them means editing the vendored All Access contract or
page styles.

1. `npm run guard` exits 1 with `AssertionError: src/lib/all-access-page.js`. The browser-boundary rule rejects
   `buy.stripe.com` in `src/`, and `all-access-page.js:12` exports `ALL_ACCESS_CHECKOUT_URL` (a vendored network
   constant asserted by `tests/all-access.test.mjs:13`; the file says it is not used on this site). With that one
   file excluded, every other guard assertion passes on the Picks branch.
2. `qa:browser` has 9 failures, `<width> /all-access` at all 9 widths:
   `axe color-contrast: span[aria-current="page"] > em`. It reproduced on origin/main at 320 and 1440 (2/2 failed,
   same node).
