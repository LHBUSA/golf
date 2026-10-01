// Verifies ESPN headshot URLs once (HEAD, paced) so pages never render a broken player image.
// Results live in KV 'espn:headshots:v1' {url: {ok, checked_at}}; misses are re-checked after 30 days.
const KEY='espn:headshots:v1',RE=/^https:\/\/a\.espncdn\.com\/i\/headshots\/golf\/players\/full\/\d+\.png$/;
export async function verifiedHeadshots(env){try{return JSON.parse(await env.STATE.get(KEY)||'{}');}catch{return {};}}
export async function runHeadshots(env,db,{limit=250,now=new Date()}={}){
 const seen=await verifiedHeadshots(env),urls=[];
 for(let o=0;;o+=1000){const p=await db('golf_player_identities',`select=headshot:evidence->>headshot&source_id=eq.espn&evidence->>headshot=not.is.null&order=id&limit=1000&offset=${o}`);for(const r of p)if(RE.test(r.headshot||''))urls.push(r.headshot);if(p.length<1000)break;}
 const due=[...new Set(urls)].filter(u=>!seen[u]||(!seen[u].ok&&now-Date.parse(seen[u].checked_at)>30*86400000)).slice(0,limit);
 let ok=0,miss=0;
 for(const u of due){await new Promise(r=>setTimeout(r,120));try{const r=await fetch(u,{method:'HEAD',headers:{'user-agent':'PropBetEdgeGolfIngest/0.3 (+https://golf.propbetedge.ai)'}});seen[u]={ok:r.status===200&&/image\//.test(r.headers.get('content-type')||''),checked_at:now.toISOString()};seen[u].ok?ok++:miss++;}catch{}}
 await env.STATE.put(KEY,JSON.stringify(seen));
 return {lane:'headshots',candidates:new Set(urls).size,checked:due.length,ok,missing:miss,remaining:Math.max(0,[...new Set(urls)].filter(u=>!seen[u]).length),updated:ok};
}
