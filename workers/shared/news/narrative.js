// Narrative context layer. Every value here is computed deterministically from data already in the packet's
// sources (final leaderboard, round scores, published hole cards, Player DNA, recent results). Nothing is
// inferred: no live lead changes from final cards, no order of play from hole numbers, no causation.
// Derived facts enter the packet with a 'derived:' source so the evidence ledger shows how each was made.
import {toParWords,list,ORD} from './facts.js';
import {standingsAfter,mean,r1} from './golf-math.js';

// Encoded, tested thresholds for narrative labels (a label is never used without its rule).
export const RULES={
 close_finish:{margin_max:2},
 dominant_finish:{margin_min:5},
 consistent_week:{round_spread_max:3},
 final_round_surge:{better_than_prior_avg_min:3},
 contention_window:{strokes:3},
 dna_strength:{percentile_min:80}};

const WORDS=['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve'];
const ORDW=['','first','second','third','fourth','fifth','sixth','seventh','eighth','ninth','tenth'];
export const countWord=n=>Number.isInteger(n)&&n>=0&&n<WORDS.length?WORDS[n]:String(n);
export const ordinalWord=n=>ORDW[n]||ORD(n);
const strokes=n=>n===1?'one stroke':n<10?`${countWord(n)} strokes`:`${n} strokes`;
const shots=n=>n===1?'one shot':`${countWord(n)} shots`;
const underWords=v=>v===0?'even par':v<0?`${countWord(-v)} under`:`${countWord(v)} over`;
const posText=(pos,tied)=>pos===1?(tied?'a share of the lead':'the lead'):(tied?'a tie for ':'')+ordinalWord(pos);
const holeRange=(a,b)=>a===b?`No. ${a}`:`Nos. ${a}–${b}`;
const DNA_NAME={form:'recent form',contention:'contention rate (top-five finishes)',top10:'top-ten rate',under_par:'under-par rounds',scoring:'scoring against the field',consistency:'consistency',cuts:'cuts made',par3:'par-3 scoring',par4:'par-4 scoring',par5:'par-5 scoring',majors:'major championships'};

// Winner's card helpers (published hole-by-hole scores only).
function cardOf(row,k){const c=(row.holes||[]).find(h=>h.round===k);return c?.scores?.length===18&&c.scores.every(s=>Number.isInteger(s.to_par))?c.scores.slice().sort((a,b)=>a.hole-b.hole):null;}
const sum=(xs,f=x=>x)=>xs.reduce((s,x)=>s+f(x),0);
// Longest run of birdies or better on consecutive hole numbers, never across the turn (a back-nine start
// would make holes 9 and 10 non-consecutive in play).
function birdieRun(card){let best=null,cur=null;for(const s of card){const ok=s.to_par<0,cont=cur&&s.hole===cur.to+1&&s.hole!==10;if(ok){cur=cont?{...cur,to:s.hole,n:cur.n+1}:{from:s.hole,to:s.hole,n:1};if(!best||cur.n>best.n)best={...cur};}else cur=null;}return best;}

export function finalNarrative(P,{ed,board,n,winnerRow:w,player:pl}){
 const signals=[];const sig=(name,detail={})=>signals.push({name,...detail});
 const D=(id,value,display,label,from)=>P.derive(id,value,display,label,{from});
 const finished=board.filter(r=>r.status==='finished'&&r.player?.name&&Number.isInteger(r.to_par)).sort((a,b)=>a.position-b.position);
 const rounds=(w.rounds||[]).filter(r=>Number.isInteger(r.strokes)&&Number.isInteger(r.to_par));
 const pronoun=ed.division==='women'?{subj:'she',poss:'her'}:ed.division==='men'?{subj:'he',poss:'his'}:null;P.context.pronoun=pronoun;
 // Round progression (score to par after each round).
 if(rounds.length===n&&n>=2){let c=0;const cum=rounds.map(r=>(c+=r.to_par));
  D('winner_round_to_par',rounds.map(r=>r.to_par),list(rounds.map(r=>underWords(r.to_par))),'Champion’s rounds, score to par','round scores');
  cum.slice(0,-1).forEach((v,i)=>D('winner_after_r'+(i+1),v,toParWords(v),`Champion’s total to par after round ${i+1}`,'round scores'));
  const best=Math.min(...rounds.map(r=>r.strokes)),spread=Math.max(...rounds.map(r=>r.strokes))-best;
  D('winner_round_spread',spread,strokes(spread),'Spread between the champion’s best and worst rounds','round scores');
  if(spread<=RULES.consistent_week.round_spread_max)sig('consistent_week',{spread});
  if(rounds.at(-1).strokes===best&&rounds.filter(r=>r.strokes===best).length===1)sig('best_round_last');
  const prior=mean(rounds.slice(0,-1).map(r=>r.to_par)),better=r1(prior-rounds.at(-1).to_par);
  if(better>=RULES.final_round_surge.better_than_prior_avg_min){D('final_vs_prior_avg',better,`${better} strokes`,'Final round against the champion’s average of the earlier rounds','round scores');sig('final_round_surge',{better});}
 }
 // Entering the final round.
 if(n>=2){const st=standingsAfter(board,n-1),wl=st.find(s=>s.player.slug===w.player.slug),lead=st.filter(s=>s.position===1);
  if(wl&&lead.length){
   const ahead=st.filter(s=>s.to_par<wl.to_par).length;if(ahead>0)D('players_ahead_entering',ahead,ahead===1?'one player':`${countWord(ahead)} players`,'Players ahead of the champion entering the final round','standings after the penultimate round');
   D('r3_lead_score',lead[0].to_par,toParWords(lead[0].to_par),'Leading score entering the final round','standings after the penultimate round');
   if(wl.position===1&&!wl.tied){const next=st.find(s=>s.position>1);if(next){const g=next.to_par-wl.to_par;D('lead_entering',g,strokes(g),'Champion’s lead entering the final round','standings after the penultimate round');const ch=st.filter(s=>s.position===next.position);if(ch.length<=3)D('chasers_entering',ch.map(s=>s.player.name),list(ch.map(s=>s.player.name)),'Nearest pursuers entering the final round','standings after the penultimate round');}}
   if(wl.position===1)sig(wl.tied?'shared_lead_entering':'led_entering');else sig('final_round_comeback',{from:wl.position,deficit:wl.to_par-lead[0].to_par});
   // Wire to wire: on top (alone or shared) after every completed round.
   let wire=true;for(let k=1;k<n;k++){const s=standingsAfter(board,k).find(x=>x.player.slug===w.player.slug);if(!s||s.position!==1){wire=false;break;}}if(wire)sig('wire_to_wire');
   if(lead.length===1&&lead[0].player.slug!==w.player.slug){const L=finished.find(r=>r.player.slug===lead[0].player.slug)||board.find(r=>r.player.slug===lead[0].player.slug);const lr=L?.rounds?.find(r=>r.round===n);const wr=rounds.find(r=>r.round===n);
    P.entity('k1','player',lead[0].player.slug,lead[0].player.name);
    if(lr&&wr&&Number.isInteger(lr.strokes)){D('r3_leader_final_round',lr.strokes,String(lr.strokes),'Final round of the leader entering the final round','round scores');
     if(L.status==='finished'&&Number.isInteger(L.position))D('r3_leader_finish',L.position,posText(L.position,L.tied),'Finishing position of the leader entering the final round','final leaderboard');
     const gain=lr.to_par-wr.to_par;if(gain>0)D('gain_on_r3_leader',gain,strokes(gain),'Strokes the champion gained in the final round on the player leading entering it','round scores');}}
   const ru=finished.filter(r=>r.position===2);if(ru.length===1){const rs=standingsAfter(board,n-1).find(s=>s.player.slug===ru[0].player.slug);if(rs)D('runner_up_start_pos',rs.position,posText(rs.position,rs.tied),'Runner-up’s position entering the final round','standings after the penultimate round');}}
 }
 // The final round across the field.
 const fr=rounds.find(r=>r.round===n);
 if(fr){const all=board.map(r=>r.rounds?.find(x=>x.round===n)).filter(x=>x&&Number.isInteger(x.strokes));
  D('final_round_to_par',fr.to_par,toParWords(fr.to_par),'Champion’s final round, score to par','round scores');
  const better=all.filter(x=>x.strokes<fr.strokes).length,same=all.filter(x=>x.strokes===fr.strokes).length-1;
  D('final_round_rank',better+1,better===0?(same?'tied for the low round of the day':'the low round of the day'):`${same?'tied for the ':'the '}${ordinalWord(better+1)}-lowest round of the day`,'Champion’s final round, rank in the field','round scores');
  D('final_round_field',all.length,`${all.length} players`,'Players completing the final round','round scores');
  const ru=finished.filter(r=>r.position===2);if(ru.length===1){const x=ru[0].rounds?.find(q=>q.round===n);if(x&&Number.isInteger(x.strokes)){D('runner_up_final_round',x.strokes,String(x.strokes),'Runner-up’s final round','round scores');if(x.strokes===fr.strokes)sig('runner_up_matched_final_round');}}
  const lows=board.filter(r=>r.rounds?.find(q=>q.round===n)?.strokes===Math.min(...all.map(q=>q.strokes)));
  if(lows.length===1&&lows[0].player.slug!==w.player.slug&&lows[0].status==='finished')D('final_low_finish',lows[0].position,posText(lows[0].position,lows[0].tied),'Finishing position of the player with the low final round','final leaderboard');
 }
 // Contention at the finish.
 const win=finished.find(r=>r.player.slug===w.player.slug)||w;const within=finished.filter(r=>r.player.slug!==w.player.slug&&r.to_par-win.to_par<=RULES.contention_window.strokes);
 if(within.length){D('within_three_count',within.length,`${within.length===1?'one player was':countWord(within.length)+' players were'} within ${countWord(RULES.contention_window.strokes)} strokes`,`Players within ${RULES.contention_window.strokes} strokes of the champion at the finish`,'final leaderboard');
  if(within.length<=4)D('within_three_names',within.map(r=>r.player.name),list(within.map(r=>r.player.name)),`Players within ${RULES.contention_window.strokes} strokes of the champion`,'final leaderboard');}
 const second=finished.find(r=>r.position===2);if(second&&Number.isInteger(second.to_par)){const m=second.to_par-win.to_par;if(m>0&&m<=RULES.close_finish.margin_max)sig('close_finish',{margin:m});if(m>=RULES.dominant_finish.margin_min)sig('dominant_finish',{margin:m});}
 // Winner's own cards (no lead-change claims: cards do not say when holes were played relative to others).
 const card=cardOf(w,n);
 if(card){const front=sum(card.slice(0,9),s=>s.to_par),back=sum(card.slice(9),s=>s.to_par);
  D('final_front_nine',front,underWords(front),'Champion’s final round, holes 1–9','published hole-by-hole card');D('final_back_nine',back,underWords(back),'Champion’s final round, holes 10–18','published hole-by-hole card');
  const b=card.filter(s=>s.to_par===-1).length,e=card.filter(s=>s.to_par<=-2).length,bo=card.filter(s=>s.to_par>0).length;
  D('final_birdies',b,b===1?'one birdie':`${countWord(b)} birdies`,'Champion’s final round birdies','published hole-by-hole card');
  if(e)D('final_eagles',e,e===1?'an eagle':`${countWord(e)} eagles`,'Champion’s final round eagles or better','published hole-by-hole card');
  D('final_bogeys',bo,bo===0?'no bogeys':bo===1?'one bogey or worse':`${countWord(bo)} bogeys or worse`,'Champion’s final round bogeys or worse','published hole-by-hole card');if(bo===0)sig('bogey_free_final_round');
  const run=birdieRun(card);if(run&&run.n>=3){D('final_birdie_run',run.n,`${countWord(run.n)} straight`,'Longest run of consecutive birdies or better, final round','published hole-by-hole card');D('final_birdie_run_holes',[run.from,run.to],holeRange(run.from,run.to),'Holes in that run','published hole-by-hole card');sig('birdie_run',{n:run.n});}
  const c6=sum(card.slice(12),s=>s.to_par);D('final_holes_13_18',c6,underWords(c6),'Champion’s final round, holes 13–18','published hole-by-hole card');D('closing_holes',[13,18],holeRange(13,18),'Closing holes counted','course layout');
 }
 // The week by par type, when every round has a full card.
 const cards=[...Array(n).keys()].map(i=>cardOf(w,i+1));const pars=new Map((ed.layout?.holes||[]).map(h=>[h.hole,h.par]));
 if(cards.every(Boolean)&&pars.size===18){const by={3:0,4:0,5:0};for(const c of cards)for(const s of c){const p=pars.get(s.hole);if(by[p]!==undefined)by[p]+=s.to_par;}
  for(const p of [3,4,5])D('week_par'+p,by[p],`${underWords(by[p])} on the par ${p}s`,`Champion’s week on the par ${p}s, score to par`,'published hole-by-hole cards and course layout');
  P.context.week_by_par=by;
  const wb=sum(cards.flat(),s=>s.to_par<0?1:0),wbo=sum(cards.flat(),s=>s.to_par>0?1:0);D('week_birdies',wb,`${wb}`,'Champion’s birdies or better for the week','published hole-by-hole cards');D('week_bogeys',wbo,`${wbo}`,'Champion’s bogeys or worse for the week','published hole-by-hole cards');}
 // Player DNA and record context.
 const m=pl?.dna?.l24m?.metrics;if(m){const strong=Object.entries(m).filter(([k,v])=>DNA_NAME[k]&&k!=='majors'&&Number.isInteger(v?.percentile)&&v.percentile>=RULES.dna_strength.percentile_min).sort((a,b)=>b[1].percentile-a[1].percentile).slice(0,4);
  D('dna_window',pl.dna.l24m.window?.label||null,(pl.dna.l24m.window?.label||'').toLowerCase().replace(/^last/,'the last'),'Player DNA window','Player DNA');
  for(const [k,v] of strong)D('dna_'+k,v.percentile,`${ORD(v.percentile)} percentile for ${DNA_NAME[k]}`,`Player DNA (${pl.dna.l24m.window?.label||'24 months'}): ${DNA_NAME[k]}`,'Player DNA percentiles within the tour cohort');
  P.context.dna_strengths=strong.map(([k])=>k);
  // A DNA trait is tied to this week only when the week's own cards show the same thing.
  const by=P.context.week_by_par;if(by){const srt=[3,4,5].sort((a,b)=>by[a]-by[b]),top=srt[0];if(by[top]<by[srt[1]]&&strong.some(([k])=>k==='par'+top)&&by[top]<0){P.context.dna_event_link='par'+top;sig('dna_matches_week',{dim:'par'+top});}}}
 const wins=pl?.summary?.wins_observed;if(Number.isInteger(wins)&&wins>=1)D('win_ordinal',wins,ordinalWord(wins),'Champion’s wins in our record, including this one','player record');
 const form=(pl?.visuals?.form||[]).filter(f=>f.ends_on&&ed.ends_on&&f.ends_on<ed.ends_on&&f.slug!==ed.slug);
 if(form.length>=3){const last=form.slice(-3).reverse().filter(f=>f.status==='finished'&&Number.isInteger(f.position));
  const lastAll=form.slice(-3).reverse(),place=f=>f.status==='finished'&&Number.isInteger(f.position)?(f.tied?'T'+f.position:ORD(f.position)):({cut:'MC',withdrawn:'WD',disqualified:'DQ'}[f.status]||null);
  if(lastAll.length&&lastAll.every(place)){D('prior_results',lastAll.map(f=>[f.name,f.position??null,f.status]),list(lastAll.map(f=>`${place(f)} at the ${f.name.replace(/^\d{4}\s+/,'')}`)),'Champion’s previous starts in our record, latest first (MC = missed cut)','player record');}
  const ten=form.slice(-10),t10=ten.filter(f=>f.status==='finished'&&f.position<=10).length;D('prior_top10',t10,t10===0?'no top-ten finishes':t10===1?'one top-ten finish':`${countWord(t10)} top-ten finishes`,'Top-ten finishes in the previous starts in our record','player record');D('prior_starts',ten.length,`${countWord(ten.length)} starts`,'Previous starts counted','player record');}
 P.context.signals=signals;
 return signals;
}
