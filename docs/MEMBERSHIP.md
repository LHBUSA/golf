# All Access from day one

Golf has no standalone subscription/checkout/Stripe product. Learn/purchase links use existing [All Access](https://propbetedge.ai/pro). No stale sibling price/promotion is copied.

Canonical reference: soccer workers/soccer-api/src/pro/access.js uses AUTH service binding to propbetedge-auth-magic, GET /membership?sport=soccer, forwarding only pbe_session. Auth validates the session and consults existing sports-billing for pbe_all_access. Shared contract source: LHBUSA/propbetedge-workers shared/membership/pbe-membership.js. Soccer contract 1.3.0; tennis 1.2.0. Upstream repository not independently inspected here.

Golf adapter asks sport=golf and grants only matching sport, entitled=true, all_access/access_source=all_access or owner/access_source=owner. sport_pro, malformed, stale/failed authority, missing binding, timeout and unknown source deny. No email, header, localStorage, pricing or client state grants access. Duplicate/malformed session cookies deny; only pbe_session is forwarded.

Premium gate precedes data reads; denial is 403 with no intelligence values. Granted foundation response is data:null because no graph exists. All protected responses are no-store. Public routes never invoke auth. Direct Supabase client policies are absent.

All Access UI is a truthful shell, not live sign-in. Production needs confirmed golf support in network authority, binding registration and same-origin Vercel proxy forwarding only the session on protected routes, stripping client entitlement headers and disabling protected cache. No proxy target is configured before deployment. Real member/expired/cancelled/past_due/owner/free sessions require end-to-end validation; no identity-project mutation in this sprint.
