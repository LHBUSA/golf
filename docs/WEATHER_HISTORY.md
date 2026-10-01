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
