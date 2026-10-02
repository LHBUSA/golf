// Publication gates. A draft passes only when every value resolves to a packet fact, every link to a packet
// entity, and the prose carries no number, URL or claim of its own.
export const QUALITY_VERSION='golf-gates/4.0.0';
const TOKEN=/\{(f|e):([a-z0-9_]+)\}/g;
const BANNED=[[/\b(odds|betting|bet|wager|parlay|lock|guarantee[ds]?|sure thing|can'?t miss|value play)\b/i,'betting_language'],[/\b(favou?rite|underdog|will win|is going to win|predict(ed|ion)?|expected to win)\b/i,'prediction_language'],[/\b(injur(y|ed|ies)|hurt|illness|sick|surgery)\b/i,'injury_claim'],[/\b(motivated|revenge|wants to|hungry for|feels|believes|said|told|according to)\b/i,'unsupported_attribution'],[/["“”]/,'quotation'],[/\bhttps?:\/\/|www\.|\.com\b/i,'url_in_prose'],[/\b(firm|firmness|soft greens|fast greens|green speed|stimp)\b/i,'unsupported_conditions'],[/\b(caddie|caddy|looper|driver model|putter model|ball model|sponsor(ed|ship)?|endorse)/i,'unsupported_equipment_or_caddie'],[/\b(historic|unprecedented|record-breaking|greatest|best ever|all-time|stunning|incredible|legendary|shocking|sensational|remarkable|astonishing|epic|magical)\b/i,'unsupported_superlative'],[/\b(because|caused|thanks to|won it with|the reason|due to)\b/i,'unsupported_causation'],[/\b(fans|crowds?|galler(y|ies)|roars?|atmosphere|electric)\b/i,'invented_atmosphere']];
export const KNOWN_NAMES=['National Weather Service','NOAA National Weather Service','MET Norway','ESPN','PropBetEdge','PropBetEdge Golf','Golf Desk','Player DNA','Course DNA','Bag DNA','Course Fit','PBEcast','PGA TOUR','LPGA Tour','DP World Tour','Korn Ferry Tour','LIV Golf','All Access'];
export const FIELDS=['headline','dek','seo_title','seo_description','social_headline'];
export function tokensIn(text){return [...String(text||'').matchAll(TOKEN)].map(m=>({kind:m[1],id:m[2]}));}
// Renders a token string to segments: plain text, fact values and entity links (hrefs come from resolve()).
export function segments(text,packet,resolve,{links=true}={}){
 const facts=new Map(packet.facts.map(f=>[f.id,f])),ents=new Map(packet.entities.map(x=>[x.key,x]));const out=[];let last=0;
 for(const m of String(text||'').matchAll(TOKEN)){if(m.index>last)out.push({t:'text',v:text.slice(last,m.index)});
  if(m[1]==='f'){const f=facts.get(m[2]);out.push({t:'fact',v:f?f.display:'',fact:m[2]});}
  else{const x=ents.get(m[2]);const href=links&&x?resolve(x):null;out.push(href?{t:'link',v:x.name,href,entity:x.key,entity_type:x.type}:{t:'text',v:x?.name||''});}
  last=m.index+m[0].length;}
 if(last<String(text||'').length)out.push({t:'text',v:text.slice(last)});
 return out;
}
export const plain=segs=>segs.map(s=>s.v).join('').replace(/\s+/g,' ').trim();
export function validateDraft(packet,draft,{resolve=()=>'/'}={}){
 const reasons=[],facts=new Set(packet.facts.map(f=>f.id)),ents=new Set(packet.entities.map(x=>x.key));
 if(!draft)return {ok:false,reasons:['no_draft']};
 const prose=[...FIELDS.map(k=>draft[k]||''),...(draft.sections||[]).flatMap(s=>[s.heading||'',...(s.paragraphs||[])]),...(draft.known_limits||[])];
 if(!draft.headline||!draft.dek)reasons.push('missing_headline_or_dek');
 if(!(draft.sections||[]).length)reasons.push('no_sections');
 for(const s of draft.sections||[])if(!(s.paragraphs||[]).length)reasons.push('empty_section');
 const used=new Set();
 // Every proper name a reader sees must come from the packet (entities, fact displays) or the desk's own vocabulary.
 const known=new Set([...packet.entities.map(x=>x.name),...packet.facts.flatMap(f=>[f.display,...(Array.isArray(f.value)?f.value.map(String):typeof f.value==='string'?[f.value]:[])]),...KNOWN_NAMES].filter(Boolean).map(x=>String(x).toLowerCase()));
 for(const text of prose){
  for(const t of tokensIn(text)){if(t.kind==='f'){if(!facts.has(t.id))reasons.push('unknown_fact:'+t.id);else used.add(t.id);}else if(!ents.has(t.id))reasons.push('unknown_entity:'+t.id);}
  const bare=String(text).replace(TOKEN,'');
  // Numbers belong to the packet. Prose may not state any digit of its own.
  if(/\d/.test(bare))reasons.push(`unsupported_number: "${bare.match(/[^.]*\d[^.]*/)?.[0]?.trim().slice(0,80)}"`);
  // Spelled-out counts and placings are numbers too ("finished third", "five birdies").
  // Golf idiom, not a count.
  const counted=bare.replace(/\b(front|back) nine\b/gi,'');
  const nw=counted.match(/\b(two|three|four|five|six|seven|eight|nine|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|hundred|dozen)\b/i)||counted.match(/(?<!top-)\bten\b/i);if(nw)reasons.push('number_word: "'+nw[0]+'"');
  const ow=bare.match(/\b(second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\b(?! round)/i);if(ow)reasons.push('ordinal_word: "'+ow[0]+'"');
  for(const [re,why] of BANNED)if(re.test(bare))reasons.push(why+': "'+(bare.match(re)?.[0]||'')+'"');
  // Names the packet does not contain (players, courses, events typed as plain text) are unsupported claims.
  for(const m of bare.matchAll(/(?:^|[^.!?]\s)((?:[A-Z][A-Za-zà-ÿ'’-]+|[A-Z]\.)(?:\s+(?:[A-Z][A-Za-zà-ÿ'’-]+|[A-Z]\.|of|de|van|der|la|du)){1,4})/g)){const n=m[1].trim().replace(/\s+(of|de|van|der|la|du)$/,'').replace(/^(The|A|An)\s+/,'');if(n.split(/\s+/).length>=2&&!known.has(n.toLowerCase())&&![...known].some(k=>k.includes(n.toLowerCase())))reasons.push('unsupported_name: "'+n+'"');}
 }
 // Pronouns follow the tour division in the packet; with no division, the story names people instead.
 const pr=packet.context?.pronoun,allowed=pr?.subj==='she'?/^(she|her|hers|herself)$/i:pr?.subj==='he'?/^(he|him|his|himself)$/i:null;
 for(const text of prose)for(const m of String(text).replace(TOKEN,'').matchAll(/\b(he|him|his|himself|she|her|hers|herself)\b/gi))if(!allowed||!allowed.test(m[1])){reasons.push('pronoun_not_supported: "'+m[1]+'"');break;}
 // A module placement must name a chart the packet has (or the PBEcast replay for an edition story).
 for(const s of draft.sections||[])if(s.module&&s.module!=='none'&&!(packet.charts.includes(s.module)||s.module==='pbecast'&&packet.context?.edition))reasons.push('unknown_module:'+s.module);
 // Heading text is plain (no tokens needed) but still gated above.
 if(used.size<3)reasons.push('too_few_facts');
 for(const k of draft.link_intents||[])if(!ents.has(k))reasons.push('unknown_link_intent:'+k);
 for(const c of draft.chart_intents||[])if(!packet.charts.includes(c))reasons.push('unknown_chart:'+c);
 const r=k=>plain(segments(draft[k]||'',packet,resolve,{links:false}));
 const hl=r('headline'),dk=r('dek');
 if(hl.length<20||hl.length>120)reasons.push('headline_length:'+hl.length);
 if(dk.length<40||dk.length>300)reasons.push('dek_length:'+dk.length);
 const subjects=[packet.entities.find(x=>x.key==='p1')?.name,packet.facts.find(f=>f.id==='event')?.display,packet.facts.find(f=>f.id==='course')?.display].filter(Boolean);
 if(subjects.length&&!subjects.some(n=>hl.includes(n)))reasons.push('headline_missing_subject');
 const words=(draft.sections||[]).flatMap(s=>s.paragraphs).map(p=>plain(segments(p,packet,resolve,{links:false}))).join(' ').split(/\s+/).filter(Boolean).length;
 const minWords={play_suspended:15,playoff:15}[packet.type]??35;if(words<minWords)reasons.push('too_short:'+words);if(words>1400)reasons.push('too_long:'+words);
 return {ok:!reasons.length,reasons:[...new Set(reasons)],facts_used:[...used],words};
}
// Entity hrefs are owned by the application.
export function resolveHref(x){
 const enc=s=>String(s).split('/').map(encodeURIComponent).join('/');
 return {player:'/player/'+enc(x.ref),course:'/course/'+enc(x.ref),tournament:'/tournament/'+enc(x.ref),majors:'/majors/'+enc(x.ref),matchup:'/matchups/'+enc(x.ref),pbecast:'/pbecast?e='+encodeURIComponent(x.ref),news:'/news/'+enc(x.ref)}[x.type]||null;
}
