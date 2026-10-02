# ESPN Golf coverage (2026-10-02)

Source: sports.core.api.espn.com/v2/sports/golf (owner approved 2026-10-01). `site.api.espn.com`: 403 Access Denied (Akamai) for identified User-Agent; not used.

Status key: AVAILABLE = exposed by ESPN core; PARTIAL = exposed for some events; NOT EXPOSED = absent from ESPN core; UNKNOWN = not probed. "Stored" is what we have ingested so far.

| Circuit | Seasons | Events | Rounds | Holes | Tee times | Groups | Season stats | Bios | Headshots | Venues | Shots/plays | Ingest state | Stored editions / rounds / tee times |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| PGA TOUR | 2001–2027 | AVAILABLE | AVAILABLE | AVAILABLE | AVAILABLE | AVAILABLE | AVAILABLE | AVAILABLE | AVAILABLE | AVAILABLE | NOT EXPOSED | INGESTING | 186 / 48361 / 47444 |
| LPGA | 2002–2026 | AVAILABLE | AVAILABLE | NOT EXPOSED | AVAILABLE | NOT EXPOSED | AVAILABLE | PARTIAL | AVAILABLE | AVAILABLE | NOT EXPOSED | INGESTING | 77 / 21129 / 19953 |
| DP World Tour | 2009–2027 | AVAILABLE | AVAILABLE | NOT EXPOSED | AVAILABLE | NOT EXPOSED | NOT EXPOSED | AVAILABLE | AVAILABLE | AVAILABLE | NOT EXPOSED | HELD (queued after PGA/LPGA) | 0 / 0 / 0 |
| PGA TOUR Champions | 2007–2026 | AVAILABLE | AVAILABLE | AVAILABLE | AVAILABLE | AVAILABLE | AVAILABLE | AVAILABLE | AVAILABLE | AVAILABLE | NOT EXPOSED | HELD (queued after PGA/LPGA) | 0 / 0 / 0 |
| Korn Ferry Tour | 2007–2026 | AVAILABLE | AVAILABLE | AVAILABLE | AVAILABLE | AVAILABLE | AVAILABLE | PARTIAL | AVAILABLE | AVAILABLE | NOT EXPOSED | HELD (queued after PGA/LPGA) | 0 / 0 / 0 |
| LIV Golf | 2022–2026 | AVAILABLE | AVAILABLE | NOT EXPOSED | AVAILABLE | NOT EXPOSED | NOT EXPOSED | PARTIAL | AVAILABLE | AVAILABLE | NOT EXPOSED | HELD (queued after PGA/LPGA) | 0 / 0 / 0 |
| Olympics (men) | 2016–2024 | AVAILABLE | AVAILABLE | PARTIAL | AVAILABLE | NOT EXPOSED | NOT EXPOSED | AVAILABLE | AVAILABLE | AVAILABLE | NOT EXPOSED | HELD (queued after PGA/LPGA) | 0 / 0 / 0 |
| Olympics (women) | 2016–2024 | AVAILABLE | AVAILABLE | PARTIAL | AVAILABLE | NOT EXPOSED | NOT EXPOSED | PARTIAL | AVAILABLE | AVAILABLE | NOT EXPOSED | HELD (queued after PGA/LPGA) | 0 / 0 / 0 |
| TGL | 2025–2027 | AVAILABLE | NOT EXPOSED | NOT EXPOSED | NOT EXPOSED | NOT EXPOSED | UNKNOWN | NOT EXPOSED | NOT EXPOSED | NOT EXPOSED | NOT EXPOSED | HELD (queued after PGA/LPGA) | 0 / 0 / 0 |

Totals stored: 549557 hole scores; 28433 season-stat rows. Venue coordinates are not exposed by ESPN (see the venue-coordinate registry). Shot/play objects exist but are empty for every circuit probed.
