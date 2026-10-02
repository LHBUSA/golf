// Narrative context for course, preview and round-recap stories. Public data only: Course DNA dimensions and
// percentiles, the published hole-by-hole field scoring table, past champions, public Player DNA percentiles and
// published results. Never Course Fit, raw DNA values, field form leaders or strokes-vs-field values.
import {toParWords,list,ORD} from './facts.js';
import {standingsAfter,mean} from './golf-math.js';
import {countWord,ordinalWord} from './narrative.js';

export const PRE_RULES={long_par4_yards:450,short_par4_yards:400,long_iron_gap:0.1,separation_pct:67,bunching_pct:33,easy_pct:25,hard_pct:75,contention_window:3,form_strong_pct:80};
const r2=v=>Math.round(v*100)/100;
const sgn=v=>(v>0?'+':v<0?'−':'')+Math.abs(v).toFixed(2);
const parWord={3:'par 3s',4:'par 4s',5:'par 5s'};
const holeDesc=h=>`No. ${h.hole} (par ${h.par}${h.yards?`, ${h.yards.toLocaleString('en-US')} yards`:''})`;
const DNA_FOR={3:'par3',4:'par4',5:'par5'};

// Course facts (course_intelligence uses all; preview uses the summary). Returns the course signature.
export function courseNarrative(P,co,{withHistory=true}={}){
 const D=(id,value,display,label,from)=>P.derive(id,value,display,label,{from});const out={};
 const dna=co?.dna;const dim=k=>dna?.dimensions?.find(d=>d.code===k);
 if(dna){const yrs=dna.edition_range;if(yrs?.length===2)D('cd_years',yrs,yrs[0]===yrs[1]?String(yrs[0]):`${yrs[0]} to ${yrs[1]}`,'Seasons measured','Course DNA');
  const sp=dim('spread'),bw=dim('birdie_window'),ws=dim('winning_score'),df=dim('difficulty');
  if(Number.isFinite(bw?.value))D('cd_under_par_rounds',bw.value,`${bw.value}% of rounds`,'Rounds under par, full-field editions','Course DNA');
  if(Number.isInteger(bw?.percentile))D('cd_under_par_pct',bw.percentile,`${ORD(bw.percentile)} percentile`,'Under-par rounds, percentile among measured courses','Course DNA');
  if(Number.isInteger(sp?.percentile)){D('cd_spread_pct',sp.percentile,`${ORD(sp.percentile)} percentile`,'Scoring spread, percentile among measured courses','Course DNA');out.separation=sp.percentile>=PRE_RULES.separation_pct?'separates':sp.percentile<=PRE_RULES.bunching_pct?'bunches':'middle';}
  if(Number.isInteger(df?.percentile))out.difficulty=df.percentile>=PRE_RULES.hard_pct?'hard':df.percentile<=PRE_RULES.easy_pct?'easy':'middle';
  if(Number.isFinite(ws?.value)&&ws.sample>=2)D('cd_avg_winning',ws.value,toParWords(Math.round(ws.value*10)/10).replace('.0 ',' '),'Average winning score to par','Course DNA');
 }
 // Hole-by-hole field scoring (latest edition with a real card sample).
 const chs=co?.contender_hole_scoring,holes=(chs?.holes||[]).filter(h=>Number.isFinite(h.avg_to_par)&&h.par);
 if(holes.length===18&&Math.min(...holes.map(h=>h.sample||0))>=30){out.holes=holes;
  D('cd_hole_year',chs.year,String(chs.year),'Hole scoring edition','published hole-by-hole cards');D('cd_hole_cards',Math.min(...holes.map(h=>h.sample)),`${Math.min(...holes.map(h=>h.sample))} rounds`,'Rounds in the hole-scoring sample','published hole-by-hole cards');
  const by={3:[],4:[],5:[]};for(const h of holes)by[h.par]?.push(h);
  D('cd_par_mix',[by[3].length,by[4].length,by[5].length],`${countWord(by[4].length)} par 4s, ${countWord(by[3].length)} par 3s and ${countWord(by[5].length)} par 5s`,'Hole mix','course layout');
  const per={};for(const p of [3,4,5])if(by[p].length){per[p]=r2(mean(by[p].map(h=>h.avg_to_par)));D('cd_par'+p+'_avg',per[p],`${sgn(per[p])} per hole`,`Field average to par on the ${parWord[p]}`,'published hole-by-hole cards');
   const tot=r2(by[p].reduce((s,h)=>s+h.avg_to_par,0));D('cd_par'+p+'_total',tot,`${sgn(tot)} strokes per round`,`Field strokes to par per round on the ${parWord[p]}`,'published hole-by-hole cards');}
  const types=Object.keys(per).map(Number).sort((a,b)=>per[a]-per[b]);out.window=types[0];out.demand=types.at(-1);
  if(per[out.window]<per[types[1]])D('cd_window_type',out.window,parWord[out.window],'Hole type with the lowest field average','published hole-by-hole cards');
  if(per[out.demand]>per[types.at(-2)])D('cd_demand_type',out.demand,parWord[out.demand],'Hole type with the highest field average','published hole-by-hole cards');
  const p4=by[4].filter(h=>h.yards),long=p4.filter(h=>h.yards>=PRE_RULES.long_par4_yards),short=p4.filter(h=>h.yards<PRE_RULES.short_par4_yards);
  if(long.length>=3&&short.length>=2){const gap=r2(mean(long.map(h=>h.avg_to_par))-mean(short.map(h=>h.avg_to_par)));D('cd_long_par4s',long.length,`${countWord(long.length)} par 4s of ${PRE_RULES.long_par4_yards} yards or more`,'Long par 4s','course layout');D('cd_long_par4_gap',gap,`${Math.abs(gap).toFixed(2)} strokes per hole ${gap>=0?'harder':'easier'}`,`Long par 4s against par 4s under ${PRE_RULES.short_par4_yards} yards`,'published hole-by-hole cards');if(gap>=PRE_RULES.long_iron_gap)out.long_iron=true;}
  const hard=holes.slice().sort((a,b)=>b.avg_to_par-a.avg_to_par).slice(0,3),easy=holes.slice().sort((a,b)=>a.avg_to_par-b.avg_to_par).slice(0,3);
  D('cd_hardest',hard.map(h=>h.hole),list(hard.map(holeDesc)),'Hardest holes by field average','published hole-by-hole cards');D('cd_hardest_avg',hard[0].avg_to_par,sgn(hard[0].avg_to_par),'Hardest hole, field average to par','published hole-by-hole cards');
  D('cd_easiest',easy.map(h=>h.hole),list(easy.map(holeDesc)),'Easiest holes by field average','published hole-by-hole cards');D('cd_easiest_avg',easy[0].avg_to_par,sgn(easy[0].avg_to_par),'Easiest hole, field average to par','published hole-by-hole cards');
  const over=holes.filter(h=>h.avg_to_par>0).length;D('cd_over_par_holes',over,over===1?'one hole':`${countWord(over)} holes`,'Holes playing over par on average','published hole-by-hole cards');
  const f9=r2(holes.filter(h=>h.hole<=9).reduce((s,h)=>s+h.avg_to_par,0)),b9=r2(holes.filter(h=>h.hole>9).reduce((s,h)=>s+h.avg_to_par,0));D('cd_front_nine',f9,sgn(f9),'Field average to par, holes 1–9','published hole-by-hole cards');D('cd_back_nine',b9,sgn(b9),'Field average to par, holes 10–18','published hole-by-hole cards');
  const p3y=by[3].filter(h=>h.yards).map(h=>h.yards);if(p3y.length>=3)D('cd_par3_yards',Math.round(mean(p3y)),`${Math.round(mean(p3y))} yards`,'Average par-3 length','course layout');
  P.chart('hole_difficulty',{type:'holes',title:`${co.name}: field average to par by hole (${chs.year})`,cards:Math.min(...holes.map(h=>h.sample)),holes:holes.map(h=>({hole:h.hole,par:h.par,yards:h.yards??null,avg_to_par:h.avg_to_par,n:h.sample}))});
 }
 // Past champions at the course (published results).
 if(withHistory){const past=(co?.editions||[]).filter(e=>e.coverage==='full_field'&&e.winner?.name&&Number.isInteger(e.to_par)).sort((a,b)=>b.year-a.year).slice(0,5);
  if(past.length){D('cd_champions',past.map(e=>[e.winner.name,e.year,e.to_par]),list(past.map(e=>`${e.winner.name} (${e.year}, ${toParWords(e.to_par).replace(' par','')})`)),'Champions at this course in our record','published results');past.slice(0,3).forEach((e,i)=>e.winner.slug&&P.entity('h'+(i+1),'player',e.winner.slug,e.winner.name));
   if(past.length>=2){const ws=past.map(e=>e.to_par),lo=Math.min(...ws),hi=Math.max(...ws);if(lo!==hi)D('cd_winning_range',[lo,hi],`from ${toParWords(hi)} to ${toParWords(lo)}`,'Range of winning scores here','published results');}}}
 return out;
}

// Players whose published results here stand out, with one public DNA percentile on the course's scoring window.
export async function courseHistoryPlayers(P,co,ctx,{key='ch',max=3,window=null,demand=null,restrictTo=null}={}){
 const rows=(co?.player_history||[]).filter(h=>h.slug&&Number.isInteger(h.top10)&&h.top10>=1&&(!restrictTo||restrictTo.has(h.slug))).sort((a,b)=>b.wins-a.wins||b.top10-a.top10||(a.best_finish??99)-(b.best_finish??99)).slice(0,max);
 const D=(id,value,display,label,from)=>P.derive(id,value,display,label,{from});const out=[];
 for(const [i,h] of rows.entries()){const k=key+(i+1);P.entity(k,'player',h.slug,h.name);
  D(k+'_record',[h.top10,h.full_field_starts,h.best_finish],`${h.top10===1?'one top-ten finish':countWord(h.top10)+' top-ten finishes'} in ${h.full_field_starts===1?'one start':countWord(h.full_field_starts)+' starts'}${h.wins?`, including ${h.wins===1?'a win':countWord(h.wins)+' wins'}`:Number.isInteger(h.best_finish)?`, best ${ORD(h.best_finish)}`:''}`,`${h.name} at this course`,'published results');
  const pl=await ctx.pl(h.slug);const m=pl?.dna?.l24m?.metrics;
  for(const p of [window,demand].filter(Boolean)){const v=m?.[DNA_FOR[p]];if(Number.isInteger(v?.percentile)&&v.percentile>=PRE_RULES.form_strong_pct){D(k+'_dna_par'+p,v.percentile,`${ORD(v.percentile)} percentile for par-${p} scoring`,`${h.name} Player DNA: ${parWord[p]}`,'Player DNA percentiles within the tour cohort');break;}}
  out.push({key:k,h});}
 return out;
}

// Recent form for named players (published results + public DNA percentile).
export async function formFacts(P,ctx,slug,key,{before}){
 const pl=await ctx.pl(slug);if(!pl)return null;const D=(id,value,display,label,from)=>P.derive(id,value,display,label,{from});
 const form=(pl.visuals?.form||[]).filter(f=>f.ends_on&&(!before||f.ends_on<before));const last=form.slice(-3).reverse();
 const place=f=>f.status==='finished'&&Number.isInteger(f.position)?(f.tied?'T'+f.position:ORD(f.position)):({cut:'MC',withdrawn:'WD',disqualified:'DQ'}[f.status]||null);
 if(last.length>=2&&last.every(place))D(key+'_recent',last.map(f=>[f.name,f.position??null,f.status]),list(last.map(f=>`${place(f)} at the ${f.name.replace(/^\d{4}\s+/,'')}`)),`${pl.name}: latest starts in our record`,'player record');
 const v=pl.dna?.l24m?.metrics?.form;if(Number.isInteger(v?.percentile))D(key+'_form_pct',v.percentile,`${ORD(v.percentile)} percentile for recent form`,`${pl.name} Player DNA: recent form`,'Player DNA percentiles within the tour cohort');
 const ten=form.slice(-10),t10=ten.filter(f=>f.status==='finished'&&f.position<=10).length;if(ten.length>=5)D(key+'_top10',t10,`${t10===0?'no top-ten finishes':t10===1?'one top-ten finish':countWord(t10)+' top-ten finishes'} in ${countWord(ten.length)} starts`,`${pl.name}: top-ten finishes in recent starts`,'player record');
 return {pl,strong:Number.isInteger(v?.percentile)&&v.percentile>=PRE_RULES.form_strong_pct};
}

// Round recap: what the completed round changed (completed rounds only; nothing about the outcome).
export async function recapNarrative(P,{ed,n,ctx}){
 const D=(id,value,display,label,from)=>P.derive(id,value,display,label,{from});const sig=[];
 const st=standingsAfter(ed.leaderboard,n),leaders=st.filter(s=>s.position===1);
 const pron=ed.division==='women'?{subj:'she',poss:'her'}:ed.division==='men'?{subj:'he',poss:'his'}:null;P.context.pronoun=pron;
 // Leader's own round and path.
 const L=leaders[0];const lr=L?.rounds?.[n-1];if(leaders.length===1&&lr){D('leader_round',lr.strokes,String(lr.strokes),'Leader’s round today','round scores');D('leader_round_to_par',lr.to_par,toParWords(lr.to_par),'Leader’s round today, score to par','round scores');}
 if(n>=2){const prev=standingsAfter(ed.leaderboard,n-1),pl=prev.filter(s=>s.position===1),pp=new Map(prev.map(s=>[s.player.slug||s.player.name,s]));
  D('prev_leaders',pl.map(s=>s.player.name),list(pl.map(s=>s.player.name)),`Leader${pl.length>1?'s':''} after the previous round`,'standings after the previous round');
  const same=leaders.length===pl.length&&leaders.every(s=>pl.some(x=>x.player.name===s.player.name));sig.push(same?'lead_held':'lead_changed');
  if(leaders.length===1&&!same){const was=pp.get(L.player.slug||L.player.name);if(was){D('leader_from',was.position,(was.tied?'a tie for ':'')+ordinalWord(was.position),'Leader’s position before the round','standings after the previous round');const back=was.to_par-pl[0].to_par;if(back>0)D('leader_was_back',back,back===1?'one stroke':back<10?`${countWord(back)} strokes`:`${back} strokes`,'Leader’s deficit before the round','standings after the previous round');}
   if(pl.length===1){const P0=st.find(s=>s.player.name===pl[0].player.name);if(P0){D('prev_leader_now',P0.position,(P0.tied?'a tie for ':'')+ordinalWord(P0.position),'Previous leader’s position now','standings after this round');const r=P0.rounds[n-1];if(r)D('prev_leader_round',r.strokes,String(r.strokes),'Previous leader’s round today','round scores');}}}
  // Who moved: largest climbs into the top ten (completed rounds only).
  const moves=st.filter(s=>s.position<=10).map(s=>({s,from:pp.get(s.player.slug||s.player.name)})).filter(x=>x.from&&x.from.position-x.s.position>=8).sort((a,b)=>(b.from.position-b.s.position)-(a.from.position-a.s.position)).slice(0,3);
  if(moves.length>=2){D('movers',moves.map(x=>x.s.player.name),list(moves.map(x=>`${x.s.player.name} (${ordinalWord(x.from.position)} to ${x.s.tied?'T':''}${x.s.position})`)),'Largest climbs into the top ten','standings before and after the round');moves.forEach((x,i)=>x.s.player.slug&&P.entity('mv'+(i+1),'player',x.s.player.slug,x.s.player.name));}}
 // Low round: where it moved its owner.
 const low=Math.min(...st.map(s=>s.rounds[n-1]?.strokes).filter(Number.isInteger));const lows=st.filter(s=>s.rounds[n-1]?.strokes===low);
 if(lows.length===1){D('low_round_pos',lows[0].position,(lows[0].tied?'a tie for ':'')+ordinalWord(lows[0].position),'Position of the low-round player after the round','standings after this round');}
 // Contention depth and what remains (scheduled rounds; no outcome claims).
 const top=leaders[0]?.to_par;if(Number.isInteger(top)){const w=st.filter(s=>s.to_par-top<=PRE_RULES.contention_window&&s.position!==1).length;D('within_three',w,`${w===1?'one player is':countWord(w)+' players are'} within ${countWord(PRE_RULES.contention_window)} strokes`,`Players within ${PRE_RULES.contention_window} strokes of the lead`,'standings after this round');}
 const sched=ed.starts_on&&ed.ends_on?Math.round((Date.parse(ed.ends_on)-Date.parse(ed.starts_on))/86400000)+1:null;if(sched&&sched>n&&sched<=5){const left=sched-n;D('rounds_left',left,left===1?'one round':`${countWord(left)} rounds`,'Rounds remaining on the schedule','tournament schedule');}
 // Leader context (public DNA percentiles and published results).
 if(leaders.length===1&&L.player.slug){const f=await formFacts(P,ctx,L.player.slug,'ldr',{before:ed.starts_on});if(f?.strong)sig.push('leader_in_form');}
 P.context.signals=sig.map(name=>({name}));
}
