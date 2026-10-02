// ESPN season statistics -> golf_player_season_stats as dated snapshots (effective_on = capture date).
// Values are ESPN's published season figures for that tour/season population; ranks are ESPN's ranks.
import {stableId} from '../../shared/store.js';
import {SourceBlockedError} from '../../shared/http.js';
import {CORE,getJSON,pool,archive,LEAGUES} from './espn.js';
import {writePlan} from './writer.js';
import {Plan} from './plan.js';
import {cleanStat} from '../../shared/season-stats.js';
export const STAT_VERSION='espn-golf-season/1';
// code -> [name, unit, direction, definition]
export const STATS={
 scoringAverage:['Scoring average','strokes per round','lower','Season scoring average as published by ESPN for the tour.'],
 yardsPerDrive:['Driving distance','yards per measured drive','higher','Average yards per measured drive.'],
 driveAccuracyPct:['Driving accuracy','% of fairways hit','higher','Fairways hit as a share of possible fairways.'],
 greensInRegPct:['Greens in regulation','% of holes','higher','Greens hit in regulation as a share of holes played.'],
 puttsGirAvg:['Putts per GIR','putts per green hit in regulation','lower','Average putts on holes where the green was hit in regulation.'],
 savePct:['Sand saves','% of bunker situations saved','higher','Up-and-down from greenside bunkers as a share of opportunities.'],
 birdiesPerRound:['Birdies per round','birdies per round','higher','Birdies (or better) per round played.'],
 holesPerEagle:['Holes per eagle','holes per eagle','lower','Holes played per eagle made.'],
 roundsPlayed:['Rounds played','rounds','neutral','Rounds in the season statistics.'],
 tournamentsPlayed:['Events played','events','neutral','Tournaments in the season statistics.'],
 cutsMade:['Cuts made','events','neutral','Cuts made in the season.'],
 wins:['Wins','events','neutral','Wins in the season.'],
 topTenFinishes:['Top-10 finishes','events','neutral','Top-10 finishes in the season.'],
 officialAmount:['Official money','USD','neutral','Official earnings as published.'],
 cupPoints:['Season points','points','neutral','Season-long points race total as published.']
};
const num=v=>{if(v===null||v===undefined)return null;const n=Number(String(v).replace(/[$,%]/g,''));return Number.isFinite(n)?n:null;};
export function parseSeasonStats(body){
 const out={};
 for(const c of body?.splits?.categories||[])for(const st of c.stats||[]){if(!STATS[st.name])continue;
  // An explicit null value is missing even when displayValue says "0"; displayValue is used only when value is absent.
  // An unranked zero on a rate statistic is ESPN's "not measured" placeholder (LPGA), never a measurement.
  const rank=Number.isFinite(Number(st.rank))&&st.rank?Number(st.rank):null;
  const raw=st.value===undefined?num(st.displayValue):st.value===null?null:num(st.value);
  out[st.name]={value:cleanStat(st.name,raw,rank),rank,display:st.displayValue??null};}
 return out;
}
export async function runEspnStats(env,db,{league='pga',season=2026,limit=250,budgetMs=200000}={}){
 const started=Date.now(),cfg=LEAGUES[league];if(!cfg?.tour)return {lane:'espn-stats',status:'league_without_tour'};
 const curKey=`espn:stats:${league}:${season}`;let done={};try{done=JSON.parse(await env.STATE.get(curKey)||'{}');}catch{}
 const ids=[];for(let o=0;;o+=1000){const p=await db('golf_player_identities',`select=player_id,provider_id&source_id=eq.espn&evidence->>league=eq.${league}&order=provider_id&limit=1000&offset=${o}`);ids.push(...p);if(p.length<1000)break;}
 const todo=ids.filter(i=>!done[i.provider_id]).slice(0,limit);
 const out={lane:'espn-stats',league,season,candidates:ids.length,fetched:0,with_stats:0,inserted:0,updated:0,unchanged:0};
 if(!todo.length)return {...out,status:'complete'};
 const tourId=await stableId('golf_tours:'+(cfg.tour==='pga-tour'?'Q910409':'Q17162079'));
 const seasonId=await stableId('golf_seasons:'+cfg.tour+':'+season);
 const defs=Object.entries(STATS).map(([code,[name,unit,direction,definition]])=>({code,name,unit,direction,definition}));
 const defIds=new Map();for(const d of defs)defIds.set(d.code,await stableId('golf_stat_definitions:'+d.code+':'+STAT_VERSION));
 const rankIds=new Map();for(const d of defs)rankIds.set(d.code,await stableId('golf_stat_definitions:'+d.code+'_rank:'+STAT_VERSION));
 // Definitions carry no capture (they are our contract); upsert idempotently.
 await db('golf_stat_definitions','on_conflict=id',{method:'POST',headers:{prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify([...defs.map(d=>({id:defIds.get(d.code),code:d.code,version:STAT_VERSION,name:d.name,unit:d.unit,direction:d.direction,definition:d.definition+' Source: ESPN.'})),...defs.map(d=>({id:rankIds.get(d.code),code:d.code+'_rank',version:STAT_VERSION,name:d.name+' (tour rank)',unit:'rank',direction:'lower',definition:'ESPN tour rank for '+d.name.toLowerCase()+' in this season population.'}))])});
 const results=[];
 const batch=todo.filter(()=>Date.now()-started<budgetMs);
 const bodies=await pool(3,batch,async i=>{try{return await getJSON(`${CORE}/leagues/${league}/seasons/${season}/types/2/athletes/${i.provider_id}/statistics`);}catch(e){if(e instanceof SourceBlockedError)throw e;return {error:String(e.message)};}});
 const cap=await archive(env,db,`${CORE}/leagues/${league}/seasons/${season}/types/2/athletes/statistics#batch`,{league,season,athletes:batch.map((i,k)=>({id:i.provider_id,body:bodies[k]}))});
 const plan=new Plan(),today=new Date().toISOString().slice(0,10);
 // One row per player/stat/season; effective_on moves only when the value changes (ledger keeps history).
 const prior=new Map();const pids=[...new Set(batch.map(i=>i.player_id))];
 for(let k=0;k<pids.length;k+=100){for(const r of await db('golf_player_season_stats',`select=id,value,effective_on&season_id=eq.${seasonId}&player_id=in.(${pids.slice(k,k+100).join(',')})`))prior.set(r.id,r);}
 await plan.add('golf_seasons',cfg.tour+':'+season,cap.id,{tour_id:tourId,label:String(season),starts_on:null,ends_on:null});
 batch.forEach((i,k)=>{const b=bodies[k];out.fetched++;if(!b||b.error){if(!/404/.test(b?.error||''))return;done[i.provider_id]='none';return;}const st=parseSeasonStats(b);done[i.provider_id]=today;if(!Object.keys(st).length)return;out.with_stats++;
  const rounds=st.roundsPlayed?.value??null;
  for(const [code,v] of Object.entries(st)){if(v.value===null)continue;results.push({table:'golf_player_season_stats',key:i.player_id+':'+code,row:{capture_id:cap.id,player_id:i.player_id,season_id:seasonId,stat_id:defIds.get(code),effective_on:today,value:v.value,numerator:null,denominator:null,sample_size:Number.isInteger(rounds)?rounds:null,definition_version:STAT_VERSION}});
   if(v.rank)results.push({table:'golf_player_season_stats',key:i.player_id+':'+code+'_rank',row:{capture_id:cap.id,player_id:i.player_id,season_id:seasonId,stat_id:rankIds.get(code),effective_on:today,value:v.rank,numerator:null,denominator:null,sample_size:Number.isInteger(rounds)?rounds:null,definition_version:STAT_VERSION}});}
 });
 for(const r of results){const id=await stableId(r.table+':'+season+':'+r.key),old=prior.get(id);if(old&&Number(old.value)===Number(r.row.value))r.row.effective_on=old.effective_on;await plan.add(r.table,season+':'+r.key,r.row.capture_id,r.row);}
 const c=await writePlan(db,plan.rows);Object.assign(out,{inserted:c.inserted,updated:c.updated,unchanged:c.unchanged});
 await env.STATE.put(curKey,JSON.stringify(done));
 return out;
}
