# Course Maps V1: contract, source audit, licence architecture

Status: **STAGE A (audit + prototype). Nothing is deployed, ingested, migrated or wired to a page.**

The owner approved the OSM geometry lane (2026-10-02) under ODbL and attribution compliance. Stage B waits on the owner's screenshot review.

## 1. Existing contract (as of main b5fb800)

### Three separate concepts

| Concept | What it is | Where it lives today |
|---|---|---|
| COURSE | The venue identity (Augusta National Golf Club) | `golf_courses` (name, slug, country_code, locality, latitude, longitude). Wikidata/venue sweep. 184 of 267 canonical courses have coordinates |
| CHAMPIONSHIP SETUP | A dated configuration for one edition (2026 Masters, par 72, 7,565 yd, 18-hole par/yardage table) | `golf_course_layouts` (`version_label`, `valid_from`/`valid_to`, par, yardage, `routing_basis`, `specifications`) and `golf_holes` (layout_id, hole_number, par, yardage, `routing jsonb`, `routing_observed bool`). Linked to editions by `golf_edition_courses` |
| SPATIAL ROUTING | The physical geography of holes 1–18 | **Nothing is stored.** Every writer sets `routing:null`, `routing_observed:false`, `routing_basis:null`, and `specifications.routing:'not sourced; no hole routing or hazards inferred'` |

### Layout versions

- **Metadata-only layout per course**: `version_label = 'Venue metadata only; tournament routing unavailable'`. Holds Wikidata image, architects and opening year.
- **Setup per edition from Wikipedia** (`plan.js`): `'<year> <name> championship setup'`. Hole rows come from the article's course table.
- **Setup per edition from ESPN** (`espn-lane.js`): `'<season> <event> setup (ESPN)'`. Hole rows come from the ESPN course object.
- Years are never mixed. One course can carry setups for different tours. Black Desert, for example, has a men's par-71 / 7,421-yd setup and an LPGA par-72 / 6,629-yd setup.

### Projection and pages

- **Course document** (`workers/shared/projection.js` `courseDoc`): identity, coordinates, editions with par/yardage, `dna.layout_versions` (edition, label, par, yardage, hole count), and `contender_hole_scoring`. The latter comes from the latest full-field edition with a hole table: per hole par, yards, `avg_to_par`, `sample`, plus a `basis` string. The cohort is contender cards for that edition, not the field.
- **`/course/:slug`** (`pages.js` `course()`) renders:
  - a hero: editions, majors, latest par/yardage, opened year, architect;
  - Course DNA;
  - **Hole by hole**: the contender table;
  - **Layout versions**: a table per edition;
  - champions, player course history, video, and identity/sources.

  There is no visual map.
- **`/api/v1/live/:slug`**: `course_holes` = `[{hole, par, yards}]` from the edition document's layout (`editions/<id>.json`). It is per-setup, never inferred. PBEcast V3 uses it for "Course now" and the hole detail.

### Consequence for routing storage

`golf_holes` rows belong to a **setup** layout. Writing OSM geometry into the existing per-edition hole rows would stamp *current* geometry onto *historical* setups (2001 Masters). Section 5 avoids that.

## 2. OSM source audit (discovery only)

- **Method**: public Overpass API, one query at a time. It waits for a free slot per `/api/status` (rate limit: 2 slots). One 429 was honoured by waiting for the advertised slot, never by parallelising.
- **Query**: within 2.5 km of the canonical coordinate, fetch `leisure=golf_course` (with geometry), `golf=hole` (with geometry and tags), and the centres of `golf=tee|green|fairway|bunker|water_hazard|lateral_water_hazard|rough` and `natural=water`.
- **Raw extracts** stay in the session scratchpad and are not committed. The two small, simplified test fixtures carry an ODbL notice.

### Matching rules (no name-only attachment)

1. **Course.** The canonical coordinate must fall inside exactly **one** OSM `leisure=golf_course` polygon. Multipolygon outer rings are stitched before the point-in-polygon test.
   - Zero containing polygons means no match.
   - Two or more means `ambiguous_multiple_containing`, held for review.
   - Courses with no canonical coordinates are located by exact OSM name only. They are marked `REVIEW` and never auto-attached.
2. **Holes.** A `golf=hole` way counts for the course only if its route midpoint lies inside the matched polygon. That excludes neighbouring courses on the same property, such as St Andrews and Pebble Beach.
3. **Hole number.** It must be an integer `ref` in 1–18, unique within the course. Duplicate refs drop **all** holes with that ref. Non-numeric refs (`10a`) are dropped. Nothing is guessed.
4. **Par cross-check.** OSM `par` is compared to our setup's par sequence. Any disagreement holds the course for review. OSM par is evidence only; displayed par/yardage always come from our setup.

### Coverage (priority set; counts only, no OSM geometry committed)

Canonical courses: **267**, of which 184 have coordinates.

The priority set has 32 courses, picked in this order: current week, major venues, most editions, active PGA, active LPGA, plus extra history venues. 22 were audited. 10 were not:
- the public Overpass returned 504 three times and the audit stopped on each barrier;
- name-only global searches were dropped, per the owner's preference for bbox queries.

**235 canonical courses were not audited at all.** Covering them is Stage B work: one bbox query each at the advertised slot rate.

| Group | Sample | Audited | Exact match | Verified 18/18 | Partial | Review holds | No match / no OSM | Exact, no hole routing |
|---|---|---|---|---|---|---|---|---|
| All | 32 | 22 | 15 | 6 | 8 | 7 | 0 | 1 |
| current week | 2 | 2 | 0 | 0 | 0 | 2 | 0 | 0 |
| majors | 19 | 14 | 11 | 4 | 7 | 3 | 0 | 0 |
| men PGA and others | 28 | 19 | 14 | 6 | 7 | 5 | 0 | 1 |
| women LPGA and others | 19 | 15 | 11 | 4 | 7 | 4 | 0 | 0 |

Feature availability inside exact matches (of 15): greens 15, tees 15, fairways 15, bunkers 15, water 11.

| Course | Priority | Spatial state | Decision | Holes proven | Notes |
|---|---|---|---|---|---|
| Hoakalei Country Club | current week | REVIEW_OR_NONE | review_no_canonical_coords | 18 |  |
| Black Desert Resort Golf Course | current week | REVIEW_OR_NONE | review_no_canonical_coords | 18 | OSM par differs on 13 |
| Augusta National Golf Club | major venue | PARTIAL ROUTING | exact | 17 | unresolved refs 6 |
| Mission Hills Country Club | major venue | REVIEW_OR_NONE | review_point_outside_boundary | 0 |  |
| Old Course at St Andrews | major venue | REVIEW_OR_NONE | review_duplicate_canonical_course | 18 | same OSM course as st-andrews-links-old-course-ec37 |
| Prestwick Golf Club | major venue | REVIEW_OR_NONE | review_point_outside_boundary | 18 |  |
| Muirfield | major venue | VERIFIED ROUTING | exact | 18 |  |
| Oakmont Country Club | major venue | PARTIAL ROUTING | exact | 18 | OSM par differs on 9 |
| Royal St George's Golf Club | major venue | VERIFIED ROUTING | exact | 18 |  |
| Royal Lytham & St Annes Golf Club | major venue | VERIFIED ROUTING | exact | 18 |  |
| Pebble Beach Golf Links | major venue | PARTIAL ROUTING | exact | 17 |  |
| Royal Liverpool Golf Club, Hoylake | major venue | PARTIAL ROUTING | exact | 18 | OSM par differs on 3,5,10,15,17 |
| Royal Birkdale Golf Club | major venue | PARTIAL ROUTING | exact | 18 | OSM par differs on 6,18 |
| Evian Resort Golf Club | major venue | PARTIAL ROUTING | exact | 18 | OSM par differs on 6,13 |
| TPC Sawgrass | most editions | NO ROUTING | exact | 0 | unresolved refs 1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18 |
| Memorial Park Golf Course | active LPGA | — | osm_name_search_found_no_unique_course | — |  |
| Liberty National Golf Club | active LPGA | PARTIAL ROUTING | exact | 18 | OSM par differs on 10 |
| Shadow Creek Golf Course | active LPGA | VERIFIED ROUTING | exact | 18 |  |
| Pelican Golf Club | active LPGA | — | osm_name_search_found_no_unique_course | — |  |
| Siam Country Club (Pattaya Old Course) | active LPGA | — | not_reached | — |  |
| TPC Deere Run | active PGA | — | not_reached | — |  |
| TPC River Highlands | active PGA | VERIFIED ROUTING | exact | 18 |  |
| Puntacana Resort & Club (Corales Golf Course) | active PGA | — | not_reached | — |  |
| TPC Twin Cities | active PGA | REVIEW_OR_NONE | review_multiple_containing | 0 |  |
| St Andrews Links (Old Course) | canary | REVIEW_OR_NONE | review_duplicate_canonical_course | 18 | same OSM course as old-course-at-st-andrews-q167245 |
| Baltusrol Golf Club | LPGA history | PARTIAL ROUTING | exact | 18 | OSM par differs on 1 |
| Royal Troon Golf Club | LPGA history | VERIFIED ROUTING | exact | 18 |  |
| Carnoustie Golf Links | LPGA history | — | not_reached | — |  |
| Oakland Hills Country Club | most editions | — | not_reached | — |  |
| Quail Hollow Club | most editions | — | not_reached | — |  |
| Southern Hills Country Club | most editions | — | not_reached | — |  |
| Oak Hill Country Club | most editions | — | not_reached | — |  |

### Canaries

- **Complete (VERIFIED ROUTING)**: Muirfield, Royal St George's, Royal Lytham, Royal Troon, Shadow Creek (LPGA), TPC River Highlands.
- **Partial**: Augusta National is 17/18. The club polygon also holds the Par 3 course, and hole 6's two par-3 candidates both fit par and length, so 6 stays unmapped. Pebble Beach is 17/18. Hoylake, Birkdale, Evian (LPGA major), Liberty National, Baltusrol and Oakmont have all 18 routes, but OSM par disagrees with our setup on the listed holes, so they are partial until reviewed.
- **Current week**:
  - **Black Desert** (Bank of Utah) has 18/18 routes, but it has no canonical coordinates (located by exact OSM name, Ivins) and OSM par differs on hole 13. It is held for identity review and rendered as PARTIAL ROUTING.
  - **Hoakalei** (LPGA, Lotte) has 18 routes, also name-located, and is held for review.
- **Unavailable / held**:
  - Both St Andrews canonical entries (`old-course-at-st-andrews-q167245`, `st-andrews-links-old-course-ec37`) resolve to one OSM course. That's a duplicate canonical identity on our side, so both are held.
  - TPC Twin Cities sits inside two overlapping polygons, so it's held.
  - Mission Hills and Prestwick: the canonical point is outside every course boundary, so they're held for review.
  - TPC Sawgrass: an exact course match, but no `golf=hole` routing mapped.


## 3. Spatial states

The same three states apply on every surface:

| State | Rule | UI |
|---|---|---|
| VERIFIED ROUTING (tier A) | Exact identity match, 18/18 hole numbers proven, OSM par agrees with our setup on every compared hole, no review flag | Full SVG routing, hole focus, difficulty overlay, hole-relative wind |
| PARTIAL ROUTING (tier B) | 1–17 proven holes, or 18 with a par conflict or an identity still under review | Mapped holes drawn. The label adds `N OF 18 HOLES MAPPED`, `IDENTITY PENDING REVIEW` or `OSM PAR DIFFERS ON …`. Unmapped holes say "not mapped" |
| RECONSTRUCTED (tier C) | No geometry | Course page: yardage-book grid of real par/yardage/order, **never a map or shape**, no OSM attribution. PBEcast: the existing labelled `cast-replay` template stays the fallback |

Verified routes never get animated "ball travel". The current hole is highlighted as a whole route.

## 4. ODbL compliance architecture

Licence text: ODbL 1.0 (opendatacommons.org/licenses/odbl/1-0). OSMF community guidelines are on osmfoundation.org. This section quotes them and draws no legal conclusion beyond them.

### What the texts say

- **Derivative Database**: "a database based upon the Database, and includes any translation, adaptation, arrangement, modification, or any other alteration of the Database or of a Substantial part of the Contents. This includes, but is not limited to, Extracting or Re-utilising the whole or a Substantial part of the Contents in a new Database."
- **Substantial**: "substantial in terms of quantity or quality or a combination of both. The repeated and systematic Extraction or Re-utilisation of insubstantial parts of the Contents may amount to the Extraction or Re-utilisation of a Substantial part." The OSMF Substantial guideline treats "Less than 100 Features" as insubstantial only when the extraction is "one-off and not repeated over time". **Systematic** extraction is not insubstantial.
- **Share alike** (4.4a): "Any Derivative Database that You Publicly Use must be only under the terms of: i. This License; ii. A later version …; or iii. A compatible license."
- **4.4c**: "A Derivative Database is Publicly Used and so must comply with Section 4.4. if a Produced Work created from the Derivative Database is Publicly Used."
- **Produced Work**: "a work (such as an image, audiovisual material, text, or sounds) resulting from using the whole or a Substantial part of the Contents". The OSMF Produced Work guideline adds: "If the published result of your project is intended for the extraction of the original data, then it is a database and not a Produced Work … .PNG, JPG, .PDF, SVG images … are USUALLY Produced Works."
- **4.5b**: "Using this Database, a Derivative Database, or this Database as part of a Collective Database to create a Produced Work does not create a Derivative Database for purposes of Section 4.4."
- **4.5c**: "Use of a Derivative Database internally within an organisation is not to the public and therefore does not fall under the requirements of Section 4.4."
- **4.3**: notice for a publicly used Produced Work, "reasonably calculated to make any Person that uses, views … the Produced Work aware that Content was obtained from the Database … and that it is available under this License". The OSMF attribution guideline places the credit in a corner of or adjacent to an interactive map. "© OpenStreetMap contributors" is acceptable, and the credit must make clear the data is under ODbL, for example by linking to openstreetmap.org/copyright.
- **4.6**: "If You Publicly Use a Derivative Database or a Produced Work from a Derivative Database, You must also offer to recipients … a copy in a machine readable form of: a. The entire Derivative Database; or b. A file containing all of the alterations made to the Database or the method of making the alterations … (such as an algorithm)". This must be free of charge over the internet.
- **Collective Database guideline**: OSM and non-OSM data are "independent", and so not share-alike, when "the non-OSM and OSM datasets do not reference each other". They are also independent when "a non-OSM database replaces or adds a property of a primary feature, and uses either all OSM data or no OSM data for that property". A join key counts as a reference.
- **Horizontal Map Layers guideline**: in a map, if all data for a Feature Type is non-OSM, "the ODbl share-alike conditions do not apply to that Feature Type, even if OpenStreetMap data is used for other Feature Types".

### How each artefact maps onto those texts

| Artefact | How it maps onto the texts |
|---|---|
| Raw Overpass extracts | Systematic extraction for many courses = Substantial. Held internally (4.5c) as a licensed archive |
| Derived golf-hole geometry DB (simplified routes, features, `ref`→hole mapping) | A Derivative Database. Publicly used once any map built from it is public (4.4c). It must be ODbL-licensed and offered under 4.6 (whole DB, or the extraction/simplification method) |
| `GET /v1/courses/:slug/map` returning coordinates | "Intended for the extraction of the original data", so a database, not a Produced Work. Must carry the ODbL notice/URI (4.2) |
| Rendered SVG course map | Usually a Produced Work. Needs the 4.3 notice on the map surface, and 4.6 access to the underlying derived DB |
| Our par/yardage/scoring/difficulty/wind | Non-OSM data. It stays outside share-alike only if kept independent: separate dataset, OSM par never mixed into the displayed par property, scoring as its own layer |

### Proposed architecture (recommendation, for owner decision)

1. **Isolated licensed dataset.** Store OSM-derived geometry in its own store, not in `golf_holes.routing` on setup rows. Options:
   - an R2 prefix `osm-routing/v1/<course_slug>.json` plus an index, each file carrying the ODbL notice;
   - or a dedicated table set (`golf_osm_routing`, `golf_osm_features`) marked ODbL.

   Nothing proprietary is written into it.
2. **Reference direction.** The licensed dataset holds `course_slug`, OSM element ids and `hole` numbers. PBE tables keep no OSM ids.
   - The join happens at render time in a Produced Work (SVG) or a public API response that is itself ODbL-labelled.
   - Under the Collective Database guideline a join key *is* a reference. Option (c) below is the conservative path if the owner wants zero ambiguity.
3. **Displayed properties.** Par and yardage on maps always come from our setup, never from OSM. Scoring difficulty, wind and setups are separate layers with no OSM content.
4. **4.6 access.** Publish the derived routing dataset as a downloadable ODbL file (or the documented extraction + simplification method and code), linked from the map's attribution and from Methodology.
5. **Notice.** "Course routing © OpenStreetMap contributors" in the map corner, linking openstreetmap.org/copyright, plus "available under the Open Database License". Prototype renderer: `ATTRIBUTION` in `src/lib/course-map.js`.

### Owner decides

- (a) Approve OSM as a Golf geometry source under ODbL: attribution plus publishing the derived routing dataset (or method) openly.
- (b) Storage: isolated R2 prefix (recommended, no migration) or a dedicated ODbL table set (draft migration needed).
- (c) Whether the public `/map` API may serve coordinates (an ODbL database), or maps are served only as rendered SVG (Produced Work). Either way the underlying derived DB must be offered under 4.6.
- (d) Refresh cadence. Each refresh is a new dated `as_of`; there is no historical claim.

### Owner decision (2026-10-02)

The owner approved the OSM course-geometry lane provided ODbL and attribution compliance. Stage B (ingest, API, page wiring) starts only after the owner reviews the Stage A screenshots. At Stage B, `docs/SOURCE_DECISIONS.md` flips OpenStreetMap to `APPROVED (ODbL + attribution)`.

## 5. Schema impact (reuse `golf_holes.routing` + `routing_observed`)

**No migration is needed.** Stage B writes OSM routing as its **own layout version** per course, never onto championship-setup rows.

- **`golf_course_layouts`**:
  - `version_label = 'Current mapped routing (OpenStreetMap, retrieved YYYY-MM-DD)'`
  - `routing_basis = 'openstreetmap'`
  - `valid_from` = retrieved date, `valid_to = null`
  - `par` / `yardage` null
  - `specifications = {source:'openstreetmap', licence:'ODbL-1.0', attribution, osm_course_id, match:{decision, evidence}, bounds}`
- **`golf_holes`**, one row per *proven* hole:
  - `par = null`, `yardage = null`: championship par/yardage are never copied or overwritten;
  - `routing_observed = true`;
  - `routing = {type:'LineString', coordinates:[[lon,lat]...], source:'openstreetmap', source_feature_id:'way/…', retrieved_at, geometry_kind:'hole_route', confidence:'unique_ref'|'duplicate_ref_resolved_by_par_and_length', bounds, licence:'ODbL-1.0'}`.
- **Feature polygons** (greens, tees, fairways, bunkers, water) go to a licensed R2 store, `osm-routing/v1/<course_slug>.json`. That is also the 4.6 downloadable derived dataset.

Every additive metadata field fits in the existing `routing jsonb` / `specifications jsonb`. Setup rows keep `routing:null`, `routing_observed:false`.

ODbL note:
- The routing layout and its hole rows are the Derivative Database. The whole routing layer is published under ODbL (4.6).
- PBE scoring, setups and DNA reference the course, not OSM elements, and contain no OSM content.
- The Collective Database guideline treats a join key as a reference. The owner's approval covers this under ODbL compliance of the routing layer. If maximum separation is ever wanted, R2-only storage with no DB rows stays available.

## 6. API (proposed, not built or exposed in Stage A)

`GET /v1/courses/:slug/map[?edition=]`

```
{ course:{slug,name}, spatial_state:"VERIFIED ROUTING"|"PARTIAL ROUTING"|"RECONSTRUCTED", tier:"A"|"B"|"C",
  review:null|"…", par_conflicts:[hole…],
  geometry:{basis:"openstreetmap-current", as_of, source_course_id, bounds:[minX,minY,maxX,maxY],
            units:"metres (local equirectangular, north up)", outline, features:{fairway[],green[],tee[],bunker[],water[]}}|null,
  setup:{edition,year,label,par,yardage,front,back},             // ours, per edition (?edition=)
  holes:[{hole,par,yards,route|null,bearing_deg|null,routing_observed,source_feature_id,proof}],
  scoring:{edition,year,basis,holes:[{hole,avg_to_par,sample}]},  // cohort label derived: Contender sample / Observed field cards
  coverage:{holes_mapped,holes_total:18,rejected[]},
  attribution:{text,url,licence,licence_url} }
```

- Routes use Douglas–Peucker at 2.5 m.
- Polygons use topology-safe simplification: if a ring self-intersects, the tolerance is halved down to 0.25 m, falling back to raw.
- `?edition=` changes only `setup` and `scoring` (`withSetup`). Geometry is never re-labelled or moved.

**Payload sizes (real fixtures):**

| Course | Raw OSM (course + holes + features) | Prepared payload | Ratio |
|---|---|---|---|
| Augusta National | 329,824 B | 24,501 B | 13.5× |
| Black Desert | 511,823 B | 31,182 B | 16.4× |

## 7. Prototype (not wired to any page)

- **`src/lib/course-map.js`**:
  - `resolveHoles`: hole-number proof.
  - `prepareCourseMap`: OSM, then payload.
  - `courseMapSvg`: full course, focus zoom, difficulty overlay, whole-route current-hole highlight, north arrow, scale bar, in-map attribution.
  - `holePanel`: sourced fields, cohort label, relative wind, prev/next.
  - `withSetup`: setup selector.
  - `yardageBook`: the Level C grid.
  - `relativeWind`: headwind / tailwind / crosswind L→R or R→L, only when the bearing is observed. Labelled "PBE-derived from sourced routing + weather observation", with no club or scoring claims.
- **`workers/shared/course-geo.js`**: `matchCourse` (strict identity matcher) and `holdSharedTargets`.
- **`src/course-map.css`**: styles (not imported).
- **Fixtures**: `tests/fixtures/course-map-{augusta,black-desert}.json`. They are ODbL, simplified, with a notice.
- **Tests**: `tests/course-map.test.mjs`, `tests/course-geo.test.mjs`.

## 8. Remaining gaps

- 235 canonical courses are unaudited.
- 83 canonical courses have no coordinates, so they can only be name-located and must be reviewed.
- The St Andrews duplicate canonical identity needs a merge on our side.
- Par conflicts need a source check: Hoylake, Birkdale, Evian, Liberty National, Baltusrol, Oakmont, Black Desert 13.
- Augusta hole 6 is ambiguous with the Par 3 course.
- Flyover animation is not built; the reduced-motion static view is the default.
- Markers can overlap where tees share a spot (Augusta 2/9).

## 9. Stage B plan (after owner screenshot review)

1. Resolve identity reviews: Black Desert / Hoakalei canonical coordinates, the St Andrews merge, par-conflict checks.
2. Add an ingest lane `osm-routing`: one bbox query per course at the advertised Overpass slot rate, priority order, stop on 429/504. Write the routing layout plus hole rows (no migration) and the R2 feature store with `as_of`.
3. Publish the ODbL derived dataset / method page (4.6), plus attribution on every map surface.
4. golf-api `GET /v1/courses/:slug/map` (ODbL notice), then the `/course/:slug` module, then PBEcast Course View: current-hole highlight, scorecard ↔ map sync, relative wind.
5. Browser QA at 390/768/1024/1440/1920 with axe and CLS. Deploy only after owner sign-off.


## 10. Stage B (owner GO 2026-10-02) — production rules as built

**Owner decisions.** Map direction approved; ODbL architecture approved; Black Desert identity cleared on first-party evidence; OSM par is metadata, never setup truth; St Andrews not merged on name.

**Pipeline.** `scripts/osm-routing.mjs collect | relations | prepare | upload`.
- *collect*: one Overpass query per course (radius 2 km, `out geom`), priority order (current week, majors, most editions, PGA, LPGA, rest), waits for a free slot per `/api/status`, honours 429, retries a 504 once after 90 s then records a barrier (`data/osm-cache/_barriers.json`). Resumable: cached extracts are never re-fetched.
- *relations*: extracts taken with `out geom tags` lost multipolygon members (the `tags` verbosity drops them); this re-fetches only those relations with `out geom` and merges them in place.
- *prepare*: identity match, hole proof, topology-safe simplification → `data/osm-routing/v1/` (mirrors R2 `osm-routing/v1/`): `courses/{slug}.json` (web payload), `dataset/{slug}.geojson` (ODbL derivative: lon/lat, OSM ids), `index.json` (coverage). Evidence copy: `docs/evidence/course-geo-coverage.json`.
- *upload*: R2 `golf-public/osm-routing/v1/**` (isolated prefix; no OSM-derived data enters Supabase).

**Why routing stays out of `golf_holes.routing` for now.** The columns exist and remain the intended home, but writing them needs the DB writer and would place ODbL derivative data inside the sports graph. The isolated R2 store is the licensed dataset, is what we publish under ODbL, and keeps the share-alike boundary clean. Moving it into `golf_holes.routing` later is additive.

**Identity rules added in Stage B** (`workers/shared/course-geo.js`).
1. Par conflict = `geometry_metadata_conflicts` (field `par`); never blocks or demotes geometry.
2. Hole numbering vs setup: 2+ holes where BOTH par and length (>25%) disagree = evidence of a different (member) numbering → every length-mismatched hole is withheld (`routing_numbering_differs_from_setup`); more than three → the course is held. Without that evidence a length-only difference (forward-tee route) is kept and recorded as metadata (field `length`).
3. Shared-name resort: another course in the extract that matches our canonical name at least as well as the target requires 15+ proven holes agreeing on length (Carnoustie: the point falls in Burnside → held; Augusta next to Augusta Country Club → accepted on hole evidence).
4. Documented identity evidence (`workers/shared/course-identity.js`) may clear exactly one named element (Black Desert). Proven canonical duplicates (St Andrews ec37 = Q167245 via ESPN venue 37) never take geometry; the merge is prepared in `docs/evidence/course-merge-st-andrews.json`, not applied.

**Setup/scoring.** `workers/shared/course-setup.js`: default setup = latest edition with `starts_on <= today` (scheduled/cancelled excluded) — future stubs never default. Setup and scoring are built from the same edition document; a mismatch throws. No scoring sample → explicit empty state; another year is never substituted.

**API.** `GET /v1/courses/:slug/map[?edition=]` (golf-api `src/course-map.js`), `GET /v1/open-data/course-routing`, `/{slug}.geojson`, `/method`.

**UI.** Course page module (setup selector, routing/difficulty toggle, hole keys, focused-hole card with prev/next, mobile bottom card). PBEcast Course View: current hole (next hole in order of play) highlighted as a whole route; scorecard ↔ map selection sync; hole-relative wind (TAILWIND / QUARTERING TAILWIND / CROSSWIND · L→R / R→L / QUARTERING HEADWIND / HEADWIND) only on observed bearings. Archive replay: verified holes show real routing with no ball flight; unmapped holes keep the labelled reconstruction.
