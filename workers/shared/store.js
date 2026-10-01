export const SPORTS_REF='tkmlnhmylqnttmnsnief';
export function store(env){
 if(env.SPORTS_URL!==`https://${SPORTS_REF}.supabase.co`||!env.SPORTS_KEY)return null;
 return async(table,query='',options={})=>{
  if(!/^(golf_[a-z_]+|rpc\/golf_[a-z_]+)$/.test(table))throw Error('golf_scope_required');
  const r=await fetch(`${env.SPORTS_URL}/rest/v1/${table}${query?'?'+query:''}`,{...options,headers:{apikey:env.SPORTS_KEY,authorization:'Bearer '+env.SPORTS_KEY,'content-type':'application/json',...options.headers},signal:AbortSignal.timeout(12000)});
  if(!r.ok){const t=(await r.text().catch(()=>'')).slice(0,240).replace(/[^ -~]/g,'');throw Error(`sports_http_${r.status}:${table}:${t}`);}if(r.status===204)return null;
  const reader=r.body?.getReader();if(!reader)return null;const chunks=[];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>8000000)throw Error('sports_response_bound');chunks.push(value);}}catch(e){await reader.cancel();throw e;}finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}const text=new TextDecoder().decode(bytes);return text?JSON.parse(text):null;
 };
}
export const upsert=(db,table,rows,conflict='id')=>db(table,'on_conflict='+conflict,{method:'POST',headers:{prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(rows)});
export async function stableId(key){const bytes=new TextEncoder().encode('propbetedge:golf:v1:'+key),hash=await crypto.subtle.digest('SHA-256',bytes);const h=[...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;}
