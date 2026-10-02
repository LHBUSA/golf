// Championship setup + scoring for a course map. One edition document produces BOTH the setup and the scoring, so a
// hole card can never mix years: scoring.edition === setup.edition by construction (asserted in buildSetup).
// Spatial routing (OSM, current) is a separate layer and is never moved or relabelled by a setup.

/** Default setup = latest edition that has started (starts_on <= today); future stubs and scheduled/cancelled
 * editions never become the default. Ties on date break by slug for determinism. */
export function defaultEdition(eds,now=new Date()){
 const today=now.toISOString().slice(0,10);
 const started=(eds||[]).filter(e=>e.starts_on&&e.starts_on<=today&&!['scheduled','cancelled'].includes(e.status));
 return started.sort((a,b)=>b.starts_on.localeCompare(a.starts_on)||String(b.slug).localeCompare(String(a.slug)))[0]||null;
}
/** Selectable setups: started editions, newest first (never future stubs). */
export function setupOptions(eds,now=new Date()){
 const today=now.toISOString().slice(0,10);
 return (eds||[]).filter(e=>e.starts_on&&e.starts_on<=today&&!['scheduled','cancelled'].includes(e.status)).sort((a,b)=>b.starts_on.localeCompare(a.starts_on)).map(e=>({edition:e.slug,year:e.year,name:e.name}));
}
const r2=v=>Math.round(v*100)/100;
/** Per-hole scoring from the edition's own observed hole cards (every posted round). Contender sample when the cards
 * cover 20 or fewer players (Wikipedia leaders cards); otherwise observed field cards (still not guaranteed to be every
 * player). Null when the edition has no hole cards. */
export function scoringFrom(ed){
 const rows=(ed?.leaderboard||[]).filter(r=>r.holes?.length);if(!rows.length)return null;
 const acc=new Map();let cards=0;
 for(const r of rows)for(const rd of r.holes){if(!rd.scores?.length)continue;cards++;for(const s of rd.scores){if(!Number.isInteger(s.hole)||!Number.isFinite(s.to_par))continue;const a=acc.get(s.hole)||{n:0,sum:0};a.n++;a.sum+=s.to_par;acc.set(s.hole,a);}}
 if(!acc.size)return null;
 const players=rows.length,cohort=players<=20?'Contender sample':'Observed field cards';
 return {edition:ed.slug,year:ed.year,cohort,players,cards,basis:`${cards} observed round cards from ${players} players${ed.status==='in_progress'?' (rounds posted so far)':''}`,
  holes:[...acc].sort((a,b)=>a[0]-b[0]).map(([hole,a])=>({hole,avg_to_par:r2(a.sum/a.n),sample:a.n}))};
}
const sum=(hs,a,b)=>{const xs=(hs||[]).filter(h=>h.hole>=a&&h.hole<=b);return xs.length===b-a+1&&xs.every(h=>Number.isInteger(h.yards))?xs.reduce((s,h)=>s+h.yards,0):null;};
export function buildSetup(ed){
 if(!ed)return {setup:null,scoring:null};
 const L=ed.layout||{},holes=(L.holes||[]).filter(h=>Number.isInteger(h.hole)).map(h=>({hole:h.hole,par:h.par??null,yards:h.yards??null}));
 const setup={edition:ed.slug,year:ed.year,name:ed.name,label:L.label||null,par:L.par??ed.par??null,yardage:L.yardage??null,front:sum(holes,1,9),back:sum(holes,10,18),holes};
 const scoring=scoringFrom(ed);
 if(scoring&&scoring.edition!==setup.edition)throw new Error('setup/scoring edition mismatch');
 return {setup,scoring};
}
