# Golf Newsroom V4

Status: **shadow mode** in production (`golf-news`, cron `*/15`, `NEWS_MODE=shadow`). Nothing publishes until a canary type list is set (`NEWS_CANARY_TYPES`) or `NEWS_MODE=publish`. The OpenAI editor activates when the `OPENAI_API_KEY` secret is set on `golf-news`; without it the deterministic Golf Desk writes every draft.

## Pipeline

```
source change (ESPN events/live snapshots, projection, NWS forecasts)
 -> detect (story types, timeliness windows)
 -> build frozen fact packet (facts with provenance, entities, app-owned chart data, limits)
 -> materiality score (deterministic; threshold 3; no quota)
 -> topic state (KV news:topic:<topic>, single run lease news:lease)
 -> draft: previous validated draft re-rendered with new facts, else OpenAI (new topics only), else desk
 -> gates (validate.js) -> content/chart/media/link plans (plan.js) -> evidence ledger
 -> shadow (private R2 golf-news-private) | publish (public R2 news/v2/*, golf_articles, golf_news_packets)
```

The packet owns truth. Prose is written with tokens: `{f:fact_id}` renders a packet value; `{e:entity_key}` renders a name linked by the application (`resolveHref`). The model can never type a digit, a spelled count or placing, a URL, a chart value, a video id, an image licence, a date, a score, equipment or a caddie fact.

## Story types (`workers/shared/news/types.js`)

| Type | Trigger | Topic (update key) |
|---|---|---|
| preview | event starts in 0–6 days, no round posted | `preview:<edition>` |
| round_recap | ≥90% of the field completed round n (1–3), within a day; live ESPN snapshot preferred when fresher | `round:<edition>:<n>` |
| final | completed edition with winner, ≤14 days | `final:<edition>` |
| notable_round | round ≥6 strokes better than the field average, ≤2 days | `notable:<edition>:<player>:<round>` |
| cut | ≥10 cut players and a major champion or top-decile DNA player missed | `cut:<edition>` |
| course_weather | NWS forecast with gusts ≥25 mph, rain ≥60% or heat ≥95°F | `weather:<edition>` |
| major_history | major starting in ≤10 days with ≥5 editions in record | `major:<edition>` |
| player_form | field player with the top public form percentile and ≥3 top-10s in 4 starts (or a win) | `form:<player>:<edition>` |
| course_intelligence | course DNA from ≥2 full-field editions | `course:<course>:<edition>` |
| play_suspended | ESPN status suspended, fresh snapshot | `suspended:<edition>:<round>` |
| playoff | ESPN playoff flags on ≥2 players | `playoff:<edition>` |
| equipment_change / caddie_change / golf_ball | verified sources only (all currently HOLD): never detect | — |

Updates: preview, weather, history, form and course stories are *updates* when facts move. Any other fact change is a *correction* and is listed on the article with prior values.

## Gates (`validate.js`)

Unknown fact or entity, any digit outside a token, spelled numbers, ordinals outside "<n> round", betting/prediction language, injuries, quotes and attributions, URLs, course-condition claims (firmness, green speed), equipment/caddie/sponsor claims, superlatives, headline/dek length, headline must name the subject, minimum facts and words per type, chart and link intents limited to the packet.

## OpenAI editor (`editor.js`)

Responses API, `text.format` strict JSON schema (`golf_article`), chart/link intents enumerated from the packet, `store:false`, low reasoning effort. One generation plus at most one targeted repair, only for new topics. Daily ledger in KV `news:openai:<day>` with a nominal $ breaker (`GOLF_OPENAI_DAILY_MAX_USD`, default 5). Prices are hard-coded constants so a change is a reviewed code change. `POST /admin/news-cost` reports the day.

## Data boundaries

Public stories use public projection data only. Field-form leaders, raw strokes-vs-field values and cohort sizes are All Access and are tested never to appear in packets. Live facts come from ESPN core snapshots only.

## Admin

`POST /admin/news-shadow` (shadow run; `?types=`, `?editions=`, `?force=1`), `POST /admin/news-drafts` (shadow docs; `?published=1`), `POST /admin/news-publish?mode=canary|publish` (needs `PUBLISH_ENABLED=true`), `POST /admin/news-cost`. Local dry run: `node scripts/news-dry.mjs --today=YYYY-MM-DD`.
