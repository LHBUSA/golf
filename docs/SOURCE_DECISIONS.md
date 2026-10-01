# Source decisions — Phase 2 (2026-10-01)

OWNER APPROVAL (2026-10-01): Wikipedia (CC BY-SA 4.0) approved as a results source, and Wikimedia Commons CC BY / CC BY-SA photographs approved with per-image attribution. Recorded in `data/source-registry/sources.json` (`owner_approval_2026_10_01`).

| Source | Verdict | Lane | What it supplies |
|---|---|---|---|
| Wikidata (CC0) | APPROVED | `catalog` daily | 763 championship editions with champions (nine majors + The Players, 1860–2026), player identities, DOB precision, country for sport, venue identity/coordinates/architects, P18 image pointers, crosswalk IDs (stored, never called) |
| Wikipedia (CC BY-SA 4.0) | APPROVED | `results` (6 h recent / 30 d history, revision-checked), `schedule` (6 h) | Leaderboards and round scores 2000–2026, field size, cut line, setup par/yardage and hole tables, final-round leader scorecards, PGA TOUR and LPGA schedules 2024–2026 |
| Wikimedia Commons | APPROVED (CC0/PD/BY/BY-SA) | `media` daily + hash-verified derivatives | Player and course photographs tied to the entity P18 |
| Poly Haven | APPROVED (CC0) | manual | Home background only (labelled not a venue) |
| OpenStreetMap | OWNER DECISION | disabled | Hole geometry/par for some courses; ODbL share-alike on derived databases |
| SportsDataIO, Sportradar | OWNER DECISION | disabled | Live scoring, tee times, statistics — paid |
| The Odds API (golf) | OWNER DECISION | disabled | Outrights only; other sports' approvals do not carry over |
| Data Golf | OWNER DECISION | disabled | Strokes-gained and model data — paid |
| DBpedia | REJECT | — | Redundant derivative of Wikipedia |
| Kaggle/GitHub PGA TOUR scrapes | REJECT | — | Uploader licences cannot grant upstream rights |
| USGA course rating DB | HOLD | — | Personal, noncommercial terms |
| PGA TOUR, ESPN, LPGA site, OWGR | unchanged (HOLD 403 / HOLD / HOLD / REJECT) | — | Not used; not worked around |

Identity: every person enters only as a distinct Wikidata human classified as a golfer. Leaderboard rows are linked through the row's own article link → Wikidata QID (documented page properties). Unlinked rows go to `golf_identity_queue`; nothing is merged by name. Final-round scorecard rows (surname labels) are linked to a leaderboard row of the same frozen article only when the surname and flag are unique and the derived hole strokes reproduce that player's published round exactly.

Data quality rules: rows whose published rounds do not sum to the published total keep their finish but hold their round scores; Wikipedia/Wikidata winner disagreements hold the whole edition; event articles found by title convention are accepted only if their winner matches the tour schedule.

Still not available from any approved source: live scoring, tee times/groups, shot-level data, strokes gained by category, driving/approach/putting statistics, official rankings. These remain explicit unavailable states.

---

# Source decisions — 2026-09-30

OWNER APPROVAL (2026-09-30): The owner stated “all sources approved.” This is recorded in `data/source-registry/sources.json` as authorization to pursue evaluation and permission/licensing discussions for every candidate. It does not change third-party access, copyright, contract terms, or the audited operational verdict. Ingestion remains disabled for HOLD, REJECT, and OWNER DECISION sources; 401/403/challenge barriers remain hard stops, and no paid purchase or agreement is authorized by this statement alone.

APPROVED: Wikidata structured CC0 metadata through documented access, references/identity reviewed; Commons metadata discovery with individual photo gating; Poly Haven documented CC0 photographic assets by manual download. None is a live scoring feed.

REJECT: OWGR website ingestion. [Terms](https://www.owgr.com/terms-and-conditions) expressly prohibit scraping/data mining and reserve reproduction. No ranking endpoint probes. A future written licensed alternative is a separate owner-reviewed source.

HOLD: PGA TOUR/FedExCup/Presidents Cup (403 STOP); Masters and PGA championship terms unresolved; LPGA/CME substantive website terms not extracted; Chevron/Evian/women's event sites; blanket government photography; ESPN. HOLD disables ingestion and is not authorization for endpoint exploration.

OWNER DECISION: USGA, R&A, DP World Tour/Race to Dubai, Ryder Cup, Rolex rankings, Data Golf. Commercial reuse rights have not been established; licences, provider conversations and paid products need approval. No provider contacted or agreement accepted.

Immediately possible: referenced metadata entity bootstrap, individually reviewed editorial imagery, local architecture and shells. Canary requests approved metadata only, records status/hash, ingests nothing. A reachable endpoint never widens rights. No production metadata rows added.

Not currently established: live/hole/shot feeds, SG analytics, exhaustive careers, ranking history or tournament-driven automated news. Before approving a source obtain access/robots/cadence, commercial public/premium redistribution, derivation/news/archive retention rights, coverage/latency/corrections, identity strategy and image rights. Every change requires registry revision and evidence.
