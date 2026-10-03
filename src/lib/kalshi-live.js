// Kalshi Market Intelligence on Golf (contract market-intel/1), browser side.
//
// Kalshi is a PREDICTION MARKET: its prices are traded contract prices, not sportsbook odds and not a PropBetEdge
// model. The browser never calls Kalshi and never calls a Worker hostname: it reads the shared PropSports markets
// API through the same-origin edge rewrites /api/markets/v1/market-intelligence/{sport/golf,event/golf/:id}
// (vercel.json; exact golf routes only), like every other read on this site (/api/v1/*). The shared client + UI
// are vendored UNCHANGED in src/vendor/kalshi/.
//
// Canonical event id = our golf EDITION uuid. Golf markets are FIELD markets (proposition `player_wins_tournament`,
// one YES contract per golfer, roles `p:<player slug>` / `p:field-<name>`). Only that proposition is shown: anything
// else renders nothing rather than a misread contract. No entry, a failed read or a timeout -> nothing rendered
// (never a placeholder). Mounts come from src/lib/kalshi-mounts.js; the API decides whether they fill, so a market
// that opens later appears, and a market that closes turns into its history, with no new frontend release.
//
// Lifecycle (the API's `market.lifecycle`): while trading, the ranked field (shared kalshiCard); once CLOSED or
// SETTLED, "How the market closed" (shared marketHistoryCard via marketModule). CLOSED reads "Market closed ·
// awaiting settlement"; settlement is Kalshi's, never our result; the first price we recorded is "First observed",
// never an open. Polling: live 20 s, pregame 45 s, CLOSED every 5 min until SETTLED, SETTLED never.
import {createKalshiClient} from '../vendor/kalshi/kalshi-market-client.js';
import {kalshiCard,kalshiLine,wireKalshi,marketModule,marketHistoryCard,marketCloseLine} from '../vendor/kalshi/kalshi-market-ui.js';

export const MARKETS_BASE='/api/markets';
export const GOLF_PROPOSITION='player_wins_tournament';
export const NOTE='Kalshi tournament-winner contracts: a YES pays $1 if that golfer wins the tournament.';
/** Longest a client-side re-render (PBEcast switch, hub refresh) may wait for the market read. */
export const KALSHI_FIRST_PAINT_MS=800;
/** A CLOSED market (or a finished tournament whose market has not closed yet) is re-read this often until SETTLED. */
export const CLOSED_POLL_MS=5*60_000;

// The shared client (propbetedge-workers 8b73545+) keeps completed entries too: a closed or settled FIELD market has
// no live `kalshi` block (the API stops listing a ranked field once trading ends) but keeps `market` (+
// `market_history` on the event endpoint), so the loaders return it and golf decides what to render.
export const kalshi=createKalshiClient({sport:'golf',base:MARKETS_BASE});

const DONE=new Set(['CLOSED','SETTLED']);
/** @param {any} entry */
export const isHistory=entry=>DONE.has(entry?.market?.lifecycle);
/** @param {any} entry */
const propOf=entry=>entry?.kalshi?.proposition??entry?.market?.proposition??null;

/** An entry we can describe exactly, otherwise null: a tournament-winner market that is either trading (OPEN, event
 * not finished) or CLOSED/SETTLED (its history). Any other proposition renders nothing.
 * @param {any} entry */
export const golfEntry=entry=>{
 if(!entry||propOf(entry)!==GOLF_PROPOSITION)return null;
 if(isHistory(entry))return entry;
 return entry.kalshi?.state==='open'&&entry.event?.state!=='post'?entry:null;
};
/** Trading only (PBEcast strip, live card lines). @param {any} entry */
export const liveEntry=entry=>{const g=golfEntry(entry);return g&&!isHistory(g)?g:null;};
/** History only (completed-edition mounts never show a live price). @param {any} entry */
export const historyEntry=entry=>{const g=golfEntry(entry);return g&&isHistory(g)?g:null;};

/** Event read: the API's entry for an edition, any lifecycle (live, closed or settled); null without one.
 * @param {string} id @param {{force?:boolean}} [opts] */
export const loadMarket=(id,{force=false}={})=>kalshi.loadEvent(id,{force}).catch(()=>null);
/** Board entry for an edition, any lifecycle (completed events stay on the board 7 days). @param {string} id */
export const boardEntry=id=>kalshi.forEvent(id);

/** Poll lane: 'live' (20 s) while the edition is in progress, 'pregame' (45 s) before it, 'idle' without a market.
 * @param {any} entry @param {{from?:string|null,to?:string|null}} [b] @param {string} [today] */
export function phaseOf(entry,{from=null,to=null}={},today=new Date().toISOString().slice(0,10)){
 if(!entry)return 'idle';
 const st=entry.event?.state;
 if(st==='in'||st==='live')return 'live';
 if(st==='post')return 'idle';
 if(from&&to&&from<=today&&today<=to)return 'live';
 return 'pregame';
}
/**
 * Next read for a mount, from the API's entry (any lifecycle). null = stop polling.
 * SETTLED: never. CLOSED, or a finished tournament whose market has not closed yet: 5 min. Trading: live 20 s /
 * pregame 45 s. No market: a completed edition stops (nothing will open); a coming one re-checks on the idle lane.
 * @param {any} ev the API's entry (any lifecycle); null = the API has no market for the edition
 * @param {{done?:boolean,from?:string|null,to?:string|null}} [opts]
 * @param {string} [today]
 * @returns {number|null}
 */
export function nextPollMs(ev,{done=false,from=null,to=null}={},today){
 if(!ev)return done?null:kalshi.pollMsFor('idle');
 const lc=ev.market?.lifecycle;
 if(lc==='SETTLED')return null;
 if(lc==='CLOSED'||done||ev.event?.state==='post')return CLOSED_POLL_MS;
 return kalshi.pollMsFor(phaseOf(ev,{from,to},today));
}

/** @param {number} ms */
const timer=ms=>new Promise(r=>setTimeout(()=>r(undefined),Math.max(0,ms)));
/** Resolves with the promise's value or `undefined` once `ms` pass. Never rejects. @param {any} promise */
export const within=(promise,ms=KALSHI_FIRST_PAINT_MS)=>Promise.race([Promise.resolve(promise).catch(()=>null),timer(ms)]);
/** Board read bounded to the first-paint budget, so a slow market API never holds a re-render. */
export const boardWithin=(ms=KALSHI_FIRST_PAINT_MS)=>within(kalshi.loadBoard(),ms).then(()=>null);

/** Tournament page block: ranked field while trading, "How the market closed" once CLOSED/SETTLED; '' without one.
 * @param {any} entry */
export function cardHtml(entry){
 const g=golfEntry(entry);
 if(!g)return '';
 const card=marketModule(g,{placement:isHistory(g)?'tournament-history':'tournament-page'});
 return card?`<div class="data-section kx-sec">${card}<p class="kx-golf-note">${NOTE}</p></div>`:'';
}
// ── PBEcast Market Pulse (MLB standard) ──────────────────────────────────────────────────────────────────────
// One module for the whole tournament lifecycle, directly under the PBEcast scoreboard (the live cast's command bar
// + status, slot [data-cv3-mkt]); while no live cast is on screen (archive, no live event) it stays in the cast
// header mount. Trading: the full shared kalshiCard (ranked field, compact). CLOSED / SETTLED: marketHistoryCard in
// the same place. A lifecycle label says which: MARKET OPEN · PRE-TOURNAMENT / LIVE MARKET / TOURNAMENT FINAL ·
// MARKET STILL TRADING / MARKET CLOSED · AWAITING SETTLEMENT / MARKET SETTLED. A stale quote is never labelled live.
/** Live-scoring states in which the tournament is under way (scoring may be paused between rounds). */
const IN_PLAY=new Set(['live','stale','suspended','round_complete']);
/** PBEcast entry: a tournament-winner market that trades (also after our final, labelled so) or its history.
 * @param {any} entry */
export function castEntry(entry){
 if(!entry||propOf(entry)!==GOLF_PROPOSITION)return null;
 if(isHistory(entry))return entry.market_history?entry:null;
 return entry.kalshi?.state==='open'?entry:null;
}
/**
 * Lifecycle label for the PBEcast module: [phase key, text]; null without an entry.
 * @param {any} entry castEntry() result
 * @param {string} [live] our live-scoring state for the edition ('pre' | 'live' | 'final' | …; '' unknown)
 * @returns {[string,string]|null}
 */
export function castPhase(entry,live=''){
 if(!entry)return null;
 if(isHistory(entry))return entry.market.lifecycle==='SETTLED'?['settled','MARKET SETTLED']:['closed','MARKET CLOSED · AWAITING SETTLEMENT'];
 if(live==='final'||entry.event?.state==='post')return ['final-open','TOURNAMENT FINAL · MARKET STILL TRADING'];
 if(entry.kalshi?.freshness==='stale')return ['stale','MARKET OPEN · QUOTE NOT CURRENT'];
 if(IN_PLAY.has(live)||entry.market?.lifecycle==='ACTIVE'||entry.event?.state==='in'||entry.event?.state==='live')return ['live','LIVE MARKET'];
 return ['pre','MARKET OPEN · PRE-TOURNAMENT'];
}
/** PBEcast module HTML ('' without a market). @param {any} entry @param {{live?:string}} [opts] */
export function castHtml(entry,{live=''}={}){
 const g=castEntry(entry);
 const phase=castPhase(g,live);
 if(!g||!phase)return '';
 const body=isHistory(g)?marketHistoryCard(g,{placement:'pbecast-history'}):kalshiCard(g,{placement:'pbecast',compact:true});
 if(!body)return '';
 return `<div class="cast-mkt" data-phase="${phase[0]}"><p class="cast-mkt-phase"><span class="cast-mkt-dot" aria-hidden="true"></span>${phase[1]}</p>${body}<p class="kx-golf-note">${NOTE}</p></div>`;
}
/** Restrained card line: leaders' Mid-market while trading, the close summary once CLOSED/SETTLED; '' otherwise.
 * @param {any} entry */
export const lineHtml=entry=>{const g=golfEntry(entry);return !g?'':isHistory(g)?marketCloseLine(g):kalshiLine(g);};

/** @param {HTMLElement} el */
const bounds=el=>({from:el.dataset.kalshiFrom||null,to:el.dataset.kalshiTo||null});
/** @param {Element} el */
const isDoneMount=el=>el.hasAttribute('data-kalshi-done');
/** @param {Element} el */
const isCastMount=el=>el.hasAttribute('data-kalshi-cast');
/** @param {Element} el @param {any} entry */
const forMount=(el,entry)=>isDoneMount(el)?historyEntry(entry):entry;
const shown=new WeakMap(); // element -> last html painted (skip identical repaints)
/** @param {Element} el @param {string} html */
function paint(el,html){
 if(shown.get(el)===html)return;
 shown.set(el,html);
 if(!html){el.replaceChildren();return;}
 el.innerHTML=html;
 wireKalshi(el);
}

// One poll chain per mounted card/strip. It stops as soon as its mount leaves the DOM (PBEcast switch, hub
// re-render), when the market has SETTLED, or when a completed edition has no market; every chain is cleared on
// pagehide; a hidden tab skips network reads until it is visible again.
const chains=new Map(); // element -> stop()
/** @param {HTMLElement} el @param {string} id @param {(entry:any)=>void} render @param {Promise<unknown>|null} [after] */
function chain(el,id,render,after=null){
 /** @type {any} */let t=0;let dead=false,first=true;
 const stop=()=>{dead=true;clearTimeout(t);chains.delete(el);};
 /** @param {boolean} force */
 const tick=async force=>{
  if(dead)return;
  if(!el.isConnected)return stop();
  if(typeof document!=='undefined'&&document.hidden){t=setTimeout(()=>tick(true),5000);return;}
  const ev=await loadMarket(id,{force});
  const entry=isCastMount(el)?(isDoneMount(el)?historyEntry(ev):castEntry(ev)):forMount(el,golfEntry(ev));
  if(dead)return;
  if(!el.isConnected)return stop();
  // First paint waits (bounded) for the page's live-scoring pass so both land in the same frame: one
  // layout shift instead of two stacked ones (golf pages are static; the market cannot be in first paint).
  if(first&&after){first=false;await Promise.race([after.catch(()=>{}),new Promise(r=>setTimeout(r,AFTER_MAX_MS))]);if(dead||!el.isConnected)return stop();}
  first=false;
  render(entry);
  const ms=nextPollMs(ev,{done:isDoneMount(el),...bounds(el)});
  if(ms==null)return stop();
  t=setTimeout(()=>tick(true),ms);
 };
 chains.set(el,stop);
 const cached=isDoneMount(el)?null:isCastMount(el)?castEntry(kalshi.forEvent(id)):liveEntry(kalshi.forEvent(id));
 if(cached)render(cached); // board already in hand (client re-render): paint in the same pass
 tick(false);
}

// Card lines share one board poll; it runs at the fastest lane any connected line needs and stops when no line
// needs another read (none connected, or every line is settled / a completed edition without a market).
/** @type {any} */
let boardT=0;
const lineEls=()=>/** @type {HTMLElement[]} */([...document.querySelectorAll('[data-kalshi-line]')]);
/** @param {ParentNode} root */
function paintLines(root){
 for(const el of /** @type {NodeListOf<HTMLElement>} */(root.querySelectorAll('[data-kalshi-line]')))paint(el,lineHtml(forMount(el,boardEntry(el.dataset.kalshiLine||''))));
}
function boardDelay(){
 const ms=lineEls().map(el=>nextPollMs(boardEntry(el.dataset.kalshiLine||''),{done:isDoneMount(el),...bounds(el)})).filter(v=>v!=null);
 return ms.length?Math.min(...ms):null;
}
async function boardTick(){
 boardT=0;
 if(!lineEls().length)return;
 if(!document.hidden){await kalshi.loadBoard({force:true});paintLines(document);}
 scheduleBoard();
}
function scheduleBoard(){
 clearTimeout(boardT);boardT=0;
 const ms=boardDelay();
 if(ms!=null)boardT=setTimeout(boardTick,ms);
}

// PBEcast placement: the module lives in the live cast's slot (under the scoreboard) when the cast is on screen,
// otherwise in the cast-header mount. The last entry is kept so a cast (re)build re-places it without a read.
const castLast=new Map(); // cast mount -> last entry
const castSlot=()=>/** @type {HTMLElement|null} */(document.querySelector('[data-live-cast] [data-cv3-mkt]'));
const liveStateOf=()=>/** @type {HTMLElement|null} */(document.querySelector('[data-live-cast]'))?.dataset.liveState||'';
/** @param {HTMLElement} el @param {any} entry */
function paintCast(el,entry){
 castLast.set(el,entry);
 const html=castHtml(entry,{live:liveStateOf()});
 const slot=castSlot();
 if(slot){paint(el,'');paint(slot,html);}else paint(el,html);
}
/** Re-place / re-label the PBEcast module after the live cast was built, rebuilt, cleared or changed state. */
export function placeCastMarket(){
 for(const [el,entry] of castLast){if(!el.isConnected){castLast.delete(el);continue;}paintCast(el,entry);}
}

/** Longest a tournament card's first paint waits for the live-scoring pass. */
export const AFTER_MAX_MS=4000;
/**
 * Bind every Kalshi mount under root (idempotent). Call after any HTML that may contain mounts is inserted.
 * @param {ParentNode} [root]
 * @param {{after?:Promise<unknown>|null}} [opts] first card/strip paint waits for this (bounded)
 */
export function hydrateKalshi(root=document,{after=null}={}){
 for(const [el,stop] of chains)if(!el.isConnected)stop();
 for(const el of /** @type {NodeListOf<HTMLElement>} */(root.querySelectorAll('[data-kalshi-edition]'))){
  if(chains.has(el))continue;
  chain(el,el.dataset.kalshiEdition||'',entry=>paint(el,cardHtml(entry)),after);
 }
 for(const el of /** @type {NodeListOf<HTMLElement>} */(root.querySelectorAll('[data-kalshi-cast]'))){
  if(chains.has(el))continue;
  chain(el,el.dataset.kalshiCast||'',entry=>paintCast(el,entry),after);
 }
 if(root.querySelector('[data-kalshi-line]')){
  paintLines(root); // from the board cache when present (no flash on a re-render)
  kalshi.loadBoard().then(()=>{paintLines(document);if(!boardT)scheduleBoard();}).catch(()=>{});
 }
}
if(typeof addEventListener==='function')addEventListener('pagehide',()=>{for(const stop of [...chains.values()])stop();clearTimeout(boardT);boardT=0;});
if(typeof addEventListener==='function')addEventListener('pageshow',ev=>{if(/** @type {PageTransitionEvent} */(ev).persisted)hydrateKalshi(document);});
