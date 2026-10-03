// Human-review packets for HUMAN_REVIEWED_LAYOUTS (owner lane, 2026-10-03). Read-only: builds evidence for a person to
// approve or reject; it never approves anything. Candidates: automatic attempts that proved all 18 holes inside the
// candidate outline but could not validate yardage (no published hole-by-hole table). Ordered by tournament relevance.
import fs from 'node:fs';import path from 'node:path';
import {matchWithEvidence,outerRings,inside,nameScore} from '../workers/shared/course-geo.js';
import {priority} from './osm-routing.mjs';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/,'$1')),'..');
const rd=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const idx=rd('data/osm-routing/v1/index.json'),B=rd('data/public/bundle.json'),C=rd('data/osm-cache/_candidates.json');
const metres=(a,b)=>{const k=Math.cos(a[1]*Math.PI/180);return Math.round(Math.hypot((a[0]-b[0])*111320*k,(a[1]-b[1])*110540));};
const byCourse=new Map();for(const e of B.editions)if(e.course?.slug)(byCourse.get(e.course.slug)||byCourse.set(e.course.slug,[]).get(e.course.slug)).push(e);
const rows=idx.courses.filter(c=>c.auto_identity&&!c.auto_identity.pass&&c.auto_identity.checks.proven===18&&!c.auto_identity.checks.setup_table);
// Known caveats a geometry check cannot see (recorded from earlier reviews).
const CAVEATS={'royal-liverpool-gc-ec261':'Hoylake: OSM hole refs follow MEMBER numbering, which differs from the Open championship routing; approving would show member order, not the championship order'};
const out=[];
for(const r of rows){const raw=rd('data/osm-cache/'+r.slug+'.json'),els=raw.elements;const [t,id]=r.osm_course.split('/');const T=els.find(e=>e.type===t&&String(e.id)===id);
 const canon=B.courses.find(c=>c.slug===r.slug)||{name:r.name};
 const m=matchWithEvidence({slug:r.slug,name:canon.name,latitude:null,longitude:null},els,new Map(),{osm_course:r.osm_course,evidence_id:'review',clears:['review_no_canonical_coords']});
 const holes=[...(m.evidence.accepted||[])].sort((a,b)=>a.hole-b.hole);
 const gaps=holes.slice(1).map((h,i)=>({from:holes[i].hole,to:h.hole,m:metres(holes[i].coords.at(-1),h.coords[0])}));
 const longWalks=gaps.filter(g=>g.m>450&&!(g.from===9&&g.to===10));
 const osmPar=holes.reduce((s,h)=>s+(Number(h.par)||0),0),parTagged=holes.filter(h=>Number(h.par)).length;
 const eds=(byCourse.get(r.slug)||[]).sort((a,b)=>(b.starts_on||'').localeCompare(a.starts_on||''));const setupPar=eds.find(e=>e.par)?.par??null;
 const others=els.filter(e=>e.tags?.leisure==='golf_course'&&e!==T).map(e=>({id:e.type+'/'+e.id,name:e.tags.name||'(unnamed)',holes_inside:els.filter(h=>h.tags?.golf==='hole'&&h.geometry&&inside([h.geometry[Math.floor(h.geometry.length/2)].lon,h.geometry[Math.floor(h.geometry.length/2)].lat],e)).length,name_score:+nameScore(canon.name,e.tags.name).toFixed(2)}));
 const tg=T?.tags||{};
 const flags=[];if(longWalks.length)flags.push(`${longWalks.length} green-to-next-tee walks over 450 m: ${longWalks.map(g=>g.from+'→'+g.to+' '+g.m+'m').join(', ')}`);
 if(parTagged===18&&setupPar&&osmPar!==setupPar)flags.push(`OSM par total ${osmPar} vs championship par ${setupPar}`);
 if(CAVEATS[r.slug])flags.push(CAVEATS[r.slug]);
 const ns=Math.max(...['name','name:en','int_name','official_name'].map(k=>nameScore(canon.name,tg[k]||'')));
 if(ns<0.75)flags.push(`candidate name "${tg.name}" does not match "${canon.name}" (score ${ns.toFixed(2)}): possibly a different course at the same club`);
 const rivals=others.filter(o=>o.name_score>=0.5);if(rivals.length)flags.push('similarly named course(s) in extract: '+rivals.map(o=>`${o.name} (${o.holes_inside} holes, name ${o.name_score})`).join('; '));
 const neighbours=others.filter(o=>o.name_score<0.5&&o.holes_inside>=9).map(o=>`${o.name} (${o.holes_inside} holes)`);
 if(m.evidence.par?.disagree?.length)flags.push('par tag conflicts on holes '+m.evidence.par.disagree.join(','));
 out.push({slug:r.slug,name:canon.name,priority:priority(canon),next_or_last_event:eds[0]?{name:eds[0].name,starts_on:eds[0].starts_on}:null,
  candidate:{osm_course:r.osm_course,name:tg.name||null,operator:tg.operator||null,website:tg.website||tg['contact:website']||null,address:[tg['addr:street'],tg['addr:city'],tg['addr:state'],tg['addr:postcode']].filter(Boolean).join(', ')||null,golf_course_tag:tg['golf:course']||null,found_via:C[r.slug]?.via||C[r.slug]?.resolved_by||'locality search',locality_query:C[r.slug]?.query||null},
  holes:{proven:holes.length,refs:holes.map(h=>h.hole).join(','),osm_par_total:parTagged===18?osmPar:null,setup_par:setupPar},
  yardage_validation:'unavailable (no published hole-by-hole setup)',flags,neighbours_info:neighbours,ready_for_review:flags.length===0});}
const pri=x=>x.priority;out.sort((a,b)=>{const pa=a.priority,pb=b.priority;for(let i=0;i<pa.length;i++){if(pa[i]<pb[i])return -1;if(pa[i]>pb[i])return 1;}return 0;});
fs.writeFileSync(path.join(ROOT,'docs/evidence/human-review-queue.json'),JSON.stringify({generated:new Date().toISOString(),lane:'HUMAN_REVIEWED_LAYOUT',note:'Evidence for a person to approve or reject. Nothing here is approved. Approval adds an entry to HUMAN_REVIEWED_LAYOUTS in workers/shared/course-identity.js.',packets:out.map(({priority,...x})=>x)},null,1));
for(const x of out)console.log((x.ready_for_review?'CLEAN ':'FLAGS ')+x.slug,'|',x.candidate.name,'|',x.next_or_last_event?.starts_on||'',x.next_or_last_event?.name||'','|',x.flags.join(' / ').slice(0,220));
