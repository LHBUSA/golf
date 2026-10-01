// ESPN Golf coverage report: what the approved core API exposes per circuit (discovery evidence) and what
// we have stored. Writes docs/evidence/espn-coverage.json and docs/ESPN_COVERAGE.md.
import fs from 'node:fs/promises';
import {store} from '../workers/shared/store.js';import {sportsEnv} from './ops.mjs';
const env=await sportsEnv(),db=store(env);
const disc=JSON.parse(await fs.readFile('docs/evidence/espn-discovery.json','utf8'));
const LABEL={pga:'PGA TOUR',lpga:'LPGA',eur:'DP World Tour','champions-tour':'PGA TOUR Champions',ntw:'Korn Ferry Tour',liv:'LIV Golf','mens-olympics-golf':'Olympics (men)','womens-olympics-golf':'Olympics (women)',tgl:'TGL'};
const count=async(t,q)=>{const r=await fetch(`${env.SPORTS_URL}/rest/v1/${t}?select=id&limit=1${q?'&'+q:''}`,{headers:{apikey:env.SPORTS_KEY,authorization:'Bearer '+env.SPORTS_KEY,prefer:'count=exact'}});return Number((r.headers.get('content-range')||'/0').split('/')[1])||0;};
const all=async(t,q)=>{const out=[];for(let o=0;;o+=1000){const p=await db(t,`${q}&order=id&limit=1000&offset=${o}`);out.push(...p);if(p.length<1000)return out;}};
const eds=await all('golf_tournament_editions','select=id,league:rules->espn->>league,rp:rules->espn->>rounds_played,sup:rules->>superseded_by&rules->espn=not.is.null');
const ids=await all('golf_player_identities','select=id,league:evidence->>league,dob:evidence->>birth_date,college:evidence->>college,headshot:evidence->>headshot&source_id=eq.espn');
const seasons=await db('golf_seasons','select=id,label,tour_id');const tours=await db('golf_tours','select=id,slug,name');
const stat=x=>x>0?'AVAILABLE':'NOT STORED';
const report={generated_at:new Date().toISOString(),source:'sports.core.api.espn.com/v2/sports/golf (owner approved 2026-10-01)',site_api:disc.site_api,leagues:[]};
for(const [lg,v] of Object.entries(disc.leagues)){
 const ce=(v.probes||[]).find(p=>p.completed_event)?.completed_event||{},src=ce.sources||{},ls=ce.linescores||{};
 const mine=eds.filter(e=>e.league===lg&&!e.sup).map(e=>e.id);let results=0,cards=0,tee=0;
 for(let i=0;i<mine.length;i+=80){const q='edition_id=in.('+mine.slice(i,i+80).join(',')+')';results+=await count('golf_results',q);cards+=await count('golf_scorecards',q);tee+=await count('golf_tee_times',q);}
 const pl=ids.filter(x=>x.league===lg);
 const exposed={events:v.seasons?.status===200?'AVAILABLE':'UNKNOWN',competitors:ce.competitors?'AVAILABLE':lg==='tgl'?'NOT EXPOSED':'UNKNOWN',rounds:src.linescore==='full'||src.linescore==='basic'?'AVAILABLE':'NOT EXPOSED',holes:src.holeByHole==='full'?'AVAILABLE':src.holeByHole==='basic'?'PARTIAL':'NOT EXPOSED',tee_times:ls.tee_time?'AVAILABLE':'NOT EXPOSED',groups:ls.group?'AVAILABLE':'NOT EXPOSED',shots_plays:ce.flags?.shotChartAvailable||ce.flags?.playByPlayAvailable?'AVAILABLE':'NOT EXPOSED',season_stats:['pga','lpga'].includes(lg)?'AVAILABLE':'UNKNOWN',bio:'AVAILABLE',venues:ce.venue?'AVAILABLE':'UNKNOWN',venue_coordinates:'NOT EXPOSED',photos:'AVAILABLE (headshots; not rehosted for Golf)'};
 report.leagues.push({league:lg,circuit:LABEL[lg]||lg,earliest_season:v.seasons?.earliest??null,latest_season:v.seasons?.latest??null,seasons:v.seasons?.count??null,events_sampled:(v.probes||[]).map(p=>({year:p.year,events:p.events})),exposed,stored:{editions:mine.length,results,rounds:cards,tee_times:tee,players:pl.length,with_birth_date:pl.filter(x=>x.dob).length,with_college:pl.filter(x=>x.college).length}});
}
report.stored_totals={hole_scores:await count('golf_hole_scores',''),season_stat_rows:await count('golf_player_season_stats',''),seasons:seasons.map(s=>({label:s.label,tour:tours.find(t=>t.id===s.tour_id)?.name||null}))};
await fs.writeFile('docs/evidence/espn-coverage.json',JSON.stringify(report,null,1));
const md=[`# ESPN Golf coverage (${report.generated_at.slice(0,10)})`,'',`Source: ${report.source}. \`site.api.espn.com\`: ${report.site_api}.`,'',`Status key: AVAILABLE = exposed by ESPN core; PARTIAL = exposed for some events; NOT EXPOSED = absent from ESPN core; UNKNOWN = not probed. "Stored" is what we have ingested so far.`,'',
 '| Circuit | Seasons | Events | Rounds | Holes | Tee times | Groups | Shots/plays | Season stats | Stored editions | Stored rounds | Stored tee times | ESPN players (DOB / college) |','|---|---|---|---|---|---|---|---|---|---|---|---|---|',
 ...report.leagues.map(l=>`| ${l.circuit} | ${l.earliest_season}–${l.latest_season} | ${l.exposed.events} | ${l.exposed.rounds} | ${l.exposed.holes} | ${l.exposed.tee_times} | ${l.exposed.groups} | ${l.exposed.shots_plays} | ${l.exposed.season_stats} | ${l.stored.editions} | ${l.stored.rounds} | ${l.stored.tee_times} | ${l.stored.players} (${l.stored.with_birth_date} / ${l.stored.with_college}) |`),
 '',`Totals stored: ${report.stored_totals.hole_scores} hole scores; ${report.stored_totals.season_stat_rows} season-stat rows. Venue coordinates are not exposed by ESPN (see the venue-coordinate registry). Shot/play objects exist but are empty for every circuit probed.`].join('\n');
await fs.writeFile('docs/ESPN_COVERAGE.md',md+'\n');
console.log(md);
