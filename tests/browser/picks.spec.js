import {test,expect} from '@playwright/test';import AxeBuilder from '@axe-core/playwright';
// Golf Picks: guest sees the method + lock only; an All Access member (membership mocked at the network edge,
// exactly what golf-api answers) sees selections, grades and the track record. Values never exist in the HTML.
const WIDTHS=[320,360,390,430,768,1024,1440];
const sel=(family,label,slug,name,p,grade,actual,reason,extra={})=>({family,family_label:label,proposition:{winner:'WIN',top10:'TOP 10',top20:'TOP 20',make_cut:'MAKE CUT',h2h:'FINISH AHEAD'}[family],slug,name,p,grade,actual,reason,factors:{rounds_rated:84,rating_strokes_vs_field:-1.42,round_sd:2.71},...extra});
const item={edition:{slug:'qa-fixture-edition',name:'QA Fixture Championship (test data)',starts_on:'2026-10-15',tour:'LPGA',division:'women'},locked_at:'2026-10-14T20:10:00Z',start_evidence:{first_tee:'2026-10-14T23:30:00Z'},lock_sha256:'ab12cd34ef56ab12cd34ef56',field_size:81,cut:{applies:false,rank:null},sims:20000,
 selections:[sel('winner','TOURNAMENT WINNER','qa-golfer-a','Golfer A (test)',0.142,'LOSS','T3','did not win'),sel('top10','TOP 10','qa-golfer-b','Golfer B (test)',0.41,'WIN','T10','finished T10 (ties count)'),sel('top20','TOP 20','qa-golfer-c','Golfer C (test)',0.38,'LOSS','T24','finished T24'),
  sel('h2h','HEAD TO HEAD','qa-golfer-d','Golfer D with a much longer test name',0.61,'VOID','WD vs 12','a golfer withdrew, was disqualified or did not start',{opponent:{slug:'qa-golfer-e',name:'Golfer E (test)'},p_tie:0.03}),sel('top20','TOP 20','qa-golfer-f','Golfer F (test)',0.33,'PENDING',null,'awaiting official result')],
 probabilities:Array.from({length:12},(_,i)=>({slug:'qa-golfer-'+i,name:'Golfer '+i+' (test)',win:0.14/(i+1),top10:0.5/(1+i*0.2),top20:0.7/(1+i*0.15),make_cut:null,rounds_rated:40+i}))};
const record={families:[{family:'winner',label:'TOURNAMENT WINNER',selections:1,WIN:0,LOSS:1,VOID:0,PENDING:0,hit_rate:0,expected_wins:0.1,brier:0.0202},{family:'top10',label:'TOP 10',selections:1,WIN:1,LOSS:0,VOID:0,PENDING:0,hit_rate:1,expected_wins:0.4,brier:0.3481}],
 rows:[{edition_name:'QA Fixture Championship (test data)',name:'Golfer B (test)',family:'top10',proposition:'TOP 10',p:0.41,actual:'T10',grade:'WIN'},{edition_name:'QA Fixture Championship (test data)',name:'Golfer A (test)',family:'winner',proposition:'WIN',p:0.142,actual:'T3',grade:'LOSS'}]};
const PREVIEW={availability:'available',model:'golf-prob/1.0.0',label:'RESEARCH',tournaments_locked:1,selections_graded:3,resolved:[{edition:'QA Fixture Championship (test data)',family:'top10',proposition:'TOP 10',name:'Golfer B (test)',p:0.41,actual:'T10',grade:'WIN'}],
 versions:{model:'golf-prob/1.0.0',policy:'golf-picks-policy/1.0.0',grading:'golf-picks-grade/1.0.0'},
 record:['TOURNAMENT WINNER','TOP 10','TOP 20','MAKE CUT','HEAD TO HEAD'].map((label,i)=>({family:'f'+i,label,selections:i===1?1:0,WIN:i===1?1:0,LOSS:0,VOID:0,PENDING:0,hit_rate:i===1?1:null,expected_wins:0})),
 locks:[{edition:'QA Fixture Championship (test data)',starts_on:'2026-10-08',locked_at:'2026-10-07T20:10:00Z',first_tee:'2026-10-07T23:30:00Z',lock_sha256:'ab12cd34ef56ab12cd34ef56ab12cd34',selections:5,resolved:4}],
 readiness:{state:'NOT_READY',reason:{code:'field_unpublished',kind:'source_hold',headline:'FIELD NOT YET PUBLISHED BY SOURCE',detail:'0 of ~82 expected (last edition’s field) entrants listed by the official scoring source (checked 2026-10-09 15:04 UTC). Field observation opens 2026-10-14 00:00 UTC.'},edition:{name:'QA Fixture Open (test data)',starts_on:'2026-10-15',ends_on:'2026-10-18',tour:'LPGA'},checked_at:'2026-10-09T13:16:53Z',expected_lock_by:'2026-10-14T10:00:00.000Z',start_basis:'conservative pre-start rule',first_tee:null,
  checks:[['Complete-field scoring history loaded',true],['Official field published',false],['Field matched to verified golfer identities',false],['First-round start time sourced',false],['Tournament not started',false],['No scores posted',false],['Field observed within the last 70 minutes',false],['Before the lock cutoff',true]].map(([label,ok],i)=>({key:'k'+i,label,ok}))}};
async function asMember(page){
 await page.route('**/api/v1/membership',r=>r.fulfill({json:{membership:{contract:'1.4.0',sport:'golf',state:'all_access',entitled:true,access_source:'all_access'},verification:'network'}}));
 await page.route('**/api/v1/picks/track-record',r=>r.fulfill({json:{availability:'available',record}}));
 await page.route('**/api/v1/picks/preview',r=>r.fulfill({json:PREVIEW}));
 await page.route('**/api/v1/picks',r=>r.fulfill({json:{availability:'available',label:'RESEARCH',model:'golf-prob/1.0.0',policy:'golf-picks-policy/1.0.0',items:[item]}}));
}
test('static /picks HTML carries no selection or probability',async({request})=>{const h=await (await request.get('/picks')).text();expect(h).not.toMatch(/pk-card|Forecast probability|qa-golfer/);expect(h).toMatch(/noindex/);});
for(const width of WIDTHS){
 test(`picks guest ${width}: lock only, no values`,async({page})=>{
  await page.route('**/api/v1/membership',r=>r.fulfill({json:{membership:{sport:'golf',state:'free',entitled:false},verification:'no_session'}}));
  await page.route('**/api/v1/picks/preview',r=>r.fulfill({json:{...PREVIEW,tournaments_locked:0,selections_graded:0,resolved:[],locks:[],record:PREVIEW.record.map(f=>({...f,selections:0,WIN:0,hit_rate:null}))}}));
  await page.setViewportSize({width,height:900});await page.goto('/picks',{waitUntil:'networkidle'});
  await expect(page.locator('[data-premium="picks"] .premium-status')).toBeVisible();await expect(page.locator('.pk-card')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(await page.locator('[style]').count()).toBe(0);
  await page.screenshot({path:`../qa-shots/picks-guest-${width}.png`,fullPage:true});
 });
 test(`picks SIMULATED membership ${width}: selection / probability / actual / result, record, axe`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await asMember(page);await page.setViewportSize({width,height:900});await page.goto('/picks',{waitUntil:'networkidle'});
  await expect(page.locator('.pk-card')).toHaveCount(5);
  const first=page.locator('.pk-card').nth(1);for(const t of ['Our selection','Forecast probability','Actual finish','Result'])await expect(first).toContainText(t);
  await expect(first).toContainText('41%');await expect(first).toContainText('T10');await expect(first).toContainText('WIN');
  await expect(page.locator('.picks-unlocked .pk-record')).toContainText('TOURNAMENT WINNER');await expect(page.locator('#track-record')).toContainText('ab12cd34ef56ab12');await expect(page.locator('.pk-ready')).toBeVisible();
  const ov=await page.evaluate(()=>({s:document.documentElement.scrollWidth,w:innerWidth}));expect(ov.s<=ov.w,JSON.stringify(ov)).toBe(true);
  expect(await page.locator('[style]').count()).toBe(0);expect(errors).toEqual([]);
  const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(axe.violations.map(v=>v.id+': '+v.nodes.slice(0,2).map(n=>n.target).join(' | '))).toEqual([]);
  await page.screenshot({path:`../qa-shots/picks-member-${width}.png`,fullPage:true});
 });
}
