import fs from 'node:fs/promises';
import {route,shell,escapeHtml} from '../src/lib/render.js';
import {documentHtml} from '../src/lib/seo.js';
import {publicPlayer,publicCourse,publicEdition,matchupPublic} from '../workers/shared/views.js';
const SITE='https://golf.propbetedge.ai';
const b=JSON.parse(await fs.readFile('data/public/bundle.json','utf8'));
const players=new Map(b.players.map(d=>[d.slug,publicPlayer(d)])),editions=new Map(b.editions.map(d=>[d.slug,publicEdition(d)])),courses=new Map(b.courses.map(d=>[d.slug,publicCourse(d)]));
const raw=new Map(b.players.map(d=>[d.slug,d]));
const data={index:b.index,players,editions,courses,stories:b.stories||[]};
const template=await fs.readFile('dist/index.html','utf8');
const pages=['/','/today','/live','/tournaments','/players','/courses','/majors','/matchups','/pbecast','/news','/intelligence','/rankings','/search','/all-access',...b.index.series.filter(s=>s.editions).map(s=>'/majors/'+s.key),...[...editions.keys()].map(s=>'/tournament/'+s),...[...players.keys()].map(s=>'/player/'+s),...[...courses.keys()].map(s=>'/course/'+s)];
const matchups=(b.index.featured_matchups||[]).map(m=>['/matchups/'+m.a.slug+'/'+m.b.slug,matchupPublic(raw.get(m.a.slug),raw.get(m.b.slug))]).filter(([,m])=>m);
const sitemap=[];
async function write(path,r){
 r.fullTitle||=r.title+' | PropBetEdge Golf';
 const page=documentHtml(template,path,r,shell(path,r.main,b.index));
 const file=path==='/'?'dist/index.html':path==='/404'?'dist/404.html':'dist'+path+'.html';
 await fs.mkdir(file.slice(0,file.lastIndexOf('/')),{recursive:true});await fs.writeFile(file,page);
 if(r.indexable&&path!=='/404')sitemap.push({path,lastmod:r.lastmod||null});
}
// Real source dates only for lastmod: an edition's final round, or a player's/course's latest edition.
const lastmodOf=p=>{const [,k,id]=p.split('/');if(k==='tournament')return editions.get(id)?.ends_on||null;if(k==='player'){const d=raw.get(id);return d?.results?.[0]?.edition?.ends_on||null;}if(k==='course'){const c=courses.get(id);return (c?.editions||[]).map(x=>x.ends_on).filter(Boolean).sort().at(-1)||null;}return null;};
for(const p of pages){if(p==='/news')continue;const r=route(p,data);r.lastmod=lastmodOf(p);await write(p,r);}
for(const [p,m] of matchups)await write(p,route(p,{...data,matchup:m}));
// Client-rendered views for any non-prerendered pair and for PBEcast selections.
await write('/matchup-view',{...route('/matchups',data),indexable:false});
await write('/404',route('/404',data));
// Media credits: every approved image with author, licence and source.
const credits=(b.index.media_credits||[]).filter(m=>m.derivatives);
await write('/media-credits',{main:`<section class="page-heading data-heading"><div><p class="eyebrow">CREDITS</p><h1>Photograph credits</h1><p>Every player and course photograph, with author, licence and source. Images are resized only.</p></div></section><div class="page-body data-body"><div class="table-wrap" tabindex="0" role="region" aria-label="Scrollable table"><table class="index-table"><thead><tr><th scope="col">Subject</th><th scope="col">Author</th><th scope="col">Licence</th><th scope="col">Source</th></tr></thead><tbody>${credits.map(m=>`<tr><td><a href="${escapeHtml(m.entity)}">${escapeHtml(m.name)}</a></td><td>${escapeHtml(m.author)}</td><td><a href="${escapeHtml(m.licence_url)}" rel="license">${escapeHtml(m.licence)}</a></td><td><a href="${escapeHtml(m.source_url)}">Wikimedia Commons</a></td></tr>`).join('')}</tbody></table></div></div>`,title:'Photograph credits',description:'Author, licence and source for every photograph.',indexable:false,schema:[]});
await fs.writeFile('dist/_shell.html',template);
await fs.writeFile('dist/robots.txt',`User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /matchup-view\nDisallow: /_shell\nSitemap: ${SITE}/sitemap.xml\nSitemap: ${SITE}/news-sitemap.xml\n`);
// Sitemap index: static children by entity type; news children are served live by golf-api.
const groups={pages:[],players:[],tournaments:[],courses:[],matchups:[],majors:[]};
for(const x of sitemap){const k=x.path.split('/')[1];const g=k==='player'?'players':k==='tournament'?'tournaments':k==='course'?'courses':k==='matchups'&&x.path.split('/').length>3?'matchups':k==='majors'?'majors':'pages';groups[g].push(x);}
const urlset=xs=>`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${xs.map(x=>`<url><loc>${SITE}${x.path}</loc>${x.lastmod?`<lastmod>${x.lastmod}</lastmod>`:''}</url>`).join('')}</urlset>\n`;
await fs.mkdir('dist/sitemaps',{recursive:true});
for(const [g,xs] of Object.entries(groups))if(xs.length)await fs.writeFile(`dist/sitemaps/${g}.xml`,urlset(xs));
const children=[...Object.entries(groups).filter(([,xs])=>xs.length).map(([g])=>`${SITE}/sitemaps/${g}.xml`),`${SITE}/sitemaps/news.xml`];
await fs.writeFile('dist/sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${children.map(u=>`<sitemap><loc>${u}</loc></sitemap>`).join('')}</sitemapindex>\n`);
await fs.writeFile('dist/index-snapshot.json',JSON.stringify(b.index));
console.log(`Prerendered ${pages.length+matchups.length+3} pages; ${sitemap.length} indexable in sitemap.`);
