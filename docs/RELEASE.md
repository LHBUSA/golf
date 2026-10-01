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
