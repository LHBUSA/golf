import fs from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {store,upsert} from '../workers/shared/store.js';
const root=process.cwd();
export async function sportsEnv(){
 const text=await fs.readFile('D:/Workers/secrets/soccer-supabase.env','utf8');
 const vars=Object.fromEntries(text.split(/\r?\n/).filter(x=>/^[A-Z_]+=/.test(x)).map(x=>{const i=x.indexOf('=');return [x.slice(0,i),x.slice(i+1).replace(/^['"]|['"]$/g,'')]}));
 const env={SPORTS_URL:vars.SOCCER_MODEL_SUPABASE_URL,SPORTS_KEY:vars.SOCCER_MODEL_SUPABASE_SERVICE_ROLE_KEY};
 if(env.SPORTS_URL!=='https://tkmlnhmylqnttmnsnief.supabase.co'||!env.SPORTS_KEY)throw Error('SPORTS target guard');
 return env;
}
export async function cf(path,options={}){
 const t=await fs.readFile('C:/Users/goodl/.wrangler/config/default.toml','utf8');
 const token=t.match(/oauth_token\s*=\s*"([^"]+)"/)?.[1];if(!token)throw Error('Cloudflare authentication missing');
 const r=await fetch('https://api.cloudflare.com/client/v4/'+path,{...options,headers:{authorization:'Bearer '+token,'content-type':'application/json',...options.headers},signal:AbortSignal.timeout(30000)});
 const b=await r.json();if(!b.success)throw Error(JSON.stringify(b.errors));return b.result;
}
export const account='fd3a233edadd0a60916413c1199f71ee';
if(process.argv[2]==='inspect'){
 const [scripts,buckets,zones]=await Promise.all([cf(`accounts/${account}/workers/scripts`),cf(`accounts/${account}/r2/buckets`),cf('zones?name=propbetedge.ai')]);
 console.log(JSON.stringify({workers:scripts.filter(x=>/golf|auth-magic/.test(x.id)).map(x=>({id:x.id,modified_on:x.modified_on})),buckets,zones:zones.map(x=>({id:x.id,name:x.name}))},null,2));
}
if(process.argv[2]==='secrets'){
 const env=await sportsEnv();
 try{env.ADMIN_TOKEN=await fs.readFile('.golf-admin-token','utf8');}catch{env.ADMIN_TOKEN=crypto.randomUUID()+crypto.randomUUID();await fs.writeFile('.golf-admin-token',env.ADMIN_TOKEN);}
 await fs.writeFile('.golf-secrets.json',JSON.stringify(env));
 try{for(const name of ['golf-api','golf-ingest','golf-news']){const r=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','secret','bulk','.golf-secrets.json','--config',`workers/${name}/wrangler.jsonc`],{stdio:'inherit',cwd:root});if(r.status!==0)throw Error('secret configuration failed');}}finally{await fs.unlink('.golf-secrets.json');}
}
if(process.argv[2]==='seed'){
 const db=store(await sportsEnv());
 await upsert(db,'golf_sources',[{id:'wikidata',name:'Wikidata structured golf metadata',owner:'Wikimedia Foundation / contributors',verdict:'APPROVED',registry_version:'golf-sources/2',terms_url:'https://www.wikidata.org/wiki/Wikidata:Licensing',automated_access:true,rights_assessment:{licence:'CC0-1.0',scope:'bounded structured identities, venue metadata, edition dates and winner assertions; no Wikipedia prose/media or live feed',redistribution:'CC0 structured data public and commercial reuse; source attribution supplied',cadence:'manual bounded bootstrap; minimum daily automated cadence if later enabled',identity:'QID + human + golf + day-precision DOB; distinct source IDs never name merge',corrections:'new raw capture, new source capture, transactional field revision ledger'},reviewed_at:new Date().toISOString()}]);
 const state=await db('golf_source_state','source_id=eq.wikidata');if(!state.length)await upsert(db,'golf_source_state',[{source_id:'wikidata',parser_version:'wikidata-golf/1.1.0',cadence_seconds:86400}],'source_id');
 console.log('Wikidata metadata registry and durable source state configured in SPORTS');
}
if(['bootstrap','shadow'].includes(process.argv[2])){
 const token=await fs.readFile('.golf-admin-token','utf8');const r=await fetch('https://golf-api.propbetedge.ai/admin/'+(process.argv[2]==='shadow'?'news-shadow':'bootstrap'),{method:'POST',headers:{authorization:'Bearer '+token},signal:AbortSignal.timeout(90000)});console.log(r.status,await r.text());
}
