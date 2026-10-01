// Shared presentation helpers (prerender + browser). No data fetching here.
export const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const arrow='<span aria-hidden="true">↗</span>';
export const a=(href,text,cls='text-link')=>`<a class="${cls}" href="${e(href)}">${e(text)}</a>`;
export const go=(href,text,cls='arrow-link')=>`<a class="${cls}" href="${e(href)}">${e(text)} ${arrow}</a>`;
export const kicker=t=>`<p class="eyebrow">${e(t)}</p>`;
export const toPar=v=>v===null||v===undefined?'—':v===0?'E':v>0?'+'+v:'−'+Math.abs(v);
export const pos=(r)=>r.status==='cut'?'CUT':r.status==='withdrawn'?'WD':r.status==='disqualified'?'DQ':r.position?(r.tied?'T':'')+r.position:'—';
export const fmtDate=d=>{if(!d)return null;const [y,m,dd]=d.split('-').map(Number);return new Date(Date.UTC(y,m-1,dd)).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'});};
export const dates=x=>x.starts_on&&x.ends_on?`${fmtDate(x.starts_on).replace(/, \d{4}$/,'')} – ${fmtDate(x.ends_on)}`:x.ends_on?`Final round ${fmtDate(x.ends_on)}`:String(x.year||'');
export const division=d=>d==='women'?'Women’s golf':d==='men'?'Men’s golf':'Golf';
export const tourLabel=x=>x.tours?.length?x.tours.join(' · '):x.is_major?(x.division==='women'?'Women’s major':'Men’s major'):division(x.division);
export const statusLabel=s=>({completed:'Final',scheduled:'Scheduled',in_progress:'This week · tournament in progress',cancelled:'Cancelled',unknown:'Status unconfirmed'}[s]||s);
export const coverageLabel=c=>({full_field:'Full field · every round',partial_field:'Partial field',made_cut:'Players who made the cut',top_finishers:'Top finishers only',winner_only:'Champion only',schedule_only:'Schedule entry',none:'No leaderboard'}[c]||c);
export const initials=n=>String(n||'').split(/\s+/).filter(Boolean).map(x=>x[0]).slice(0,2).join('').toUpperCase();
const media=(sha,w,f)=>`/api/v1/media/${sha}/${w}.${f}`;
// Real approved photo with attribution, or an original identity treatment. Never a stand-in photo.
export function portrait(p,{size=320,cls='portrait',eager=false,caption=false}={}){
 const ph=p?.photo;
 if(ph?.derivatives){const ws=[160,320,640].filter(w=>w<=Math.max(size*2,160));const ratio=ph.height&&ph.width?ph.height/ph.width:1.25;
  return `<figure class="${cls}"><picture><source type="image/avif" srcset="${ws.map(w=>media(ph.sha256,w,'avif')+' '+w+'w').join(', ')}" sizes="${size}px"><img src="${media(ph.sha256,ws.includes(320)?320:160,'webp')}" srcset="${ws.map(w=>media(ph.sha256,w,'webp')+' '+w+'w').join(', ')}" sizes="${size}px" width="${size}" height="${Math.round(size*ratio)}" alt="${e(p.name)}" ${eager?'fetchpriority="high"':'loading="lazy"'} decoding="async"></picture>${caption&&ph.licence?`<figcaption>Photo: ${e(ph.author)} · <a href="${e(ph.licence_url)}" rel="license">${e(ph.licence)}</a> · <a href="${e(ph.source_url)}">Wikimedia Commons</a></figcaption>`:''}</figure>`;}
 // ESPN headshot (owner-approved ESPN source): hotlinked for the exact player, credited, never rehosted.
 if(p?.headshot&&/^https:\/\/a\.espncdn\.com\/i\/headshots\/golf\/players\/full\/\d+\.png$/.test(p.headshot))return `<figure class="${cls} is-headshot"><img src="${e(p.headshot)}" alt="${e(p.name||'')}" ${eager?'fetchpriority="high"':'loading="lazy"'} width="${size}" height="${Math.round(size*0.73)}" referrerpolicy="no-referrer">${caption?'<figcaption>Photo: ESPN</figcaption>':''}</figure>`;
 return `<div class="${cls} identity-mark" aria-hidden="true"><span>${e(initials(p?.name))}</span>${p?.country_code?`<small>${e(p.country_code)}</small>`:''}</div>`;
}
export function courseImage(c,{cls='course-photo',eager=false,caption=true}={}){
 const ph=c?.photo;if(!ph?.derivatives)return `<div class="${cls} course-mark" aria-hidden="true"><span>${e(initials(c?.name))}</span></div>`;
 return `<figure class="${cls}"><picture><source type="image/avif" srcset="${[320,640,960].map(w=>media(ph.sha256,w,'avif')+' '+w+'w').join(', ')}" sizes="(max-width:700px) 100vw, 960px"><img src="${media(ph.sha256,640,'webp')}" srcset="${[320,640,960].map(w=>media(ph.sha256,w,'webp')+' '+w+'w').join(', ')}" sizes="(max-width:700px) 100vw, 960px" width="960" height="${Math.round(960*(ph.height/ph.width||0.6))}" alt="${e(c.name)}" ${eager?'fetchpriority="high"':'loading="lazy"'} decoding="async"></picture>${caption?`<figcaption>${e(c.name)} · Photo: ${e(ph.author)} · <a href="${e(ph.licence_url)}" rel="license">${e(ph.licence)}</a> · <a href="${e(ph.source_url)}">Wikimedia Commons</a></figcaption>`:''}</figure>`;
}
export const pill=(t,tone='')=>`<span class="pill ${tone}">${e(t)}</span>`;
export const conf=c=>`<span class="conf conf-${String(c||'').toLowerCase()}">${e(c==='INSUFFICIENT'?'Insufficient sample':c?c[0]+c.slice(1).toLowerCase()+' confidence':'')}</span>`;
export const heading=(eyebrow,title,lede,extra='')=>`<section class="page-heading data-heading"><div>${kicker(eyebrow)}<h1>${e(title)}</h1>${lede?`<p>${e(lede)}</p>`:''}${extra}</div></section>`;
export const section=(eyebrow,title,body,{id='',cls=''}={})=>`<section class="data-section ${cls}"${id?` id="${id}"`:''}>${eyebrow?kicker(eyebrow):''}${title?`<h2>${e(title)}</h2>`:''}${body}</section>`;
export const stat=(label,value,note='')=>`<div class="stat"><span class="stat-value">${e(value??'—')}</span><span class="stat-label">${e(label)}</span>${note?`<span class="stat-note">${e(note)}</span>`:''}</div>`;
