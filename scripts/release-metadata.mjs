import fs from 'node:fs/promises';
for(const file of ['data/source-registry/sources.json','scripts/ops.mjs','scripts/finalize-source.mjs']){let s=await fs.readFile(file,'utf8');await fs.writeFile(file,s.replaceAll('wikidata-golf/1.0.0','wikidata-golf/1.1.0'));}
const p='src/lib/product.js';let s=await fs.readFile(p,'utf8');await fs.writeFile(p,s.replace('Captured ${e(g.as_of','Graph checked ${e(g.as_of'));
