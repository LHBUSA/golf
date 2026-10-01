// Golf Newsroom V4 story types. Each type: detect(ctx) -> candidates, build(ctx, cand) -> Packet (unfrozen).
// Materiality is deterministic and scored from facts; there is no quota and no filler.
import {Packet,toParWords,toParShort,posWords,list,dayName,addDays,roundWord,ORD} from './facts.js';
import {roundsComplete,standingsAfter,roundStats,holeDifficulty,weatherDays,r1,mean,boardFromSnapshot} from './golf-math.js';
import {liveState,toParText} from '../live.js';
const MIN_MATERIAL=3;
export const THRESHOLD=MIN_MATERIAL;
const nameOf=ed=>ed.tournament?.name||ed.name.replace(/^\d{4}\s+/,'');
const daysBetween=(a,b)=>Math.round((Date.parse(b+'T12:00:00Z')-Date.parse(a+'T12:00:00Z'))/86400000);
const sourceOf=ed=>ed.espn?'ESPN':ed.results_source?.attribution||'Canonical golf record';

// Edition basics shared by every edition-scoped packet.
function editionFacts(P,ed){
 P.fact('event',nameOf(ed),null,'Tournament');P.fact('event_full',ed.name,null,'Edition');P.fact('year',ed.year,String(ed.year),'Year');
 P.entity('t1','tournament',ed.slug,ed.name);
 if(ed.course?.slug){P.fact('course',ed.course.name,null,'Course');P.entity('c1','course',ed.course.slug,ed.course.name);}
 const ec=ed.espn?.course;const loc=ec?[ec.city,ec.state||ec.country].filter(Boolean).join(', '):null;P.fact('locality',loc,null,'Location');
 const par=ec?.par||ed.layout?.par||ed.par;P.fact('par',par,`par ${par}`,'Par');
 const yards=ec?.yards||ed.layout?.yardage;P.fact('yards',yards,yards?`${yards.toLocaleString('en-US')} yards`:null,'Yardage',{unit:'yards'});
 P.fact('purse',ed.espn?.purse_text||null,null,'Purse');
 P.fact('tour',ed.espn?.tour_label||ed.tours?.[0]||null,null,'Tour');
 if(ed.series_key){P.entity('s1','majors',ed.series_key,nameOf(ed));}
 if(ed.starts_on)P.fact('start_day',ed.starts_on,dayName(ed.starts_on),'First round');
 if(ed.ends_on)P.fact('end_day',ed.ends_on,dayName(ed.ends_on),'Final round');
 P.context={edition:ed.slug,division:ed.division,is_major:Boolean(ed.is_major),status:ed.status,tour:ed.espn?.tour_label||ed.tours?.[0]||null,course:ed.course?.slug||null};
}
const leaderboardChart=(rows,n,title)=>({type:'leaderboard',title,rounds:n,rows:rows.slice(0,10).map(s=>({name:s.player.name,slug:s.player.slug,pos:(s.tied?'T':'')+s.position,to_par:s.to_par,rounds:s.rounds.map(x=>x.strokes)}))});
const progressChart=(board,n,top,title)=>({type:'progress',title,rounds:n,series:top.slice(0,5).map(s=>{let c=0;return {name:s.player.name,slug:s.player.slug,points:s.rounds.slice(0,n).map(x=>(c+=x.to_par))};})});
function weatherChart(ed){const days=weatherDays(ed.weather,{from:ed.starts_on,to:ed.ends_on});return days.length?{type:'weather',title:'Tournament-week forecast',days,precision:ed.weather.precision||'venue',locality:ed.weather.locality?.label||null,issued:ed.weather.forecast_update_time||ed.weather.fetched_at,source:ed.weather.source,licence_url:ed.weather.licence_url||null,tz_basis:ed.weather.tz_basis||null,has_gust:ed.weather.hours.some(h=>h.gust_mph!=null)}:null;}
function playerDnaChart(p){const m=p?.dna?.l24m?.metrics||p?.dna?.all?.metrics;if(!m)return null;const dims=Object.entries(m).filter(([,v])=>v&&v.percentile!==null&&v.percentile!==undefined).map(([code,v])=>({code,percentile:v.percentile,confidence:v.confidence,sample:v.sample}));return dims.length>=3?{type:'dna',title:`${p.name} Player DNA`,player:{name:p.name,slug:p.slug},window:p.dna.l24m?.window?.label||'All observed',dims}:null;}
function formChartSpec(p){const f=(p?.visuals?.form||[]).slice(-12);return f.filter(x=>Number.isFinite(x.vs_field)).length>=3?{type:'form',title:`${p.name}: recent form`,player:{name:p.name,slug:p.slug},series:f}:null;}

export const TYPES={
 // ---------------------------------------------------------------- PREVIEW
 preview:{label:'Preview',category:'PREVIEW',
  detect(ctx){return ctx.window.filter(e=>e.starts_on&&daysBetween(ctx.today,e.starts_on)>=0&&daysBetween(ctx.today,e.starts_on)<=6&&e.status!=='completed'&&e.status!=='cancelled').map(e=>({type:'preview',topic:'preview:'+e.slug,edition:e.slug}));},
  async build(ctx,c){const ed=await ctx.ed(c.edition);
   // Once any round score is posted, the preview window has closed.
   if(!ed||ed.status==='in_progress'||(ed.leaderboard||[]).some(r=>r.rounds?.length))return null;
   const P=new Packet({type:'preview',topic:c.topic,as_of:ctx.as_of,source:sourceOf(ed),capture:ed.provenance?.id});editionFacts(P,ed);
   P.fact('field_size',ed.espn?.field_size||ed.field?.players||null,null,'Field size',{unit:'players'});
   const dc=ed.defending_champion;if(dc?.slug){P.fact('defending',dc.name,null,'Defending champion');P.entity('p1','player',dc.slug,dc.name);P.material(1,'defending champion known');}
   const past=(ed.past_editions||[]).filter(x=>x.winner?.name).slice(0,5);
   if(past.length>=2){P.fact('recent_winners',past.slice(0,3).map(x=>`${x.winner.name} (${x.year})`),list(past.slice(0,3).map(x=>`${x.winner.name} (${x.year})`)),'Recent champions');P.chart('past_winners',{type:'past_winners',title:'Recent champions',rows:past.map(x=>({year:x.year,name:x.winner.name,slug:x.winner.slug,to_par:x.to_par??null,edition:x.slug}))});P.material(1,'tournament history');}
   const champs=(ed.field?.major_champions||[]).slice(0,4);if(champs.length){P.fact('field_major_champions',champs.map(x=>x.name),list(champs.map(x=>x.name)),'Major champions in the field');P.fact('field_major_champion_count',ed.field.major_champions.length,null,'Major champions in the field',{unit:'players'});champs.forEach((x,i)=>P.entity('p'+(i+2),'player',x.slug,x.name));P.material(1,'major champions in field');}
   // Field form leaders and their strokes-vs-field values are All Access data: not used in public stories.
   const m=ed.matchups_to_watch?.[0];if(m?.a?.slug&&m?.b?.slug){P.entity('m1','matchup',m.a.slug+'/'+m.b.slug,`${m.a.name} vs ${m.b.name}`);P.fact('matchup',`${m.a.name} vs ${m.b.name}`,null,'Matchup to watch');}
   if(ed.is_major)P.material(2,'major championship');
   if(ed.espn?.course?.par||ed.layout?.par)P.material(1,'course setup');
   const wc=weatherChart(ed);if(wc){P.chart('weather',wc);P.material(1,'forecast available');const g=Math.max(...wc.days.map(d=>d.gust_max??0));if(g)P.fact('max_gust',g,`${g} mph`,'Strongest forecast gust (7am–7pm)',{source:'NOAA National Weather Service',unit:'mph'});}
   P.limit('Previews describe the field, the course and the history in our record. They are not a forecast of the result.');
   return P;}},
 // ---------------------------------------------------------------- ROUND RECAPS (R1-R3)
 round_recap:{label:'Round recap',category:'ROUND RECAP',
  detect(ctx){return ctx.window.filter(e=>e.status!=='completed'&&e.starts_on&&daysBetween(e.starts_on,ctx.today)>=0&&daysBetween(ctx.today,e.ends_on||e.starts_on)>=-1).map(e=>({type:'round_recap',topic:null,edition:e.slug}));},
  async build(ctx,c){const ed0=await ctx.ed(c.edition);if(!ed0||ed0.status==='completed')return null;
   // The live ESPN snapshot is fresher than the projection; use it when it has more completed rounds.
   const snap=ctx.live?await ctx.live(c.edition):null,lb=boardFromSnapshot(snap),useLive=roundsComplete(lb)>roundsComplete(ed0.leaderboard);
   const ed=useLive?{...ed0,leaderboard:lb}:ed0;const n=roundsComplete(ed.leaderboard);if(n<1||n>3)return null;
   // Recaps are timely: only within a day of the round's scheduled date.
   if(ed.starts_on&&daysBetween(addDays(ed.starts_on,n-1),ctx.today)>1)return null;
   const P=new Packet({type:'round_recap',topic:`round:${ed.slug}:${n}`,as_of:ctx.as_of,source:useLive?'ESPN (live scoring snapshot)':sourceOf(ed),capture:useLive?snap.capture_id||null:ed.provenance?.id});editionFacts(P,ed);P.context.round=n;P.context.live_snapshot=useLive?snap.fetched_at:null;
   const st=standingsAfter(ed.leaderboard,n);if(st.length<20)return null;const leaders=st.filter(s=>s.position===1);
   P.fact('round_word',roundWord(n),null,'Round');P.fact('round_number',n,String(n),'Round number');
   P.fact('leaders',leaders.map(s=>s.player.name),list(leaders.map(s=>s.player.name)),leaders.length>1?'Co-leaders':'Leader');
   leaders.slice(0,3).forEach((s,i)=>P.entity('p'+(i+1),'player',s.player.slug,s.player.name));
   P.fact('lead_score',leaders[0].to_par,toParWords(leaders[0].to_par),'Leading score');
   P.fact('lead_total',leaders[0].strokes,String(leaders[0].strokes),'Leading total',{unit:'strokes'});
   const next=st.find(s=>s.position>1);if(next&&leaders.length===1){const gap=next.to_par-leaders[0].to_par;P.fact('lead_margin',gap,gap===1?'one stroke':`${gap} strokes`,'Lead',{unit:'strokes'});P.fact('chasers',st.filter(s=>s.position===next.position).slice(0,4).map(s=>s.player.name),list(st.filter(s=>s.position===next.position).slice(0,4).map(s=>s.player.name)),'Nearest pursuers');}
   const rs=roundStats(ed.leaderboard,n);if(rs){P.fact('round_average',rs.average,rs.average.toFixed(1),`Field scoring average, ${roundWord(n)} round`,{unit:'strokes'});P.fact('low_round',rs.low,String(rs.low),`Low round of the day`,{unit:'strokes'});P.fact('low_round_players',rs.low_players.map(p=>p.name),list(rs.low_players.map(p=>p.name)),'Low round by');P.fact('under_par_count',rs.under_par,String(rs.under_par),'Players under par for the round',{unit:'players'});P.fact('round_field',rs.n,String(rs.n),'Players completing the round',{unit:'players'});rs.low_players.slice(0,2).forEach((p,i)=>P.entity('l'+(i+1),'player',p.slug,p.name));}
   if(n>=2){const prev=standingsAfter(ed.leaderboard,n-1),pp=new Map(prev.map(s=>[s.player.slug,s.position]));const climbers=st.filter(s=>s.position<=10&&pp.get(s.player.slug)).map(s=>({s,gain:pp.get(s.player.slug)-s.position})).filter(x=>x.gain>=10).sort((a,b)=>b.gain-a.gain).slice(0,1);
    if(climbers[0]){const x=climbers[0];P.fact('climber',x.s.player.name,null,'Biggest climb into the top ten');P.fact('climber_from',pp.get(x.s.player.slug),ORD(pp.get(x.s.player.slug)),'Position before the round');P.fact('climber_to',x.s.position,(x.s.tied?'a share of ':'')+ORD(x.s.position),'Position after the round');P.entity('x1','player',x.s.player.slug,x.s.player.name);}}
   if(n===2){const cut=ed.leaderboard.filter(r=>r.status==='cut');if(cut.length>=10){const made=st.length;P.fact('made_cut',made,String(made),'Players through to the weekend',{unit:'players'});}}
   P.chart('leaderboard',leaderboardChart(st,n,`Leaderboard after the ${roundWord(n)} round`));
   if(n>=2)P.chart('round_progress',progressChart(ed.leaderboard,n,st,'Leaders, score to par by round'));
   const wc=weatherChart(ed);if(wc)P.chart('weather',wc);
   P.material(3,`${roundWord(n)} round complete`);if(ed.is_major)P.material(1,'major');
   P.limit('Standings are computed from posted round scores; players still on the course are not included.');
   return P;}},
 // ---------------------------------------------------------------- FINAL
 final:{label:'Final round',category:'FINAL',
  detect(ctx){return ctx.recent.filter(e=>e.status==='completed'&&e.ends_on&&daysBetween(e.ends_on,ctx.today)<=14&&daysBetween(e.ends_on,ctx.today)>=0).map(e=>({type:'final',topic:'final:'+e.slug,edition:e.slug}));},
  async build(ctx,c){const ed=await ctx.ed(c.edition);const board=ed?.leaderboard||[];const w=board.find(r=>r.winner);
   if(!ed||ed.status!=='completed'||!w?.player?.slug||['winner_only','schedule_only','none'].includes(ed.coverage))return null;
   const P=new Packet({type:'final',topic:c.topic,as_of:ctx.as_of,source:sourceOf(ed),capture:ed.provenance?.id});editionFacts(P,ed);
   P.fact('winner',w.player.name,null,'Champion');P.entity('p1','player',w.player.slug,w.player.name);
   if(Number.isInteger(w.strokes))P.fact('total',w.strokes,String(w.strokes),'Winning total',{unit:'strokes'});
   if(Number.isInteger(w.to_par))P.fact('to_par',w.to_par,toParWords(w.to_par),'Winning score');
   const rounds=(w.rounds||[]).filter(r=>Number.isInteger(r.strokes));if(rounds.length){P.fact('winner_rounds',rounds.map(r=>r.strokes),list(rounds.map(r=>String(r.strokes))),'Champion’s rounds');P.fact('final_round',rounds.at(-1).strokes,String(rounds.at(-1).strokes),'Champion’s final round',{unit:'strokes'});}
   const second=board.filter(r=>r.status==='finished'&&r.position===2&&r.player?.slug);if(second.length){P.fact('runner_up',second.map(r=>r.player.name),list(second.map(r=>r.player.name)),'Runner-up');second.slice(0,2).forEach((r,i)=>P.entity('p'+(i+2),'player',r.player.slug,r.player.name));}
   if(second.length&&Number.isInteger(w.strokes)&&Number.isInteger(second[0].strokes)){const m=second[0].strokes-w.strokes;if(m>0)P.fact('margin',m,m===1?'one stroke':`${m} strokes`,'Winning margin',{unit:'strokes'});else if(m===0)P.fact('playoff',true,'a playoff','Decided by');}
   const n=Math.max(...board.map(r=>(r.rounds||[]).length));
   if(n>=4){const st3=standingsAfter(board,n-1);const wl=st3.find(s=>s.player.slug===w.player.slug);const lead3=st3.filter(s=>s.position===1);
    if(lead3.length){P.fact('r3_leaders',lead3.map(s=>s.player.name),list(lead3.map(s=>s.player.name)),'Leader entering the final round');}
    if(wl){P.fact('winner_start_pos',wl.position,wl.position===1?(wl.tied?'a share of the lead':'the lead'):(wl.tied?'a share of ':'')+ORD(wl.position)+' place','Champion’s position entering the final round');if(wl.position>1){const back=wl.to_par-lead3[0].to_par;P.fact('winner_deficit',back,back===1?'one stroke':`${back} strokes`,'Deficit entering the final round',{unit:'strokes'});P.material(1,'comeback');}}
    P.chart('round_progress',progressChart(board,n,standingsAfter(board,n),'Contenders, score to par by round'));}
   const st=standingsAfter(board,n);if(st.length>=10)P.chart('leaderboard',{...leaderboardChart(st,n,'Final leaderboard'),rows:board.filter(r=>r.status==='finished'&&r.player?.slug).sort((a,b)=>a.position-b.position).slice(0,10).map(r=>({name:r.player.name,slug:r.player.slug,pos:(r.tied?'T':'')+r.position,to_par:r.to_par,rounds:(r.rounds||[]).map(x=>x.strokes)}))});
   const rsn=roundStats(board,n);if(rsn){P.fact('final_low',rsn.low,String(rsn.low),'Low final round',{unit:'strokes'});P.fact('final_low_players',rsn.low_players.map(p=>p.name),list(rsn.low_players.map(p=>p.name)),'Low final round by');}
   const cut=ed.results_source?.cut;if(cut&&Number.isInteger(cut.score_to_par))P.fact('cut_line',cut.score_to_par,toParWords(cut.score_to_par),'Cut line');
   const pl=await ctx.pl(w.player.slug);
   if(pl){P.fact('career_wins',pl.summary?.wins_observed??null,null,'Wins in our record',{unit:'wins'});if(ed.is_major)P.fact('major_wins',pl.summary?.major_wins??null,null,'Major wins in our record',{unit:'wins'});P.chart('winner_dna',playerDnaChart(pl));P.chart('winner_form',formChartSpec(pl));P.context.winner_photo=Boolean(pl.photo?.derivatives);}
   const hd=holeDifficulty(board,ed.layout);if(hd){P.chart('hole_difficulty',{type:'holes',title:'Hole difficulty: field average to par',...hd});const hard=hd.holes.slice().sort((a,b)=>b.avg_to_par-a.avg_to_par)[0];P.fact('hardest_hole',hard.hole,`the ${ORD(hard.hole)}`,'Hardest hole');P.fact('hardest_hole_avg',hard.avg_to_par,`${hard.avg_to_par>0?'+':''}${hard.avg_to_par.toFixed(2)}`,'Hardest hole, field average to par');}
   const wc=weatherChart(ed);if(wc)P.chart('weather',wc);
   P.material(3,'tournament complete');if(ed.is_major)P.material(2,'major');
   P.limit('Positions and totals are the published final leaderboard; career counts cover events in our record only.');
   return P;}},
 // ---------------------------------------------------------------- NOTABLE ROUND
 notable_round:{label:'Notable round',category:'ROUND OF THE DAY',
  detect(ctx){return [...ctx.window,...ctx.recent].filter(e=>e.ends_on&&daysBetween(e.ends_on,ctx.today)<=2).map(e=>({type:'notable_round',topic:null,edition:e.slug}));},
  async build(ctx,c){const ed=await ctx.ed(c.edition);if(!ed)return null;let best=null;
   for(const r of ed.leaderboard||[])for(const x of r.rounds||[]){if(!r.player?.slug||!Number.isFinite(x.vs_field))continue;if(x.vs_field>=6&&(!best||x.vs_field>best.x.vs_field))best={r,x};}
   if(!best)return null;const {r,x}=best;
   if(ed.starts_on&&daysBetween(addDays(ed.starts_on,x.round-1),ctx.today)>2)return null;
   const P=new Packet({type:'notable_round',topic:`notable:${ed.slug}:${r.player.slug}:${x.round}`,as_of:ctx.as_of,source:sourceOf(ed),capture:ed.provenance?.id});editionFacts(P,ed);
   P.fact('player',r.player.name,null,'Player');P.entity('p1','player',r.player.slug,r.player.name);
   P.fact('round_word',roundWord(x.round),null,'Round');P.fact('round_strokes',x.strokes,String(x.strokes),'Round score',{unit:'strokes'});P.fact('round_to_par',x.to_par,toParWords(x.to_par),'Round to par');
   P.fact('vs_field',r1(x.vs_field),r1(x.vs_field).toFixed(1),'Strokes better than the field average that round',{unit:'strokes'});
   const pl=await ctx.pl(r.player.slug);const low=pl?.visuals?.lowest_round;
   if(low&&Number.isInteger(low.strokes)&&low.strokes<x.strokes&&low.slug!==ed.slug){P.fact('career_low',low.strokes,String(low.strokes),'Lowest round in our record',{unit:'strokes'});P.fact('career_low_event',low.name,null,'Lowest round came at');}
   else if(low&&low.slug===ed.slug&&low.round===x.round)P.fact('is_career_low',true,'the lowest round in our record for this player','Record');
   const card=(r.holes||[]).find(h=>h.round===x.round);if(card?.scores?.length===18){const birdies=card.scores.filter(s=>s.to_par===-1).length,eagles=card.scores.filter(s=>s.to_par<=-2).length,bogeys=card.scores.filter(s=>s.to_par>=1).length;P.fact('birdies',birdies,String(birdies),'Birdies',{unit:'holes'});if(eagles)P.fact('eagles',eagles,String(eagles),'Eagles or better',{unit:'holes'});P.fact('bogeys',bogeys,bogeys===0?'no':String(bogeys),'Bogeys or worse',{unit:'holes'});P.chart('scorecard',{type:'scorecard',title:`${r.player.name}, ${roundWord(x.round)} round`,player:{name:r.player.name,slug:r.player.slug},round:x.round,holes:card.scores.map(s=>({...s,par:s.strokes-s.to_par}))});}
   if(pl){P.chart('player_form',formChartSpec(pl));P.chart('player_dna',playerDnaChart(pl));}
   P.material(x.vs_field>=8?4:3,'exceptional field-relative round');
   P.limit('Field-relative scoring compares the round to the average score of every player who completed that round.');
   return P;}},
 // ---------------------------------------------------------------- CUT
 cut:{label:'Cut',category:'CUT LINE',
  detect(ctx){return [...ctx.window,...ctx.recent].filter(e=>e.ends_on&&daysBetween(e.ends_on,ctx.today)<=1).map(e=>({type:'cut',topic:'cut:'+e.slug,edition:e.slug}));},
  async build(ctx,c){const ed=await ctx.ed(c.edition);if(!ed)return null;const n=roundsComplete(ed.leaderboard);const missed=(ed.leaderboard||[]).filter(r=>r.status==='cut'&&r.player?.slug);
   if(n<2||missed.length<10)return null;if(ed.starts_on&&daysBetween(addDays(ed.starts_on,1),ctx.today)>1)return null;
   const notable=missed.map(r=>({r,s:ctx.ixPlayer(r.player.slug)})).filter(o=>o.s&&(o.s.major_wins>0||(o.s.scoring?.percentile??0)>=90)).sort((a,b)=>(b.s.major_wins||0)-(a.s.major_wins||0)).slice(0,4);
   if(!notable.length)return null;
   const P=new Packet({type:'cut',topic:c.topic,as_of:ctx.as_of,source:sourceOf(ed),capture:ed.provenance?.id});editionFacts(P,ed);
   const st2=standingsAfter(ed.leaderboard,2);const made=st2.filter(s=>s.row.status!=='cut');if(made.length){const line=Math.max(...made.map(s=>s.to_par));P.fact('cut_line',line,toParWords(line),'Cut line after two rounds');P.fact('made_cut',made.length,String(made.length),'Players through to the weekend',{unit:'players'});}
   P.fact('missed_notables',notable.map(o=>o.r.player.name),list(notable.map(o=>o.r.player.name)),'Notable players to miss the cut');notable.forEach((o,i)=>P.entity('p'+(i+1),'player',o.r.player.slug,o.r.player.name));
   const champs=notable.filter(o=>o.s.major_wins>0);if(champs.length)P.fact('missed_major_champions',champs.length,String(champs.length),'Major champions to miss the cut',{unit:'players'});
   P.chart('leaderboard',leaderboardChart(st2,2,'Leaderboard after the second round'));
   P.material(2+Math.min(2,champs.length),'notable players missed the cut');
   P.limit('Cut status is as published; it does not record why a player missed.');
   return P;}},
 // ---------------------------------------------------------------- COURSE WEATHER
 course_weather:{label:'Course weather',category:'WEATHER',
  detect(ctx){return ctx.window.filter(e=>e.starts_on&&daysBetween(ctx.today,e.starts_on)<=5&&daysBetween(e.ends_on||e.starts_on,ctx.today)<=0).map(e=>({type:'course_weather',topic:'weather:'+e.slug,edition:e.slug}));},
  async build(ctx,c){const ed=await ctx.ed(c.edition);if(!ed?.weather)return null;const wc=weatherChart(ed);if(!wc)return null;
   const days=wc.days.filter(d=>d.day>=ctx.today);if(!days.length)return null;
   const gust=days.reduce((m,d)=>(d.gust_max??-1)>(m?.gust_max??-1)?d:m,null),rain=days.reduce((m,d)=>(d.pop_max??-1)>(m?.pop_max??-1)?d:m,null),hot=days.reduce((m,d)=>(d.temp_max??-99)>(m?.temp_max??-99)?d:m,null);
   const P=new Packet({type:'course_weather',topic:c.topic,as_of:ctx.as_of,source:'NOAA National Weather Service',capture:ed.weather.capture_id||null});editionFacts(P,ed);
   const src={source:'NOAA National Weather Service',capture:ed.weather.capture_id||null};
   if(gust?.gust_max){P.fact('max_gust',gust.gust_max,`${gust.gust_max} mph`,'Strongest forecast gust (7am–7pm)',{...src,unit:'mph'});P.fact('max_gust_day',gust.day,dayName(gust.day),'Day of strongest gusts',src);if(gust.gust_max>=25)P.material(3,'strong gusts forecast');}
   if(rain?.pop_max!==null&&rain?.pop_max!==undefined){P.fact('max_rain',rain.pop_max,`${rain.pop_max}%`,'Highest hourly rain chance (7am–7pm)',{...src,unit:'percent'});P.fact('max_rain_day',rain.day,dayName(rain.day),'Day of highest rain chance',src);if(rain.pop_max>=60)P.material(3,'rain likely during play');}
   if(hot?.temp_max){P.fact('max_temp',hot.temp_max,`${hot.temp_max}°F`,'Highest forecast temperature',{...src,unit:'F'});if(hot.temp_max>=95)P.material(2,'heat');}
   P.fact('forecast_issued',wc.issued,new Date(wc.issued).toUTCString().replace(':00 GMT',' UTC').replace(' GMT',' UTC'),'Forecast issued',src);
   P.fact('forecast_point',wc.precision==='locality'?`${wc.locality||'the nearest town'} (town-level estimate)`:'the course',null,'Forecast point',src);
   P.chart('weather',wc);
   P.limit('This is a forecast, not observed conditions; it can change. We do not estimate course firmness.');
   if(wc.precision==='locality')P.limit('The forecast point is the nearest town, not the course itself.');
   return P;}},
 // ---------------------------------------------------------------- MAJOR HISTORY
 major_history:{label:'Major history',category:'MAJOR HISTORY',
  detect(ctx){return ctx.window.filter(e=>e.is_major&&e.starts_on&&daysBetween(ctx.today,e.starts_on)>=0&&daysBetween(ctx.today,e.starts_on)<=10).map(e=>({type:'major_history',topic:'major:'+e.slug,edition:e.slug}));},
  async build(ctx,c){const ed=await ctx.ed(c.edition);if(!ed?.is_major)return null;const past=(ed.past_editions||[]).filter(x=>x.winner?.name);if(past.length<5)return null;
   const P=new Packet({type:'major_history',topic:c.topic,as_of:ctx.as_of,source:sourceOf(ed),capture:ed.provenance?.id});editionFacts(P,ed);
   P.fact('editions_in_record',past.length,String(past.length),'Previous editions in our record',{unit:'editions'});
   const wins=new Map();for(const x of past){const k=x.winner.slug||x.winner.name;wins.set(k,{name:x.winner.name,slug:x.winner.slug,n:(wins.get(k)?.n||0)+1});}
   const multi=[...wins.values()].filter(x=>x.n>1).sort((a,b)=>b.n-a.n).slice(0,4);if(multi.length){P.fact('multiple_winners',multi.map(x=>`${x.name} (${x.n})`),list(multi.map(x=>`${x.name} (${x.n})`)),'Multiple champions in our record');multi.forEach((x,i)=>x.slug&&P.entity('p'+(i+1),'player',x.slug,x.name));}
   P.fact('last_champions',past.slice(0,5).map(x=>`${x.winner.name} (${x.year})`),list(past.slice(0,5).map(x=>`${x.winner.name} (${x.year})`)),'Most recent champions');
   P.chart('past_winners',{type:'past_winners',title:'Champions in our record',rows:past.slice(0,12).map(x=>({year:x.year,name:x.winner.name,slug:x.winner.slug,to_par:x.to_par??null,edition:x.slug}))});
   P.material(3,'major week history');
   return P;}},
 // ---------------------------------------------------------------- PLAYER FORM
 player_form:{label:'Player form',category:'FORM',
  detect(ctx){return ctx.window.filter(e=>e.starts_on&&daysBetween(ctx.today,e.starts_on)>=0&&daysBetween(ctx.today,e.starts_on)<=4).map(e=>({type:'player_form',topic:null,edition:e.slug}));},
  async build(ctx,c){const ed=await ctx.ed(c.edition);if(!ed||(ed.leaderboard||[]).some(r=>r.rounds?.length))return null;
   // Public data only: the entry list, public form percentiles and published finishes.
   const field=(ed.leaderboard||[]).map(r=>r.player?.slug).filter(Boolean).map(s=>ctx.ixPlayer(s)).filter(p=>p?.form?.percentile!=null).sort((a,b)=>b.form.percentile-a.form.percentile);
   const lead=field[0];if(!lead)return null;
   const pl=await ctx.pl(lead.slug);const form=(pl?.visuals?.form||[]).filter(f=>f.status&&f.ends_on<ed.starts_on).slice(-4);if(form.length<4)return null;
   const top10=form.filter(f=>f.status==='finished'&&f.position<=10).length,won=form.filter(f=>f.status==='finished'&&f.position===1&&!f.tied).length;
   if(top10<3&&!won)return null;
   const P=new Packet({type:'player_form',topic:`form:${lead.slug}:${ed.slug}`,as_of:ctx.as_of,source:sourceOf(ed),capture:ed.provenance?.id});editionFacts(P,ed);
   P.fact('player',pl.name,null,'Player');P.entity('p1','player',pl.slug,pl.name);
   P.fact('recent_starts',form.length,String(form.length),'Recent starts considered',{unit:'events'});P.fact('recent_top10',top10,String(top10),'Top-ten finishes in those starts',{unit:'events'});if(won)P.fact('recent_wins',won,String(won),'Wins in those starts',{unit:'events'});
   P.fact('recent_results',form.map(f=>`${f.status==='finished'?(f.tied?'T':'')+f.position:f.status==='cut'?'missed cut':f.status} at the ${f.name.replace(/^\d{4}\s+/,'')}`),list(form.slice().reverse().map(f=>`${f.status==='finished'?(f.tied?'tied ':'')+ORD(f.position):f.status==='cut'?'missed cut':f.status} at the ${f.name.replace(/^\d{4}\s+/,'')}`)),'Most recent results, latest first');
   P.fact('form_pct',lead.form.percentile,ORD(lead.form.percentile)+' percentile','Recent form, Player DNA percentile');
   P.chart('player_form',formChartSpec(pl));P.chart('player_dna',playerDnaChart(pl));
   P.material(won?4:3,'sustained form entering the week');
   P.limit('Form covers events in our record only. It describes recent results, not this week’s outcome.');
   return P;}},
 // ---------------------------------------------------------------- COURSE INTELLIGENCE
 course_intelligence:{label:'Course intelligence',category:'COURSE INTELLIGENCE',
  detect(ctx){return ctx.window.filter(e=>e.course?.slug&&e.starts_on&&daysBetween(ctx.today,e.starts_on)>=0&&daysBetween(ctx.today,e.starts_on)<=6).map(e=>({type:'course_intelligence',topic:null,edition:e.slug}));},
  async build(ctx,c){const ed=await ctx.ed(c.edition);const co=ed?.course?.slug?await ctx.co(ed.course.slug):null;const dna=co?.dna;if(!dna||!['HIGH','MEDIUM','LIMITED'].includes(dna.confidence)||dna.full_field_editions<2)return null;
   const P=new Packet({type:'course_intelligence',topic:`course:${co.slug}:${ed.slug}`,as_of:ctx.as_of,source:'Golf Course DNA (our record)',capture:ed.provenance?.id});editionFacts(P,ed);
   P.fact('dna_editions',dna.full_field_editions,String(dna.full_field_editions),'Full-field editions measured',{unit:'editions'});
   const dim=k=>dna.dimensions?.find(d=>d.code===k);const diff=dim('difficulty'),spread=dim('spread');
   if(diff?.value!==null&&diff?.value!==undefined)P.fact('difficulty',diff.value,(diff.value>0?'+':'')+diff.value.toFixed(2),'Field average strokes to par per round',{unit:'strokes'});
   if(diff?.percentile!==null&&diff?.percentile!==undefined)P.fact('difficulty_pct',diff.percentile,ORD(diff.percentile)+' percentile','Difficulty among measured courses');
   if(spread?.value)P.fact('spread',spread.value,spread.value.toFixed(2),'Round-score spread (standard deviation)',{unit:'strokes'});
   P.chart('course_dna',{type:'course_dna',title:`${co.name} Course DNA`,course:{name:co.name,slug:co.slug},dimensions:(dna.dimensions||[]).filter(d=>d.value!==null).map(d=>({code:d.code,label:d.label,value:d.value,unit:d.unit,percentile:d.percentile,confidence:d.confidence}))});
   P.material(3,'measured course DNA');
   P.limit('Course DNA is measured from full-field editions in our record; setups can change year to year.');
   return P;}},
 // ---------------------------------------------------------------- LIVE SIGNALS (from ESPN snapshots)
 play_suspended:{label:'Play suspended',category:'LIVE',
  detect(ctx){return ctx.window.filter(e=>e.status!=='completed').map(e=>({type:'play_suspended',topic:null,edition:e.slug}));},
  async build(ctx,c){const snap=ctx.live?await ctx.live(c.edition):null;if(!snap)return null;const st=liveState(snap,ctx.now?Date.parse(ctx.now):Date.now());if(st.state!=='suspended')return null;
   const ed=await ctx.ed(c.edition);if(!ed)return null;
   const P=new Packet({type:'play_suspended',topic:`suspended:${ed.slug}:${st.round}`,as_of:ctx.as_of,source:'ESPN (live scoring snapshot)',capture:snap.capture_id||null});editionFacts(P,ed);
   P.fact('round_word',roundWord(st.round),null,'Round');
   const lead=snap.players.filter(p=>p.status==='active'&&p.position_num===1);if(lead.length){P.fact('leaders',lead.map(p=>p.name),list(lead.map(p=>p.name)),'Leading at the suspension');P.fact('lead_score',lead[0].total_to_par,toParText(lead[0].total_to_par),'Leading score');lead.slice(0,3).forEach((p,i)=>p.slug&&P.entity('p'+(i+1),'player',p.slug,p.name));}
   P.fact('snapshot_time',snap.fetched_at,new Date(snap.fetched_at).toUTCString().replace(' GMT',' UTC'),'Scoring snapshot');
   P.material(3,'play suspended');P.limit('The suspension reason is not part of the scoring feed; we do not speculate about it.');
   return P;}},
 playoff:{label:'Playoff',category:'LIVE',
  detect(ctx){return [...ctx.window,...ctx.recent].filter(e=>e.ends_on&&daysBetween(e.ends_on,ctx.today)<=1&&daysBetween(e.ends_on,ctx.today)>=0).map(e=>({type:'playoff',topic:'playoff:'+e.slug,edition:e.slug}));},
  async build(ctx,c){const snap=ctx.live?await ctx.live(c.edition):null;const pp=(snap?.players||[]).filter(p=>p.playoff===true);if(pp.length<2)return null;const ed=await ctx.ed(c.edition);if(!ed)return null;
   const P=new Packet({type:'playoff',topic:c.topic,as_of:ctx.as_of,source:'ESPN (live scoring snapshot)',capture:snap.capture_id||null});editionFacts(P,ed);
   P.fact('playoff_players',pp.map(p=>p.name),list(pp.map(p=>p.name)),'Players in the playoff');P.fact('playoff_count',pp.length,String(pp.length),'Players in the playoff',{unit:'players'});
   if(pp[0].total_to_par!==null)P.fact('playoff_score',pp[0].total_to_par,toParWords(pp[0].total_to_par),'Score after regulation');
   pp.slice(0,4).forEach((p,i)=>p.slug&&P.entity('p'+(i+1),'player',p.slug,p.name));
   P.material(4,'playoff');P.limit('Playoff hole results appear when ESPN posts them; the final story records the winner.');
   return P;}},
 // ---------------------------------------------------------------- VERIFIED-ONLY TYPES (sources on hold)
 equipment_change:{label:'Equipment change',category:'EQUIPMENT',verified_only:true,detect(){return [];},async build(){return null;}},
 caddie_change:{label:'Caddie change',category:'CADDIE',verified_only:true,detect(){return [];},async build(){return null;}},
 golf_ball:{label:'Golf ball',category:'EQUIPMENT',verified_only:true,detect(){return [];},async build(){return null;}},
};
// Evergreen features are reviewed by a person before publication; the desk only prepares them.
export const REVIEW_ONLY=new Set(['evergreen']);
