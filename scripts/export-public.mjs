// Downloads the published projection (built by golf-ingest from SPORTS) for the static build.
// Public documents only; premium splits are applied again at render time by shared/views.js.
import fs from 'node:fs/promises';
const API=process.env.GOLF_API||'https://golf-api.propbetedge.ai';
const get=async(path,tries=3)=>{for(let i=0;;i++){try{const r=await fetch(API+path,{signal:AbortSignal.timeout(30000),headers:{'user-agent':'PropBetEdgeGolfBuild/2'}});if(!r.ok)throw Error(path+' '+r.status);return await r.json();}catch(e){if(i+1>=tries)throw e;await new Promise(r=>setTimeout(r,800*(i+1)));}}};
const manifest=await get('/v1/projection/manifest.json');
const keys=Object.keys(manifest.docs).filter(k=>k!=='index.json');
const index=await get('/v1/projection/index.json');
if(!index.players?.length||!index.editions?.some(e=>e.division==='women')||!index.coverage?.rounds)throw Error('Useful projection required before frontend build');
const out={index,players:[],editions:[],courses:[]};
let next=0;await Promise.all(Array.from({length:24},async()=>{while(next<keys.length){const k=keys[next++];const [kind]=k.split('/');out[kind].push(await get('/v1/projection/'+k));}}));
let news=[];try{news=(await get('/v1/news')).data||[];}catch{}
out.stories=news;
await fs.mkdir('data/public',{recursive:true});await fs.writeFile('data/public/bundle.json',JSON.stringify(out));
console.log(JSON.stringify({as_of:index.as_of,players:out.players.length,editions:out.editions.length,courses:out.courses.length,stories:news.length}));
