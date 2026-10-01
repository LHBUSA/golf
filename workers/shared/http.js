export class SourceBlockedError extends Error { constructor(reason){super(reason);this.name='SourceBlockedError';} }
export async function safeFetch(url,{fetcher=fetch,allowedHosts,maxBytes=1024*1024,binary=false}={}){
 const target=new URL(url);
 if(target.protocol!=='https:'||!allowedHosts?.includes(target.hostname)) throw new SourceBlockedError('unapproved_host');
 const response=await fetcher(target.href,{redirect:'manual',signal:AbortSignal.timeout(25000),headers:{'user-agent':'PropBetEdgeGolfAudit/0.1 (+https://github.com/LHBUSA/golf)','accept':'application/json,text/plain,text/html'}});
 if([401,403,407,429].includes(response.status)) throw new SourceBlockedError('access_barrier_'+response.status);
 if(response.status>=300&&response.status<400) throw new SourceBlockedError('redirect_requires_review');
 if(!response.ok) throw new Error('source_http_'+response.status);
 if(Number(response.headers.get('content-length'))>maxBytes){await response.body?.cancel();throw new Error('capture_too_large');}
 const reader=response.body?.getReader();if(!reader) throw new Error('empty_capture');
 let size=0;const chunks=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes)throw new Error('capture_too_large');chunks.push(value);}}catch(e){await reader.cancel();throw e;}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 const contentType=response.headers.get('content-type');
 if(binary){if(!/^image\//.test(contentType||''))throw new SourceBlockedError('unexpected_binary_type');return {status:response.status,bytes,text:null,contentType};}
 const text=new TextDecoder().decode(bytes);
 if(/cf-chl-|captcha|verify you are human|access denied|sign in to continue|login required/i.test(text.slice(0,4000))&&!/^application\/(sparql-results\+)?json/.test(contentType||''))throw new SourceBlockedError('challenge_or_login');
 return {status:response.status,bytes,text,contentType};
}
export async function digest(bytes){const hash=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(hash)].map(v=>v.toString(16).padStart(2,'0')).join('');}

