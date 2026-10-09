// Golf Picks immutable ledger (golf-picks-ledger/1). PRIVATE R2 only (golf-source, prefix picks/v1/), never the
// public projection bucket. Locks and grade revisions are create-only; corrections are appended revisions.
import {gradeSelection,GRADE_VERSION,FAMILIES,FAMILY_LABEL} from './policy.js';
export const LEDGER_VERSION='golf-picks-ledger/1';
export const PREFIX='picks/v1/';
export const lockKey=slug=>`${PREFIX}locks/${slug}.json`;
export const gradeKey=(slug,rev)=>`${PREFIX}grades/${slug}/r${String(rev).padStart(3,'0')}.json`;
export const INDEX_KEY=PREFIX+'index.json';
// Canonical JSON (sorted keys) so the sha256 is reproducible from the stored document.
export function canonical(v){if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';if(v&&typeof v==='object')return '{'+Object.keys(v).filter(k=>v[k]!==undefined).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';return JSON.stringify(v===undefined?null:v);}
export async function sha256(text){const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join('');}
// Seal: sha256 over the canonical document without its own sha field.
export async function seal(doc){const {sha256:_,...body}=doc;return {...body,sha256:await sha256(canonical(body))};}
export async function verifySeal(doc){const {sha256:h,...body}=doc;return h===await sha256(canonical(body));}
// Create-only write: R2 conditional put with If-None-Match: * (returns null when the key exists). A HEAD first
// avoids the write attempt in the common case; the conditional put is what makes a concurrent duplicate lose.
export async function createOnly(bucket,key,doc){
 if(await bucket.head(key))return {created:false,reason:'exists'};
 const body=JSON.stringify(doc);
 const r=await bucket.put(key,body,{onlyIf:new Headers({'if-none-match':'*'}),httpMetadata:{contentType:'application/json',cacheControl:'private, no-store'},customMetadata:{sha256:doc.sha256||'',ledger:LEDGER_VERSION}});
 if(!r)return {created:false,reason:'exists'};
 // Read back: the stored object must be ours (defends against a backend that ignored the precondition).
 const back=await bucket.get(key);const stored=back?JSON.parse(await back.text()):null;
 return stored?.sha256===doc.sha256?{created:true,etag:r.etag}:{created:false,reason:'lost_race'};
}
export async function getJSON(bucket,key){const o=await bucket.get(key);return o?JSON.parse(await o.text()):null;}
export async function listKeys(bucket,prefix){const out=[];let cursor;do{const l=await bucket.list({prefix,cursor,limit:1000});out.push(...l.objects.map(o=>o.key));cursor=l.truncated?l.cursor:undefined;}while(cursor);return out.sort();}

// Grade revision from an official result. Returns null when nothing changed versus the previous revision.
export async function gradeRevision(lock,result,prev,{now=new Date(),source=null}={}){
 const grades=lock.forecast.selections.map((s,i)=>({i,family:s.family,slug:s.slug,opponent:s.opponent?.slug||null,...gradeSelection(s,result)}));
 const sig=canonical(grades.map(g=>[g.i,g.grade,g.actual??null]));
 if(prev&&prev.signature===sig)return null;
 return seal({schema:'golf-picks-grade/1',ledger:LEDGER_VERSION,grade_policy:GRADE_VERSION,edition:lock.edition.slug,lock_sha256:lock.sha256,revision:(prev?.revision||0)+1,supersedes:prev?.sha256||null,graded_at:now.toISOString(),
  result:{status:result.status,rounds_completed:result.rounds_completed,source},signature:sig,final:grades.every(g=>g.grade!=='PENDING'),grades});
}
// Member view of one tournament: lock + latest grades joined (no internal R2 keys).
export function joinLock(lock,grade){
 const by=new Map((grade?.grades||[]).map(g=>[g.i,g]));
 return {edition:lock.edition,locked_at:lock.locked_at,start_evidence:lock.start_evidence,freeze:lock.freeze,model:lock.model.version,policy:lock.policy,grade_policy:lock.grade_policy,lock_sha256:lock.sha256,
  field_size:lock.forecast.field_size,rated_share:lock.forecast.rated_share,cut:lock.forecast.cut,rounds:lock.forecast.rounds,sims:lock.forecast.sims,
  selections:lock.forecast.selections.map((s,i)=>{const g=by.get(i);return {...s,family_label:FAMILY_LABEL[s.family],grade:g?.grade||'PENDING',reason:g?.reason||'awaiting official result',actual:g?.actual||null};}),
  probabilities:lock.forecast.probabilities.slice(0,40),grade_revision:grade?.revision||null,graded_at:grade?.graded_at||null};
}
// Track record: every locked selection counted in its own family; VOIDs shown, never dropped; losses always shown.
export function trackRecord(items){
 const fam={},tour={},rows=[];
 for(const it of items)for(const s of it.selections){
  const tr=it.edition.division==='women'?'LPGA':'PGA';
  for(const [bag,k] of [[fam,s.family],[tour,tr+' · '+s.family]]){const o=bag[k]||(bag[k]={selections:0,WIN:0,LOSS:0,VOID:0,PENDING:0,expected_wins:0,brier_sum:0,graded:0});o.selections++;o[s.grade]++;if(s.grade==='WIN'||s.grade==='LOSS'){o.expected_wins+=s.p;o.brier_sum+=(s.p-(s.grade==='WIN'?1:0))**2;o.graded++;}}
  rows.push({edition:it.edition.slug,edition_name:it.edition.name,starts_on:it.edition.starts_on,tour:tr,locked_at:it.locked_at,model:it.model,family:s.family,family_label:s.family_label,proposition:s.proposition,slug:s.slug,name:s.name,opponent:s.opponent||null,p:s.p,grade:s.grade,reason:s.reason,actual:s.actual});
 }
 const fin=o=>({selections:o.selections,WIN:o.WIN,LOSS:o.LOSS,VOID:o.VOID,PENDING:o.PENDING,hit_rate:o.graded?Math.round(o.WIN/o.graded*1000)/1000:null,expected_wins:Math.round(o.expected_wins*10)/10,brier:o.graded?Math.round(o.brier_sum/o.graded*10000)/10000:null});
 return {families:FAMILIES.map(f=>({family:f,label:FAMILY_LABEL[f],...fin(fam[f]||{selections:0,WIN:0,LOSS:0,VOID:0,PENDING:0,expected_wins:0,brier_sum:0,graded:0})})),by_tour:Object.fromEntries(Object.entries(tour).map(([k,v])=>[k,fin(v)])),rows};
}
