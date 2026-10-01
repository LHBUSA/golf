import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const base=process.argv[2]||'https://golf-api.propbetedge.ai';
const fetchJson=async(path,headers={})=>{const r=await fetch(base+path,{headers,signal:AbortSignal.timeout(15000)});return {status:r.status,cache:r.headers.get('cache-control'),body:await r.json()};};
const report={at:new Date().toISOString(),base,checks:[]};const health=await fetchJson('/health');assert.equal(health.body.graph_connected,true);assert.equal(health.body.project,'tkmlnhmylqnttmnsnief');report.health=health.body;
for(const lane of ['players','courses','tournaments']){const r=await fetchJson('/v1/'+lane);assert.equal(r.status,200);assert(r.body.data.length);assert(r.body.data.every(x=>x.provenance?.sha256));report.checks.push({lane,count:r.body.data.length,availability:r.body.availability,as_of:r.body.as_of});
 const singular={players:'player',courses:'course',tournaments:'tournament'}[lane];for(const entity of r.body.data){const d=await fetchJson('/v1/'+singular+'/'+entity.id);assert.equal(d.status,200);assert.equal(d.body.data.id,entity.id);}}
for(const lane of ['today','live','rankings','news']){const r=await fetchJson('/v1/'+lane);assert.equal(r.status,200);assert(r.body.coverage&&r.body.availability);report.checks.push({lane,availability:r.body.availability});}
for(const cookie of ['', 'pbe_session='+ 'x'.repeat(48)]){
 const membership=await fetchJson('/v1/membership',cookie?{cookie}:{});assert.equal(membership.body.membership.entitled,false);
 for(const lane of ['player-dna/test','course-dna/test','course-fit','pbecast/test','history/test']){const r=await fetchJson('/v1/intelligence/'+lane,cookie?{cookie}:{});assert.equal(r.status,403);assert(!('data' in r.body));assert.equal(r.cache,'no-store');}
}
report.auth={signed_out:'free',invalid_session:'denied',premium_values_leaked:false,valid_and_revoked_subscriber:'authority unit/integration tests; real account session not available'};
const home=await fetch('https://propbetedge.ai',{signal:AbortSignal.timeout(15000)});const html=await home.text();report.network_home={status:home.status,golf_link:html.includes('golf.propbetedge.ai')};
await fs.writeFile('docs/evidence/api-proof.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
