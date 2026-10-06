// Native PropBetEdge All Access page on golf.propbetedge.ai (owner decisions 2026-10-05).
// A real, indexable local page. Golf has no sign-in, no modal and no Golf-only checkout: membership is the
// network's (`GET /api/v1/membership`, decided server-side by golf-api), and this module only RENDERS it.
// Three link jobs, three constants: the local page, the network reference, and the canonical Stripe checkout.
// Golf has never linked to Stripe, so ALL_ACCESS_CHECKOUT_URL is not used on this site (owner rule: never
// repoint links; purchase moves only on an explicit owner decision).
import {e,kicker} from './ui.js';
import {SPORTS,PRODUCTS,SELF} from './network.js';

export const LOCAL_ALL_ACCESS_PATH='/all-access';
export const NETWORK_ALL_ACCESS_URL='https://propbetedge.ai/pro';
export const ALL_ACCESS_CHECKOUT_URL='https://buy.stripe.com/8x2eVdgmOaqy4pv8Ez7wA0N';
export const PRICE='$29/month';
export const OFFER_LINE=`${SPORTS.length} sports + Predictions + Compare`;
export const PLATINUM_TRUTH=`PropBetEdge All Access · ${OFFER_LINE}`;
const PRODUCT_COPY=Object.freeze({members:'Your membership command center across the network.',compare:'Cross-market comparison and contract intelligence.',predictions:'Independent model probabilities, market comparison and a scored record.'});

// The hero: an owner-approved Commons course photograph served from Golf's own media route, credited.
export const HERO={sha:'8c1643419f05f4c2aeec2807ebeab87e008f849486e8cd2ce9e539470eec259f',course:'Old Course at St Andrews',credit:'paul birrell / CC BY-SA 2.0 / Wikimedia Commons',source:'https://commons.wikimedia.org/wiki/File:18th_Green_and_Clubhouse.jpg'};
const media=(w,f)=>`/api/v1/media/${HERO.sha}/${w}.${f}`;

// One view per server verdict. Only golf-api decides; nothing here widens access.
//   checking   before the answer arrives
//   check      the membership call failed, timed out, or golf-api reports auth_unavailable
//   member     verification 'network' with an entitled all_access / owner membership
//   not_member a PropBetEdge session without All Access (no email is returned to Golf)
//   signed_out no PropBetEdge session
export function accessView(body,{failed=false}={}){
 if(failed||!body||!body.membership)return 'check';
 const m=body.membership,v=body.verification;
 if(v==='auth_unavailable')return 'check';
 if(v==='network'&&m.entitled===true&&m.state==='owner')return 'owner';
 if(v==='network'&&m.entitled===true&&m.state==='all_access')return 'all_access';
 if(v==='no_network_entitlement')return 'not_member';
 return 'signed_out';
}

const offerActions=()=>`<div class="aa-actions"><a class="button button-gold" href="${NETWORK_ALL_ACCESS_URL}" rel="noopener">See PropBetEdge All Access</a></div>`;
const tiles=owner=>`<ul class="aa-open" aria-label="${owner?'The full network, unlocked':'Your network, unlocked'}">${SPORTS.map(s=>s.key===SELF?`<li class="is-here"><span aria-current="page"><b>${e(s.label)}</b><em>YOU ARE HERE</em></span></li>`:`<li><a href="${e(s.url)}" rel="noopener"><b>${e(s.label)}</b><em>OPEN →</em></a></li>`).join('')}${PRODUCTS.map(p=>`<li class="is-intel"><a href="${e(p.url)}" rel="noopener"><span><b>◆ ${e(p.label)}</b><small>${e(PRODUCT_COPY[p.key]||'PropBetEdge network product.')}</small></span><em>OPEN →</em></a></li>`).join('')}</ul>`;

// The membership panel for a view. Members never see a purchase action; an outage never sells.
export function statePanel(view){
 if(view==='checking')return `<div class="aa-panel is-checking"><span class="aa-badge"><i aria-hidden="true"></i>CHECKING MEMBERSHIP</span><p>Verifying your PropBetEdge membership…</p></div>`;
 if(view==='check')return `<div class="aa-panel is-check"><span class="aa-badge"><i aria-hidden="true"></i>ACCESS CHECK</span><h2>Membership check temporarily unavailable.</h2><p>Nothing about your membership has changed. Premium golf modules stay locked until verification answers, and every public golf page keeps working.</p><div class="aa-actions"><a class="button button-gold" href="${LOCAL_ALL_ACCESS_PATH}">Retry verified access</a></div></div>`;
 if(view==='all_access')return `<div class="aa-panel is-member is-platinum"><span class="aa-badge"><i aria-hidden="true"></i>PLATINUM ACCESS ACTIVE</span><p class="aa-eyebrow">PROPBETEDGE ALL ACCESS · PLATINUM MEMBER</p><h2>Your network is unlocked.</h2><p class="aa-truth"><b class="aa-chip">◆ PLATINUM</b> ${e(PLATINUM_TRUTH)}</p>${tiles(false)}</div>`;
 if(view==='owner')return `<div class="aa-panel is-member is-owner"><span class="aa-badge"><i aria-hidden="true"></i>VERIFIED OWNER</span><p class="aa-eyebrow">PROPBETEDGE · VERIFIED OWNER</p><h2>Owner access is active.</h2><p class="aa-truth">The whole PropBetEdge network is open on this account. No subscription required.</p>${tiles(true)}</div>`;
 if(view==='not_member')return `<div class="aa-panel is-account"><span class="aa-badge"><i aria-hidden="true"></i>SIGNED IN</span><h2>Your PropBetEdge account doesn’t include All Access.</h2><p>Golf intelligence is included with PropBetEdge All Access: ${e(OFFER_LINE)}, ${PRICE}. There is no Golf-only plan.</p>${offerActions()}</div>`;
 return `<div class="aa-panel is-offer"><span class="aa-badge"><i aria-hidden="true"></i>PROPBETEDGE ALL ACCESS</span><h2>${e(OFFER_LINE)}. One membership.</h2><p>Signed in to All Access on another PropBetEdge site? Your membership is recognized here automatically.</p>${offerActions()}</div>`;
}

// Short status line for the premium-lock cards on player, course, tournament and matchup pages.
export function lockStatus(view){
 return ({checking:'Checking your PropBetEdge membership…',check:'Membership check temporarily unavailable. Nothing about your membership has changed; premium stays locked until it answers.',not_member:'Your PropBetEdge account doesn’t include All Access.',signed_out:'Included with PropBetEdge All Access. Already a member on another PropBetEdge site? It is recognized here.'})[view]||'';
}

export function allAccessPage(){
 const srcset=f=>[320,640,960].map(w=>media(w,f)+' '+w+'w').join(', ');
 const products=PRODUCTS.map(p=>`<a class="aa-product-card aa-product-${e(p.key)}" href="${e(p.url)}" rel="noopener"><span class="aa-product-kicker">ALL ACCESS PRODUCT</span><b>◆ ${e(p.label)}</b><p>${e(PRODUCT_COPY[p.key]||'PropBetEdge network product.')}</p><em>OPEN →</em></a>`).join('');
 return `<section class="aa-hero">
   <figure class="aa-photo" aria-label="${e(HERO.course)}"><picture><source type="image/avif" srcset="${srcset('avif')}" sizes="100vw"><img src="${media(960,'webp')}" srcset="${srcset('webp')}" sizes="100vw" width="960" height="720" alt="${e(HERO.course)}" fetchpriority="high" decoding="async"></picture><figcaption>${e(HERO.course)} · Photo: <a href="${e(HERO.source)}" rel="noopener">${e(HERO.credit)}</a></figcaption></figure>
   <div class="aa-hero-scrim" aria-hidden="true"></div>
   <div class="aa-copy">${kicker('PROPBETEDGE NETWORK · ALL ACCESS')}
     <div class="aa-hero-grid">
       <div class="aa-hero-main"><h1>Golf is one desk.<br><em>Your edge is the network.</em></h1><p class="aa-lede">Player DNA, Course DNA, Course Fit and field intelligence live here. All Access opens the full Golf intelligence layer plus every PropBetEdge sport and the network products you use between them.</p></div>
       <div class="aa-price-lockup"><span>ALL ACCESS</span><b>$29</b><em>/month</em><small>${e(OFFER_LINE)} · one membership</small></div>
     </div>
     <div class="aa-state" data-aa-state aria-live="polite">${statePanel('checking')}</div>
   </div>
 </section>
 <div class="page-body aa-body">
   <section class="aa-network" aria-labelledby="aa-network-h">
     ${kicker('THE PROPBETEDGE NETWORK')}
     <div class="aa-network-head"><div><h2 id="aa-network-h">${SPORTS.length} sport desks. Three network products. One membership.</h2><p>Every sport keeps its own product identity. Command Center, Compare and Predictions connect the network without being counted as sports.</p></div><a class="button button-gold" href="${NETWORK_ALL_ACCESS_URL}" rel="noopener">All Access overview →</a></div>
     <ul class="aa-sports">${SPORTS.map(s=>s.key===SELF?`<li class="is-here"><span aria-current="page"><b>${e(s.label)}</b><em>YOU ARE HERE</em></span></li>`:`<li><a href="${e(s.url)}" rel="noopener"><b>${e(s.label)}</b><em>OPEN SPORT →</em></a></li>`).join('')}</ul>
     <div class="aa-products">${products}</div>
   </section>
   <section class="aa-golf-layer"><div class="aa-golf-copy"><span class="micro-label">GOLF · PUBLIC LAYER</span><h2>Keep the sport useful before the paywall.</h2><p>Scores, records, majors, player pages, course history and public DNA fingerprints remain open discovery surfaces.</p></div><div class="aa-golf-copy is-premium"><span class="micro-label">GOLF · ALL ACCESS LAYER</span><h2>Unlock the underlying intelligence.</h2><p>Raw DNA values, cohort sizes, both analysis windows, Course Fit components, field intelligence and matchup DNA detail stay behind verified All Access.</p></div></section>
   <div class="aa-trust-row"><span>NO GOLF-ONLY PLAN</span><span>ONE NETWORK MEMBERSHIP</span><span>SERVER-VERIFIED ACCESS</span><span>${e(OFFER_LINE.toUpperCase())}</span></div>
 </div>`;
}
