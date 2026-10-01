// Local newsroom dry run against the exported projection bundle. In-memory R2/KV; no network, no model.
// Usage: node scripts/news-dry.mjs [--today=YYYY-MM-DD] [--editions=slug,...] [--types=final,...] [--out=dir]
import fs from 'node:fs/promises';
import {run} from '../workers/golf-news/src/index.js';
const arg=k=>process.argv.find(a=>a.startsWith('--'+k+'='))?.split('=')[1];
const b=JSON.parse(await fs.readFile('data/public/bundle.json','utf8'));
const mem=()=>{const m=new Map();return {m,async get(k){return m.has(k)?{text:async()=>m.get(k)}:null;},async put(k,v){m.set(k,typeof v==='string'?v:JSON.stringify(v));},async list({prefix}){return {objects:[...m.keys()].filter(k=>k.startsWith(prefix)).map(key=>({key}))};},async delete(k){m.delete(k);}};};
const PUBLIC=mem();PUBLIC.m.set('projection/v2/index.json',JSON.stringify(b.index));
for(const [kind,list] of [['players',b.players],['editions',b.editions],['courses',b.courses]])for(const d of list)PUBLIC.m.set(`projection/v2/${kind}/${d.slug}.json`,JSON.stringify(d));
const kv=mem();const STATE={async get(k,o){const v=kv.m.get(k);return v===undefined?null:o?.type==='json'?JSON.parse(v):v;},async put(k,v){kv.m.set(k,v);},async delete(k){kv.m.delete(k);}};
const PRIVATE=mem();
const env={PUBLIC,PRIVATE,STATE,NEWS_CANARY_TYPES:''};
const r=await run(env,{mode:arg('mode')||'shadow',today:arg('today'),editions:(arg('editions')||'').split(',').filter(Boolean),types:arg('types')?arg('types').split(','):null,force:true});
const out=arg('out')||'D:/Temp/claude/golf/news-dry';await fs.mkdir(out,{recursive:true});
for(const [k,v] of PRIVATE.m)if(k.startsWith('news/v2/shadow/'))await fs.writeFile(out+'/'+k.split('/').pop(),v);
console.log(JSON.stringify({...r,stories:r.stories?.map(s=>({topic:s.topic,slug:s.slug,status:s.status,m:s.materiality?.score??s.materiality,hold:s.hold}))},null,1));
