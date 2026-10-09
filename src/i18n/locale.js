// Golf's pbe-locale/1.0.0 instance. One place that binds the vendored contract to Golf's site, catalogs and the
// containers the DOM pass must never touch.
import { createLocale, LOCALE_REGISTRY } from '../vendor/pbe-locale/pbe-locale.js';
import es from './catalog/es.js';
import ja from './catalog/ja.js';
import { LOCALIZED_PATHS } from './ready.js';

export const SITE = 'https://golf.propbetedge.ai';
export const CATALOGS = Object.freeze({ es, ja });
// Protected content stays exactly as published: Kalshi market modules and the Kalshi partner offer (third-party
// commercial copy from its canonical client), player/tournament/course links (names), the language selector.
export const SKIP = '.kx-mount, [data-kalshi-edition], [data-kalshi-line], [data-kalshi-cast], .kxo, #golf-kxo, .footer-partner, .player-link, [data-player-slug], .pbe-lang, .pbe-lang-row';

/** The site locale object for a build's ready list (routing, hreflang, catalogs). */
export const golfLocale = (ready = ['en']) => createLocale({ ready, site: SITE, catalogs: CATALOGS, skip: SKIP });

/**
 * Proof-only link rule: only LOCALIZED_PATHS exist in other languages, so only links to them gain a prefix.
 * Every other internal link keeps its English URL (no link into a page that would 404).
 */
export function localHref(L, href, locale) {
  if (!href || locale === 'en' || !L.isLocalizable(href)) return href;
  const i = href.search(/[?#]/);
  const path = i < 0 ? href : href.slice(0, i);
  const clean = path === '/' ? '/' : path.replace(/\/$/, '');
  return LOCALIZED_PATHS.includes(clean) ? L.localizePath(href, locale) : href;
}

export const literal = (text, locale) => CATALOGS[locale]?.literal?.[String(text).trim()] ?? null;
export { LOCALE_REGISTRY };
