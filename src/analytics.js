export const GA_ID='G-BRS48R8PG9';
export function initAnalytics(win=window,doc=document){
 if(win.location.hostname!=='golf.propbetedge.ai'||win.navigator.doNotTrack==='1')return false;
 win.dataLayer=win.dataLayer||[];win.gtag=win.gtag||function(){win.dataLayer.push(arguments);};
 win.gtag('js',new Date());win.gtag('set',{pbe_surface:'golf'});win.gtag('config',GA_ID,{cookie_domain:'.propbetedge.ai',cookie_flags:'SameSite=Lax;Secure'});
 const tag=doc.createElement('script');tag.async=true;tag.src='https://www.googletagmanager.com/gtag/js?id='+GA_ID;tag.dataset.pbeGa4=GA_ID;tag.crossOrigin='anonymous';doc.head.append(tag);return true;
}
// Observational product events on the single network GA4 instance. Allowlisted names and parameters;
// values must be slug/ID-shaped, so names, emails, tokens, query text or locations cannot be sent.
export const EVENTS=new Set(['golf_page_view','news_article_view','news_internal_link_click','player_view','course_view','tournament_view','matchup_view','pbecast_view','dna_view','bag_dna_view','weather_view','share_click','video_impression','video_play','video_watch_on_youtube','article_player_click','article_course_click','article_tournament_click','article_pbecast_click','article_related_story_click']);
export const PARAMS=new Set(['surface','page_type','article_type','entity_type','entity_id','video_provider','video_id','video_type','source_channel','internal_destination_type','share_method']);
const SAFE=/^[a-z0-9][a-z0-9_.:-]{0,99}$/;
export function sanitize(params={}){const out={surface:'golf'};for(const [k,v] of Object.entries(params)){if(!PARAMS.has(k))continue;const s=String(v??'').toLowerCase();if(SAFE.test(s))out[k]=s;}return out;}
export function track(name,params={},win=typeof window!=='undefined'?window:null){
 if(!EVENTS.has(name)||!win||typeof win.gtag!=='function')return false;
 win.gtag('event',name,sanitize(params));return true;
}
// Page-type classification from the canonical path (no query strings).
export function pageType(path){const [,a]=path.split('/');return {'':'home',player:'player',course:'course',tournament:'tournament',matchups:'matchup',pbecast:'pbecast',news:'news',players:'directory',courses:'directory',tournaments:'directory',majors:'majors',today:'today',live:'live',search:'search','all-access':'membership'}[a]??'other';}
const DEST={player:'player',course:'course',tournament:'tournament',matchups:'matchup',pbecast:'pbecast',news:'news','all-access':'membership',majors:'majors'};
export function destination(href){try{const u=new URL(href,'https://golf.propbetedge.ai');if(u.hostname!=='golf.propbetedge.ai')return null;const [,a,b]=u.pathname.split('/');return DEST[a]?{type:DEST[a],id:b||null}:null;}catch{return null;}}
