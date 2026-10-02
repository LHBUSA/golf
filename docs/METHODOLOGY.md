# Methodology — Phase 2 (2026-10-01)

**Player Results DNA** (`golf-results-dna/1.0.0`). Inputs: full-field leaderboards only. Dimensions: scoring vs field (mean of round field average − player score; equivalent in construction to round-level total strokes gained), consistency (SD of field-adjusted rounds, lower better), under-par round rate, cuts made, top-10 rate, contention (top-5) rate, recent form (last 10 full-field starts), major performance (field-adjusted in majors). Windows: last 24 months and all observed since 2000, ending at the as-of date (no future results). Cohorts: men and women separately (PGA TOUR + men's majors; LPGA + women's majors). Confidence tiers: rounds High ≥ 40 / Medium ≥ 20 / Limited ≥ 8; starts High ≥ 12 / Medium ≥ 6 / Limited ≥ 3; below Limited the percentile is withheld; cohorts under 10 players publish no percentile. Mid-rank percentiles. No composite score.

**Held dimensions**: driving power/control, off-tee, approach, iron precision, GIR, short game, scrambling, sand, putting (no approved statistics source for Results DNA; Bag DNA uses ESPN season statistics where ESPN publishes them).

**Par-3/4/5 scoring** (updated 2026-10-02 to match the code, `workers/shared/projection.js` finalizePar): computed only from events with full-field hole-by-hole cards (a hole is used when at least 20 field cards exist for it, so contender-only cards never form a cohort). Percentile gate: holes Limited ≥ 36 / Medium ≥ 100 / High ≥ 200, cohort ≥ 10. A player with no full-field hole data has no comparable value ("Full-field comparable hole data is not available for this dimension"); a player with some, below 36 holes, is sample-gated and the UI shows the rule and the count.

**Season statistics truth rule** (`workers/shared/season-stats.js`): ESPN's LPGA season endpoint publishes unranked 0.0 placeholders for statistics it does not measure (distance, accuracy, GIR, sand saves, putts per GIR, birdies per round, holes per eagle). For these rate statistics an unranked zero is stored and shown as unavailable (null, "—"), never as a measurement, and never enters a Bag DNA cohort. Counting statistics (wins, top-10s, cuts) keep real zeros.

**Course DNA** (`golf-course-dna/1.0.0`): scoring difficulty (field mean to par per round), spread, under-par round share — compared with other courses in the same division, editions ≥ 2 full-field for percentiles; plus published winning score, cut line and setup yardage, each edition a separate layout version. Contender hole scoring is labelled as leaders' final-round cards, not a field sample.

**Course Fit** (`golf-course-fit-descriptive/1.0.0`): components only — course history, performance on comparably difficult setups, on comparable lengths (men 7,400 yd / women 6,600 yd threshold), recent form; each shows player value, course signal and samples. `overall_score` is always null.

**Field intelligence** (`golf-field-context/1.0.0`): uses only results that ended before the edition start.

**Matchups** (`golf-matchup-descriptive/1.0.0`): records, DNA percentiles (comparable only within one division), "higher finish in shared events" (stroke play, never called head-to-head), common-course history. No probability.

**Rankings**: no licensed source; a PBE rating was not built or published.

---

# Analytics methodology

No default zero, fabricated percentile, equal-weight composite, inferred course demand or black-box score. All analytics stay unavailable until comparable canonical inputs exist.

Player DNA retains separate driving (distance/accuracy/SG off tee), approach (GIR/proximity/SG), around-green (scrambling/sand saves/SG), putting, scoring, form, major and course-history metrics. Source definitions/units/baselines and denominators must align. PGA TOUR and LPGA comparison groups remain distinct.

Prototype percentile = 100 × (strictly worse cohort count + 0.5 × equal count) / cohort size. Higher/lower direction explicit. Return tour, season, minimum sample, athlete sample, cohort size and version. Pure function checks finite values and sample guards; production eligibility/cohort construction/thresholds require review. Product displays no percentiles yet.

Course DNA facts belong to layout/date: par, yardage, hole routing and sourced fairway/rough/green/water/bunker context. Completed observed hole scores support raw distributions (eagle/birdie/par/bogey/double+). Conceded/unknown holes do not enter stroke averages. Adjusted difficulty requires comparable baseline and documented method.

Course Fit v0 is descriptive. Every component shows player value, tour percentile, historical course signal, sample, basis and coverage. Driving/accuracy/approach/around-green/putting/par-type/course-history/form components do not imply a win probability. No overall score.

Prototype guard floor: three editions, 50 players, 100 rounds. These are development safety floors, not validated evidence of sufficiency. Signals still require field controls, layout stratification, missingness/collinearity review, uncertainty and out-of-sample stability. No sensitivity is computed this sprint. Report association, not causation. Version/review any later score with components/sample exposed.

Recent form states its completed-round/event window. Career/course records disclose history beginning and gaps. Rankings compare one system across dated snapshots. Methodology versions/analytics runs retain immutable input hashes, cohort, computation version, sample/coverage and reasons.
