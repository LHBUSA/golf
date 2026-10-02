// Deterministic Golf Desk writer. Emits the same structure the OpenAI editor must emit:
// prose with {f:fact_id} value tokens and {e:entity_key} link tokens. No digits ever appear outside tokens.
import {finalStoryV5} from './desk-final.js';
import {previewV5,courseV5,recapV5} from './desk-pre.js';
export const DESK_VERSION='golf-desk/4.0.0',DESK_V5='golf-desk/5.1.0';
// v5 replaces the writer for the types it covers; everything else stays on v4.
export const V5_TYPES=['final','preview','course_intelligence','round_recap'];
export const deskVersionFor=(type,enabled=[])=>V5_TYPES.includes(type)&&enabled.includes(type)?DESK_V5:DESK_VERSION;
const S=(heading,...paragraphs)=>({heading,paragraphs:paragraphs.filter(Boolean)});
export function deskDraft(p,{version=DESK_VERSION}={}){
 if(version===DESK_V5){const w={final:finalStoryV5,preview:previewV5,course_intelligence:courseV5,round_recap:recapV5}[p.type];if(w)return w(p);}
 const has=id=>p.facts.some(f=>f.id===id),ent=k=>p.entities.some(x=>x.key===k),E=k=>ent(k)?`{e:${k}}`:null;
 const course=has('course')?(ent('c1')?'{e:c1}':'{f:course}'):null,event=ent('t1')?'{e:t1}':'{f:event}';
 const charts=Object.keys(p.chart_data||{}),links=p.entities.map(x=>x.key);
 const where=course?` at ${course}${has('locality')?' in {f:locality}':''}`:has('locality')?' in {f:locality}':'';
 const d={chart_intents:charts,link_intents:links,known_limits:[...p.limits],sections:[]};
 if(p.type==='preview'){
  d.headline=has('defending')?`{f:defending} returns to defend the {f:event}`:`What to know before the {f:event}`;
  d.dek=`The {f:year} {f:event} starts {f:start_day}${where}.${has('field_major_champions')?' The field includes {f:field_major_champions}.':''}`;
  d.sections.push(S('The week',`${event} begins {f:start_day}${where}${has('tour')?' on the {f:tour}':''}.`,has('par')&&has('yards')?`The course plays to {f:par} and {f:yards}.`:null,has('purse')?`The purse is {f:purse}.`:null,has('field_size')?`ESPN lists a field of {f:field_size} players.`:null));
  if(has('defending')||has('recent_winners'))d.sections.push(S('Recent history',has('defending')?`${E('p1')||'{f:defending}'} is the defending champion.`:null,has('recent_winners')?`Recent champions in our record: {f:recent_winners}.`:null));
  if(has('field_major_champions'))d.sections.push(S('Who is here',has('field_major_champions')?`Major champions in the field: ${['p2','p3','p4','p5'].filter(ent).map(k=>`{e:${k}}`).join(', ')}.`:null,ent('m1')?`See the head-to-head in {e:m1}.`:null));
  if(has('max_gust'))d.sections.push(S('Weather','The strongest gust in the daytime forecast for the tournament days is {f:max_gust}.'));
  d.seo_title=`{f:event} preview: field, history and course`;d.social_headline=has('defending')?`{f:defending} defends at the {f:event}`:`{f:event}: what to know`;
 }else if(p.type==='round_recap'){
  const multi=(p.facts.find(f=>f.id==='leaders')?.value||[]).length>1;
  d.headline=`${multi?'{f:leaders} share':'{f:leaders} leads'} the {f:event} after the {f:round_word} round`;
  d.dek=`${multi?'{f:leaders} are tied':'{f:leaders} is'} at {f:lead_score}${course?` at ${course}`:''}.${has('lead_margin')?' The lead is {f:lead_margin}.':''}`;
  d.sections.push(S('The leaderboard',`After the {f:round_word} round of ${event}, ${multi?'{f:leaders} share the lead':'{f:leaders} leads'} at {f:lead_score}, a total of {f:lead_total}.`,has('lead_margin')&&has('chasers')?`{f:chasers} ${(p.facts.find(f=>f.id==='chasers')?.value||[]).length>1?'are':'is'} {f:lead_margin} back.`:null));
  if(has('round_average'))d.sections.push(S('How the course played',`The field averaged {f:round_average} strokes for the round, with {f:under_par_count} of {f:round_field} players under par.`,has('low_round')?`The low round of the day was {f:low_round}, by ${['l1','l2'].filter(ent).map(k=>`{e:${k}}`).join(' and ')||'{f:low_round_players}'}.`:null));
  if(has('climber'))d.sections.push(S('The move of the day',`{e:x1} climbed from {f:climber_from} to {f:climber_to}.`));
  if(has('made_cut'))d.sections.push(S('The cut','{f:made_cut} players are through to the weekend.'));
  d.seo_title=`{f:event} round recap: {f:leaders} ${multi?'share':'leads'}`;d.social_headline=`{f:leaders} ${multi?'share':'leads'} the {f:event}`;
 }else if(p.type==='final'){
  d.headline=`{f:winner} wins the {f:event}`;
  d.dek=`{f:winner} won the {f:event_full}${course?` at ${course}`:''}${has('to_par')?' at {f:to_par}':''}${has('margin')?', by {f:margin}':has('playoff')?' in a playoff':''}.${has('runner_up')?' {f:runner_up} '+((p.facts.find(f=>f.id==='runner_up')?.value||[]).length>1?'shared the runner-up spot':'was the runner-up')+'.':''}`;
  d.sections.push(S('The result',`{e:p1} won the {f:event_full}${where}.`,has('total')&&has('to_par')?'The winning total was {f:total}, {f:to_par}.':null,has('winner_rounds')?'{f:winner} posted rounds of {f:winner_rounds}.':null));
  if(has('runner_up'))d.sections.push(S('How it was won',has('margin')?`The margin over {f:runner_up} was {f:margin}.`:has('playoff')?`The title was decided in a playoff over {f:runner_up}.`:`{f:runner_up} was the runner-up.`,has('winner_start_pos')?`{f:winner} began the final round in {f:winner_start_pos}${has('winner_deficit')?', {f:winner_deficit} behind {f:r3_leaders}':''}, and closed with {f:final_round}.`:null,has('final_low')?'The low final round was {f:final_low}, by {f:final_low_players}.':null));
  if(has('hardest_hole'))d.sections.push(S('The course','The hardest hole for the week was {f:hardest_hole}, playing {f:hardest_hole_avg} strokes against par on average.',has('cut_line')?'The cut fell at {f:cut_line}.':null));
  if(has('career_wins'))d.sections.push(S('In context',`The victory brings {f:winner} to {f:career_wins} wins in our record${has('major_wins')?', including {f:major_wins} major championships':''}.`));
  d.seo_title=has('to_par')?`{f:winner} wins the {f:event} at {f:to_par}`:`{f:winner} wins the {f:event}`;d.social_headline=`{f:winner} wins the {f:event}`;
 }else if(p.type==='notable_round'){
  d.headline=`{f:player} shoots {f:round_strokes} in the {f:round_word} round of the {f:event}`;
  d.dek=`{f:player} played the {f:round_word} round in {f:round_to_par}, {f:vs_field} strokes better than the field average.`;
  d.sections.push(S('The round',`{e:p1} shot {f:round_strokes}, {f:round_to_par}, in the {f:round_word} round of ${event}${course?` at ${course}`:''}.`,'Against the average of every player who completed the round, it was {f:vs_field} strokes better.',has('birdies')?`The card had {f:birdies} birdies${has('eagles')?', {f:eagles} eagles or better':''} and {f:bogeys} bogeys.`:null));
  if(has('career_low')||has('is_career_low'))d.sections.push(S('In context',has('is_career_low')?'It is {f:is_career_low}.':`The lowest round in our record for {f:player} remains {f:career_low}, at the {f:career_low_event}.`));
  d.seo_title=`{f:player} shoots {f:round_strokes} at the {f:event}`;d.social_headline=`{f:player}: {f:round_strokes} at the {f:event}`;
 }else if(p.type==='cut'){
  d.headline=`{f:missed_notables} miss the cut at the {f:event}`;
  d.dek=`The cut${has('cut_line')?' fell at {f:cut_line}':' has been made'}${has('made_cut')?', with {f:made_cut} players through to the weekend':''}.`;
  d.sections.push(S('The cut',`After the second round of ${event}, the cut${has('cut_line')?' fell at {f:cut_line}':' has been made'}.`,has('made_cut')?'{f:made_cut} players are through to the weekend.':null),S('Notable misses',`Among the players heading home: ${['p1','p2','p3','p4'].filter(ent).map(k=>`{e:${k}}`).join(', ')}.`,has('missed_major_champions')?'That includes {f:missed_major_champions} major champions.':null));
  d.seo_title=`{f:event} cut: {f:missed_notables} miss out`;d.social_headline=`{f:missed_notables} miss the cut at the {f:event}`;
 }else if(p.type==='course_weather'){
  d.headline=has('max_gust')?`Gusts to {f:max_gust} in the {f:event} forecast`:`Rain chances to {f:max_rain} in the {f:event} forecast`;
  d.dek=`The National Weather Service forecast for {f:forecast_point} covers the tournament days.`;
  d.sections.push(S('The forecast',has('max_gust')?'The strongest daytime gust in the forecast is {f:max_gust}, on {f:max_gust_day}.':null,has('max_rain')?'The highest hourly chance of rain during daylight is {f:max_rain}, on {f:max_rain_day}.':null,has('max_temp')?'The forecast high is {f:max_temp}.':null),S('About this forecast','The forecast point is {f:forecast_point}. It was issued {f:forecast_issued}.'));
  d.seo_title=`{f:event} weather forecast`;d.social_headline=`{f:event} forecast: wind and rain`;
 }else if(p.type==='major_history'){
  d.headline=`The {f:event} in our record: champions and repeat winners`;
  d.dek=`Our record holds {f:editions_in_record} previous editions of the {f:event}.`;
  d.sections.push(S('Recent champions','The most recent champions: {f:last_champions}.'),has('multiple_winners')?S('Repeat winners',`Multiple champions in our record: {f:multiple_winners}.`):null);
  d.sections=d.sections.filter(Boolean);
  d.seo_title=`{f:event} history: champions and repeat winners`;d.social_headline=`{f:event} history`;
 }else if(p.type==='player_form'){
  d.headline=`{f:player} arrives at the {f:event} in form`;
  d.dek=`{f:player} has {f:recent_top10} top-ten finishes in {f:recent_starts} starts${has('recent_wins')?', including a win':''}.`;
  d.sections.push(S('The run',`{e:p1} comes to ${event} with {f:recent_top10} top-ten finishes in the last {f:recent_starts} starts in our record.`,'Latest first: {f:recent_results}.','On recent form, {f:player} sits in the {f:form_pct} of our Player DNA.'));
  d.seo_title=`{f:player} form ahead of the {f:event}`;d.social_headline=`{f:player} in form for the {f:event}`;
 }else if(p.type==='course_intelligence'){
  d.headline=`How {f:course} plays: Course DNA for the {f:event}`;
  d.dek=`Measured across {f:dna_editions} full-field editions in our record.`;
  d.sections.push(S('Scoring',has('difficulty')?`Across {f:dna_editions} full-field editions, the field has averaged {f:difficulty} strokes to par per round at ${course}.`:null,has('difficulty_pct')?'That ranks in the {f:difficulty_pct} for difficulty among measured courses.':null,has('spread')?'Round scores spread by {f:spread} strokes (standard deviation).':null));
  d.seo_title=`{f:course} Course DNA`;d.social_headline=`How {f:course} plays`;
 }else if(p.type==='play_suspended'){
  d.headline=`Play suspended in the {f:round_word} round of the {f:event}`;
  d.dek=`ESPN reports play suspended${course?` at ${course}`:''}.${has('leaders')?' {f:leaders} led at {f:lead_score} when play stopped.':''}`;
  d.sections.push(S('Where things stand',`Play in the {f:round_word} round of ${event} is suspended in the ESPN scoring feed.`,has('leaders')?'At the stoppage, {f:leaders} led at {f:lead_score}.':null,'Scores are as of {f:snapshot_time}.'));
  d.seo_title=`{f:event}: play suspended in the {f:round_word} round`;d.social_headline=`Play suspended at the {f:event}`;
 }else if(p.type==='playoff'){
  d.headline=`{f:playoff_players} head to a playoff at the {f:event}`;
  d.dek=`{f:playoff_players} finished regulation tied${has('playoff_score')?' at {f:playoff_score}':''}.`;
  d.sections.push(S('Tied after regulation',`${event} goes to a playoff between {f:playoff_players}${has('playoff_score')?', tied at {f:playoff_score}':''}.`,course?`The playoff is at ${course}.`:null));
  d.seo_title=`{f:event} playoff: {f:playoff_players}`;d.social_headline=`Playoff at the {f:event}`;
 }else return null;
 d.seo_description=d.dek;
 return d;
}
