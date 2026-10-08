// Kalshi PERPETUALS partner offer (kalshi-partner/2) on Golf: vendored client unchanged, one footer
// mount, same-origin fixed rewrites, fail closed, and no offer economics/referral id in Golf source.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {partnerOffer,normalizeConfig,PARTNER_DISABLED} from '../src/vendor/kalshi-partner/kalshi-partner.js';
import {PARTNER_CTX,PARTNER_CONFIG_URL,mountKalshiPartnerFooter} from '../src/lib/kalshi-partner-footer.js';

const VENDORED='src/vendor/kalshi-partner/kalshi-partner.js';
const CANONICAL='D:/Workers/propbetedge-workers/workers/propsports-markets/client/kalshi-partner.js';
// SHA-256 (LF) of the canonical client at propbetedge-workers 4c3972a.
const PINNED='063e631feadb8011fd6e1a3e7cc92908dd7f402f69fd3f5cb0153b5db4b09b7f';
const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n')).digest('hex');
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(x=>x.isDirectory()?walk(path.join(d,x.name)):[path.join(d,x.name).replace(/\\/g,'/')]);

test('kalshi-partner.js is vendored byte-identical (and never line-ending converted)',()=>{
 assert.equal(sha(VENDORED),PINNED,'vendored kalshi-partner.js was edited; re-vendor it from the canonical source');
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(VENDORED)).digest('hex'),PINNED,'raw bytes differ (CRLF?)');
 assert.match(fs.readFileSync('.gitattributes','utf8'),/^src\/vendor\/kalshi-partner\/\*\* -text$/m);
 assert.deepEqual(fs.readdirSync('src/vendor/kalshi-partner'),['kalshi-partner.js']);
});

test('vendored kalshi-partner.js matches the canonical file when it is present',{skip:!fs.existsSync(CANONICAL)&&'canonical checkout absent'},()=>{
 assert.equal(sha(VENDORED),sha(CANONICAL),'canonical kalshi-partner.js changed; re-vendor it and update PINNED');
});

test('same-origin rewrites are fixed paths to propsports-markets only',()=>{
 const {rewrites}=JSON.parse(fs.readFileSync('vercel.json','utf8'));
 const kx=rewrites.filter(r=>r.source.startsWith('/go/kalshi'));
 assert.deepEqual(kx,[
  {source:'/go/kalshi-perps/config',destination:'https://propsports-markets.sales-fd3.workers.dev/v1/partner/kalshi'},
  {source:'/go/kalshi-perps',destination:'https://propsports-markets.sales-fd3.workers.dev/go/kalshi-perps'}]);
 for(const r of kx)assert.doesNotMatch(r.source+r.destination,/\/:|\(|\*|\$/);
 // ordered before the /api catch-all and any other rewrite
 assert.equal(rewrites.indexOf(kx[0]),0);
});

test('exactly one mount: the network footer, footer variant, golf attribution',()=>{
 assert.deepEqual({...PARTNER_CTX},{placement:'sport_footer',product:'golf',sport:'golf'});
 assert.equal(PARTNER_CONFIG_URL,'/go/kalshi-perps/config');
 const comp=fs.readFileSync('src/lib/kalshi-partner-footer.js','utf8');
 assert.match(comp,/variant:'footer'/);
 assert.match(comp,/footer\.site-footer/);
 const files=walk('src').filter(f=>/\.(js|ts|mjs)$/.test(f));
 const importers=files.filter(f=>f!==VENDORED&&/kalshi-partner\.js['"]/.test(fs.readFileSync(f,'utf8')));
 assert.deepEqual(importers.sort(),['src/lib/kalshi-partner-footer.js']);
 const mounters=files.filter(f=>/mountKalshiPartnerFooter\(\)/.test(fs.readFileSync(f,'utf8')));
 assert.deepEqual(mounters,['src/main.ts']);
 // never inside market, cast, leaderboard, matchup or pick components
 for(const f of ['src/lib/kalshi-live.js','src/lib/kalshi-mounts.js','src/lib/article-market.js','src/lib/cast-v3.js','src/lib/cast-v3-live.js','src/lib/live-ui.js','src/lib/pages.js','src/lib/render.js'])
  assert.doesNotMatch(fs.readFileSync(f,'utf8'),/kxo|kalshi-partner|kalshi-perps/,f);
});

test('no referral id, referral URL or offer economics hardcoded in Golf source',()=>{
 for(const f of [...walk('src'),'index.html','vercel.json']){
  if(f===VENDORED)continue;
  assert.doesNotMatch(fs.readFileSync(f,'utf8'),/kalshi\.com\/p\/|referral=/i,`${f} carries a referral URL`);
 }
 const own=fs.readFileSync('src/lib/kalshi-partner-footer.js','utf8')+fs.readFileSync('src/kalshi-partner.css','utf8');
 assert.doesNotMatch(own,/\$\d|\d+\s?% off|\d+ (months?|years?)\b|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i,'economics and the referral id live only in the propsports-markets Worker');
});

test('fail closed: disabled or malformed config renders nothing',()=>{
 assert.equal(partnerOffer(PARTNER_DISABLED,PARTNER_CTX,{variant:'footer'}),'');
 assert.equal(partnerOffer(normalizeConfig(null),PARTNER_CTX,{variant:'footer'}),'');
 assert.equal(partnerOffer(normalizeConfig({contract:'kalshi-partner/2',enabled:true,path:'https://evil.example/',program:'perpetuals'}),PARTNER_CTX,{variant:'footer'}),'');
 const html=partnerOffer(normalizeConfig({contract:'kalshi-partner/2',enabled:true,path:'/go/kalshi-perps',program:'perpetuals'}),PARTNER_CTX,{variant:'footer'});
 assert.match(html,/class="kxo kxo--footer kxo--generic"/);
 assert.match(html,/href="\/go\/kalshi-perps\?placement=sport_footer&amp;product=golf&amp;sport=golf"/);
 assert.match(html,/rel="sponsored noopener noreferrer"/);
 assert.doesNotMatch(html,/style=/,'CSP style-src self: no inline style attributes');
});

// Minimal DOM double: footer.site-footer with a .footer-bottom child.
function fakeDoc({footer=true,offer=false}={}){
 const els=new Map();const kids=[];
 const bottom={className:'footer-bottom'};
 const foot={querySelector:s=>s==='.footer-bottom'?bottom:null,insertBefore:(n,ref)=>{kids.push([n,ref]);els.set(n.id,n);},appendChild:n=>{kids.push([n,null]);els.set(n.id,n);}};
 return {kids,getElementById:id=>els.get(id)||null,querySelector:s=>s==='footer.site-footer'?(footer?foot:null):s==='.kxo'?(offer?{}:null):null,
  createElement:()=>({dataset:{},hidden:false,innerHTML:'',id:'',className:''})};
}

test('mount: slot before the footer bottom row, renders once, nothing when disabled or without a footer',async()=>{
 const on=async()=>normalizeConfig({contract:'kalshi-partner/2',enabled:true,path:'/go/kalshi-perps',program:'perpetuals'});
 const d=fakeDoc();
 assert.equal(await mountKalshiPartnerFooter(d,on),true);
 assert.equal(d.kids.length,1);assert.equal(d.kids[0][1].className,'footer-bottom');
 const slot=d.kids[0][0];assert.equal(slot.id,'golf-kxo');assert.equal(slot.className,'footer-partner');assert.equal(slot.hidden,false);
 assert.match(slot.innerHTML,/kxo--footer/);
 assert.equal(await mountKalshiPartnerFooter(d,on),false,'second call is a no-op');
 assert.equal(d.kids.length,1);
 const off=fakeDoc();assert.equal(await mountKalshiPartnerFooter(off,async()=>PARTNER_DISABLED),false);assert.equal(off.kids[0][0].hidden,true);assert.equal(off.kids[0][0].innerHTML,'');
 const boom=fakeDoc();assert.equal(await mountKalshiPartnerFooter(boom,async()=>{throw new Error('x');}),false);assert.equal(boom.kids[0][0].hidden,true);
 const dup=fakeDoc({offer:true});assert.equal(await mountKalshiPartnerFooter(dup,on),false);
 assert.equal(await mountKalshiPartnerFooter(fakeDoc({footer:false}),on),false);
});
