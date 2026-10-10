// golf#14: publish-time parity gate for the OSM course-routing index (R2 golf-public/osm-routing/v1/index.json).
// A full `prepare` can silently lose courses when an export field goes missing (2026-10-02: 11 courses lost their
// canonical coordinates and 8 verified maps would have been unpublished). Publishing therefore compares the new index
// with the LIVE one and fails closed on any unexplained regression. A genuine removal needs a reviewed revocation.

export const RANK={full:3,reviewed:3,partial:2,held:1,'no-routing':0,unaudited:0};
const rank=s=>RANK[s]??0;

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
  // A missing export field, not a routing decision: the course had been located before and now has no coordinates.
  if(b.decision==='no_canonical_coords'&&a.decision!=='no_canonical_coords')found.push({slug,kind:'coords_missing',live:a.decision,next:b.decision});
  if(rb>ra||(b.holes_mapped||0)>(a.holes_mapped||0))improvements.push({slug,live:a.status,next:b.status,holes:[a.holes_mapped||0,b.holes_mapped||0]});
 }
 for(const [slug,b] of N)if(!L.has(slug))added.push({slug,status:b.status});
 const regressions=[],explained=[];
 // A missing export field is a data defect, never a routing decision: it cannot be revoked away.
 for(const f of found){const r=rev.get(f.slug);if(r&&f.kind!=='coords_missing'&&(r.allow||[]).includes(f.kind))explained.push({...f,evidence_id:r.evidence_id});else regressions.push(f);}
 return {ok:regressions.length===0,regressions,explained,improvements,added};
}

/**
 * Staged, fail-closed publish. Objects first, index last; the index switch is refused if the live index changed while
 * staging (concurrent publish) and is rolled back if the read-back does not match.
 * io: {getLiveIndex()->{text}, putObject(key,file,contentType), putIndexText(text), backup(text)->path, sha(text)}
 */
export async function publishRouting({io,localIndexText,objects,revocations=[],dryRun=false,log=()=>{}}){
 const before=await io.getLiveIndex();if(!before?.text)throw Error('live index unreadable: refusing to publish blind');
 const parity=routingParity(JSON.parse(before.text),JSON.parse(localIndexText),revocations);
 log({parity});
 if(!parity.ok)return {published:false,reason:'parity_regressions',parity};
 if(dryRun)return {published:false,reason:'dry_run',parity};
 const backupPath=await io.backup(before.text);
 for(const o of objects)await io.putObject(o.key,o.file,o.contentType);
 const again=await io.getLiveIndex();
 if(io.sha(again?.text||'')!==io.sha(before.text))return {published:false,reason:'live_index_changed_during_publish',parity,backupPath};
 await io.putIndexText(localIndexText);
 const after=await io.getLiveIndex();
 if(io.sha(after?.text||'')!==io.sha(localIndexText)){await io.putIndexText(before.text);return {published:false,reason:'index_readback_mismatch_restored',parity,backupPath};}
 return {published:true,parity,backupPath,live_sha_before:io.sha(before.text),live_sha_after:io.sha(localIndexText)};
}
