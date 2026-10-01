# Roadmap — after Phase 2 (2026-10-01)

1. Owner decisions that unlock depth: a licensed live scoring + statistics provider (SportsDataIO / Sportradar / Data Golf) for tee times, live leaderboards and strokes-gained categories; OpenStreetMap (ODbL) for hole geometry.
2. Apply `golf_write_batch` allowlist migration (prepared in this sprint's notes) so score-depth tables also write transactionally.
3. Extend results history (1980–1999 leaderboards; more tours: DP World Tour, LET, Korn Ferry via Wikipedia articles where present).
4. PBE Golf Rating research in shadow (time-safe, tour-separated, out-of-sample), never labelled OWGR.
5. Network: propbetedge.ai home does not link Golf (cross-repo task for the owner).

---

# Roadmap

Sprint 1: audit, engineering rules, draft graph, responsive prerendered shells, All Access adapter, disabled Workers, news/analytics primitives, tests/browser proof. No deployments/data rows.

Next, after source approval: one permitted PGA TOUR scoring/history lane and one women's lane; document access/terms/robots/cadence, parse approved captures, identity queue, immutable archive. Resource/migration/deployment approval is separate. Do not ingest all history at once.

Then verified live scorecards and leaderboards; one men's and one women's major historical slice; real players/fields/layouts/media; coverage/corrections before breadth. PBEcast observed pulse and Player DNA cohorts precede Course DNA sensitivity research and descriptive Course Fit.

Newsroom runs shadow first, then only publishes after evidence/materiality/duplicate/media/editorial gates and owner approval. Later global/team/match coverage, deeper majors, permitted rankings, gear partnerships and validated models. Speed, women's coverage and provenance remain acceptance criteria throughout.
