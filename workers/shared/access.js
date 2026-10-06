export const ALL_ACCESS_URL='https://propbetedge.ai/pro';
export function sessionCookie(request){
 const entries=(request.headers.get('cookie')||'').split(';').map(v=>v.trim()).filter(v=>v.startsWith('pbe_session='));
 if(entries.length!==1)return null;
 const value=entries[0].slice('pbe_session='.length);
 return /^[A-Za-z0-9_.-]{20,4096}$/.test(value)?value:null;
}
const free=reason=>({granted:false,reason,membership:{contract:'1.4.0',sport:'golf',state:'free',entitled:false,access_source:null,network_url:ALL_ACCESS_URL}});
export async function golfAccess(request,env){
 const token=sessionCookie(request);if(!token)return free('no_session');
 if(!env.AUTH?.fetch)return free('auth_unavailable');
 try{
  const response=await env.AUTH.fetch('https://auth.propbetedge.ai/membership?sport=golf',{headers:{cookie:'pbe_session='+token,accept:'application/json'},signal:AbortSignal.timeout(2500)});
  if(response.status!==200)return free('auth_unavailable');
  const body=await response.json(),m=body?.membership;
  if(!m||m.sport!=='golf'||m.entitled!==true||!['all_access','owner'].includes(m.state)||m.access_source!==(m.state==='owner'?'owner':'all_access'))return free('no_network_entitlement');
  return {granted:true,reason:'network',membership:{contract:'1.4.0',sport:'golf',state:m.state,entitled:true,access_source:m.access_source,network_url:ALL_ACCESS_URL}};
 }catch{return free('auth_unavailable');}
}

