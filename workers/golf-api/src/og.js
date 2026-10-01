// Route-specific Open Graph / X cards (1200x630 PNG), rendered once per distinct card and cached in R2.
import {initWasm,Resvg} from '@resvg/resvg-wasm';
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm';
import serif from '../fonts/PlayfairDisplay-Bold.ttf';
import sans from '../fonts/Inter-Medium.ttf';
import sansBold from '../fonts/Inter-ExtraBold.ttf';
import {CARD_VERSION,playerCard,courseCard,tournamentCard,matchupCard,newsCard,siteCard,logoCard} from './og-cards.js';
let ready=null;const init=()=>ready||(ready=initWasm(resvgWasm));
const doc=async(env,k)=>{const o=await env.PUBLIC.get(k);return o?JSON.parse(await o.text()):null;};
// Photos are embedded from approved JPEG derivatives; a missing JPEG simply means branded art.
async function photo(env,p){if(!p?.sha256||!p.derivatives&&!p.licence)return null;const o=await env.PUBLIC.get(`media/${p.sha256}/640.jpg`);if(!o)return null;const b=new Uint8Array(await o.arrayBuffer());let s='';for(let i=0;i<b.length;i+=0x8000)s+=String.fromCharCode(...b.subarray(i,i+0x8000));return 'data:image/jpeg;base64,'+btoa(s);}
const toPar=v=>v===null||v===undefined?'':v===0?'E':v>0?'+'+v:'−'+Math.abs(v);
const fmt=d=>d?new Date(d+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}):'';
async function svgFor(env,kind,slug){
 if(kind==='site')return slug==='logo'?{svg:logoCard(),w:600}:{svg:siteCard()};
 if(kind==='player'){const d=await doc(env,'projection/v2/players/'+slug+'.json');if(!d)return null;return {svg:playerCard({name:d.name,country:d.country,tour:d.division==='women'?'Women’s golf':'Men’s golf',wins:d.summary?.wins_observed??null,majors:d.summary?.major_wins??null,events:d.summary?.events_observed??null},await photo(env,d.photo))};}
 if(kind==='course'){const d=await doc(env,'projection/v2/courses/'+slug+'.json');if(!d)return null;return {svg:courseCard({name:d.name,locality:[d.locality,d.country].filter(Boolean).join(', '),hosted:d.editions?.length||null},await photo(env,d.photo))};}
 if(kind==='tournament'){const d=await doc(env,'projection/v2/editions/'+slug+'.json');if(!d)return null;const c=d.course?.slug?await doc(env,'projection/v2/courses/'+d.course.slug+'.json'):null;const w=(d.leaderboard||[]).find(r=>r.winner);
  const tour=d.espn?.tour_label||d.tours?.[0]||(d.is_major?'Major championship':'Golf');
  return {svg:tournamentCard({name:d.name,kicker:`${tour} · ${d.status==='completed'?'Final':d.status==='in_progress'?'This week':fmt(d.starts_on)}`,subtitle:w?.player?`Champion: ${w.player.name}${Number.isInteger(w.to_par)?' · '+toPar(w.to_par):''}`:[d.course?.name,d.starts_on&&d.ends_on?`${fmt(d.starts_on)} – ${fmt(d.ends_on)}`:null].filter(Boolean).join(' · ')},await photo(env,c?.photo))};}
 if(kind==='matchup'){const [a,b]=slug.split('--');if(!a||!b)return null;const [da,db]=await Promise.all([doc(env,'projection/v2/players/'+a+'.json'),doc(env,'projection/v2/players/'+b+'.json')]);if(!da||!db)return null;return {svg:matchupCard({a:da.name,b:db.name},await photo(env,da.photo),await photo(env,db.photo))};}
 if(kind==='news'){const a=await doc(env,'news/v2/articles/'+slug+'.json');if(!a||a.status!=='published')return null;return {svg:newsCard({headline:a.seo?.social||a.headline_text,category:a.category,meta:[fmt(a.published_at?.slice(0,10)),a.context?.tour].filter(Boolean).join(' · ')},await photo(env,a.hero?.photo?{...a.hero.photo,derivatives:true}:null))};}
 if(kind==='majors'){const ix=await doc(env,'projection/v2/index.json');const s=ix?.series?.find(x=>x.key===slug);if(!s)return null;return {svg:tournamentCard({name:s.name,kicker:'Major championship history',subtitle:`${s.editions} editions in our record${s.first_year?' · since '+s.first_year:''}`},null)};}
 return null;
}
export async function ogImage(env,kind,slug){
 if(!/^(site|player|course|tournament|matchup|news|majors)$/.test(kind)||!/^[a-z0-9-]+$/.test(slug))return new Response('Not found',{status:404});
 const card=await svgFor(env,kind,slug);
 if(!card)return new Response('Not found',{status:404,headers:{'cache-control':'public, max-age=300'}});
 const h=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(CARD_VERSION+card.svg)))].slice(0,12).map(b=>b.toString(16).padStart(2,'0')).join('');
 const key=`og/v1/${kind}/${slug}-${h}.png`;let png=await env.PUBLIC.get(key).then(o=>o?o.arrayBuffer():null);
 if(!png){await init();const r=new Resvg(card.svg,{font:{fontBuffers:[new Uint8Array(serif),new Uint8Array(sans),new Uint8Array(sansBold)],loadSystemFonts:false,defaultFontFamily:'Inter'},fitTo:{mode:'width',value:card.w||1200}});png=r.render().asPng();r.free?.();await env.PUBLIC.put(key,png,{httpMetadata:{contentType:'image/png',cacheControl:'public, max-age=86400'}});}
 return new Response(png,{headers:{'content-type':'image/png','cache-control':'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800','x-content-type-options':'nosniff'}});
}
