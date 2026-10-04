// Article Market module for golf news (contract article-market/1; propbetedge-workers
// workers/propsports-markets/docs/POST_EVENT_MARKET_RESULT.md). ONE module with a lifecycle on an article linked
// to ONE tournament edition: LIVE MARKET WATCH while the winner market trades -> THE MARKET RESULT once it is over.
//
// - Link = the article's stored canonical edition id (article.context.edition_id, written by the newsroom from the
//   projection's exact edition slug -> id). Never a title or name match.
// - Prospective only (owner 2026-10-04, NO BACKFILL): an article first published before ACTIVATED_AT never gets the
//   module. The shared API stays the authority (it refuses pre-activation published_at); this constant only saves reads.
// - published_at = the ORIGINAL first publication (first_published_at); corrections never move the market baseline.
// - Field market: focus = the article's golfers (golf-api player slugs from the article's own entity links, <= 8).
// - Server first paint (golf-api SSR, bounded) + browser refresh through the exact same-origin rewrite
//   /api/markets/v1/article-market/golf/:id (vercel.json). Never Kalshi or Polymarket from the browser.
// - Nothing eligible / nothing observed / a failed read -> nothing rendered (no placeholder, no reserved space).
import {articleMarketModule,mountArticleMarket} from '../vendor/kalshi/article-market-ui.js';

export const ARTICLE_MARKET_ACTIVATED_AT='2026-10-04T14:31:40Z';
export const ARTICLE_MARKET_REFRESH_MS=30000;
export const ARTICLE_MARKET_SSR_MS=800;
export const MARKETS_BASE='/api/markets';
const EDITION_ID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** The article's ORIGINAL first publication time. */
export const articlePublishedAt=a=>a?.first_published_at||a?.published_at||null;

/** Canonical edition id of an eligible article (first published at/after activation, linked edition), else null. */
export function articleMarketEvent(a){
 const pub=Date.parse(articlePublishedAt(a)||'');
 if(!Number.isFinite(pub)||pub<Date.parse(ARTICLE_MARKET_ACTIVATED_AT))return null;
 if(a?.status&&a.status!=='published')return null;
 const id=String(a?.context?.edition_id||'');
 return EDITION_ID_RE.test(id)?id:null;
}

/** The article's golfers as canonical golf-api player slugs (its own entity links), at most 8. */
export function articleMarketFocus(a){
 const out=[];
 for(const x of a?.entities||[]){if(x?.type!=='player')continue;const m=/^\/player\/([a-z0-9-]+)$/.exec(String(x.href||''));if(m&&!out.includes(m[1]))out.push(m[1]);if(out.length>=8)break;}
 return out;
}

export const articleMarketPath=(a,base=MARKETS_BASE)=>{
 const id=articleMarketEvent(a);if(!id)return null;const focus=articleMarketFocus(a);
 return `${base}/v1/article-market/golf/${encodeURIComponent(id)}?published_at=${encodeURIComponent(articlePublishedAt(a))}${focus.length?`&focus=${encodeURIComponent(focus.join(','))}`:''}`;
};

/** One read; eligible payload or null (never throws). fetchImpl(url) -> Response. */
export async function loadArticleMarket(a,fetchImpl=(...x)=>globalThis.fetch(...x),{base=MARKETS_BASE,timeoutMs=0}={}){
 const url=articleMarketPath(a,base);if(!url)return null;
 try{
  const p=fetchImpl(url).then(async r=>{if(!r.ok)return null;const b=await r.json();return b?.eligible&&b.packet?b:null;});
  if(!timeoutMs)return await p;
  let t;const late=new Promise(res=>{t=setTimeout(()=>res(null),timeoutMs);});
  try{return await Promise.race([p.catch(()=>null),late]);}finally{clearTimeout(t);}
 }catch{return null;}
}

/** The article's embedded (FINAL, sealed) market record as a module payload, else null. Rendered forever, never refetched. */
export function storedArticleMarket(a){
 const m=a?.market_result,id=articleMarketEvent(a);
 if(!id||!m?.packet||m.freeze!=='EMBED_THIS_PACKET'||m.packet.packet_state!=='FINAL'||m.packet.canonical_event_id!==id||m.sha256!==m.packet.sha256)return null;
 return {contract:m.contract||'article-market/1',sport:'golf',enabled:true,eligible:true,mode:m.mode||'MARKET_RESULT',freeze:m.freeze,packet:m.packet,live:m.live||{mode:'MARKET_RESULT'},stored:true};
}

/** Module HTML for a payload ('' when nothing is eligible/observed). */
export const articleMarketHtml=(payload,a)=>payload?articleMarketModule(payload,{placement:'golf-article',focus:articleMarketFocus(a)}):'';

/** Slot after the first story section. Empty (no slot at all) unless the server read produced a module.
 *  The slot carries what the browser needs to refresh it (edition id, original publication, focus golfers). */
export function articleMarketSlot(a,payload){
 const id=articleMarketEvent(a);if(!id)return '';
 const html=articleMarketHtml(payload,a);if(!html)return '';
 const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 return `<div class="story-market" data-art-market="${id}" data-published-at="${esc(articlePublishedAt(a))}" data-focus="${esc(articleMarketFocus(a).join(','))}"${payload.stored?' data-market-stored':''}>${html}</div>`;
}

/** Browser: refresh the server-painted module ~30 s while visible (a FINAL packet never refetches). */
export function mountArticleMarketSlot(root){
 const slot=root.querySelector('[data-art-market]');if(!slot||slot.hasAttribute('data-market-stored'))return ()=>{};
 const id=slot.getAttribute('data-art-market')||'',publishedAt=slot.getAttribute('data-published-at')||'';
 const focus=(slot.getAttribute('data-focus')||'').split(',').filter(Boolean);
 // Same eligibility as the server (defence in depth): never mount on a pre-activation story.
 if(!articleMarketEvent({first_published_at:publishedAt,context:{edition_id:id}}))return ()=>{};
 return mountArticleMarket(slot,{base:MARKETS_BASE,sport:'golf',eventId:id,publishedAt,focus,refreshMs:ARTICLE_MARKET_REFRESH_MS});
}
