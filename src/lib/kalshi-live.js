// Kalshi Market Intelligence on Golf (contract market-intel/1), browser side.
//
// Kalshi is a PREDICTION MARKET: its prices are traded contract prices, not sportsbook odds and not a PropBetEdge
// model. The browser never calls Kalshi and never calls a Worker hostname: it reads the shared PropSports markets
// API through the same-origin edge rewrites /api/markets/v1/market-intelligence/{sport/golf,event/golf/:id}
// (vercel.json; exact golf routes only), like every other read on this site (/api/v1/*). The shared client + UI
// are vendored UNCHANGED in src/vendor/kalshi/.
//
// Canonical event id = our golf EDITION uuid. Golf markets are FIELD markets (proposition `player_wins_tournament`,
// one YES contract per golfer, roles `p:<player slug>` / `p:field-<name>`); the API already filters to open traded
// contracts and orders them by Mid-market, and the shared card ranks the top eight. Only that proposition is shown:
// anything else renders nothing rather than a misread contract. No entry, a failed read or a timeout -> nothing
// rendered (never a placeholder). Mounts come from src/lib/kalshi-mounts.js; the API decides whether they fill, so
// a market that opens later appears with no new frontend release.
import {createKalshiClient} from '../vendor/kalshi/kalshi-market-client.js';
import {kalshiCard,kalshiLine,kalshiStrip,wireKalshi} from '../vendor/kalshi/kalshi-market-ui.js';

export const MARKETS_BASE='/api/markets';
export const kalshi=createKalshiClient({sport:'golf',base:MARKETS_BASE});
/** Longest a client-side re-render (PBEcast switch, hub refresh) may wait for the market read. */
export const KALSHI_FIRST_PAINT_MS=800;
export const GOLF_PROPOSITION='player_wins_tournament';
export const NOTE='Kalshi tournament-winner contracts: a YES pays $1 if that golfer wins the tournament.';

/** An entry we can describe exactly: an OPEN tournament-winner market, otherwise null. A settled or closed market is
 * not shown (the edition's own result is the record), and any other proposition renders nothing. */
export const golfEntry=entry=>entry?.kalshi?.proposition===GOLF_PROPOSITION&&entry.kalshi.state==='open'&&entry.event?.state!=='post'?entry:null;

/** Poll lane: 'live' (20 s) while the edition is in progress, 'pregame' (45 s) before it, 'idle' without a market. */
export function phaseOf(entry,{from=null,to=null}={},today=new Date().toISOString().slice(0,10)){
 if(!entry)return 'idle';
 const st=entry.event?.state;
 if(st==='in'||st==='live')return 'live';
 if(st==='post')return 'idle';
 if(from&&to&&from<=today&&today<=to)return 'live';
 return 'pregame';
}

const timer=ms=>new Promise(r=>setTimeout(()=>r(undefined),Math.max(0,ms)));
/** Resolves with the promise's value or `undefined` once `ms` pass. Never rejects. */
export const within=(promise,ms=KALSHI_FIRST_PAINT_MS)=>Promise.race([Promise.resolve(promise).catch(()=>null),timer(ms)]);
/** Board read bounded to the first-paint budget, so a slow market API never holds a re-render. */
export const boardWithin=(ms=KALSHI_FIRST_PAINT_MS)=>within(kalshi.loadBoard(),ms).then(()=>null);

/** Tournament page block: ranked field card + tournament-winner note; '' without a market. */
export function cardHtml(entry){
 const card=kalshiCard(golfEntry(entry),{placement:'tournament-page'});
 return card?`<div class="data-section kx-sec">${card}<p class="kx-golf-note">${NOTE}</p></div>`:'';
}
/** PBEcast strip (leaders, expands to the compact card) + note; '' without a market. */
export function stripHtml(entry,{open=false}={}){
 let strip=kalshiStrip(golfEntry(entry),{placement:'pbecast-strip'});
 if(!strip)return '';
 if(open)strip=strip.replace('<details class="kx-strip"','<details open class="kx-strip"');
 return `${strip}<p class="kx-golf-note">${NOTE}</p>`;
}
/** Restrained card line (leaders' Mid-market); '' without a market. */
export const lineHtml=entry=>kalshiLine(golfEntry(entry));

const bounds=el=>({from:el.dataset.kalshiFrom||null,to:el.dataset.kalshiTo||null});
const shown=new WeakMap(); // element -> last html painted (skip identical repaints)
function paint(el,html){
 if(shown.get(el)===html)return;
 shown.set(el,html);
 if(!html){el.replaceChildren();return;}
 el.innerHTML=html;
 wireKalshi(el);
}

// One poll chain per mounted card/strip. It stops as soon as its mount leaves the DOM (PBEcast switch, hub
// re-render) and every chain is cleared on pagehide; a hidden tab skips network reads until it is visible again.
const chains=new Map(); // element -> stop()
function chain(el,id,render,after=null){
 let t=0,dead=false,first=true;
 const stop=()=>{dead=true;clearTimeout(t);chains.delete(el);};
 const tick=async force=>{
  if(dead)return;
  if(!el.isConnected)return stop();
  if(typeof document!=='undefined'&&document.hidden){t=setTimeout(()=>tick(true),5000);return;}
  const entry=golfEntry(await kalshi.loadEvent(id,{force}).catch(()=>null));
  if(dead)return;
  if(!el.isConnected)return stop();
  // First paint waits (bounded) for the page's live-scoring pass so both land in the same frame: one
  // layout shift instead of two stacked ones (golf pages are static; the market cannot be in first paint).
  if(first&&after){first=false;await Promise.race([after.catch(()=>{}),new Promise(r=>setTimeout(r,AFTER_MAX_MS))]);if(dead||!el.isConnected)return stop();}
  first=false;
  render(entry);
  t=setTimeout(()=>tick(true),kalshi.pollMsFor(phaseOf(entry,bounds(el))));
 };
 chains.set(el,stop);
 const cached=golfEntry(kalshi.forEvent(id));
 if(cached)render(cached); // board already in hand (client re-render): paint in the same pass
 tick(false);
}

// Card lines share one board poll; it stops when no line mount is connected.
let boardT=0;
function paintLines(root){
 for(const el of root.querySelectorAll('[data-kalshi-line]'))paint(el,lineHtml(kalshi.forEvent(el.dataset.kalshiLine)));
}
function boardLoop(){
 clearTimeout(boardT);
 const lines=()=>[...document.querySelectorAll('[data-kalshi-line]')];
 const tick=async()=>{
  if(!lines().length){boardT=0;return;}
  if(!document.hidden){await kalshi.loadBoard({force:true});paintLines(document);}
  const phases=lines().map(el=>phaseOf(golfEntry(kalshi.forEvent(el.dataset.kalshiLine)),bounds(el)));
  boardT=setTimeout(tick,kalshi.pollMsFor(phases.includes('live')?'live':phases.includes('pregame')?'pregame':'idle'));
 };
 boardT=setTimeout(tick,kalshi.pollMsFor('pregame'));
}

/**
 * Bind every Kalshi mount under root (idempotent). Call after any HTML that may contain mounts is inserted.
 * @param {ParentNode} [root]
 */
export const AFTER_MAX_MS=4000;
/** @param {{after?:Promise<unknown>|null}} [opts] first card/strip paint waits for this (bounded) */
export function hydrateKalshi(root=document,{after=null}={}){
 for(const [el,stop] of chains)if(!el.isConnected)stop();
 for(const el of root.querySelectorAll('[data-kalshi-edition]')){
  if(chains.has(el))continue;
  chain(el,el.dataset.kalshiEdition,entry=>paint(el,cardHtml(entry)),after);
 }
 for(const el of root.querySelectorAll('[data-kalshi-strip]')){
  if(chains.has(el))continue;
  chain(el,el.dataset.kalshiStrip,entry=>{const open=!!el.querySelector('details[open]');paint(el,stripHtml(entry,{open}));});
 }
 if(root.querySelector('[data-kalshi-line]')){
  paintLines(root); // from the board cache when present (no flash on a re-render)
  kalshi.loadBoard().then(()=>paintLines(document)).catch(()=>{});
  if(!boardT)boardLoop();
 }
}
if(typeof addEventListener==='function')addEventListener('pagehide',()=>{for(const stop of [...chains.values()])stop();clearTimeout(boardT);boardT=0;});
if(typeof addEventListener==='function')addEventListener('pageshow',ev=>{if(ev.persisted)hydrateKalshi(document);});
