// Pure parsers for Wikipedia (CC BY-SA 4.0) golf articles fetched through the documented
// MediaWiki parse API. Parsers never resolve identity by name: player rows carry the linked
// article title, which is later mapped to a Wikidata QID through documented sitelinks.
import {parse} from 'node-html-parser';
export const WP_PARSER='wikipedia-golf/1.0.0';
const clean=s=>String(s??'').replace(/\[[^\]]*\]/g,'').replace(/ /g,' ').replace(/\s+/g,' ').trim();
const dash=/[-–—−]/;
export function toPar(v){const s=clean(v).replace(/[−–]/g,'-');if(/^E(ven)?$/i.test(s))return 0;const m=s.match(/^([+-]?)(\d{1,3})$/);return m?(m[1]==='-'?-1:1)*Number(m[2]):null;}
export function scoreCell(v){
 const s=clean(v).replace(/\s/g,'');
 let m=s.match(/^((?:\d{2,3}[-–−])*\d{2,3})=(\d{2,3})$/);
 if(m){const rounds=m[1].split(/[-–−]/).map(Number),total=Number(m[2]);return {rounds,total,consistent:rounds.reduce((a,b)=>a+b,0)===total};}
 m=s.match(/^(\d{2,3})$/);if(m)return {rounds:[Number(m[1])],total:Number(m[1]),consistent:true,single:true};
 return null;
}
export function placeCell(v){
 const s=clean(v).toUpperCase();
 let m=s.match(/^(T)?(\d{1,3})$/);if(m)return {position:Number(m[2]),tied:Boolean(m[1]),status:'finished'};
 if(/^(CUT|MC)$/.test(s))return {position:null,tied:null,status:'cut'};
 if(/^(WD|RET|RTD)$/.test(s))return {position:null,tied:null,status:'withdrawn'};
 if(s==='DQ')return {position:null,tied:null,status:'disqualified'};
 if(/^(MDF|DNS|DNF)$/.test(s))return {position:null,tied:null,status:'unknown',source_status:s};
 return null;
}
function directRows(table){const rows=[];for(const c of table.childNodes){if(c.rawTagName==='tr')rows.push(c);else if(['tbody','thead','tfoot'].includes(c.rawTagName))for(const r of c.childNodes)if(r.rawTagName==='tr')rows.push(r);}return rows;}
// Expands rowspan/colspan so tied rows inherit their shared place/to-par/money cells.
export function grid(table){
 const out=[],carry=[];
 directRows(table).forEach((tr,ri)=>{
  const row=[];let col=0;const cells=tr.childNodes.filter(n=>n.rawTagName==='td'||n.rawTagName==='th');
  const take=()=>{while(carry[col]&&carry[col].left>0){row[col]=carry[col].cell;carry[col].left--;col++;}};
  for(const td of cells){take();const span=Math.min(Number(td.getAttribute('colspan'))||1,30),rs=Math.min(Number(td.getAttribute('rowspan'))||1,400);
   for(let k=0;k<span;k++){row[col]=td;if(rs>1)carry[col]={cell:td,left:rs-1};col++;}}
  take();out.push(row);
 });
 return out;
}
const anchors=el=>el?el.querySelectorAll('a').filter(a=>(a.getAttribute('href')||'').startsWith('/wiki/')&&!/^\/wiki\/(File|Help|Wikipedia|Template|Category|Special):/.test(a.getAttribute('href'))):[];
const title=href=>decodeURIComponent(href.replace(/^\/wiki\//,'').split('#')[0]).replace(/_/g,' ');
function playerCell(td,countryTd){
 if(!td)return null;
 const flags=td.querySelectorAll('.flagicon a');const flagSet=new Set(flags);
 const link=anchors(td).find(a=>!flagSet.has(a)&&!a.querySelector('img'));
 const raw=clean(td.text);const name=clean(link?link.text:raw.replace(/\((a|c|[a-z])\)/gi,''));
 const country=flags[0]?title(flags[0].getAttribute('href')):countryTd?(anchors(countryTd)[0]?title(anchors(countryTd)[0].getAttribute('href')):clean(countryTd.text)||null):null;
 if(!name)return null;
 return {name,title:link?title(link.getAttribute('href')):null,amateur:/\(a\)/i.test(raw),past_champion:/\(c\)/i.test(raw),country};
}
function walk(node,fn,state){for(const c of node.childNodes||[]){if(c.nodeType!==1)continue;if(/^h[2-4]$/.test(c.rawTagName)){state.heading=clean(c.text);continue;}if(c.rawTagName==='table'){fn(c,state.heading);continue;}walk(c,fn,state);}}
export function tablesWithHeadings(root){const out=[];walk(root,(t,h)=>out.push({table:t,heading:h||''}),{heading:''});return out;}
function header(g){for(let i=0;i<Math.min(g.length,4);i++){const names=g[i].map(c=>clean(c?.text).toLowerCase());if(names.includes('player')||names.some(n=>/^player/.test(n)))return {index:i,names};}return null;}
function leaderboardTable(table){
 const g=grid(table),h=header(g);if(!h)return null;
 const col=re=>h.names.findIndex(n=>re.test(n));
 const c={place:col(/^(place|pos)/),player:col(/^player/),country:col(/^(country|nation)/),score:col(/^(score|total)/),par:col(/^to par/),money:col(/^(money|prize|earnings)/)};
 if(c.place<0||c.player<0||c.score<0)return null;
 const caption=clean(g[0]?.[0]?.text);
 const rows=[];
 for(const r of g.slice(h.index+1)){
  const place=placeCell(r[c.place]?.text),player=playerCell(r[c.player],c.country>=0?r[c.country]:null),score=scoreCell(r[c.score]?.text);
  if(!place||!player)continue;
  const moneyText=c.money>=0?clean(r[c.money]?.text):'';
  rows.push({...place,player,rounds:score?.rounds||[],total:score?.single?null:score?.total??null,score_consistent:score?score.consistent:null,to_par:c.par>=0?toPar(r[c.par]?.text):null,money:/^[\d,]+$/.test(moneyText)?Number(moneyText.replace(/,/g,'')):null,money_note:moneyText&&!/^[\d,]+$/.test(moneyText)?moneyText:null,place_text:clean(r[c.place]?.text)});
 }
 return rows.length?{rows,caption}:null;
}
function courseTable(table){
 const g=grid(table);if(g.length<2)return null;
 const firstCol=g.map(r=>clean(r[0]?.text).toLowerCase());
 const yardsRow=g.find(r=>/^(yards|yardage|length)/i.test(clean(r[0]?.text))),metresRow=g.find(r=>/^(metres|meters)/i.test(clean(r[0]?.text))),parRow=g.find(r=>/^par/i.test(clean(r[0]?.text)));
 const holes=[];
 if(firstCol[0]==='hole'&&parRow&&(yardsRow||metresRow)){ // horizontal layout
  g[0].forEach((cell,i)=>{const n=Number(clean(cell?.text));if(Number.isInteger(n)&&n>=1&&n<=18&&!holes.some(x=>x.hole===n)){const y=yardsRow?Number(clean(yardsRow[i]?.text).replace(/,/g,'')):null,p=Number(clean(parRow[i]?.text));holes.push({hole:n,yards:Number.isFinite(y)&&y>0?y:null,par:p});}});
 }else{ // vertical layout with repeating Hole/Name/Yards/Par column groups
  const h=g[0].map(c=>clean(c?.text).toLowerCase());
  const groups=[];h.forEach((n,i)=>{if(n==='hole'){const end=h.indexOf('hole',i+1);const span=h.slice(i,end<0?h.length:end);groups.push({hole:i,yards:i+span.findIndex(x=>/^(yards|yardage)/.test(x)),par:i+span.indexOf('par')});}});
  if(!groups.length||groups.some(x=>x.par<x.hole||x.yards<x.hole))return null;
  for(const r of g.slice(1))for(const gr of groups){const n=Number(clean(r[gr.hole]?.text));if(Number.isInteger(n)&&n>=1&&n<=18&&!holes.some(x=>x.hole===n)){const y=Number(clean(r[gr.yards]?.text).replace(/,/g,''));holes.push({hole:n,yards:Number.isFinite(y)&&y>0?y:null,par:Number(clean(r[gr.par]?.text))});}}
 }
 holes.sort((a,b)=>a.hole-b.hole);
 if(holes.length!==18||holes.some((x,i)=>x.hole!==i+1||![3,4,5,6].includes(x.par)||(x.yards!==null&&(x.yards<70||x.yards>720))))return null;
 const par=holes.reduce((a,b)=>a+b.par,0),yards=holes.every(x=>x.yards)?holes.reduce((a,b)=>a+b.yards,0):null;
 if(par<66||par>74)return null;
 return {holes,par,yards};
}
function scorecardTable(table){
 const g=grid(table);if(clean(g[0]?.[0]?.text).toLowerCase()!=='hole')return null;
 const parRow=g.find(r=>/^par$/i.test(clean(r[0]?.text)));if(!parRow)return null;
 const holeCols=[];g[0].forEach((c,i)=>{const n=Number(clean(c?.text));if(Number.isInteger(n)&&n>=1&&n<=18)holeCols.push({hole:n,i});});
 if(holeCols.length!==18)return null;
 const players=[];
 for(const r of g){const label=clean(r[0]?.text);if(!label||/^(hole|par|yards|metres)$/i.test(label))continue;
  const cum=holeCols.map(h=>toPar(r[h.i]?.text));if(cum.some(v=>v===null))continue;
  const flag=r[0].querySelector('.flagicon a');players.push({label,country:flag?title(flag.getAttribute('href')):null,cumulative:cum});}
 return players.length?{par:holeCols.map(h=>Number(clean(parRow[h.i]?.text))),players}:null;
}
const MONTH_NAMES='january|february|march|april|may|june|july|august|september|october|november|december';
// "April 10–13, 2025" | "30 July – 2 August 2026" | "July 30 – August 2, 2026"
export function infoboxDates(text){
 const s=clean(text).replace(/[–—]/g,'-').toLowerCase(),M=n=>MONTHS[n.slice(0,3)],iso=(y,m,d)=>`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
 const MN=MONTH_NAMES,D='(\\d{1,2})',Y='(\\d{4})';
 let m=s.match(new RegExp(`^(${MN}) ${D} ?- ?(?:(${MN}) )?${D},? ${Y}$`));
 if(m)return {starts_on:iso(m[5],M(m[1]),m[2]),ends_on:iso(m[5],M(m[3]||m[1]),m[4])};
 m=s.match(new RegExp(`^${D} ?(?:(${MN}) )?- ?${D} (${MN}),? ${Y}$`));
 if(m)return {starts_on:iso(m[5],M(m[2]||m[4]),m[1]),ends_on:iso(m[5],M(m[4]),m[3])};
 return {starts_on:null,ends_on:null};
}
export function parseInfobox(root){
 const ib=root.querySelector('table.infobox');if(!ib)return null;const out={courses:[],tours:[]};
 for(const tr of ib.querySelectorAll('tr')){const th=tr.querySelector('th'),td=tr.querySelector('td');if(!th||!td)continue;const k=clean(th.text).toLowerCase(),v=clean(td.text);
  if(/^courses?$/.test(k))out.courses=anchors(td).map(a=>title(a.getAttribute('href')));
  else if(k==='dates'){out.dates_text=v;Object.assign(out,infoboxDates(v));}
  else if(k==='par'){const n=v.match(/^(\d{2})(?!\d)/);out.par=n?Number(n[1]):null;}
  else if(k==='length'){const n=v.match(/^([\d,]{4,6}) yards/);out.yards=n?Number(n[1].replace(/,/g,'')):null;}
  else if(k==='field'){const n=v.match(/^(\d{2,3}) players(?:, (\d{1,3}) after cut)?/);if(n){out.field_size=Number(n[1]);out.made_cut=n[2]?Number(n[2]):null;}}
  else if(k==='cut'){const n=v.match(/^(\d{3}) \(([+−-]?\d+|E)\)/);if(n){out.cut_strokes=Number(n[1]);out.cut_to_par=toPar(n[2]);}}
  else if(k==='tours')out.tours=anchors(td).map(a=>title(a.getAttribute('href')));
 }
 return out;
}
// Parses one edition article into a frozen observation. Returns coverage flags instead of guessing.
export function parseEditionArticle(html,{winnerTitle=null}={}){
 const root=parse(html);root.querySelectorAll('sup.reference, style, .mw-editsection, .navbox').forEach(n=>n.remove());
 const infobox=parseInfobox(root);root.querySelectorAll('table.infobox').forEach(n=>n.remove());
 const tables=tablesWithHeadings(root);
 let course=null,scorecard=null;const boards=[];
 for(const {table,heading} of tables){
  if(/^\s*(first|second|third|fourth|1st|2nd|3rd) round|round summar|par-3|qualif/i.test(heading)){const lb=leaderboardTable(table);if(lb)boards.push({...lb,heading,kind:'round'});continue;}
  if(!course&&!/scorecard/i.test(heading)){const ct=courseTable(table);if(ct){course={...ct,heading};continue;}}
  if(!scorecard&&/scorecard|final round/i.test(heading)){const sc=scorecardTable(table);if(sc){scorecard=sc;continue;}}
  const lb=leaderboardTable(table);if(lb)boards.push({...lb,heading,kind:/final|leaderboard|result|scorecard/i.test(heading)||/below the top/i.test(lb.caption)?'final':'other'});
 }
 let finals=boards.filter(b=>b.kind==='final'&&!b.rows.every(r=>r.rounds.length<=1));
 if(!finals.length){const max=Math.max(0,...boards.map(b=>Math.max(...b.rows.map(r=>r.rounds.length))));if(max>=3)finals=boards.filter(b=>b.kind!=='round'&&b.rows.some(r=>r.rounds.length===max));}
 const seen=new Set(),rows=[];
 for(const b of finals)for(const r of b.rows){const key=r.player.title||'name:'+r.player.name;if(seen.has(key))continue;seen.add(key);rows.push(r);}
 const roundsPlayed=Math.max(0,...rows.filter(r=>r.status==='finished').map(r=>r.rounds.length));
 // Playoff: tied first place resolved by the winner assertion, never by guessing.
 const firsts=rows.filter(r=>r.status==='finished'&&r.position===1);
 let playoff=false;
 if(firsts.length>1){playoff=true;const w=winnerTitle?firsts.find(r=>r.player.title===winnerTitle):null;
  if(w){const losers=firsts.filter(r=>r!==w);w.tied=false;w.playoff='won';for(const l of losers){l.position=2;l.tied=losers.length>1;l.playoff='lost';}}else for(const r of firsts)r.playoff='unresolved';}
 const cutRows=rows.filter(r=>r.status==='cut');
 // Full field only when missed-cut rows are listed and the row count reaches the published field size.
 const fieldComplete=cutRows.length>0&&(!infobox?.field_size||rows.length>=infobox.field_size);
 const coverage=fieldComplete?'full_field':cutRows.length?'partial_field':infobox?.made_cut&&rows.filter(r=>r.status==='finished').length>=infobox.made_cut?'made_cut':rows.length?'top_finishers':'none';
 let cut=null;
 if(cutRows.length){const made=rows.filter(r=>r.status==='finished'&&r.rounds.length>=3);const worstMade=Math.max(...made.map(r=>r.rounds.slice(0,2).reduce((a,b)=>a+b,0)).filter(Number.isFinite));if(Number.isFinite(worstMade))cut={after_round:2,strokes:worstMade,basis:'highest 36-hole total among listed players who completed more than two rounds'};}
 if(infobox?.cut_strokes)cut={after_round:2,strokes:infobox.cut_strokes,score_to_par:infobox.cut_to_par,basis:'published in source infobox'};
 return {rows,coverage,rounds_played:roundsPlayed,playoff,course,scorecard,cut,infobox,boards_found:boards.length};
}
// Converts the cumulative final-round scorecard into hole strokes for leaderboard rows.
// A row is linked only when its surname label and flag match exactly one listed finisher and
// the derived strokes reproduce that finisher's published final-round score.
export function finalRoundHoles(parsed){
 const sc=parsed.scorecard;if(!sc||!parsed.course)return [];
 if(sc.par.some((p,i)=>p!==parsed.course.holes[i].par))return [];
 const out=[];const finishers=parsed.rows.filter(r=>r.status==='finished'&&r.rounds.length===parsed.rounds_played&&Number.isInteger(r.to_par));
 for(const p of sc.players){
  const surname=p.label.replace(/\(a\)/i,'').trim().toLowerCase();
  const matches=finishers.filter(r=>{const n=r.player.name.toLowerCase();return (n===surname||n.endsWith(' '+surname)||n.startsWith(surname+' '))&&(!p.country||!r.player.country||p.country===r.player.country);});
  if(matches.length!==1)continue;
  const r=matches[0],last=r.rounds[r.rounds.length-1],par=parsed.course.par,start=r.to_par-(last-par);
  const strokes=p.cumulative.map((c,i)=>sc.par[i]+c-(i?p.cumulative[i-1]:start));
  if(strokes.some(s=>s<1||s>12)||strokes.reduce((a,b)=>a+b,0)!==last||p.cumulative[17]!==r.to_par)continue;
  out.push({player_title:r.player.title,player_name:r.player.name,round:parsed.rounds_played,strokes});
 }
 return out;
}
const MONTHS={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
// "Jan 15–18", "Jul 30 – Aug 2" -> ISO dates (source states the season year in the article title)
export function seasonDates(text,year){
 const s=clean(text).replace(/[–—]/g,'-');
 const m=s.match(/^([A-Za-z]{3})[a-z]*\.? (\d{1,2})\s*-\s*(?:([A-Za-z]{3})[a-z]*\.? )?(\d{1,2})$/);
 if(!m){const one=s.match(/^([A-Za-z]{3})[a-z]*\.? (\d{1,2})$/),mm=one&&MONTHS[one[1].toLowerCase()];return {starts_on:null,ends_on:mm?`${year}-${String(mm).padStart(2,'0')}-${one[2].padStart(2,'0')}`:null};}
 const m1=MONTHS[m[1].toLowerCase()],m2=m[3]?MONTHS[m[3].toLowerCase()]:m1;if(!m1||!m2)return {starts_on:null,ends_on:null};
 const iso=(mm,dd)=>`${year}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}`;
 return {starts_on:iso(m1,Number(m[2])),ends_on:iso(m2,Number(m[4]))};
}
export function parseSeasonArticle(html,year){
 const root=parse(html);root.querySelectorAll('sup.reference, style, .mw-editsection, .navbox').forEach(n=>n.remove());
 const events=[];
 for(const {table,heading} of tablesWithHeadings(root)){
  if(!/^(schedule|season schedule|tournaments?)( and results)?$/i.test(heading))continue;
  const g=grid(table);const h=g[0]?.map(c=>clean(c?.text).toLowerCase())||[];
  const ci=re=>h.findIndex(n=>re.test(n));const c={date:ci(/^date/),event:ci(/^tournament/),location:ci(/^location/),winner:ci(/^winner/),purse:ci(/^purse/)};
  if(c.date<0||c.event<0||c.winner<0)continue;
  for(const r of g.slice(1)){
   const ev=r[c.event];if(!ev)continue;const evLink=anchors(ev).find(a=>!a.querySelector('img'));const name=clean(ev.text);if(!name||/^tournament$/i.test(name))continue;
   const dates=seasonDates(r[c.date]?.text,year);const w=r[c.winner];const winner=w?playerCell(w,null):null;
   const wText=clean(w?.text);
   events.push({name,title:evLink?title(evLink.getAttribute('href')):null,location:c.location>=0?clean(r[c.location]?.text)||null:null,...dates,date_text:clean(r[c.date]?.text),winner:winner&&winner.title&&!/^(cancel|postpone|tbd)/i.test(wText)?winner:null,winner_text:wText||null,purse_text:c.purse>=0?clean(r[c.purse]?.text)||null:null,cancelled:/cancel/i.test(wText)});
  }
 }
 const seen=new Set();return events.filter(e=>{const k=e.name+'|'+e.starts_on;if(seen.has(k))return false;seen.add(k);return true;});
}
