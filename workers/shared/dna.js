// Results DNA v1: descriptive metrics from observed tournament results and round scores.
// No shot-level inputs exist in approved sources; those dimensions are held with explicit reasons.
export const DNA_METHOD='golf-results-dna/1.0.0';
export const COURSE_METHOD='golf-course-dna/1.0.0';
export const FIT_METHOD='golf-course-fit-descriptive/1.0.0';
// Confidence tiers. Percentiles are withheld below LIMITED.
export const TIERS={holes:[['HIGH',200],['MEDIUM',100],['LIMITED',36]],rounds:[['HIGH',40],['MEDIUM',20],['LIMITED',8]],starts:[['HIGH',12],['MEDIUM',6],['LIMITED',3]],editions:[['HIGH',6],['MEDIUM',3],['LIMITED',2]]};
export function tier(kind,n){for(const [name,min] of TIERS[kind])if(n>=min)return name;return 'INSUFFICIENT';}
export const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
export const sd=a=>{if(a.length<2)return null;const m=mean(a);return Math.sqrt(a.reduce((s,x)=>s+(x-m)**2,0)/(a.length-1));};
export const round1=v=>v===null||v===undefined||!Number.isFinite(v)?null:Math.round(v*10)/10;
export const round2=v=>v===null||v===undefined||!Number.isFinite(v)?null:Math.round(v*100)/100;
// Mid-rank percentile within a like-for-like cohort (same division, window, eligible tier).
export function percentileOf(value,cohort,direction='higher'){
 if(!Number.isFinite(value)||cohort.length<10)return null;
 const better=cohort.filter(v=>direction==='higher'?v<value:v>value).length,equal=cohort.filter(v=>v===value).length;
 return Math.round(100*(better+Math.max(0,equal-1)/2)/(cohort.length-1||1));
}
export const DIMENSIONS=[
 {code:'scoring',label:'Scoring vs field',unit:'strokes per round better than the round field average',direction:'higher',basis:'rounds',definition:'Mean of (round field average − player round score) across rounds in full-field leaderboards. Positive = better than the field. Equivalent in construction to round-level total strokes gained; no per-shot categories.'},
 {code:'consistency',label:'Consistency',unit:'standard deviation of field-adjusted round scores',direction:'lower',basis:'rounds',definition:'Sample standard deviation of the player’s field-adjusted round results. Lower = more consistent.'},
 {code:'under_par',label:'Under-par rounds',unit:'% of rounds',direction:'higher',basis:'rounds',definition:'Share of observed full-field rounds completed under the published par.'},
 {code:'cuts',label:'Cuts made',unit:'% of starts',direction:'higher',basis:'starts',definition:'Starts in full-field leaderboards where the player completed all scheduled rounds.'},
 {code:'top10',label:'Top-10 rate',unit:'% of starts',direction:'higher',basis:'starts',definition:'Starts in full-field leaderboards finishing tenth or better (ties included).'},
 {code:'contention',label:'Contention',unit:'% of starts',direction:'higher',basis:'starts',definition:'Starts in full-field leaderboards finishing fifth or better (ties included).'},
 {code:'form',label:'Recent form',unit:'strokes per round vs field, last 10 full-field starts',direction:'higher',basis:'rounds',definition:'Scoring vs field restricted to the player’s ten most recent full-field starts before the as-of date.'},
 {code:'par3',label:'Par-3 scoring',unit:'strokes per hole vs field',direction:'higher',basis:'holes',definition:'Mean of (hole field average − player strokes) on par-3 holes, full-field hole-by-hole events only.'},
 {code:'par4',label:'Par-4 scoring',unit:'strokes per hole vs field',direction:'higher',basis:'holes',definition:'Mean of (hole field average − player strokes) on par-4 holes, full-field hole-by-hole events only.'},
 {code:'par5',label:'Par-5 scoring',unit:'strokes per hole vs field',direction:'higher',basis:'holes',definition:'Mean of (hole field average − player strokes) on par-5 holes, full-field hole-by-hole events only.'},
 {code:'majors',label:'Major performance',unit:'strokes per round vs field in majors',direction:'higher',basis:'rounds',definition:'Scoring vs field restricted to major championships with full-field leaderboards.'}
];
export const HELD=[
 ['driving_power','Driving power'],['driving_control','Driving control'],['off_tee','Off-tee value'],['approach','Approach'],['iron_precision','Iron precision'],['gir','Greens in regulation'],['short_game','Short game'],['scrambling','Scrambling'],['sand','Sand play'],['putting','Putting'],['par3','Par-3 performance'],['par4','Par-4 performance'],['par5','Par-5 performance']
].map(([code,label])=>({code,label,status:'held',reason:/^par/.test(code)?'Hole-by-hole scores exist only for final-round contenders in approved sources; a full-field hole sample is required.':'No approved shot-level or statistics source. PGA TOUR statistics are HOLD (access barrier); Data Golf requires a paid licence decision.'}));
// rounds: [{delta,toPar,editionEnds,major}] ; starts: [{status,position,editionEnds,major}]
export function playerMetrics(rounds,starts){
 const sorted=[...starts].sort((a,b)=>String(b.ends).localeCompare(String(a.ends)));
 const recentEditions=new Set(sorted.slice(0,10).map(s=>s.edition_id));
 const deltas=rounds.map(r=>r.delta).filter(Number.isFinite),pars=rounds.filter(r=>Number.isFinite(r.toPar));
 const made=starts.filter(s=>s.status==='finished'),pct=(n,d)=>d?100*n/d:null;
 const recent=rounds.filter(r=>recentEditions.has(r.edition_id)).map(r=>r.delta).filter(Number.isFinite);
 const major=rounds.filter(r=>r.major).map(r=>r.delta).filter(Number.isFinite);
 return {
  scoring:{value:round2(mean(deltas)),sample:deltas.length,basis:'rounds'},
  consistency:{value:round2(sd(deltas)),sample:deltas.length,basis:'rounds'},
  under_par:{value:round1(pct(pars.filter(r=>r.toPar<0).length,pars.length)),sample:pars.length,basis:'rounds'},
  cuts:{value:round1(pct(made.length,starts.length)),sample:starts.length,basis:'starts',numerator:made.length},
  top10:{value:round1(pct(starts.filter(s=>s.position&&s.position<=10).length,starts.length)),sample:starts.length,basis:'starts',numerator:starts.filter(s=>s.position&&s.position<=10).length},
  contention:{value:round1(pct(starts.filter(s=>s.position&&s.position<=5).length,starts.length)),sample:starts.length,basis:'starts',numerator:starts.filter(s=>s.position&&s.position<=5).length},
  form:{value:round2(mean(recent)),sample:recent.length,basis:'rounds'},
  majors:{value:round2(mean(major)),sample:major.length,basis:'rounds'}
 };
}
// Attach tiers + percentiles for a cohort of {player_id, metrics} in one division/window.
export function rankCohort(entries){
 for(const d of DIMENSIONS){
  if(!entries.some(e=>e.metrics[d.code]))continue; // par-type metrics are added later from hole data
  const eligible=entries.filter(e=>{const m=e.metrics[d.code];return m&&Number.isFinite(m.value)&&tier(m.basis,m.sample)!=='INSUFFICIENT';});
  const values=eligible.map(e=>e.metrics[d.code].value);
  for(const e of entries){const m=e.metrics[d.code];if(!m)continue;m.confidence=tier(m.basis,m.sample);m.cohort_size=values.length;m.percentile=m.confidence==='INSUFFICIENT'?null:percentileOf(m.value,values,d.direction);}
 }
 return entries;
}
