import {digest} from '../../shared/http.js';
export async function freezePacket(input){
 if(!input.capture_ids?.length||!input.event_key||!Array.isArray(input.facts)||!input.facts.length)throw new Error('packet_evidence_required');
 const packet=structuredClone({version:'golf-packet/1',event_key:input.event_key,capture_ids:[...input.capture_ids].sort(),facts:input.facts,materiality:input.materiality??null});
 for(const fact of packet.facts){if(!fact.id||!packet.capture_ids.includes(fact.capture_id)||fact.value===null||fact.value===undefined)throw new Error('fact_provenance_required');}
 const bytes=new TextEncoder().encode(JSON.stringify(packet));
 const deepFreeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(deepFreeze);Object.freeze(value);}return value;};
 return deepFreeze({...packet,hash:await digest(bytes)});
}
export function validateDraft(packet,draft,previousKeys=[]){
 const reasons=[];
 if(!['tournament_final','round_complete','lead_change','cut_final','ranking_update'].includes(packet.materiality))reasons.push('not_material');
 if(previousKeys.includes(packet.event_key))reasons.push('duplicate_event');
 if(!draft.title||!draft.paragraphs?.length)reasons.push('empty_story');
 // Only fact references and authored nonnumeric sentences are accepted. Values render from packet.
 const facts=new Map(packet.facts.map(f=>[f.id,f]));
 for(const paragraph of draft.paragraphs??[]){
  if(paragraph.kind==='fact'){if(!facts.has(paragraph.fact_id))reasons.push('unknown_fact');}
  else if(paragraph.kind==='text'){if(/\d|["“”]|injur|motivated|odds|betting|predict/i.test(paragraph.text??''))reasons.push('unsupported_prose');}
  else reasons.push('invalid_paragraph');
 }
 if(/\d|["“”]|injur|odds|predict/i.test(draft.title??''))reasons.push('unsupported_title');
 if(!draft.paragraphs?.some(p=>p.kind==='fact'))reasons.push('no_facts');
 return {status:reasons.length?'hold':'validated',reasons:[...new Set(reasons)],packet_hash:packet.hash,publish_allowed:false};
}

