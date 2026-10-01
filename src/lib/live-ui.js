// Live presentation (browser-rendered from /api/v1/live; static pages carry a truthful neutral fallback).
// Labels come from the live contract state; nothing here decides whether something is live.
import {e,a,toPar} from './ui.js';
const ago=s=>s===null||s===undefined?'':s<90?'just now':s<3600?`${Math.round(s/60)} min ago`:`${Math.round(s/3600)} hr ago`;
const time=iso=>{try{return new Date(iso).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',timeZoneName:'short'});}catch{return '';}};
const tp=v=>v===null||v===undefined?'—':toPar(v);
const thruText=r=>r.status==='cut'?'CUT':r.status==='withdrawn'?'WD':r.status==='disqualified'?'DQ':r.status==='dns'?'DNS':r.thru===18?'F':r.thru>0?String(r.thru):r.tee_time?time(r.tee_time):'—';
const where=ev=>[ev.course?.name,[ev.course?.city,ev.course?.state||ev.course?.country].filter(Boolean).join(', ')].filter(Boolean).join(' · ');
export function badge(ev){
 const cls={live:'is-live',suspended:'is-warn',stale:'is-warn',round_complete:'is-done',final:'is-done',pre:'is-pre'}[ev.state]||'';
 const text=ev.state==='live'?`ROUND ${ev.round} · LIVE`:ev.state==='stale'?`ROUND ${ev.round} · SCORING UPDATE DELAYED`:ev.state==='suspended'?`ROUND ${ev.round} · PLAY SUSPENDED`:ev.state==='round_complete'?`ROUND ${ev.round} COMPLETE`:ev.state==='final'?'FINAL':ev.state==='pre'?(ev.first_tee?`FIRST TEE ${time(ev.first_tee)}`:'SCORING BEGINS WHEN PLAY STARTS'):'';
 return text?`<span class="live-badge ${cls}">${ev.state==='live'?'<i aria-hidden="true"></i>':''}${e(text)}</span>`:'';
}
const updated=ev=>ev.state==='stale'?`Last update ${ago(ev.age_seconds)}`:ev.age_seconds!==null&&ev.age_seconds!==undefined?`Updated ${ago(ev.age_seconds)}`:'';
const name=p=>p.slug?a('/player/'+p.slug,p.name):e(p.name||'—');
export function heroLive(ev){
 const lead=ev.leaders||[],shown=['live','stale','suspended','round_complete','final'].includes(ev.state);
 return `<p class="eyebrow">THIS WEEK / ${e(ev.tour)}</p><h1>${e(ev.edition.name)}</h1><p class="live-line">${badge(ev)}</p><p class="live-where">${e(where(ev))}</p>
${shown&&lead.length?`<div class="hero-leaders"><span class="micro-label">${ev.state==='final'?'CHAMPION':lead.length>1?'CO-LEADERS':'LEADER'}${ev.state==='stale'?' · AT LAST UPDATE':''}</span>${lead.slice(0,3).map(p=>`<div class="hero-leader"><b>${name(p)}</b><span class="hl-score">${e(tp(p.total_to_par))}</span>${p.thru&&p.thru<18?`<small>thru ${e(p.thru)}</small>`:''}</div>`).join('')}${lead.length>3?`<small>+${lead.length-3} more tied</small>`:''}${ev.within_two>lead.length?`<p class="hl-within">${e(ev.within_two)} players within two</p>`:''}</div>`:''}
<p class="live-age">${e(updated(ev))}</p><div class="hero-ctas"><a class="button button-gold" href="/tournament/${e(ev.edition.slug)}#live">Live leaderboard <span aria-hidden="true">↗</span></a><a class="button button-glass" href="/pbecast?tournament=${e(ev.edition.slug)}">Open PBEcast <span aria-hidden="true">↗</span></a></div>`;
}
export function liveRail(events){
 const ev=events.filter(x=>x.state!=='unavailable');if(!ev.length)return '';
 return `<section class="live-rail" aria-label="Live now"><h2 class="live-rail-title">${ev.some(x=>x.state==='live')?'LIVE NOW':'THIS WEEK'}</h2><div class="live-rail-grid">${ev.map(x=>`<a class="live-card" href="/tournament/${e(x.edition.slug)}#live"><span class="micro-label">${e(x.tour)}</span><b>${e(x.edition.name.replace(/^\d{4}\s+/,''))}</b>${badge(x)}${x.leaders?.length&&x.state!=='pre'?`<span class="lc-lead">${e(x.leaders.length>1?`${x.leaders.length} tied at`:x.leaders[0].name)} ${e(tp(x.leaders[0].total_to_par))}</span>`:''}<small>${e(updated(x))}</small></a>`).join('')}</div></section>`;
}
export function liveBoard(ev,{limit=200}={}){
 const rows=ev.leaderboard.slice(0,limit),rounds=Math.max(1,...rows.flatMap(r=>(r.rounds||[]).filter(x=>x.strokes!==null).map(x=>x.round)));
 return `<div class="live-board-head">${badge(ev)}<span class="live-age">${e(updated(ev))} · ESPN</span></div>${ev.state==='stale'?'<p class="live-note">Scoring update delayed. Positions below are from the last update and may have changed.</p>':''}${ev.state==='suspended'?'<p class="live-note">Play is suspended. Scores are as of the suspension.</p>':''}
<div class="table-wrap" tabindex="0" role="region" aria-label="Live leaderboard"><table class="index-table live-table"><thead><tr><th scope="col">Pos</th><th scope="col">Player</th><th scope="col" class="num">Today</th><th scope="col" class="num">Thru</th><th scope="col" class="num">Total</th>${Array.from({length:rounds},(_,i)=>`<th scope="col" class="num">R${i+1}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr class="${r.status!=='active'?'is-out':''}"><td>${e(r.status!=='active'?{cut:'CUT',withdrawn:'WD',disqualified:'DQ',dns:'DNS'}[r.status]||'—':r.position||'—')}</td><th scope="row">${name(r)}</th><td class="num">${e(tp(r.today_to_par))}</td><td class="num">${e(thruText(r))}${r.start_hole===10&&r.thru>0&&r.thru<18?'<sup title="Started on the 10th tee">*</sup>':''}</td><td class="num"><b>${e(tp(r.total_to_par))}</b></td>${Array.from({length:rounds},(_,i)=>{const x=(r.rounds||[]).find(q=>q.round===i+1);return `<td class="num">${x?.strokes!=null?(x.complete?e(x.strokes):`<span class="live-partial" title="Round in progress">${e(x.strokes)}</span>`):'—'}</td>`;}).join('')}</tr>`).join('')}</tbody></table></div><p class="gnote">Observed scoring from ESPN, refreshed about every ten minutes. * started on the back nine. Italic round scores are in progress. Times shown in your time zone.</p>`;
}
export function playerLive(ev,p){
 if(!p)return '';
 const cur=(p.rounds||[]).find(r=>r.round===ev.round);
 return `<section class="data-section live-player" id="live"><p class="eyebrow">CURRENT TOURNAMENT</p><h2>${a('/tournament/'+ev.edition.slug,ev.edition.name)}</h2><div class="lp-grid"><div><span class="micro-label">POSITION</span><b>${e(p.status!=='active'?p.status.toUpperCase():p.position||'—')}</b></div><div><span class="micro-label">TOTAL</span><b>${e(tp(p.total_to_par))}</b></div><div><span class="micro-label">ROUND ${e(ev.round)}</span><b>${e(tp(p.today_to_par))}</b><small>${p.thru===18?'Finished':p.thru>0?'Thru '+p.thru:p.tee_time?'Tee time '+time(p.tee_time):''}</small></div>${cur?.strokes!=null&&cur.complete?`<div><span class="micro-label">ROUND SCORE</span><b>${e(cur.strokes)}</b></div>`:''}</div><p class="live-line">${badge(ev)} <span class="live-age">${e(updated(ev))} · ESPN</span></p></section>`;
}
// PBEcast observed scoring: hole results ESPN posted. Never shot positions.
export function pbecastLive(ev,holeScores){
 const top=ev.leaderboard.filter(r=>r.status==='active').slice(0,8),hs=new Map((holeScores||[]).map(h=>[h.slug||h.name,h.holes]));
 const label={'-3':'albatross','-2':'eagle','-1':'birdie','0':'par','1':'bogey','2':'double bogey'};
 return `<section class="cast-live" aria-label="Observed live scoring"><div class="cast-live-head"><span class="truth truth-observed">OBSERVED SCORECARD DATA</span>${badge(ev)}<span class="live-age">${e(updated(ev))}</span></div><div class="cast-live-grid">${top.map(r=>{const holes=hs.get(r.slug||r.name)||[];const last=holes.slice(-3).reverse();return `<article class="cast-live-card"><header><b>${name(r)}</b><span>${e(r.position||'—')} · ${e(tp(r.total_to_par))}</span></header><p class="micro-label">ROUND ${e(ev.round)} · ${r.thru===18?'FINISHED':r.thru>0?'THRU '+e(r.thru):'NOT STARTED'}</p>${last.length?`<ul>${last.map(h=>{const d=h.par?h.strokes-h.par:null;return `<li class="ch ${d<0?'is-under':d>0?'is-over':''}"><span>${e(h.hole)}</span>${e(h.strokes)}<small>${e(d===null?'':label[String(Math.max(-3,Math.min(2,d)))]||'+'+d)}</small></li>`;}).join('')}</ul>`:`<p class="gnote">${ev.holes_available?'No holes posted yet.':'This tour’s feed posts round totals, not hole scores.'}</p>`}</article>`;}).join('')}</div><p class="gnote">Hole results as posted by ESPN. Ball positions are not tracked; any course animation is a reconstruction.</p></section>`;
}
export function weatherNow(w){
 if(!w)return '';return `<p class="live-wx"><span>${e(w.temp_f??'—')}°F</span><span>Wind ${e(w.wind_dir||'')} ${e(w.wind_mph??'—')} mph</span>${w.gust_mph!=null?`<span>Gust ${e(w.gust_mph)} mph</span>`:''}<small>Forecast for this hour · ${w.precision==='locality'?'town-level estimate':'course point'} · updated ${e(ago(w.age_seconds))}</small></p>`;
}
