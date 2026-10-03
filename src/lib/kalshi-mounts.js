// Kalshi Market Intelligence mount points for Golf (contract market-intel/1). Pure HTML strings, no data.
// The static build only decides WHERE a market may appear; prices are never baked into a page. The browser
// (src/lib/kalshi-live.js) reads the PropSports markets API through same-origin /api/markets/* and fills a mount
// only when that API returns an open tournament-winner market for the edition. No market -> the mount stays an
// empty element that takes no space (.kx-mount:empty{display:none}); never a placeholder or reserved box.
// Canonical event id = our golf EDITION id (uuid). Completed or cancelled editions never get a mount.
import {e} from './ui.js';

export const EDITION_ID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const CLOSED=new Set(['completed','cancelled','canceled']);
/** True when an edition may still carry an open tournament-winner market (not completed, not cancelled). */
export const marketEligible=x=>Boolean(x&&EDITION_ID_RE.test(String(x.id||''))&&!CLOSED.has(x.status)&&!x.winner);
const window_=x=>`${x.starts_on?` data-kalshi-from="${e(x.starts_on)}"`:''}${x.ends_on?` data-kalshi-to="${e(x.ends_on)}"`:''}`;

/** Tournament page: full card (ranked field) + tournament-winner note, as its own block. */
export const editionKalshiMount=d=>marketEligible(d)?`<div class="kx-mount kx-edition" data-kalshi-edition="${e(d.id)}"${window_(d)}></div>`:'';
/** PBEcast: one-line leaders strip that expands to the compact card. */
export const castKalshiMount=d=>marketEligible(d)?`<div class="kx-mount kx-cast" data-kalshi-strip="${e(d.id)}"${window_(d)}></div>`:'';
/** Schedule / event cards: one restrained line (leaders' Mid-market). */
export const lineKalshiMount=x=>marketEligible(x)?`<div class="kx-mount kx-cardline" data-kalshi-line="${e(x.id)}"${window_(x)}></div>`:'';
