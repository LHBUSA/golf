import fs from 'node:fs/promises';import {safeFetch,digest} from '../workers/shared/http.js';
const ids=process.argv.slice(2);const url='https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&languages=en&ids='+ids.join('|');
const r=await safeFetch(url,{allowedHosts:['www.wikidata.org'],maxBytes:3000000});const hash=await digest(r.bytes);
await fs.mkdir('.raw/entities',{recursive:true});await fs.writeFile('.raw/entities/'+hash+'.json',r.bytes,{flag:'wx'}).catch(e=>{if(e.code!=='EEXIST')throw e});
for(const e of Object.values(JSON.parse(r.text).entities))console.log(JSON.stringify({id:e.id,label:e.labels?.en?.value,description:e.descriptions?.en?.value,claims:Object.fromEntries(Object.entries(e.claims||{}).filter(([p])=>['P31','P641','P569','P27','P580','P582','P585','P1346','P276','P17','P131','P361','P3450','P179','P856'].includes(p)).map(([p,v])=>[p,v.map(c=>({value:c.mainsnak.datavalue?.value,rank:c.rank,references:c.references,qualifiers:c.qualifiers}))]))}));
