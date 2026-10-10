// PBEcast V3 controller: one state object per mounted cast, small region diffs on refresh, no timers per render.
import {fetchCourseMap,mountCourseMap} from './course-map-live.js';
import {holeStats,cardsFromLive} from './hole-intel.js';
import {statusModule} from './live-ui.js';
import {castShell,commandBar,currentHole,towerRows,focusPanel,compactDna,pulseEvents,pulseList,boardMoves,timelineSeries,timelineSvg,timelineLayout,timelineTable,fieldSnapshot,fieldPanel,weatherTile,ageText,courseClock,key,tapeView,golferTape,tapeHead,tapeEmpty,ago,clientState} from './cast-v3.js';
import {e} from './ui.js';

const STATE=new WeakMap();
const set=(el,html)=>{if(el&&el.__html!==html){el.innerHTML=html;el.__html=html;return true;}return false;};
const narrow=()=>matchMedia('(max-width: 767px)').matches;

export function castV3(host,r,mv,tape=null){
 const slug=host.getAttribute('data-edition')||'';let s=STATE.get(host);
 if(!s||s.slug!==slug||!s.root.isConnected){if(s)teardown(s);if(!host.querySelector('[data-cv3]'))host.innerHTML=castShell();s=mount(host,slug);STATE.set(host,s);}
 s.server=r.event;s.ev=clientState(r.event);s.tape=tape&&Array.isArray(tape.events)?tape:null;s.weather=r.weather_now||null;s.layout=r.course_holes||[];s.points=(mv?.points||[]).filter(p=>p.top?.length);
 s.holes=new Map((r.hole_scores||[]).filter(h=>h.round==null||h.round===r.event.round).map(h=>[h.slug||h.name,h.holes||[]]));
 const rows=s.ev.leaderboard||[];if(!s.selected||!rows.some(x=>key(x)===s.selected))s.selected=key(rows.find(x=>x.status==='active')||rows[0]);
 render(s);syncMap(s);s.prevRows=new Map(rows.map(x=>[key(x),{position:x.position,total_to_par:x.total_to_par,today_to_par:x.today_to_par,thru:x.thru}]));
}

function mount(host,slug){
 const root=host.querySelector('[data-cv3]');const q=sel=>root.querySelector(sel);
 const s={host,root,slug,selected:null,filter:narrow()?'selected':'contenders',focusKey:null,cursor:null,selHole:null,seen:null,prevRows:null,first:true,
  tapehead:q('[data-cv3-tapehead]'),bar:q('[data-cv3-bar]'),statusEl:q('[data-cv3-status]'),cmapEl:q('[data-cv3-cmap]'),tower:q('[data-cv3-tower]'),focus:q('[data-cv3-focus]'),pulse:q('[data-cv3-pulse]'),tl:q('[data-cv3-tl]'),plot:q('[data-cv3-plot]'),key:q('[data-cv3-key]'),tlcap:q('[data-cv3-tlcap]'),table:q('[data-cv3-table]'),field:q('[data-cv3-field]'),wx:q('[data-cv3-wx]')};
 root.addEventListener('click',ev=>{const t=ev.target.closest?.('button');if(!t||!root.contains(t))return;
  if(t.dataset.cv3Pick){select(s,t.dataset.cv3Pick);return;}
  // Scoring Pulse event with a proven hole -> select that golfer and focus that hole (map + scorecard).
  if(t.dataset.pulseKey){const h=t.dataset.pulseHole?Number(t.dataset.pulseHole):null,k=t.dataset.pulseKey;if(k&&(s.ev.leaderboard||[]).some(x=>key(x)===k))select(s,k);if(h==null){return;}s.selHole=h;renderFocus(s);s.map?.setFocus(h);(s.map&&s.map.tier!=='C'?s.cmapEl:s.focus).scrollIntoView?.({block:s.map&&s.map.tier!=='C'?'nearest':'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});return;}
  if(t.dataset.cv3Hole){const h=Number(t.dataset.cv3Hole);s.selHole=s.selHole===h?null:h;renderFocus(s);s.map?.setFocus(s.selHole??(narrow()?curHole(s):null));s.focus.querySelector(`[data-cv3-hole="${h}"]`)?.focus();return;}
  if(t.dataset.cv3Filter){s.filter=t.dataset.cv3Filter;renderTimeline(s);return;}
  if(t.dataset.cv3Series){const k=t.dataset.cv3Series;if((s.ev.leaderboard||[]).some(x=>key(x)===k))select(s,k);return;}
  if(t.hasAttribute('data-cv3-fs'))toggleFullscreen(s);});
 s.tower.addEventListener('keydown',ev=>{const b=[...s.tower.querySelectorAll('.cv3-hit')],i=b.indexOf(document.activeElement);if(i<0)return;
  const j=ev.key==='ArrowDown'?i+1:ev.key==='ArrowUp'?i-1:ev.key==='Home'?0:ev.key==='End'?b.length-1:null;if(j===null)return;ev.preventDefault();b[Math.max(0,Math.min(b.length-1,j))].focus();});
 // Legend hover/focus highlights a series without changing the selection.
 const hl=(ev,on)=>{const t=ev.target.closest?.('[data-cv3-series]');if(!t)return;s.focusKey=on?t.dataset.cv3Series:null;drawPlot(s);};
 s.key.addEventListener('pointerover',ev=>hl(ev,true));s.key.addEventListener('pointerout',ev=>hl(ev,false));s.key.addEventListener('focusin',ev=>hl(ev,true));s.key.addEventListener('focusout',ev=>hl(ev,false));
 let raf=0;s.plot.addEventListener('pointermove',ev=>{if(raf)return;const cx=ev.clientX,cy=ev.clientY;raf=requestAnimationFrame(()=>{raf=0;pointAt(s,cx,cy);});});
 s.plot.addEventListener('pointerleave',()=>{s.cursor=null;s.focusKey=null;drawPlot(s);});
 s.plot.addEventListener('keydown',ev=>{const m=s.m;if(!m)return;const n=m.times.length;let c=s.cursor??n;
  if(ev.key==='ArrowLeft')c=Math.max(0,c-1);else if(ev.key==='ArrowRight')c=Math.min(n-1,c+1);else if(ev.key==='Home')c=0;else if(ev.key==='End')c=n-1;else if(ev.key==='Escape'){s.cursor=null;drawPlot(s);return;}else return;
  ev.preventDefault();s.cursor=c;drawPlot(s);});
 s.plot.addEventListener('blur',()=>{s.cursor=null;drawPlot(s);});
 if('ResizeObserver' in window){s.ro=new ResizeObserver(()=>{if(s.plot.clientWidth!==s.w)drawPlot(s);});s.ro.observe(s.plot);}
 s.onFs=()=>{const on=document.fullscreenElement===root;syncFs(s,on);};document.addEventListener('fullscreenchange',s.onFs);
 s.onKey=ev=>{if(ev.key==='Escape'&&root.classList.contains('is-immersive'))exitImmersive(s);};document.addEventListener('keydown',s.onKey);
 // Freshness and course clock tick locally between polls so the age shown is always truthful.
 s.tick=setInterval(()=>{if(!root.isConnected){teardown(s);return;}tickClock(s);},15000);
 return s;
}
function teardown(s){clearInterval(s.tick);s.ro?.disconnect();document.removeEventListener('fullscreenchange',s.onFs);document.removeEventListener('keydown',s.onKey);document.body.classList.remove('cv3-lock');}
function tickClock(s){
 // Re-derive the visible state from the last observation every tick (no poll needed to go stale).
 if(s.server){const d=clientState(s.server);if(d.state!==s.ev?.state){s.ev=d;render(s);}}
const a=s.root.querySelector('[data-cv3-age]');if(a&&s.ev)a.textContent=ageText(s.ev);const o=s.root.querySelector('[data-cv3-obs]');if(o){const t=Date.parse(o.getAttribute('data-at')||'');if(Number.isFinite(t))o.textContent=`Last scoring observation ${ago(Math.max(0,Math.round((Date.now()-t)/1000)))}`;}const c=s.root.querySelector('[data-cv3-clock]');if(c)c.textContent=courseClock(Number(c.getAttribute('data-off')));}

function select(s,k){s.selected=k;s.selHole=null;s.cursor=null;
 for(const b of s.tower.querySelectorAll('[data-cv3-pick]')){const on=b.dataset.cv3Pick===k;b.closest('li')?.classList.toggle('is-on',on);b.setAttribute('aria-pressed',String(on));}
 s.tower.__html=null;renderPulse(s);renderFocus(s);renderTimeline(s);syncMap(s,{refocus:true});
 if(narrow())s.focus.scrollIntoView?.({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}

function render(s){
 const active=document.activeElement,fsFocused=active?.hasAttribute?.('data-cv3-fs');
 set(s.bar,commandBar(s.ev,s.weather));set(s.statusEl,statusModule(s.ev));syncFs(s,document.fullscreenElement===s.root||s.root.classList.contains('is-immersive'));if(fsFocused)s.bar.querySelector('[data-cv3-fs]')?.focus();
 // Tower: rebuilt only when a row changed; scroll position and the focused golfer survive the update.
 const focusedPick=active?.closest?.('[data-cv3-pick]')?.dataset.cv3Pick,top=s.tower.scrollTop;
 if(set(s.tower,towerRows(s.ev,{selected:s.selected,moves:boardMoves(s.points,s.ev.leaderboard),prev:s.first?null:s.prevRows}))){s.tower.scrollTop=top;if(focusedPick)s.tower.querySelector(`[data-cv3-pick="${CSS.escape(focusedPick)}"]`)?.focus();}
 if(s.first){s.tower.scrollTop=0;const on=s.tower.querySelector('li.is-on');if(on){const y=on.getBoundingClientRect().top-s.tower.getBoundingClientRect().top;if(y>s.tower.clientHeight-40)s.tower.scrollTop=y-s.tower.clientHeight/3;}}
 renderPulse(s);renderFocus(s);renderTimeline(s);
 set(s.field,fieldPanel(fieldSnapshot(s.ev,s.points)));set(s.wx,weatherTile(s.weather));
 s.first=false;
}
function row(s){return (s.ev.leaderboard||[]).find(x=>key(x)===s.selected);}
function curHole(s){return currentHole(row(s));}
const windOf=w=>w&&Number.isFinite(w.wind_from_deg)?{from_deg:w.wind_from_deg,dir:w.wind_dir,mph:w.wind_mph,precision:w.precision}:null;
// A sourced championship setup is still worth showing when physical routing is not: courseMapModule renders its
// scorecard-only Level C state (no SVG, no OSM attribution) until routing is verified.
export const canShowCoursePanel=M=>Boolean(M&&(M.geometry||M.setup));
const hasHoleTable=M=>Boolean(M?.holes?.some(h=>h.setup?.par!=null));
/** golf#18: the live edition's setup when it carries a hole table; otherwise the course default (latest started edition
 * with a table, labelled with its own year) so a mapped course never loses par/yardage; the bare live-edition answer
 * only when nothing better exists. */
export function chooseCourseMap(edM,defM){
 if(hasHoleTable(edM))return edM;
 if(canShowCoursePanel(defM)&&(hasHoleTable(defM)||!canShowCoursePanel(edM)))return defM;
 return canShowCoursePanel(edM)?edM:canShowCoursePanel(defM)?defM:null;
}

// PBEcast Course View: the real routing of the course being played (when mapped). Highlights the selected golfer's
// current hole as a whole route; map and scorecard selections drive each other. No golfer, ball or position marker.
function syncMap(s,{refocus=false}={}){
 const slug=s.ev?.course?.slug,ed=s.ev?.edition?.slug||null;
 if(s.map){s.map.setCurrent(curHole(s));s.map.setWind(windOf(s.weather));s.map.setContext(mapCtx(s));if(refocus)s.map.setFocus(s.selHole??(narrow()?curHole(s):null));
  // Mounted on the fallback: re-check the live edition at most once a minute; switch once it carries a hole table.
  if(ed&&s.mapEdition!==ed&&!s.edCheck&&Date.now()-(s.edCheckedAt||0)>60000){s.edCheckedAt=Date.now();s.edCheck=fetchCourseMap(slug,ed).then(M=>{s.edCheck=null;if(hasHoleTable(M)&&s.map){s.map.update(M);s.mapEdition=ed;}});}
  return;}
 if(!slug||s.mapReq)return;
 // The live edition's own setup (golf#18) when it has a hole table, else the course default. No usable answer -> one
 // retry a minute later instead of giving up for the session.
 s.mapReq=Promise.all([ed?fetchCourseMap(slug,ed):null,fetchCourseMap(slug)]).then(([edM,defM])=>{const M=chooseCourseMap(edM,defM);
  if(!M){setTimeout(()=>{if(!s.map)s.mapReq=null;},60000);return;}if(!s.root.isConnected)return;s.mapEdition=M.setup?.edition===ed&&hasHoleTable(M)?ed:null;s.edCheckedAt=Date.now();
  s.cmapEl.hidden=false;
  s.map=mountCourseMap(s.cmapEl,M,{mode:'cast',current:curHole(s),wind:windOf(s.weather),focus:s.selHole??(narrow()?curHole(s):null),
   onSelect:h=>{s.selHole=h;renderFocus(s);if(h!=null)s.focus.querySelector(`[data-cv3-hole="${h}"]`)?.classList.add('is-on');}});
  s.map.setContext(mapCtx(s));renderFocus(s);});
}
// Today = the live round's posted hole cards (observed field cards). Live counts come from posted holes only.
function mapCtx(s){const stats=holeStats(cardsFromLive([...s.holes.values()].map(h=>({holes:h}))));const rows=(s.ev.leaderboard||[]).filter(r=>r.status==='active');
 return {today:stats.size?{stats,label:`TODAY · ROUND ${s.ev.round}`,note:'live posted holes, current round'}:null,live:n=>({next:rows.filter(r=>currentHole(r)===n).length,cards:stats.get(n)?.sample??null})};}
// Golfer intelligence: portrait from the published index (approved photos only), DNA from the public player
// projection (/api/v1/players/:slug -> dna_public), both by canonical slug only and cached per page.
const IDX={p:null},PL=new Map();
function playerIndex(){return IDX.p||(IDX.p=fetch('/index-snapshot.json').then(r=>r.ok?r.json():null).then(ix=>new Map((ix?.players||[]).map(p=>[p.slug,p]))).catch(()=>new Map()));}
function playerDoc(slug){if(!PL.has(slug))PL.set(slug,fetch('/api/v1/players/'+encodeURIComponent(slug),{signal:AbortSignal.timeout(8000)}).then(r=>r.ok?r.json():null).then(j=>j?.data||null).catch(()=>null));return PL.get(slug);}
function renderFocus(s){const r=row(s),slug=r?.slug||null;
 // The golfer's own observed events (not capped by the pulse list's display limit).
 const evs=!s.selected?[]:s.tape?golferTape(s.tape,s.selected,s.ev.round):pulseEvents(s.points,{holes:s.holes,round:s.ev.round,focus:new Set([s.selected]),limit:2000}).filter(x=>x.keys?.includes(s.selected));const mv=boardMoves(s.points,s.ev.leaderboard).get(s.selected)||null;
 const cached=slug&&s.dnaHtml?.get(slug);
 set(s.focus,focusPanel(s.ev,r,{holes:s.holes.get(s.selected)||null,layout:s.layout,selHole:s.selHole,realRoute:h=>!!s.map?.hasRoute(h),player:slug?(s.photos?.get(slug)||{slug,name:r.name}):null,mv,events:evs,dnaBlock:cached??(slug?'<p class="gnote">Loading Player DNA…</p>':'')}));
 if(slug&&cached==null){s.dnaHtml=s.dnaHtml||new Map();playerDoc(slug).then(p=>{s.dnaHtml.set(slug,p?compactDna(p):'');if(row(s)?.slug===slug){const el=s.focus.querySelector('[data-cv3-dna]');if(el)el.innerHTML=s.dnaHtml.get(slug);s.focus.__html=null;}});}
 if(!s.photos){s.photos=new Map();playerIndex().then(m=>{s.photos=m;s.focus.__html=null;renderFocus(s);});}
}
// Live scoring: the server tape (full field) when available; the older client pulse over the top-40 movement
// history only as a fallback. "New since mount" drives the truthful waiting line.
function renderPulse(s){
 const ev=s.tape?tapeView(s.tape,s.ev,{selected:s.selected}):pulseEvents(s.points,{holes:s.holes,round:s.ev.round,focus:new Set([s.selected])});s.lastPulse=ev;
 const ids=ev.map(x=>x.t+'|'+x.text);if(!s.mountIds)s.mountIds=new Set(ids);
 const newSinceMount=ids.some(i=>!s.mountIds.has(i));
 if(s.tapehead)set(s.tapehead,tapeHead(s.ev,s.tape,{newSinceMount}));
 set(s.pulse,pulseList(ev,{seen:s.seen,empty:tapeEmpty(s.ev)}));s.seen=new Set(ids);
}
function renderTimeline(s){
 for(const b of s.tl.querySelectorAll('[data-cv3-filter]'))b.setAttribute('aria-pressed',String(b.dataset.cv3Filter===s.filter));
 s.m=timelineSeries(s.points,{filter:s.filter,selected:s.selected});s.tl.hidden=!s.m;if(!s.m)return;
 const m=s.m,name=new Map((s.ev.leaderboard||[]).map(x=>[key(x),x]));
 set(s.key,`<ul class="cv3-keys" aria-label="Players in the chart">${m.series.map((x,i)=>{const cur=name.get(x.key),o=[...x.obs].reverse().find(Boolean);const role=x.key===s.selected?'is-selected':s.filter==='contenders'?'c'+(i%8):m.leaders.has(x.key)?'is-leader':x.key===m.mover?'is-mover':'is-muted';return `<li><button type="button" class="${role}" data-cv3-series="${e(x.key)}" aria-label="${e(x.name)}${o?`, last observed ${o.tied?'T':''}${o.pos}`:''}${cur?'. Select golfer':''}"><i aria-hidden="true"></i>${e(x.name)}${o?` <small>${o.tied?'T':''}${o.pos}</small>`:''}</button></li>`;}).join('')}</ul>`);
 const t0=new Date(m.times[0]).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}),t1=new Date(m.times.at(-1)).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
 set(s.tlcap,`${m.times.length} observed scoring snapshots, ${e(t0)}–${e(t1)}. Dots are observations; curves only link consecutive observations and are not positions between them. Positions beyond the observed top 40 are not drawn.${m.selectedMissing?' The selected golfer has not been inside the observed top 40.':''} Use the arrow keys on the chart to step through snapshots.`);
 set(s.table,timelineTable(m));drawPlot(s);
}
function drawPlot(s){if(!s.m)return;const w=Math.round(s.plot.clientWidth)||0;if(!w)return;s.w=w;const h=Math.round(s.plot.clientHeight)||260;s.h=h;
 set(s.plot,timelineSvg(s.m,{width:w,height:h,selected:s.selected,focus:s.focusKey,cursor:s.cursor,palette:s.filter==='contenders'}));}
function pointAt(s,cx,cy){const m=s.m;if(!m||!s.w)return;const r=s.plot.getBoundingClientRect(),px=cx-r.left,py=cy-r.top;const g=timelineLayout(m,{width:s.w,height:s.h||260});
 let best=0,bd=1e9;for(let i=0;i<m.times.length;i++){const d=Math.abs(g.x(i)-px);if(d<bd){bd=d;best=i;}}
 let fk=null,fd=18;for(const x of m.series){const o=x.obs[best];if(!o)continue;const d=Math.abs(g.y(o.pos)-py);if(d<fd){fd=d;fk=x.key;}}
 s.cursor=best;s.focusKey=fk;drawPlot(s);}

function syncFs(s,on){const b=s.root.querySelector('[data-cv3-fs]');if(!b)return;b.setAttribute('aria-pressed',String(on));b.setAttribute('aria-label',on?'Exit fullscreen PBEcast':'Open fullscreen PBEcast');const t=b.querySelector('[data-cv3-fs-text]');if(t)t.textContent=on?'Exit fullscreen':'Fullscreen';s.root.classList.toggle('is-fs',on);}
function toggleFullscreen(s){
 if(document.fullscreenElement===s.root){document.exitFullscreen?.();return;}
 if(s.root.classList.contains('is-immersive')){exitImmersive(s);return;}
 if(document.fullscreenEnabled&&s.root.requestFullscreen){s.root.requestFullscreen().catch(()=>enterImmersive(s));}else enterImmersive(s);
}
// Fallback where the Fullscreen API is unavailable (iOS Safari): a fixed overlay that Escape or the button closes.
function enterImmersive(s){s.root.classList.add('is-immersive');document.body.classList.add('cv3-lock');syncFs(s,true);}
function exitImmersive(s){s.root.classList.remove('is-immersive');document.body.classList.remove('cv3-lock');syncFs(s,false);s.root.querySelector('[data-cv3-fs]')?.focus();}
