import {chromium} from 'playwright';const [tag,...widths]=process.argv.slice(2);const b=await chromium.launch();
const urls={bri:'https://golf.propbetedge.ai/news/jacob-bridgeman-wins-2026-biltmore-championship-asheville',nis:'https://golf.propbetedge.ai/news/yuna-nishimura-wins-2026-walmart-nw-arkansas-championship'};
for(const [k,u] of Object.entries(urls))for(const w of widths.map(Number)){const p=await b.newPage({viewport:{width:w,height:900}});await p.goto(u+'?s='+Date.now(),{waitUntil:'networkidle'});
 const mods=await p.$$('.story-module');for(const m of mods){const id=await m.getAttribute('data-chart');const bb=await m.boundingBox();if(!bb)continue;
  const info=await m.evaluate(el=>({h:Math.round(el.getBoundingClientRect().height),sw:el.scrollWidth,cw:el.clientWidth,minFont:Math.min(...[...el.querySelectorAll('svg text')].map(t=>{const r=t.getBoundingClientRect();const svg=t.ownerSVGElement;const scale=svg.getBoundingClientRect().width/svg.viewBox.baseVal.width;return parseFloat(getComputedStyle(t).fontSize)*scale;}).concat([99]))}));
  console.log(tag,k,w,id,JSON.stringify(info));await m.screenshot({path:`D:/Temp/claude/golf/shots/${tag}-${k}-${w}-${id}.png`});}
 await p.close();}
await b.close();
