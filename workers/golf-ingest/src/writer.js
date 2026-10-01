// Idempotent canonical writer. Tables covered by the reviewed golf_write_batch RPC go through it
// (transactional typed comparison + correction ledger). Score-depth tables use the same rules here:
// compare against the stored row, write only differences, and record before/after in golf_source_changes.
const RPC_TABLES=new Set(['golf_tours','golf_players','golf_player_identities','golf_identity_queue','golf_tournaments','golf_tournament_editions','golf_edition_tours','golf_courses','golf_course_layouts','golf_edition_courses','golf_entries','golf_results']);
export const DIRECT_TABLES=new Set(['golf_rounds','golf_scorecards','golf_holes','golf_hole_scores','golf_entity_media','golf_groups','golf_tee_times','golf_seasons','golf_player_season_stats']);
// Dependency order so foreign keys always resolve inside one plan.
export const ORDER=['golf_tours','golf_tournaments','golf_courses','golf_course_layouts','golf_holes','golf_players','golf_player_identities','golf_identity_queue','golf_tournament_editions','golf_edition_tours','golf_edition_courses','golf_entries','golf_results','golf_rounds','golf_scorecards','golf_hole_scores','golf_groups','golf_tee_times','golf_entity_media','golf_seasons','golf_player_season_stats'];
const canon=v=>{if(v===null||v===undefined)return 'null';if(typeof v==='number')return String(Number(v));if(typeof v==='string'&&/^-?\d+(\.\d+)?$/.test(v))return String(Number(v));if(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(v))return String(Date.parse(v));if(Array.isArray(v))return '['+v.map(canon).join(',')+']';if(typeof v==='object')return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canon(v[k])).join(',')+'}';return JSON.stringify(v);};
export const sameRow=(oldRow,row)=>Object.keys(row).every(k=>k==='capture_id'||canon(oldRow[k])===canon(row[k]));
export function sortPlan(rows){const seen=new Set(),out=[];for(const t of ORDER)for(const r of rows)if(r.table===t){const k=t+':'+r.row.id;if(!seen.has(k)){seen.add(k);out.push(r);}}const unknown=rows.find(r=>!ORDER.includes(r.table));if(unknown)throw Error('table_not_writable:'+unknown.table);return out;}
async function direct(db,table,rows,counts){
 for(let i=0;i<rows.length;i+=150){
  const chunk=rows.slice(i,i+150),existing=new Map((await db(table,'select=*&id=in.('+chunk.map(r=>r.id).join(',')+')'))?.map(r=>[r.id,r])||[]);
  const write=[],changes=[];
  for(const row of chunk){const old=existing.get(row.id);if(old&&sameRow(old,row)){counts.unchanged++;continue;}write.push(row);if(old){counts.updated++;changes.push({capture_id:row.capture_id,entity_table:table,entity_id:row.id,field_changes:{before:old,after:row},previous_capture_id:old.capture_id});}else counts.inserted++;}
  if(write.length){
   // PostgREST bulk upsert requires uniform keys per request.
   const groups=new Map();for(const r of write){const k=Object.keys(r).sort().join(',');groups.set(k,[...(groups.get(k)||[]),r]);}
   for(const g of groups.values())await db(table,'on_conflict=id',{method:'POST',headers:{prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(g)});
  }
  if(changes.length)await db('golf_source_changes','',{method:'POST',headers:{prefer:'return=minimal'},body:JSON.stringify(changes)});
 }
}
export async function writePlan(db,plan,{approvedCaptures}={}){
 const rows=sortPlan(plan),counts={inserted:0,updated:0,unchanged:0};
 if(approvedCaptures)for(const r of rows)if(!approvedCaptures.has(r.row.capture_id))throw Error('unapproved_capture');
 let i=0;
 while(i<rows.length){
  const t=rows[i].table;let j=i;while(j<rows.length&&rows[j].table===t)j++;
  const group=rows.slice(i,j);
  if(RPC_TABLES.has(t)){for(let k=0;k<group.length;k+=400){const c=await db('rpc/golf_write_batch','',{method:'POST',body:JSON.stringify({p_rows:group.slice(k,k+400)})});counts.inserted+=c.inserted;counts.updated+=c.updated;counts.unchanged+=c.unchanged;}}
  else if(DIRECT_TABLES.has(t))await direct(db,t,group.map(g=>g.row),counts);
  else throw Error('table_not_writable:'+t);
  i=j;
 }
 return counts;
}
