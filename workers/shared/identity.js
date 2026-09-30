// Existing provider mapping wins only when verified. Matching names never merges people.
export function resolvePlayer(candidate,crosswalks=[]){
 const mapped=crosswalks.find(x=>x.source===candidate.source&&x.provider_id===candidate.provider_id&&x.verified===true);
 if(mapped)return {status:'resolved',player_id:mapped.player_id,basis:'verified_crosswalk'};
 return {status:'review',player_id:null,evidence:{source:candidate.source,provider_id:candidate.provider_id,full_name:candidate.full_name??null,dob:candidate.dob??null,nationality:candidate.nationality??null},reason:'verified_crosswalk_required'};
}

