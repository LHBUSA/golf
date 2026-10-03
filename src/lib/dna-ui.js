// Golf DNA visual system (player + matchup). Every visual is drawn from a deterministic model built here
// from public projection data; nothing computes ad-hoc scores. Missing values are omitted, never zero.
// Raw values behind percentiles are All Access: rendered as locked slots and filled after verification.
import {e,a,kicker,portrait,fmtDate,pos,section,division} from './ui.js';
import {radar,formChart,roundProfile,bagDna,ord,withheldReason,sparkline} from './charts.js';
export const DNA_ORDER=['par3','par4','par5','scoring','consistency','under_par','cuts','top10','contention','form','majors'];
export const DNA_META={
 par3:{label:'Par-3 scoring',desc:'Performance relative to the field on par-3 holes.'},
 par4:{label:'Par-4 scoring',desc:'Performance relative to the field on par-4 holes.'},
 par5:{label:'Par-5 scoring',desc:'Performance relative to the field on par-5 holes.'},
 scoring:{label:'Scoring vs field',desc:'Overall scoring relative to the event field.'},
 consistency:{label:'Consistency',desc:'Lower volatility across rounds and events.'},
 under_par:{label:'Under-par rounds',desc:'Share of rounds finished under par.'},
 cuts:{label:'Cuts made',desc:'Share of full-field starts that made the cut.'},
 top10:{label:'Top-10 rate',desc:'Share of starts finishing inside the top 10.'},
 contention:{label:'Contention (top 5)',desc:'Frequency of finishing inside the top 5.'},
 form:{label:'Recent form',desc:'Performance trend across recent starts.'},
 majors:{label:'Major performance',desc:'Historical performance in major championships.'}};
const RELIABLE={HIGH:3,MEDIUM:2,LIMITED:1};
// ---------------------------------------------------------------- models
export function dnaModel(fp){
 if(!fp?.dimensions)return null;const by=new Map(fp.dimensions.map(d=>[d.code,d]));
 // Par-3/4/5 rows with no full-field hole data are shown as not comparable (with the reason), never as a sample gap,
 // and are excluded from the radar (missing:true).
 const hasHoles=['par3','par4','par5'].some(k=>by.has(k));
 const metrics=DNA_ORDER.filter(k=>by.has(k)||(['par3','par4','par5'].includes(k)&&!hasHoles)).map(k=>{const d=by.get(k)||{percentile:null,sample:0,basis:'holes',confidence:null,missing:true};const m={key:k,label:DNA_META[k].label,description:DNA_META[k].desc,percentile:d.percentile??null,sample_n:d.sample??null,basis:d.basis||null,confidence:d.confidence||null,cohort_size:d.cohort_size??null,missing:!!d.missing,direction:'higher_better'};m.withheld=withheldReason({percentile:m.percentile,sample:m.sample_n,basis:m.basis,cohort_size:m.cohort_size});return m;});
 return {window:fp.window,cohort:fp.cohort,editions:fp.editions??null,division:fp.division,metrics,ranked:metrics.filter(m=>m.percentile!==null)};
}
function trend(form){const f=(form||[]).filter(x=>Number.isFinite(x.vs_field));if(f.length<4)return null;const last=f.slice(-3),prev=f.slice(-6,-3);if(!prev.length)return null;const m=a=>a.reduce((s,x)=>s+x.vs_field,0)/a.length;const d=m(last)-m(prev);return d>0.4?'Trending up':d<-0.4?'Trending down':'Holding steady';}
// ---------------------------------------------------------------- shared atoms
export const pill=(label,value,tone='')=>`<span class="dna-pill ${tone}"><small>${e(label)}</small><b>${e(value)}</b></span>`;
const pct=v=>v===null||v===undefined?'—':ord(v);
const bar=(v,cls='')=>`<span class="mb-track" aria-hidden="true">${v===null||v===undefined?'':`<i data-w="${Math.round(v)}" class="${cls} ${v>=75?'hi':v<=25?'lo':''}"></i>`}</span>`;
export function metricBars(model,{rawSlots=true}={}){
 if(!model?.metrics.length)return '';
 const cohortTxt=m=>`Compared with ${model.division==='women'?'the women’s':'the men’s'} division cohort${Number.isFinite(m.cohort_size)?` (${m.cohort_size} qualifying players)`:''}`;
 return `<div class="mbars" role="list">${model.metrics.map(m=>`<div class="mbar" role="listitem" id="dna-${e(m.key)}"><div class="mbar-head"><span class="mbar-label">${e(m.label)}</span><b class="mbar-pct">${m.percentile===null?'—':m.percentile}</b></div>${bar(m.percentile)}<div class="mbar-foot">${rawSlots&&!m.missing?`<span class="mbar-raw" data-raw="${e(m.key)}"><span class="lock">All Access value</span></span>`:''}${m.withheld?`<span class="mbar-why" title="${e(m.withheld.detail)}"><b>${e(m.withheld.short)}</b> · ${e(m.withheld.detail)}</span>`:`<span class="mbar-n">${m.sample_n!==null?`n=${e(m.sample_n)} ${e(m.basis||'')}`:''}${m.confidence?` · ${e(m.confidence.toLowerCase())}`:''}</span>`}</div><details class="mbar-more"><summary>Why this score</summary><dl><div><dt>Percentile</dt><dd>${m.percentile===null?'Not published':e(ord(m.percentile))}</dd></div><div><dt>Observed value</dt><dd>${rawSlots&&!m.missing?`<span data-raw="${e(m.key)}"><span class="lock">All Access value</span></span>`:'—'}</dd></div><div><dt>Sample</dt><dd>${m.sample_n!==null&&m.sample_n!==undefined?`${e(m.sample_n)} qualifying ${e(m.basis||'')}`:'—'}</dd></div><div><dt>Confidence</dt><dd>${m.confidence?e(m.confidence[0]+m.confidence.slice(1).toLowerCase()):'—'}</dd></div><div><dt>Cohort</dt><dd>${e(cohortTxt(m))}</dd></div><div><dt>Definition</dt><dd>${e(m.description)}</dd></div></dl></details></div>`).join('')}</div>`;
}

// ---------------------------------------------------------------- player DNA hero (V4)
// Individual dimensions only: there is no composite score. Missing / withheld dimensions keep their axis (dashed, "—")
// and break the profile line; the line never passes through, and never drops to zero for, a missing value.
const CONF_LABEL={HIGH:'High',MEDIUM:'Medium',LIMITED:'Limited'};
export function dnaRadar(model,{title='Player DNA'}={}){
 // Not-comparable rows (par holes with no full-field hole data: missing) stay off the radar per methodology; sample-gated
 // dimensions keep a dashed axis with "—" and break the line.
 const ms=(model?.metrics||[]).filter(m=>!m.missing);if(ms.filter(m=>m.percentile!==null).length<3)return '';
 const N=ms.length,R=132,CX=250,CY=210,pt=(i,r)=>{const a=-Math.PI/2+2*Math.PI*i/N;return [CX+r*Math.cos(a),CY+r*Math.sin(a)];},f=p=>p[0].toFixed(1)+','+p[1].toFixed(1);
 const top=new Set(model.ranked.slice().sort((x,y)=>y.percentile-x.percentile||x.key.localeCompare(y.key)).slice(0,3).map(m=>m.key));
 const rings=[25,50,75,100].map(v=>`<polygon class="dr-ring${v===50?' is-mid':''}" points="${ms.map((_,i)=>f(pt(i,R*v/100))).join(' ')}"/>`).join('');
 const ringLab=[25,50,75,100].map(v=>{const [x,y]=pt(0,R*v/100);return `<text class="dr-rl" x="${(x+4).toFixed(1)}" y="${(y+3).toFixed(1)}">${v}</text>`;}).join('');
 const axes=ms.map((m,i)=>{const [x,y]=pt(i,R);return `<line class="dr-axis${m.percentile===null?' is-na':''}" x1="${CX}" y1="${CY}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`;}).join('');
 // Profile: segments only between ADJACENT axes that both have a published percentile; filled only when complete.
 const P=ms.map((m,i)=>m.percentile===null?null:pt(i,R*m.percentile/100));
 const complete=P.every(Boolean);
 const segs=complete?`<polygon class="dr-shape" points="${P.map(f).join(' ')}"/>`:P.map((p,i)=>{const q=P[(i+1)%N];return p&&q?`<line class="dr-seg" x1="${p[0].toFixed(1)}" y1="${p[1].toFixed(1)}" x2="${q[0].toFixed(1)}" y2="${q[1].toFixed(1)}"/>`:'';}).join('');
 const pts=ms.map((m,i)=>{if(m.percentile===null)return '';const p=P[i],lab=`${m.label}: ${ord(m.percentile)} percentile, n=${m.sample_n??'—'} ${m.basis||''}${m.confidence?', '+CONF_LABEL[m.confidence]+' confidence':''}`;
  return `<g class="dr-pt${top.has(m.key)?' is-top':''}" tabindex="0" role="img" aria-label="${e(lab)}" data-dna-dim="${e(m.key)}"><title>${e(lab)}</title><circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${top.has(m.key)?6:4.5}"/></g>`;}).join('');
 const labels=ms.map((m,i)=>{const [x,y]=pt(i,R+26),dx=x-CX,anc=Math.abs(dx)<14?'middle':dx>0?'start':'end';const v=m.percentile===null?'—':String(m.percentile);
  return `<text class="dr-lab${m.percentile===null?' is-na':''}${top.has(m.key)?' is-top':''}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anc}" dominant-baseline="middle"><tspan class="dr-name">${e(SHORT[m.key]||m.label)}</tspan><tspan class="dr-val" dx="6">${v}</tspan></text>`;}).join('');
 const summary=ms.map(m=>`${m.label} ${m.percentile===null?'not published':ord(m.percentile)+' percentile'}`).join('; ');
 return `<figure class="dradar"><svg viewBox="0 0 500 420" role="group" aria-label="${e(title)}. ${e(summary)}"><g>${rings}${axes}</g>${segs}${pts}${ringLab}${labels}<circle class="dr-centre" cx="${CX}" cy="${CY}" r="2.5"/></svg><figcaption>Percentile within the player’s own division cohort (centre 0, outer ring 100). Each axis stands alone: no composite score. A dashed axis with “—” has no published percentile, and the profile line is broken there rather than drawn through it.</figcaption></figure>`;
}
const SHORT={par3:'Par 3',par4:'Par 4',par5:'Par 5',scoring:'Scoring',consistency:'Consistency',under_par:'Under par',cuts:'Cuts',top10:'Top 10',contention:'Top 5',form:'Form',majors:'Majors'};
export function dnaHero(d,model,{asOf=null}={}){
 if(!model||!model.ranked.length)return `<div class="dna-hero is-empty"><p class="eyebrow">PLAYER DNA</p><h2>${e(d.name)}</h2><p class="dna-sub">Player DNA does not yet have enough comparable sample. Dimensions publish once full-field rounds in our record clear each dimension’s qualification rule.</p></div>`;
 return dnaHeroShell(d,model,{asOf});
}
/** Radar + intelligence cards for one window (re-rendered in place by the All Access window toggle). */
export function dnaBody(d,model){
 if(!model||!model.ranked.length)return `<p class="dna-sub">Player DNA does not yet have enough comparable sample in this window.</p>`;
 const r=model.ranked,best=r.slice().sort((x,y)=>y.percentile-x.percentile||x.key.localeCompare(y.key))[0];
 const reliable=r.slice().sort((x,y)=>(RELIABLE[y.confidence]||0)-(RELIABLE[x.confidence]||0)||(y.sample_n||0)-(x.sample_n||0)||y.percentile-x.percentile)[0];
 const form=r.find(m=>m.key==='form'),t5=r.find(m=>m.key==='contention'),t10=r.find(m=>m.key==='top10'),tr=trend(d.visuals?.form);
 const nForm=(d.visuals?.form||[]).filter(x=>Number.isFinite(x.vs_field)).length;
 const nb=m=>`n=${m.sample_n??'—'} ${m.basis||''}`.trim();
 const card=(k,title,value,sub,extra='',cls='')=>`<article class="dna-card ${cls}"><span class="micro-label">${e(k)}</span><b>${e(title)}</b><span class="dna-card-v">${e(value)}</span>${sub?`<span class="dna-card-s">${e(sub)}</span>`:''}${extra}</article>`;
 const cards=[
  best&&card('Best DNA edge',best.label,ord(best.percentile)+' percentile',`${nb(best)}${best.confidence?' · '+CONF_LABEL[best.confidence]+' confidence':''}`,'','is-best'),
  reliable&&card('Most reliable',reliable.label,ord(reliable.percentile)+' percentile',`${nb(reliable)} · ${CONF_LABEL[reliable.confidence]||'—'} confidence`,'<span class="dna-card-s">Largest sample at the highest confidence, not the highest score.</span>'),
  form&&card('Recent form',ord(form.percentile)+' percentile',tr?`Last three starts vs the three before: ${tr.toLowerCase()}`:'Direction not published (needs six observed starts)',`Strokes per round vs field · last ${Math.min(10,nForm)} of ${nForm} observed full-field events`,sparkline(d.visuals?.form,{label:d.name+' recent form'})),
  (t5||t10)&&`<article class="dna-card"><span class="micro-label">Contention profile</span><dl class="dna-cdl">${t5?`<div><dt>Top 5 (contention)</dt><dd>${e(ord(t5.percentile))} <small>${e(nb(t5))}</small></dd></div>`:''}${t10?`<div><dt>Top 10</dt><dd>${e(ord(t10.percentile))} <small>${e(nb(t10))}</small></dd></div>`:''}${d.summary?.wins_observed!=null?`<div><dt>Wins observed</dt><dd>${e(d.summary.wins_observed)}</dd></div>`:''}</dl></article>`
 ].filter(Boolean);
 return `<div class="dna-hero-radar">${dnaRadar(model,{title:d.name+' Player DNA'})}</div><div class="dna-cards">${cards.join('')}</div>`;
}
export function dnaContext(model){
 const conf=['HIGH','MEDIUM','LIMITED'].map(c=>[c,model.metrics.filter(m=>m.confidence===c&&m.percentile!==null).length]).filter(([,n])=>n);
 const withheld=model.metrics.filter(m=>m.percentile===null).length;
 const sizes=model.metrics.map(m=>m.cohort_size).filter(Number.isFinite),cohortN=sizes.length?(Math.min(...sizes)===Math.max(...sizes)?String(Math.max(...sizes)):`${Math.min(...sizes)}–${Math.max(...sizes)}`):null;
 return `<p class="dna-ctx">Compared with ${e(model.cohort)}${cohortN?` · ${e(cohortN)} qualifying players per dimension`:''}${model.editions?` · ${e(model.editions)} editions`:''}</p><p class="dna-ctx">${conf.map(([c,n])=>`${n} ${CONF_LABEL[c].toLowerCase()}`).join(' · ')}-confidence dimensions${withheld?` · ${withheld} withheld`:''} · no composite score</p>`;
}
function dnaHeroShell(d,model,{asOf=null}={}){
 return `<div class="dna-hero" data-dna-hero><div class="dna-hero-head">${portrait(d,{size:120,cls:'dna-portrait'})}<div class="dna-id"><p class="eyebrow">PLAYER DNA</p><h2>${e(d.name)}</h2><p class="dna-sub">${e(division(model.division))} · <span data-dna-window-label>${e(model.window)}</span>${asOf?` · As of ${e(fmtDate(String(asOf).slice(0,10)))}`:''}</p><div data-dna-context>${dnaContext(model)}</div><div class="dna-windows" data-dna-windows></div></div></div><div class="dna-hero-grid" data-dna-body>${dnaBody(d,model)}</div></div>`;
}
/** A premium DNA window (raw metrics map) as the public fingerprint shape, for the All Access window toggle. */
export function windowFingerprint(w){return w?{window:w.window?.label||w.window,division:w.division,cohort:w.cohort,editions:w.editions,dimensions:Object.entries(w.metrics||{}).map(([code,m])=>({code,percentile:m.percentile??null,confidence:m.confidence||null,sample:m.sample??null,basis:m.basis||null,cohort_size:m.cohort_size??null}))}:null;}

export function recentForm(d){
 const f=d.visuals?.form||[];if(f.filter(x=>Number.isFinite(x.vs_field)).length<2)return '';
 const res=(d.results||[]).filter(r=>r.edition?.coverage!=='winner_only');const last5=res.slice(0,5).map(r=>pos(r)).join(' · ');
 let streak=0;for(const r of res){if(r.status==='cut')break;if(r.status==='finished')streak++;}
 const best=res.slice(0,10).filter(r=>r.status==='finished'&&r.position).sort((x,y)=>x.position-y.position)[0];
 return `${formChart(f,{title:d.name+': strokes per round vs field, recent starts'})}<div class="dna-pills">${last5?pill('Last 5 events',last5):''}${pill('Cuts made streak',streak?String(streak):'0')}${best?pill('Best recent finish',`${pos(best)} · ${best.edition.name.replace(/^\d{4}\s+/,'')}`):''}${trend(f)?pill('Trend',trend(f)):''}</div>`;
}
// Exclusive finish buckets from published cumulative counts; shown only when they reconcile to the starts.
export function finishBuckets(fd){
 if(!fd?.starts)return null;const n=fd.starts,w=fd.wins||0,t5=fd.top5||0,t10=fd.top10||0,t25=fd.top25||0,mc=fd.made_cut||0,mi=fd.missed_cut||0,wd=fd.wd_dq||0,un=fd.unknown||0;
 const b=[['Wins',w,'b-win'],['2nd–5th',t5-w,'b-t5'],['6th–10th',t10-t5,'b-t10'],['11th–25th',t25-t10,'b-t25'],['26th or worse',mc-t25,'b-mc'],['Missed cut',mi,'b-miss'],['WD / DQ',wd,'b-wd'],['Result not recorded',un,'b-un']];
 if(b.some(x=>x[1]<0)||b.reduce((s,x)=>s+x[1],0)!==n)return null;
 return {n,buckets:b.filter(x=>x[1]>0).map(([label,count,cls])=>({label,count,cls,pct:Math.round(100*count/n)}))};
}
export function finishDistribution(fd,{label=null}={}){
 const fb=finishBuckets(fd);if(!fb)return '';
 return `<div class="fdist">${label?`<p class="fdist-name">${e(label)}</p>`:''}<div class="fdist-bar" role="img" aria-label="${e(fb.buckets.map(b=>`${b.label} ${b.pct}%`).join(', '))}">${fb.buckets.map(b=>`<span class="${b.cls}" data-w="${Math.max(1,b.pct)}" title="${e(b.label)}: ${b.count} of ${fb.n}"></span>`).join('')}</div><ul class="fdist-legend">${fb.buckets.map(b=>`<li><i class="${b.cls}" aria-hidden="true"></i>${e(b.label)} <b>${b.pct}%</b> <small>(${b.count})</small></li>`).join('')}</ul><p class="gnote">${fb.n} full-field starts in our record${fb.n<15?' · limited sample':''}.</p></div>`;
}
export function roundProfileBlock(d,model){
 const rp=d.visuals?.round_profile?.all;if(!rp)return '';const c=model?.ranked.find(m=>m.key==='consistency');
 return `${roundProfile(rp,{labels:['All observed']})}<p class="lede-small">Average strokes per round better (+) or worse (−) than that round’s field average, full-field events only.${c?` Consistency: ${pct(c.percentile)} percentile.`:''}</p>`;
}
export function historyTimeline(d){
 const b=d.bio||{},s=d.summary||{},items=[];
 if(b.college)items.push(['College / amateur',b.college,null]);
 if(b.turned_pro)items.push(['Turned pro',String(b.turned_pro),null]);
 if(b.tour_debut)items.push(['Tour debut',String(b.tour_debut),null]);
 if(s.major_appearances_observed)items.push(['Majors',`${s.major_appearances_observed} appearances · ${s.major_wins||0} wins`,s.best_major_finish?`Best finish: ${s.best_major_finish===1?'won':ord(s.best_major_finish)}`:null]);
 for(const x of (d.seasons||[]).slice(0,3))items.push([`${x.season} season`,`${x.events_observed} events · ${x.wins} wins · ${x.top10} top 10s`,x.full_field_starts?`${x.cuts_made}/${x.full_field_starts} cuts`:null]);
 const first=(d.results||[]).at(-1);if(first)items.push(['First event in our record',first.edition.name,first.edition.ends_on?fmtDate(first.edition.ends_on):null]);
 if(!items.length)return '';
 return `<ol class="htl">${items.map(([k,v,n])=>`<li><span class="micro-label">${e(k)}</span><b>${e(v)}</b>${n?`<small>${e(n)}</small>`:''}</li>`).join('')}</ol><p class="gnote">College and debut from the ESPN athlete record; results observed in our coverage.</p>`;
}
// ---------------------------------------------------------------- matchup
const EDGE=15,CLOSE=8;
export function matchupModel(m){
 const A=dnaModel(m.dna.a),B=dnaModel(m.dna.b);if(!A||!B)return null;
 const rows=DNA_ORDER.map(k=>({key:k,label:DNA_META[k].label,a:A.metrics.find(x=>x.key===k&&!x.missing)||null,b:B.metrics.find(x=>x.key===k&&!x.missing)||null})).filter(r=>r.a||r.b).map(r=>({...r,delta:r.a?.percentile!=null&&r.b?.percentile!=null?r.a.percentile-r.b.percentile:null}));
 const both=rows.filter(r=>r.delta!==null);
 return {A,B,rows,comparable:m.dna.comparable,left_edges:both.filter(r=>r.delta>=EDGE).sort((x,y)=>y.delta-x.delta),right_edges:both.filter(r=>r.delta<=-EDGE).sort((x,y)=>x.delta-y.delta),close:both.filter(r=>Math.abs(r.delta)<CLOSE)};
}
export function matchupRadar(m,mm){
 const pts=k=>DNA_ORDER.map(c=>({code:c,percentile:(k==='a'?mm.A:mm.B).metrics.find(x=>x.key===c)?.percentile??null}));
 const both=DNA_ORDER.filter(c=>mm.A.metrics.some(x=>x.key===c&&x.percentile!==null)&&mm.B.metrics.some(x=>x.key===c&&x.percentile!==null));
 if(both.length<3)return '';
 const keep=d=>both.includes(d.code);
 return radar(pts('a').filter(keep),{overlay:pts('b').filter(keep),labelA:m.a.name,labelB:m.b.name,title:`${m.a.name} versus ${m.b.name} Golf DNA`});
}
export function matchupEdges(m,mm){
 const li=r=>`<li><b>${e(r.label)}</b><small>${pct(r.a.percentile)} vs ${pct(r.b.percentile)}</small></li>`;
 const col=(t,rs,cls)=>`<div class="edge-col ${cls}"><h3>${e(t)}</h3>${rs.length?`<ul>${rs.slice(0,4).map(li).join('')}</ul>`:'<p class="gnote">No clear edge.</p>'}</div>`;
 return `<div class="edges">${col(m.a.name+' edges',mm.left_edges,'is-a')}${col('Close',mm.close,'is-close')}${col(m.b.name+' edges',mm.right_edges,'is-b')}</div><p class="gnote">An edge is a gap of ${EDGE}+ percentile points; close is under ${CLOSE}.${mm.comparable?'':' Different division cohorts: compare with care.'}</p>`;
}
export function metricDiffs(m,mm){
 return `<div class="mdiff" role="table" aria-label="DNA percentile comparison"><div class="mdiff-head" role="row"><span role="columnheader">${e(m.a.name)}</span><span role="columnheader"></span><span role="columnheader">${e(m.b.name)}</span></div>${mm.rows.map(r=>{const d=r.delta;const w=d===null?0:Math.min(100,Math.round(Math.abs(d)));
  return `<div class="mdiff-row" role="row"><div class="mdiff-label" role="rowheader">${e(r.label)}</div><span class="mdiff-v a ${d>0?'is-lead':''}" role="cell">${pct(r.a?.percentile)}</span><span class="mdiff-bar" aria-hidden="true"><span class="half l">${d!==null&&d>0?`<i data-w="${w}"></i>`:''}</span><span class="half r">${d!==null&&d<0?`<i data-w="${w}"></i>`:''}</span></span><span class="mdiff-v b ${d<0?'is-lead':''}" role="cell">${pct(r.b?.percentile)}</span><div class="mdiff-n" role="cell"><span data-raw-a="${e(r.key)}">${r.a?.sample_n!=null?'n='+r.a.sample_n:''}</span><span data-raw-b="${e(r.key)}">${r.b?.sample_n!=null?'n='+r.b.sample_n:''}</span></div></div>`;}).join('')}</div>`;
}
export function formCompare(m,mm){
 const fa=m.a.visuals?.form||[],fb=m.b.visuals?.form||[];if(fa.length<2&&fb.length<2)return '';
 const pa=mm?.A.metrics.find(x=>x.key==='form')?.percentile,pb=mm?.B.metrics.find(x=>x.key==='form')?.percentile;
 const edge=pa!=null&&pb!=null?(Math.abs(pa-pb)<10?'Recent form is close':`Form edge: ${pa>pb?m.a.name:m.b.name}`):null;
 return formChart(fa,{other:fb,labelA:m.a.name,labelB:m.b.name,title:'Recent form, same timeline'})+(edge?`<div class="dna-pills">${pill('Form',edge)}</div>`:'');
}
export function finishCompare(m){
 const a_=finishDistribution(m.a.visuals?.finish_distribution?.all,{label:m.a.name}),b_=finishDistribution(m.b.visuals?.finish_distribution?.all,{label:m.b.name});
 return a_&&b_?`<div class="fdist-pair">${a_}${b_}</div>`:'';
}
export function roundCompare(m,mm){
 const ra=m.a.visuals?.round_profile?.all,rb=m.b.visuals?.round_profile?.all;if(!ra||!rb)return '';
 const ca=mm?.A.metrics.find(x=>x.key==='consistency')?.percentile,cb=mm?.B.metrics.find(x=>x.key==='consistency')?.percentile;
 return roundProfile([ra,rb],{labels:[m.a.name,m.b.name]})+(ca!=null&&cb!=null?`<p class="lede-small">Consistency: ${e(m.a.name)} ${pct(ca)}, ${e(m.b.name)} ${pct(cb)} percentile.</p>`:'');
}
// Descriptive verdict from the same deltas (no prediction, no betting language).
export function verdict(m,mm){
 const both=mm.rows.filter(r=>r.delta!==null);if(both.length<3)return '';
 const big=both.slice().sort((x,y)=>Math.abs(y.delta)-Math.abs(x.delta))[0];const who=r=>r.delta>0?m.a.name:m.b.name;
 const sep=both.filter(r=>['scoring','form'].includes(r.key)).sort((x,y)=>Math.abs(y.delta)-Math.abs(x.delta))[0];
 const lead=mm.left_edges.length>=mm.right_edges.length?'a':'b',trail=lead==='a'?mm.right_edges:mm.left_edges;
 const counter=trail[0];const cons=both.find(r=>r.key==='consistency');
 const risk=counter?`${counter.delta>0?m.a.name:m.b.name} keeps a real edge in ${counter.label.toLowerCase()} (${pct(counter.a.percentile)} vs ${pct(counter.b.percentile)}).`:cons&&Math.abs(cons.delta)>=CLOSE?`${cons.delta<0?m.a.name:m.b.name} is the more volatile of the two by consistency percentile.`:'The profiles are close across most dimensions.';
 return `<dl class="verdict"><div><dt>Biggest edge</dt><dd>${e(who(big))}: ${e(big.label.toLowerCase())} (${pct(big.a.percentile)} vs ${pct(big.b.percentile)})</dd></div>${sep?`<div><dt>Most likely separator</dt><dd>${e(sep.label)}${Math.abs(sep.delta)<CLOSE?' (currently close)':`, where ${e(who(sep))} leads`}</dd></div>`:''}<div><dt>Volatility note</dt><dd>${e(risk)}</dd></div></dl><p class="gnote">Descriptive comparison of Player DNA percentiles. Not a prediction or a pick.</p>`;
}

// Raw-value formatting for All Access hydration (values are only present after server-side verification).
const UNIT={scoring:'strokes/round vs field',form:'strokes/round vs field',par3:'strokes/hole vs field',par4:'strokes/hole vs field',par5:'strokes/hole vs field',majors:'strokes/round vs field',consistency:'sd of round score',under_par:'% of rounds',cuts:'% of starts',top10:'% of starts',contention:'% of starts'};
export function fmtRaw(code,v){if(v===null||v===undefined)return null;const pctish=['under_par','cuts','top10','contention'].includes(code);const n=pctish?`${Math.round(v)}%`:code==='consistency'?Number(v).toFixed(2):(v>0?'+':'')+Number(v).toFixed(2);return `${n} ${UNIT[code]||''}`.trim();}
export function fillRaw(root,dna,attr='data-raw'){const w=dna?.l24m||dna?.all;if(!w)return 0;let n=0;for(const el of root.querySelectorAll(`[${attr}]`)){const m=w.metrics?.[el.getAttribute(attr)];const t=fmtRaw(el.getAttribute(attr),m?.value);if(t){el.textContent=attr==='data-raw'?t:`${t} · n=${m.sample??'—'}`;el.classList.add('is-raw');n++;}}return n;}
