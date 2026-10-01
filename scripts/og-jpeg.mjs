// JPEG copies of already-approved photo derivatives for the social-card renderer (resvg cannot decode WebP).
// Same image, format change only; uploaded through the admin derivative route.
import fs from 'node:fs/promises';import sharp from 'sharp';
const TOKEN=(await fs.readFile('D:/Workers/secrets/golf-admin-token','utf8')).trim(),API='https://golf-api.propbetedge.ai';
const b=JSON.parse(await fs.readFile('data/public/bundle.json','utf8'));
const shas=new Set();for(const d of [...b.players,...b.courses])if(d.photo?.derivatives&&d.photo.sha256)shas.add(d.photo.sha256);
let done=0,skip=0,fail=0;const list=[...shas];
for(const sha of list){
 const key=`media/${sha}/640.jpg`;
 const head=await fetch(`${API}/v1/media/${sha}/640.jpg`).catch(()=>null);if(head?.ok){skip++;continue;}
 const src=await fetch(`${API}/v1/media/${sha}/640.webp`);if(!src.ok){fail++;continue;}
 const jpg=await sharp(Buffer.from(await src.arrayBuffer())).jpeg({quality:84,mozjpeg:true}).toBuffer();
 const r=await fetch(`${API}/admin/media-derivative?key=${encodeURIComponent(key)}`,{method:'POST',headers:{authorization:'Bearer '+TOKEN,'content-type':'image/jpeg'},body:jpg});
 if(r.ok)done++;else{fail++;console.error(sha,r.status,(await r.text()).slice(0,120));}
}
console.log(JSON.stringify({photos:list.length,uploaded:done,existing:skip,failed:fail}));
