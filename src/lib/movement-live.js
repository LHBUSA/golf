// Tournament-page leaderboard movement: the PBEcast timeline (observed snapshots only) in a standalone card.
// Default view = contenders (leaders, within 3 shots, biggest movers), each with its own colour and end label; the full
// observed top-20 stays in the data table. Markers are observations; curves only link consecutive observations.
import {timelineSeries,timelineSvg,timelineTable,timelineLayout} from './cast-v3.js';
import {e} from './ui.js';
let FILTER='contenders';
const clock=t=>new Date(t).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
export function mountMovement(host,points,{title='Leaderboard movement'}={}){
 const pts=(points||[]).filter(p=>p.top?.length);if(!host||pts.length<2){if(host)host.innerHTML='';return null;}
 host.innerHTML=`<section class="mvx" aria-labelledby="mvx-h"><div class="mvx-head"><div><p class="mvx-k">LEADERBOARD MOVEMENT</p><h3 id="mvx-h">${e(title)}</h3></div><div class="mvx-seg" role="group" aria-label="Players shown">${[['contenders','Contenders'],['top5','Top 5'],['top10','Top 10']].map(([k,l])=>`<button type="button" data-mvx-f="${k}" aria-pressed="false">${l}</button>`).join('')}</div></div><div class="mvx-plot" data-mvx-plot tabindex="0" aria-describedby="mvx-cap"></div><ul class="mvx-keys" data-mvx-keys aria-label="Players in the chart"></ul><p class="mvx-cap" id="mvx-cap"></p><div data-mvx-table></div></section>`;
 const plot=host.querySelector('[data-mvx-plot]'),keys=host.querySelector('[data-mvx-keys]'),cap=host.querySelector('#mvx-cap'),tbl=host.querySelector('[data-mvx-table]');
 const st={m:null,focus:null,cursor:null,w:0,h:0};
 function draw(){if(!st.m)return;const w=Math.round(plot.clientWidth)||0;if(!w)return;st.w=w;st.h=Math.round(plot.clientHeight)||300;
  plot.innerHTML=timelineSvg(st.m,{width:w,height:st.h,focus:st.focus,cursor:st.cursor,palette:FILTER==='contenders'});}
 function render(){for(const b of host.querySelectorAll('[data-mvx-f]'))b.setAttribute('aria-pressed',String(b.dataset.mvxF===FILTER));
  st.m=timelineSeries(pts,{filter:FILTER});if(!st.m){host.innerHTML='';return;}
  keys.innerHTML=st.m.series.map((x,i)=>{const o=[...x.obs].reverse().find(Boolean);return `<li><button type="button" class="${FILTER==='contenders'?'c'+(i%8):st.m.leaders.has(x.key)?'is-leader':x.key===st.m.mover?'is-mover':'is-muted'}" data-mvx-k="${e(x.key)}" aria-label="${e(x.name)}${o?`, last observed ${o.tied?'T':''}${o.pos}`:''}"><i aria-hidden="true"></i>${e(x.name)}${o?` <small>${o.tied?'T':''}${o.pos}</small>`:''}</button></li>`;}).join('');
  cap.textContent=`${st.m.times.length} observed ESPN snapshots, ${clock(st.m.times[0])}–${clock(st.m.times.at(-1))} (your time). Dots are observations; lines only link consecutive observations and are not positions between them. P1 at the top: lower is better. ${FILTER==='contenders'?'Contenders: leaders, players within 3 shots of the lead, and the biggest movers this round.':''} Use the arrow keys on the chart to step through snapshots.`;
  tbl.innerHTML=timelineTable(timelineSeries(pts,{filter:'top20'}));draw();}
 host.addEventListener('click',ev=>{const b=ev.target.closest?.('[data-mvx-f]');if(b){FILTER=b.dataset.mvxF;st.focus=null;render();b.focus();}});
 const hl=(ev,on)=>{const t=ev.target.closest?.('[data-mvx-k]');if(!t)return;st.focus=on?t.dataset.mvxK:null;draw();};
 keys.addEventListener('pointerover',ev=>hl(ev,true));keys.addEventListener('pointerout',ev=>hl(ev,false));keys.addEventListener('focusin',ev=>hl(ev,true));keys.addEventListener('focusout',ev=>hl(ev,false));
 let raf=0;plot.addEventListener('pointermove',ev=>{if(raf)return;const cx=ev.clientX,cy=ev.clientY;raf=requestAnimationFrame(()=>{raf=0;const m=st.m;if(!m)return;const r=plot.getBoundingClientRect(),g=timelineLayout(m,{width:st.w,height:st.h});
  let best=0,bd=1e9;for(let i=0;i<m.times.length;i++){const d=Math.abs(g.x(i)-(cx-r.left));if(d<bd){bd=d;best=i;}}let fk=null,fd=18;for(const x of m.series){const o=x.obs[best];if(!o)continue;const d=Math.abs(g.y(o.pos)-(cy-r.top));if(d<fd){fd=d;fk=x.key;}}
  st.cursor=best;st.focus=fk;draw();});});
 plot.addEventListener('pointerleave',()=>{st.cursor=null;st.focus=null;draw();});
 plot.addEventListener('keydown',ev=>{const n=st.m?.times.length||0;let c=st.cursor??n;if(ev.key==='ArrowLeft')c=Math.max(0,c-1);else if(ev.key==='ArrowRight')c=Math.min(n-1,c+1);else if(ev.key==='Home')c=0;else if(ev.key==='End')c=n-1;else if(ev.key==='Escape'){st.cursor=null;draw();return;}else return;ev.preventDefault();st.cursor=c;draw();});
 plot.addEventListener('blur',()=>{st.cursor=null;draw();});
 if('ResizeObserver' in window)new ResizeObserver(()=>{if(Math.abs(plot.clientWidth-st.w)>4)draw();}).observe(plot);
 render();return st;
}
