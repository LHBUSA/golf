// Golf Probability Model V1 walk-forward backtest (research; never part of the prospective record).
// node scripts/picks-backtest.mjs <bundle.json> <out.json> [stage=all|tune|eval] [sims]
// Chronological only: an edition is predicted with ratings built from editions that ENDED at least a day before it
// started. Hyperparameters are chosen on the 2024 tuning fold, confirmed on 2025 H1, and the 2025-07-01..as-of
// holdout is scored once with the frozen parameters.
import fs from 'node:fs';
import {RatingBook,compactEdition,cutApplied,outcome,simulate,pairProb,cutRule,byEnd,PARAMS,MODEL_VERSION,DAY,seedOf,rng} from '../workers/shared/picks/model.js';
import {forecast,gradeSelection,POLICY_VERSION,formatExcluded} from '../workers/shared/picks/policy.js';
const [,,bundlePath,outPath,stage='all',simArg]=process.argv;
const b=JSON.parse(fs.readFileSync(bundlePath,'utf8'));
const AS_OF=b.index.as_of.slice(0,10);
// Leaderboard rows arrive in finishing order: shuffle (seeded) so no tie-break anywhere can read the result.
const shuffle=(xs,seed)=>{const R=rng(seedOf(seed)),a=xs.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(R()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
const eds=b.editions.map(compactEdition).filter(e=>e&&e.ends_on<AS_OF).map(e=>({...e,rows:shuffle(e.rows,'rows|'+e.slug)})).sort((a,c)=>a.starts_on<c.starts_on?-1:a.starts_on>c.starts_on?1:0);
b.editions=null;
const FOLDS={tune:['2024-01-01','2024-12-31'],validate:['2025-01-01','2025-06-30'],holdout:['2025-07-01',AS_OF]};
const foldOf=e=>Object.entries(FOLDS).find(([,[a,z]])=>e.starts_on>=a&&e.starts_on<=z)?.[0]||null;
const priorCut=new Map();// tournament -> had a real cut at its latest completed edition (time-safe at use)
const clip=p=>Math.min(1-1e-4,Math.max(1e-4,p)),ll=(p,y)=>-(y?Math.log(clip(p)):Math.log(1-clip(p)));

// Walk forward. visit(ed, book, prior) is called before ed is ingested.
function walk(params,visit,{from='2024-01-01'}={}){
 const book=new RatingBook(params),pending=eds.slice().sort(byEnd);let pi=0;const prior=new Map();
 for(const ed of eds){
  const t=Date.parse(ed.starts_on);
  while(pi<pending.length&&Date.parse(pending[pi].ends_on)+DAY<=t){const p=pending[pi++];book.update(p);if(p.tournament)prior.set(p.tournament,{cut:cutApplied(p.rows),rounds:p.rounds_played});}
  if(ed.starts_on>=from)visit(ed,book,prior);
 }
}
// Stage A: rating quality = Gaussian NLL of each round residual under the pre-event prediction (2024 fold).
function nll(params){
 let s=0,n=0;
 walk(params,(ed,book)=>{if(foldOf(ed)!=='tune')return;const t0=Date.parse(ed.starts_on),pre=new Map(ed.rows.map(r=>[r.s,book.predict(r.s,t0)]));
  for(let i=0;i<4;i++){const rs=ed.rows.filter(r=>r.r[i]!==null&&r.r[i]!==undefined);if(rs.length<10)continue;const mean=rs.reduce((a,r)=>a+r.r[i],0)/rs.length,str=rs.reduce((a,r)=>a+pre.get(r.s).mu,0)/rs.length;
   for(const r of rs){const p=pre.get(r.s),x=r.r[i]-mean+str,v=p.sd*p.sd+p.se*p.se;s+=0.5*Math.log(2*Math.PI*v)+(x-p.mu)**2/(2*v);n++;}}});
 return {nll:s/n,n};
}
// Field + outcomes for one edition.
function fieldOf(ed,book){const t0=Date.parse(ed.starts_on);return ed.rows.map(r=>({slug:r.s,name:r.n,...book.predict(r.s,t0)}));}
function truth(ed){const cut=cutApplied(ed.rows);return ed.rows.map(r=>{const o=outcome(r,cut);return {o,win:r.w,top10:o==='finished'&&r.p<=10,top20:o==='finished'&&r.p<=20,made:o==='finished'||(['withdrawn','disqualified'].includes(o)&&r.r.filter(v=>v!==null).length>=3),mc_eval:cut&&['finished','missed_cut'].includes(o)};});}
// Naive history baseline: smoothed empirical rates over prior full-field starts (no decay, no field adjustment).
function naiveRates(hist,slug,N,cutRank){const h=hist.get(slug)||{c:0,w:0,t10:0,t20:0,mc:0,mcn:0};const a=5,base={w:1/N,t10:Math.min(1,10/N),t20:Math.min(1,20/N),mc:cutRank?Math.min(1,cutRank/N):1};
 return {win:(h.w+a*base.w)/(h.c+a),top10:(h.t10+a*base.t10)/(h.c+a),top20:(h.t20+a*base.t20)/(h.c+a),make_cut:(h.mc+a*base.mc)/(h.mcn+a)};}
function naiveRating(hist,slug){const h=hist.get(slug);return h&&h.vs.length?{mu:-h.vs.reduce((a,v)=>a+v,0)/h.vs.length,sd:PARAMS.sigma0,se:0}:{mu:0,sd:PARAMS.sigma0,se:0};}

function evaluate(params,{folds,sims,withBaselines=false,policy=false}){
 const acc={},hist=new Map(),policyRows=[],perEdition=[];
 const A=(k)=>acc[k]||(acc[k]={editions:0,win:{ll:0,brier:0,top1:0,rank:0,n:0},top10:new Bin(),top20:new Bin(),make_cut:new Bin(),h2h:{n:0,correct:0,ll:0,ties:0}});
 const pending=eds.slice().sort(byEnd);let pi=0;
 const addHist=ed=>{const cut=cutApplied(ed.rows),T=truth(ed);ed.rows.forEach((r,i)=>{const h=hist.get(r.s)||{c:0,w:0,t10:0,t20:0,mc:0,mcn:0,vs:[]};const o=T[i].o;if(o!=='dns'){h.c++;if(r.w)h.w++;if(T[i].top10)h.t10++;if(T[i].top20)h.t20++;if(T[i].mc_eval){h.mcn++;if(T[i].made)h.mc++;}}hist.set(r.s,h);});
  for(let i=0;i<4;i++){const rs=ed.rows.filter(r=>r.r[i]!==null&&r.r[i]!==undefined);if(rs.length<10)continue;const m=rs.reduce((a,r)=>a+r.r[i],0)/rs.length;for(const r of rs){const h=hist.get(r.s);h.vs.push(m-r.r[i]);if(h.vs.length>200)h.vs.shift();}}};
 walk(params,(ed,book,prior)=>{
  while(pi<pending.length&&Date.parse(pending[pi].ends_on)+DAY<=Date.parse(ed.starts_on))addHist(pending[pi++]);
  const fold=foldOf(ed);if(!folds.includes(fold)||formatExcluded(ed.slug))return;
  const field=fieldOf(ed,book),T=truth(ed),N=field.length,pr=ed.tournament?prior.get(ed.tournament):null,priorHadCut=pr?pr.cut:null;
  const rounds=pr?.rounds===3?3:4,cutRank=cutRule(ed,N,priorHadCut);
  const models={model:simulate(field,{sims,rounds,cutRank,seed:ed.slug,spread:params.spread,seUnc:params.seUnc})};
  if(withBaselines){
   models.field_equal={players:field.map(()=>({win:1/N,top10:Math.min(1,10/N),top20:Math.min(1,20/N),make_cut:cutRank?Math.min(1,cutRank/N):null})),keys:null};
   const nr=field.map(p=>naiveRates(hist,p.slug,N,cutRank)),z=nr.reduce((a,p)=>a+p.win,0);models.naive_history={players:nr.map(p=>({...p,win:p.win/z,make_cut:cutRank?p.make_cut:null})),keys:null};
   models.naive_rating=simulate(field.map(p=>({slug:p.slug,...naiveRating(hist,p.slug)})),{sims,rounds,cutRank,seed:ed.slug,spread:1,seUnc:0});
  }
  const winners=ed.rows.filter(r=>r.w).length;
  // H2H evaluation pairs: 60 seeded random pairs per edition (same pairs for every model).
  const R=rng(seedOf('pairs|'+ed.slug)),pairs=[];for(let q=0;q<60;q++){const a=Math.floor(R()*N),c=Math.floor(R()*N);if(a!==c)pairs.push([a,c]);}
  const strata=[fold,'all:'+fold,`${ed.division==='women'?'LPGA':'PGA'}:${fold}`,`${ed.is_major?'major':'non-major'}:${fold}`,`field_${N>=120?'120+':N>=90?'90-119':'<90'}:${fold}`];
  for(const [name,M] of Object.entries(models)){
   for(const st of strata.slice(1)){const S=A(name+'|'+st);S.editions++;
    if(winners===1){const wi=ed.rows.findIndex(r=>r.w),p=M.players[wi].win;S.win.ll+=-Math.log(clip(p));S.win.brier+=M.players.reduce((a,x,i)=>a+(x.win-(i===wi?1:0))**2,0);const gt=M.players.filter(x=>x.win>p).length,eq=M.players.filter(x=>x.win===p).length;S.win.rank+=1+gt+(eq-1)/2;if(!gt)S.win.top1+=1/eq;S.win.n++;}
    for(const fam of ['top10','top20','make_cut']){for(let i=0;i<N;i++){const p=M.players[i][fam];if(p===null||p===undefined)continue;if(T[i].o==='dns')continue;if(fam==='make_cut'&&!T[i].mc_eval)continue;S[fam].add(p,fam==='make_cut'?T[i].made:T[i][fam]);}
     if(fam!=='make_cut'){const k=fam==='top10'?10:20;const top=M.players.map((x,i)=>[x[fam],i]).sort((a,c)=>c[0]-a[0]).slice(0,k);S[fam].prec+=top.filter(([,i])=>T[i][fam]).length;S[fam].precN+=k;
      // Outside the chalk: model's 11th-30th ranked golfers (by win probability) only.
      const ranked=M.players.map((x,i)=>[x.win,i]).sort((a,c)=>c[0]-a[0]).slice(10,30);for(const [,i] of ranked){if(T[i].o==='dns')continue;S[fam].offChalk.add(M.players[i][fam],T[i][fam]);}}}
    if(M.keys||name==='model'){for(const [a,c] of pairs){const oa=T[a].o,oc=T[c].o;if(['withdrawn','disqualified','dns'].includes(oa)||['withdrawn','disqualified','dns'].includes(oc))continue;
      const g=gradeSelection({family:'h2h',slug:ed.rows[a].s,opponent:{slug:ed.rows[c].s}},{status:'final',rounds_completed:4,rows:ed.rows});if(g.grade==='VOID'){S.h2h.ties++;continue;}
      const p=M.keys?pairProb(M,a,c).p:0.5;S.h2h.n++;S.h2h.ll+=ll(p,g.grade==='WIN');if((p>0.5)===(g.grade==='WIN')&&p!==0.5)S.h2h.correct++;else if(p===0.5)S.h2h.correct+=0.5;}}
    else{for(const [a,c] of pairs){const g=gradeSelection({family:'h2h',slug:ed.rows[a].s,opponent:{slug:ed.rows[c].s}},{status:'final',rounds_completed:4,rows:ed.rows});if(g.grade==='VOID'||['withdrawn','disqualified','dns'].includes(T[a].o)||['withdrawn','disqualified','dns'].includes(T[c].o))continue;S.h2h.n++;S.h2h.ll+=ll(0.5,true);S.h2h.correct+=0.5;}}
   }
  }
  const wi=ed.rows.findIndex(r=>r.w);perEdition.push({slug:ed.slug,fold,division:ed.division,major:ed.is_major,field:N,cut:cutRank,winner_p:wi>=0?Math.round(models.model.players[wi].win*1e4)/1e4:null,winner_rank:wi>=0?1+models.model.players.filter(x=>x.win>models.model.players[wi].win).length:null});
  if(policy){const f=forecast({edition:ed,field,priorHadCut,rounds,seed:ed.slug,sims});for(const s of f.selections){const g=gradeSelection(s,{status:'final',rounds_completed:Math.max(...ed.rows.map(r=>r.r.filter(v=>v!==null).length)),rows:ed.rows});
   const winRank=1+f.probabilities.findIndex(p=>p.slug===s.slug);policyRows.push({fold,division:ed.division,family:s.family,p:s.p,grade:g.grade,chalk:winRank<=5});}}
 });
 return {acc:Object.fromEntries(Object.entries(acc).map(([k,v])=>[k,summarize(v)])),perEdition,policy:policy?policySummary(policyRows):null};
}
class Bin{constructor(){this.ps=[];this.ys=[];this.prec=0;this.precN=0;this.offChalk=null;}add(p,y){this.ps.push(p);this.ys.push(y?1:0);if(!this.offChalk)this.offChalk={ps:[],ys:[],add(p,y){this.ps.push(p);this.ys.push(y?1:0);}};}}
function binStats(ps,ys){const n=ps.length;if(!n)return null;let L=0,B=0;for(let i=0;i<n;i++){L+=ll(ps[i],ys[i]);B+=(ps[i]-ys[i])**2;}
 const bins=Array.from({length:10},()=>({n:0,p:0,y:0}));for(let i=0;i<n;i++){const k=Math.min(9,Math.floor(ps[i]*10));bins[k].n++;bins[k].p+=ps[i];bins[k].y+=ys[i];}
 const ece=bins.reduce((a,b)=>a+(b.n?Math.abs(b.p-b.y):0),0)/n;
 return {n,log_loss:r(L/n),brier:r(B/n),ece:r(ece),base_rate:r(ys.reduce((a,v)=>a+v,0)/n),mean_p:r(ps.reduce((a,v)=>a+v,0)/n),reliability:bins.filter(b=>b.n).map((b,i)=>({mean_p:r(b.p/b.n),observed:r(b.y/b.n),n:b.n}))};}
const r=v=>Math.round(v*10000)/10000;
function summarize(S){const o={editions:S.editions,winner:S.win.n?{n:S.win.n,log_loss:r(S.win.ll/S.win.n),brier:r(S.win.brier/S.win.n),top1:r(S.win.top1/S.win.n),mean_winner_rank:r(S.win.rank/S.win.n)}:null,h2h:S.h2h.n?{n:S.h2h.n,voids:S.h2h.ties,accuracy:r(S.h2h.correct/S.h2h.n),log_loss:r(S.h2h.ll/S.h2h.n)}:null};
 for(const f of ['top10','top20','make_cut']){const x=S[f];o[f]=binStats(x.ps,x.ys);if(o[f]&&x.precN)o[f].precision_at_k=r(x.prec/x.precN);if(o[f]&&x.offChalk?.ps.length)o[f].outside_top10_by_win=binStats(x.offChalk.ps,x.offChalk.ys);if(o[f])delete o[f].reliability_full;}
 return o;}
function policySummary(rows){const out={};for(const x of rows){for(const k of [`${x.fold}|${x.family}`,`${x.fold}|${x.family}|${x.chalk?'chalk(top5 win p)':'outside top5'}`,`${x.fold}|${x.division==='women'?'LPGA':'PGA'}|${x.family}`]){const o=out[k]||(out[k]={selections:0,WIN:0,LOSS:0,VOID:0,expected_wins:0});o.selections++;o[x.grade]++;if(x.grade!=='VOID')o.expected_wins+=x.p;}}
 for(const o of Object.values(out)){o.expected_wins=Math.round(o.expected_wins*10)/10;o.hit_rate=o.WIN+o.LOSS?r(o.WIN/(o.WIN+o.LOSS)):null;}return out;}

const result={model:MODEL_VERSION,policy:POLICY_VERSION,as_of:AS_OF,generated_at:new Date().toISOString(),data:{bundle_as_of:b.index.as_of,full_field_editions:eds.length,folds:FOLDS,
 editions_by_fold:Object.fromEntries(Object.keys(FOLDS).map(f=>[f,eds.filter(e=>foldOf(e)===f&&!formatExcluded(e.slug)).length]))}};
if(stage==='all'||stage==='tune'){
 const grid=[];for(const tau of [180,365,730])for(const k of [3,6,12])for(const mu0 of [0.5,1,1.5,2])for(const kv of [10,20,40])grid.push({tau,k,mu0,kv});
 const t0=Date.now();const scored=grid.map(g=>({...g,...nll({...PARAMS,...g})})).sort((a,c)=>a.nll-c.nll);
 result.tuning_stage_a={metric:'mean Gaussian NLL of round residuals, 2024 fold',best:scored[0],top5:scored.slice(0,5),configs:grid.length,ms:Date.now()-t0};
 const base={...PARAMS,tau:scored[0].tau,k:scored[0].k,mu0:scored[0].mu0,kv:scored[0].kv};
 const sb=[];for(const spread of [0.9,1,1.1])for(const seUnc of [0,1]){const ev=evaluate({...base,spread,seUnc},{folds:['tune'],sims:3000});const a=ev.acc['model|all:tune'];sb.push({spread,seUnc,score:r(a.winner.log_loss/10+a.top10.log_loss+a.top20.log_loss+(a.make_cut?.log_loss||0)),winner_ll:a.winner.log_loss,top10_ll:a.top10.log_loss,top20_ll:a.top20.log_loss,make_cut_ll:a.make_cut?.log_loss});}
 sb.sort((a,c)=>a.score-c.score);result.tuning_stage_b={metric:'winner_ll/10 + top10_ll + top20_ll + make_cut_ll, 2024 fold, 3000 sims',results:sb};
 result.frozen_params={...base,spread:sb[0].spread,seUnc:sb[0].seUnc};
}
if(stage==='all'||stage==='eval'){
 const params=result.frozen_params||PARAMS,sims=Number(simArg)||20000;
 const ev=evaluate(params,{folds:['validate','holdout'],sims,withBaselines:true,policy:true});
 result.params_used=params;result.sims=sims;result.metrics=ev.acc;result.policy_backtest=ev.policy;result.per_edition=ev.perEdition;
}
fs.writeFileSync(outPath,JSON.stringify(result,null,1));
console.log(JSON.stringify({frozen:result.frozen_params||null,holdout:result.metrics?.['model|all:holdout']?.winner||null}));
