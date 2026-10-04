// Article Market module on golf news (contract article-market/1). The fixture is a REAL production response
// (GET /v1/article-market/golf/70c0e316-… Bank of Utah Championship 2026, captured 2026-10-04 ~16:50Z during the final
// round; Kalshi field market, focus = two article golfers + one id not in the field). Owner rules: prospective only (no
// backfill), canonical edition id only (never names), venues separate, nothing rendered when nothing is eligible.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {ARTICLE_MARKET_ACTIVATED_AT,articleMarketEvent,articleMarketFocus,articleMarketPath,articleMarketSlot,loadArticleMarket,storedArticleMarket} from '../src/lib/article-market.js';
import {articlePage} from '../src/lib/article.js';
import {buildArticle} from '../workers/shared/news/plan.js';

const payload=JSON.parse(readFileSync(new URL('./fixtures/article-market-golf-bou.json',import.meta.url),'utf8'));
const BOU='70c0e316-a890-598c-ae60-17e818586f39';
const ref=JSON.parse(readFileSync(new URL('./fixtures/news-article-final.json',import.meta.url),'utf8'));
const article=(over={})=>({...ref,status:'published',first_published_at:'2026-10-04T22:10:00.000Z',published_at:'2026-10-04T22:10:00.000Z',
 context:{...ref.context,edition_id:BOU},entities:[{key:'t1',type:'tournament',name:'2026 Bank of Utah Championship',href:'/tournament/bank-of-utah-championship-q130604671-2026'},{key:'p1',type:'player',name:'Doug Ghim',href:'/player/doug-ghim-q51548031'},{key:'p2',type:'player',name:'Ben James',href:'/player/ben-james-q140407945'},{key:'c1',type:'course',name:'x',href:'/course/x'}],...over});

test('activation constant equals the production ARTICLE_MARKET_ACTIVATED_AT (never moved backward)',()=>{
 assert.equal(ARTICLE_MARKET_ACTIVATED_AT,'2026-10-04T14:31:40Z');
 assert.equal(Date.parse(payload.activated_at),Date.parse(ARTICLE_MARKET_ACTIVATED_AT));
});

test('eligibility: stored canonical edition id + ORIGINAL first publication at/after activation; nothing else',()=>{
 assert.equal(articleMarketEvent(article()),BOU);
 assert.equal(articleMarketEvent(article({first_published_at:'2026-10-04T14:31:39Z',published_at:'2026-10-04T15:00:00Z'})),null,'first_published_at wins: pre-activation story never gets the module');
 assert.equal(articleMarketEvent(article({context:{edition:'bank-of-utah-championship-q130604671-2026'}})),null,'no stored id: no module (never resolved from names)');
 assert.equal(articleMarketEvent(article({context:{edition_id:'bank-of-utah'}})),null);
 assert.equal(articleMarketEvent(article({status:'shadow'})),null);
 assert.equal(articleMarketEvent(article({first_published_at:null,published_at:null})),null);
});

test('focus = the article\'s own golfer links (golf-api slugs), <= 8; read path uses the original publication time',()=>{
 assert.deepEqual(articleMarketFocus(article()),['doug-ghim-q51548031','ben-james-q140407945']);
 const many=article({entities:Array.from({length:12},(_,i)=>({type:'player',name:'p'+i,href:'/player/p'+i}))});
 assert.equal(articleMarketFocus(many).length,8);
 assert.equal(articleMarketPath(article()),`/api/markets/v1/article-market/golf/${BOU}?published_at=2026-10-04T22%3A10%3A00.000Z&focus=doug-ghim-q51548031%2Cben-james-q140407945`);
});

test('real field payload: LIVE MARKET WATCH, Kalshi only, focus golfers + "+N more", No official call, CSP-clean',()=>{
 const html=articleMarketSlot(article(),payload);
 assert.match(html,new RegExp(`data-art-market="${BOU}"`));
 assert.match(html,/data-published-at="2026-10-04T22:10:00.000Z"/);
 assert.match(html,/Live market watch/i);
 assert.match(html,/Kalshi/);
 assert.doesNotMatch(html,/Polymarket/,'no venue that was not observed');
 assert.match(html,/Doug Ghim/);assert.match(html,/Ben James/);
 assert.match(html,/more in the field on Kalshi/);
 assert.match(html,/No official call/);
 assert.doesNotMatch(html,/\sstyle="/,'strict CSP (style-src self)');
 assert.doesNotMatch(html,/consensus|average of/i);
});

test('placement: after the first story section; pre-activation / unlinked / unread article renders no slot at all',()=>{
 const page=articlePage(article(),{market:payload});
 const i=page.indexOf('data-art-market'),first=page.indexOf('</section>',page.indexOf('story-section'));
 assert.ok(i>first&&first>0,'after the first section');
 assert.equal((page.match(/data-art-market=/g)||[]).length,1,'one module per article');
 assert.doesNotMatch(articlePage(article({first_published_at:'2026-10-02T00:01:12.780Z',published_at:'2026-10-02T00:01:12.780Z'}),{market:payload}),/data-art-market|class="am/);
 assert.doesNotMatch(articlePage(article({context:{}}),{market:payload}),/data-art-market/);
 assert.doesNotMatch(articlePage(article(),{market:null}),/data-art-market/,'failed/slow read: nothing (no placeholder)');
 assert.equal(articleMarketSlot(article(),{...payload,eligible:false}),'');
});

test('reads: failure / ineligible / timeout -> null; never throws',async()=>{
 assert.equal(await loadArticleMarket(article(),async()=>({ok:false})),null);
 assert.equal(await loadArticleMarket(article(),async()=>{throw new Error('net');}),null);
 assert.equal(await loadArticleMarket(article(),async()=>({ok:true,json:async()=>({eligible:false})})),null);
 assert.equal(await loadArticleMarket(article(),()=>new Promise(()=>{}),{timeoutMs:20}),null);
 assert.equal(await loadArticleMarket(article({context:{}}),async()=>{throw new Error('must not read');}),null);
 let url=null;await loadArticleMarket(article(),async u=>{url=u;return {ok:false};},{base:''});
 assert.ok(url.startsWith(`/v1/article-market/golf/${BOU}?published_at=`),'service-binding path');
});

test('embedded FINAL record renders from the stored copy and never refreshes; mismatched/provisional copies are ignored',()=>{
 const packet={...payload.packet,packet_state:'FINAL'};
 const art=article({market_result:{contract:'article-market/1',mode:'MARKET_RESULT',freeze:'EMBED_THIS_PACKET',sha256:packet.sha256,packet,live:{...payload.live,mode:'MARKET_RESULT'}}});
 const p=storedArticleMarket(art);assert.ok(p?.stored);
 assert.match(articleMarketSlot(art,p),/data-market-stored/);
 assert.equal(storedArticleMarket(article({market_result:{...art.market_result,packet:{...packet,canonical_event_id:'00000000-0000-0000-0000-000000000000'}}})),null);
 assert.equal(storedArticleMarket(article({market_result:{...art.market_result,packet:{...packet,packet_state:'PROVISIONAL'}}})),null);
 assert.equal(storedArticleMarket(article({market_result:{...art.market_result,sha256:'x'}})),null);
});

test('writer: article stores the exact projection edition id; a later revision keeps an embedded market record',()=>{
 const packet={type:'final',topic:'final:x',hash:'h',facts:[],entities:[],chart_data:{},limits:[],context:{edition:'bank-of-utah-championship-q130604671-2026',division:'men',tour:'pga'}};
 const draft={headline:'H',dek:'D',sections:[{heading:'',paragraphs:['p']}]};
 const ctx={ix:{editions:[{id:'e82b59a4-6336-5237-a130-ff760ac1af20',slug:'bank-of-utah-championship-q130604671'},{id:BOU,slug:'bank-of-utah-championship-q130604671-2026'}]}};
 const a=buildArticle({packet,draft,editor:{mode:'deterministic_fallback',version:'v'},slug:'s',ctx,hero:null});
 assert.equal(a.context.edition_id,BOU);
 assert.equal(buildArticle({packet,draft,editor:{mode:'deterministic_fallback',version:'v'},slug:'s',ctx:{},hero:null}).context.edition_id,undefined);
 const prior={...a,market_result:{sha256:'abc'}};
 const b=buildArticle({packet,draft,editor:{mode:'deterministic_fallback',version:'v'},slug:'s',ctx,hero:null,prior});
 assert.deepEqual(b.market_result,{sha256:'abc'});assert.equal(b.first_published_at,a.first_published_at);
});

test('vercel: exact same-origin rewrite for the golf article-market route, ahead of the /api catch-all',()=>{
 const v=JSON.parse(readFileSync('vercel.json','utf8'));const rs=v.rewrites||[];
 const i=rs.findIndex(x=>x.source==='/api/markets/v1/article-market/golf/:id([0-9a-f-]+)');
 assert.ok(i>=0);assert.equal(rs[i].destination,'https://propsports-markets.sales-fd3.workers.dev/v1/article-market/golf/:id');
 assert.ok(i<rs.findIndex(x=>x.source==='/api/:path*'));
});

test('vendored article-market client pinned byte-for-byte to propbetedge-workers abaf809 (SHA-256)',()=>{
 const sha=f=>createHash('sha256').update(readFileSync('src/vendor/kalshi/'+f,'utf8').replace(/\r\n/g,'\n')).digest('hex');
 assert.equal(sha('article-market-ui.js'),'3be162ac863543deb3c0af98809db409225113c9381532c150b4a6d6954d5895');
 assert.equal(sha('article-market-ui.css'),'c5d12f5e9573b0b7b25356f8c4350a7f2ac83b32750fca3564a1ee7f215e8f86');
});

test('newsroom embed pass: stores the sealed packet + sha256 only when FINAL/EMBED_THIS_PACKET; prose and timestamps untouched',async()=>{
 const {embedMarketResults}=await import('../workers/golf-news/src/index.js');
 const store=new Map(),A=article(),key='news/v2/articles/'+A.slug+'.json';store.set(key,JSON.stringify(A));
 const env=resp=>({PUBLIC:{get:async k=>store.has(k)?{text:async()=>store.get(k)}:null,put:async(k,v)=>{store.set(k,v);}},MARKETS:{fetch:async()=>({ok:true,json:async()=>resp})}});
 const idx=[{slug:A.slug,published_at:A.published_at}],now=Date.parse('2026-10-05T03:00:00Z');
 let r=await embedMarketResults(env(payload),idx,{now});assert.equal(r.embedded.length,0,'live packet: not embedded');
 const fin={...payload,mode:'MARKET_RESULT',freeze:'EMBED_THIS_PACKET',packet:{...payload.packet,packet_state:'FINAL'},live:{...payload.live,mode:'MARKET_RESULT'}};
 r=await embedMarketResults(env(fin),idx,{now});assert.equal(r.embedded.length,1);
 const saved=JSON.parse(store.get(key));assert.equal(saved.market_result.sha256,payload.packet.sha256);
 assert.deepEqual(saved.sections,A.sections);assert.equal(saved.updated_at,A.updated_at);assert.equal(saved.first_published_at,A.first_published_at);
 assert.ok(storedArticleMarket(saved));
 r=await embedMarketResults(env(fin),idx,{now});assert.equal(r.checked,0,'already embedded: never rewritten');
 assert.deepEqual(await embedMarketResults({PUBLIC:env(fin).PUBLIC},idx,{now}),{status:'no_binding'});
});
