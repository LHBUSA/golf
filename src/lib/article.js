// Golf Newsroom V4 article page and article charts. Pure string rendering (prerender, Worker SSR, browser).
// Values arrive pre-rendered from the frozen packet; this file never computes a number shown as a fact.
import {e,a,kicker,fmtDate,section,toPar} from './ui.js';
import {radar,tracks,formChart} from './charts.js';
import {videoTile} from './video.js';
const media=(sha,w,f)=>`/api/v1/media/${sha}/${w}.${f}`;
const segHtml=segs=>(segs||[]).map(s=>s.t==='link'?`<a class="story-link" href="${e(s.href)}" data-entity="${e(s.entity_type)}">${e(s.v)}</a>`:s.t==='fact'?`<span class="story-fact" data-fact="${e(s.fact)}">${e(s.v)}</span>`:e(s.v)).join('');
const when=iso=>{if(!iso)return '';const d=new Date(iso);return d.toLocaleString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',timeZone:'UTC',timeZoneName:'short'});};
const minutes=a=>Math.max(1,Math.round(a.sections.flatMap(s=>s.paragraphs).map(p=>p.map(x=>x.v).join('')).join(' ').split(/\s+/).length/220));
const f1=v=>Number(v).toFixed(1);
// ---------------------------------------------------------------- charts
function leaderboard(c){
 const n=c.rounds||Math.max(...c.rows.map(r=>r.rounds.length));
 return `<div class="table-wrap" tabindex="0" role="region" aria-label="${e(c.title)}"><table class="index-table story-board"><caption>${e(c.title)}</caption><thead><tr><th scope="col">Pos</th><th scope="col">Player</th><th scope="col" class="num">To par</th>${Array.from({length:n},(_,i)=>`<th scope="col" class="num">R${i+1}</th>`).join('')}</tr></thead><tbody>${c.rows.map(r=>`<tr><td>${e(r.pos)}</td><th scope="row">${r.slug?a('/player/'+r.slug,r.name):e(r.name)}</th><td class="num">${e(toPar(r.to_par))}</td>${Array.from({length:n},(_,i)=>`<td class="num">${e(r.rounds[i]??'—')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function progress(c){
 const s=c.series.filter(x=>x.points.length>=2);if(!s.length)return '';
 const n=Math.max(...s.map(x=>x.points.length)),all=s.flatMap(x=>x.points),lo=Math.min(0,...all),hi=Math.max(0,...all),W=640,H=240,L=40,R=150,T=16,B=30;
 const x=i=>L+(n===1?0:i/(n-1))*(W-L-R),y=v=>T+(v-lo)/((hi-lo)||1)*(H-T-B);
 const lines=s.map((p,k)=>`<polyline class="gp gp-${k}" points="${p.points.map((v,i)=>`${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')}"/>${p.points.map((v,i)=>`<circle class="gp-pt gp-${k}" cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3.5"/>`).join('')}<text class="gp-label gp-${k}" x="${(x(p.points.length-1)+8).toFixed(1)}" y="${y(p.points.at(-1)).toFixed(1)}" dominant-baseline="middle">${e(p.name.split(' ').slice(-1)[0])} ${e(toPar(p.points.at(-1)))}</text>`).join('');
 const ticks=[...new Set([lo,0,hi])].map(v=>`<text class="gtick" x="${L-6}" y="${y(v).toFixed(1)}" text-anchor="end" dominant-baseline="middle">${e(toPar(v))}</text><line class="ggrid" x1="${L}" x2="${W-R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/>`).join('');
 const rounds=Array.from({length:n},(_,i)=>`<text class="gtick" x="${x(i).toFixed(1)}" y="${H-8}" text-anchor="middle">R${i+1}</text>`).join('');
 return `<figure class="gchart story-progress"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${e(c.title)}: ${e(s.map(p=>`${p.name} ${p.points.map(toPar).join(', ')}`).join('; '))}">${ticks}${rounds}${lines}</svg><figcaption>${e(c.title)}. Lower is better; cumulative score to par after each round.</figcaption></figure>`;
}
function holes(c){
 const max=Math.max(.3,...c.holes.map(h=>Math.abs(h.avg_to_par)));
 return `<div class="story-holes" role="table" aria-label="${e(c.title)}"><div class="story-holes-grid">${c.holes.map(h=>{const w=Math.round(Math.abs(h.avg_to_par)/max*100);return `<div class="sh-col" role="row"><span class="sh-bar ${h.avg_to_par>0?'is-over':'is-under'}" aria-hidden="true"><i data-w="${w}"></i></span><b role="cell">${h.avg_to_par>0?'+':''}${h.avg_to_par.toFixed(2)}</b><span role="rowheader">${h.hole}</span><small>Par ${e(h.par)}</small></div>`;}).join('')}</div><p class="gnote">Field average to par per hole across ${e(c.cards)} complete hole-by-hole cards. Above the line played over par.</p></div>`;
}
function scorecard(c){
 const cls=d=>d<=-2?'sc-eagle':d===-1?'sc-birdie':d===1?'sc-bogey':d>=2?'sc-double':'';
 const half=hs=>`<tr><th scope="row">Hole</th>${hs.map(h=>`<td>${h.hole}</td>`).join('')}</tr><tr><th scope="row">Par</th>${hs.map(h=>`<td>${e(h.par)}</td>`).join('')}</tr><tr><th scope="row">Score</th>${hs.map(h=>`<td class="${cls(h.to_par)}">${e(h.strokes)}</td>`).join('')}</tr>`;
 return `<div class="table-wrap" tabindex="0" role="region" aria-label="${e(c.title)}"><table class="scorecard story-card"><caption>${e(c.title)}</caption><tbody>${half(c.holes.slice(0,9))}${half(c.holes.slice(9))}</tbody></table></div><p class="gnote sc-legend"><span class="sc-birdie">Birdie</span> <span class="sc-eagle">Eagle or better</span> <span class="sc-bogey">Bogey</span> <span class="sc-double">Double or worse</span></p>`;
}
export function weatherModule(c,{title=c.title||'Tournament-week forecast'}={}){
 if(!c?.days?.length)return '';
 const P=[['morning','Morning'],['midday','Midday'],['afternoon','Afternoon']];
 const cell=p=>p?`<span class="wx-t">${p.temp??'—'}°</span><span class="wx-w">${p.dir?e(p.dir)+' ':''}${p.wind_max??'—'}<small> mph</small></span><span class="wx-g">${p.gust_max!=null?'G '+p.gust_max:''}</span><span class="wx-r ${p.pop_max>=50||p.precip_mm>=2?'is-wet':''}">${p.pop_max!=null?p.pop_max+'%':p.precip_mm!=null?p.precip_mm+' mm':'—'}</span>`:'<span class="wx-na">—</span>';
 const day=d=>`<article class="wx-day"><h3>${e(new Date(d.day+'T12:00:00Z').toLocaleDateString('en-US',{weekday:'short',timeZone:'UTC'}).toUpperCase())}<small>${e(new Date(d.day+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'}))}</small></h3><dl>${P.map(([k,l])=>`<div class="wx-part"><dt>${l}</dt><dd>${cell(d.parts?.[k])}</dd></div>`).join('')}</dl><p class="wx-sum">High ${d.temp_max??'—'}°${d.gust_max!=null?` · gusts to ${d.gust_max} mph`:` · wind to ${d.wind_max??'—'} mph`} · ${d.pop_max!=null?`rain chance ${d.pop_max}%`:d.precip_mm!=null?`rain ${d.precip_mm} mm`:'rain —'}</p></article>`;
 const prec=c.precision==='locality'?`<span class="wx-prec is-locality">LOCALITY ESTIMATE</span> Forecast point: ${e(c.locality||'nearest town')} (not on-course)`:`<span class="wx-prec">COURSE</span> Forecast point: course coordinates`;
 return `<div class="wx" data-weather><div class="wx-head"><h3>${e(title)}</h3><p>${prec}</p></div><div class="wx-legend" aria-hidden="true"><span>Temp</span><span>Wind</span><span>Gust</span><span>Rain</span></div><div class="wx-grid">${c.days.map(day).join('')}</div><p class="gnote">${e(c.source||'NOAA National Weather Service')} forecast${c.licence_url?` (<a href="${e(c.licence_url)}" rel="license noopener">licence</a>)`:''}, updated ${e(when(c.issued))}. Forecast, not observed conditions. Periods: 7–11am, 11am–3pm, 3–7pm local${c.tz_basis&&c.tz_basis!=='NWS forecast office'?` (${e(c.tz_basis)})`:''}.${c.has_gust===false?' Gusts are not in this provider’s forecast for this location.':''}</p></div>`;
}
function pastWinners(c){return `<div class="table-wrap" tabindex="0" role="region" aria-label="${e(c.title)}"><table class="index-table"><caption>${e(c.title)}</caption><thead><tr><th scope="col">Year</th><th scope="col">Champion</th><th scope="col" class="num">To par</th></tr></thead><tbody>${c.rows.map(r=>`<tr><td>${r.edition?a('/tournament/'+r.edition,String(r.year)):e(r.year)}</td><th scope="row">${r.slug?a('/player/'+r.slug,r.name):e(r.name)}</th><td class="num">${e(r.to_par===null||r.to_par===undefined?'—':toPar(r.to_par))}</td></tr>`).join('')}</tbody></table></div>`;}
function fieldForm(c){const max=Math.max(.5,...c.rows.map(r=>Math.abs(r.form||0)));return `<div class="gtracks story-form" role="list" aria-label="${e(c.title)}">${c.rows.map(r=>`<div class="gtrack-row" role="listitem"><span class="gtrack-name">${a('/player/'+r.slug,r.name)}<small>${e(r.rounds)} rounds</small></span><span class="gtrack" aria-hidden="true"><i data-w="${Math.round(Math.abs(r.form)/max*100)}" class="${r.form>0?'hi':'lo'}"></i></span><b class="gtrack-v">${r.form>0?'+':''}${f1(r.form)}</b></div>`).join('')}<p class="gnote">Strokes per round versus the field over recent full-field events in our record. Higher is better.</p></div>`;}
function courseDna(c){return `<div class="gtracks" role="list" aria-label="${e(c.title)}">${c.dimensions.map(d=>`<div class="gtrack-row" role="listitem"><span class="gtrack-name">${e(d.label)}<small>${e(d.unit||'')}</small></span><span class="gtrack" aria-hidden="true">${d.percentile===null||d.percentile===undefined?'':`<i data-w="${d.percentile}"></i>`}</span><b class="gtrack-v">${e(typeof d.value==='number'?(Math.round(d.value*100)/100):d.value)}</b></div>`).join('')}<p class="gnote">${a('/course/'+c.course.slug,'Full Course DNA')} · percentile among measured courses where shown.</p></div>`;}
export function articleChart(c){
 switch(c.type){
  case 'leaderboard':return leaderboard(c);
  case 'progress':return progress(c);
  case 'holes':return holes(c);
  case 'scorecard':return scorecard(c);
  case 'weather':return weatherModule(c);
  case 'past_winners':return pastWinners(c);
  case 'field_form':return fieldForm(c);
  case 'course_dna':return courseDna(c);
  case 'dna':return `<div class="dna-panel story-dna"><div class="dna-grid">${radar(c.dims,{title:c.title})}${tracks(c.dims)}</div><p class="gnote">${e(c.window)} · percentiles within the player’s tour cohort. ${a('/player/'+c.player.slug,'Full profile')}</p></div>`;
  case 'form':return formChart(c.series,{title:c.title})+`<p class="gnote">${a('/player/'+c.player.slug,'Results and history')}</p>`;
  default:return '';
 }
}
// Module groups in reading order; anything not grouped falls to the end of the body.
const GROUPS=[['LEADERBOARD','The board',['leaderboard','round_progress','scorecard']],['PLAYER DNA','The player',['winner_dna','player_dna','winner_form','player_form']],['COURSE','The course',['hole_difficulty','course_dna']],['WEATHER','Conditions',['weather']],['FIELD','Field intelligence',['field_form','past_winners']]];
// ---------------------------------------------------------------- page
export function heroHtml(h,a_){
 if(h?.photo?.sha256){const p=h.photo,ratio=p.height&&p.width?p.height/p.width:.66;
  return `<figure class="story-hero${ratio>1.1?' is-portrait':''}"><picture><source type="image/avif" srcset="${[640,960].map(w=>media(p.sha256,w,'avif')+' '+w+'w').join(', ')}" sizes="(max-width:900px) 100vw, 900px"><img src="${media(p.sha256,960,'webp')}" srcset="${[640,960].map(w=>media(p.sha256,w,'webp')+' '+w+'w').join(', ')}" sizes="(max-width:900px) 100vw, 900px" width="960" height="${Math.round(960*ratio)}" alt="${e(h.name||'')}" fetchpriority="high"></picture><figcaption>${e(h.name||'')}${p.author?` · Photo: ${e(p.author)}`:''}${p.licence?` · ${p.licence_url?`<a href="${e(p.licence_url)}" rel="license noopener">${e(p.licence)}</a>`:e(p.licence)}`:''}${p.source_url?` · <a href="${e(p.source_url)}" rel="noopener">source</a>`:''}</figcaption></figure>`;}
 return `<div class="story-hero is-art" role="img" aria-label="${e(a_.category)} artwork"><span class="story-art-kicker">${e(a_.category)}</span><span class="story-art-title">${e(a_.context?.tour||'GOLF')}</span></div>`;
}
export function articlePage(art,{related=[],video=null}={}){
 const updated=art.updated_at&&art.published_at&&Date.parse(art.updated_at)-Date.parse(art.published_at)>=5*60000;
 const byEditor=art.editor?.mode==='openai'?'Written with AI assistance from a frozen fact packet; every number is checked against it.':'Written by the Golf Desk from a frozen fact packet.';
 const charts=new Map(art.charts.map(c=>[c.id,c]));const placed=new Set();
 const chartFig=c=>{placed.add(c.id);return `<div class="story-module" data-chart="${e(c.id)}">${c.type==='weather'||c.type==='leaderboard'||c.type==='scorecard'?'':`<h3 class="story-module-title">${e(c.title||'')}</h3>`}${articleChart(c)}</div>`;};
 // One visual early so the story never reads as a wall of text.
 const lead=['leaderboard','scorecard','round_progress','weather','past_winners','course_dna','player_form'].map(id=>charts.get(id)).find(Boolean);
 const body=art.sections.map((s,i)=>`<section class="story-section"><h2>${e(s.heading)}</h2>${s.paragraphs.map(p=>`<p>${segHtml(p)}</p>`).join('')}</section>${i===0&&lead?chartFig(lead):''}`).join('');
 const groups=GROUPS.map(([k,t,ids])=>{const cs=ids.map(id=>charts.get(id)).filter(c=>c&&!placed.has(c.id));return cs.length?section(k,t,cs.map(chartFig).join(''),{cls:'story-group'}):'';}).join('');
 const rest=[...charts.values()].filter(c=>!placed.has(c.id)).map(chartFig).join('');
 const ent=t=>art.entities.filter(x=>x.type===t);
 const relCards=[...ent('player').slice(0,4).map(x=>['PLAYER',x]),...ent('course').slice(0,1).map(x=>['COURSE',x]),...ent('tournament').slice(0,1).map(x=>['TOURNAMENT',x]),...ent('majors').slice(0,1).map(x=>['MAJORS',x]),...ent('matchup').slice(0,2).map(x=>['MATCHUP',x])];
 const vid=video||art.video;
 return `<article class="story-page" data-article="${e(art.slug)}" data-article-type="${e(art.type)}">
<header class="story-head">${kicker(art.category+(art.context?.is_major?' · MAJOR':''))}<h1>${segHtml(art.headline.map(s=>s.t==='link'?{t:'text',v:s.v}:s))}</h1><p class="story-dek">${segHtml(art.dek)}</p>
<p class="story-byline"><span class="story-desk">PropBetEdge Golf Desk</span> · <time datetime="${e(art.published_at)}">Published ${e(when(art.published_at))}</time>${updated?` · <time datetime="${e(art.updated_at)}">Updated ${e(when(art.updated_at))}</time>`:''} · ${minutes(art)} min read</p></header>
${heroHtml(art.hero,art)}
<div class="story-layout"><div class="story-main">
${art.quick_facts?.length?`<aside class="story-quick" aria-label="Quick data"><dl>${art.quick_facts.map(q=>`<div><dt>${e(q.label)}</dt><dd>${e(q.display)}</dd></div>`).join('')}</dl></aside>`:''}
<div class="story-body">${body}</div>
${groups}${rest}
${vid?section('OFFICIAL VIDEO',vid.label||'Watch',videoCard(vid)):''}
${art.pbecast?section('PBECAST','Replay it',`<p><a class="button button-gold" href="${e(art.pbecast.href)}">Open the PBEcast replay</a></p><p class="gnote">Hole-by-hole replay built from published scorecards. Shot locations are reconstructed, not tracked.</p>`):''}
${relCards.length?section('RELATED','In this story',`<div class="story-related">${relCards.map(([k,x])=>`<a class="story-rel" href="${e(x.href)}"><span class="micro-label">${k}</span><b>${e(x.name)}</b></a>`).join('')}</div>`):''}
${section('EVIDENCE','Evidence ledger',`<div class="table-wrap" tabindex="0" role="region" aria-label="Evidence ledger"><table class="index-table story-ledger"><thead><tr><th scope="col">Fact</th><th scope="col">Value</th><th scope="col">Source</th></tr></thead><tbody>${art.evidence.map(f=>`<tr><td>${e(f.label)}</td><td>${e(f.display)}</td><td>${e(f.source||'')}</td></tr>`).join('')}</tbody></table></div><p class="gnote">${e(byEditor)} Packet ${e(String(art.packet_sha256||'').slice(0,12))}.</p>`,{id:'evidence'})}
${art.corrections?.length?section('CORRECTIONS','Corrections',`<ul class="story-corrections">${art.corrections.map(c=>`<li><time datetime="${e(c.at)}">${e(when(c.at))}</time>: ${c.facts.map(f=>`${e(f.label)} changed from ${e(f.was)} to ${e(f.now??'removed')}`).join('; ')}.</li>`).join('')}</ul>`):''}
${section('SOURCES','Sources, limits and method',`<ul class="source-list">${art.sources.map(s=>`<li>${e(s)}</li>`).join('')}</ul>${art.known_limits.length?`<h3>Known limits</h3><ul class="source-list">${art.known_limits.map(l=>`<li>${e(l)}</li>`).join('')}</ul>`:''}${art.method?`<h3>Method</h3><p>${e(art.method)}</p>`:''}`)}
</div></div>
${related.length?section('MORE FROM THE DESK','Related stories',`<div class="story-list-grid">${related.map(storyCard).join('')}</div>`):''}
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
