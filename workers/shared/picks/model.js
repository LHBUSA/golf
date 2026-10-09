// Golf Probability Model V1 (golf-prob/1.0.0). Pure functions shared by the golf-ingest lock step, the golf-api
// views and the offline walk-forward backtest (scripts/picks-backtest.mjs). No I/O here.
//
// Inputs are ONLY observed round scores from `full_field` editions (missed-cut rows listed, field complete), so
// the rating never learns from survivor-biased leaderboards. Partial rounds (<55 strokes, mid-round WD) are
// excluded. No strokes-gained, rankings, odds or weather enter the model.
//
// Rating: each round becomes a field-relative residual  x = (strokes - round field mean) + mean pre-event rating of
// the players in that round  (field-strength adjustment: shooting the field average in a strong field is worth more).
// Residuals are time-decayed (half-life via tau days) and shrunk toward a newcomer prior mu0 with k pseudo-rounds.
// Per-player variance is shrunk toward the population sigma0 with kv pseudo-rounds. Lower = better (strokes).
// Simulation: 4 rounds (or the tournament's prior format), cut after round 2 when the event has one, integer
// strokes so ties happen, playoff = uniform among those tied for first. One joint simulation produces winner,
// top 10, top 20, make cut and head-to-head probabilities, so the families agree with each other.
export const MODEL_VERSION='golf-prob/1.0.0';
export const MIN_ROUND=55;
export const DAY=86400000;
// Frozen on the 2024 tuning fold (docs/PICKS_V1.md, docs/evidence/picks-v1-backtest.json). Never re-tuned on the
// holdout or on prospective results; a change is a new MODEL_VERSION.
export const PARAMS=Object.freeze({tau:730,k:3,mu0:0.5,sigma0:2.9,kv:40,spread:1.0,seUnc:0});

export const validRound=s=>Number.isFinite(s)&&s>=MIN_ROUND&&s<=99;
// Compact, model-only view of a projection edition (full_field only). Rows keep status/position for grading.
export function compactEdition(doc){
 if(!doc||doc.coverage!=='full_field'||!Array.isArray(doc.leaderboard)||!doc.leaderboard.length)return null;
 return {slug:doc.slug,name:doc.name,tournament:doc.tournament?.slug||null,starts_on:doc.starts_on,ends_on:doc.ends_on||doc.starts_on,division:doc.division,is_major:Boolean(doc.is_major),tour:doc.tour?.key||null,
  rounds_played:doc.event_record?.rounds_played??null,
  rows:doc.leaderboard.filter(r=>r.player?.slug).map(r=>({s:r.player.slug,n:r.player.name,st:r.status,p:r.position??null,t:r.tied??null,w:Boolean(r.winner),r:(r.rounds||[]).map(x=>validRound(x.strokes)?x.strokes:null)}))};
}
// A real cut: at least 5 rows and 10% of the field marked cut. ESPN marks a lone early withdrawal "cut" in no-cut
// events (Baycurrent 2024, Shanghai 2023/2025): that is a withdrawal, not a cut.
export function cutApplied(rows){const c=rows.filter(r=>r.st==='cut').length;return c>=5&&c>=0.1*rows.length;}
// Outcome status used by the grader and the evaluation: finished | missed_cut | withdrawn | disqualified | dns.
export function outcome(row,cut){
 const played=(row.r||[]).filter(v=>v!==null).length;
 if(row.st==='disqualified')return 'disqualified';
 if(row.st==='withdrawn')return played?'withdrawn':'dns';
 if(row.st==='dns')return 'dns';
 if(row.st==='cut')return cut&&played>=2?'missed_cut':played?'withdrawn':'dns';
 if(row.p===null||row.p===undefined)return played?'withdrawn':'dns';
 return 'finished';
}

export class RatingBook{
 constructor(params=PARAMS){this.p={...PARAMS,...params};this.players=new Map();}
 state(slug){return this.players.get(slug)||null;}
 // Prediction for one golfer at a date (ms). Unknown golfers get the newcomer prior with full uncertainty.
 predict(slug,at){
  const {tau,k,mu0,sigma0,kv}=this.p,st=this.players.get(slug);
  if(!st)return {mu:mu0,sd:sigma0,se:sigma0/Math.sqrt(k),w:0,rounds:0,starts:0,last:null};
  const f=Math.exp(-Math.max(0,at-st.t)/(tau*DAY)),W=st.W*f,S=st.S*f,Q=st.Q*f;
  const mean=W>0?S/W:0,raw=W>1?Math.max(0,Q/W-mean*mean):sigma0*sigma0;
  const mu=(S+k*mu0)/(W+k),v=(W*raw+kv*sigma0*sigma0)/(W+kv);
  return {mu,sd:Math.sqrt(v),se:Math.sqrt(v/(W+k)),w:W,rounds:st.n,starts:st.e,last:st.last};
 }
 // Ingest one completed full-field edition (time order is the caller's job: only after it ended).
 update(ed){
  const t0=Date.parse(ed.starts_on);const pre=new Map(ed.rows.map(r=>[r.s,this.predict(r.s,t0).mu]));
  const maxR=Math.max(0,...ed.rows.map(r=>r.r.length));
  for(let i=0;i<maxR;i++){
   const rs=ed.rows.filter(r=>r.r[i]!==null&&r.r[i]!==undefined);if(rs.length<10)continue;
   const mean=rs.reduce((a,r)=>a+r.r[i],0)/rs.length,str=rs.reduce((a,r)=>a+pre.get(r.s),0)/rs.length,t=t0+i*DAY;
   for(const r of rs)this.add(r.s,r.r[i]-mean+str,t);
  }
  for(const r of ed.rows){const st=this.players.get(r.s);if(st&&r.r.some(v=>v!==null)){st.e++;st.last=ed.ends_on;}}
 }
 add(slug,x,t){
  let st=this.players.get(slug);if(!st){st={W:0,S:0,Q:0,n:0,e:0,t,last:null};this.players.set(slug,st);}
  const f=Math.exp(-Math.max(0,t-st.t)/(this.p.tau*DAY));st.W=st.W*f+1;st.S=st.S*f+x;st.Q=st.Q*f+x*x;st.n++;st.t=Math.max(st.t,t);
 }
}
// Replays a list of compact editions in end-date order, ingesting only those that ended strictly before `at`.
export function bookAt(editions,at,params=PARAMS){const b=new RatingBook(params);for(const ed of editions.slice().sort(byEnd))if(Date.parse(ed.ends_on)+DAY<=at)b.update(ed);return b;}
export const byEnd=(a,b)=>a.ends_on<b.ends_on?-1:a.ends_on>b.ends_on?1:a.slug<b.slug?-1:1;

// Deterministic PRNG (mulberry32) seeded from a string, so a lock's probabilities are reproducible from its inputs.
export function seedOf(str){let h=2166136261>>>0;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}return h;}
export function rng(seed){let a=seed>>>0;return ()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
function normal(r){let u=0;while(u===0)u=r();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*r());}

// Joint tournament simulation. players: [{slug, mu, sd, se}]. Returns per-player probabilities plus the per-sim
// finishing keys needed for any head-to-head pair (keys: lower = better; missed cut sorts behind every made cut).
export function simulate(players,{sims=20000,rounds=4,cutRank=null,seed='golf',spread=PARAMS.spread,seUnc=PARAMS.seUnc,keepKeys=true}={}){
 const n=players.length,r=rng(seedOf(String(seed))),win=new Float64Array(n),t10=new Float64Array(n),t20=new Float64Array(n),mc=new Float64Array(n),pos=new Float64Array(n);
 const keys=keepKeys?new Float32Array(sims*n):null,skill=new Float64Array(n),tot=new Float64Array(n),two=new Float64Array(n),key=new Float64Array(n),idx=new Int32Array(n);
 const cut=cutRank&&rounds>2&&n>cutRank;
 for(let s=0;s<sims;s++){
  for(let i=0;i<n;i++){const p=players[i];skill[i]=p.mu+seUnc*p.se*normal(r);let t=0,t2=0;for(let k=0;k<rounds;k++){const x=Math.round(skill[i]+spread*p.sd*normal(r));t+=x;if(k<2)t2+=x;}tot[i]=t;two[i]=t2;}
  let made=null;
  if(cut){for(let i=0;i<n;i++)idx[i]=i;const o=Array.from(idx).sort((a,b)=>two[a]-two[b]);const line=two[o[cutRank-1]];made=new Uint8Array(n);for(let i=0;i<n;i++)made[i]=two[i]<=line?1:0;}
  for(let i=0;i<n;i++)key[i]=made&&!made[i]?10000+two[i]:tot[i];
  const order=Array.from({length:n},(_,i)=>i).sort((a,b)=>key[a]-key[b]);
  // Position = 1 + number strictly better (ties share a position, as in the official result).
  let best=key[order[0]],lead=[];for(const i of order){if(key[i]===best)lead.push(i);else break;}
  win[lead[Math.floor(r()*lead.length)]]++;
  let j=0;while(j<n){let m=j;while(m+1<n&&key[order[m+1]]===key[order[j]])m++;const position=j+1;for(let q=j;q<=m;q++){const i=order[q];pos[i]+=position;if(position<=10)t10[i]++;if(position<=20)t20[i]++;}j=m+1;}
  for(let i=0;i<n;i++){if(!made||made[i])mc[i]++;if(keys)keys[s*n+i]=key[i];}
 }
 return {sims,rounds,cut:Boolean(cut),cutRank:cut?cutRank:null,keys,n,
  players:players.map((p,i)=>({slug:p.slug,win:win[i]/sims,top10:t10[i]/sims,top20:t20[i]/sims,make_cut:cut?mc[i]/sims:null,exp_pos:pos[i]/sims}))};
}
// P(A finishes ahead of B | not tied), and P(tie). Same finishing key = same position = tie (VOID by policy).
export function pairProb(sim,a,b){
 const {keys,n,sims}=sim;let ahead=0,tie=0;for(let s=0;s<sims;s++){const x=keys[s*n+a],y=keys[s*n+b];if(x<y)ahead++;else if(x===y)tie++;}
 const decided=sims-tie;return {p:decided?ahead/decided:0.5,tie:tie/sims};
}
// Cut size by tour format (top N and ties after 36 holes). Majors carry their own published rules.
const MAJOR_CUT=[[/masters/,50],[/u-?s-open|us-open|united-states-open/,60],[/open-championship|the-open/,70],[/pga-championship/,70]];
export function cutRule({slug='',division,is_major},fieldSize,priorHadCut){
 if(priorHadCut===false)return null;
 if(priorHadCut===null||priorHadCut===undefined){if(fieldSize<=84)return null;}
 if(is_major&&division==='men'){for(const [re,n] of MAJOR_CUT)if(re.test(slug))return n;}
 return division==='women'&&is_major?70:65;
}
// Field model: ratings for every entrant at `at`, using only editions that ended before `at`.
export function fieldModel(book,entrants,at){return entrants.map(e=>({slug:e.slug,name:e.name||null,...book.predict(e.slug,at)}));}
