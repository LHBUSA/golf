// Coverage report from the published projection (what visitors actually see).
import fs from 'node:fs/promises';
const API='https://golf-api.propbetedge.ai';
const get=async p=>{const r=await fetch(API+p,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(p+' '+r.status);return r.json();};
const ix=await get('/v1/projection/index.json'),manifest=await get('/v1/projection/manifest.json');
const keys=Object.keys(manifest.docs).filter(k=>k.startsWith('players/')||k.startsWith('courses/'));
const docs={players:[],courses:[]};let i=0;await Promise.all(Array.from({length:24},async()=>{while(i<keys.length){const k=keys[i++];docs[k.split('/')[0]].push(await get('/v1/projection/'+k));}}));
const pct=(a,b)=>b?Math.round(1000*a/b)/10:null,photo=p=>Boolean(p.photo?.derivatives);
const recentCut=new Date(Date.parse(ix.as_of)-730*86400000).toISOString().slice(0,10);
const active=div=>ix.players.filter(p=>p.division===div&&p.last_event&&docs.players.find(d=>d.slug===p.slug)?.results?.[0]?.edition?.ends_on>=recentCut);
const top=div=>active(div).sort((a,b)=>(b.scoring?.percentile??-1)-(a.scoring?.percentile??-1)||b.events_observed-a.events_observed).slice(0,50);
const champs=ix.players.filter(p=>p.major_wins>0);
const prominent=new Map();for(const p of [...top('men').slice(0,20),...top('women').slice(0,20),...ix.recent.map(e=>e.winner).filter(Boolean),...(ix.featured_matchups||[]).flatMap(m=>[m.a,m.b])])prominent.set(p.slug,p);
const field=new Set();for(const e of ix.editions.filter(e=>e.year===2026&&e.coverage!=='winner_only'&&e.coverage!=='schedule_only'))for(const r of (await get('/v1/projection/editions/'+e.slug+'.json')).leaderboard)if(r.player)field.add(JSON.stringify({slug:r.player.slug,photo:Boolean(r.player.photo?.derivatives)}));
const fieldArr=[...field].map(x=>JSON.parse(x));
const tiers={};for(const d of docs.players){const c=d.dna?.l24m?.metrics?.scoring?.confidence;if(c)tiers[(d.dna.l24m.division)+':'+c]=(tiers[(d.dna.l24m.division)+':'+c]||0)+1;}
const majorVenues=new Set(ix.editions.filter(e=>e.is_major&&e.year>=2024&&e.course).map(e=>e.course.slug));
const fitPairs=docs.courses.reduce((n,c)=>n+c.player_history.length,0);
const out={as_of:ix.as_of,coverage:ix.coverage,
 player_media:{canonical_players:ix.coverage.players,players_listed:ix.players.length,approved_photos_displayed:ix.players.filter(photo).length,coverage_pct:pct(ix.players.filter(photo).length,ix.players.length),top50_men_pct:pct(top('men').filter(photo).length,top('men').length),top50_women_pct:pct(top('women').filter(photo).length,top('women').length),major_champions_pct:pct(champs.filter(photo).length,champs.length),major_champions:champs.length,field_2026_pct:pct(fieldArr.filter(x=>x.photo).length,fieldArr.length),field_2026_players:fieldArr.length,prominent_pct:pct([...prominent.values()].filter(photo).length,prominent.size),prominent:prominent.size},
 course_media:{courses:ix.courses.length,with_photo:ix.courses.filter(photo).length,pct:pct(ix.courses.filter(photo).length,ix.courses.length),recent_major_venues:majorVenues.size,recent_major_venues_with_photo:ix.courses.filter(c=>majorVenues.has(c.slug)&&photo(c)).length},
 player_stats:{with_results:docs.players.filter(d=>d.results.length).length,with_rounds:docs.players.filter(d=>d.results.some(r=>r.rounds.length)).length,with_season_rows:docs.players.filter(d=>d.seasons.length).length,seasons:[...new Set(docs.players.flatMap(d=>d.seasons.map(s=>s.season)))].sort().filter(y=>y>=2000).length,metrics:['events','wins','top10','cuts made','rounds','scoring vs field','avg to par per round','major wins/top10/best','course history']},
 dna:{eligible_men:ix.coverage.dna_eligible.men,eligible_women:ix.coverage.dna_eligible.women,tiers,dimensions_live:ix.dimensions.length,dimensions_held:ix.held_dimensions.length},
 course_dna:{eligible:docs.courses.filter(c=>c.dna?.full_field_editions>=2).length,with_any_full_field:docs.courses.filter(c=>c.dna?.full_field_editions>=1).length,layout_versions:docs.courses.reduce((n,c)=>n+(c.dna?.layout_versions?.length||0),0)},
 course_fit:{pairs:fitPairs,overall_score:'not published'},
 news:(await get('/v1/news')).data?.length??0};
await fs.writeFile('docs/evidence/phase2-coverage.json',JSON.stringify(out,null,1));console.log(JSON.stringify(out,null,1));
