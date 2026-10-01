// Temporal, provenance-first models for caddies, equipment and affiliations.
// Sources for these are on HOLD (rights review); these contracts define how evidence will be handled.
const REQ=['source_id','source_url','observed_at','fetched_at'];
export const hasProvenance=r=>REQ.every(k=>r&&r[k]);
// Caddie assignments are event/date-specific. The current caddie is derived from the latest reliable
// evidence; older assignments remain history and are never overwritten.
export function caddieTimeline(assignments){
 const ok=assignments.filter(a=>hasProvenance(a)&&a.player_id&&(a.caddie_id||a.normalized_caddie_name)&&a.confidence!=='low');
 const sorted=[...ok].sort((a,b)=>String(b.observed_at).localeCompare(String(a.observed_at)));
 const current=sorted[0]||null;
 return {current:current?{caddie:current.caddie_id||current.normalized_caddie_name,last_verified:current.observed_at,source_url:current.source_url,together_since:current.valid_from||null}:null,history:sorted.map(a=>({caddie:a.caddie_id||a.normalized_caddie_name,edition_id:a.edition_id||null,observed_at:a.observed_at,source_url:a.source_url})),rejected:assignments.length-ok.length};
}
export const BAG_SLOTS=['driver','driver_shaft','fairway_woods','hybrids','irons','iron_shafts','wedges','wedge_shafts','putter','ball','grips'];
// Snapshots are versioned; changes are computed between consecutive verified snapshots only.
export function equipmentChanges(snapshots){
 const ok=snapshots.filter(s=>hasProvenance(s)&&s.verification_status==='verified').sort((a,b)=>String(a.observed_at).localeCompare(String(b.observed_at)));
 const changes=[];
 for(let i=1;i<ok.length;i++)for(const slot of BAG_SLOTS){const a=ok[i-1][slot],b=ok[i][slot];if(a&&b&&JSON.stringify(a)!==JSON.stringify(b))changes.push({slot,from:a,to:b,observed_at:ok[i].observed_at,previous_observed_at:ok[i-1].observed_at,source_url:ok[i].source_url,causal_claim:false});}
 return {snapshots:ok.length,current:ok.at(-1)||null,changes};
}
export const AFFILIATION_TYPES=['SPONSOR','AMBASSADOR','EQUIPMENT_CONTRACT','ATHLETE_ROSTER','NIL','UNKNOWN_VERIFIED_RELATIONSHIP'];
export const AFFILIATION_CATEGORIES=['EQUIPMENT','BALL','APPAREL','FOOTWEAR','HEADWEAR','WATCH','FINANCIAL','AUTOMOTIVE','OTHER'];
// An affiliation needs explicit relationship evidence. Equipment use, logos or photos never qualify.
export function validateAffiliation(a){
 const reasons=[];
 if(!a?.player_id)reasons.push('player_required');
 if(!a?.organization)reasons.push('organization_required');
 if(!AFFILIATION_CATEGORIES.includes(a?.category))reasons.push('category_invalid');
 if(!AFFILIATION_TYPES.includes(a?.relationship_type))reasons.push('relationship_type_invalid');
 if(!a?.source_url||!a?.verified_at)reasons.push('provenance_required');
 if(['equipment_use','logo_in_photo','bag_branding','apparel_worn'].includes(a?.evidence_kind))reasons.push('usage_is_not_affiliation');
 return {valid:!reasons.length,reasons};
}
export function affiliationsFromEquipment(){return [];} // by rule: equipment use never creates an affiliation
