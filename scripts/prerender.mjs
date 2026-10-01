import fs from 'node:fs/promises';
import { render, escapeHtml } from '../src/lib/render.js';
import { routes, majors, routeFor } from '../src/lib/catalog.js';
import {entityRoute} from '../src/lib/product.js';
let graph=null;try{graph=JSON.parse(await fs.readFile('data/public/graph.json','utf8'));}catch{}
const entityPaths=graph?[...graph.players.map(p=>'/player/'+p.slug),...graph.courses.map(c=>'/course/'+c.slug),...graph.tournaments.map(t=>'/tournament/'+t.slug)]:[];
const template = await fs.readFile('dist/index.html','utf8');
for(const path of [...routes.map(r=>r.path),...majors.map(m=>'/majors/'+m[2]),...entityPaths,'/404']){
 const route=entityRoute(path,graph)||routeFor(path), title=route.label==='Home'?'Golf Intelligence | PropBetEdge':route.label+' | PropBetEdge Golf';
 let entitySchema='';if(route.entity){const r=route.entity,canonical='https://golf.propbetedge.ai'+path;const schema={'@context':'https://schema.org','@id':canonical+'#entity',url:canonical,name:r.full_name||r.name};
  if(route.kind==='player')Object.assign(schema,{'@type':'Person',birthDate:r.birth_date});
  if(route.kind==='course')Object.assign(schema,{'@type':'Place',...(r.locality?{address:{'@type':'PostalAddress',addressLocality:r.locality}}:{})});
  if(route.kind==='tournament')Object.assign(schema,{'@type':'SportsEvent',sport:'Golf',...(r.starts_on?{startDate:r.starts_on}:{}),...(r.ends_on?{endDate:r.ends_on}:{}),...(r.course?{location:{'@type':'Place',name:r.course.name,url:'https://golf.propbetedge.ai/course/'+r.course.slug}}:{})});
  entitySchema='<script type="application/ld+json">'+JSON.stringify(schema).replace(/</g,'\\u003c')+'</script>';
 }
 const page=template.replace('<!--shell-->',render(path,graph)).replace(/<title>.*?<\/title>/,`<title>${escapeHtml(title)}</title>`).replace(/<meta name="description"[^>]*>/,`<meta name="description" content="${escapeHtml(route.description)}">`).replace('</head>',`<link rel="canonical" href="https://golf.propbetedge.ai${path==='/404'?'/':path}"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:type" content="website"><meta property="og:url" content="https://golf.propbetedge.ai${path}"><meta property="og:image" content="https://golf.propbetedge.ai/media/golf-sunrise-1280.webp"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:site" content="@PROPBETEDGE">${entitySchema}</head>`);
 const file=path==='/'?'dist/index.html':path==='/404'?'dist/404.html':'dist'+path+'.html';
 await fs.mkdir(file.slice(0,file.lastIndexOf('/')),{recursive:true}); await fs.writeFile(file,page);
}
if(graph){await fs.writeFile('dist/graph-snapshot.json',JSON.stringify(graph));}
await fs.writeFile('dist/robots.txt','User-agent: *\nDisallow: /\n');
console.log(`Prerendered discovery and ${entityPaths.length} canonical entity pages. Incomplete metadata pages remain noindex.`);

