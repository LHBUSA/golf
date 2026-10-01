import fs from 'node:fs/promises';
import {safeFetch,digest} from '../workers/shared/http.js';
const queries=process.argv.slice(2);
for(const q of queries){
 const url='https://www.wikidata.org/w/api.php?action=wbsearchentities&language=en&format=json&limit=3&search='+encodeURIComponent(q);
 const r=await safeFetch(url,{allowedHosts:['www.wikidata.org']});
 const hash=await digest(r.bytes);await fs.mkdir('.raw/discovery',{recursive:true});await fs.writeFile('.raw/discovery/'+hash+'.json',r.bytes,{flag:'wx'}).catch(e=>{if(e.code!=='EEXIST')throw e});
 console.log(JSON.stringify({query:q,url,sha256:hash,results:JSON.parse(r.text).search?.map(x=>({id:x.id,label:x.label,description:x.description}))}));
 await new Promise(r=>setTimeout(r,1000));
}
