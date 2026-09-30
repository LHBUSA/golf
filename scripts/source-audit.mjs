import fs from 'node:fs/promises';
const registry=JSON.parse(await fs.readFile('data/source-registry/sources.json','utf8'));
const required=['id','owner','url_family','capabilities','history_depth','live_capability','automated_access','access_evidence','robots','licence','redistribution','commercial_use','attribution','refresh_cadence','identity_strategy','provenance','verdict'];
for(const source of registry.sources){for(const key of required)if(!source[key])throw new Error(source.id+': missing '+key);if(!['APPROVED','HOLD','REJECT','OWNER DECISION'].includes(source.verdict))throw new Error('invalid verdict');}
console.log(JSON.stringify({candidates:registry.sources.length,verdicts:Object.fromEntries(['APPROVED','HOLD','REJECT','OWNER DECISION'].map(v=>[v,registry.sources.filter(s=>s.verdict===v).length]))},null,2));

