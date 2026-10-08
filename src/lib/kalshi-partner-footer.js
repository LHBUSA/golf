// Kalshi PERPETUALS partner offer (contract kalshi-partner/2) — ONE footer module per page.
// A commercial partner block in the network footer only (after the PropBetEdge family / All Access
// groups): never in PBEcast, leaderboards, tournament Market Pulse, matchups or any Kalshi market
// component, and never a model input. Copy, economics and the link all come from the vendored
// canonical client; config is read through the same-origin rewrite /go/kalshi-perps/config
// (vercel.json). Disabled / failed config renders nothing (fail closed).
// The slot is created client-side so prerendered pages and golf-api news SSR share one mount.
import {loadPartnerConfig,partnerOffer} from '../vendor/kalshi-partner/kalshi-partner.js';

export const PARTNER_CONFIG_URL='/go/kalshi-perps/config';
export const PARTNER_CTX=Object.freeze({placement:'sport_footer',product:'golf',sport:'golf'});
export const SLOT_ID='golf-kxo';

export function partnerSlot(doc=document){
 const existing=doc.getElementById(SLOT_ID);if(existing)return existing;
 const footer=doc.querySelector('footer.site-footer');if(!footer)return null;
 const slot=doc.createElement('div');slot.id=SLOT_ID;slot.className='footer-partner';slot.hidden=true;
 const bottom=footer.querySelector('.footer-bottom');
 if(bottom)footer.insertBefore(slot,bottom);else footer.appendChild(slot);
 return slot;
}

export function mountKalshiPartnerFooter(doc=document,load=loadPartnerConfig){
 const slot=partnerSlot(doc);
 if(!slot||slot.dataset.kxoMounted)return Promise.resolve(false);
 slot.dataset.kxoMounted='1';
 return Promise.resolve().then(()=>load(PARTNER_CONFIG_URL)).then(cfg=>{
  if(doc.querySelector('.kxo'))return false; // exactly one offer per page
  const html=partnerOffer(cfg,PARTNER_CTX,{variant:'footer'});
  if(!html)return false;
  slot.innerHTML=html;slot.hidden=false;return true;
 }).catch(()=>false);
}
