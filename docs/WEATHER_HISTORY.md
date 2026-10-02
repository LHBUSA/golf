# Historical weather joins — research (2026-10-01)

Goal: describe how observed conditions relate to field-relative scoring, without publishing causality.

## Source

NOAA NCEI Integrated Surface Database (ISD, "global-hourly"), U.S. government work (public domain). Static per-station yearly CSVs: `https://www.ncei.noaa.gov/data/global-hourly/access/<year>/<USAF><WBAN>.csv` (≈5–6 MB each). Fields used: `WND` (direction, speed m/s ×10), `OC1` (gust, sparse), `TMP` (°C ×10), `AA1` (precipitation depth mm ×10, period-dependent), METAR `FM-15` rows. The search/data REST services returned empty results for the probes tried; the static files work. Current-year files can lag (2026 file for Asheville: 404 on 2026-10-01).

## Method (per edition × round)

1. Station: nearest ISD station to the venue coordinates from the venue-coordinate registry; record distance. Venues with locality-only coordinates carry that precision into the join.
2. Window: tournament day 7am–7pm local (tee-time window when tee times exist: ESPN exposes them for every circuit except TGL).
3. Aggregates: mean and max wind, max gust (null when unreported, never zero), temperature range, precipitation sum.
4. Scoring: field average and field-relative scoring for that round from published round scores (full-field editions only).

## Sample (evidence: `docs/evidence/weather-history-sample.json`)

2025 Tour Championship (East Lake GC; station 72219013874 Atlanta Hartsfield):

| Round | Wind mean / max (mph) | Max gust | Temp °F | Rain mm | Field avg (n=30) |
|---|---|---|---|---|---|
| R1 | 6.7 / 18.3 | 25.3 | 73–92 | 0.0 | 67.27 |
| R2 | 6.5 / 9.2 | — | 73–83 | 0.0 | 66.80 |
| R3 | 11.9 / 13.9 | 24.2 | 73–79 | 0.5 | 69.57 |
| R4 | 6.4 / 9.2 | — | 72–86 | 0.0 | 67.63 |

The windiest round had the highest field average here; one event proves nothing.

## Study design before anything is published

- Scale to the 277 full-field editions (2001–2026) with course fixed effects so course difficulty is not mistaken for weather.
- Minimum 30 rounds per weather bin; report confidence intervals; descriptive language only ("scored X strokes higher on average in rounds with mean wind ≥ 15 mph").
- Player Weather DNA only from field-relative scores in qualifying windy/calm rounds, with sample gates like the other DNA dimensions.
- Hole-relative wind stays off until tee→green bearings are genuinely known (no bearings are invented).

## Study results (2026-10-02) — evidence: `docs/evidence/weather-study.json`

Coverage: 210 rounds from 53 of 75 full-field editions (2022–2025) with course coordinates; 6 editions had no ISD station within 25 km. Scoring is each round's field average to par minus that edition's mean round (positive = harder than the event's norm).

**Correlation (Pearson r with round difficulty):** mean wind r = 0.23 (n 210); max gust r = 0.15 (n 123); temperature r = -0.09 (n 210); rain r = 0.07 (n 166).

**Descriptive split, mean daytime wind** (bins under 30 rounds are not reported):

| Wind | Rounds | Mean relative strokes | 95% CI |
|---|---|---|---|
| 0–6 mph | 58 | -0.16 | ±0.21 |
| 6–10 mph | 93 | -0.08 | ±0.13 |
| 10–14 mph | 39 | 0.24 | ±0.23 |
| 14–+ mph | 20 | — | insufficient sample |

**Descriptive split, max gust:**

| Gust | Rounds | Mean relative strokes | 95% CI |
|---|---|---|---|
| 0–15 mph | 2 | — | insufficient sample |
| 15–22 mph | 53 | 0.04 | ±0.21 |
| 22–30 mph | 51 | 0.21 | ±0.2 |
| 30–+ mph | 17 | — | insufficient sample |

**Causal claim:** none. Rounds are confounded by tee waves, setup changes, field strength and station distance; wind is the only variable with a visible association here, and the windiest bin is still below the sample threshold. Nothing from this study appears in public copy.
