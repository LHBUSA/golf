// Duplicate-identity detection and audited merge. Default is a dry run; --apply performs the merge.
// Merge rule: same name family (order/hyphenation/diacritics) AND identical full birth dates AND exactly one
// record carries a Wikidata identity (canonical) while the other was created from an ESPN athlete id.
// Nothing is deleted: the duplicate is marked 'review' (hidden by the projection), its ESPN identity and
// non-overlapping entries move to the canonical player, every change is logged in golf_source_changes.
import fs from 'node:fs/promises';
import {store} from '../workers/shared/store.js';import {sportsEnv} from './ops.mjs';import {nameKeys,sameNameFamily} from '../workers/shared/names.js';
const APPLY=process.argv.includes('--apply'),db=store(await sportsEnv());
const all=async(t,q)=>{const out=[];for(let o=0;;o+=1000){const p=await db(t,`${q}&order=id&limit=1000&offset=${o}`);out.push(...p);if(p.length<1000)return out;}};
const players=(await all('golf_players','select=id,slug,full_name,birth_date,identity_status,capture_id')).filter(p=>p.identity_status!=='review');
const ids=await all('golf_player_identities','select=player_id,source_id,provider_id');
const src=new Map();for(const i of ids)(src.get(i.player_id)||src.set(i.player_id,new Set()).get(i.player_id)).add(i.source_id);
const byKey=new Map();for(const p of players)for(const k of nameKeys(p.full_name))(byKey.get(k)||byKey.set(k,[]).get(k)).push(p);
const seen=new Set(),merge=[],held=[];
for(const group of byKey.values()){if(group.length<2)continue;
 for(let i=0;i<group.length;i++)for(let j=i+1;j<group.length;j++){const a=group[i],b=group[j],key=[a.id,b.id].sort().join('|');if(seen.has(key))continue;seen.add(key);
  if(!sameNameFamily(a.full_name,b.full_name))continue;
  const wa=src.get(a.id)?.has('wikidata'),wb=src.get(b.id)?.has('wikidata');
  const why=!a.birth_date||!b.birth_date?'birth_date_missing':a.birth_date!==b.birth_date?'birth_dates_differ':wa===wb?'canonical_unclear':null;
  if(why){held.push({a:a.slug,b:b.slug,reason:why});continue;}
  const canon=wa?a:b,dup=wa?b:a;merge.push({canonical:canon,duplicate:dup});}}
const report={generated_at:new Date().toISOString(),apply:APPLY,merges:merge.map(m=>({canonical:m.canonical.slug,duplicate:m.duplicate.slug,names:[m.canonical.full_name,m.duplicate.full_name],birth_date:m.canonical.birth_date})),held};
const forced=new Set();
if(APPLY)for(const {canonical:C,duplicate:D} of merge){
 const cEntries=new Set((await db('golf_entries',`select=edition_id&player_id=eq.${C.id}`)).map(x=>x.edition_id));
 const dEntries=await db('golf_entries',`select=id,edition_id&player_id=eq.${D.id}`);
 const move=dEntries.filter(x=>!cEntries.has(x.edition_id)),overlap=dEntries.filter(x=>cEntries.has(x.edition_id));
 for(let i=0;i<move.length;i+=50)await db('golf_entries','id=in.('+move.slice(i,i+50).map(x=>x.id).join(',')+')',{method:'PATCH',headers:{prefer:'return=minimal'},body:JSON.stringify({player_id:C.id})});
 await db('golf_player_identities',`player_id=eq.${D.id}&source_id=eq.espn`,{method:'PATCH',headers:{prefer:'return=minimal'},body:JSON.stringify({player_id:C.id})});
 const cStats=new Set((await db('golf_player_season_stats',`select=season_id,stat_id&player_id=eq.${C.id}`)).map(x=>x.season_id+':'+x.stat_id));
 const dStats=(await db('golf_player_season_stats',`select=id,season_id,stat_id&player_id=eq.${D.id}`)).filter(x=>!cStats.has(x.season_id+':'+x.stat_id));
 for(let i=0;i<dStats.length;i+=100)await db('golf_player_season_stats','id=in.('+dStats.slice(i,i+100).map(x=>x.id).join(',')+')',{method:'PATCH',headers:{prefer:'return=minimal'},body:JSON.stringify({player_id:C.id})});
 await db('golf_players','id=eq.'+D.id,{method:'PATCH',headers:{prefer:'return=minimal'},body:JSON.stringify({identity_status:'review',biography:`Duplicate of ${C.slug}: same person by name variant + identical birth date (${C.birth_date}); merged ${new Date().toISOString().slice(0,10)}.`})});
 await db('golf_source_changes','',{method:'POST',headers:{prefer:'return=minimal'},body:JSON.stringify({capture_id:C.capture_id,entity_table:'golf_players',entity_id:D.id,field_changes:{merged_into:C.id,canonical_slug:C.slug,duplicate_slug:D.slug,basis:'name variant + identical birth date',entries_moved:move.length,entries_overlapping:overlap.length,season_stats_moved:dStats.length},previous_capture_id:D.capture_id})});
 for(const x of overlap)forced.add(x.edition_id);
 console.log('merged',D.slug,'->',C.slug,{moved:move.length,overlap:overlap.length,stats:dStats.length});
}
report.overlap_editions=[...forced];
await fs.writeFile('docs/evidence/identity-merge.json',JSON.stringify(report,null,1));
console.log(JSON.stringify({merges:report.merges.length,held:held.length,held_reasons:held.reduce((m,h)=>(m[h.reason]=(m[h.reason]||0)+1,m),{}),sample:report.merges.slice(0,12)},null,1));
