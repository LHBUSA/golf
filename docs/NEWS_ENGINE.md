# Newsroom — Phase 2 (2026-10-01)

`golf-news` builds one *final result* story per completed edition (ended within 75 days of the projection, leaderboard coverage required). Packet facts come from the edition document (capture-referenced); templates contain no digits — every number is substituted from a fact. Gates: facts present, materiality (`tournament_final`), duplicate (`dedupe_key` per edition), numeric grounding (template digit check + fact placeholders), identity (canonical winner), media (only rights-approved photos with credit), editorial (headline without numbers, no prediction/odds/injury language). `PUBLISH_ENABLED=true` permits `/admin/news-publish`; shadow runs (`/admin/news-shadow`) never publish. Published stories go to R2 `news/v1/index.json` and render on `/news`. No schedule: runs are manual after projection refreshes.

---

# Golf newsroom

Cloudflare golf-news foundation cannot publish. No cron, secrets, model spend or external article publication.

Canonical graph → frozen packet → deterministic facts → editorial → fact validation → materiality/duplicate/quality gates → publish or hold. Packets retain event key, schema, capture references, source dates, format, coverage and hash. Captures/packets are immutable; corrections create new evidence.

Implemented primitives clone/hash/deep-freeze packets and require fact capture references/non-null values. Material event types are allowlisted. Duplicate event keys hold. Numbers must render by fact reference; numeric prose, quotes and sensitive claims hold. Output is validated/hold, always publish_allowed=false. This is not a production editor or complete semantic fact checker.

Future composer uses typed facts and documented units/precision. AI editorial pass needs separate configuration and spend approval; none implemented. Quality includes factual status, format, dates, coverage, relevance, licensed photos and no invented quote/injury/motivation/betting claim.

Material candidates: round/edition completion, official cuts, meaningful lead changes and licensed ranking updates. Comparable snapshots are necessary. No publication quota or filler. Proposed 30m live-window checks and daily ranking checks must respect source cadence and owner Cron approval.

Durable duplicate key is event/angle/evidence; compare previous fact sets and require meaningful new facts. Current event-key primitive is not semantic duplicate suppression. Production publish transaction must claim key, validate source/media/editorial state and record publication atomically. No publication endpoint exists here.

Recap/preview/form/difficulty/historical-comparison story types need dedicated schemas and thresholds. Historical comparisons state observed coverage. Retract/correct with packet lineage and new revision, never silently mutate frozen evidence.
