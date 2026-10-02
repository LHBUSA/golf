// Vercel's external-rewrite cache keys ignore Accept-Encoding. Without no-transform, Cloudflare compresses a response
// for whichever client fills that cache (zstd for Chromium) and Vercel replays those bytes to every client, so a
// gzip-only crawler got zstd feed.xml and sitemaps. no-transform keeps Cloudflare from compressing; Vercel caches one
// identity representation and negotiates gzip/br per client. (news-ssr.js HTML already sent it; this covers everything.)
export function noTransform(res){
 const cc=res.headers.get('cache-control')||'';
 if(/(^|[\s,])no-transform([\s,]|$)/i.test(cc))return res;
 const headers=new Headers(res.headers);headers.set('cache-control',cc?cc+', no-transform':'no-transform');
 return new Response(res.body,{status:res.status,statusText:res.statusText,headers});
}
