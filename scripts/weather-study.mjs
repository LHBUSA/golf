// Historical weather vs scoring study (research only; never published as causal).
// Joins full-field editions 2022-2025 with the nearest NOAA NCEI ISD station (<=25 km) and compares each round's
// field scoring, demeaned within its edition (so course difficulty is not mistaken for weather), with daytime
// (07-19 local, approximate solar offset) wind, gust, temperature and rain. Output: docs/evidence/weather-study.json.
import fs from 'node:fs/promises';import {existsSync} from 'node:fs';
import {store} from '../workers/shared/store.js';import {sportsEnv} from './ops.mjs';
const db=store(await sportsEnv()),UA='PropBetEdgeGolfWeather/0.1 (+https://golf.propbetedge.ai; data@propbetedge.ai)',DIR='D:/Temp/claude/golf/isd';
await fs.mkdir(DIR,{recursive:true});
const get=async(url,file)=>{if(existsSync(file))return fs.readFile(file,'utf8');await new Promise(r=>setTimeout(r,400));const r=await fetch(url,{headers:{'user-agent':UA}});if(!r.ok)return null;const t=await r.text();await fs.writeFile(file,t);return t;};
// Station inventory
const hist=await get('https://www.ncei.noaa.gov/pub/data/noaa/isd-history.csv',DIR+'/isd-history.csv');
const stations=hist.split('\n').slice(1).map(l=>l.match(/"([^"]*)"/g)?.map(x=>x.slice(1,-1))).filter(x=>x&&x[6]&&x[7]).map(x=>({id:x[0]+x[1],name:x[2],lat:Number(x[6]),lon:Number(x[7]),begin:x[9],end:x[10]})).filter(s=>Number.isFinite(s.lat)&&s.id.length===11&&!s.id.startsWith('999999'));
const km=(a,b)=>{const R=6371,r=Math.PI/180,dl=(b.lat-a.lat)*r,dn=(b.lon-a.lon)*r,x=Math.sin(dl/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dn/2)**2;return 2*R*Math.asin(Math.sqrt(x));};
const b=JSON.parse(await fs.readFile('data/public/bundle.json','utf8'));
const coords=new Map((await (async()=>{const out=[];for(let o=0;;o+=1000){const p=await db('golf_courses',`select=id,latitude,longitude&latitude=not.is.null&order=id&limit=1000&offset=${o}`);out.push(...p);if(p.length<1000)return out;}})()).map(c=>[c.id,{lat:Number(c.latitude),lon:Number(c.longitude)}]));
const eds=b.editions.filter(e=>e.coverage==='full_field'&&e.year>=2022&&e.year<=2025&&e.starts_on&&e.course?.id&&coords.has(e.course.id));
const part=(s,i)=>{const p=(s||'').split(',');return p.length>i?p[i]:null;},num=(v,d=10)=>v==null||v===''||/^\+?9999$|^99999$/.test(v)?null:Number(v)/d;
const rounds=[];let stationMiss=0,fileMiss=0;
for(const e of eds){const c=coords.get(e.course.id);const st=stations.filter(s=>s.begin<=e.starts_on.replace(/-/g,'')&&s.end>=e.ends_on.replace(/-/g,'')).map(s=>({s,d:km(c,s)})).sort((a,b)=>a.d-b.d)[0];
 if(!st||st.d>25){stationMiss++;continue;}
 const csv=await get(`https://www.ncei.noaa.gov/data/global-hourly/access/${e.year}/${st.s.id}.csv`,`${DIR}/${e.year}-${st.s.id}.csv`);if(!csv){fileMiss++;continue;}
 const lines=csv.split('\n'),hdr=lines[0].match(/"([^"]*)"/g).map(x=>x.slice(1,-1)),ix=k=>hdr.indexOf(k);
 const off=Math.round(c.lon/15);const obs=[];
 for(const l of lines.slice(1)){if(!l)continue;const f=l.match(/("([^"]*)"|[^,]*)(,|$)/g)?.map(x=>x.replace(/,$/,'').replace(/^"|"$/g,''));if(!f||f[ix('REPORT_TYPE')]?.trim()!=='FM-15')continue;
  const t=Date.parse(f[ix('DATE')]+'Z')+off*3600000,local=new Date(t).toISOString();obs.push({day:local.slice(0,10),hr:Number(local.slice(11,13)),wind:num(part(f[ix('WND')],3)),gust:ix('OC1')>=0?num(part(f[ix('OC1')],0)):null,temp:num(part(f[ix('TMP')],0)),rain:ix('AA1')>=0?num(part(f[ix('AA1')],1)):null});}
 const days=[...Array(4).keys()].map(i=>new Date(Date.parse(e.starts_on+'T12:00:00Z')+i*86400000).toISOString().slice(0,10));
 const er=[];for(let n=1;n<=4;n++){const sc=e.leaderboard.flatMap(r=>r.rounds.filter(x=>x.round===n&&Number.isFinite(x.to_par)).map(x=>x.to_par));if(sc.length<30)continue;
  const o=obs.filter(x=>x.day===days[n-1]&&x.hr>=7&&x.hr<=19);const w=o.map(x=>x.wind).filter(x=>x!=null);if(w.length<6)continue;
  const g=o.map(x=>x.gust).filter(x=>x!=null),t=o.map(x=>x.temp).filter(x=>x!=null),rn=o.map(x=>x.rain).filter(x=>x!=null);
  er.push({edition:e.slug,round:n,station:st.s.id,station_km:Math.round(st.d*10)/10,players:sc.length,field_to_par:sc.reduce((a,b)=>a+b,0)/sc.length,wind_mph:w.reduce((a,b)=>a+b,0)/w.length*2.23694,gust_mph:g.length?Math.max(...g)*2.23694:null,temp_f:t.length?t.reduce((a,b)=>a+b,0)/t.length*9/5+32:null,rain_mm:rn.length?rn.reduce((a,b)=>a+b,0):null});}
 if(er.length>=2){const m=er.reduce((a,x)=>a+x.field_to_par,0)/er.length;for(const x of er){x.relative=x.field_to_par-m;rounds.push(x);}}
}
const r2=v=>v==null?null:Math.round(v*100)/100;
const pearson=(xs,ys)=>{const n=xs.length;if(n<10)return null;const mx=xs.reduce((a,b)=>a+b)/n,my=ys.reduce((a,b)=>a+b)/n;let sxy=0,sx=0,sy=0;for(let i=0;i<n;i++){sxy+=(xs[i]-mx)*(ys[i]-my);sx+=(xs[i]-mx)**2;sy+=(ys[i]-my)**2;}return sx&&sy?sxy/Math.sqrt(sx*sy):null;};
const corr=k=>{const p=rounds.filter(x=>x[k]!=null);return {n:p.length,r:r2(pearson(p.map(x=>x[k]),p.map(x=>x.relative)))};};
const MIN=30,bins=(k,edges,unit)=>edges.slice(0,-1).map((lo,i)=>{const hi=edges[i+1],p=rounds.filter(x=>x[k]!=null&&x[k]>=lo&&x[k]<hi);const v=p.map(x=>x.relative),m=v.length?v.reduce((a,b)=>a+b)/v.length:null,sd=v.length>1?Math.sqrt(v.reduce((a,b)=>a+(b-m)**2,0)/(v.length-1)):null;
 return {bin:`${lo}–${hi===Infinity?'+':hi} ${unit}`,rounds:p.length,mean_relative_strokes:p.length>=MIN?r2(m):null,ci95:p.length>=MIN&&sd?r2(1.96*sd/Math.sqrt(p.length)):null,status:p.length>=MIN?'reported':'insufficient sample'};});
const out={generated_at:new Date().toISOString(),method:'Full-field editions 2022-2025 with course coordinates; nearest NCEI ISD station <=25 km active for the dates; 07-19 local (solar offset) FM-15 observations; round field scoring demeaned within each edition. Correlation and descriptive splits only; no causal claims.',coverage:{editions_considered:eds.length,rounds_joined:rounds.length,editions_joined:new Set(rounds.map(r=>r.edition)).size,no_station_within_25km:stationMiss,station_file_missing:fileMiss},
 correlation:{wind_mean:corr('wind_mph'),gust_max:corr('gust_mph'),temperature:corr('temp_f'),rain:corr('rain_mm')},
 descriptive:{wind_mean:bins('wind_mph',[0,6,10,14,Infinity],'mph'),gust_max:bins('gust_mph',[0,15,22,30,Infinity],'mph'),temperature:bins('temp_f',[0,60,75,85,Infinity],'°F'),rain:bins('rain_mm',[0,0.1,2,10,Infinity],'mm')},
 causal_claims:'none (observational, confounded by tee waves, course setup, field strength and station distance)',rounds};
await fs.writeFile('docs/evidence/weather-study.json',JSON.stringify(out,null,1));
console.log(JSON.stringify({coverage:out.coverage,correlation:out.correlation,wind:out.descriptive.wind_mean,gust:out.descriptive.gust_max},null,1));
