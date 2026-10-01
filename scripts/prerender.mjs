import fs from 'node:fs/promises';
import {route,shell,escapeHtml} from '../src/lib/render.js';
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
 const title=path==='/'?'Golf Intelligence | PropBetEdge':r.title+' | PropBetEdge Golf';
 const og=r.og||SITE+'/media/golf-sunrise-1280.webp';
 const head=`<link rel="canonical" href="${SITE}${path==='/404'?'/':path}"><meta name="robots" content="${r.indexable?'index,follow':'noindex,follow'}"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(r.description)}"><meta property="og:type" content="website"><meta property="og:url" content="${SITE}${path}"><meta property="og:image" content="${og}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:site" content="@PROPBETEDGE">${(r.schema||[]).map(s=>'<script type="application/ld+json">'+JSON.stringify(s).replace(/</g,'\u003c')+'</script>').join('')}`;
 const page=template.replace('<!--shell-->',shell(path,r.main)).replace(/<title>.*?<\/title>/,`<title>${escapeHtml(title)}</title>`).replace(/<meta name="description"[^>]*>/,`<meta name="description" content="${escapeHtml(r.description)}">`).replace(/<meta name="robots"[^>]*>/,'').replace('</head>',head+'</head>');
 const file=path==='/'?'dist/index.html':path==='/404'?'dist/404.html':'dist'+path+'.html';
 await fs.mkdir(file.slice(0,file.lastIndexOf('/')),{recursive:true});await fs.writeFile(file,page);
 if(r.indexable&&path!=='/404')sitemap.push(path);
}
for(const p of pages){const r=route(p,data);const photo=p.startsWith('/player/')?players.get(p.split('/')[2])?.photo:p.startsWith('/course/')?courses.get(p.split('/')[2])?.photo:null;if(photo?.derivatives)r.og=`${SITE}/api/v1/media/${photo.sha256}/640.webp`;await write(p,r);}
for(const [p,m] of matchups)await write(p,route(p,{...data,matchup:m}));
// Client-rendered views for any non-prerendered pair and for PBEcast selections.
await write('/matchup-view',{...route('/matchups',data),indexable:false});
await write('/404',route('/404',data));
// Media credits: every approved image with author, licence and source.
const credits=(b.index.media_credits||[]).filter(m=>m.derivatives);
await write('/media-credits',{main:`<section class="page-heading data-heading"><div><p class="eyebrow">CREDITS</p><h1>Photograph credits</h1><p>Every player and course photograph, with author, licence and source. Images are resized only.</p></div></section><div class="page-body data-body"><div class="table-wrap" tabindex="0" role="region" aria-label="Scrollable table"><table class="index-table"><thead><tr><th scope="col">Subject</th><th scope="col">Author</th><th scope="col">Licence</th><th scope="col">Source</th></tr></thead><tbody>${credits.map(m=>`<tr><td><a href="${escapeHtml(m.entity)}">${escapeHtml(m.name)}</a></td><td>${escapeHtml(m.author)}</td><td><a href="${escapeHtml(m.licence_url)}" rel="license">${escapeHtml(m.licence)}</a></td><td><a href="${escapeHtml(m.source_url)}">Wikimedia Commons</a></td></tr>`).join('')}</tbody></table></div></div>`,title:'Photograph credits',description:'Author, licence and source for every photograph.',indexable:false,schema:[]});
await fs.writeFile('dist/robots.txt',`User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /matchup-view\nSitemap: ${SITE}/sitemap.xml\n`);
await fs.writeFile('dist/sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemap.map(p=>`<url><loc>${SITE}${p}</loc></url>`).join('')}</urlset>\n`);
await fs.writeFile('dist/index-snapshot.json',JSON.stringify(b.index));
console.log(`Prerendered ${pages.length+matchups.length+3} pages; ${sitemap.length} indexable in sitemap.`);
