// Public Golf Picks view (owner, 2026-10-09): readiness of the next supported tournament + RESOLVED results only.
// A selection is public only after it is graded WIN / LOSS / VOID; locked-but-unresolved selections and every
// probability table stay All Access only.
import {FAMILY_LABEL,FAMILIES} from './policy.js';
import {MODEL_VERSION} from './model.js';
import {readinessView} from './gate.js';
const RESOLVED=new Set(['WIN','LOSS','VOID']);
export function picksPreview(items,health){
 const resolved=[];
 for(const it of items)for(const s of it.selections)if(RESOLVED.has(s.grade))resolved.push({edition:it.edition.name,starts_on:it.edition.starts_on,family:s.family,family_label:FAMILY_LABEL[s.family],proposition:s.proposition,name:s.name,opponent:s.opponent?.name||null,p:s.p,actual:s.actual||null,grade:s.grade});
 const g=health?.gate&&health.gate.edition?readinessView(health.gate,health.gate.edition):null;
 return {availability:'available',model:MODEL_VERSION,label:'RESEARCH',families:FAMILIES.map(f=>FAMILY_LABEL[f]),tournaments_locked:items.length,selections_graded:resolved.filter(r=>r.grade!=='VOID').length,
  latest:items[0]?{edition:items[0].edition.name,starts_on:items[0].edition.starts_on,locked_at:items[0].locked_at}:null,
  lane:health?{enabled:Boolean(health.enabled),checked_at:health.checked_at,status:health.status}:null,readiness:g,resolved:resolved.slice(0,200)};
}
