// Golf locale proof (pbe-locale/1.0.0, Global Issue #67): /es/ and /ja/ home + All Access as noindex previews.
// Pins (1) readiness: production builds are English-only and write no locale file (so /es/ and /ja/ stay 404),
// (2) the localized documents (lang, canonical, reciprocal hreflang, noindex, selector, CJK CSS, link rule, price),
// (3) catalog coverage: every English UI string the two pages render (prerender + browser-painted states) has an es
// and a ja entry; only data (names, places, tour/tournament names, positions) may stay as published.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {parse} from 'node-html-parser';
import {readyLocales,i18nBuildFlag,LOCALIZED_PATHS,PREVIEW_LOCALES} from '../src/i18n/ready.js';
import {golfLocale,SKIP,CATALOGS,localHref} from '../src/i18n/locale.js';
import {localePlan,writeLocalePages} from '../src/i18n/build.js';
import {localizeDocument,previewEnglishDocument} from '../src/i18n/document.js';
import {route,shell} from '../src/lib/render.js';
import {documentHtml} from '../src/lib/seo.js';
import {statePanel,HERO} from '../src/lib/all-access-page.js';
import {scheduleRail,nextCueHtml,seriesName} from '../src/lib/pages.js';
import {heroLive,liveRail} from '../src/lib/live-ui.js';

const ix=JSON.parse(fs.readFileSync(new URL('./fixtures/locale-home-index.json',import.meta.url),'utf8'));
const data={index:ix,players:new Map(),editions:new Map(),courses:new Map(),stories:[]};
const template=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const englishDoc=p=>{const r=route(p,data);r.fullTitle||=r.title+' | PropBetEdge Golf';return documentHtml(template,p,r,shell(p,r.main,ix));};
const READY=['en',...PREVIEW_LOCALES];
const L=golfLocale(READY);

// ------------------------------------------------------------------------------------------------ readiness
test('readiness: production is English-only whatever else is set; previews publish es + ja; local builds opt in',()=>{
 assert.deepEqual(readyLocales({VERCEL_ENV:'production'}),['en']);
 assert.deepEqual(readyLocales({VERCEL_ENV:'production',PBE_PREVIEW_LOCALES:'es,ja'}),['en'],'an env var can never open a language in production');
 assert.deepEqual(readyLocales({}),['en'],'a plain local/CI build is production-equivalent');
 assert.deepEqual(readyLocales({VERCEL_ENV:'preview'}),['en','es','ja']);
 assert.deepEqual(readyLocales({PBE_PREVIEW_LOCALES:'ja, es,ko,xx'}),['en','es','ja'],'only proof languages, registry order');
 assert.deepEqual(readyLocales({VERCEL_ENV:'preview',PBE_PREVIEW_LOCALES:''}),['en'],'explicitly empty list switches previews off');
 assert.equal(i18nBuildFlag({VERCEL_ENV:'production'}),false);assert.equal(i18nBuildFlag({}),false);assert.equal(i18nBuildFlag({VERCEL_ENV:'preview'}),true);
 assert.deepEqual([...LOCALIZED_PATHS],['/','/all-access']);
});

test('production build: no locale file is planned or written, so /es/ and /ja/ answer 404 as before',async()=>{
 const prod=readyLocales({VERCEL_ENV:'production'});
 assert.deepEqual(localePlan(prod),[]);
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'golf-locale-'));
 try{assert.deepEqual(await writeLocalePages(prod,{dist:tmp}),[]);assert.deepEqual(fs.readdirSync(tmp),[],'nothing written, English pages untouched');}
 finally{fs.rmSync(tmp,{recursive:true,force:true});}
 const P=golfLocale(prod);
 assert.deepEqual(P.READY_LOCALES,['en']);
 for(const p of ['/ja/','/ja','/es/all-access'])assert.equal(P.splitLocale(p).path,p,'unready prefix stays in the path');
 const r=route('/ja/',data);assert.equal(r.title,'Not found');assert.equal(r.indexable,false);
 assert.equal(P.localizePath('/all-access','ja'),'/all-access','never links into an unready language');
 // the browser bundle compiles the locale client out (vite define) and main.ts falls back to the URL path
 const main=fs.readFileSync(new URL('../src/main.ts',import.meta.url),'utf8');
 assert.match(main,/if\(__PBE_I18N__\)import\('\.\/i18n\/client\.js'\)/);
 assert.match(main,/const PATH=__PBE_I18N__\?\(document\.documentElement\.dataset\.pbePath\|\|location\.pathname\):location\.pathname;/);
 assert.match(fs.readFileSync(new URL('../vite.config.js',import.meta.url),'utf8'),/define:\{__PBE_I18N__:JSON\.stringify\(i18nBuildFlag\(process\.env\)\)\}/);
});

test('preview build plan: English + es + ja for the two proof pages only',()=>{
 assert.deepEqual(localePlan(READY).map(p=>p.file),['dist/index.html','dist/es/index.html','dist/ja/index.html','dist/all-access.html','dist/es/all-access.html','dist/ja/all-access.html']);
});

// ------------------------------------------------------------------------------------------------ documents
for(const p of LOCALIZED_PATHS)for(const loc of PREVIEW_LOCALES)test(`localized document ${loc}${p}: lang, self-canonical, reciprocal hreflang, noindex, selector, CJK css, links`,()=>{
 const html=localizeDocument(englishDoc(p),{path:p,locale:loc,L});const doc=parse(html);
 const self='https://golf.propbetedge.ai/'+loc+(p==='/'?'/':p);
 assert.equal(doc.querySelector('html').getAttribute('lang'),loc);
 assert.equal(doc.querySelector('html').getAttribute('data-pbe-path'),p);
 assert.equal(doc.querySelector('link[rel="canonical"]').getAttribute('href'),self);
 assert.equal(doc.querySelector('meta[property="og:url"]').getAttribute('content'),self);
 assert.equal(doc.querySelector('meta[name="robots"]').getAttribute('content'),'noindex,follow');
 const alt=doc.querySelectorAll('link[rel="alternate"][hreflang]').map(l=>[l.getAttribute('hreflang'),l.getAttribute('href')]);
 const en='https://golf.propbetedge.ai'+p;
 assert.deepEqual(alt,[['en',en],['es','https://golf.propbetedge.ai/es'+(p==='/'?'/':p)],['ja','https://golf.propbetedge.ai/ja'+(p==='/'?'/':p)],['x-default',en]]);
 assert.deepEqual(doc.querySelectorAll('link[rel="stylesheet"][href^="/i18n/"]').map(l=>l.getAttribute('href')),['/i18n/pbe-locale.css','/i18n/golf-locale.css']);
 const menu=doc.querySelector('.masthead-right > details.pbe-lang');assert.ok(menu,'selector in the header');
 assert.deepEqual(menu.querySelectorAll('a[data-lang-switch]').map(a=>[a.getAttribute('data-lang-switch'),a.getAttribute('href')]),[['en',p],['es','/es'+(p==='/'?'/':p)],['ja','/ja'+(p==='/'?'/':p)]]);
 assert.equal(menu.querySelector('a[aria-current]').getAttribute('data-lang-switch'),loc);
 // link rule: the two localized pages gain the prefix; every other internal link stays English; external untouched
 const hrefs=doc.querySelectorAll('body a[href]:not([data-lang-switch])').map(a=>a.getAttribute('href'));
 assert.ok(hrefs.includes('/'+loc+'/'),'brand links to the localized home');
 assert.ok(!hrefs.some(h=>/^\/(es|ja)\/./.test(h)&&h!=='/'+loc+'/all-access'),'only the two proof pages are prefixed');
 assert.ok(hrefs.includes('/players')||hrefs.includes('/majors'),'other pages keep their English URL');
 assert.ok(hrefs.includes('https://propbetedge.ai/pro')||p==='/','network All Access link untouched');
 const ld=JSON.parse(doc.querySelector('script[type="application/ld+json"]').text);
 const page=ld['@graph'].find(n=>n.url===self);assert.ok(page);assert.equal(page.inLanguage,loc);
 if(p==='/all-access'){const b=doc.querySelector('.aa-price-lockup b').text;assert.equal(b,'US$29','amount unchanged, currency unambiguous');assert.match(doc.querySelector('meta[name="description"]').getAttribute('content'),/US\$29/);}
 assert.ok(!html.includes('buy.stripe.com'));
});

test('English page in a preview build gains only the selector, hreflang and the locale CSS (content unchanged)',()=>{
 for(const p of LOCALIZED_PATHS){
  const src=englishDoc(p),out=previewEnglishDocument(src,{path:p,L});const doc=parse(out);
  assert.equal(doc.querySelector('html').getAttribute('lang'),'en');
  assert.equal(doc.querySelectorAll('link[rel="alternate"][hreflang]').length,4);
  assert.equal(doc.querySelector('link[rel="canonical"]').getAttribute('href'),'https://golf.propbetedge.ai'+p);
  const strip=s=>s.replace(/<details class="pbe-lang"[\s\S]*?<\/details>/,'').replace(/<link rel="(?:stylesheet" href="\/i18n\/[^"]+|alternate" hreflang="[^"]+" href="[^"]+)">/g,'');
  assert.equal(strip(out),src);
 }
});

// ------------------------------------------------------------------------------------------------ coverage
const NEVER='script, style, noscript, code, pre, textarea, [translate="no"], [data-i18n-skip], '+SKIP;
function harvest(html){
 const doc=parse(html,{comment:false,blockTextElements:{script:true,style:true,noscript:true,pre:true}});const root=doc.querySelector('body')||doc;const skip=new Set(root.querySelectorAll(NEVER));const out=new Set();
 const walk=el=>{if(skip.has(el))return;for(const a of ['aria-label','title','placeholder','alt']){const v=el.getAttribute?.(a);if(v&&/[A-Za-z]/.test(v))out.add(v.trim());}
  for(const c of el.childNodes){if(c.nodeType===1)walk(c);else if(c.nodeType===3){const t=c.text.trim();if(/[A-Za-z]/.test(t))out.add(t);}}};
 walk(root);return out;
}
// Data that is published as-is in every language: names of people, tournaments, courses and places; tours; positions.
const DATA=new Set([HERO.course,HERO.credit,'PGA TOUR','LPGA','LPGA Tour','LPGA TOUR','PGA Tour']);
const collect=o=>{if(Array.isArray(o))return o.forEach(collect);if(!o||typeof o!=='object')return;for(const [k,v] of Object.entries(o)){if(typeof v==='string'&&['name','location','locality','label','city','state','tour'].includes(k)){DATA.add(v);DATA.add(v.replace(/^\d{4}\s+/,''));DATA.add(v.toUpperCase());}else if(k==='tours'&&Array.isArray(v))v.forEach(t=>DATA.add(t));else collect(v);}};
collect(ix);
for(const k of ['masters','pga-championship','us-open','the-open','chevron','us-womens-open','womens-pga','evian','womens-open','players'])DATA.add(seriesName(k));
const LIVE_NAMES=['Unit Leader','Unit Second','Unit Third','Unit Fourth'];LIVE_NAMES.forEach(n=>DATA.add(n));DATA.add('Unit Open');DATA.add('2026 Unit Open');DATA.add('Unit Course');DATA.add('Unit City, Unit State');
const isData=s=>DATA.has(s)||/^(T?\d+|CUT|WD|DQ|DNS|[A-Z]{1,2})$/.test(s)||/^Unit /.test(s);
function covered(s,cat){
 if(cat.exact[s]!==undefined||isData(s))return true;
 if(Object.keys(cat.exact).some(k=>k!==k.toUpperCase()&&k.toUpperCase()===s))return true;
 if(cat.patterns.some(([re])=>re.test(s)))return true;
 if(s.includes('·')){const parts=s.split(/\s*·\s*/).map(x=>x.trim()).filter(Boolean);return parts.length>0&&parts.every(x=>!/[A-Za-z]/.test(x)||covered(x,cat));}
 return false;
}
// Browser-painted strings on these two pages (main.ts) — each must still exist in main.ts, so this list cannot rot.
const MAIN=['ACCOUNT','CHECKING ACCESS','ALL ACCESS','SIGN IN / LEARN','SIGNED IN','ALL ACCESS AVAILABLE','◆ PLATINUM','ALL ACCESS ACTIVE','OWNER','VERIFIED ACCESS','ACCESS CHECK','RETRY ON ALL ACCESS',
 'PropBetEdge Platinum member — All Access active','PropBetEdge verified owner access','Signed in to PropBetEdge — All Access not active','PropBetEdge All Access — sign in or learn more','PropBetEdge account access check',
 'Saved snapshot · API unavailable','Updated from live projection','Newer data available on next refresh','Current projection'];
// Consent banner copy (public/pbe-consent-v1.js; production hosts only) — translated as UI, legal pages stay English.
const CONSENT=['Privacy choices','Your privacy choices','Necessary cookies keep sign-in, security and paid access working. With your permission, we also use analytics to understand how PropBetEdge is used. You can decline analytics without losing site access.','Privacy Policy','Decline analytics','Accept analytics'];
const liveEvent=(state,extra={})=>({state,round:2,tour:'PGA TOUR',edition:{name:'2026 Unit Open',slug:'unit-open'},course:{name:'Unit Course',city:'Unit City',state:'Unit State'},leaders:LIVE_NAMES.map((name,i)=>({name,slug:'unit-'+i,total_to_par:-10,thru:12})),within_two:9,age_seconds:600,first_tee:'2026-10-09T12:05:00Z',...extra});
function englishStrings(){
 const s=new Set();
 for(const p of LOCALIZED_PATHS){const r=route(p,data);s.add(r.fullTitle||r.title+' | PropBetEdge Golf');s.add(r.description);for(const x of harvest(englishDoc(p)))s.add(x);}
 for(const v of ['checking','check','all_access','owner','not_member','signed_out'])for(const x of harvest(statePanel(v)))s.add(x);
 for(const d of ['2026-08-24','2026-09-28','2026-10-06','2026-10-09','2026-10-12','2026-12-28'])for(const x of harvest(scheduleRail(ix,d)+nextCueHtml(ix,d)))s.add(x);
 for(const st of ['live','stale','suspended','round_complete','final','pre'])for(const x of harvest(heroLive(liveEvent(st))+liveRail([liveEvent(st),liveEvent(st,{leaders:[{name:'Unit Leader',slug:'u',total_to_par:-3}],age_seconds:30})])))s.add(x);
 for(const x of harvest(heroLive(liveEvent('pre',{first_tee:null}))+liveRail([liveEvent('live',{age_seconds:7200})])))s.add(x);
 const main=fs.readFileSync(new URL('../src/main.ts',import.meta.url),'utf8');for(const x of MAIN){assert.ok(main.includes(`'${x}'`),'main.ts still paints: '+x);s.add(x);}
 const consent=fs.readFileSync(new URL('../public/pbe-consent-v1.js',import.meta.url),'utf8');for(const x of CONSENT){assert.ok(consent.includes(x),'consent copy: '+x);s.add(x);}
 return s;
}

test('catalog coverage: every English UI string on home + All Access has an es and a ja entry',()=>{
 const strings=englishStrings();assert.ok(strings.size>150,'harvest found the pages ('+strings.size+')');
 for(const loc of PREVIEW_LOCALES){const missing=[...strings].filter(x=>!covered(x,CATALOGS[loc]));assert.deepEqual(missing,[],`${loc}: missing catalog entries`);}
});

test('end to end: a localized page carries no English UI string, only published data',()=>{
 for(const p of LOCALIZED_PATHS){const en=harvest(englishDoc(p));
  for(const loc of PREVIEW_LOCALES){const out=harvest(localizeDocument(englishDoc(p),{path:p,locale:loc,L}));
   // identical in both languages only by design: data, or a catalog entry that deliberately keeps the term (brands)
   const kept=x=>x.split(/\s*·\s*/).map(y=>y.trim()).filter(Boolean).every(y=>!/[A-Za-z]/.test(y)||isData(y)||(covered(y,CATALOGS[loc])&&L.translateText(y,loc)===y));
   const left=[...out].filter(x=>en.has(x)&&!kept(x));
   assert.deepEqual(left,[],`${loc}${p}: untranslated`);
   if(loc==='ja'){const latin=[...out].filter(x=>/^[A-Za-z][a-z]+ [a-z]+ [a-z]+/.test(x)&&!isData(x));assert.deepEqual(latin,[],'no English sentences on ja pages');}
 }}
});

test('catalog hygiene: protected values never change — price amount, names and numbers pass through',()=>{
 for(const loc of PREVIEW_LOCALES){
  assert.equal(CATALOGS[loc].literal['$29'],'US$29');
  for(const [en,tr] of Object.entries(CATALOGS[loc].exact)){if(/\$29/.test(en))assert.match(tr,/US\$29/,en);assert.ok(!/\$\d/.test(tr)||/US\$29/.test(tr),'no other amount: '+tr);}
  assert.equal(L.translateText('Scottie Scheffler',loc),'Scottie Scheffler');
  assert.equal(L.translateText('Old Course at St Andrews · Photo:',loc).split(' · ')[0],'Old Course at St Andrews');
  assert.equal(L.translateText('523 leaderboards · 148,558 rounds · 3,160 players',loc).match(/[\d,]+/g).join('|'),'523|148,558|3,160');
 }
 assert.equal(L.translateText('Oct 1 – Oct 4, 2026','es'),'1 oct – 4 oct 2026');
 assert.equal(L.translateText('Oct 1 – Oct 4, 2026','ja'),'2026年10月1日～10月4日');
 assert.equal(L.translateText('Final round Aug 30, 2026','ja'),'最終ラウンド 2026年8月30日');
 assert.equal(localHref(L,'/all-access#x','ja'),'/ja/all-access#x');assert.equal(localHref(L,'/players','ja'),'/players');assert.equal(localHref(L,'https://propbetedge.ai/pro','es'),'https://propbetedge.ai/pro');
});
