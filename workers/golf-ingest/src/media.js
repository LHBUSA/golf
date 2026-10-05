// Commons media lane. Identity proof is either the exact entity's Wikidata P18 or an explicitly reviewed
// course-photo record whose Commons description/location proves the photographed venue. Never matched by name.
import {capture} from './capture.js';
import {SourceBlockedError} from '../../shared/http.js';
import {stableId} from '../../shared/store.js';
export const MEDIA_REVIEW='commons-review/1';
export const CURATED_COURSE_MEDIA=[
 {slug:'black-desert-resort-golf-course-ec11307',file:'Firefly autonomous lawn mowers at a golf course.jpg',identity_proof:{basis:'Commons file description identifies this as the Black Desert Championship golf course in Ivins, Utah; embedded coordinates fall inside the reviewed Black Desert Resort course geometry.',evidence_url:'https://commons.wikimedia.org/wiki/File:Firefly_autonomous_lawn_mowers_at_a_golf_course.jpg',reviewed_at:'2026-10-05',course_slug:'black-desert-resort-golf-course-ec11307',coordinates:{lat:37.157819,lon:-113.651169},venue_match:'exact'}}
];
const strip=s=>String(s||'').replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#0?39;/g,"'").replace(/\s+/g,' ').trim();
// Owner-approved 2026-10-01: CC0/public domain, CC BY and CC BY-SA (any version), shown with attribution.
export function licenceVerdict(meta){
 const name=strip(meta?.LicenseShortName?.value),url=strip(meta?.LicenseUrl?.value),restr=strip(meta?.Restrictions?.value).toLowerCase();
 if(!name)return {approved:false,reason:'licence_missing'};
 if(/\bNC\b|\bND\b|non-?commercial|no ?deriv|fair use|all rights reserved/i.test(name))return {approved:false,reason:'licence_not_permitted:'+name};
 if(/^(CC0|Public domain|PD\b|PD-)/i.test(name))return {approved:true,licence:name,licence_url:url||'https://creativecommons.org/publicdomain/zero/1.0/',restrictions:restr||null};
 if(/^CC BY(-SA)? \d(\.\d)?/i.test(name))return {approved:true,licence:name,licence_url:url,restrictions:restr||null};
 return {approved:false,reason:'licence_not_in_allowlist:'+name};
}
const commonsApi=params=>'https://commons.wikimedia.org/w/api.php?'+new URLSearchParams({format:'json',formatversion:'2',...params});
export async function fileInfo(env,db,files){
 const out=new Map();
 for(let i=0;i<files.length;i+=40){
  const chunk=files.slice(i,i+40),c=await capture(env,db,'commons',commonsApi({action:'query',prop:'imageinfo',iiprop:'url|size|sha1|mime|extmetadata',iiurlwidth:'1280',iiextmetadatafilter:'LicenseShortName|LicenseUrl|Artist|Credit|AttributionRequired|Restrictions|ObjectName',titles:chunk.map(f=>'File:'+f).join('|')}),{parser:MEDIA_REVIEW});
  const b=JSON.parse(c.text).query||{},alias=new Map((b.normalized||[]).map(n=>[n.from,n.to]));
  const pages=new Map((b.pages||[]).map(p=>[p.title,p]));
  for(const f of chunk){const t='File:'+f,p=pages.get(alias.get(t)||t);if(p?.imageinfo?.[0])out.set(f,{...p.imageinfo[0],title:p.title,capture_id:c.id});}
 }
 return out;
}
// subjects: [{kind:'player'|'course', entity_id, qid, file}]
export async function runMedia(env,db,subjects,{limit=40,budgetMs=200000}={}){
 const started=Date.now(),existing=new Set();for(let o=0;;o+=1000){const pg=await db('golf_entity_media',`select=identity_proof->>file&order=id&limit=1000&offset=${o}`);pg.forEach(r=>existing.add(r.file));if(pg.length<1000)break;}
 // Files that can never pass (unsupported type, missing metadata) are remembered, not retried every run.
 let skip={};try{skip=JSON.parse(await env.STATE?.get('media:skip')||'{}');}catch{}
 const todo=subjects.filter(s=>s.file&&!existing.has(s.file)&&!skip[s.file]).slice(0,limit);
 const info=await fileInfo(env,db,todo.map(s=>s.file)),rows=[],out={lane:'media',candidates:todo.length,approved:0,held:0};
 for(const s of todo){
  if(Date.now()-started>budgetMs)break;
  const ii=info.get(s.file);if(!ii){out.held++;continue;}
  const verdict=licenceVerdict(ii.extmetadata);
  if(!/^image\/(jpeg|png|webp)$/.test(ii.mime||'')){out.unsupported_type=(out.unsupported_type||0)+1;skip[s.file]='unsupported_type:'+ii.mime;continue;}
  const thumb=ii.thumburl||ii.url;let cap;
  try{cap=await capture(env,db,'commons',thumb,{parser:MEDIA_REVIEW,binary:true,maxBytes:6000000,accept:'image/webp,image/jpeg,image/png,image/*'});}
  catch(err){if(err instanceof SourceBlockedError)throw err;out.errors=(out.errors||0)+1;(out.error_samples||=[]).length<5&&out.error_samples.push(s.file+': '+err.message);continue;}
  const author=strip(ii.extmetadata?.Artist?.value)||'Unknown author (as stated on Commons)';
  const row={capture_id:cap.id,player_id:s.kind==='player'?s.entity_id:null,course_id:s.kind==='course'?s.entity_id:null,tournament_id:null,editorial_only:false,source_url:ii.descriptionurl||ii.descriptionshorturl||'https://commons.wikimedia.org/wiki/'+encodeURIComponent(ii.title),author:author.slice(0,300),licence:verdict.licence||strip(ii.extmetadata?.LicenseShortName?.value)||'unknown',licence_url:verdict.licence_url||'https://commons.wikimedia.org/wiki/'+encodeURIComponent(ii.title),attribution:`${author.slice(0,200)} / ${verdict.licence||'licence under review'} / Wikimedia Commons`,identity_proof:s.identity_proof?{...s.identity_proof,file:s.file,commons_title:ii.title,commons_sha1:ii.sha1,original_width:ii.width,original_height:ii.height,thumb_url:thumb,restrictions:verdict.restrictions||null,reason:verdict.approved?null:verdict.reason}:{basis:'File is the P18 image statement of the Wikidata item that is this entity\'s canonical crosswalk',wikidata_id:s.qid,file:s.file,commons_title:ii.title,commons_sha1:ii.sha1,original_width:ii.width,original_height:ii.height,thumb_url:thumb,restrictions:verdict.restrictions||null,reason:verdict.approved?null:verdict.reason},archive_key:cap.key,sha256:cap.hash,width:ii.thumbwidth||ii.width,height:ii.thumbheight||ii.height,rights_status:verdict.approved?'approved':'hold',review_version:MEDIA_REVIEW};
  rows.push({table:'golf_entity_media',row:{id:await stableId('golf_entity_media:'+s.kind+':'+s.qid+':'+ii.sha1),...row}});
  verdict.approved?out.approved++:out.held++;
 }
 if(env.STATE)await env.STATE.put('media:skip',JSON.stringify(skip));
 return {rows,out};
}
