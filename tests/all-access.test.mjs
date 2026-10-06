// Native /all-access page and membership-state presentation (owner decisions 2026-10-05).
// Golf renders golf-api's verdict only: no sign-in, no Golf-only plan, no FREE label, an outage never sells.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {accessView,statePanel,lockStatus,allAccessPage,LOCAL_ALL_ACCESS_PATH,NETWORK_ALL_ACCESS_URL,ALL_ACCESS_CHECKOUT_URL,OFFER_LINE,PLATINUM_TRUTH,HERO} from '../src/lib/all-access-page.js';
import {route} from '../src/lib/render.js';
import {SPORTS,PRODUCTS} from '../src/lib/network.js';
const fam=JSON.parse(fs.readFileSync('src/lib/family.json','utf8'));
const mem=(state,entitled,verification)=>({membership:{contract:'1.3.0',sport:'golf',state,entitled,access_source:entitled?(state==='owner'?'owner':'all_access'):null,network_url:'https://propbetedge.ai/pro'},verification});

test('three link constants stay separate; Golf has never linked Stripe and still does not',()=>{
 assert.equal(LOCAL_ALL_ACCESS_PATH,'/all-access');
 assert.equal(NETWORK_ALL_ACCESS_URL,'https://propbetedge.ai/pro');
 assert.equal(ALL_ACCESS_CHECKOUT_URL,'https://buy.stripe.com/8x2eVdgmOaqy4pv8Ez7wA0N');
 for(const v of ['signed_out','not_member','check','checking','all_access','owner'])assert.doesNotMatch(statePanel(v),/buy\.stripe/,v);
 assert.doesNotMatch(allAccessPage(),/buy\.stripe/);
});

test('view machine follows golf-api verdicts; an outage is the access check',()=>{
 assert.equal(accessView(mem('free',false,'no_session')),'signed_out');
 assert.equal(accessView(mem('free',false,'no_network_entitlement')),'not_member');
 assert.equal(accessView(mem('free',false,'auth_unavailable')),'check');
 assert.equal(accessView(null,{failed:true}),'check');
 assert.equal(accessView({error:'x'}),'check');
 assert.equal(accessView(mem('all_access',true,'network')),'all_access');
 assert.equal(accessView(mem('owner',true,'network')),'owner');
 assert.equal(accessView({...mem('all_access',true,'network'),verification:'no_network_entitlement'}),'not_member','never widened client-side');
});

test('designations: Platinum, owner, no FREE anywhere; members and outages never see a purchase action',()=>{
 const p=statePanel('all_access');assert.match(p,/PLATINUM MEMBER/);assert.match(p,/◆ PLATINUM/);assert.match(p,/PLATINUM ACCESS ACTIVE/);assert.ok(p.includes(PLATINUM_TRUTH));
 assert.equal(PLATINUM_TRUTH,'PropBetEdge All Access · 10 sports + Predictions + Compare');
 assert.match(statePanel('owner'),/VERIFIED OWNER/);
 for(const v of ['all_access','owner','check','checking'])assert.doesNotMatch(statePanel(v),/See PropBetEdge All Access|\$29/,v);
 for(const v of ['signed_out','not_member','check','checking','all_access','owner'])assert.doesNotMatch(statePanel(v)+lockStatus(v),/\bFREE\b|Free reader|FREE READER/,v);
 assert.match(lockStatus('check'),/temporarily unavailable/);
});

test('network from the vendored registry: 10 sports plus network products, never an 11th sport',()=>{
 assert.equal(OFFER_LINE,'10 sports + Predictions + Compare');
 assert.deepEqual(SPORTS.map(s=>s.key),fam.sports.map(s=>s.key));
 const html=allAccessPage();
 for(const s of SPORTS)assert.ok(html.includes(s.label),s.key);
 assert.match(html,/F1 Intelligence/);assert.match(html,/YOU ARE HERE/);assert.match(html,/Command Center/);assert.match(html,/Compare/);assert.match(html,/Predictions/);assert.match(html,/ALL ACCESS PRODUCT/);
 assert.ok(PRODUCTS.every(p=>!SPORTS.some(s=>s.key===p.key)));
 assert.doesNotMatch(html,/11 sports/);
 assert.equal((statePanel('all_access').match(/OPEN →/g)||[]).length,SPORTS.length-1+PRODUCTS.length,'every other sport + every network product is OPEN, Golf is here');
});

test('/all-access is a real indexable page with the credited course hero and no redirect constructs',()=>{
 const r=route('/all-access',{index:{}});
 assert.equal(r.indexable,true);assert.match(r.title,/All Access/);assert.match(r.description,/10 sports|F1 Intelligence/);
 const html=allAccessPage();
 assert.ok(html.includes(`/api/v1/media/${HERO.sha}/640.webp`));assert.ok(html.includes(HERO.credit));assert.match(html,/<figcaption>/);
 assert.doesNotMatch(html,/style=|http-equiv|window\.location|<iframe/);
 assert.doesNotMatch(html,/golf-sunrise/);
});

test('render.js change is limited to the /all-access route (news SSR untouched)',()=>{
 const src=fs.readFileSync('src/lib/render.js','utf8');
 assert.equal((src.match(/allAccessPage/g)||[]).length,2,'one import, one route');
});


test('All Access hero cannot collapse into the old narrow copy column',()=>{
 const css=fs.readFileSync('src/product.css','utf8');
 const html=allAccessPage();
 assert.match(css,/\.aa-hero\{position:relative;display:block;isolation:isolate;min-height:650px/);
 assert.match(css,/\.aa-copy\{position:relative;z-index:2;width:min\(100%,1440px\)/);
 assert.match(css,/\.aa-hero-grid\{display:grid;grid-template-columns:minmax\(0,760px\) minmax\(190px,250px\)/);
 assert.match(css,/@media\(max-width:800px\)[\s\S]*\.aa-hero\{display:grid;min-height:0/);
 assert.match(html,/Golf is one desk/);
 assert.match(html,/Three network products/);
 assert.match(html,/SERVER-VERIFIED ACCESS/);
});

test('Golf local access adapter advertises the current membership contract',()=>{
 const src=fs.readFileSync('workers/shared/access.js','utf8');
 assert.doesNotMatch(src,/contract:'1\.3\.0'/);
 assert.match(src,/contract:'1\.4\.0'/);
});
