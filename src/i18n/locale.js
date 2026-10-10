// Golf's pbe-locale/1.0.0 instance. One place that binds the vendored contract to Golf's site, catalogs and the
// containers the DOM pass must never touch.
import { createLocale, LOCALE_REGISTRY } from '../vendor/pbe-locale/pbe-locale.js';
import es from './catalog/es.js';
import ja from './catalog/ja.js';
import ko from './catalog/ko.js';
import { LOCALIZED_PATHS, ACQUISITION_LOCALES } from './ready.js';

export const SITE = 'https://golf.propbetedge.ai';
export const CATALOGS = Object.freeze({ es, ja, ko });
// Protected content stays exactly as published: Kalshi market modules and the Kalshi partner offer (third-party
// commercial copy from its canonical client), player/tournament/course links (names), the language selector.
export const SKIP = '.kx-mount, [data-kalshi-edition], [data-kalshi-line], [data-kalshi-cast], .kxo, #golf-kxo, .footer-partner, .player-link, [data-player-slug], .pbe-lang, .pbe-lang-row';
// Japanese and Korean pages present Golf as sports data and analysis: every prediction-market mount and the partner
// offer slot is removed from them (build time and in the browser), never rendered empty.
export const MARKET_MODULES = '.kx-mount, [data-kalshi-edition], [data-kalshi-line], [data-kalshi-cast], .kxo, #golf-kxo, .footer-partner';
export const isAcquisition = locale => ACQUISITION_LOCALES.includes(locale);

/** The site locale object for a build's ready list (routing, hreflang, catalogs). */
export const golfLocale = (ready = ['en']) => createLocale({ ready, site: SITE, catalogs: CATALOGS, skip: SKIP });

// The network All Access page. Japanese and Korean readers go to its localized edition on the main site (tagged
// ?via=golf). Spanish keeps the English page (no public /es/pro yet) but is tagged ?lang=es&via=golf, so the /pro
// checkout carries locale=es + client_reference_id=pbe-es-pro-golf on the SAME Payment Link (Global #67, M1;
// propbetedge-news-site src/global/attribution.js). English is unchanged.
export const NETWORK_PRO = 'https://propbetedge.ai/pro';
export const ATTRIBUTED_EN_PRO_LOCALES = Object.freeze(['es']);
export const networkProUrl = locale => (isAcquisition(locale) ? `https://propbetedge.ai/${locale}/pro?via=golf`
  : ATTRIBUTED_EN_PRO_LOCALES.includes(locale) ? `${NETWORK_PRO}?lang=${locale}&via=golf` : NETWORK_PRO);
// The legal disclosure each acquisition language links in its footer (main-site pages).
export const LEGAL_FOOTER = Object.freeze({
  ja: Object.freeze({ label: '特定商取引法に基づく表記', href: 'https://propbetedge.ai/ja/legal/tokushoho' }),
  ko: Object.freeze({ label: '사업자 정보', href: 'https://propbetedge.ai/ko/legal/business' }),
});

/**
 * Link rule: only LOCALIZED_PATHS exist in other languages, so only links to them gain a prefix. Every other internal
 * link keeps its English URL (no link into a page that would 404). The network All Access link goes to the localized
 * main-site page for ja/ko.
 */
export function localHref(L, href, locale) {
  if (!href || locale === 'en') return href;
  if (href === NETWORK_PRO || href === NETWORK_PRO + '/') return networkProUrl(locale);
  if (!L.isLocalizable(href)) return href;
  const i = href.search(/[?#]/);
  const path = i < 0 ? href : href.slice(0, i);
  const clean = path === '/' ? '/' : path.replace(/\/$/, '');
  return LOCALIZED_PATHS.includes(clean) ? L.localizePath(href, locale) : href;
}

export const literal = (text, locale) => CATALOGS[locale]?.literal?.[String(text).trim()] ?? null;
export { LOCALE_REGISTRY };
