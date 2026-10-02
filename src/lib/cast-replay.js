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
export function castReplayPanel(rows,{edition,course=null,round=null}={}){
 const opts=rows.filter(r=>r.holes?.length).slice(0,60);if(!opts.length)return '';
 return `<section class="cast-replay" data-cast-replay data-edition="${e(edition)}"${course?` data-course="${e(course)}"`:''}><div class="cast-live-head"><span class="truth truth-observed">OBSERVED SCORECARD DATA</span><span class="truth truth-reconstructed" data-rc-recon>RECONSTRUCTED VISUALIZATION</span><span class="truth truth-observed" data-rc-real hidden>VERIFIED COURSE ROUTING</span></div>
<div class="rc-controls"><label>Player <select data-rc-player>${opts.map((r,i)=>`<option value="${i}">${e(r.player.name)}</option>`).join('')}</select></label><label>Round <select data-rc-round></select></label><button type="button" class="button button-gold" data-rc-play>Play round</button><button type="button" class="button button-quiet" data-rc-prev aria-label="Previous hole">◀</button><button type="button" class="button button-quiet" data-rc-next aria-label="Next hole">▶</button></div>
<div class="rc-stage"><div class="rc-canvas" data-rc-canvas></div><div class="rc-card" data-rc-card aria-live="polite"></div></div>
<ol class="rc-strip" data-rc-strip></ol>
<p class="gnote" data-rc-note>Scores are as published. Exact shot locations are unavailable: the hole shape, bunkers and ball path are a generic reconstruction from par and yardage, not shot tracking.</p></section>`;
}
export {label as scoreLabel};
