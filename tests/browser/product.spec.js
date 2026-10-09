import {test,expect} from '@playwright/test';import AxeBuilder from '@axe-core/playwright';import fs from 'node:fs';
// Pages are chosen from the exported projection so QA always exercises real, populated entities.
const b=JSON.parse(fs.readFileSync('data/public/bundle.json','utf8'));const ix=b.index;
const full=div=>ix.editions.find(e=>e.coverage==='full_field'&&e.division===div);
const topPlayer=div=>ix.players.filter(p=>p.division===div).sort((a,c)=>(c.photo?.derivatives?1:0)-(a.photo?.derivatives?1:0)||c.events_observed-a.events_observed)[0];
const fm=ix.featured_matchups?.[0];
const PAGES=['/','/today','/live','/tournaments','/players','/courses','/majors','/matchups','/pbecast','/news','/intelligence','/search','/all-access','/picks','/majors/masters','/majors/evian',
 full('men')&&'/tournament/'+full('men').slug,full('women')&&'/tournament/'+full('women').slug,'/player/'+topPlayer('men').slug,'/player/'+topPlayer('women').slug,'/course/'+ix.courses[0].slug,fm&&`/matchups/${fm.a.slug}/${fm.b.slug}`].filter(Boolean);
export {PAGES};
const WIDTHS=(process.env.QA_WIDTHS||'320,360,390,430,768,1024,1440,1600,1920').split(',').map(Number);
for(const width of WIDTHS)for(const path of PAGES)test(`${width} ${path}`,async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/status of 403/.test(m.text()))errors.push(m.text());});
 // Local preview proxies production golf-api; until the Picks release ships there, answer its public preview here.
 if(path==='/picks'&&!process.env.QA_BASE)await page.route('**/api/v1/picks/preview',r=>r.fulfill({json:{availability:'available',tournaments_locked:0,selections_graded:0}}));
 await page.setViewportSize({width,height:900});const res=await page.goto(path,{waitUntil:'networkidle'});expect(res.status()).toBe(200);
 await expect(page.locator('h1')).toHaveCount(1);await expect(page.getByRole('heading',{level:1})).not.toHaveAccessibleName('');
 const ov=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth,off:[...document.querySelectorAll('body *')].filter(el=>{const r=el.getBoundingClientRect();return r.width&&(r.right>innerWidth+1||r.left<-1)&&!el.closest('.table-wrap,.hole-strip')}).slice(0,5).map(el=>el.tagName+'.'+el.className)}));
 expect(ov.scroll<=ov.width,JSON.stringify(ov)).toBe(true);
 const inlineStyles=await page.locator('[style]').count();expect(inlineStyles).toBe(0);const broken=await page.evaluate(async()=>{const imgs=[...document.images];for(const i of imgs){i.loading='eager';}await Promise.all(imgs.map(i=>i.complete?null:new Promise(r=>{i.onload=i.onerror=r;setTimeout(r,8000);})));return imgs.filter(i=>!i.naturalWidth).map(i=>i.currentSrc||i.src);});
 expect(broken).toEqual([]);expect(errors).toEqual([]);
 expect(await page.locator('body').innerText()).not.toMatch(/\bwill appear\b|\bwhen connected\b|coming soon|lorem ipsum/i);
 const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(axe.violations.map(v=>v.id+': '+v.nodes.slice(0,2).map(n=>n.target).join(' | '))).toEqual([]);
 if(path==='/'&&width>=1024){
  const hero=await page.locator('.home-hero-content').boundingBox();expect(hero?.width||0).toBeGreaterThan(700);
  const title=await page.locator('.home-hero h1').boundingBox();expect(title?.width||0).toBeGreaterThan(420);
  const ribbon=page.locator('.all-access-ribbon');if(await ribbon.count()){const rb=await ribbon.boundingBox();const h2=await ribbon.locator('h2').boundingBox();expect(rb?.width||0).toBeGreaterThan(700);expect(h2?.width||0).toBeGreaterThan(260);}
 }
 if([390,1440,1920].includes(width)&&process.env.QA_SHOTS)await page.screenshot({path:`docs/evidence/screenshots/${(path.replace(/[^a-z0-9]+/gi,'-')||'home').slice(0,60)}-${width}.png`,fullPage:false});
});
test('mobile menu opens, closes with Escape and restores focus',async({page})=>{await page.setViewportSize({width:390,height:850});await page.goto('/');const menu=page.getByRole('button',{name:'Menu'});await menu.click();await expect(menu).toHaveAttribute('aria-expanded','true');await expect(page.locator('#primary-navigation')).toBeVisible();await page.keyboard.press('Escape');await expect(menu).toHaveAttribute('aria-expanded','false');await expect(menu).toBeFocused();});
test('tournament filters change visible rows',async({page})=>{await page.goto('/tournaments');await page.locator('[data-filter="division"]').selectOption('women');await page.locator('[data-filter="major"]').selectOption('true');expect(await page.locator('tbody tr[data-division="men"]:visible').count()).toBe(0);expect(await page.locator('tbody tr[data-division="women"]:visible').count()).toBeGreaterThan(20);});
test('player directory search and DNA sort use real data',async({page})=>{await page.goto('/players');const name=topPlayer('women').name;await page.locator('[data-player-search]').fill(name.split(' ')[0]);await expect(page.locator('[data-player-grid]')).toContainText(name);await page.locator('[data-player-search]').fill('');await page.locator('select[name="sort"]').selectOption('scoring');await expect(page.locator('[data-filter-count]')).toContainText('Showing');});
test('matchup finder canonicalizes A vs B and B vs A to one URL',async({page})=>{test.skip(!fm,'no featured matchup');await page.goto('/matchups');await page.locator('input[name="a"]').fill(fm.b.name);await page.locator('input[name="b"]').fill(fm.a.name);await page.getByRole('button',{name:'Compare'}).click();await expect(page).toHaveURL(new RegExp(`/matchups/${fm.a.slug}/${fm.b.slug}$`));await expect(page.locator('.vs-hero')).toContainText(fm.a.name);});
test('reversed matchup URL redirects to canonical order',async({page})=>{test.skip(!process.env.QA_BASE,'needs the Vercel rewrite (production run)');const ps=ix.players.slice(5,7).map(p=>p.slug).sort();await page.goto(`/matchups/${ps[1]}/${ps[0]}`);await expect(page).toHaveURL(new RegExp(`/matchups/${ps[0]}/${ps[1]}$`));await expect(page.locator('main')).toContainText(/shared events/i,{timeout:10000});});
test('PBEcast switches to a women’s edition in archive mode without fake shots',async({page})=>{const ed=full('women');await page.goto('/pbecast');await page.locator('[data-cast-select]').selectOption(ed.slug);await expect(page).toHaveURL(new RegExp('tournament='+ed.slug));await expect(page.locator('.cast-head h1')).toHaveText(ed.name);expect(await page.locator('main').innerText()).not.toMatch(/shot trajectory|LIVE NOW/i);});
test('static entity content works without JavaScript',async({browser})=>{const c=await browser.newContext({javaScriptEnabled:false});const p=await c.newPage();const ed=full('men');await p.goto('/tournament/'+ed.slug);await expect(p.locator('table.board')).toBeVisible();expect(await p.locator('table.board tbody tr').count()).toBeGreaterThan(40);await c.close();});
test('premium modules stay locked for a signed-out reader and API denies',async({page,request})=>{await page.goto('/player/'+topPlayer('men').slug);await expect(page.locator('[data-premium="player-dna"] .premium-status')).toContainText(/Included with PropBetEdge All Access|temporarily unavailable/i,{timeout:10000});const r=await request.get('/api/v1/intelligence/player-dna/'+topPlayer('men').slug);expect(r.status()).toBe(403);const body=await r.json();expect(body.data).toBeUndefined();});
test('static HTML carries no premium DNA values',async({request})=>{const html=await (await request.get('/player/'+topPlayer('men').slug)).text();expect(html).not.toMatch(/"cohort_size"|premium-json/);});
test('internal links on hub pages resolve',async({page,request})=>{const seen=new Set();for(const hub of ['/','/majors','/courses']){await page.goto(hub);for(const href of await page.locator('main a[href^="/"]').evaluateAll(as=>as.map(a=>a.getAttribute('href'))))seen.add(href.split('?')[0]);}const sample=[...seen].slice(0,60);for(const h of sample){const r=await request.get(h);expect(r.status(),h).toBe(200);}});
test('SEO: canonical, robots, sitemap and JSON-LD on qualified pages',async({request})=>{const ed=full('men');const html=await (await request.get('/tournament/'+ed.slug)).text();expect(html).toContain(`<link rel="canonical" href="https://golf.propbetedge.ai/tournament/${ed.slug}">`);expect(html).toContain('index,follow');expect(html).toContain('"@type":"SportsEvent"');const sm=await (await request.get('/sitemap.xml')).text();expect(sm).toContain('/sitemaps/tournaments.xml');const tsm=await (await request.get('/sitemaps/tournaments.xml')).text();expect(tsm).toContain('/tournament/'+ed.slug);const live=await (await request.get('/live')).text();expect(live).toContain('noindex');});
// PBEcast V3 live command center: runs against whatever tournament is live right now (skips when none is).
for(const width of [390,1440])test(`PBEcast V3 live ${width}: selection sync, labels, no overflow, axe`,async({page,request})=>{
 const live=await (await request.get('/api/v1/live?top=1')).json().catch(()=>null);const ev=(live?.events||[]).find(x=>['live','stale','suspended','round_complete'].includes(x.state));test.skip(!ev,'no tournament in play');
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.setViewportSize({width,height:900});await page.goto('/pbecast?tournament='+ev.edition.slug,{waitUntil:'networkidle'});await page.locator('[data-cv3-tower] .cv3-hit').first().waitFor();
 const row=page.locator('[data-cv3-tower] .cv3-row').nth(1);const nm=(await row.locator('.cv3-n').innerText()).trim();await row.locator('.cv3-h').click({force:true});await expect(page.locator('.cv3-pname')).toHaveText(nm);
 await expect(page.locator('[data-cv3-tower] button[aria-pressed=true]')).toHaveCount(1);
 const ov=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth,clipped:[...document.querySelectorAll('.tl-lab text')].filter(t=>{const r=t.getBoundingClientRect(),s=t.closest('svg').getBoundingClientRect();return r.right>s.right+0.5||r.left<s.left-0.5;}).length}));
 expect(ov.scroll).toBeLessThanOrEqual(ov.width);expect(ov.clipped).toBe(0);expect(await page.locator('[style]').count()).toBe(0);
 expect(await page.locator('.cv3').innerText()).not.toMatch(/ShotLink|strokes gained|proximity|course weather/i);
 const axe=await new AxeBuilder({page}).include('.cv3').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(axe.violations.map(v=>v.id+': '+v.nodes.slice(0,2).map(n=>n.target).join(' | '))).toEqual([]);
 expect(errors).toEqual([]);
});

// Canonical golfer names in PBEcast are real links to Player DNA; the row-select handler must not swallow them.
test('PBEcast golfer name opens the player profile; row elsewhere selects',async({page,request})=>{
 const live=await (await request.get('/api/v1/live?top=1')).json().catch(()=>null);const ev=(live?.events||[]).find(x=>['live','stale','suspended','round_complete'].includes(x.state));test.skip(!ev,'no tournament in play');
 await page.goto('/pbecast?tournament='+ev.edition.slug,{waitUntil:'networkidle'});await page.locator('[data-cv3-tower] .cv3-hit').first().waitFor();
 const link=page.locator('[data-cv3-tower] .cv3-row a.cv3-plink-row').nth(2);const href=await link.getAttribute('href');expect(href).toMatch(/^\/player\/[a-z0-9-]+$/);
 await link.focus();await expect(link).toBeFocused();await link.click();await expect(page).toHaveURL(new RegExp(href+'$'));await expect(page.locator('#dna')).toHaveCount(1);
});

test('homepage champion uses canonical player media when available',async({page})=>{
 await page.goto('/',{waitUntil:'networkidle'});
 const link=page.locator('.hero-winner a').first();test.skip(!await link.count(),'no completed-event champion in hero');
 const href=await link.getAttribute('href');const slug=href?.split('/').filter(Boolean).at(-1);
 const api=await page.request.get('/api/v1/players/'+slug);const body=await api.json();
 if(body?.data?.photo?.derivatives||body?.data?.headshot){
  await expect(page.locator('.hero-winner .hero-portrait img')).toHaveCount(1);
  await expect(page.locator('.hero-winner .hero-portrait.identity-mark')).toHaveCount(0);
 }
});
// ---- PBEcast Round Replay v2: the production failure case (2026 Bank of Utah, Austin Smotherman R1, Black Desert, verified routing).
const BOU='/pbecast?tournament=bank-of-utah-championship-q130604671-2026&replay=austin-smotherman-q106782591';
for(const width of [390,1440])test(`Round Replay ${width}: real card, verified routing, playback and resets`,async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width,height:900});await page.goto(BOU,{waitUntil:'networkidle'});
 const R=page.locator('[data-cast-replay]'),cells=R.locator('[data-rc-hole]'),no=R.locator('.rc-no'),play=R.locator('[data-rc-play]');
 await expect(cells).toHaveCount(18);await R.locator('[data-rc-round]').selectOption('1');
 await expect(R.locator('[data-rc-player] option:checked')).toHaveText('Austin Smotherman');
 expect((await R.locator('.rc-sc').allTextContents()).map(Number)).toEqual([4,3,3,4,4,4,4,2,4,3,4,4,4,3,3,3,3,4]);
 await expect(R.locator('.rc-tot')).toContainText('63');await expect(R.locator('.rc-tot')).toContainText('−8');
 await expect(R.locator('[data-rc-real]')).toBeVisible();await expect(R.locator('[data-rc-recon]')).toBeHidden();
 await expect(R.locator('[data-rc-attr]')).toBeVisible();await expect(R.locator('[data-rc-attr]')).toContainText('OpenStreetMap contributors');
 await expect(R.locator('[data-ball],[data-trail],.rc-ball,.rc-trail')).toHaveCount(0);
 await expect(no).toHaveText('1');await expect(R.locator('[data-rc-prev]')).toBeDisabled();
 await R.locator('[data-rc-next]').click();await expect(no).toHaveText('2'); // one click = one hole (no duplicate listeners)
 await expect(R.locator('[data-rc-hole].is-on')).toHaveCount(1);await expect(R.locator('[data-rc-hole="1"]')).toHaveAttribute('aria-current','step');
 await play.click();await expect(play).toHaveAttribute('aria-pressed','true');
 await expect(no).toHaveText('3',{timeout:2500});await play.click();await expect(play).toHaveAttribute('aria-pressed','false');
 const held=await no.textContent();await page.waitForTimeout(1900);await expect(no).toHaveText(held||'');
 await cells.nth(17).click();await expect(no).toHaveText('18');await expect(R.locator('.rc-run')).toHaveText('−8');await expect(R.locator('[data-rc-next]')).toBeDisabled();
 await expect(R.locator('[data-cm-host] .cm-route.is-focus, .rc-map .cm-route.is-focus')).toHaveAttribute('data-hole','18');
 await R.locator('[data-rc-round]').selectOption('2');await expect(no).toHaveText('1');await expect(play).toHaveAttribute('aria-pressed','false');await expect(cells).toHaveCount(18);
 await R.locator('[data-rc-player]').selectOption('0');await expect(no).toHaveText('1');
 const t=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,w:innerWidth,small:[...document.querySelectorAll('[data-cast-replay] button,[data-cast-replay] select')].filter(b=>b.getBoundingClientRect().height<44).length,font:parseFloat(getComputedStyle(document.querySelector('[data-rc-player]')).fontSize)}));
 expect(t.scroll).toBeLessThanOrEqual(t.w);expect(t.small).toBe(0);expect(t.font).toBeGreaterThanOrEqual(16);expect(errors).toEqual([]);
 const axe=await new AxeBuilder({page}).include('[data-cast-replay]').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(axe.violations.map(v=>v.id+': '+v.nodes.slice(0,2).map(n=>n.target).join(' | '))).toEqual([]);
});
test('Round Replay: an unmapped course keeps the labelled reconstruction and no OSM credit',async({page})=>{
 await page.goto('/pbecast?tournament=biltmore-championship-asheville-q141566450-2026',{waitUntil:'networkidle'});const R=page.locator('[data-cast-replay]');
 await expect(R.locator('[data-rc-hole]')).toHaveCount(18);await expect(R.locator('[data-rc-recon]')).toBeVisible();await expect(R.locator('[data-rc-real]')).toBeHidden();
 await expect(R.locator('[data-rc-attr]')).toBeHidden();await expect(R.locator('[data-rc-note]')).toContainText('generic reconstruction');
});
