import fs from 'node:fs/promises';
import { render, escapeHtml } from '../src/lib/render.js';
import { routes, majors, routeFor } from '../src/lib/catalog.js';
const template = await fs.readFile('dist/index.html','utf8');
for(const path of [...routes.map(r=>r.path),...majors.map(m=>'/majors/'+m[2]),'/404']){
 const route=routeFor(path), title=route.label==='Home'?'Golf Intelligence | PropBetEdge':route.label+' | PropBetEdge Golf';
 const page=template.replace('<!--shell-->',render(path)).replace(/<title>.*?<\/title>/,`<title>${escapeHtml(title)}</title>`).replace(/<meta name="description"[^>]*>/,`<meta name="description" content="${escapeHtml(route.description)}">`).replace('</head>',`<link rel="canonical" href="https://golf.propbetedge.ai${path==='/404'?'/':path}"></head>`);
 const file=path==='/'?'dist/index.html':path==='/404'?'dist/404.html':'dist'+path+'.html';
 await fs.mkdir(file.slice(0,file.lastIndexOf('/')),{recursive:true}); await fs.writeFile(file,page);
}
await fs.writeFile('dist/robots.txt','User-agent: *\nDisallow: /\n');
console.log('Prerendered 22 discovery / championship routes; foundation is noindex.');

