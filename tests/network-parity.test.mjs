// Footer family parity: src/lib/network.js must match the vendored canonical registry src/lib/family.json
// (LHBUSA/propbetedge-workers shared/network/family.json). Predictions stays a non-sport product.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {SPORTS,PRODUCTS,NETWORK,SELF,familyFooterHtml} from '../src/lib/network.js';
import {render} from '../src/lib/render.js';
const fam=JSON.parse(fs.readFileSync('src/lib/family.json','utf8'));
const pick=a=>a.map(x=>[x.key,x.url]);
test('footer registry matches vendored family.json (sports set/order/urls, predictions, network)',()=>{
 assert.deepEqual(pick(SPORTS),pick(fam.sports));
 assert.deepEqual(pick(PRODUCTS),pick(fam.products));
 assert.deepEqual(pick(NETWORK),pick(fam.network));
 assert.equal(SPORTS.length,10);assert.ok(!SPORTS.some(s=>s.key==='predictions'));assert.ok(SPORTS.some(s=>s.key===SELF));
});
test('rendered footer: every family link once, Predictions in its own group, no retired hosts',()=>{
 const html=render('/about');const foot=html.slice(html.indexOf('<footer'),html.indexOf('</footer>'));
 assert.ok(foot.includes(familyFooterHtml()));
 const hrefs=[...foot.matchAll(/href="([^"]+)"/g)].map(m=>m[1]);
 for(const x of [...SPORTS.filter(s=>s.key!==SELF),...PRODUCTS,...NETWORK])assert.equal(hrefs.filter(h=>h===x.url).length,1,x.url);
 assert.ok(!/hub\.propbetedge\.ai|http:\/\//.test(foot));
 const sports=foot.slice(foot.indexOf('id="footer-sports"'),foot.indexOf('id="footer-intelligence"'));
 assert.ok(!sports.includes('predictions.propbetedge.ai'));
});

test('footer trust boundary: every Golf route keeps About Terms Legal Support and excludes main-site editorial people',()=>{
 const html=render('/about');const foot=html.slice(html.indexOf('<footer'),html.indexOf('</footer>'));
 for(const href of ['https://propbetedge.ai/about','https://propbetedge.ai/terms','https://propbetedge.ai/legal','https://propbetedge.ai/support'])assert.ok(foot.includes(`href="${href}"`),href);
 for(const forbidden of ['https://propbetedge.ai/media','https://propbetedge.ai/authors','https://propbetedge.ai/editorial-standards','Justin Erickson','Ty Whitney','Erik Schwartz','PropBetEdge Editorial Team'])assert.ok(!foot.includes(forbidden),forbidden);
});
