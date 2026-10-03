import './data.css';
import './product.css';
import './course-map.css';
import './vendor/kalshi/kalshi-market-ui.css';
import './kalshi.css';
import {initAnalytics,track,pageType,destination} from './analytics.js';
// @ts-ignore shared JS modules
import {pbecast,matchup,premiumDna,premiumFit,premiumField,premiumMatchup,home,today,live} from './lib/pages.js';
// @ts-ignore
import {portrait,e} from './lib/ui.js';
// @ts-ignore
import {heroLive,liveRail,liveBoard,playerLive,weatherNow,statusModule} from './lib/live-ui.js';
// @ts-ignore
import {castV3} from './lib/cast-v3-live.js';
// @ts-ignore
import {castShell} from './lib/cast-v3.js';
// @ts-ignore
import * as courseMapLive from './lib/course-map-live.js';
const {fetchCourseMap,mountCourseMap}=courseMapLive as any;
// @ts-ignore
import * as courseMapLib from './lib/course-map.js';
const {courseMapSvg}=courseMapLib as any;
// @ts-ignore
import {videoTile,TYPE_LABEL} from './lib/video.js';
// @ts-ignore
import {fillRaw,dnaModel,dnaBody,dnaContext,metricBars,windowFingerprint} from './lib/dna-ui.js';
// @ts-ignore
import {holeSvg,shotPoints,scoreLabel} from './lib/cast-replay.js';
// @ts-ignore
import {mountMovement} from './lib/movement-live.js';
// @ts-ignore Kalshi Market Intelligence (prediction market; same-origin /api/markets only)
import {hydrateKalshi,boardWithin} from './lib/kalshi-live.js';
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
async function loadCast(slug:string){const [ix,d]=await Promise.all([index(),fetch('/api/v1/tournaments/'+encodeURIComponent(slug)).then(r=>r.ok?r.json():null).catch(()=>null),boardWithin()]);const main=$('main');if(ix&&d?.data&&main){main.innerHTML=pbecast(ix,d.data);const lc=$('[data-live-cast]');if(lc&&d.data.status!=='completed')lc.innerHTML=castShell();bindCast();hydrateKalshi(main);hydrateLive();initReplay();}}
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
  if(mod==='player-dna'){fillRaw(document,r.data.dna,'data-raw');mountDnaWindows(r.data.dna);}if(mod==='matchups'){fillRaw(document,r.data.a?.dna,'data-raw-a');fillRaw(document,r.data.b?.dna,'data-raw-b');}
  l.classList.add('unlocked');l.innerHTML=mod==='player-dna'?premiumDna(r.data):mod==='course-fit'?premiumFit(r.data):mod==='field'?premiumField(r.data):premiumMatchup(r.data);}
}
premium();
// All Access: both DNA windows exist only after server-side verification, so the toggle appears only then. Switching
// re-renders the radar, cards, dimension rows, cohort context and raw values for that window (never mixed).
function mountDnaWindows(dna:any){
 const host=$('[data-dna-windows]');if(!host||!dna?.l24m||!dna?.all)return;const slug=location.pathname.split('/')[2]||'';
 let cur=Object.values(dna.l24m.metrics||{}).some((m:any)=>m?.percentile!==null&&m?.percentile!==undefined)?'l24m':'all',doc:any=null;
 const draw=()=>{host.innerHTML=`<div class="dna-wtoggle" role="group" aria-label="Player DNA window">${[['l24m',dna.l24m.window?.label||'Last 24 months'],['all',dna.all.window?.label||'All observed']].map(([k,l])=>`<button type="button" data-dna-win="${k}" aria-pressed="${k===cur}">${e(l)}</button>`).join('')}</div>`;};
 draw();
 host.addEventListener('click',async ev=>{const b=(ev.target as HTMLElement).closest('[data-dna-win]') as HTMLElement|null;if(!b)return;const k=b.dataset.dnaWin||'';if(k===cur||!dna[k])return;cur=k;draw();
  doc=doc||await api('players/'+encodeURIComponent(slug)).then(r=>r.ok?r.json():null).then((j:any)=>j?.data||null).catch(()=>null);
  const model=dnaModel(windowFingerprint(dna[k]));const body=$('[data-dna-body]'),bars=$('[data-dna-bars]'),lab=$('[data-dna-window-label]'),ctx=$('[data-dna-context]');
  if(body&&doc)body.innerHTML=dnaBody(doc,model);if(bars&&model)bars.innerHTML=metricBars(model);if(lab)lab.textContent=model?.window||'';if(ctx&&model)ctx.innerHTML=dnaContext(model);
  fillRaw(document,{l24m:dna[k]},'data-raw');track('dna_window_change',{entity_type:'player',entity_id:slug,dna_window:k});(host.querySelector(`[data-dna-win="${k}"]`) as HTMLElement|null)?.focus();});
}
// PBEcast / DNA analytics: canonical slugs only (no names).
document.addEventListener('click',ev=>{const t=ev.target as HTMLElement;
 const pl=t.closest?.('[data-cv3] a[data-player-slug]') as HTMLElement|null;if(pl)track('pbecast_player_click',{entity_type:'player',entity_id:pl.dataset.playerSlug||''});
 const dn=t.closest?.('a[data-dna-open]') as HTMLElement|null;if(dn)track('pbecast_dna_open',{entity_type:'player',entity_id:dn.dataset.dnaOpen||''});});
{const seenDim=new Set<string>();document.addEventListener('focusin',ev=>{const g=(ev.target as HTMLElement).closest?.('[data-dna-dim]') as HTMLElement|null;if(!g)return;const k=g.dataset.dnaDim||'';if(seenDim.has(k))return;seenDim.add(k);track('dna_dimension_focus',{entity_type:'player',entity_id:location.pathname.split('/')[2]||'',dna_dimension:k});});}
if(location.pathname==='/all-access'){
 const badge=$('.entitlement-status .state');
 api('membership').then(r=>r.ok?r.json():null).then(b=>{if(!b?.membership)throw Error('membership_unavailable');if(badge)badge.innerHTML='<i aria-hidden="true"></i>'+(b.membership.entitled?'ALL ACCESS VERIFIED':'FREE READER');}).catch(()=>{if(badge)badge.innerHTML='<i aria-hidden="true"></i>VERIFICATION UNAVAILABLE';});
}

// Hub pages re-render from the live projection when it is newer than the static build.
const hubs:Record<string,(ix:any)=>string>={'/':home,'/today':today,'/live':live};
const stamp=$('[data-asof]'),hub:((ix:any)=>string)|undefined=hubs[location.pathname];
if(stamp){Promise.all([fetch('/api/v1/projection/index.json',{signal:AbortSignal.timeout(8000)}).then(r=>r.ok?r.json():null),Object.hasOwn(hubs,location.pathname)?boardWithin():null]).then(([ix])=>{const st=$('[data-freshness]');if(!ix?.as_of){if(st)st.textContent='Saved snapshot · API unavailable';return;}
 if(ix.as_of>(stamp.getAttribute('data-asof')||'')){if(hub){const main=$('main');if(main){main.innerHTML=hub(ix);hydrateKalshi(main);hydrateLive();}}const s2=$('[data-freshness]');if(s2)s2.textContent=hub!==undefined?'Updated from live projection':'Newer data available on next refresh';}else if(st)st.textContent='Current projection';}).catch(()=>{const st=$('[data-freshness]');if(st)st.textContent='Saved snapshot · API unavailable';});}

// ---- Live scoring (observed ESPN snapshots via /api/v1/live). The server decides the state; this only renders it.
const LIVE_SHOWN=new Set(['live','stale','suspended','round_complete','pre','final']);
let liveBusy=false,liveAgain=false;
async function hydrateLive(){
 if(liveBusy){liveAgain=true;return;}liveBusy=true;
 try{
 const hero=$('[data-live-hero]'),rails=$$('[data-live-rail]'),board=$('[data-live-board]'),pl=$('[data-live-player]'),cast=$('[data-live-cast]'),page=$('[data-live-page]');
 const get=(q:string)=>api('live'+q).then(r=>r.ok?r.json():null).catch(()=>null);
 if(hero||rails.length||page){const r=await get('?top=500');const events=(r?.events||[]).filter((x:any)=>LIVE_SHOWN.has(x.state));
  if(events.length){
   if(hero){const pref=hero.getAttribute('data-edition');const ev=events.find((x:any)=>x.state!=='final')||events[0];if(ev&&(ev.state!=='final'||ev.edition.slug===pref))hero.innerHTML=heroLive(ev);}
   for(const rail of rails)rail.innerHTML=liveRail(events);
   if(page)page.innerHTML=events.map((ev:any)=>`<section class="data-section live-board"><p class="eyebrow">${e(ev.tour)}</p><h2><a class="text-link" href="/tournament/${e(ev.edition.slug)}#live">${e(ev.edition.name)}</a></h2>${statusModule(ev,{compact:true})}${liveBoard(ev,{limit:40})}</section>`).join('');
  }}
 if(board||cast){const slug=(board||cast)!.getAttribute('data-edition');const [r,mv]=slug?await Promise.all([get('/'+encodeURIComponent(slug)),get('/'+encodeURIComponent(slug)+'/movement')]):[null,null];
  if(r?.event&&LIVE_SHOWN.has(r.event.state)){if(board){board.innerHTML=`<p class="eyebrow">LIVE LEADERBOARD</p>${statusModule(r.event)}${weatherNow(r.weather_now)}${liveBoard(r.event)}<div data-mvx-host></div>`;mountMovement($('[data-mvx-host]',board),mv?.points||[],{title:'Who moved, and when'});}if(cast)castV3(cast,r,mv);}else if(cast?.querySelector('[data-cv3]'))cast.innerHTML='';}
 if(pl){const slug=pl.getAttribute('data-player');const r=slug?await get('?player='+encodeURIComponent(slug)):null;if(r?.player&&LIVE_SHOWN.has(r.event?.state)&&r.event.state!=='final'){let traits:any=null;try{traits=JSON.parse(pl.getAttribute('data-traits')||'null');}catch{}pl.innerHTML=playerLive(r.event,r.player,{traits});}}
 }finally{liveBusy=false;if(liveAgain){liveAgain=false;hydrateLive();}}
}
hydrateLive();
// Kalshi prediction-market mounts (tournament card, PBEcast strip, card lines). Never blocks any other module.
hydrateKalshi(document);
// Course View in news articles: only when the course has verified/partial routing (never decorative geometry).
{const host=$('[data-article-course-map]');if(host){const slug=host.getAttribute('data-course')||'';
 fetchCourseMap(slug).then((M:any)=>{if(!M?.geometry||!/VERIFIED|PARTIAL/.test(M.geometry_status||'')){host.remove();return;}host.hidden=false;mountCourseMap(host,M,{mode:'page'});});}}
// Course map (course pages): OSM-derived current routing + one championship setup and that same edition's scoring.
{const host=$('[data-course-map-host]');if(host){const slug=host.getAttribute('data-course')||'';
 fetchCourseMap(slug).then((M:any)=>{if(!M||(!M.setup&&!M.geometry)){host.remove();return;}
  const ctl:any=mountCourseMap(host,M,{mode:'page',onSetup:(ed:string)=>fetchCourseMap(slug,ed).then((M2:any)=>{if(M2)ctl.update(M2,{focus:null});})});});}}
// Keep live views current while visible. Cadence audit: ESPN snapshots are ingested every ~10 min (cron */10),
// the API is edge-cached for 60 s, so a 2-minute poll sees each new snapshot within ~3 min without extra load.
const LIVE_SEL='[data-live-hero],[data-live-rail],[data-live-board],[data-live-player],[data-live-cast],[data-live-page]';
let lastLive=Date.now();
setInterval(()=>{if(document.visibilityState==='visible'&&$(LIVE_SEL)){lastLive=Date.now();hydrateLive();}},120000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&Date.now()-lastLive>120000&&$(LIVE_SEL)){lastLive=Date.now();hydrateLive();}});

// ---- Official video (keyless lane). Posters only; the iframe loads after a click and never autoplays on load.
const VIDEO_GROUPS:Record<string,[string,(v:any)=>boolean][]>={
 edition:[['Round by round',(v:any)=>v.round!=null&&v.video_type!=='full_round'],['Full round replays',(v:any)=>v.video_type==='full_round'],['Highlights',(v:any)=>/highlights/.test(v.video_type)&&v.round==null],['Interviews and press',(v:any)=>['interview','press_conference'].includes(v.video_type)],['More',()=>true]],
 player:[['Latest highlights',(v:any)=>/highlights/.test(v.video_type)||v.video_type==='full_round'],['Interviews',(v:any)=>['interview','press_conference'].includes(v.video_type)],["What's in the bag",(v:any)=>v.video_type==='witb'],['More',()=>true]],
 course:[['Course preview and flyover',(v:any)=>['course_preview','course_flyover'].includes(v.video_type)],['Tournament video here',()=>true]]};
async function hydrateVideos(){
 for(const m of $$('[data-videos]')){const kind=m.getAttribute('data-videos')||'',slug=m.getAttribute('data-slug')||'';if(!slug||m.dataset.done)continue;m.dataset.done='1';
  const r=await api(`videos?${kind}=${encodeURIComponent(slug)}&limit=18`).then(x=>x.ok?x.json():null).catch(()=>null);const vs=r?.data||[];if(!vs.length)continue;
  const used=new Set<string>();const groups=(VIDEO_GROUPS[kind]||[['Official video',()=>true]]).map(([t,f])=>{const g=vs.filter((v:any)=>!used.has(v.video_id)&&f(v)).slice(0,6);g.forEach((v:any)=>used.add(v.video_id));return [t,g] as [string,any[]];}).filter(([,g])=>g.length);
  m.innerHTML=`<p class="eyebrow">OFFICIAL VIDEO</p><h2>Watch</h2>${groups.map(([t,g])=>`<h3 class="yt-group">${e(t)}</h3><div class="yt-rail yt-n${Math.min(g.length,3)}">${g.map((v:any)=>videoTile(v,{label:(v.round?`R${v.round} · ${(TYPE_LABEL as any)[v.video_type]||'Video'}`:null) as any})).join('')}</div>`).join('')}<p class="gnote">Official channels only. Plays from YouTube (privacy-enhanced mode) when you press play.</p>`;m.hidden=false;
  if('IntersectionObserver' in window){const io=new IntersectionObserver(es=>{for(const x of es)if(x.isIntersecting){const el=x.target as HTMLElement;track('video_impression',{video_provider:'youtube',video_id:el.dataset.yt||'',video_type:el.dataset.ytType||'',source_channel:el.dataset.ytChannel||''});io.unobserve(el);}},{threshold:.5});$$('.yt',m).forEach(el=>io.observe(el));}
 }
}
document.addEventListener('click',ev=>{
 const t=ev.target as HTMLElement;const btn=t.closest?.('.yt-poster') as HTMLElement|null;
 if(btn){const box=btn.closest('.yt') as HTMLElement;const id=box?.dataset.yt;if(!id||!/^[A-Za-z0-9_-]{6,20}$/.test(id))return;
  const f=document.createElement('iframe');f.src=`https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&autoplay=1&playsinline=1`;f.title=box.dataset.ytTitle||'Video';f.allow='autoplay; encrypted-media; picture-in-picture; fullscreen';f.setAttribute('allowfullscreen','');f.loading='eager';f.referrerPolicy='strict-origin-when-cross-origin';
  btn.replaceWith(f);track('video_play',{video_provider:'youtube',video_id:id,video_type:box.dataset.ytType||'',source_channel:box.dataset.ytChannel||''});return;}
 const out=t.closest?.('[data-yt-out]') as HTMLElement|null;if(out){const box=out.closest('.yt') as HTMLElement;track('video_watch_on_youtube',{video_provider:'youtube',video_id:box?.dataset.yt||''});}
});
hydrateVideos();

// ---- PBEcast replay controller: observed hole scores, reconstructed movement (labelled on the panel).
async function initReplay(){
 const root=$('[data-cast-replay]');if(!root||root.dataset.ready)return;root.dataset.ready='1';
 const slug=root.getAttribute('data-edition')||'';
 const [rr,er]=await Promise.all([api('tournaments/'+encodeURIComponent(slug)+'/rounds').then(r=>r.ok?r.json():null).catch(()=>null),api('tournaments/'+encodeURIComponent(slug)).then(r=>r.ok?r.json():null).catch(()=>null)]);
 // Only complete 18-hole cards are replayed; partial cards are never padded.
 // Verified routing (when the course is mapped): the replay shows the real hole and suppresses the illustrative ball
 // flight entirely: real geography, unknown shot sequence. Unmapped holes keep the labelled generic reconstruction.
 const courseSlug=root.getAttribute('data-course');const M:any=courseSlug?await fetchCourseMap(courseSlug,slug).then((m:any)=>m||fetchCourseMap(courseSlug)):null;
 const real=(n:number)=>!!M?.geometry&&!!M.holes?.find((x:any)=>x.hole===n&&x.route);
 const rows=(rr?.data?.rounds||[]).map((r:any)=>({...r,holes:(r.holes||[]).filter((h:any)=>h.scores?.length===18)})).filter((r:any)=>r.holes.length).slice(0,60),layout=new Map<number,any>(((er?.data?.layout?.holes)||[]).map((h:any)=>[h.hole,h]));
 if(!rows.length){root.hidden=true;return;}
 const pSel=$<HTMLSelectElement>('[data-rc-player]',root)!,rSel=$<HTMLSelectElement>('[data-rc-round]',root)!,canvas=$('[data-rc-canvas]',root)!,card=$('[data-rc-card]',root)!,strip=$('[data-rc-strip]',root)!;
 pSel.innerHTML=rows.map((r:any,i:number)=>`<option value="${i}">${e(r.player.name)}</option>`).join('');
 let holes:any[]=[],idx=0,playing=false,timer:any=null;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const setRounds=()=>{const r=rows[Number(pSel.value)];rSel.innerHTML=r.holes.map((h:any)=>`<option value="${h.round}">Round ${h.round}</option>`).join('');load();};
 const load=()=>{const r=rows[Number(pSel.value)],rd=r.holes.find((h:any)=>String(h.round)===rSel.value)||r.holes[0];holes=(rd?.scores||[]).map((s:any)=>({...s,par:layout.get(s.hole)?.par??(s.strokes!=null&&s.to_par!=null?s.strokes-s.to_par:null),yards:layout.get(s.hole)?.yards??null}));idx=0;stop();renderStrip();show(0,false);};
 const renderStrip=()=>{let run=0;strip.innerHTML=holes.map((h:any,i:number)=>{run+=h.to_par??0;const d=h.to_par;return `<li><button type="button" data-rc-hole="${i}" class="rc-h ${d<0?'is-under':d>0?'is-over':''}" aria-label="Hole ${h.hole}: ${h.strokes} (${scoreLabel(d)})"><small>${h.hole}</small>${e(h.strokes??'—')}</button></li>`;}).join('');};
 const label=(isReal:boolean)=>{const a=$('[data-rc-recon]',root),b=$('[data-rc-real]',root),n=$('[data-rc-note]',root);if(a)a.hidden=isReal;if(b)b.hidden=!isReal;if(n)n.textContent=isReal?'Scores are as published. The hole is the current mapped routing (© OpenStreetMap contributors, ODbL), not a historical setup. Shot locations and the shot sequence are not tracked, so no ball path is drawn.':'Scores are as published. Exact shot locations are unavailable: the hole shape, bunkers and ball path are a generic reconstruction from par and yardage, not shot tracking.';};
 const show=(i:number,animate:boolean)=>{idx=i;const h=holes[i];if(!h)return;
  if(real(h.hole)){label(true);canvas.innerHTML=`<div class="rc-real">${courseMapSvg(M,{focus:h.hole,ar:0.7,px:canvas.clientWidth||360})}<p class="rc-real-attr">© OpenStreetMap contributors · current mapped routing</p></div>`;
   const thru=holes.slice(0,i+1).reduce((s:number,x:any)=>s+(x.to_par??0),0);
   card.innerHTML=`<p class="micro-label">HOLE ${h.hole} · PAR ${e(h.par??'—')}</p><b>${e(h.strokes??'—')}</b><span>${e(scoreLabel(h.to_par))}</span><p class="rc-run">Round to par thru ${i+1}: <b>${thru===0?'E':thru>0?'+'+thru:'−'+Math.abs(thru)}</b></p>`;
   strip.querySelectorAll('.rc-h').forEach((b,k)=>b.classList.toggle('is-on',k===i));return;}
  label(false);canvas.innerHTML=holeSvg({hole:h.hole,par:h.par,yards:h.yards,strokes:h.strokes});
  const thru=holes.slice(0,i+1).reduce((s:number,x:any)=>s+(x.to_par??0),0);
  card.innerHTML=`<p class="micro-label">HOLE ${h.hole} · PAR ${e(h.par??'—')}</p><b>${e(h.strokes??'—')}</b><span>${e(scoreLabel(h.to_par))}</span><p class="rc-run">Round to par thru ${i+1}: <b>${thru===0?'E':thru>0?'+'+thru:'−'+Math.abs(thru)}</b></p>`;
  strip.querySelectorAll('.rc-h').forEach((b,k)=>b.classList.toggle('is-on',k===i));
  const ball=canvas.querySelector('[data-ball]') as SVGCircleElement,trail=canvas.querySelector('[data-trail]') as SVGPolylineElement;
  const pts=shotPoints(h.par,h.strokes,h.hole);if(!pts.length)return;
  const path=[[180,470],...pts];
  if(!animate||reduced){const last=path[path.length-1];ball.setAttribute('cx',String(last[0]));ball.setAttribute('cy',String(last[1]));trail.setAttribute('points',path.map(p=>p.join(',')).join(' '));return;}
  let seg=0,t0=performance.now();const dur=650;const done:number[][]=[path[0]];
  const step=(t:number)=>{const k=Math.min(1,(t-t0)/dur),a=path[seg],b=path[seg+1];const x=a[0]+(b[0]-a[0])*k,y=a[1]+(b[1]-a[1])*k-Math.sin(Math.PI*k)*(seg<path.length-2?40:6);
   ball.setAttribute('cx',x.toFixed(1));ball.setAttribute('cy',y.toFixed(1));trail.setAttribute('points',[...done,[x,y]].map(p=>p.join(',')).join(' '));
   if(k<1){requestAnimationFrame(step);return;}done.push(b);seg++;if(seg<path.length-1){t0=performance.now();requestAnimationFrame(step);}};
  requestAnimationFrame(step);
 };
 const stop=()=>{playing=false;clearTimeout(timer);const b=$('[data-rc-play]',root);if(b)b.textContent='Play round';};
 const next=()=>{if(idx<holes.length-1){show(idx+1,true);if(playing)timer=setTimeout(next,(holes[idx]?.strokes||4)*700+900);}else stop();};
 $('[data-rc-play]',root)?.addEventListener('click',()=>{if(playing){stop();return;}playing=true;const b=$('[data-rc-play]',root);if(b)b.textContent='Pause';if(idx>=holes.length-1)idx=-1;next();track('pbecast_view',{entity_type:'tournament',entity_id:slug});});
 $('[data-rc-next]',root)?.addEventListener('click',()=>{stop();if(idx<holes.length-1)show(idx+1,true);});
 $('[data-rc-prev]',root)?.addEventListener('click',()=>{stop();if(idx>0)show(idx-1,true);});
 strip.addEventListener('click',ev=>{const b=(ev.target as HTMLElement).closest('[data-rc-hole]');if(b){stop();show(Number(b.getAttribute('data-rc-hole')),true);}});
 pSel.addEventListener('change',setRounds);rSel.addEventListener('change',load);setRounds();
}
initReplay();
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
