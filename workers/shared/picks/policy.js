// Golf Picks publication + grading policy V1 (golf-picks-policy/1.0.0). FROZEN before the first prospective lock;
// any change is a new POLICY_VERSION and never regrades an earlier lock. docs/PICKS_V1.md is the human copy.
import {MODEL_VERSION,simulate,pairProb,cutRule,outcome,cutApplied} from './model.js';
export const POLICY_VERSION='golf-picks-policy/1.0.0';
export const FAMILIES=['winner','top10','top20','make_cut','h2h'];
export const FAMILY_LABEL={winner:'TOURNAMENT WINNER',top10:'TOP 10',top20:'TOP 20',make_cut:'MAKE CUT',h2h:'HEAD TO HEAD'};
// Eligibility: individual stroke play, a published field of at least 30, and enough rated golfers.
export const RULES=Object.freeze({
 min_field:30,min_rated_share:0.6,min_selection_rounds:12,sims:20000,
 top10:{count:3,min_p:0.2},top20:{count:3,min_p:0.3},make_cut:{count:3,min_p:0.6},h2h:{count:3,pool:40,min_p:0.55},
 // Team, match-play and pro-am-team formats are not individual stroke play.
 excluded_formats:[/zurich/i,/dow-(great-lakes-bay|championship)/i,/match-play/i,/presidents-cup/i,/ryder-cup/i,/solheim-cup/i,/hero-world-challenge/i,/grant-thornton/i,/qbe-shootout/i,/international-crown/i],
});
export const formatExcluded=slug=>RULES.excluded_formats.some(re=>re.test(slug||''));

// Builds the forecast + selections for one tournament from a field model (players with mu/sd/se/rounds).
// Selections are the BEST AVAILABLE VALID FORECASTS per family, not "locks": every one is graded in its family.
export function forecast({edition,field,priorHadCut,rounds=4,seed,sims}){
 const n=field.length,rated=field.filter(p=>p.rounds>=RULES.min_selection_rounds).length;
 const cutRank=cutRule(edition,n,priorHadCut);
 const sim=simulate(field,{sims:sims||RULES.sims,rounds,cutRank,seed:seed||edition.slug+'|'+MODEL_VERSION});
 const rows=sim.players.map((p,i)=>({...p,i,name:field[i].name||null,rounds:field[i].rounds,mu:field[i].mu,sd:field[i].sd,starts:field[i].starts,last:field[i].last}));
 const eligible=n>=RULES.min_field&&rated/n>=RULES.min_rated_share&&!formatExcluded(edition.slug);
 const out={model:MODEL_VERSION,policy:POLICY_VERSION,field_size:n,rated_golfers:rated,rated_share:n?rated/n:0,cut:{applies:sim.cut,rank:sim.cutRank,prior_edition_had_cut:priorHadCut??null},rounds,sims:sim.sims,eligible,
  probabilities:rows.map(r=>({slug:r.slug,name:r.name,win:r4(r.win),top10:r4(r.top10),top20:r4(r.top20),make_cut:r.make_cut===null?null:r4(r.make_cut),exp_pos:Math.round(r.exp_pos*10)/10,rounds_rated:r.rounds,rating:Math.round(r.mu*100)/100,round_sd:Math.round(r.sd*100)/100})).sort((a,b)=>b.win-a.win||a.exp_pos-b.exp_pos),
  unmodeled_win_mass:0,selections:[]};
 if(!eligible)return out;
 const ok=r=>r.rounds>=RULES.min_selection_rounds;
 const facts=r=>({rounds_rated:r.rounds,starts_rated:r.starts,last_start:r.last,rating_strokes_vs_field:Math.round(r.mu*100)/100,round_sd:Math.round(r.sd*100)/100});
 const sel=(family,r,p,extra={})=>({family,proposition:family==='winner'?'WIN':family==='make_cut'?'MAKE CUT':family==='top10'?'TOP 10':family==='top20'?'TOP 20':'FINISH AHEAD',slug:r.slug,name:r.name,p:r4(p),factors:facts(r),...extra});
 const used=new Set();
 // Winner: the single highest modeled probability (shown with its probability; never called a strong pick).
 const w=rows.filter(ok).sort((a,b)=>b.win-a.win)[0];if(w){out.selections.push(sel('winner',w,w.win));used.add(w.slug);}
 for(const fam of ['top10','top20']){const R=RULES[fam];for(const r of rows.filter(r=>ok(r)&&!used.has(r.slug)&&r[fam]>=R.min_p).sort((a,b)=>b[fam]-a[fam]).slice(0,R.count)){out.selections.push(sel(fam,r,r[fam]));used.add(r.slug);}}
 if(sim.cut){const R=RULES.make_cut;for(const r of rows.filter(r=>ok(r)&&!used.has(r.slug)&&r.make_cut>=R.min_p).sort((a,b)=>b.make_cut-a.make_cut).slice(0,R.count)){out.selections.push(sel('make_cut',r,r.make_cut));used.add(r.slug);}}
 // Head to head: neighbours in expected finish among the top `pool`; the three most decisive pairs.
 const pool=rows.filter(ok).sort((a,b)=>a.exp_pos-b.exp_pos).slice(0,RULES.h2h.pool),pairs=[];
 for(let j=0;j+1<pool.length;j+=2){const a=pool[j],b=pool[j+1],pp=pairProb(sim,a.i,b.i);const fav=pp.p>=0.5?[a,b,pp.p]:[b,a,1-pp.p];pairs.push({a:fav[0],b:fav[1],p:fav[2],tie:pp.tie});}
 for(const x of pairs.filter(x=>x.p>=RULES.h2h.min_p).sort((a,b)=>b.p-a.p).slice(0,RULES.h2h.count))out.selections.push(sel('h2h',x.a,x.p,{opponent:{slug:x.b.slug,name:x.b.name},p_tie:r4(x.tie)}));
 return out;
}
const r4=v=>Math.round(v*10000)/10000;

// ---- Grading (frozen). result: {status:'final'|'cancelled'|'abandoned', rounds_completed, rows:[{s,st,p,t,w,r}]}
// WIN / LOSS / VOID; PENDING until an official final result exists.
//  winner   WIN = official winner (playoff winner included). Co-winners declared without a playoff -> VOID.
//           DNS -> VOID. WD/DQ after starting -> LOSS.
//  top10/20 WIN = official position <= N, ties included (T10 is a top 10). Missed cut -> LOSS. WD/DQ after
//           starting -> LOSS. DNS -> VOID.
//  make_cut Only when a real cut was made. WIN = made the cut (a later WD keeps WIN). Missed cut -> LOSS.
//           WD/DQ/DNS before the cut -> VOID. No cut made (format, shortened to 36 holes or fewer) -> VOID.
//  h2h      Finish ahead: better official position; made cut beats missed cut; both missed: lower 36-hole total.
//           Same position or same 36-hole total -> VOID. Either golfer WD/DQ/DNS -> VOID.
//  Event    Cancelled/abandoned, or fewer than 36 holes official -> every selection VOID.
export const GRADE_VERSION='golf-picks-grade/1.0.0';
export function gradeSelection(sel,result){
 if(!result||result.status==='pending')return {grade:'PENDING',reason:'awaiting official result'};
 if(result.status!=='final'||(result.rounds_completed??0)<2)return {grade:'VOID',reason:'event cancelled, abandoned or under 36 holes'};
 const cut=cutApplied(result.rows),by=new Map(result.rows.map(r=>[r.s,r])),row=by.get(sel.slug);
 const fin=r=>r?outcome(r,cut):'dns',pos=r=>r?.p??null,label=r=>{const o=fin(r);return o==='finished'?(r.t?'T':'')+r.p:o==='missed_cut'?'MC':o==='withdrawn'?'WD':o==='disqualified'?'DQ':'DNS';};
 const o=fin(row),actual=label(row);
 if(sel.family==='winner'){
  if(o==='dns')return {grade:'VOID',reason:'did not start',actual};
  const winners=result.rows.filter(r=>r.w);if(winners.length>1&&winners.some(r=>r.s===sel.slug))return {grade:'VOID',reason:'co-winners declared',actual};
  return {grade:row?.w?'WIN':'LOSS',reason:row?.w?'won the tournament':'did not win',actual};
 }
 if(sel.family==='top10'||sel.family==='top20'){const N=sel.family==='top10'?10:20;
  if(o==='dns')return {grade:'VOID',reason:'did not start',actual};
  if(o==='finished'&&pos(row)<=N)return {grade:'WIN',reason:`finished ${actual} (ties count)`,actual};
  return {grade:'LOSS',reason:o==='finished'?`finished ${actual}`:o==='missed_cut'?'missed the cut':o==='withdrawn'?'withdrew':'disqualified',actual};
 }
 if(sel.family==='make_cut'){
  if(!cut)return {grade:'VOID',reason:'no cut was made',actual};
  const played=(row?.r||[]).filter(v=>v!==null).length;
  if(o==='finished'||((o==='withdrawn'||o==='disqualified')&&played>=3))return {grade:'WIN',reason:'made the cut',actual};
  if(o==='missed_cut')return {grade:'LOSS',reason:'missed the cut',actual};
  return {grade:'VOID',reason:o==='dns'?'did not start':o==='withdrawn'?'withdrew before the cut':'disqualified before the cut',actual};
 }
 if(sel.family==='h2h'){
  const b=by.get(sel.opponent?.slug),ob=fin(b),act=`${actual} vs ${label(b)}`;
  if(['withdrawn','disqualified','dns'].includes(o)||['withdrawn','disqualified','dns'].includes(ob))return {grade:'VOID',reason:'a golfer withdrew, was disqualified or did not start',actual:act};
  const rank=(r,x)=>x==='finished'?[0,r.p]:[1,(r.r[0]??99)+(r.r[1]??99)];const A=rank(row,o),B=rank(b,ob);
  if(A[0]===B[0]&&A[1]===B[1])return {grade:'VOID',reason:'tied',actual:act};
  const ahead=A[0]<B[0]||(A[0]===B[0]&&A[1]<B[1]);return {grade:ahead?'WIN':'LOSS',reason:ahead?'finished ahead':'finished behind',actual:act};
 }
 return {grade:'VOID',reason:'unknown family'};
}
