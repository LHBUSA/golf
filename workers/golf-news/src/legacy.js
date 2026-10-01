// Legacy V3 final-story builder (kept for regression tests; V4 lives in workers/shared/news).
import {freezePacket} from './pipeline.js';
const toPar=v=>v===0?'even par':v<0?Math.abs(v)+' under par':v+' over par';
const names=rows=>rows.map(r=>r.player?.name).filter(Boolean);
const list=a=>a.length<=1?a.join(''):a.slice(0,-1).join(', ')+' and '+a.at(-1);
// One material story per completed edition with a published leaderboard: the final result.
export async function buildStory(ed){
 const board=ed.leaderboard||[],w=board.find(r=>r.winner);
 if(ed.status!=='completed'||!w?.player?.slug||['winner_only','schedule_only','none'].includes(ed.coverage))return {skip:'not_material'};
 const cap=ed.provenance?.id;if(!cap)return {skip:'no_capture'};
 const facts=[{id:'event',capture_id:cap,value:ed.name},{id:'championship',capture_id:cap,value:ed.tournament?.name||ed.name},{id:'winner',capture_id:cap,value:w.player.name}];
 if(ed.course)facts.push({id:'course',capture_id:cap,value:ed.course.name});
 if(Number.isInteger(w.strokes))facts.push({id:'total',capture_id:cap,value:w.strokes});
 if(Number.isInteger(w.to_par))facts.push({id:'to_par',capture_id:cap,value:w.to_par,display:toPar(w.to_par)});
 if(w.rounds?.length)facts.push({id:'winner_rounds',capture_id:cap,value:w.rounds.map(r=>r.strokes).join('-'),display:list(w.rounds.map(r=>String(r.strokes)))});
 const second=board.filter(r=>r.status==='finished'&&r.position===2);
 if(second.length)facts.push({id:'runner_up',capture_id:cap,value:list(names(second))});
 if(Number.isFinite(w.margin)&&w.margin>0)facts.push({id:'margin',capture_id:cap,value:w.margin,display:w.margin===1?'one stroke':w.margin+' strokes'});
 const t3=ed.timeline?.find(t=>t.after_round===3);if(t3)facts.push({id:'r3_leaders',capture_id:cap,value:list(t3.leaders.map(l=>l.name))});
 if(ed.results_source?.cut&&Number.isInteger(ed.results_source.cut.score_to_par))facts.push({id:'cut',capture_id:cap,value:ed.results_source.cut.score_to_par,display:toPar(ed.results_source.cut.score_to_par)});
 if(ed.results_source?.made_cut)facts.push({id:'made_cut',capture_id:cap,value:ed.results_source.made_cut});
 const has=id=>facts.some(f=>f.id===id);
 const paragraphs=[{kind:'fact_sentence',template:has('course')?'{winner} won the {event} at {course}.':'{winner} won the {event}.'}];
 if(has('total')&&has('to_par'))paragraphs.push({kind:'fact_sentence',template:'The winning total was {total}, {to_par}.'});
 if(has('winner_rounds'))paragraphs.push({kind:'fact_sentence',template:'{winner} posted rounds of {winner_rounds}.'});
 if(w.margin===0&&has('runner_up'))paragraphs.push({kind:'fact_sentence',template:'The title was decided in a playoff over {runner_up}.'});
 else if(has('margin')&&has('runner_up'))paragraphs.push({kind:'fact_sentence',template:'The margin over {runner_up} was {margin}.'});
 if(has('r3_leaders'))paragraphs.push({kind:'fact_sentence',template:'{r3_leaders} held the lead after the third round.'});
 if(has('cut')&&has('made_cut'))paragraphs.push({kind:'fact_sentence',template:'The cut fell at {cut}, with {made_cut} players advancing to the weekend.'});
 const packet=await freezePacket({event_key:'final:'+ed.slug,capture_ids:[cap],materiality:'tournament_final',facts});
 return {packet,draft:{title:`${w.player.name} wins ${/^the /i.test(ed.tournament?.name||'')?ed.tournament.name:'the '+(ed.tournament?.name||'tournament')}`,paragraphs},ed,winner:w};
}
