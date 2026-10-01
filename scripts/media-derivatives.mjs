// Ops job: resize-only AVIF/WebP derivatives for rights-approved Commons images.
// Bytes are re-fetched from the archived thumbnail URL and must hash to the archived SHA-256.
import fs from 'node:fs/promises';import crypto from 'node:crypto';import sharp from 'sharp';
import {store} from '../workers/shared/store.js';import {sportsEnv} from './ops.mjs';
const API='https://golf-api.propbetedge.ai',token=(await fs.readFile('D:/Workers/secrets/golf-admin-token','utf8')).trim();
const UA='PropBetEdgeGolfIngest/0.2 (+https://golf.propbetedge.ai; data@propbetedge.ai)';
const db=store(await sportsEnv());const rows=[];for(let o=0;;o+=1000){const p=await db('golf_entity_media',`select=sha256,thumb:identity_proof->>thumb_url,width&rights_status=eq.approved&order=sha256&limit=1000&offset=${o}`);rows.push(...p);if(p.length<1000)break;}
const out={candidates:rows.length,done:0,skipped:0,mismatch:0,failed:0};
for(const r of rows){
 const head=await fetch(`${API}/v1/media/${r.sha256}/640.webp`,{method:'HEAD'});if(head.ok){out.skipped++;continue;}
 try{
  await new Promise(x=>setTimeout(x,1100));
  const res=await fetch(r.thumb,{headers:{'user-agent':UA},redirect:'error'});if(!res.ok)throw Error('http '+res.status);
  const buf=Buffer.from(await res.arrayBuffer());if(crypto.createHash('sha256').update(buf).digest('hex')!==r.sha256){out.mismatch++;continue;}
  const meta=await sharp(buf).metadata();
  for(const w of [160,320,640,960])for(const fmt of ['webp','avif']){
   const img=sharp(buf).rotate().resize({width:Math.min(w,meta.width||w),withoutEnlargement:true});
   const data=await (fmt==='webp'?img.webp({quality:80}):img.avif({quality:55})).toBuffer();
   const up=await fetch(`${API}/admin/media-derivative?key=media/${r.sha256}/${w}.${fmt}`,{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/octet-stream'},body:data});
   if(!up.ok)throw Error('upload '+up.status+' '+(await up.text()).slice(0,100));
  }
  out.done++;
 }catch(e){out.failed++;console.error(r.sha256.slice(0,12),e.message);}
}
console.log(JSON.stringify(out));
