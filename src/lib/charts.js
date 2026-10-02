// Golf charts: static SVG strings (prerender + browser), PropBetEdge DNA visual language.
// Every chart carries an accessible name and a text/table equivalent. Null values are never drawn as 0.
import {e} from './ui.js';
export const DIM_AXIS={scoring:['SCORING','SCR'],consistency:['CONSISTENCY','CON'],under_par:['UNDER PAR','UND'],cuts:['CUTS MADE','CUT'],top10:['TOP 10','T10'],contention:['CONTENTION','CNT'],form:['FORM','FRM'],majors:['MAJORS','MAJ'],par3:['PAR 3','P3'],par4:['PAR 4','P4'],par5:['PAR 5','P5']};
export const DIM_NAME={scoring:'Scoring vs field',consistency:'Consistency',under_par:'Under-par rounds',cuts:'Cuts made',top10:'Top-10 rate',contention:'Contention (top 5)',form:'Recent form',majors:'Major performance',par3:'Par-3 scoring',par4:'Par-4 scoring',par5:'Par-5 scoring'};
const ord=n=>{const s=['th','st','nd','rd'],v=n%100;return n+(s[(v-20)%10]||s[v]||s[0]);};
const f1=([x,y])=>`${x.toFixed(1)},${y.toFixed(1)}`;
// dims: [{code, percentile|null, confidence, sample}] ; overlay: same codes for player B
export function radar(dims,{overlay=null,labelA='',labelB='',title='Player DNA fingerprint'}={}){
 const rows=dims.filter(d=>DIM_AXIS[d.code]);if(rows.length<3)return '';
 const N=rows.length,R=128,CX=240,CY=200,pt=(i,r)=>{const a=-Math.PI/2+2*Math.PI*i/N;return [CX+r*Math.cos(a),CY+r*Math.sin(a)];};
 const ring=f=>rows.map((_,i)=>f1(pt(i,R*f))).join(' ');
 const shape=(vals,cls)=>{const pts=vals.map((v,i)=>v===null?null:pt(i,R*v/100));return pts.every(Boolean)?`<polygon class="${cls}" points="${pts.map(f1).join(' ')}"/>`:pts.map(p=>p?`<circle class="${cls}-pt" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="4.5"/>`:'').join('');};
 const a=rows.map(d=>d.percentile),b=overlay?rows.map(d=>overlay.find(o=>o.code===d.code)?.percentile??null):null;
 const axes=rows.map((d,i)=>{const [x,y]=pt(i,R+30),[px,py]=pt(i,R),dx=x-CX,anchor=Math.abs(dx)<12?'middle':dx>0?'start':'end';const [long,short]=DIM_AXIS[d.code];const v=d.percentile===null?'—':String(d.percentile);
  return `<line x1="${CX}" y1="${CY}" x2="${px.toFixed(1)}" y2="${py.toFixed(1)}"/><text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}" dominant-baseline="middle" class="rx-long">${long}<tspan class="rx-v" dx="5">${b?'':v}</tspan></text><text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}" dominant-baseline="middle" class="rx-short">${short}</text>`;}).join('');
 const label=rows.map((d,i)=>`${DIM_NAME[d.code]} ${d.percentile===null?'not published':ord(d.percentile)+' percentile'}${b?`; ${labelB||'B'} ${b[i]===null?'not published':ord(b[i])}`:''}`).join('; ');
 return `<figure class="gradar"><svg viewBox="0 0 480 400" role="img" aria-label="${title?e(title)+': ':'Percentiles: '}${e(label)}"><g class="gweb">${[.25,.5,.75,1].map(f=>`<polygon points="${ring(f)}"/>`).join('')}</g><g class="gaxes">${axes}</g>${b?shape(b,'gshape-b'):''}${shape(a,'gshape')}</svg>${b?`<p class="glegend"><span class="gkey gkey-a"></span>${e(labelA)} <span class="gkey gkey-b"></span>${e(labelB)}</p>`:''}<figcaption>0–100 percentile within the player’s own division cohort. Axes without a published percentile show no point.</figcaption></figure>`;
}
// Percentile tracks with quartile ticks.
export function tracks(dims,{definitions={}}={}){
 return `<div class="gtracks" role="list">${dims.map(d=>`<div class="gtrack-row" role="listitem"><span class="gtrack-name">${e(DIM_NAME[d.code]||d.code)}${definitions[d.code]?`<small>${e(definitions[d.code])}</small>`:''}</span><span class="gtrack" aria-hidden="true">${d.percentile===null?'':`<i data-w="${Math.round(d.percentile)}" class="${d.percentile>=75?'hi':d.percentile<=25?'lo':''}"></i>`}</span><b class="gtrack-v">${d.percentile===null?'—':ord(d.percentile)}</b><span class="gconf gconf-${String(d.confidence||'').toLowerCase()}">${e(d.confidence==='INSUFFICIENT'?'Insufficient':d.confidence?d.confidence[0]+d.confidence.slice(1).toLowerCase():'')} · n=${e(d.sample??0)}</span></div>`).join('')}</div>`;
}
// Form trend: strokes vs field per event (positive = better), ordered by date. Optional second series.
export function formChart(series,{other=null,labelA='',labelB='',title='Form: strokes per round vs field'}={}){
 const pts=series.filter(p=>Number.isFinite(p.vs_field));if(pts.length<2)return '';
 const all=[...pts,...(other||[]).filter(p=>Number.isFinite(p.vs_field))];
 const dates=[...new Set(all.map(p=>p.ends_on))].sort(),W=640,H=220,L=36,Rr=12,T=14,B=30;
 const lo=Math.min(-1,...all.map(p=>p.vs_field)),hi=Math.max(1,...all.map(p=>p.vs_field)),y=v=>T+(hi-v)/(hi-lo)*(H-T-B),x=d=>L+(dates.length===1?0:dates.indexOf(d)/(dates.length-1))*(W-L-Rr);
 const line=(ps,cls)=>`<polyline class="${cls}" points="${ps.map(p=>f1([x(p.ends_on),y(p.vs_field)])).join(' ')}"/>${ps.map(p=>`<circle class="${cls}-pt${p.major?' is-major':''}" cx="${x(p.ends_on).toFixed(1)}" cy="${y(p.vs_field).toFixed(1)}" r="${p.major?5:3.5}"><title>${e(p.name)}: ${p.vs_field>0?'+':''}${p.vs_field} vs field</title></circle>`).join('')}`;
 const op=(other||[]).filter(p=>Number.isFinite(p.vs_field));
 const ticks=[hi,0,lo].map(v=>`<text x="${L-6}" y="${y(v).toFixed(1)}" text-anchor="end" dominant-baseline="middle" class="gtick">${v>0?'+':''}${Math.round(v*10)/10}</text>`).join('');
 const years=[...new Set(dates.map(d=>d.slice(0,4)))].map(yr=>{const d=dates.find(z=>z.startsWith(yr));return `<text x="${x(d).toFixed(1)}" y="${H-8}" class="gtick">${yr}</text>`;}).join('');
 const rows=pts.slice().reverse().map(p=>`<tr><td>${e(p.name)}</td><td>${e(p.ends_on)}</td><td class="num">${p.vs_field>0?'+':''}${p.vs_field}</td><td class="num">${e(p.status==='finished'?(p.tied?'T':'')+p.position:p.status==='cut'?'CUT':p.status)}</td></tr>`).join('');
 return `<figure class="gchart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${title?e(title)+'; ':'Results against the field; '}${pts.length} events; table follows"><line class="gzero" x1="${L}" x2="${W-Rr}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}"/>${ticks}${years}${op.length?line(op,'gline-b'):''}${line(pts,'gline')}</svg>${other?`<p class="glegend"><span class="gkey gkey-a"></span>${e(labelA)} <span class="gkey gkey-b"></span>${e(labelB)}</p>`:''}<figcaption>Above the line = better than that event’s field average per round. Larger dots are majors.</figcaption><details class="gtable"><summary>Data table</summary><div class="table-wrap" tabindex="0" role="region" aria-label="Form data"><table class="index-table"><thead><tr><th scope="col">Event</th><th scope="col">Final round</th><th scope="col" class="num">Vs field</th><th scope="col" class="num">Finish</th></tr></thead><tbody>${rows}</tbody></table></div></details></figure>`;
}
// Round profile: diverging bars by round number, field-relative.
export function roundProfile(profiles,{labels=['']}={}){
 const sets=Array.isArray(profiles[0])?profiles:[profiles];if(!sets.some(s=>s.some(r=>Number.isFinite(r.vs_field))))return '';
 const max=Math.max(1,...sets.flat().map(r=>Math.abs(r.vs_field||0)));
 return `<div class="ground" role="table" aria-label="Round profile: average strokes per round versus field">${[1,2,3,4].map(n=>`<div class="ground-row" role="row"><span class="ground-r" role="rowheader">R${n}</span>${sets.map((s,k)=>{const r=s.find(x=>x.round===n)||{};const v=r.vs_field;return `<span class="ground-cell" role="cell"><span class="ground-bar ${k?'is-b':''}" aria-hidden="true">${Number.isFinite(v)?`<i class="${v>=0?'pos':'neg'}" data-w="${Math.min(100,Math.round(Math.abs(v)/max*100))}"></i>`:''}</span><b>${Number.isFinite(v)?(v>0?'+':'')+v:'—'}</b><small>${labels[k]?e(labels[k])+' · ':''}n=${e(r.sample??0)}</small></span>`;}).join('')}</div>`).join('')}</div>`;
}
// Finish distribution over full-field starts.
export function finishBars(d){
 if(!d?.starts)return '';
 const rows=[['Wins',d.wins],['Top 5',d.top5],['Top 10',d.top10],['Top 25',d.top25],['Made cut',d.made_cut],['Missed cut',d.missed_cut],['WD / DQ',d.wd_dq]];
 return `<div class="gfinish" role="table" aria-label="Finish distribution over ${d.starts} full-field starts">${rows.map(([k,v])=>`<div class="gfinish-row" role="row"><span role="rowheader">${k}</span><span class="gfinish-bar" aria-hidden="true"><i data-w="${Math.round(100*v/d.starts)}"></i></span><b role="cell">${v}</b><small role="cell">${Math.round(100*v/d.starts)}%</small></div>`).join('')}<p class="gnote">${d.starts} full-field starts in coverage.</p></div>`;
}
export {ord};

// Bag DNA: performance in bag-related areas (no equipment credit). Categories average their component percentiles.
export function bagDna(b,{other=null,labelA='',labelB=''}={}){
 if(!b?.available)return b?.reason?`<p class="empty-note">${e(b.reason)}</p>`:'';
 const cat=(c,o)=>`<div class="bag-cat"><div class="bag-head"><h3>${e(c.label)}</h3><b>${c.percentile===null?'—':ord(c.percentile)}</b>${o?`<b class="bag-b">${o.percentile===null?'—':ord(o.percentile)}</b>`:''}</div><span class="gtrack bag-track" aria-hidden="true">${c.percentile===null?'':`<i data-w="${c.percentile}" class="${c.percentile>=75?'hi':c.percentile<=25?'lo':''}"></i>`}</span>${o?`<span class="gtrack bag-track is-b" aria-hidden="true">${o.percentile===null?'':`<i data-w="${o.percentile}"></i>`}</span>`:''}<ul class="bag-parts">${c.components.map((x,i)=>{const y=o?.components?.[i];return `<li><span>${e(x.label)}</span><span>${x.value===null?'—':e(x.value)} <small>${e(x.unit)}</small>${x.rank?` <small>· tour rank ${e(x.rank)}</small>`:''}</span><b>${x.percentile===null?'—':ord(x.percentile)}</b>${o?`<b class="bag-b">${y?.percentile===null||!y?'—':ord(y.percentile)}</b>`:''}</li>`;}).join('')}</ul></div>`;
 const oc=other?.available?other.categories:null;
 return `<div class="bag-dna" role="group" aria-label="Bag DNA percentiles${oc?' comparison':''}">${oc?`<p class="glegend"><span class="gkey gkey-a"></span>${e(labelA)} <span class="gkey gkey-b"></span>${e(labelB)}</p>`:''}<div class="bag-grid">${b.categories.map((c,i)=>cat(c,oc?.[i])).join('')}</div><p class="gnote">${e(b.season)} ${e(b.tour||'')} season statistics from ESPN · population ${e(b.population)} players (${e(b.qualification)}) · as of ${e(b.as_of)}. ${e(b.formula)}</p><p class="bag-disclosure">${e(b.disclosure)}</p></div>`;
}
