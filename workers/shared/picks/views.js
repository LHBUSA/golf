// Public Golf Picks preview: counts and dates only. No golfer, selection, probability or grade per selection.
import {FAMILY_LABEL,FAMILIES} from './policy.js';
import {MODEL_VERSION} from './model.js';
export function picksPreview(items){
 const graded=items.flatMap(i=>i.selections).filter(s=>s.grade==='WIN'||s.grade==='LOSS').length;
 return {availability:'available',model:MODEL_VERSION,label:'RESEARCH',families:FAMILIES.map(f=>FAMILY_LABEL[f]),tournaments_locked:items.length,selections_graded:graded,
  latest:items[0]?{edition:items[0].edition.name,starts_on:items[0].edition.starts_on,locked_at:items[0].locked_at}:null};
}
