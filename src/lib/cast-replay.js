// PBEcast replay: observed hole scores drawn on a generic, reconstructed hole template.
// Truth levels: scores are OBSERVED SCORECARD DATA; hole shapes and ball positions are RECONSTRUCTED.
// No actual shot coordinates exist in our sources; nothing here claims they do.
import {e} from './ui.js';
export const W=360,H=520;
const TEE=[180,470],GREEN=[180,92];
// Generic waypoints by par (dogleg direction alternates by hole number so holes are distinguishable).
export function waypoints(par,hole){
 const s=hole%2?1:-1;
 if(par<=3)return [TEE,GREEN];
 if(par===4)return [TEE,[180+s*58,250],GREEN];
 return [TEE,[180-s*52,330],[180+s*60,195],GREEN];
}
// Reconstructed shot ends for a hole: approach shots along the template, then short game/putts on the green.
export function shotPoints(par,strokes,hole){
 if(!Number.isInteger(strokes)||strokes<1)return [];
 const wp=waypoints(par,hole),toGreen=Math.max(1,Math.min(strokes,par-2)),pts=[];
 for(let i=1;i<=toGreen;i++){const f=i/toGreen*(wp.length-1),k=Math.min(wp.length-2,Math.floor(f)),t=f-k,a=wp[k],b=wp[k+1];pts.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t+(i<toGreen?0:22)]);}
 const left=strokes-toGreen;
 for(let i=1;i<=left;i++){const r=Math.max(0,26*(1-i/left)),ang=1.1+i;pts.push(i===left?[...GREEN]:[GREEN[0]+r*Math.cos(ang),GREEN[1]+12+r*Math.sin(ang)*0.6]);}
 if(strokes<=toGreen)pts[pts.length-1]=[...GREEN];
 return pts;
}
const label=d=>d===null?'':d<=-3?'Albatross':d===-2?'Eagle':d===-1?'Birdie':d===0?'Par':d===1?'Bogey':d===2?'Double bogey':`+${d}`;
export function holeSvg({hole,par,yards,strokes,wind=null}){
 const wp=waypoints(par,hole),fair=wp.map(p=>p.join(',')).join(' ');
 const d=Number.isInteger(strokes)&&par?strokes-par:null;
 const windArrow=wind&&Number.isFinite(wind.from_deg)?`<g class="rc-wind" transform="translate(316 44) rotate(${(wind.from_deg+180)%360})"><line x1="0" y1="14" x2="0" y2="-14"/><path d="M-6 -8 L0 -16 L6 -8"/></g><text class="rc-wind-t" x="316" y="80" text-anchor="middle">${e(wind.label||'')}</text>`:'';
 return `<svg class="rc-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Hole ${hole}, par ${par}${yards?', '+yards+' yards':''}${strokes?': '+strokes+' strokes, '+label(d):''}. Reconstructed visualization; shot locations are not tracked.">
<rect class="rc-rough" width="${W}" height="${H}"/>
<polyline class="rc-fairway" points="${fair}"/>
<ellipse class="rc-bunker" cx="${GREEN[0]-48}" cy="${GREEN[1]+18}" rx="18" ry="10"/><ellipse class="rc-bunker" cx="${GREEN[0]+46}" cy="${GREEN[1]-4}" rx="14" ry="9"/>
<ellipse class="rc-green" cx="${GREEN[0]}" cy="${GREEN[1]}" rx="44" ry="30"/>
<line class="rc-pin" x1="${GREEN[0]}" y1="${GREEN[1]}" x2="${GREEN[0]}" y2="${GREEN[1]-34}"/><path class="rc-flag" d="M${GREEN[0]} ${GREEN[1]-34} l18 6 l-18 6z"/>
<rect class="rc-tee" x="${TEE[0]-16}" y="${TEE[1]-7}" width="32" height="14" rx="3"/>
<polyline class="rc-trail" data-trail points="${TEE.join(',')}"/>
<circle class="rc-ball" data-ball cx="${TEE[0]}" cy="${TEE[1]}" r="6"/>
<text class="rc-hole" x="16" y="34">HOLE ${hole}</text><text class="rc-meta" x="16" y="56">PAR ${e(par??'—')}${yards?' · '+yards+' YDS':''}</text>
${windArrow}</svg>`;
}
// ---- Round Replay (replay v2): presentation over the OBSERVED scorecard. Playback = hole by hole, never shot by shot.
export const CADENCE_MS=1500; // one hole per 1.5 s at 1x (no shot sequence exists, so cadence is not tied to strokes)
const MINUS='\u2212';
export const toParText=n=>n==null||!Number.isFinite(n)?'\u2014':n===0?'E':n>0?'+'+n:MINUS+Math.abs(n);
/** A replayable card is exactly holes 1-18, each with an integer stroke count. Anything else is dropped, never padded. */
export function isCompleteCard(scores){
 if(!Array.isArray(scores)||scores.length!==18)return false;
 const seen=new Set(scores.map(s=>s?.hole));if(seen.size!==18)return false;
 for(let n=1;n<=18;n++)if(!seen.has(n))return false;
 return scores.every(s=>Number.isInteger(s.strokes)&&s.strokes>0&&Number.isInteger(s.to_par));
}
/** rounds API rows -> rows whose `holes` keep complete cards only (sorted 1-18); rows with none are dropped. */
export function completeRows(rows,limit=60){
 return (rows||[]).map(r=>({...r,holes:(r.holes||[]).filter(h=>isCompleteCard(h.scores)).map(h=>({...h,scores:[...h.scores].sort((a,b)=>a.hole-b.hole)}))})).filter(r=>r.holes.length).slice(0,limit);
}
export const runningToPar=(holes,i)=>holes.slice(0,i+1).reduce((s,x)=>s+(x.to_par??0),0);
export const scoreTier=d=>d==null?'':d<=-2?'eagle':d===-1?'birdie':d===0?'par':d===1?'bogey':'double';
/** Published round total, shown only when it agrees with the 18 observed holes (no fabricated or conflicting totals). */
export function roundTotal(row,round,holes){
 const pub=(row?.rounds||[]).find(x=>String(x.round)===String(round));if(!pub||!Number.isInteger(pub.strokes))return null;
 const sum=holes.reduce((s,h)=>s+h.strokes,0),tp=holes.reduce((s,h)=>s+h.to_par,0);
 return pub.strokes===sum&&(pub.to_par==null||pub.to_par===tp)?{strokes:pub.strokes,to_par:tp}:null;
}
/**
 * Playback state machine (DOM-free). Advances one hole per tick; schedule/cancel are injectable for tests.
 * onShow(i,{animate}) renders hole i; onState({playing,speed,idx,count}) updates the transport.
 */
export function createPlayer({onShow=()=>{},onState=()=>{},schedule=(f,ms)=>setTimeout(f,ms),cancel=t=>clearTimeout(t),cadence=CADENCE_MS}={}){
 let n=0,idx=0,playing=false,speed=1,timer=null;
 const emit=()=>onState({playing,speed,idx,count:n});
 const clear=()=>{if(timer!=null)cancel(timer);timer=null;};
 const go=(i,animate=true)=>{if(!n)return;idx=Math.max(0,Math.min(n-1,i));onShow(idx,{animate});emit();};
 const tick=()=>{timer=null;if(!playing)return;go(idx+1);if(idx>=n-1){pause();return;}timer=schedule(tick,cadence/speed);};
 function pause(){playing=false;clear();emit();}
 function play(){if(!n||playing)return;playing=true;if(idx>=n-1)go(0,false);else emit();clear();timer=schedule(tick,cadence/speed);}
 return {
  load(count){clear();playing=false;n=count;idx=0;if(n)onShow(0,{animate:false});emit();},
  play,pause,toggle(){playing?pause():play();},
  next(){pause();if(idx<n-1)go(idx+1);},prev(){pause();if(idx>0)go(idx-1);},
  go(i){pause();go(i);},
  setSpeed(s){speed=s;if(playing){clear();timer=schedule(tick,cadence/speed);}emit();},
  get state(){return {idx,playing,speed,count:n};}
 };
}
/** Scorecard rail: OUT 1-9 | IN 10-18 with observed totals; current hole is aria-current + .is-on. */
export function railHtml(holes,idx,{total=null,round=null}={}){
 const cell=(h,i)=>{const t=scoreTier(h.to_par);return `<li><button type="button" class="rc-h rc-s-${t}${i===idx?' is-on':''}" data-rc-hole="${i}"${i===idx?' aria-current="step"':''} aria-label="Hole ${h.hole}, par ${e(h.par??'unknown')}: ${h.strokes} strokes, ${e(label(h.to_par))}"><small aria-hidden="true">${h.hole}</small><span class="rc-sc" aria-hidden="true">${h.strokes}</span></button></li>`;};
 const half=(name,a,b)=>{const hs=holes.slice(a,b),sum=hs.reduce((s,h)=>s+h.strokes,0),tp=hs.reduce((s,h)=>s+h.to_par,0),nm=name==='OUT'?'Front nine':'Back nine';
  return `<div class="rc-half"><p class="rc-half-k" aria-hidden="true">${name}</p><ol class="rc-cells" aria-label="${nm}">${hs.map((h,k)=>cell(h,a+k)).join('')}</ol><p class="rc-sub"><span class="sr-only">${nm}: </span><b>${sum}</b><small>${e(toParText(tp))}</small></p></div>`;};
 return `${half('OUT',0,9)}${half('IN',9,18)}${total?`<p class="rc-tot"><small>${round!=null?'ROUND '+e(round):'TOTAL'}</small><b>${total.strokes}</b><span>${e(toParText(total.to_par))}</span></p>`:''}`;
}
const ordinal=n=>{const s=['th','st','nd','rd'],v=n%100;return n+(s[(v-20)%10]||s[v]||s[0]);};
/** Hole Intelligence panel: observed score, the edition's published setup and observed field scoring only. */
export function cardHtml(holes,i,{field=null}={}){
 const h=holes[i];if(!h)return '';const t=scoreTier(h.to_par),run=runningToPar(holes,i);
 const fieldTxt=field&&Number.isFinite(field.scoring_average)?`<div class="rc-field"><dt>Field average</dt><dd>${field.scoring_average.toFixed(2)}${field.difficulty_rank?`<small>${field.difficulty_tied?'T':''}${ordinal(field.difficulty_rank)} hardest of ${e(field.difficulty_of)}</small>`:''}</dd></div>`:'';
 return `<p class="rc-k">HOLE</p><p class="rc-no">${h.hole}</p><p class="rc-par">PAR ${e(h.par??'\u2014')}${h.yards?` · ${e(h.yards)} YDS`:''}</p>
<div class="rc-result rc-s-${t}"><b class="rc-mark">${h.strokes}</b><span>${e(label(h.to_par))}</span></div>
<dl class="rc-dl"><div><dt>Hole</dt><dd>${e(toParText(h.to_par))}</dd></div><div><dt>Round</dt><dd class="rc-run">${e(toParText(run))}</dd></div><div><dt>Thru</dt><dd>${i+1}</dd></div>${fieldTxt}</dl>`;
}
export function castReplayPanel(rows,{edition,course=null,courseName=null}={}){
 const opts=rows.filter(r=>r.holes?.length).slice(0,60);if(!opts.length)return '';
 const sel=(k,lab,body)=>`<label class="rc-select"><span>${lab}</span><select data-rc-${k}>${body}</select></label>`;
 return `<section class="cast-replay" data-cast-replay data-edition="${e(edition)}"${course?` data-course="${e(course)}"`:''} aria-labelledby="rc-title"><div class="rc-shell">
<header class="rc-top"><div class="rc-brand"><p class="rc-kicker">GOLF PBECAST</p><h2 class="rc-title" id="rc-title">Round Replay</h2></div>
<div class="rc-who" data-rc-who></div>
<div class="rc-controls">${sel('player','Player',opts.map((r,i)=>`<option value="${i}">${e(r.player.name)}</option>`).join(''))}${sel('round','Round','')}</div>
<ul class="rc-truth" aria-label="Data provenance"><li class="rc-chip rc-chip-obs">Observed scorecard</li><li class="rc-chip rc-chip-recon" data-rc-recon>Reconstructed visualization</li><li class="rc-chip rc-chip-real" data-rc-real hidden>Verified course routing</li></ul>
${course&&courseName?`<p class="rc-course"><a href="/course/${e(course)}">${e(courseName)}</a></p>`:''}</header>
<div class="rc-stage"><div class="rc-canvas" data-rc-canvas></div><p class="rc-attr" data-rc-attr hidden>© <a href="https://www.openstreetmap.org/copyright" rel="noopener">OpenStreetMap contributors</a> · ODbL · current mapped routing</p></div>
<aside class="rc-card" data-rc-card aria-live="polite" aria-atomic="true"></aside>
<div class="rc-transport"><button type="button" class="rc-btn" data-rc-prev aria-label="Previous hole"><span aria-hidden="true">◀</span><span class="rc-btn-t" aria-hidden="true">Prev</span></button><button type="button" class="rc-btn rc-play" data-rc-play aria-pressed="false"><span class="rc-ico" aria-hidden="true"></span><span data-rc-play-t>Play round</span></button><button type="button" class="rc-btn" data-rc-next aria-label="Next hole"><span class="rc-btn-t" aria-hidden="true">Next</span><span aria-hidden="true">▶</span></button><button type="button" class="rc-btn rc-speed" data-rc-speed aria-pressed="false" aria-label="Double playback speed">2×</button><p class="rc-pos" data-rc-pos></p></div>
<div class="rc-rail" data-rc-strip role="group" aria-label="Scorecard: select a hole"></div>
<p class="rc-note" data-rc-note>Scores are as published. Exact shot locations are unavailable: the hole shape, bunkers and ball path are a generic reconstruction from par and yardage, not shot tracking.</p>
</div></section>`;
}
export {label as scoreLabel};
