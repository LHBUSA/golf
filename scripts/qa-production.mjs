import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const base=process.argv[2]||'https://golf.propbetedge.ai';
assert.equal(new URL(base).hostname,'golf.propbetedge.ai');
const graph=JSON.parse(await fs.readFile('data/public/graph.json','utf8'));
const entities=[...graph.players.map(x=>({path:'/player/'+x.slug,name:x.full_name})),...graph.courses.map(x=>({path:'/course/'+x.slug,name:x.name})),...graph.tournaments.map(x=>({path:'/tournament/'+x.slug,name:x.name}))];
const widths=[320,360,390,430,768,1024,1440];
const routes=['/','/today','/live','/tournaments','/players','/courses','/majors','/pbecast','/news','/all-access',...entities.map(x=>x.path)];
const browser=await chromium.launch({headless:true});
const context=await browser.newContext();
const page=await context.newPage();
const report={at:new Date().toISOString(),base,widths,checks:[],errors:[],analytics_requests:[]};
page.on('pageerror',e=>report.errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
page.on('request',r=>{if(/google.*(analytics|tagmanager)/.test(r.url()))report.analytics_requests.push(r.url().split('&')[0]);});
await page.addInitScript(()=>{
 window.__pbeMetrics={cls:0,lcp:0};
 new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)window.__pbeMetrics.cls+=e.value;}).observe({type:'layout-shift',buffered:true});
 new PerformanceObserver(list=>{for(const e of list.getEntries())window.__pbeMetrics.lcp=e.startTime;}).observe({type:'largest-contentful-paint',buffered:true});
});
try{
 for(const width of widths){
  await page.setViewportSize({width,height:900});
  for(const path of routes){
   const response=await page.goto(base+path,{waitUntil:'networkidle'});
   assert.equal(response.status(),200,path);
   assert.equal(await page.locator('main').count(),1,path);
   assert.equal(await page.locator('h1').count(),1,path);
   const entity=entities.find(e=>e.path===path);
   if(entity)assert.equal(await page.locator('h1').innerText(),entity.name);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width} overflow ${path}`);
   const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
   assert.deepEqual(axe.violations,[],`${width} accessibility ${path}`);
   assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'),base+path);
   assert.match(await page.locator('meta[name="robots"]').getAttribute('content'),/noindex/);
   if(entity){assert.match(await page.locator('meta[property="og:title"]').getAttribute('content'),new RegExp(entity.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));assert(await page.locator('script[type="application/ld+json"]').count());}
   const metrics=await page.evaluate(()=>window.__pbeMetrics);
   report.checks.push({width,path,status:response.status(),axe_violations:0,overflow:false,...metrics});
   if(path==='/'&&[390,1440].includes(width))await page.screenshot({path:`docs/evidence/screenshots/production-home-${width}.png`,fullPage:true});
  }
  console.log(`Production width ${width}: ${routes.length} pages passed`);
 }
 await page.goto(base+'/tournaments');
 const women=page.getByRole('button',{name:'Women’s majors',exact:true});await women.focus();await page.keyboard.press('Enter');
 assert.equal(await women.getAttribute('aria-pressed'),'true');assert.equal(await page.locator('[data-event-division="men"]:visible').count(),0);
 const event=graph.tournaments.find(t=>t.major_division==='women');
 await page.goto(base+'/pbecast');await page.locator('[data-cast-select]').selectOption(event.slug);
 await page.waitForURL('**tournament='+event.slug);assert((await page.locator('.data-cast').innerText()).includes(event.name));
 await page.screenshot({path:'docs/evidence/screenshots/production-pbecast-1440.png',fullPage:true});
 await page.goto(base+'/all-access');await page.getByText('FREE READER',{exact:true}).waitFor();
 const staticContext=await browser.newContext({javaScriptEnabled:false});const staticPage=await staticContext.newPage();await staticPage.goto(base+entities[0].path);assert.equal(await staticPage.locator('h1').innerText(),entities[0].name);await staticContext.close();
 const unknown=await context.request.get(base+'/player/not-real');assert.equal(unknown.status(),404);
 const robots=await context.request.get(base+'/robots.txt');assert.match(await robots.text(),/Disallow:\s*\//);
 report.interactions={keyboard_tour_filter:true,womens_pbecast:true,static_entity:true,anonymous_membership:'free',unknown_entity:404};
 assert.deepEqual(report.errors,[],'production browser console/page errors');
 assert(report.analytics_requests.some(u=>u.includes('G-BRS48R8PG9')),'network GA4 script requested');
 report.passed=true;
}catch(error){report.passed=false;report.failure=error.stack;throw error;}
finally{await fs.writeFile('docs/evidence/production-browser.json',JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify({passed:report.passed,pages:report.checks.length,errors:report.errors.length,max_cls:Math.max(...report.checks.map(x=>x.cls)),analytics_loaded:report.analytics_requests.length>0}));
