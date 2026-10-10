// Reserved space for the browser-rendered live layer (golf-api /v1/live, painted by main.ts hydrateLive).
// The static page and the hub re-render cannot know the observed state, but they do know which editions the live
// lane observes: golf-ingest snapshots every edition whose window (starts_on - 1 day .. ends_on + 2 days) holds now
// (workers/golf-ingest/src/live.js). For those editions the page is painted in the live layout with blank,
// invisible placeholders of the same line boxes, so the live paint fills the space instead of pushing the schedule
// rail and everything below it down (CLS). Placeholders carry no text and are removed if no live event arrives.
// Nothing here decides or shows a live state; data-live-skel marks reserved boxes only.
import {e,tourLabel} from './ui.js';

const DAY=864e5;
const W={play:0,pre:4,final:5};
const iso=t=>new Date(t).toISOString().slice(0,10);
const at=now=>typeof now==='number'?now:now instanceof Date?now.getTime():Date.parse(now);
const skel=(tag,cls)=>`<${tag} class="${cls?cls+' ':''}live-skel" data-live-skel>&nbsp;</${tag}>`;

/** Editions the live lane observes at `now` (same window as golf-ingest), each with its expected phase. */
export function liveWindow(ix,now=Date.now()){
 const t=at(now),today=iso(t);
 return (ix?.editions||[]).filter(x=>x.starts_on&&x.ends_on&&x.status!=='cancelled'&&x.tour?.key&&x.tour.key!=='unassigned'&&Date.parse(x.starts_on)<=t+DAY&&Date.parse(x.ends_on)+2*DAY>=t)
  .map(x=>({ed:x,phase:today<x.starts_on?'pre':today>x.ends_on?'final':'play'}))
  .sort((a,b)=>W[a.phase]-W[b.phase]||String(a.ed.name).localeCompare(String(b.ed.name)));
}
const shortName=x=>String(x.name||'').replace(/^\d{4}\s+/,'');

/** Same boxes as live-ui.js liveRail(): title, then one card per observed edition. '' when none is expected. */
export function liveRailSlot(ix,now=Date.now()){
 const win=liveWindow(ix,now);
 const inner=win.length?`<section class="live-rail" aria-hidden="true" data-live-skeleton><h2 class="live-rail-title live-skel">&nbsp;</h2><div class="live-rail-grid">${win.map(({ed,phase})=>`<div class="live-card">${skel('span','micro-label')}<b>${e(shortName(ed))}</b>${skel('span','live-badge is-pre')}${phase==='pre'?'':skel('span','lc-lead')}${skel('small')}</div>`).join('')}</div></section>`:'';
 return `<div data-live-rail>${inner}</div>`;
}

/** The edition hydrateLive() will paint into the home hero, if any: the first non-final event, else a final one that
 * is the static lead (main.ts: ev.state!=='final' || ev.edition.slug===data-edition). */
export function heroLiveEdition(ix,lead,now=Date.now()){
 const win=liveWindow(ix,now);const pick=win.find(x=>x.phase!=='final')||win[0];
 return pick&&(pick.phase!=='final'||pick.ed.slug===lead?.slug)?pick:null;
}

/** Same boxes as live-ui.js heroLive(): eyebrow, title, status line, where line, leader block (one leader and the
 * within-two line, the common case), update age and the two calls to action. */
export function heroLiveSlot({ed,phase}){
 const where=[ed.course?.name,ed.location].filter(Boolean).join(' · ');
 const leaders=phase==='pre'?'':`<div class="hero-leaders live-skel" data-live-skel>${skel('span','micro-label')}<div class="hero-leader"><b>&nbsp;</b><span class="hl-score">&nbsp;</span></div><p class="hl-within">&nbsp;</p></div>`;
 return `<p class="eyebrow">THIS WEEK / ${e(tourLabel(ed).toUpperCase())}</p><h1>${e(ed.name)}</h1><p class="live-line">${phase==='play'?'<span class="live-badge is-pre">THIS WEEK · TOURNAMENT IN PROGRESS</span>':skel('span','live-badge is-pre')}</p>${where?`<p class="live-where">${e(where)}</p>`:skel('p','live-where')}
${leaders}
${skel('p','live-age')}<div class="hero-ctas"><a class="button button-gold" href="/tournament/${e(ed.slug)}#live">Live leaderboard <span aria-hidden="true">↗</span></a><a class="button button-glass" href="/pbecast?tournament=${e(ed.slug)}">Open PBEcast <span aria-hidden="true">↗</span></a></div>`;
}
