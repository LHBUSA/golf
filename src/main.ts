import './data.css';
import './product.css';
import {initAnalytics,track,pageType,destination} from './analytics.js';
// @ts-ignore shared JS modules
import {pbecast,matchup,premiumDna,premiumFit,premiumField,premiumMatchup,home,today,live} from './lib/pages.js';
// @ts-ignore
import {portrait,e} from './lib/ui.js';
initAnalytics();
const $=<T extends Element=HTMLElement>(s:string,root:ParentNode=document)=>root.querySelector<T>(s);
const $$=<T extends Element=HTMLElement>(s:string,root:ParentNode=document)=>[...root.querySelectorAll<T>(s)];
const menu=$<HTMLButtonElement>('.menu-toggle');
menu?.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));$('#primary-navigation')?.classList.toggle('open',open);});
document.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&menu?.getAttribute('aria-expanded')==='true'){menu.setAttribute('aria-expanded','false');$('#primary-navigation')?.classList.remove('open');menu.focus();}});
let indexPromise:Promise<any>|null=null;
const index=()=>indexPromise||(indexPromise=fetch('/index-snapshot.json').then(r=>r.ok?r.json():null).catch(()=>null));
const api=(path:string)=>fetch('/api/v1/'+path,{credentials:'same-origin',signal:AbortSignal.timeout(8000)});
// Tournament table filters
const table=$('[data-filter-table]');
if(table){const sel=$$<HTMLSelectElement>('[data-filter]');const count=$('[data-filter-count]');const apply=()=>{const f=Object.fromEntries(sel.map(s=>[s.dataset.filter,s.value]));let n=0;for(const tr of $$<HTMLTableRowElement>('tbody tr',table)){const show=(!f.division||tr.dataset.division===f.division)&&(!f.major||tr.dataset.major===f.major)&&(!f.year||tr.dataset.year===f.year);tr.hidden=!show;if(show)n++;}if(count)count.textContent=n+' editions';};sel.forEach(s=>s.addEventListener('change',apply));}
// Player directory: full list from the published index; never sorts on unavailable data.
const grid=$('[data-player-grid]'),form=$<HTMLFormElement>('[data-player-filters]');
if(grid&&form){
 const norm=(s:string)=>s.normalize('NFKD').replace(/[̀-ͯ]/g,'').toLowerCase();
 const card=(p:any)=>`<article class="player-card">${portrait(p,{size:120,cls:'card-portrait'})}<div class="player-card-body"><h3><a class="player-link" href="/player/${e(p.slug)}">${e(p.name)}</a></h3><p>${e([p.country,p.division==='women'?'Women’s golf':'Men’s golf'].filter(Boolean).join(' · '))}</p><dl class="mini-stats"><div><dt>Wins</dt><dd>${e(p.wins_observed)}</dd></div><div><dt>Majors</dt><dd>${e(p.major_wins)}</dd></div><div><dt>Events</dt><dd>${e(p.events_observed)}</dd></div></dl>${p.scoring&&p.scoring.percentile!==null?`<div class="mini-bar"><span data-w="${Math.round(p.scoring.percentile)}"></span><b>${p.scoring.percentile}<small>th pct scoring</small></b></div>`:''}</div></article>`;
 const run=async()=>{const ix=await index();if(!ix)return;const f=new FormData(form);const q=norm(String(f.get('q')||'')),div=f.get('division'),c=f.get('country'),sort=String(f.get('sort')||'events_observed');
  let rows=ix.players.filter((p:any)=>(!q||norm(p.name).includes(q))&&(!div||p.division===div)&&(!c||p.country_code===c));
  if(sort==='scoring'||sort==='form')rows=rows.filter((p:any)=>p[sort]&&p[sort].percentile!==null).sort((a:any,b:any)=>b[sort].percentile-a[sort].percentile);
  else if(sort==='name')rows=rows.sort((a:any,b:any)=>a.name.localeCompare(b.name));else rows=rows.sort((a:any,b:any)=>(b[sort]||0)-(a[sort]||0));
  grid.innerHTML=rows.slice(0,150).map(card).join('');const count=$('[data-filter-count]');if(count)count.textContent=`Showing ${Math.min(150,rows.length)} of ${rows.length}`;};
 form.addEventListener('input',run);form.addEventListener('change',run);
}
// Site search
const sInput=$<HTMLInputElement>('[data-search-input]'),sOut=$('[data-search-results]');
if(sInput&&sOut){let t:any;const q0=new URLSearchParams(location.search).get('q');if(q0)sInput.value=q0;const go=()=>{clearTimeout(t);t=setTimeout(async()=>{const q=sInput.value.trim();if(q.length<2){sOut.innerHTML='';return;}const r=await api('search?q='+encodeURIComponent(q)).then(r=>r.json()).catch(()=>null);const d=r?.data;if(!d){sOut.innerHTML='<p class="empty-note">Search is unavailable right now.</p>';return;}
 sOut.innerHTML=[['Players',d.players.map((p:any)=>`<li><a href="/player/${e(p.slug)}">${e(p.name)}</a> <small>${e(p.country||'')}</small></li>`)],['Tournaments',d.tournaments.map((x:any)=>`<li><a href="${e(x.slug)}">${e(x.name)}</a></li>`)],['Courses',d.courses.map((c:any)=>`<li><a href="/course/${e(c.slug)}">${e(c.name)}</a> <small>${e([c.locality,c.country].filter(Boolean).join(' · '))}</small></li>`)]].map(([h,items]:any)=>items.length?`<section class="search-group"><h2>${h}</h2><ul>${items.join('')}</ul></section>`:'').join('')||'<p class="empty-note">No matches in coverage.</p>';},200);};sInput.addEventListener('input',go);if(q0)go();}
// Matchup finder: canonical ordering so A vs B and B vs A share one URL.
const finder=$<HTMLFormElement>('[data-matchup-finder]');
if(finder){index().then(ix=>{const dl=$('#player-options');if(ix&&dl)dl.innerHTML=ix.players.map((p:any)=>`<option value="${e(p.name)}"></option>`).join('');const pre=new URLSearchParams(location.search).get('a');if(pre&&ix){const p=ix.players.find((x:any)=>x.slug===pre);if(p)(finder.elements.namedItem('a') as HTMLInputElement).value=p.name;}});
 finder.addEventListener('submit',async ev=>{ev.preventDefault();const ix=await index();const st=$('[data-finder-status]');const f=new FormData(finder);const find=(n:any)=>ix?.players.filter((p:any)=>p.name.toLowerCase()===String(n).trim().toLowerCase());const A=find(f.get('a')),B=find(f.get('b'));
  if(!A?.length||!B?.length){if(st)st.textContent='Choose both players from the suggestions.';return;}if(A.length>1||B.length>1){if(st)st.textContent='More than one golfer has that name; open the player page and use its Compare link.';return;}if(A[0].slug===B[0].slug){if(st)st.textContent='Choose two different players.';return;}
  const [a,b]=[A[0].slug,B[0].slug].sort();location.assign(`/matchups/${a}/${b}`);});}
// Client-rendered matchup for pairs that were not prerendered.
const m=location.pathname.match(/^\/matchups\/([a-z0-9-]+)\/([a-z0-9-]+)$/);
if(m&&$('[data-matchup-finder]')){const [a,b]=[m[1],m[2]].sort();if(a!==m[1])location.replace(`/matchups/${a}/${b}`);else api(`matchups/${a}/${b}`).then(r=>r.ok?r.json():null).then(r=>{const main=$('main');if(!main)return;if(!r?.data){main.innerHTML='<section class="page-heading data-heading"><div><p class="eyebrow">MATCHUPS</p><h1>Matchup not available.</h1><p>One of these players is not in coverage.</p></div></section>';return;}main.innerHTML=matchup(r.data);document.title=`${r.data.a.name} vs ${r.data.b.name} | PropBetEdge Golf`;premium();}).catch(()=>{});}
// PBEcast edition switching
const castSel=$<HTMLSelectElement>('[data-cast-select]');
function bindCast(){$<HTMLSelectElement>('[data-cast-select]')?.addEventListener('change',ev=>{const v=(ev.target as HTMLSelectElement).value;history.replaceState(null,'','/pbecast?tournament='+encodeURIComponent(v));loadCast(v);});}
async function loadCast(slug:string){const [ix,d]=await Promise.all([index(),fetch('/api/v1/tournaments/'+encodeURIComponent(slug)).then(r=>r.ok?r.json():null).catch(()=>null)]);const main=$('main');if(ix&&d?.data&&main){main.innerHTML=pbecast(ix,d.data);bindCast();}}
if(castSel){bindCast();const q=new URLSearchParams(location.search).get('tournament');if(q&&q!==castSel.value)loadCast(q);}
// Premium modules: values are requested only after server-side All Access verification.
async function premium(){
 const locks=$$('[data-premium]');if(!locks.length)return;
 const mem=await api('membership').then(r=>r.ok?r.json():null).catch(()=>null);
 if(!mem?.membership?.entitled){for(const l of locks){const s=$('.premium-status',l);if(s)s.textContent=mem?'Free reader: sign in with All Access to unlock.':'Membership verification unavailable; premium stays locked.';}return;}
 const parts=location.pathname.split('/').filter(Boolean);
 for(const l of locks){const mod=l.dataset.premium;let path='';
  if(mod==='player-dna'&&parts[0]==='player')path='player-dna/'+parts[1];else if(mod==='course-fit'&&parts[0]==='course')path='course-dna/'+parts[1];else if(mod==='field'&&parts[0]==='tournament')path='field/'+parts[1];else if(mod==='matchups'&&parts[0]==='matchups')path='matchups/'+parts[1]+'/'+parts[2];
  if(!path)continue;const r=await api('intelligence/'+path).then(r=>r.ok?r.json():null).catch(()=>null);if(!r?.data){const s=$('.premium-status',l);if(s)s.textContent='All Access verified. Not enough comparable sample for this module.';continue;}
  l.classList.add('unlocked');l.innerHTML=mod==='player-dna'?premiumDna(r.data):mod==='course-fit'?premiumFit(r.data):mod==='field'?premiumField(r.data):premiumMatchup(r.data);}
}
premium();
if(location.pathname==='/all-access'){
 const badge=$('.entitlement-status .state');
 api('membership').then(r=>r.ok?r.json():null).then(b=>{if(!b?.membership)throw Error('membership_unavailable');if(badge)badge.innerHTML='<i aria-hidden="true"></i>'+(b.membership.entitled?'ALL ACCESS VERIFIED':'FREE READER');}).catch(()=>{if(badge)badge.innerHTML='<i aria-hidden="true"></i>VERIFICATION UNAVAILABLE';});
}

// Hub pages re-render from the live projection when it is newer than the static build.
const hubs:Record<string,(ix:any)=>string>={'/':home,'/today':today,'/live':live};
const stamp=$('[data-asof]'),hub:((ix:any)=>string)|undefined=hubs[location.pathname];
if(stamp){fetch('/api/v1/projection/index.json',{signal:AbortSignal.timeout(8000)}).then(r=>r.ok?r.json():null).then(ix=>{const st=$('[data-freshness]');if(!ix?.as_of){if(st)st.textContent='Saved snapshot · API unavailable';return;}
 if(ix.as_of>(stamp.getAttribute('data-asof')||'')){if(hub){const main=$('main');if(main)main.innerHTML=hub(ix);}const s2=$('[data-freshness]');if(s2)s2.textContent=hub!==undefined?'Updated from live projection':'Newer data available on next refresh';}else if(st)st.textContent='Current projection';}).catch(()=>{const st=$('[data-freshness]');if(st)st.textContent='Saved snapshot · API unavailable';});}
// ---- Observational analytics (single GA4 instance; allowlisted, slug-only parameters)
{
 const pt=pageType(location.pathname),parts=location.pathname.split('/').filter(Boolean);
 const entity=['player','course','tournament'].includes(parts[0])?{entity_type:parts[0],entity_id:parts[1]}:parts[0]==='matchups'&&parts[2]?{entity_type:'matchup',entity_id:parts[1]+'.'+parts[2]}:{};
 track('golf_page_view',{page_type:pt,...entity});
 const view:Record<string,string>={player:'player_view',course:'course_view',tournament:'tournament_view',matchup:'matchup_view',pbecast:'pbecast_view'};
 if(view[pt])track(view[pt],entity);
 if(pt==='news'&&parts[1])track('news_article_view',{entity_type:'article',entity_id:parts[1]});
 const once=(sel:string,name:string)=>{const el=document.querySelector(sel);if(!el||!('IntersectionObserver' in window))return;const io=new IntersectionObserver(es=>{if(es.some(x=>x.isIntersecting)){track(name,entity);io.disconnect();}},{threshold:.4});io.observe(el);};
 once('.dna-panel','dna_view');once('.bag-dna','bag_dna_view');once('[data-weather]','weather_view');
 // Funnel: internal clicks from articles record only the destination type and canonical slug.
 document.addEventListener('click',ev=>{const el=(ev.target as HTMLElement)?.closest?.('a[href]') as HTMLAnchorElement|null;if(!el)return;const d=destination(el.getAttribute('href')||'');if(!d)return;
  if(pt==='news'&&parts[1]){const map:Record<string,string>={player:'article_player_click',course:'article_course_click',tournament:'article_tournament_click',pbecast:'article_pbecast_click',news:'article_related_story_click'};track(map[d.type]||'news_internal_link_click',{entity_type:d.type,entity_id:d.id||'',internal_destination_type:d.type});}
 });
}
