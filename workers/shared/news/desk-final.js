// Golf Desk v5: contextual final-round story. Same token contract as v4 (no number outside a fact token), but
// written as a story: lede, result, how it turned, the profile behind it, what the numbers say, what it means,
// and a sentence of prose introducing every data module. Every sentence is conditional on its facts existing;
// a thin packet produces a short story, never padding. Signals come from narrative.js (encoded thresholds).
const S=(heading,paragraphs,module=null)=>{const ps=paragraphs.filter(Boolean);return ps.length?{heading,paragraphs:ps,...(module?{module}:{})}:null;};
const join=(...xs)=>xs.filter(Boolean).join(' ');
export function finalStoryV5(p){
 const has=id=>p.facts.some(f=>f.id===id),ent=k=>p.entities.some(x=>x.key===k),val=id=>p.facts.find(f=>f.id===id)?.value;
 const sig=new Set((p.context.signals||[]).map(s=>s.name)),charts=new Set(Object.keys(p.chart_data||{}));
 const pr=p.context.pronoun,He=pr?pr.subj[0].toUpperCase()+pr.subj.slice(1):'{f:winner}',he=pr?pr.subj:'{f:winner}',him=pr?(pr.subj==='he'?'him':'her'):'{f:winner}',his=pr?pr.poss:'{f:winner}’s';
 const W=ent('p1')?'{e:p1}':'{f:winner}',course=has('course')?(ent('c1')?'{e:c1}':'{f:course}'):null,event=ent('t1')?'the {e:t1}':'the {f:event_full}';
 const leader=ent('k1')?'{e:k1}':'{f:r3_leaders}',ru=ent('p2')?'{e:p2}':'{f:runner_up}';
 const comeback=sig.has('final_round_comeback')&&has('winner_deficit'),led=(sig.has('led_entering')||sig.has('shared_lead_entering'))&&has('winner_start_pos'),playoff=has('playoff');
 const d={chart_intents:[...charts],link_intents:p.entities.map(x=>x.key),known_limits:[...p.limits],sections:[]};
 // Headline and dek: the defining event fact first.
 d.headline=playoff?'{f:winner} wins the {f:event} in a playoff':comeback?'{f:winner} comes from {f:winner_deficit} back to win the {f:event}':sig.has('wire_to_wire')?'{f:winner} leads from start to finish at the {f:event}':'{f:winner} wins the {f:event}';
 d.dek=comeback?`A closing {f:final_round} took {f:winner} from {f:winner_start_pos} to the title at {f:to_par}${course?' at {f:course}':''}${has('margin')?', {f:margin} clear of {f:runner_up}':''}.`
  :led&&has('final_round')?`{f:winner} ${sig.has('shared_lead_entering')?'shared':'held'} the lead entering the final round and closed with {f:final_round} to win at {f:to_par}${has('margin')?' by {f:margin}':''}.`
  :`{f:winner} won the {f:event_full}${course?' at {f:course}':''}${has('to_par')?' at {f:to_par}':''}${has('margin')?', by {f:margin}':playoff?' in a playoff':''}.`;
 // 1. Lede
 const lede=comeback?[join(`${W} began the final round of ${event} in {f:winner_start_pos}, {f:winner_deficit} behind ${leader}${has('margin')?', and finished {f:margin} clear':''}.`),
   join(has('final_round_to_par')?`A closing {f:final_round}, {f:final_round_to_par}, carried ${him} to {f:to_par}${course?` at ${course}`:''}.`:null,has('win_ordinal')?`It is ${his} {f:win_ordinal} win in our record.`:null)]
  :led?[join(`${W} ${sig.has('shared_lead_entering')?'shared the lead':'led'} entering the final round of ${event}${sig.has('wire_to_wire')?', as '+he+' had after every round,':''} and ${has('margin')?'won by {f:margin}':'won'}${has('to_par')?' at {f:to_par}':''}${course?` at ${course}`:''}.`),
   join(has('final_round')?`${He} closed with {f:final_round}.`:null,has('win_ordinal')?`It is ${his} {f:win_ordinal} win in our record.`:null)]
  :[join(`${W} won ${event}${course?` at ${course}`:''}${has('to_par')?' at {f:to_par}':''}${has('margin')?', by {f:margin}':playoff?' in a playoff':''}.`),has('win_ordinal')?`It is ${his} {f:win_ordinal} win in our record.`:null];
 d.sections.push(S('',lede));
 // 2. The result (leaderboard follows)
 d.sections.push(S('The result',[
  join(has('total')&&has('winner_rounds')?`${has('to_par')?'{f:winner} finished at {f:to_par}, a total of {f:total},':'{f:winner} finished on {f:total}'} after rounds of {f:winner_rounds}.`:null,
   has('runner_up')?(has('margin')?`${ru} was the runner-up, {f:margin} back.`:playoff?`${ru} lost the playoff.`:`${ru} was the runner-up.`):null),
  has('winner_round_to_par')&&has('par')?`Against {f:par}, ${his} rounds were {f:winner_round_to_par}.`:null,
  has('within_three_count')?`The final leaderboard shows how close the chase stayed: at the finish, {f:within_three_count} of {f:winner}${has('within_three_names')?': {f:within_three_names}':''}.`:null],charts.has('leaderboard')?'leaderboard':null));
 // 3. How it turned
 const turn=[];
 if(comeback){turn.push(join(`The title was not ${his} to protect entering the final round.`,`${leader} led at {f:r3_lead_score}${has('players_ahead_entering')?', and {f:players_ahead_entering} stood ahead of {f:winner}':''}.`));
  turn.push(join(has('final_round_rank')?`{f:winner} answered with {f:final_round}, {f:final_round_rank}.`:`{f:winner} answered with {f:final_round}.`,
   has('r3_leader_final_round')?`${leader} shot {f:r3_leader_final_round}${has('r3_leader_finish')?' and finished in {f:r3_leader_finish}':''}.`:null,
   has('gain_on_r3_leader')?`Over the final round, {f:winner} gained {f:gain_on_r3_leader} on the player who began it in front.`:null));}
 else if(led&&has('final_round'))turn.push(join(has('lead_entering')?`{f:winner} began the final round {f:lead_entering} clear${has('chasers_entering')?' of {f:chasers_entering}':''}${has('margin')?' and finished {f:margin} ahead':''}.`:`{f:winner} began the final round in {f:winner_start_pos}.`,`${He} closed with {f:final_round}${has('final_round_rank')?', {f:final_round_rank}':''}.`));
 if(has('final_front_nine')&&has('final_back_nine'))turn.push(join(`${his[0].toUpperCase()+his.slice(1)} final-round card was {f:final_front_nine} on the front nine and {f:final_back_nine} on the back nine, with {f:final_birdies}${has('final_eagles')?', {f:final_eagles}':''} and {f:final_bogeys}.`,
  has('final_birdie_run')?`The longest run was {f:final_birdie_run} under-par holes at {f:final_birdie_run_holes}.`:null,has('closing_holes')?`${He} played {f:closing_holes} in {f:final_holes_13_18}.`:null));
 if(has('runner_up_final_round')&&has('runner_up_start_pos')&&sig.has('runner_up_matched_final_round'))turn.push(`${ru} matched that {f:runner_up_final_round} but began the round further back, in {f:runner_up_start_pos}.`);
 else if(has('runner_up_final_round'))turn.push(`${ru} closed with {f:runner_up_final_round}.`);
 if(has('final_low')&&has('final_low_finish'))turn.push('{f:final_low_players} shot the low round of the day, {f:final_low}, and finished in {f:final_low_finish}.');
 else if(has('final_low')&&!has('final_round_rank'))turn.push('The low final round was {f:final_low}, by {f:final_low_players}.');
 d.sections.push(S('How it turned',turn));
 // 4. The profile behind it (Player DNA follows)
 const dna=['dna_form','dna_contention','dna_under_par','dna_top10','dna_scoring','dna_par4','dna_par5','dna_par3','dna_consistency','dna_cuts'].filter(has).slice(0,3);
 if(dna.length){const link=p.context.dna_event_link;
  d.sections.push(S('The profile behind it',[
   join(sig.has('final_round_surge')?`The closing round was the outlier of ${his} week, but the result fits ${his} broader profile.`:`The result fits {f:winner}’s broader profile.`,
    `In ${his} Player DNA over {f:dna_window}, a window that includes this week, ${he} ranks in the ${dna.map(id=>`{f:${id}}`).join(dna.length>2?', the ':' and the ').replace(/, the ([^,]*)$/,' and the $1')} within ${his} tour cohort.`),
   link&&has('week_'+link)?`This week’s cards are consistent with that profile: {f:winner} was {f:week_${link}}, more than on any other hole type.`:null,
   charts.has('winner_dna')?'The full profile is below; percentiles compare players within the same tour cohort.':null],charts.has('winner_dna')?'winner_dna':null));}
 // 5. What the numbers say (round progression follows)
 const nums=[];
 const after=[1,2,3,4].filter(k=>has('winner_after_r'+k)),RW=['','first','second','third','fourth'];
 if(after.length>=2)nums.push(join(`The round-by-round totals show how the week was built. {f:winner} was ${after.map((k,i)=>`{f:winner_after_r${k}} ${i===after.length-1?'through':'after'} the ${RW[k]} round`).join(', ').replace(/, ([^,]*)$/,' and $1')}${has('final_round_to_par')?', then added {f:final_round_to_par} in the final round':''}.`,
  has('final_vs_prior_avg')?`That last round was {f:final_vs_prior_avg} better than the average of ${his} earlier rounds.`:null));
 if(has('week_par4')&&has('week_par5')&&has('week_par3'))nums.push(join((val('week_par3')>0&&val('week_par4')<0&&val('week_par5')<0)?`By hole type, ${he} was {f:week_par4} and {f:week_par5}, but {f:week_par3}, the only hole type ${he} played over par.`:`By hole type, ${he} was {f:week_par4}, {f:week_par5} and {f:week_par3}.`,has('week_birdies')?`Across the week ${he} made {f:week_birdies} birdies or better against {f:week_bogeys} bogeys or worse.`:null));
 if(charts.has('round_progress'))nums.push('The chart tracks the leading contenders’ totals after each round.');
 d.sections.push(S('What the numbers say',nums,charts.has('round_progress')?'round_progress':null));
 // 6. What it means (recent form follows)
 const means=[];
 if(has('win_ordinal'))means.push(join(`The victory is {f:winner}’s {f:win_ordinal} in our record.`,has('dna_form')?`It arrives with ${his} Player DNA at the {f:dna_form}.`:null));
 if(has('prior_results'))means.push(join(`Before this week, ${his} latest starts in our record were {f:prior_results}.`,has('prior_top10')&&has('prior_starts')?`${He} had {f:prior_top10} in the previous {f:prior_starts} in our record.`:null));
 if(charts.has('winner_form')&&means.length)means.push('The form chart places this result alongside those starts.');
 d.sections.push(S('What it means',means,charts.has('winner_form')&&means.length?'winner_form':null));
 // The course (hole difficulty follows)
 if(has('hardest_hole'))d.sections.push(S('The course',['The hardest hole for the week was {f:hardest_hole}, playing {f:hardest_hole_avg} strokes against par on average.',has('cut_line')?'The cut fell at {f:cut_line}.':null,charts.has('hole_difficulty')?'The chart shows the field’s average score against par on every hole.':null],charts.has('hole_difficulty')?'hole_difficulty':null));
 if(charts.has('weather'))d.sections.push(S('Conditions',['The tournament-week forecast is shown below. It is a forecast issued before play, not observed conditions.'],'weather'));
 if(p.context.edition&&has('final_front_nine'))d.sections.push(S('Replay it',[`PBEcast rebuilds ${his} final round hole by hole from the published scorecard.`],'pbecast'));
 d.sections=d.sections.filter(Boolean);
 if(p.facts.some(f=>f.id.startsWith('final_')&&f.source?.includes('hole-by-hole')))d.known_limits.push('Hole-by-hole figures come from the published scorecard; they do not show when each hole was played relative to the rest of the field.');
 // SEO title: the most specific candidate that fits once rendered (never a truncated headline).
 const render=t=>t.replace(/\{f:([a-z0-9_]+)\}/g,(_,id)=>p.facts.find(f=>f.id===id)?.display||'');
 d.seo_title=[comeback?'{f:winner} rallies to win the {f:event}':null,has('to_par')?'{f:winner} wins the {f:event} at {f:to_par}':null,'{f:winner} wins the {f:event}','{f:winner} wins {f:event}'].filter(Boolean).find(t=>render(t).length<=65)||'{f:winner} wins {f:event}';
 d.social_headline=d.headline;d.seo_description=d.dek;
 return d;
}
