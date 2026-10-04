// Golf Newsroom V4 article page and article charts. Pure string rendering (prerender, Worker SSR, browser).
// Values arrive pre-rendered from the frozen packet; this file never computes a number shown as a fact.
import {e,a,kicker,fmtDate,section,toPar} from './ui.js';
import {radar,tracks,formChart} from './charts.js';
import {HIGHLIGHT_FACTS,FINGERPRINT_FACTS} from '../../workers/shared/news/extras.js';
import {videoTile} from './video.js';
import {movementChart} from './movement.js';
import {customerSource,customerSources} from './brand.js';
import {articleMarketSlot} from './article-market.js';
const media=(sha,w,f)=>`/api/v1/media/${sha}/${w}.${f}`;
const segHtml=segs=>(segs||[]).map(s=>s.t==='link'?`<a class="story-link" href="${e(s.href)}" data-entity="${e(s.entity_type)}">${e(s.v)}</a>`:s.t==='fact'?`<span class="story-fact${s.em?' story-em':''}" data-fact="${e(s.fact)}">${e(s.v)}</span>`:e(s.v)).join('');
const when=iso=>{if(!iso)return '';const d=new Date(iso);return d.toLocaleString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',timeZone:'UTC',timeZoneName:'short'});};
const minutes=a=>Math.max(1,Math.ceil(a.sections.flatMap(s=>s.paragraphs).map(p=>p.map(x=>x.display??x.v).join('')).join(' ').split(/\s+/).length/220));
const f1=v=>Number(v).toFixed(1);
// ---------------------------------------------------------------- charts
function leaderboard(c,o={}){
 const n=c.rounds||Math.max(...c.rows.map(r=>r.rounds.length));
 return `<div class="table-wrap" tabindex="0" role="region" aria-labelledby="${e(c.id||'lb')}-cap"><table class="index-table story-board"><caption id="${e(c.id||'lb')}-cap">${e(c.title)}</caption><thead><tr><th scope="col">Pos</th><th scope="col">Player</th><th scope="col" class="num">To par</th>${Array.from({length:n},(_,i)=>`<th scope="col" class="num">R${i+1}</th>`).join('')}</tr></thead><tbody>${c.rows.map(r=>`<tr><td>${e(r.pos)}</td><th scope="row">${r.slug?a('/player/'+r.slug,r.name):e(r.name)}</th><td class="num">${e(toPar(r.to_par))}</td>${Array.from({length:n},(_,i)=>`<td class="num">${e(r.rounds[i]??'—')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function progress(c,o={}){
 const s=c.series.filter(x=>x.points.length>=2);if(!s.length)return '';
 const n=Math.max(...s.map(x=>x.points.length)),all=s.flatMap(x=>x.points),lo=Math.min(0,...all),hi=Math.max(0,...all),W=640,H=240,L=40,R=150,T=16,B=30;
 const x=i=>L+(n===1?0:i/(n-1))*(W-L-R),y=v=>T+(v-lo)/((hi-lo)||1)*(H-T-B);
 const lines=s.map((p,k)=>`<polyline class="gp gp-${k}" points="${p.points.map((v,i)=>`${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')}"/>${p.points.map((v,i)=>`<circle class="gp-pt gp-${k}" cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3.5"/>`).join('')}<text class="gp-label gp-${k}" x="${(x(p.points.length-1)+8).toFixed(1)}" y="${y(p.points.at(-1)).toFixed(1)}" dominant-baseline="middle">${e(p.name.split(' ').slice(-1)[0])} ${e(toPar(p.points.at(-1)))}</text>`).join('');
 const ticks=[...new Set([lo,0,hi])].map(v=>`<text class="gtick" x="${L-6}" y="${y(v).toFixed(1)}" text-anchor="end" dominant-baseline="middle">${e(toPar(v))}</text><line class="ggrid" x1="${L}" x2="${W-R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/>`).join('');
 const rounds=Array.from({length:n},(_,i)=>`<text class="gtick" x="${x(i).toFixed(1)}" y="${H-8}" text-anchor="middle">R${i+1}</text>`).join('');
 return `<figure class="gchart story-progress"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${o.titleId?'Score to par after each round':e(c.title)}: ${e(s.map(p=>`${p.name} ${p.points.map(toPar).join(', ')}`).join('; '))}">${ticks}${rounds}${lines}</svg><figcaption>${o.titleId?'':e(c.title)+'. '}Lower is better; cumulative score to par after each round.</figcaption><ul class="gp-legend" aria-hidden="true">${s.map((p,k)=>`<li><svg class="gp-key" viewBox="0 0 14 6" width="14" height="6"><rect class="gp-${k}" width="14" height="6" rx="2"/></svg>${e(p.name)} <b>${e(toPar(p.points.at(-1)))}</b></li>`).join('')}</ul></figure>`;
}
function scorecard(c){
 const cls=d=>d<=-2?'sc-eagle':d===-1?'sc-birdie':d===1?'sc-bogey':d>=2?'sc-double':'';
 const half=hs=>`<tr><th scope="row">Hole</th>${hs.map(h=>`<td>${h.hole}</td>`).join('')}</tr><tr><th scope="row">Par</th>${hs.map(h=>`<td>${e(h.par)}</td>`).join('')}</tr><tr><th scope="row">Score</th>${hs.map(h=>`<td class="${cls(h.to_par)}">${e(h.strokes)}</td>`).join('')}</tr>`;
 return `<div class="table-wrap" tabindex="0" role="region" aria-labelledby="${e(c.id||'sc')}-cap"><table class="scorecard story-card"><caption id="${e(c.id||'sc')}-cap">${e(c.title)}</caption><tbody>${half(c.holes.slice(0,9))}${half(c.holes.slice(9))}</tbody></table></div><p class="gnote sc-legend"><span class="sc-birdie">Birdie</span> <span class="sc-eagle">Eagle or better</span> <span class="sc-bogey">Bogey</span> <span class="sc-double">Double or worse</span></p>`;
}
export function weatherModule(c,{title=c.title||'Tournament-week forecast'}={}){
 if(!c?.days?.length)return '';
 const P=[['morning','Morning'],['midday','Midday'],['afternoon','Afternoon']];
 const cell=p=>p?`<span class="wx-t">${p.temp??'—'}°</span><span class="wx-w">${p.dir?e(p.dir)+' ':''}${p.wind_max??'—'}<small> mph</small></span><span class="wx-g">${p.gust_max!=null?'G '+p.gust_max:''}</span><span class="wx-r ${p.pop_max>=50||p.precip_mm>=2?'is-wet':''}">${p.pop_max!=null?p.pop_max+'%':p.precip_mm!=null?p.precip_mm+' mm':'—'}</span>`:'<span class="wx-na">—</span>';
 const day=d=>`<article class="wx-day"><h3>${e(new Date(d.day+'T12:00:00Z').toLocaleDateString('en-US',{weekday:'short',timeZone:'UTC'}).toUpperCase())}<small>${e(new Date(d.day+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'}))}</small></h3><dl>${P.map(([k,l])=>`<div class="wx-part"><dt>${l}</dt><dd>${cell(d.parts?.[k])}</dd></div>`).join('')}</dl><p class="wx-sum">High ${d.temp_max??'—'}°${d.gust_max!=null?` · gusts to ${d.gust_max} mph`:` · wind to ${d.wind_max??'—'} mph`} · ${d.pop_max!=null?`rain chance ${d.pop_max}%`:d.precip_mm!=null?`rain ${d.precip_mm} mm`:'rain —'}</p></article>`;
 const prec=c.precision==='locality'?`<span class="wx-prec is-locality">LOCALITY ESTIMATE</span> Forecast point: ${e(c.locality||'nearest town')} (not on-course)`:c.precision==='course_complex'?`<span class="wx-prec">COURSE COMPLEX</span> Forecast point: the resort/club containing the course`:`<span class="wx-prec">COURSE</span> Forecast point: course coordinates`;
 return `<div class="wx" data-weather><div class="wx-head"><h3>${e(title)}</h3><p>${prec}</p></div><div class="wx-legend" aria-hidden="true"><span>Temp</span><span>Wind</span><span>Gust</span><span>Rain</span></div><div class="wx-grid">${c.days.map(day).join('')}</div><p class="gnote">${e(c.source||'NOAA National Weather Service')} forecast${c.licence_url?` (<a href="${e(c.licence_url)}" rel="license noopener">licence</a>)`:''}, updated ${e(when(c.issued))}. Forecast, not observed conditions. Periods: 7–11am, 11am–3pm, 3–7pm local${c.tz_basis&&c.tz_basis!=='NWS forecast office'?` (${e(c.tz_basis)})`:''}.${c.has_gust===false?' Gusts are not in this provider’s forecast for this location.':''}</p></div>`;
}
function pastWinners(c){return `<div class="table-wrap" tabindex="0" role="region" aria-labelledby="${e(c.id||'pw')}-cap"><table class="index-table"><caption id="${e(c.id||'pw')}-cap">${e(c.title)}</caption><thead><tr><th scope="col">Year</th><th scope="col">Champion</th><th scope="col" class="num">To par</th></tr></thead><tbody>${c.rows.map(r=>`<tr><td>${r.edition?a('/tournament/'+r.edition,String(r.year)):e(r.year)}</td><th scope="row">${r.slug?a('/player/'+r.slug,r.name):e(r.name)}</th><td class="num">${e(r.to_par===null||r.to_par===undefined?'—':toPar(r.to_par))}</td></tr>`).join('')}</tbody></table></div>`;}
function fieldForm(c,o={}){const max=Math.max(.5,...c.rows.map(r=>Math.abs(r.form||0)));return `<div class="story-fform"><div class="gtracks story-form" role="list" ${o.titleId?`aria-labelledby="${o.titleId}"`:`aria-label="${e(c.title)}"`}>${c.rows.map(r=>`<div class="gtrack-row" role="listitem"><span class="gtrack-name">${a('/player/'+r.slug,r.name)}<small>${e(r.rounds)} rounds</small></span><span class="gtrack" aria-hidden="true"><i data-w="${Math.round(Math.abs(r.form)/max*100)}" class="${r.form>0?'hi':'lo'}"></i></span><b class="gtrack-v">${r.form>0?'+':''}${f1(r.form)}</b></div>`).join('')}</div><p class="gnote">Strokes per round versus the field over recent full-field events in our record. Higher is better.</p></div>`;}
function courseDna(c,o={}){return `<div class="story-cdna"><div class="gtracks" role="list" ${o.titleId?`aria-labelledby="${o.titleId}"`:`aria-label="${e(c.title)}"`}>${c.dimensions.map(d=>`<div class="gtrack-row" role="listitem"><span class="gtrack-name">${e(d.label)}<small>${e(d.unit||'')}</small></span><span class="gtrack" aria-hidden="true">${d.percentile===null||d.percentile===undefined?'':`<i data-w="${d.percentile}"></i>`}</span><b class="gtrack-v">${e(typeof d.value==='number'?(Math.round(d.value*100)/100):d.value)}</b></div>`).join('')}</div><p class="gnote">${a('/course/'+c.course.slug,'Full Course DNA')} · percentile among measured courses where shown.</p></div>`;}
// ---------------------------------------------------------------- Article Experience V2 modules
// Course-scoring strip: centreline = par; bars up = played over par, down = under par. Values are the chart's own.
function holes(c,o={}){
 const max=Math.max(.3,...c.holes.map(h=>Math.abs(h.avg_to_par)));const hard=new Set(c.holes.slice().sort((a,b)=>b.avg_to_par-a.avg_to_par||a.hole-b.hole).slice(0,3).map(h=>h.hole));
 const sg=v=>(v>0?'+':v<0?'−':'')+Math.abs(v).toFixed(2);
 const col=h=>{const w=Math.max(3,Math.round(Math.abs(h.avg_to_par)/max*100)),over=h.avg_to_par>0,lab=`Hole ${h.hole}, par ${h.par}${h.yards?`, ${h.yards} yards`:''}: ${sg(h.avg_to_par)} against par${hard.has(h.hole)?', among the three hardest':''}`;
  return `<li class="sh2-col${over?' is-over':h.avg_to_par<0?' is-under':''}${hard.has(h.hole)?' is-hard':''}" tabindex="0" aria-label="${e(lab)}" title="${e(lab)}"><span class="sh2-v" aria-hidden="true">${sg(h.avg_to_par)}</span><span class="sh2-plot" aria-hidden="true"><span class="sh2-up">${over?`<i data-w="${w}"></i>`:''}</span><span class="sh2-dn">${over?'':`<i data-w="${w}"></i>`}</span></span><b class="sh2-n" aria-hidden="true">${h.hole}</b><small aria-hidden="true">P${e(h.par)}${h.yards?` · ${e(h.yards)}`:''}</small></li>`;};
 const nine=(hs,t)=>`<div class="sh2-nine"><p class="sh2-k">${t}</p><ol class="sh2-row">${hs.map(col).join('')}</ol></div>`;
 return `<div class="sh2" role="group" ${o.titleId?`aria-labelledby="${o.titleId}"`:`aria-label="${e(c.title)}"`}><div class="sh2-legend" aria-hidden="true"><span class="sh2-key is-over">Above the line: harder than par</span><span class="sh2-key is-under">Below: easier than par</span><span class="sh2-key is-hard">Ringed: three hardest</span></div><div class="sh2-nines">${nine(c.holes.filter(h=>h.hole<=9),'FRONT NINE')}${nine(c.holes.filter(h=>h.hole>9),'BACK NINE')}</div><details class="sh2-table"><summary>Hole-by-hole values</summary><div class="table-wrap" tabindex="0" role="region" aria-label="Hole values"><table class="index-table"><thead><tr><th scope="col">Hole</th><th scope="col" class="num">Par</th><th scope="col" class="num">Yards</th><th scope="col" class="num">Field avg to par</th></tr></thead><tbody>${c.holes.map(h=>`<tr><td>${h.hole}</td><td class="num">${e(h.par)}</td><td class="num">${e(h.yards??'—')}</td><td class="num">${sg(h.avg_to_par)}</td></tr>`).join('')}</tbody></table></div></details><p class="gnote">Field average to par per hole across ${e(c.cards)} complete hole-by-hole cards.</p></div>`;
}
// Compact Player DNA: only the published dimensions in the packet chart, strongest first. No composite.
const DNA_LABEL={scoring:'Scoring vs field',consistency:'Consistency',under_par:'Under-par rounds',cuts:'Cuts made',top10:'Top-10 rate',contention:'Contention (top 5)',form:'Recent form',majors:'Majors',par3:'Par-3 scoring',par4:'Par-4 scoring',par5:'Par-5 scoring'};
const ordS=n=>{const s=['th','st','nd','rd'],v=n%100;return n+(s[(v-20)%10]||s[v]||s[0]);};
function dnaCompact(c,o={}){
 const dims=(c.dims||[]).filter(d=>Number.isFinite(d.percentile)).sort((a,b)=>b.percentile-a.percentile||String(a.code).localeCompare(b.code));if(!dims.length)return '';
 return `<div class="sdna"><div class="sdna-list" role="list" ${o.titleId?`aria-labelledby="${o.titleId}"`:`aria-label="${e(c.title)}"`}>${dims.map(d=>`<div class="sdna-row" role="listitem"><span class="sdna-l">${e(DNA_LABEL[d.code]||d.code)}</span><span class="sdna-bar" aria-hidden="true"><i data-w="${Math.round(d.percentile)}"></i></span><b class="sdna-v">${e(d.percentile)}</b><small class="sdna-n">${e(ordS(d.percentile))} pct${Number.isFinite(d.sample)?` · n=${e(d.sample)}`:''}${d.confidence?` · ${e(String(d.confidence).toLowerCase())}`:''}</small></div>`).join('')}</div><p class="gnote">${e(c.window||'')} · percentiles within the player’s tour cohort; individual dimensions, no composite score. <a class="text-link" href="/player/${e(c.player.slug)}#dna">Explore full Player DNA <span aria-hidden="true">→</span></a></p></div>`;
}
// Recent starts: the exact published results (finish + event), newest first. No trajectory claim.
function formStrip(c,o={}){
 const pos=f=>f.status==='finished'&&Number.isInteger(f.position)?(f.tied?'T'+f.position:String(f.position)):({cut:'MC',withdrawn:'WD',disqualified:'DQ'}[f.status]||'—');
 const rows=(c.series||[]).slice(-6).reverse();if(!rows.length)return '';
 return `<div class="sform"><ol class="sform-list" ${o.titleId?`aria-labelledby="${o.titleId}"`:`aria-label="${e(c.title)}"`}>${rows.map(f=>`<li><b class="sform-pos${pos(f)==='1'?' is-win':''}">${e(pos(f))}</b><span>${e(String(f.name||'').replace(/^\d{4}\s+/,''))}</span>${f.ends_on?`<small>${e(new Date(f.ends_on+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',year:'numeric',timeZone:'UTC'}))}</small>`:''}</li>`).join('')}</ol><p class="gnote">Published finishes in our record. <a class="text-link" href="/player/${e(c.player.slug)}">Results and history</a></p></div>`;
}
// Recent winners rail: year, linked champion, winning score, linked edition.
function winnersRail(c){return `<ol class="swin" aria-label="${e(c.title)}">${c.rows.map(r=>`<li><span class="swin-y">${r.edition?a('/tournament/'+r.edition,String(r.year),'swin-ed'):e(r.year)}</span><span class="swin-n">${r.slug?a('/player/'+r.slug,r.name,'swin-p'):e(r.name)}</span><b class="swin-s">${e(r.to_par===null||r.to_par===undefined?'—':toPar(r.to_par))}</b></li>`).join('')}</ol>`;}
// Highlights ("at a glance"): packet facts only (display + label).
const GLANCE={preview:'The week at a glance',final:'The result in 30 seconds',course_intelligence:'The course at a glance'};
function highlightsBlock(art){const hs=art.highlights||[];if(hs.length<3)return '';
 return `<section class="story-glance" aria-labelledby="glance-h"><h2 class="story-glance-h" id="glance-h">${e(GLANCE[art.type]||'The story in 30 seconds')}</h2><dl class="story-glance-grid">${hs.map(h=>`<div><dd>${e(h.display)}</dd><dt>${e(h.label)}</dt></div>`).join('')}</dl></section>`;}
function fingerprintBlock(fp,chart){if(!fp?.items?.length)return '';
 const sg=v=>(v>0?'+':v<0?'−':'')+Math.abs(v).toFixed(2);const hard=chart?.holes?chart.holes.slice().sort((a,b)=>b.avg_to_par-a.avg_to_par||a.hole-b.hole).slice(0,3):[];
 return `<section class="story-fp" aria-labelledby="fp-h"><p class="story-fp-k">${e((fp.course||'Course').toUpperCase())} · COURSE FINGERPRINT</p><h3 class="sr-only" id="fp-h">${e(fp.course||'Course')} course fingerprint</h3><dl class="story-fp-grid">${fp.items.filter(i=>!['cd_hardest','cd_easiest'].includes(i.fact)).map(i=>`<div><dt>${e(i.label)}</dt><dd>${e(i.display)}</dd></div>`).join('')}</dl>${hard.length?`<div class="story-fp-hard"><p class="micro-label">HARDEST HOLES</p><ol>${hard.map(h=>`<li><b>No. ${h.hole}</b> par ${e(h.par)}${h.yards?` · ${e(h.yards)} yd`:''} <span>${sg(h.avg_to_par)}</span></li>`).join('')}</ol></div>`:''}</section>`;}
function calloutBlock(cl){return `<aside class="story-callout" aria-label="${e(cl.title)}"><p class="story-callout-k">${e(cl.title.toUpperCase())}</p><dl>${cl.items.map(i=>`<div><dd>${e(i.display)}</dd><dt>${e(i.label)}</dt></div>`).join('')}</dl></aside>`;}

export function articleChart(c,o={}){
 switch(c.type){
  case 'leaderboard':return leaderboard(c,o);
  case 'progress':return progress(c,o);
  case 'holes':return holes(c,o);
  case 'scorecard':return scorecard(c);
  case 'weather':return weatherModule(c);
  case 'past_winners':return winnersRail(c);
  case 'field_form':return fieldForm(c,o);
  case 'course_dna':return courseDna(c,o);
  case 'movement':return movementChart(c.points,{title:c.title,titled:Boolean(o.titleId)});
  case 'dna':return dnaCompact(c,o);
  case 'form':return formStrip(c,o);
  default:return '';
 }
}
// Module groups in reading order; anything not grouped falls to the end of the body.
const GROUPS=[['LEADERBOARD','The board',['leaderboard','movement','round_progress','scorecard']],['PLAYER DNA','The player',['winner_dna','player_dna','winner_form','player_form']],['COURSE','The course',['hole_difficulty','course_dna']],['WEATHER','Conditions',['weather']],['FIELD','Field intelligence',['field_form','past_winners']]];
// ---------------------------------------------------------------- page
export function heroHtml(h,a_){
 if(h?.photo?.sha256){const p=h.photo,ratio=p.height&&p.width?p.height/p.width:.66;
  return `<figure class="story-hero${ratio>1.1?' is-portrait':''}"><picture><source type="image/avif" srcset="${[640,960].map(w=>media(p.sha256,w,'avif')+' '+w+'w').join(', ')}" sizes="(max-width:900px) 100vw, 900px"><img src="${media(p.sha256,960,'webp')}" srcset="${[640,960].map(w=>media(p.sha256,w,'webp')+' '+w+'w').join(', ')}" sizes="(max-width:900px) 100vw, 900px" width="960" height="${Math.round(960*ratio)}" alt="${e(h.name||'')}" fetchpriority="high"></picture><figcaption>${e(h.name||'')}${p.author?` · Photo: ${e(p.author)}`:''}${p.licence?` · ${p.licence_url?`<a href="${e(p.licence_url)}" rel="license noopener">${e(p.licence)}</a>`:e(p.licence)}`:''}${p.source_url?` · <a href="${e(p.source_url)}" rel="noopener">source</a>`:''}</figcaption></figure>`;}
 return `<div class="story-hero is-art" role="img" aria-label="${e(a_.category)} artwork"><span class="story-art-kicker">${e(a_.category)}</span><span class="story-art-title">${e(a_.context?.tour||'GOLF')}</span></div>`;
}
// ---------------------------------------------------------------- page (Article Experience V2)
// Renders golf-article/5 documents and, compatibly, golf-article/4 (highlights/fingerprint derived from the ledger,
// which only holds packet facts). Every value shown comes from the document; nothing here computes a fact.
const sid=t=>'s-'+String(t).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40);
const fromLedger=(art,ids,min)=>{const by=new Map((art.evidence||[]).map(f=>[f.fact,f]));const xs=ids.map(id=>by.get(id)).filter(Boolean).map(f=>({fact:f.fact,label:f.label,display:f.display}));return xs.length>=min?xs:[];};
// Pairs: a module that brings its companion (same subject) directly after it.
const PAIR={player_dna:'player_form',winner_dna:'winner_form'};
// Where official video sits by class (after the first section that introduces this module, else at the end).
const VIDEO_AFTER={preview:['hole_difficulty','weather'],course_intelligence:['hole_difficulty','course_dna'],final:['leaderboard','progress','round_progress'],round_recap:['leaderboard','movement'],notable_round:['scorecard']};
const COURSE_MAP_TYPES=new Set(['preview','course_intelligence','course_weather','major_history']);
export function articlePage(art,{related=[],video=null,market=null}={}){
 const updated=art.updated_at&&art.published_at&&Date.parse(art.updated_at)-Date.parse(art.published_at)>=5*60000;
 const byEditor=art.editor?.mode==='openai'?'Written with AI assistance from a frozen fact packet; every number is checked against it.':'Written by the Golf Desk from a frozen fact packet.';
 const charts=new Map(art.charts.map(c=>[c.id,c]));const placed=new Set();
 const quick=new Set((art.quick_facts||[]).map(q=>q.fact));
 const highlights=art.highlights||fromLedger(art,(HIGHLIGHT_FACTS[art.type]||[]).filter(id=>!quick.has(id)),3).slice(0,5);
 const fingerprint=art.fingerprint!==undefined?art.fingerprint:(COURSE_MAP_TYPES.has(art.type)&&charts.has('hole_difficulty')?(xs=>xs.length?{course:art.related?.course?.name||null,items:xs,chart:'hole_difficulty'}:null)(fromLedger(art,FINGERPRINT_FACTS,3)):null);
 const callouts=art.callouts||[];
 const WIDE=new Set(['holes','weather','movement','leaderboard','progress']);
 const chartFig=c=>{placed.add(c.id);const headed=!['weather','leaderboard','scorecard','past_winners'].includes(c.type)&&c.title,tid=headed?`mt-${c.id}`:null;
  const inner=c.type==='holes'&&fingerprint?.chart===c.id?fingerprintBlock(fingerprint,c)+articleChart(c,{titleId:tid}):articleChart(c,{titleId:tid});
  const mod=`<div class="story-module" data-chart="${e(c.id)}" data-kind="${e(c.type)}"${WIDE.has(c.type)?' data-wide':''}>${headed?`<h3 class="story-module-title" id="${tid}">${e(c.title)}</h3>`:''}${inner}</div>`;
  const pair=PAIR[c.id]&&charts.get(PAIR[c.id])&&!placed.has(PAIR[c.id])?chartFig(charts.get(PAIR[c.id])):'';
  return mod+pair;};
 const lead=['leaderboard','scorecard','round_progress','weather','past_winners','course_dna','player_form'].map(id=>charts.get(id)).find(Boolean);
 const placedByProse=art.sections.some(s=>s.module);let pbecastPlaced=false,videoPlaced=false,cmapPlaced=false;
 const vid=video||art.video;
 const videoBlock=()=>{videoPlaced=true;return `<section class="story-video" aria-labelledby="sv-h"><p class="micro-label">OFFICIAL VIDEO</p><h2 id="sv-h">${e(vid.label||'Watch')}</h2>${videoCard(vid)}</section>`;};
 const courseSlug=(art.related?.course?.href||'').replace(/^\/course\//,'');
 const cmapBlock=()=>{cmapPlaced=true;return COURSE_MAP_TYPES.has(art.type)&&/^[a-z0-9-]+$/.test(courseSlug)?`<section class="story-cmap" data-article-course-map data-course="${e(courseSlug)}" aria-label="Course view" hidden></section>`:'';};
 const pbecastBlock=()=>{pbecastPlaced=true;return `<div class="story-module" data-chart="pbecast" data-kind="pbecast"><p><a class="button button-gold" href="${e(art.pbecast.href)}">Open the PBEcast replay</a></p><p class="gnote">Hole-by-hole replay built from published scorecards. Shot locations are reconstructed, not tracked.</p></div>`;};
 const afterModule=id=>{let x='';if((id==='hole_difficulty'||id==='course_dna')&&!cmapPlaced)x+=cmapBlock();if(vid&&!videoPlaced&&(VIDEO_AFTER[art.type]||[]).includes(id))x+=videoBlock();return x;};
 const moduleAfter=s=>{if(s.module==='pbecast')return art.pbecast?pbecastBlock():'';if(s.module&&charts.get(s.module)&&!placed.has(s.module))return chartFig(charts.get(s.module))+afterModule(s.module);return '';};
 const headed=art.sections.filter(s=>s.heading);let calloutDone=false;
 const body=art.sections.map((s,i)=>{const isCourse=/^(the course|what the week demands|how it plays)/i.test(s.heading||'');
  const call=!calloutDone&&callouts.length&&isCourse?(calloutDone=true,callouts.map(calloutBlock).join('')):'';
  return `<section class="story-section${s.heading?'':' story-lede'}"${s.heading?` id="${sid(s.heading)}"`:''}>${s.heading?`<h2>${e(s.heading)}</h2>`:''}${s.paragraphs.map(p=>`<p>${segHtml(p)}</p>`).join('')}${call}</section>${moduleAfter(s)}${!placedByProse&&i===0&&lead?chartFig(lead):''}${i===0?articleMarketSlot(art,market):''}`;}).join('');
 const groups=GROUPS.map(([k,t,ids])=>{const cs=ids.map(id=>charts.get(id)).filter(c=>c&&!placed.has(c.id));return cs.length?section(k,t,cs.map(chartFig).join(''),{cls:'story-group'}):'';}).join('');
 const rest=[...charts.values()].filter(c=>!placed.has(c.id)).map(chartFig).join('');
 const seenHref=new Set(),ent=t=>art.entities.filter(x=>x.type===t&&x.href&&!seenHref.has(x.href)&&seenHref.add(x.href));
 const relCards=[...ent('player').slice(0,4).map(x=>['PLAYER',x]),...ent('course').slice(0,1).map(x=>['COURSE',x]),...ent('tournament').slice(0,1).map(x=>['TOURNAMENT',x]),...ent('majors').slice(0,1).map(x=>['MAJORS',x]),...ent('matchup').slice(0,2).map(x=>['MATCHUP',x])];
 // In-article navigation only for rich stories (4+ headed sections).
 const nav=headed.length>=4?`<nav class="story-nav" aria-label="In this article"><ol>${headed.map(s=>`<li><a href="#${sid(s.heading)}">${e(s.heading)}</a></li>`).join('')}<li><a href="#evidence">Evidence</a></li></ol></nav>`:'';
 const srcCount=new Set((art.evidence||[]).map(f=>customerSource(f.source)).filter(Boolean)).size;
 const photoCredit=art.hero?.photo?`${art.hero.photo.author||''}${art.hero.photo.licence?' / '+art.hero.photo.licence:''}`:null;
 const built=`<section class="story-built" aria-labelledby="built-h"><h2 id="built-h">How this story was built</h2><dl><div><dt>Data</dt><dd>${e(customerSources((art.sources||[]).filter(s=>!/^Photo:/.test(s))).join(' · '))}</dd></div>${photoCredit?`<div><dt>Image</dt><dd>${e(photoCredit)}</dd></div>`:''}${(art.known_limits||[]).map(l=>`<div><dt>Limit</dt><dd>${e(customerSource(l))}</dd></div>`).join('')}${art.method?`<div><dt>Method</dt><dd>${e(art.method)}</dd></div>`:''}<div><dt>Editor</dt><dd>${e(byEditor)}</dd></div><div><dt>Packet</dt><dd><code>${e(String(art.packet_sha256||'').slice(0,12))}</code></dd></div></dl></section>`;
 const evidence=`<section class="story-evidence" id="evidence" aria-labelledby="evidence-h"><details><summary><span class="micro-label">EVIDENCE & METHODOLOGY</span><h2 id="evidence-h">Evidence ledger</h2><span class="story-ev-h">${e(art.evidence.length)} verified facts · ${e(srcCount)} sources and derivations · packet ${e(String(art.packet_sha256||'').slice(0,12))}</span><span class="story-ev-cta">View the full evidence ledger</span></summary><div class="table-wrap story-ledger-wrap" tabindex="0" role="region" aria-label="Evidence ledger"><table class="index-table story-ledger"><thead><tr><th scope="col">Fact</th><th scope="col">Value</th><th scope="col">Source</th></tr></thead><tbody>${art.evidence.map(f=>`<tr><td>${e(f.label)}</td><td>${e(f.display)}</td><td>${e(customerSource(f.source)||'')}</td></tr>`).join('')}</tbody></table></div></details></section>`;
 const qf=art.quick_facts?.length?`<aside class="story-quick" aria-label="Quick data"><dl>${art.quick_facts.map(q=>`<div><dt>${e(q.label)}</dt><dd>${e(q.display)}</dd></div>`).join('')}</dl></aside>`:'';
 const railRel=relCards.length?`<div class="story-rail-block"><p class="micro-label">IN THIS STORY</p><div class="story-related">${relCards.map(([k,x])=>`<a class="story-rel" href="${e(x.href)}"><span class="micro-label">${k}</span><b>${e(x.name)}</b></a>`).join('')}</div></div>`:'';
 const railPb=art.pbecast&&!art.sections.some(s=>s.module==='pbecast')?`<div class="story-rail-block"><p class="micro-label">PBECAST</p><p><a class="text-link" href="${e(art.pbecast.href)}">Follow the tournament in PBEcast</a></p></div>`:'';
 return `<article class="story-page story-v2" data-article="${e(art.slug)}" data-article-type="${e(art.type)}">
<header class="story-top"><div class="story-head">${kicker(art.category+(art.context?.tour?' · '+art.context.tour:'')+(art.context?.is_major?' · MAJOR':''))}<h1>${segHtml(art.headline.map(s=>s.t==='link'?{t:'text',v:s.v}:s))}</h1><p class="story-dek">${segHtml(art.dek)}</p>
<p class="story-byline"><span class="story-desk">PropBetEdge Golf Desk</span> · <time datetime="${e(art.published_at)}">Published ${e(when(art.published_at))}</time>${updated?` · <time datetime="${e(art.updated_at)}">Updated ${e(when(art.updated_at))}</time>`:''} · ${minutes(art)} min read</p></div>
${heroHtml(art.hero,art)}</header>
<div class="story-intro">${qf}${highlightsBlock({...art,highlights})}${nav}</div>
<div class="story-layout"><div class="story-main"><div class="story-body">${body}</div>${cmapPlaced?'':cmapBlock()}
${groups}${rest}
${vid&&!videoPlaced?videoBlock():''}
${art.pbecast&&!pbecastPlaced&&!railPb?section('PBECAST','Replay it',`<p><a class="button button-gold" href="${e(art.pbecast.href)}">Open the PBEcast replay</a></p><p class="gnote">Hole-by-hole replay built from published scorecards. Shot locations are reconstructed, not tracked.</p>`):''}
</div><aside class="story-rail" aria-label="Story context">${railRel}${railPb}</aside></div>
<div class="story-trust">${art.corrections?.length?section('CORRECTIONS','Corrections',`<ul class="story-corrections">${art.corrections.map(c=>`<li><time datetime="${e(c.at)}">${e(when(c.at))}</time>: ${c.facts.map(f=>`${e(f.label)} changed from ${e(f.was)} to ${e(f.now??'removed')}`).join('; ')}.</li>`).join('')}</ul>`):''}${built}${evidence}</div>
${related.length?section('MORE FROM THE DESK','Related coverage',`<div class="story-list-grid">${related.map(storyCard).join('')}</div>`):''}
</article>`;
}
export function videoCard(v){return videoTile(v);}
function _videoCardLegacy(v){
 const poster=`https://i.ytimg.com/vi/${encodeURIComponent(v.video_id)}/hqdefault.jpg`;
 return `<div class="yt" data-yt="${e(v.video_id)}" data-yt-title="${e(v.title)}"><button class="yt-poster" type="button" aria-label="Play video: ${e(v.title)}"><img src="${e(poster)}" alt="" loading="lazy" width="480" height="360"><span class="yt-play" aria-hidden="true">▶</span></button><p class="yt-meta"><b>${e(v.title)}</b><span>${e(v.channel||'')}${v.published_at?' · '+e(fmtDate(v.published_at.slice(0,10))):''}</span><a href="https://www.youtube.com/watch?v=${encodeURIComponent(v.video_id)}" rel="noopener" data-yt-out>Watch on YouTube</a></p></div>`;
}
export function storyCard(s){
 const img=s.hero?.sha256?`<img src="${media(s.hero.sha256,320,'webp')}" alt="" loading="lazy" width="320" height="${Math.round(320*Math.min(1.25,(s.hero.height||200)/(s.hero.width||320)))}">`:`<span class="story-card-art" aria-hidden="true">${e(s.category)}</span>`;
 return `<a class="story-card" href="/news/${e(s.slug)}"><span class="story-card-media">${img}</span><span class="story-card-text"><span class="micro-label">${e(s.category)} · ${e(fmtDate(String(s.published_at).slice(0,10)))}</span><b>${e(s.headline)}</b><span>${e(s.dek)}</span></span></a>`;
}
export function newsIndex(stories,{legacy=[]}={}){
 const [top,...rest]=stories;
 return `<section class="page-heading data-heading"><div>${kicker('GOLF DESK')}<h1>Golf news, built on evidence.</h1><p>Every number in every story traces to a frozen fact. No filler, no quotas.</p></div></section><div class="page-body data-body">${top?`<div class="story-lead">${storyCard(top)}</div>`:'<p class="empty-note">No story has passed every publication gate yet.</p>'}${rest.length?`<div class="story-list-grid">${rest.map(storyCard).join('')}</div>`:''}${legacy.length?section('ARCHIVE','Earlier results',`<ul class="source-list">${legacy.map(s=>`<li>${a(s.edition,s.headline)}</li>`).join('')}</ul>`):''}</div>`;
}
// Related stories: same edition first, then shared entities, newest first.
export function relatedStories(index,art,n=4){
 const keys=new Set(art.entities.map(x=>x.href));
 return index.filter(s=>s.slug!==art.slug).map(s=>({s,score:(s.edition&&s.edition===art.context?.edition?10:0)+s.entities.filter(k=>keys.has(k.split(':').slice(2).join(':'))).length})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||String(b.s.published_at).localeCompare(String(a.s.published_at))).slice(0,n).map(x=>x.s);
}
