// Frozen fact packets. The packet owns truth: every number a reader sees resolves to a fact here.
import {digest} from '../http.js';
export const PACKET_VERSION='golf-packet/4';
export const ORD=n=>{const s=['th','st','nd','rd'],v=n%100;return n+(s[(v-20)%10]||s[v]||s[0]);};
export const toParWords=v=>v===0?'even par':v<0?`${Math.abs(v)} under par`:`${v} over par`;
export const toParShort=v=>v===0?'E':v<0?'−'+Math.abs(v):'+'+v;
export const posWords=(p,tied)=>p===1&&!tied?'the lead':`${tied?'a share of ':''}${ORD(p)} place`;
export const list=a=>a.length<=1?a.join(''):a.length===2?a.join(' and '):a.slice(0,-1).join(', ')+' and '+a.at(-1);
export const dayName=iso=>new Date(iso+'T12:00:00Z').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',timeZone:'UTC'});
export const addDays=(iso,n)=>new Date(Date.parse(iso+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
const ROUND_WORD=['','first','second','third','fourth','fifth'];
export const roundWord=n=>ROUND_WORD[n]||ORD(n);

export class Packet{
 constructor({type,topic,as_of,source,capture}){this.type=type;this.topic=topic;this.as_of=as_of;this.source=source;this.capture=capture||null;this.facts=[];this.entities=[];this.charts={};this.context={};this.limits=[];this.materiality={score:0,reasons:[]};}
 // A fact is a value with provenance. Nulls never become facts (and never become zero).
 fact(id,value,display,label,{source=this.source,capture=this.capture,unit=null}={}){
  if(value===null||value===undefined||value===''||(typeof value==='number'&&!Number.isFinite(value)))return false;
  if(this.facts.some(f=>f.id===id))throw Error('duplicate_fact:'+id);
  this.facts.push({id,value,display:String(display??value),label,unit,source,capture_id:capture,class:'A'});return true;
 }
 // A derived fact: computed deterministically from other packet sources; the ledger names the derivation.
 derive(id,value,display,label,{from}={}){const ok=this.fact(id,value,display,label,{source:'Derived from '+(from||'packet data')});if(ok)this.facts.at(-1).class='D';return ok;}
 has(id){return this.facts.some(f=>f.id===id);}
 get(id){return this.facts.find(f=>f.id===id);}
 // Entities are what the writer may link to; hrefs are resolved by the application, never by the model.
 entity(key,type,ref,name){if(!ref||!name||this.entities.some(x=>x.key===key))return false;this.entities.push({key,type,ref,name});return true;}
 chart(id,spec){if(spec)this.charts[id]=spec;}
 material(points,reason){this.materiality.score+=points;this.materiality.reasons.push(reason);}
 limit(text){if(!this.limits.includes(text))this.limits.push(text);}
 async freeze(){
  const body={version:PACKET_VERSION,type:this.type,topic:this.topic,as_of:this.as_of,facts:this.facts,entities:this.entities,charts:Object.keys(this.charts).sort(),context:this.context,limits:this.limits,materiality:this.materiality};
  // The hash covers truth (facts/entities/charts), not the as_of clock, so unchanged facts never look new.
  const hash=await digest(new TextEncoder().encode(JSON.stringify({type:body.type,topic:body.topic,facts:body.facts.map(f=>[f.id,f.value]),entities:body.entities,charts:body.charts})));
  const frozen={...body,chart_data:this.charts,hash};
  const deep=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(deep);Object.freeze(v);}return v;};
  return deep(structuredClone(frozen));
 }
}
// Facts that changed between two packets of the same topic (drives update-vs-ignore).
export function changedFacts(prev,next){
 const p=new Map((prev?.facts||[]).map(f=>[f.id,JSON.stringify(f.value)])),out=[];
 for(const f of next.facts){if(p.get(f.id)!==JSON.stringify(f.value))out.push(f.id);}
 for(const id of p.keys())if(!next.facts.some(f=>f.id===id))out.push(id);
 return out;
}
