// Course map controller (course pages + PBEcast Course View). Renders the API model with course-map.js, zooms by
// tweening the SVG viewBox attribute (no inline styles: CSP style-src 'self'), and reports hole selection so the
// scorecard and the map stay one system. Never draws a golfer, ball or position.
import {courseMapModule,holePanel,tierOf} from './course-map.js';

const memo=new Map();
export function fetchCourseMap(slug,edition=null){
 const k=slug+'|'+(edition||'');if(!memo.has(k))memo.set(k,fetch('/api/v1/courses/'+encodeURIComponent(slug)+'/map'+(edition?'?edition='+encodeURIComponent(edition):''),{signal:AbortSignal.timeout(10000)}).then(r=>r.ok?r.json():null).catch(()=>{memo.delete(k);return null;}));
 return memo.get(k);
}
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const parseVb=s=>String(s||'').split(/\s+/).map(Number);

export function mountCourseMap(host,M,{mode='page',focus=null,current=null,wind=null,onSelect=null,onSetup=null}={}){
 const st={M,mode,focus,current,wind,overlay:null,onSelect,onSetup,raf:0};
 const ar=()=>{const w=host.clientWidth||800;return mode==='cast'?(w<600?1.05:1.6):(w<600?1.0:1.5);};
 function render({animateFrom=null,keepFocus=null}={}){
  const w=host.clientWidth||800,px=st.mode==='cast'&&w>=900?w-340:w-32;
  host.innerHTML=courseMapModule(st.M,{focus:st.focus,overlay:st.overlay,current:st.current,wind:st.wind,mode:st.mode,ar:ar(),px});
  const svg=host.querySelector('.cm-svg');
  if(svg&&animateFrom&&!reduced()){const to=parseVb(svg.getAttribute('viewBox')),from=parseVb(animateFrom);
   if(from.length===4&&from.some((v,i)=>Math.abs(v-to[i])>0.5)){cancelAnimationFrame(st.raf);const t0=performance.now(),D=650,ease=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
    const step=t=>{const k=ease(Math.min(1,(t-t0)/D));svg.setAttribute('viewBox',from.map((v,i)=>(v+(to[i]-v)*k).toFixed(1)).join(' '));if(k<1)st.raf=requestAnimationFrame(step);};
    svg.setAttribute('viewBox',from.join(' '));st.raf=requestAnimationFrame(step);}}
  if(keepFocus)host.querySelector(keepFocus)?.focus();
 }
 function setFocus(h,{notify=false,from=null}={}){
  const prev=host.querySelector('.cm-svg')?.getAttribute('viewBox');st.focus=h;render({animateFrom:prev,keepFocus:from});
  if(notify&&st.onSelect)st.onSelect(h);
 }
 host.addEventListener('click',ev=>{
  const t=ev.target;const b=t.closest?.('[data-cm-hole]');
  if(b&&host.contains(b)){const h=Number(b.getAttribute('data-cm-hole'));setFocus(st.focus===h&&b.closest('.cm-keys')?null:h,{notify:true,from:`[data-cm-hole="${h}"]`});return;}
  const r=t.closest?.('.cm-route');if(r&&host.contains(r)){const h=Number(r.getAttribute('data-hole'));setFocus(h,{notify:true});return;}
  const o=t.closest?.('[data-cm-overlay]');if(o){st.overlay=o.getAttribute('data-cm-overlay')==='difficulty'?'difficulty':null;render({keepFocus:`[data-cm-overlay="${o.getAttribute('data-cm-overlay')}"]`});}
 });
 host.addEventListener('change',ev=>{const s=ev.target.closest?.('[data-cm-setup]');if(s&&st.onSetup)st.onSetup(s.value);});
 host.addEventListener('keydown',ev=>{
  const keys=[...host.querySelectorAll('.cm-keys [data-cm-hole]')];const i=keys.indexOf(document.activeElement);
  if(i>=0&&['ArrowRight','ArrowLeft','Home','End'].includes(ev.key)){ev.preventDefault();const j=ev.key==='ArrowRight'?(i+1)%keys.length:ev.key==='ArrowLeft'?(i-1+keys.length)%keys.length:ev.key==='Home'?0:keys.length-1;keys[j].focus();return;}
  if(ev.key==='Escape'&&st.focus!=null){setFocus(null,{notify:true});host.querySelector('.cm-keys button')?.focus();}
 });
 let w=host.clientWidth;if('ResizeObserver' in window)new ResizeObserver(()=>{if(Math.abs(host.clientWidth-w)>40){w=host.clientWidth;render();}}).observe(host);
 render();
 return {
  setFocus:h=>{if(st.focus!==h)setFocus(h);},
  setCurrent:h=>{if(st.current!==h){st.current=h;render();}},
  setWind:wd=>{st.wind=wd;const p=host.querySelector('[data-cm-panelhost]');if(p&&st.focus!=null)p.innerHTML=holePanel(st.M,st.focus,{wind:wd});},
  update:(M2,{focus}={})=>{st.M=M2;if(focus!==undefined)st.focus=focus;render();},
  get tier(){return tierOf(st.M);},
  hasRoute:h=>!!st.M.holes.find(x=>x.hole===h)?.route,
 };
}
