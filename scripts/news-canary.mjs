// Newsroom OpenAI canary (compare-only; nothing is published). For each supported class it runs the editor on
// real packets, then grades every comparison: gates, unsupported claims, link integrity (live HEAD checks), SEO.
// Usage: node scripts/news-canary.mjs [--classes=final,preview,course_intelligence,round_recap] [--per=3]
import fs from 'node:fs/promises';
const TOKEN=(await fs.readFile('D:/Workers/secrets/golf-admin-token','utf8')).trim(),API='https://golf-api.propbetedge.ai',SITE='https://golf.propbetedge.ai';
const arg=k=>process.argv.find(a=>a.startsWith('--'+k+'='))?.split('=')[1];
const CLASSES=(arg('classes')||'final,preview,course_intelligence,round_recap').split(','),PER=Number(arg('per')||3);
const post=async q=>{for(;;){const r=await fetch(`${API}/admin/news-compare?${q}`,{method:'POST',headers:{authorization:'Bearer '+TOKEN}});const j=await r.json().catch(()=>null);if(j?.status!=='busy')return j;await new Promise(r=>setTimeout(r,15000));}};
const ix=await (await fetch(`${API}/v1/projection/index.json`)).json();const today=new Date().toISOString().slice(0,10);
const minus=(d,n)=>new Date(Date.parse(d+'T12:00:00Z')-n*86400000).toISOString().slice(0,10);
const plan={final:ix.editions.filter(e=>e.status==='completed'&&e.coverage==='full_field'&&e.ends_on<=today).sort((a,b)=>b.ends_on.localeCompare(a.ends_on)).slice(0,12).map(e=>({edition:e.slug,today:new Date(Date.parse(e.ends_on+'T12:00:00Z')+86400000).toISOString().slice(0,10)})),
 preview:ix.editions.filter(e=>e.status!=='completed'&&e.starts_on>today).sort((a,b)=>a.starts_on.localeCompare(b.starts_on)).slice(0,12).map(e=>({edition:e.slug,today:minus(e.starts_on,3)})),
 course_intelligence:ix.editions.filter(e=>e.status!=='completed'&&e.starts_on>today&&e.course).sort((a,b)=>a.starts_on.localeCompare(b.starts_on)).slice(0,20).map(e=>({edition:e.slug,today:minus(e.starts_on,3)})),
 round_recap:ix.current.map(e=>({edition:e.slug,today:null}))};
const report={generated_at:new Date().toISOString(),classes:{}};
for(const cls of CLASSES){const got=[];
 for(const c of plan[cls]||[]){if(got.length>=PER)break;
  const r=await post(`run=1&types=${cls}&editions=${c.edition}${c.today?'&today='+c.today:''}&limit=3`);
  for(const s of r?.stories||[])if(s.compare&&got.length<PER)got.push(s.topic);}
 report.classes[cls]={requested:PER,available:got.length,topics:got,results:[]};
}
const docs=await (await fetch(`${API}/admin/news-compare?limit=200`,{method:'POST',headers:{authorization:'Bearer '+TOKEN}})).json();
const head=async u=>{try{return (await fetch(SITE+u,{method:'HEAD',redirect:'manual'})).status;}catch{return 0;}};
for(const [cls,c] of Object.entries(report.classes))for(const topic of c.topics){const d=docs.find(x=>x.topic===topic);if(!d)continue;
 const o=d.openai,pl=o.plan,dk=d.desk.plan,unsupported=(o.attempts.at(-1)?.fact||[]).filter(x=>/unsupported_|injury|quotation|url_in_prose|prediction|betting/.test(x));
 const links=pl?.links||[];const dead=[];for(const l of links){const st=await head(l);if(st!==200)dead.push(l+' '+st);}
 const seo=pl?{title_len:pl.seo.title.length,desc_len:pl.seo.description.length,ok:pl.seo.title.length<=65&&pl.seo.description.length>=50&&pl.seo.description.length<=170&&Boolean(pl.canonical&&pl.og_image&&pl.jsonld_type)}:null;
 const pass=o.status==='validated'&&o.gates?.ok&&!unsupported.length&&!dead.length&&seo?.ok&&d.chosen_editor==='openai';
 c.results.push({topic,editor:d.chosen_editor,openai_status:o.status,reason:o.reason,pass:Boolean(pass),
  hold_reasons:pass?[]:[...(o.status!=='validated'?['openai_'+o.status+(o.reason?':'+o.reason:'')]:[]),...(o.attempts.at(-1)?.fact||[]),...(o.attempts.at(-1)?.numeric||[]),...dead.map(x=>'dead_link '+x),...(seo&&!seo.ok?['seo']:[])],
  numeric_issues:(o.attempts.at(-1)?.numeric||[]).length,unsupported_claims:unsupported.length,links:links.length,dead_links:dead.length,seo,usd:o.usd,
  desk:{ok:d.desk.gates.ok,headline:dk?.headline,words:dk?.words},openai:{headline:pl?.headline,words:pl?.words,sections:pl?.sections?.map(s=>s.heading)},media:pl?.media||dk?.media});}
for(const c of Object.values(report.classes)){c.passes=c.results.filter(r=>r.pass).length;c.recommend_promotion=c.available>=3&&c.passes===3;}
await fs.writeFile('docs/evidence/news-canary.json',JSON.stringify(report,null,1));
for(const [cls,c] of Object.entries(report.classes))console.log(`${cls}: ${c.passes}/${c.available} pass (requested ${c.requested})${c.recommend_promotion?' -> recommend promotion':''}`,JSON.stringify(c.results.map(r=>({topic:r.topic,pass:r.pass,hold:r.hold_reasons.slice(0,3)}))));
