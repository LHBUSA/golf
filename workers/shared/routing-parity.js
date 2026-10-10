// golf#14: publish-time parity gate for the OSM course-routing index (R2 golf-public/osm-routing/v1/index.json).
// A full `prepare` can silently lose courses when an export field goes missing (2026-10-02: 11 courses lost their
// canonical coordinates and 8 verified maps would have been unpublished). Publishing therefore compares the new index
// with the LIVE one and fails closed on any unexplained regression. A genuine removal needs a reviewed revocation.

export const RANK={full:3,reviewed:3,partial:2,held:1,'no-routing':0,unaudited:0};
const rank=s=>RANK[s]??0;
// Decisions that only the canonical-coordinate path of the matcher can produce (course-geo.js matchCourse).
const COORD_DECISIONS=new Set(['review_multiple_containing','review_point_outside_boundary','no_match_point_outside_boundary','no_osm_course','review_country_conflict','review_crosswalk_incomplete','review_routing_differs_from_setup','review_resort_shared_name','review_weak_identity']);
/** Did this row have canonical coordinates? Rows prepared since golf#14 say so (`coords`); older live rows are inferred
 * conservatively from decisions only the coordinate path produces (unknown -> false, so no false alarm). */
export const hadCoords=r=>typeof r?.coords==='boolean'?r.coords:COORD_DECISIONS.has(r?.decision)||(r?.decision==='exact'&&!r?.cleared_by&&!r?.auto_identity?.pass);
const featTotal=f=>Object.values(f||{}).reduce((s,n)=>s+(Number(n)||0),0);

/**
 * @param live live index ({courses:[...]})
 * @param next newly prepared index
 * @param revocations reviewed [{slug, evidence_id, allow:[kind...], reason}] — the only way a regression is accepted
 * @returns {ok, regressions, explained, improvements, added}
 */
export function routingParity(live,next,revocations=[]){
 const N=new Map((next?.courses||[]).map(c=>[c.slug,c])),L=new Map((live?.courses||[]).map(c=>[c.slug,c]));
 const rev=new Map((revocations||[]).map(r=>[r.slug,r]));
 const found=[],improvements=[],added=[];
 for(const [slug,a] of L){const b=N.get(slug);
  if(!b){found.push({slug,kind:'row_removed',live:a.status});continue;}
  const ra=rank(a.status),rb=rank(b.status);
  if(rb<ra)found.push({slug,kind:'status_downgrade',live:a.status,next:b.status,decision:b.decision});
  if((b.holes_mapped||0)<(a.holes_mapped||0))found.push({slug,kind:'holes_lost',live:a.holes_mapped||0,next:b.holes_mapped||0});
  if(ra>=2&&rb>=2&&a.osm_course!==b.osm_course)found.push({slug,kind:'osm_element_changed',live:a.osm_course,next:b.osm_course});
  // A missing export field, not a routing decision: the course had canonical coordinates and the new export has none.
  if(hadCoords(a)&&b.coords===false)found.push({slug,kind:'coords_missing',live:a.decision,next:b.decision});
  // Mapped content: a drawn feature layer that disappears, or a large overall loss, is a regression even at equal status.
  if(ra>=2&&rb>=2&&a.features){const lostKinds=Object.keys(a.features).filter(k=>a.features[k]>0&&!(b.features?.[k]>0)),ta=featTotal(a.features),tb=featTotal(b.features);
   if(lostKinds.length||tb<ta*0.75)found.push({slug,kind:'features_lost',live:a.features,next:b.features||null,lost:lostKinds});}
  if(a.human_review&&!b.human_review)found.push({slug,kind:'review_lost',live:a.human_review.evidence_id||true});
  if(a.candidate&&!b.candidate&&rb<=1)found.push({slug,kind:'candidate_lost',live:a.candidate});
  if(a.retrieved_at&&b.retrieved_at&&b.retrieved_at<a.retrieved_at)found.push({slug,kind:'older_extract',live:a.retrieved_at,next:b.retrieved_at});
  if(rb>ra||(b.holes_mapped||0)>(a.holes_mapped||0))improvements.push({slug,live:a.status,next:b.status,holes:[a.holes_mapped||0,b.holes_mapped||0]});
 }
 for(const [slug,b] of N)if(!L.has(slug))added.push({slug,status:b.status});
 const regressions=[],explained=[];
 // A missing export field is a data defect, never a routing decision: it cannot be revoked away.
 for(const f of found){const r=rev.get(f.slug);if(r&&f.kind!=='coords_missing'&&(r.allow||[]).includes(f.kind))explained.push({...f,evidence_id:r.evidence_id});else regressions.push(f);}
 return {ok:regressions.length===0,regressions,explained,improvements,added};
}

/** Course/dataset objects that must be removed after the switch: mapped live, not mapped in the new index (only ever
 * reachable through a reviewed revocation, because the gate blocks it otherwise). */
export function objectsToRemove(live,next){
 const N=new Map((next?.courses||[]).map(c=>[c.slug,c]));
 return (live?.courses||[]).filter(a=>(a.holes_mapped||0)>0&&!((N.get(a.slug)?.holes_mapped||0)>0)).flatMap(a=>['osm-routing/v1/courses/'+a.slug+'.json','osm-routing/v1/dataset/'+a.slug+'.geojson']);
}

/**
 * Staged, fail-closed publish. Parity first (nothing is touched on a regression). Every object that will be replaced
 * or removed is backed up; unchanged objects are not re-uploaded. Objects first, index last; the switch is refused if
 * the live index changed while staging, and a refused/failed switch restores the objects AND the index.
 * io: {getLiveIndex()->{text}|null, getObject(key)->{text}|null, putObject(key,{file|text},contentType),
 *      deleteObject(key), putIndexText(text), backup(name,text)->path, sha(text), readFile(file)->text}
 */
export async function publishRouting({io,localIndexText,objects,revocations=[],dryRun=false,log=()=>{}}){
 const before=await io.getLiveIndex();if(!before?.text)throw Error('live index unreadable: refusing to publish blind');
 const live=JSON.parse(before.text),next=JSON.parse(localIndexText);
 const parity=routingParity(live,next,revocations),removals=objectsToRemove(live,next);
 log({parity,removals});
 if(!parity.ok)return {published:false,reason:'parity_regressions',parity};
 // Stage: which objects actually change, with a backup of the previous bytes (null = did not exist).
 const changes=[];
 for(const o of objects){const text=io.readFile(o.file),cur=await io.getObject(o.key);if(cur&&io.sha(cur.text)===io.sha(text))continue;changes.push({...o,text,prev:cur?cur.text:null});}
 const gone=[];for(const k of removals){const cur=await io.getObject(k);if(cur)gone.push({key:k,prev:cur.text});}
 if(dryRun)return {published:false,reason:'dry_run',parity,changed:changes.map(c=>c.key),removed:gone.map(g=>g.key)};
 const backupPath=await io.backup('index.live-backup.json',before.text);
 for(const c of [...changes,...gone])if(c.prev!=null)await io.backup('objects/'+c.key,c.prev);
 const done=[];
 const undo=async()=>{for(const c of done.reverse()){if(c.prev==null)await io.deleteObject(c.key);else await io.putObject(c.key,{text:c.prev},c.contentType||'application/json');}};
 try{
  for(const c of changes){await io.putObject(c.key,{text:c.text},c.contentType);done.push(c);}
  const again=await io.getLiveIndex();
  if(io.sha(again?.text||'')!==io.sha(before.text)){await undo();return {published:false,reason:'live_index_changed_during_publish',parity,backupPath};}
  await io.putIndexText(localIndexText);
  let after=null;for(let i=0;i<3&&!after?.text;i++)after=await io.getLiveIndex();
  if(io.sha(after?.text||'')!==io.sha(localIndexText)){await io.putIndexText(before.text);await undo();return {published:false,reason:'index_readback_mismatch_restored',parity,backupPath};}
 }catch(err){
  const restore=[];try{await io.putIndexText(before.text);await undo();restore.push('restored');}catch(e2){restore.push('RESTORE FAILED: '+e2.message);}
  return {published:false,reason:'publish_error',error:String(err?.message||err),restore,parity,backupPath};
 }
 for(const g of gone){await io.deleteObject(g.key);}
 return {published:true,parity,backupPath,changed:changes.map(c=>c.key),removed:gone.map(g=>g.key),live_sha_before:io.sha(before.text),live_sha_after:io.sha(localIndexText)};
}
