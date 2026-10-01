import './data.css';
import {initAnalytics} from './analytics.js';
initAnalytics();
import {productPage} from './lib/product.js';
const menu = document.querySelector<HTMLButtonElement>('.menu-toggle');
menu?.addEventListener('click',()=>{ const open=menu.getAttribute('aria-expanded')!=='true'; menu.setAttribute('aria-expanded',String(open)); document.querySelector('#primary-navigation')?.classList.toggle('open',open); });
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&menu?.getAttribute('aria-expanded')==='true'){menu.setAttribute('aria-expanded','false');document.querySelector('#primary-navigation')?.classList.remove('open');menu.focus();}});
document.querySelectorAll<HTMLButtonElement>('[data-tour]').forEach(button=>button.addEventListener('click',()=>{
 document.querySelectorAll('[data-tour]').forEach(b=>{ b.setAttribute('aria-pressed',String(b===button)); b.classList.toggle('selected',b===button); });
 const status=document.querySelector('.filter-description'); if(status) status.textContent=button.dataset.tour==='All tours'?'Showing all tour coverage.':'Showing '+button.dataset.tour+' coverage. Verified data is unavailable.';
}));

function bindDataControls(){
 document.querySelectorAll<HTMLButtonElement>('[data-division]').forEach(button=>button.addEventListener('click',()=>{
  const selected=button.dataset.division;document.querySelectorAll('[data-division]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
  document.querySelectorAll<HTMLElement>('[data-event-division]').forEach(card=>card.hidden=selected!=='all'&&card.dataset.eventDivision!==selected);
  const status=document.querySelector('.filter-description');if(status)status.textContent=selected==='all'?'Showing all captured editions.':'Showing '+(selected==='women'?'women’s':'men’s')+' captured major editions.';
 }));
 document.querySelector<HTMLSelectElement>('[data-cast-select]')?.addEventListener('change',event=>{const value=(event.target as HTMLSelectElement).value;location.assign('/pbecast?tournament='+encodeURIComponent(value));});
}
bindDataControls();
let canonicalRendered=false;
if(location.pathname==='/pbecast'&&new URLSearchParams(location.search).has('tournament')){
 fetch('/graph-snapshot.json').then(r=>r.ok?r.json():null).then(g=>{const html=!canonicalRendered&&g&&productPage('/pbecast',g,new URLSearchParams(location.search).get('tournament')||'');if(html){document.querySelector('main')!.innerHTML=html;bindDataControls();}}).catch(()=>{});
}
if(document.querySelector('[data-freshness]')){
 fetch('/api/v1/graph',{signal:AbortSignal.timeout(6000)}).then(r=>r.ok?r.json():null).then(b=>{const selected=new URLSearchParams(location.search).get('tournament')||'';if(b?.data?.as_of){canonicalRendered=true;if(document.querySelector('[data-asof]')?.getAttribute('data-asof')!==b.data.as_of||(selected&&document.querySelector<HTMLSelectElement>('[data-cast-select]')?.value!==selected)){const html=productPage(location.pathname,b.data,selected);if(html){document.querySelector('main')!.innerHTML=html;bindDataControls();}}}const status=document.querySelector('[data-freshness]');if(status)status.textContent=b?(b.stale?'Stale capture · refresh pending':'Canonical metadata connected'):'Saved capture · API unavailable';}).catch(()=>{const status=document.querySelector('[data-freshness]');if(status)status.textContent='Saved capture · API unavailable';});
}
if(location.pathname==='/all-access'){
 const status=document.createElement('p');status.className='membership-live';status.setAttribute('role','status');status.textContent='Checking network membership…';document.querySelector('.entitlement-status')?.append(status);
 const badge=document.querySelector('.entitlement-status>.state'),heading=document.querySelector('.entitlement-status h2');
 fetch('/api/v1/membership',{credentials:'same-origin',signal:AbortSignal.timeout(6000)}).then(r=>r.ok?r.json():null).then(b=>{if(!b?.membership)throw Error('membership_unavailable');const entitled=b.membership.entitled===true;if(badge)badge.textContent=entitled?'ALL ACCESS VERIFIED':'FREE READER';if(heading)heading.textContent=entitled?'All Access is active.':'Golf is open to explore.';status.textContent=entitled?'Network All Access verified. Statistical intelligence is unavailable until comparable samples are captured.':'Free reader. Sign in or manage your existing All Access membership at PropBetEdge.';}).catch(()=>{if(badge)badge.textContent='VERIFICATION UNAVAILABLE';status.textContent='Membership verification unavailable. Premium access remains locked.';});
}

