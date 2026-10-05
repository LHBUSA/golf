// PBEcast Round Replay controller (replay v2). Binds once per [data-cast-replay] root.
// Truth: hole scores are OBSERVED; a mapped hole is shown as VERIFIED COURSE ROUTING with no ball, trail or shot marker;
// an unmapped hole falls back to the labelled generic RECONSTRUCTED VISUALIZATION (cast-replay.js holeSvg).
import {e,portrait} from './ui.js';
import {holeSvg,shotPoints,completeRows,createPlayer,railHtml,cardHtml,roundTotal,toParText,CADENCE_MS} from './cast-replay.js';

const CONTEXT=1.3; // verified view: the hole plus ~30% surrounding routing so its place on the course reads
const reducedMotion=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
const parseVb=s=>String(s||'').trim().split(/[\s,]+/).map(Number);
const widen=([x,y,w,h],k)=>[x-(w*(k-1))/2,y-(h*(k-1))/2,w*k,h*k];

/**
 * @param {HTMLElement} root  server-rendered castReplayPanel()
 * @param {{rows:any[],layout?:Map<number,any>,map?:any,edition:string,courseMapSvg:Function,track?:Function}} o
 */
export function mountReplay(root,{rows,layout=new Map(),map:M=null,edition,courseMapSvg,track=()=>{}}){
 if(!root||root.dataset.rcBound)return null;
 const cards=completeRows(rows);
 if(!cards.length){root.hidden=true;return null;}
 root.dataset.rcBound='1';
 const $=s=>root.querySelector(s);
 const pSel=$('[data-rc-player]'),rSel=$('[data-rc-round]'),canvas=$('[data-rc-canvas]'),card=$('[data-rc-card]'),rail=$('[data-rc-strip]'),
  who=$('[data-rc-who]'),pos=$('[data-rc-pos]'),playBtn=$('[data-rc-play]'),playTxt=$('[data-rc-play-t]'),speedBtn=$('[data-rc-speed]'),attr=$('[data-rc-attr]');
 const real=n=>!!M?.geometry&&!!M.holes?.find(x=>x.hole===n&&x.route);
 const mh=n=>M?.holes?.find(x=>x.hole===n)||null;
 // Setup + field scoring only when they belong to this edition; otherwise the edition layout; par last-resorts to strokes - to_par.
 const setupOf=n=>{const s=mh(n)?.setup;return s&&s.edition===edition?s:null;};
 const fieldOf=n=>{const s=mh(n)?.scoring;return s&&s.edition===edition?s:null;};
 let row=null,round=null,holes=[],total=null,lastVb=null,anim=0,lastW=0;

 pSel.innerHTML=cards.map((r,i)=>`<option value="${i}">${e(r.player.name)}</option>`).join('');

 const truth=isReal=>{
  $('[data-rc-recon]').hidden=isReal;$('[data-rc-real]').hidden=!isReal;attr.hidden=!isReal;root.classList.toggle('is-verified',isReal);
  $('[data-rc-note]').textContent=isReal?'Scores are as published. The hole is the current mapped routing (© OpenStreetMap contributors, ODbL), not a historical setup. Shot locations and the shot sequence are not tracked, so no ball path is drawn.':'Scores are as published. Exact shot locations are unavailable: the hole shape, bunkers and ball path are a generic reconstruction from par and yardage, not shot tracking.';
 };
 const camera=(svg,to,animate)=>{
  cancelAnimationFrame(anim);const from=lastVb;lastVb=to;
  if(!animate||!from||reducedMotion()){svg.setAttribute('viewBox',to.join(' '));return;}
  svg.setAttribute('viewBox',from.join(' '));const t0=performance.now(),dur=520;
  const step=t=>{const k=Math.min(1,(t-t0)/dur),q=1-Math.pow(1-k,3);svg.setAttribute('viewBox',from.map((a,j)=>(a+(to[j]-a)*q).toFixed(1)).join(' '));if(k<1)anim=requestAnimationFrame(step);};
  anim=requestAnimationFrame(step);
 };
 const drawReal=(h,animate)=>{
  const w=canvas.clientWidth||640,ht=canvas.clientHeight||400,ar=w/ht;
  canvas.innerHTML=courseMapSvg(M,{focus:h.hole,ar,px:w/CONTEXT});
  const svg=canvas.querySelector('svg');if(!svg)return;svg.classList.add('rc-map');
  camera(svg,widen(parseVb(svg.getAttribute('viewBox')),CONTEXT),animate);
 };
 const drawRecon=(h,animate)=>{
  lastVb=null;canvas.innerHTML=holeSvg({hole:h.hole,par:h.par,yards:h.yards,strokes:h.strokes});
  const ball=canvas.querySelector('[data-ball]'),trail=canvas.querySelector('[data-trail]'),pts=shotPoints(h.par,h.strokes,h.hole);if(!pts.length||!ball||!trail)return;
  const path=[[180,470],...pts];
  if(!animate||reducedMotion()){const last=path[path.length-1];ball.setAttribute('cx',String(last[0]));ball.setAttribute('cy',String(last[1]));trail.setAttribute('points',path.map(p=>p.join(',')).join(' '));return;}
  // The illustrative ball finishes inside one playback beat (it is a labelled reconstruction, never a timeline).
  const dur=Math.min(650,(CADENCE_MS/player.state.speed)*0.7/(path.length-1));let seg=0,t0=performance.now();const done=[path[0]];
  const step=t=>{const k=Math.min(1,(t-t0)/dur),a=path[seg],b=path[seg+1];const x=a[0]+(b[0]-a[0])*k,y=a[1]+(b[1]-a[1])*k-Math.sin(Math.PI*k)*(seg<path.length-2?40:6);
   ball.setAttribute('cx',x.toFixed(1));ball.setAttribute('cy',y.toFixed(1));trail.setAttribute('points',[...done,[x,y]].map(p=>p.join(',')).join(' '));
   if(k<1){anim=requestAnimationFrame(step);return;}done.push(b);seg++;if(seg<path.length-1){t0=performance.now();anim=requestAnimationFrame(step);}};
  cancelAnimationFrame(anim);anim=requestAnimationFrame(step);
 };
 const show=(i,{animate})=>{
  const h=holes[i];if(!h)return;
  const isReal=real(h.hole);truth(isReal);isReal?drawReal(h,animate):drawRecon(h,animate);
  card.innerHTML=cardHtml(holes,i,{field:fieldOf(h.hole)});
  rail.querySelectorAll('[data-rc-hole]').forEach((b,k)=>{const on=k===i;b.classList.toggle('is-on',on);on?b.setAttribute('aria-current','step'):b.removeAttribute('aria-current');});
  pos.textContent=`Hole ${i+1} of ${holes.length} · ${toParText(holes.slice(0,i+1).reduce((s,x)=>s+x.to_par,0))} thru ${i+1}`;
  rail.querySelector('.is-on')?.scrollIntoView?.({block:'nearest',inline:'nearest',behavior:reducedMotion()||!animate?'auto':'smooth'});
 };
 const onState=({playing,speed,idx,count})=>{
  playBtn.setAttribute('aria-pressed',String(playing));playBtn.classList.toggle('is-playing',playing);
  playTxt.textContent=playing?'Pause':idx>=count-1&&count>1?'Replay round':'Play round';
  speedBtn.setAttribute('aria-pressed',String(speed===2));
  $('[data-rc-prev]').disabled=idx<=0;$('[data-rc-next]').disabled=idx>=count-1;
 };
 const player=createPlayer({onShow:show,onState});
 const renderWho=()=>{
  const p=row.player,tot=total?`<span class="rc-who-score"><b>${total.strokes}</b> ${e(toParText(total.to_par))}</span>`:'';
  who.innerHTML=`${portrait(p,{size:96,cls:'rc-portrait'})}<div><p class="rc-who-name"><a href="/player/${e(p.slug)}">${e(p.name)}</a></p><p class="rc-who-meta">Round ${e(round)}${tot}</p></div>`;
 };
 const load=()=>{
  row=cards[Number(pSel.value)]||cards[0];const rd=row.holes.find(h=>String(h.round)===rSel.value)||row.holes[0];round=rd.round;
  holes=rd.scores.map(s=>{const st=setupOf(s.hole),ly=layout.get(s.hole);return {...s,par:st?.par??ly?.par??(s.strokes-s.to_par),yards:st?.yards??ly?.yards??null};});
  total=roundTotal(row,round,holes);lastVb=null;
  rail.innerHTML=railHtml(holes,0,{total,round});renderWho();player.load(holes.length);
 };
 const setRounds=()=>{const r=cards[Number(pSel.value)]||cards[0];rSel.innerHTML=r.holes.map(h=>`<option value="${h.round}">Round ${h.round}</option>`).join('');load();};

 playBtn.addEventListener('click',()=>{const was=player.state.playing;player.toggle();if(!was)track('pbecast_view',{entity_type:'tournament',entity_id:edition});});
 $('[data-rc-next]').addEventListener('click',()=>player.next());
 $('[data-rc-prev]').addEventListener('click',()=>player.prev());
 speedBtn.addEventListener('click',()=>player.setSpeed(player.state.speed===2?1:2));
 rail.addEventListener('click',ev=>{const b=ev.target.closest('[data-rc-hole]');if(b)player.go(Number(b.getAttribute('data-rc-hole')));});
 rail.addEventListener('keydown',ev=>{const b=ev.target.closest('[data-rc-hole]');if(!b)return;const k={ArrowRight:1,ArrowLeft:-1}[ev.key];if(!k)return;ev.preventDefault();
  const i=Math.max(0,Math.min(holes.length-1,Number(b.getAttribute('data-rc-hole'))+k));player.go(i);rail.querySelector(`[data-rc-hole="${i}"]`)?.focus();});
 // Clicking a mapped route number on the course jumps to that hole.
 canvas.addEventListener('click',ev=>{const g=ev.target.closest?.('[data-hole]');if(!g)return;const i=holes.findIndex(h=>h.hole===Number(g.getAttribute('data-hole')));if(i>=0)player.go(i);});
 pSel.addEventListener('change',setRounds);rSel.addEventListener('change',load);
 if(typeof ResizeObserver==='function'){let raf=0;new ResizeObserver(()=>{const w=canvas.clientWidth;if(!w||Math.abs(w-lastW)<8)return;lastW=w;cancelAnimationFrame(raf);
  raf=requestAnimationFrame(()=>{const h=holes[player.state.idx];if(h&&real(h.hole)){lastVb=null;drawReal(h,false);}});}).observe(canvas);}
 // Default to the first card (leaderboard order); ?replay=<player-slug> deep-links a golfer when present in the complete cards.
 const want=new URLSearchParams(location.search).get('replay');const wi=want?cards.findIndex(r=>r.player.slug===want):-1;if(wi>=0)pSel.value=String(wi);
 lastW=canvas.clientWidth;setRounds();
 return player;
}
