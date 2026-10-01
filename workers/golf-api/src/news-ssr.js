// Server-rendered newsroom (articles appear and update without a site rebuild), RSS and news sitemaps.
import {route,shell} from '../../../src/lib/render.js';
import {documentHtml,SITE} from '../../../src/lib/seo.js';
import {relatedStories} from '../../../src/lib/article.js';
const HTML_CACHE='public, max-age=60, s-maxage=300, stale-while-revalidate=600';
const xmlEsc=s=>String(s??'').replace(/[<>&'"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[c]));
let shellMemo={at:0,html:null};
// The built page template (hashed asset URLs) from the current frontend deployment.
async function template(env){
 if(shellMemo.html&&Date.now()-shellMemo.at<300000)return shellMemo.html;
 const r=await fetch((env.SITE_ORIGIN||SITE)+'/_shell',{headers:{'user-agent':'PropBetEdgeGolfSSR/1'},cf:{cacheTtl:300}});
 if(!r.ok)throw Error('template_unavailable_'+r.status);const html=await r.text();if(!html.includes('<!--shell-->'))throw Error('template_invalid');
 shellMemo={at:Date.now(),html};return html;
}
const getJ=async(env,k)=>{const o=await env.PUBLIC.get(k);return o?JSON.parse(await o.text()):null;};
export const newsIndex=env=>getJ(env,'news/v2/index.json').then(x=>x||[]);
export async function renderNews(env,ix,path){
 const [,,slug]=path.split('/');const index=await newsIndex(env);
 let data={index:ix,news:{index},stories:await getJ(env,'news/v1/index.json')||[]},status=200;
 if(slug){const art=await getJ(env,'news/v2/articles/'+slug+'.json');if(!art||art.status!=='published'){status=404;}else data={...data,article:art,related:relatedStories(index,art)};}
 const r=route(path,data);if(r.title==='Not found')status=404;
 const html=documentHtml(await template(env),path,r,shell(path,r.main,ix));
 return new Response(html,{status,headers:{'content-type':'text/html; charset=utf-8','cache-control':status===200?HTML_CACHE:'public, max-age=60','x-content-type-options':'nosniff'}});
}
export async function feed(env){
 const index=(await newsIndex(env)).slice(0,50);const arts=await Promise.all(index.map(s=>getJ(env,'news/v2/articles/'+s.slug+'.json')));
 const items=arts.filter(Boolean).map(a=>{const url=`${SITE}/news/${a.slug}`;const body=a.sections.map(s=>`<h2>${xmlEsc(s.heading)}</h2>${s.paragraphs.map(p=>`<p>${xmlEsc(p.map(x=>x.v).join(''))}</p>`).join('')}`).join('');
  const img=a.hero?.photo?.sha256?`${SITE}/api/v1/media/${a.hero.photo.sha256}/960.webp`:`${SITE}/og/news/${a.slug}.png`;
  return `<item><title>${xmlEsc(a.headline_text)}</title><link>${url}</link><guid isPermaLink="true">${url}</guid><pubDate>${new Date(a.published_at).toUTCString()}</pubDate><dc:creator>PropBetEdge Golf Desk</dc:creator><category>${xmlEsc(a.category)}</category><description>${xmlEsc(a.dek_text)}</description><content:encoded><![CDATA[${body.replace(/]]>/g,']]&gt;')}]]></content:encoded><media:content url="${xmlEsc(img)}" medium="image"/></item>`;}).join('');
 const xml=`<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:media="http://search.yahoo.com/mrss/"><channel><title>PropBetEdge Golf</title><link>${SITE}/news</link><atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml"/><description>Golf news where every number traces to a frozen fact.</description><language>en-us</language><ttl>30</ttl>${arts[0]?`<lastBuildDate>${new Date(arts[0].updated_at).toUTCString()}</lastBuildDate>`:''}${items}</channel></rss>\n`;
 return new Response(xml,{headers:{'content-type':'application/rss+xml; charset=utf-8','cache-control':'public, max-age=300, s-maxage=600, stale-while-revalidate=3600'}});
}
// Google News sitemap: only stories first published in the last 48 hours.
export async function newsSitemap(env,now=Date.now()){
 const recent=(await newsIndex(env)).filter(s=>now-Date.parse(s.published_at)<=48*3600000).slice(0,1000);
 const xml=`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">${recent.map(s=>`<url><loc>${SITE}/news/${s.slug}</loc><news:news><news:publication><news:name>PropBetEdge Golf</news:name><news:language>en</news:language></news:publication><news:publication_date>${s.published_at}</news:publication_date><news:title>${xmlEsc(s.headline)}</news:title></news:news></url>`).join('')}</urlset>\n`;
 return new Response(xml,{headers:{'content-type':'application/xml; charset=utf-8','cache-control':'public, max-age=300, s-maxage=300'}});
}
// Every published story (historical stories stay here after leaving the news sitemap).
export async function newsUrlset(env){
 const all=await newsIndex(env);
 const xml=`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${SITE}/news</loc>${all[0]?`<lastmod>${all[0].updated_at||all[0].published_at}</lastmod>`:''}</url>${all.map(s=>`<url><loc>${SITE}/news/${s.slug}</loc><lastmod>${s.updated_at||s.published_at}</lastmod></url>`).join('')}</urlset>\n`;
 return new Response(xml,{headers:{'content-type':'application/xml; charset=utf-8','cache-control':'public, max-age=600, s-maxage=600'}});
}
