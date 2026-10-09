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

## All Access repairs (2026-10-09; previously pre-existing gate failures)
1. **Guard.** `npm run guard` failed on `src/lib/all-access-page.js` because the file carried an unused copy of
   the network Stripe Payment Link (`ALL_ACCESS_CHECKOUT_URL`). Golf has never linked to Stripe and the owner
   rules say never repoint links. The guard is right: keep checkout hosts out of Golf browser code. The canonical
   link stays with the network `/pro` and the shared commerce system. Fix: the constant was removed; it was never
   rendered. The test now asserts that Golf exports no checkout constant and that the page contains no Stripe host.
   The guard is unchanged and passes (rc 0).
2. **/all-access contrast.** The "YOU ARE HERE" label (`.aa-sports .is-here em`) was #8a6a2c on #f7efd9, about
   4.4:1. It is now warm brown #7a5a1f, about 5.5:1 (WCAG AA). This fixes all 9 widths.
3. **Production consent banner.** `#pbe-consent a` is now underlined (axe `link-in-text-block`). Only the Golf copy
   of `public/pbe-consent-v1.css` changed; other network sites may carry the same rule.

## Public languages: es, ja, ko (2026-10-09, Global Issue #67)
Owner GO 2026-10-09 ("OWNER GO — PROPBETEDGE GLOBAL"). Home and All Access are public in Spanish, Japanese and Korean:
`/es/`, `/ja/`, `/ko/`, `/es/all-access`, `/ja/all-access`, `/ko/all-access` (pbe-locale/1.0.0, `src/i18n/`).
- Every build publishes them (`src/i18n/ready.js` PUBLIC_LOCALES). Pages are self-canonical, indexable, with reciprocal
  hreflang (en/es/ja/ko + x-default), a language switch (header globe; menu row on narrow phones) and sitemap entries with
  xhtml:link alternates (`sitemaps/pages.xml`). English pages change only by the alternates, the switch and the locale CSS.
- ja/ko are acquisition pages: no prediction-market, partner or sportsbook modules (removed at build and never hydrated by
  main.ts), All Access CTA to `https://propbetedge.ai/{ja,ko}/pro?via=golf`, price `月額 US$29` / `월 US$29`, footer legal
  link (特定商取引法に基づく表記 / 사업자 정보). Spanish keeps the English `/pro` link.
- No change to render.js/seo.js/article.js: no golf-api deploy is needed for this release.
- Compare English output: `PBE_LOCALES=en npm run build:local` (local only; production ignores it).
- Rollback: Vercel production `dpl_GpaSGup4MEWYdr6CPvoFvj4jn9SH` (main 61096d7).
- Released 2026-10-09: main `a6c1ec5`, Vercel production `dpl_B4kjo7ahWgfiMLc1FsjkEBphv8se`
  (golf-cl3dejiz4-justins-projects-ad4f4bb7.vercel.app). Production locale QA 56/56 runs (en/es/ja/ko x home/All Access x
  320/360/390/430/768/1024/1440, 9 checks each: overflow, console, lang, canonical/hreflang/robots, switch hrefs, CTA hrefs,
  ja/ko market-free + legal link, price, untranslated residue, switch round trip). CTA/legal targets on propbetedge.ai live.
