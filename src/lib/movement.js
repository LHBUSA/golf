// Leaderboard movement from observed ESPN snapshots only. Each marker is an observation; dotted connectors
// join consecutive observations and are not positions. Ties are drawn at the shared position and labelled.
import {e} from './ui.js';
const PAL=['#12392e','#c8aa68','#b2483a','#1d5f8a','#6c5a9b','#2f7a5c','#8a5a2b'];
const key=x=>x.slug||x.name;
// Who to draw: the current top five plus anyone who led at any observation (max 7), by current position.
export function movementSeries(points,{top=5,max=7}={}){
 const pts=(points||[]).filter(p=>p.top?.length);if(pts.length<2)return null;
 const last=pts.at(-1).top,leaders=new Set(pts.flatMap(p=>p.top.filter(x=>x.pos===1).map(key)));
 const pick=[...new Set([...last.filter(x=>x.pos&&x.pos<=top).map(key),...leaders])].slice(0,max);
 const names=new Map(pts.flatMap(p=>p.top).map(x=>[key(x),x.name]));
 return {times:pts.map(p=>p.t),rounds:pts.map(p=>p.round),series:pick.map(k=>({key:k,name:names.get(k),slug:pts.flatMap(p=>p.top).find(x=>key(x)===k)?.slug||null,obs:pts.map(p=>{const x=p.top.find(y=>key(y)===k);return x?{pos:x.pos,tied:x.tied,to_par:x.to_par}:null;})}))};
}
const tp=v=>v==null?'':v===0?'E':v>0?'+'+v:'−'+Math.abs(v);
export function movementChart(points,{title='Leaderboard movement',compact=false,maxPos=20}={}){
 const m=movementSeries(points);if(!m)return '';
 const W=compact?360:720,H=compact?150:300,L=compact?26:34,R=compact?70:150,T=12,B=compact?18:30;
 const t0=Date.parse(m.times[0]),t1=Date.parse(m.times.at(-1)),x=t=>L+(t1===t0?0:(Date.parse(t)-t0)/(t1-t0))*(W-L-R);
 const worst=Math.min(maxPos,Math.max(5,...m.series.flatMap(s=>s.obs.filter(Boolean).map(o=>o.pos)))),y=p=>T+(Math.min(p,worst)-1)/(worst-1||1)*(H-T-B);
 const grid=[1,...[5,10,15,20].filter(v=>v<worst),worst].map(v=>`<line class="ggrid" x1="${L}" x2="${W-R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text class="gtick" x="${L-5}" y="${y(v).toFixed(1)}" text-anchor="end" dominant-baseline="middle">${v===worst&&worst===maxPos?v+'+':v}</text>`).join('');
 // Round boundaries from the observations themselves.
 const rb=m.rounds.map((r,i)=>i&&r!==m.rounds[i-1]?`<line class="mv-round" x1="${x(m.times[i]).toFixed(1)}" x2="${x(m.times[i]).toFixed(1)}" y1="${T}" y2="${H-B}"/>${compact?'':`<text class="gtick" x="${(x(m.times[i])+3).toFixed(1)}" y="${H-B+14}">R${r}</text>`}`:'').join('');
 const ends=[];
 const lines=m.series.map((s,k)=>{const pts=s.obs.map((o,i)=>o?[x(m.times[i]),y(o.pos),o]:null).filter(Boolean);if(!pts.length)return '';const c=PAL[k%PAL.length];
  const last=pts.at(-1);ends.push({x:last[0],y:last[1],pos:last[2].pos,tied:last[2].tied,name:(s.name||'').split(' ').slice(-1)[0],c});
  return `<polyline class="mv-link" stroke="${c}" points="${pts.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ')}"/>${pts.map(p=>`<circle class="mv-pt" fill="${c}" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${compact?2.5:3.5}"><title>${e(s.name)}: ${p[2].tied?'T':''}${p[2].pos} (${tp(p[2].to_par)})</title></circle>`).join('')}`;}).join('');
 // End labels: players sharing a final position get one label; labels are spaced so they never overlap.
 const groups=[...ends.reduce((g,x)=>g.set(x.pos+':'+Math.round(x.x),[...(g.get(x.pos+':'+Math.round(x.x))||[]),x]),new Map()).values()].sort((a,b)=>a[0].y-b[0].y);
 let prev=-99;const labels=groups.map(g=>{const ly=Math.max(g[0].y,prev+(compact?11:14));prev=ly;const n=g.length,txt=n===1?`${g[0].name} ${g[0].tied?'T':''}${g[0].pos}`:`${g[0].tied?'T':''}${g[0].pos} · ${g.slice(0,2).map(x=>x.name).join(', ')}${n>2?` +${n-2}`:''}`;return `${Math.abs(ly-g[0].y)>2?`<line class="mv-tick" x1="${(g[0].x+2).toFixed(1)}" y1="${g[0].y.toFixed(1)}" x2="${(g[0].x+5).toFixed(1)}" y2="${ly.toFixed(1)}"/>`:''}<text class="mv-label" fill="${n===1?g[0].c:'#1e2823'}" x="${(g[0].x+6).toFixed(1)}" y="${ly.toFixed(1)}" dominant-baseline="middle">${e(txt)}</text>`;}).join('');
 const when=t=>new Date(t).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',timeZone:'UTC'})+' UTC';
 const table=compact?'':`<details class="gtable"><summary>Data table</summary><div class="table-wrap" tabindex="0" role="region" aria-label="Observed positions"><table class="index-table"><thead><tr><th scope="col">Player</th>${m.times.map(t=>`<th scope="col" class="num">${e(when(t))}</th>`).join('')}</tr></thead><tbody>${m.series.map(s=>`<tr><th scope="row">${e(s.name)}</th>${s.obs.map(o=>`<td class="num">${o?(o.tied?'T':'')+o.pos:'—'}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>`;
 return `<figure class="gchart movement${compact?' is-compact':''}"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${e(title)}: ${m.times.length} observed snapshots from ${e(when(m.times[0]))} to ${e(when(m.times.at(-1)))}">${grid}${rb}${lines}${labels}</svg><figcaption>${e(title)} · ${m.times.length} observed ESPN snapshots, ${e(when(m.times[0]))}–${e(when(m.times.at(-1)))}. Markers are observations; dotted links are not positions. Lower is better.</figcaption>${table}</figure>`;
}
