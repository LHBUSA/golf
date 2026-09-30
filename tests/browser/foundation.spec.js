import {test,expect} from '@playwright/test';import AxeBuilder from '@axe-core/playwright';import {routes,majors,routeFor} from '../../src/lib/catalog.js';
const paths=[...routes.map(r=>r.path),...majors.map(m=>'/majors/'+m[2])];
for(const width of [320,360,390,430,768,1024,1440]){
 for(const path of paths)test(width+' '+path+' layout/accessibility/console',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.setViewportSize({width,height:900});await page.goto(path);await expect(page.locator('h1')).toHaveCount(1); const route=routeFor(path); await expect(page.locator('h1')).toHaveText(route.title); await expect(page).toHaveTitle(path==='/'?'Golf Intelligence | PropBetEdge':route.label+' | PropBetEdge Golf');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  const results=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(results.violations).toEqual([]);
  if(path==='/'&&[390,1440].includes(width))await page.screenshot({path:'docs/evidence/screenshots/home-'+width+'.png',fullPage:true});
  if(path==='/pbecast'&&width===1440)await page.screenshot({path:'docs/evidence/screenshots/pbecast-1440.png',fullPage:true});
 });
}
test('mobile menu navigates and Escape restores focus',async({page})=>{await page.setViewportSize({width:390,height:850});await page.goto('/');const menu=page.getByRole('button',{name:'Menu'});await menu.click();await expect(menu).toHaveAttribute('aria-expanded','true');await page.keyboard.press('Escape');await expect(menu).toBeFocused();await expect(menu).toHaveAttribute('aria-expanded','false');await menu.click();await page.getByRole('navigation',{name:'Primary'}).getByRole('link',{name:'Live',exact:true}).click();await expect(page).toHaveURL(/\/live$/);});
test('tour filter updates visible coverage',async({page})=>{await page.goto('/today');await page.getByRole('button',{name:'LPGA',exact:true}).click();await expect(page.getByRole('status')).toHaveText('Showing LPGA coverage. Verified data is unavailable.');await expect(page.getByRole('button',{name:'LPGA',exact:true})).toHaveAttribute('aria-pressed','true');});
test('All Access links existing network product',async({page})=>{await page.goto('/all-access');await expect(page.getByRole('link',{name:'Visit PropBetEdge All Access'})).toHaveAttribute('href','https://propbetedge.ai/pro');expect(await page.locator('body').innerText()).not.toMatch(/Golf Pro \$/);});
test('built shell works without JavaScript and first response metadata',async({browser})=>{const context=await browser.newContext({javaScriptEnabled:false});const page=await context.newPage();const response=await page.goto('http://127.0.0.1:5175/majors');expect(response.status()).toBe(200);await expect(page.locator('h1')).toHaveText('The championships that define careers.');await expect(page).toHaveTitle('Majors | PropBetEdge Golf');await expect(page.locator('meta[name=robots]')).toHaveAttribute('content','noindex,follow');await context.close();});
