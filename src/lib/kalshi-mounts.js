// Kalshi Market Intelligence mount points for Golf (contract market-intel/1). Pure HTML strings, no data.
// The static build only decides WHERE a market may appear; prices are never baked into a page. The browser
// (src/lib/kalshi-live.js) reads the PropSports markets API through same-origin /api/markets/* and fills a mount
// only when that API returns a tournament-winner market for the edition. No market -> the mount stays an empty
// element that takes no space (.kx-mount:empty{display:none}); never a placeholder or reserved box.
// Canonical event id = our golf EDITION id (uuid).
//  - Not-completed editions: live mounts (ranked field while trading; the same mount turns into the market history
//    once the market closes, so a page built mid-week evolves with no release).
//  - Completed editions: history mounts (`data-kalshi-done`), only for editions that ended after the markets lane
//    began recording golf (an older edition cannot have an observed market, so its page makes no read at all).
//    The API still decides: no entry -> nothing.
import {e} from './ui.js';

export const EDITION_ID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** First day the PropSports markets lane could have observed a golf market (network rollout, 2026-10). */
export const MARKET_HISTORY_SINCE='2026-10-01';
const CANCELLED=new Set(['cancelled','canceled']);
const CLOSED=new Set(['completed',...CANCELLED]);
const uuid=x=>Boolean(x&&EDITION_ID_RE.test(String(x.id||'')));
/** True when an edition may still carry an open tournament-winner market (not completed, not cancelled). */
export const marketEligible=x=>uuid(x)&&!CLOSED.has(x.status)&&!x.winner;
/** True when a completed edition may have a recorded market history (ended on/after MARKET_HISTORY_SINCE). */
export const historyEligible=x=>uuid(x)&&!CANCELLED.has(x.status)&&(x.status==='completed'||Boolean(x.winner))&&String(x.ends_on||'')>=MARKET_HISTORY_SINCE;
const window_=x=>`${x.starts_on?` data-kalshi-from="${e(x.starts_on)}"`:''}${x.ends_on?` data-kalshi-to="${e(x.ends_on)}"`:''}`;

/** Tournament page (not completed): full card (ranked field) + tournament-winner note, as its own block. */
export const editionKalshiMount=d=>marketEligible(d)?`<div class="kx-mount kx-edition" data-kalshi-edition="${e(d.id)}"${window_(d)}></div>`:'';
/** Tournament page (completed): "How the market closed", after the final leaderboard (our result comes first). */
export const editionHistoryMount=d=>historyEligible(d)?`<div class="kx-mount kx-edition kx-edition-done" data-kalshi-edition="${e(d.id)}" data-kalshi-done${window_(d)}></div>`:'';
/** PBEcast: one-line leaders strip that expands to the compact card. */
export const castKalshiMount=d=>marketEligible(d)?`<div class="kx-mount kx-cast" data-kalshi-strip="${e(d.id)}"${window_(d)}></div>`:'';
/** Schedule / event cards: one restrained line (leaders' Mid-market while trading). */
export const lineKalshiMount=x=>marketEligible(x)?`<div class="kx-mount kx-cardline" data-kalshi-line="${e(x.id)}"${window_(x)}></div>`:'';
/** Completed result cards: one line on how the market closed (board summary, kept 7 days by the API). */
export const closeLineMount=x=>historyEligible(x)?`<div class="kx-mount kx-cardline" data-kalshi-line="${e(x.id)}" data-kalshi-done${window_(x)}></div>`:'';
