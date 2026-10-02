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
// Three-way grading per packet: current desk (v4), contextual desk (v5) and the OpenAI edit (when the key exists).
// Player-level premium values (strokes vs field, form leaders, Course Fit). Course-level scoring is public.
const PREMIUM=/vs_field|field_form|course fit|strokes (better|worse) than the field|against the field average|strokes-gained|strokes gained/i;
const syl=w=>Math.max(1,(w.toLowerCase().replace(/[^a-z]/g,'').replace(/e$/,'').match(/[aeiouy]+/g)||[]).length);
function grade(plan,gates,packetFacts){if(!plan)return null;
 const text=plan.sections.map(s=>s.text).join(' '),sents=text.split(/(?<=[.!?])\s+/).filter(x=>x.split(/\s+/).length>2),words=text.split(/\s+/).filter(Boolean);
 const flesch=Math.round(206.835-1.015*(words.length/Math.max(1,sents.length))-84.6*(words.reduce((a,w)=>a+syl(w),0)/Math.max(1,words.length)));
 const dupSents=sents.length-new Set(sents.map(x=>x.toLowerCase())).size;
 const derived=new Set(packetFacts.filter(f=>String(f.source).startsWith('Derived from')).map(f=>f.id));
 const reasons=gates?.reasons||[...(gates?.fact||[]),...(gates?.numeric||[])];
 return {gates_ok:Boolean(gates?.ok),unsupported_claims:reasons.filter(x=>/unsupported_|unknown_fact|unknown_entity|invented_|outcome_claim|pronoun|injury|quotation|prediction|betting/.test(x)).length,numeric_issues:reasons.filter(x=>/number|ordinal/.test(x)).length,
  narrative_words:plan.words,sections:plan.sections.length,facts_used:(plan.facts_used||[]).length,derived_facts_used:(plan.facts_used||[]).filter(id=>derived.has(id)).length,
  modules:plan.charts.length,modules_introduced:(plan.modules||[]).length,avg_sentence_words:Math.round(words.length/Math.max(1,sents.length)*10)/10,flesch_reading_ease:flesch,duplicate_sentences:dupSents,
  premium_safe:!PREMIUM.test(text),headline:plan.headline,dek:plan.dek,seo:{title:plan.seo.title,title_len:plan.seo.title.length,desc_len:plan.seo.description.length,ok:plan.seo.title.length<=65&&plan.seo.description.length>=50&&plan.seo.description.length<=170&&Boolean(plan.canonical&&plan.og_image&&plan.jsonld_type)},links:plan.links};}
for(const [cls,c] of Object.entries(report.classes))for(const topic of c.topics){const d=docs.find(x=>x.topic===topic);if(!d)continue;
 const facts=d.packet.facts,v4=grade(d.desk_v4?.plan,d.desk_v4?.gates,facts),v5=grade(d.desk.plan,{ok:d.desk.gates.ok,reasons:[...d.desk.gates.fact,...d.desk.gates.numeric]},facts),o=d.openai,oa=grade(o.plan,o.gates,facts);
 for(const g of [v4,v5,oa].filter(Boolean)){g.dead_links=[];for(const l of g.links){const st=await head(l);if(st!==200)g.dead_links.push(l+' '+st);}}
 const clean=g=>g&&g.gates_ok&&!g.unsupported_claims&&!g.numeric_issues&&!g.dead_links.length&&g.seo.ok&&g.premium_safe&&!g.duplicate_sentences;
 const deskPass=clean(v5)&&v5.modules_introduced>=Math.min(2,v5.modules)&&(!v4||v5.narrative_words>=v4.narrative_words);
 const openaiPass=Boolean(o.status==='validated'&&clean(oa));
 c.results.push({topic,desk_v5_pass:Boolean(deskPass),openai_pass:openaiPass,pass:openaiPass,openai_status:o.status,reason:o.reason,usd:o.usd,
  hold_reasons:openaiPass?[]:[...(o.status!=='validated'?['openai_'+o.status+(o.reason?':'+o.reason:'')]:[]),...(o.attempts.at(-1)?.fact||[]),...(o.attempts.at(-1)?.numeric||[]),...(oa?.dead_links||[]).map(x=>'dead_link '+x)],
  desk_v5_hold:deskPass?[]:[...(d.desk.gates.fact||[]),...(d.desk.gates.numeric||[]),...(v5?.dead_links||[]),...(v5&&!v5.seo.ok?['seo']:[]),...(v5&&!v5.premium_safe?['premium_data']:[]),...(v5?.duplicate_sentences?['duplicate_sentences']:[])],
  current_desk:v4,contextual_desk:v5,openai:oa,media:d.desk.plan?.media});}
for(const c of Object.values(report.classes)){c.passes=c.results.filter(r=>r.pass).length;c.desk_v5_passes=c.results.filter(r=>r.desk_v5_pass).length;c.recommend_promotion=c.available>=3&&c.passes===3;c.recommend_desk_v5=c.available>=3&&c.desk_v5_passes===3;}
await fs.writeFile('docs/evidence/news-canary.json',JSON.stringify(report,null,1));
for(const [cls,c] of Object.entries(report.classes))console.log(`${cls}: openai ${c.passes}/${c.available}, contextual desk ${c.desk_v5_passes}/${c.available} (requested ${c.requested})${c.recommend_promotion?' -> recommend OpenAI promotion':''}${c.recommend_desk_v5?' -> contextual desk ready':''}`,JSON.stringify(c.results.map(r=>({topic:r.topic,v4_words:r.current_desk?.narrative_words,v5_words:r.contextual_desk?.narrative_words,v5:r.desk_v5_pass,v5_hold:r.desk_v5_hold.slice(0,3),openai:r.openai_pass,hold:r.hold_reasons.slice(0,2)}))));
