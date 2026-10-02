// Venue coordinate resolution with explicit confidence. Evidence order: the course itself (Wikidata golf venue
// or Wikipedia article about the course), then the containing resort/club, then a unique town. Tournament
// articles are never used: a tournament's coordinates describe one edition's venue, not every edition's.
import {fold} from '../../shared/names.js';
const GENERIC=new Set(['golf','club','course','country','cc','gc','the','and','resort','links','championship','g','c']);
const core=s=>fold(s).split(' ').filter(w=>!GENERIC.has(w)).join(' ');
// Title matches a course name when the distinctive words agree (e.g. "Yokohama Country Club" vs "Yokohama CC").
export function nameMatch(title,course){const a=core(title),b=core(course);return Boolean(a&&b&&(a===b||(a.split(' ').length>=2&&b.includes(a))||(b.split(' ').length>=2&&a.includes(b))));}
const TOURNAMENT=/\b(tournament|championship|classic|open|invitational|cup|event)\b/i;
const GOLFISH=/\bgolf\b|country club|links/i,COMPLEX=/\bresort\b|\bclub\b/i;
// Classify a Wikipedia/Wikidata candidate for a course. Returns {level, reason} or null.
export function classifyCandidate(c,{course,country}){
 const d=`${c.description||''}`;if(!Number.isFinite(c.lat)||!Number.isFinite(c.lon))return null;
 if(TOURNAMENT.test(d)&&!/course|club/i.test(d))return {level:null,reason:'tournament_article_rejected'};
 // Reject only when the description names a different country (UK/England, U.S./USA etc. are one country).
 const named=mentionedCountries(d);if(country&&named.size&&!named.has(canonCountry(country)))return {level:null,reason:'country_mismatch'};
 // A named course inside a multi-course club ("TPC Scottsdale (Stadium Course)") matched to the club's article is
 // the complex, not the exact course.
 const sub=String(course).match(/\(([^)]*course[^)]*)\)|(north|south|east|west|old|new|championship|stadium|oaks|blue|red|black)\s+course/i);
 if(nameMatch(c.title,course.replace(/\([^)]*\)/g,' '))&&GOLFISH.test(d))return sub&&!fold(c.title).includes(fold(sub[1]||sub[0]))?{level:'course_complex',reason:'article is the club containing the named course'}:{level:'course',reason:'article is the course'};
 const stripped=String(course).replace(/\b(golf course|golf club|course|gc)\b/ig,'').trim();
 if(stripped&&nameMatch(c.title,stripped)&&COMPLEX.test(d)&&GOLFISH.test(d))return {level:'course_complex',reason:'article is the resort/club containing the course'};
 return null;
}
const COUNTRY_ALIASES={us:['united states','u.s.','usa','u.s.a.','us','america'],gb:['united kingdom','uk','england','scotland','wales','northern ireland','britain'],ie:['ireland'],jp:['japan'],kr:['south korea','korea'],cn:['china'],tw:['taiwan'],th:['thailand'],sg:['singapore'],my:['malaysia'],in:['india'],ae:['united arab emirates','uae','dubai','abu dhabi'],sa:['saudi arabia'],qa:['qatar'],za:['south africa'],es:['spain'],pt:['portugal'],fr:['france'],de:['germany'],it:['italy'],nl:['netherlands'],be:['belgium'],ch:['switzerland'],at:['austria'],dk:['denmark'],se:['sweden'],no:['norway'],fi:['finland'],au:['australia'],nz:['new zealand'],ca:['canada'],mx:['mexico'],do:['dominican republic'],bm:['bermuda'],bs:['bahamas'],pr:['puerto rico']};
export const canonCountry=c=>{const x=String(c||'').toLowerCase().trim();for(const [k,v] of Object.entries(COUNTRY_ALIASES))if(x===k||v.includes(x))return k;return x;};
export function mentionedCountries(d){const t=' '+String(d||'').toLowerCase().replace(/[(),]/g,' ')+' ',out=new Set();for(const [k,v] of Object.entries(COUNTRY_ALIASES))for(const a of v)if(a.length>2&&t.includes(' '+a+' ')||(a.length<=4&&new RegExp('[ ,]'+a.replace(/\./g,'\\.')+'[ .,]').test(t)))out.add(k);return out;}
export async function wikipediaCandidates(fetchJson,course){
 const q=new URLSearchParams({action:'query',format:'json',generator:'search',gsrsearch:`${course} golf`,gsrlimit:'6',prop:'coordinates|description'});
 const j=await fetchJson('https://en.wikipedia.org/w/api.php?'+q);
 return Object.values(j?.query?.pages||{}).map(p=>({title:p.title,description:p.description||'',lat:p.coordinates?.[0]?.lat,lon:p.coordinates?.[0]?.lon,source:'wikipedia'}));
}
