export async function adminAllowed(request,env){
 const token=request.headers.get('authorization')?.replace(/^Bearer /,'');if(!token||!env.ADMIN_TOKEN)return false;
 const hash=async s=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
 const [a,b]=await Promise.all([hash(token),hash(env.ADMIN_TOKEN)]);let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];return diff===0;
}
