// Build-time (Node) localization of prerendered Golf pages, pbe-locale/1.0.0. Imported only by scripts/prerender.mjs
// and tests, never by the browser bundle. Runs when the build publishes more than English (src/i18n/ready.js).
//
// It does on the server what observeLocale() does in the browser (same catalogs, same skip rules), so a localized page
// is complete before any script runs: html[lang], title, description, social tags, self-canonical, reciprocal hreflang,
// the language selector, the CJK stylesheet and every visible UI string. Japanese and Korean (acquisition) pages also
// drop every prediction-market / partner mount, link the localized network All Access page, show the monthly price in
// the reader's word order and carry the main site's legal disclosure link in the footer.
import { parse } from 'node-html-parser';
import { LOCALE_REGISTRY } from '../vendor/pbe-locale/pbe-locale.js';
import { SITE, SKIP, MARKET_MODULES, LEGAL_FOOTER, isAcquisition, localHref, literal } from './locale.js';
import { langMenuHtml, langRowHtml } from './selector.js';
import { ldJson } from '../lib/seo.js';

export const LOCALE_CSS = ['/i18n/pbe-locale.css', '/i18n/golf-locale.css'];
const NEVER = 'script, style, noscript, code, pre, textarea, [translate="no"], [data-i18n-skip], ' + SKIP;
const ATTRS = ['aria-label', 'title', 'placeholder', 'alt'];
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = s => esc(s).replace(/"/g, '&quot;');
const P = html => parse(html, { comment: true, blockTextElements: { script: true, style: true, noscript: true, pre: true } });

/** Translate a parsed subtree in place (text nodes, accessible attributes, H1-H3 html map, links to localized pages). */
export function translateTree(root, L, locale) {
  const skip = new Set(root.querySelectorAll(NEVER));
  const walk = el => {
    if (skip.has(el)) return;
    const tag = (el.rawTagName || '').toUpperCase();
    if (/^H[1-3]$/.test(tag) && el.childNodes.some(c => c.nodeType === 1)) {
      const h = L.translateHtml(el.innerHTML, locale);
      if (h !== null) { el.set_content(h); return; }
    }
    if (tag) {
      for (const a of ATTRS) { const v = el.getAttribute(a); if (v && /[A-Za-z]/.test(v)) { const t = L.translateText(v, locale); if (t !== v) el.setAttribute(a, t); } }
      if (tag === 'A' && !el.hasAttribute('data-lang-switch')) { const h = el.getAttribute('href'); const l = localHref(L, h, locale); if (l !== h) el.setAttribute('href', l); }
    }
    for (const c of el.childNodes) {
      if (c.nodeType === 1) walk(c);
      else if (c.nodeType === 3) {
        const v = c.text; if (!v.trim()) continue;
        const lit = literal(v, locale);
        const t = lit !== null ? v.replace(v.trim(), lit) : L.translateText(v, locale);
        if (t !== v) c.rawText = esc(t);
      }
    }
  };
  walk(root);
  return root;
}

const setMeta = (head, sel, attr, value) => { const m = head.querySelector(sel); if (m) m.setAttribute(attr, value); };
const headLinks = (L, path) => [
  ...LOCALE_CSS.map(href => `<link rel="stylesheet" href="${href}">`),
  ...L.alternateLinks(path).map(a => `<link rel="alternate" hreflang="${a.hreflang}" href="${escAttr(a.url)}">`),
].join('');

// Header globe (wide screens) + an inline row at the end of the mobile menu (narrow screens; golf-locale.css decides).
function addSelector(root, L, locale, path) {
  root.querySelector('.masthead-right')?.insertAdjacentHTML('afterbegin', langMenuHtml(L, locale, path));
  root.querySelector('#primary-navigation')?.insertAdjacentHTML('beforeend', langRowHtml(L, locale, path));
}

/** Japanese / Korean page rules (sports data and analysis only; see src/i18n/ready.js ACQUISITION_LOCALES). */
function acquisition(root, locale) {
  for (const el of root.querySelectorAll(MARKET_MODULES)) el.remove();
  // "月額 US$29" / "월 US$29": the period word reads before the amount (the amount itself never changes).
  const lock = root.querySelector('.aa-price-lockup'), amount = lock?.querySelector('b'), per = lock?.querySelector('em');
  if (amount && per) { per.remove(); per.set_content(locale === 'ja' ? '月額' : '월'); per.setAttribute('translate', 'no'); amount.insertAdjacentHTML('beforebegin', per.toString()); }
  const legal = LEGAL_FOOTER[locale], links = root.querySelector('footer .footer-links');
  if (legal && links) links.insertAdjacentHTML('beforeend', `<a href="${escAttr(legal.href)}" lang="${locale}">${esc(legal.label)}</a>`);
}

/** The English page in a multi-language build: + selector, hreflang alternates and the locale stylesheet. */
export function previewEnglishDocument(html, { path, L }) {
  const root = P(html);
  root.querySelector('head').insertAdjacentHTML('beforeend', headLinks(L, path));
  addSelector(root, L, 'en', path);
  return root.toString();
}

/** A complete localized document for `path` (unprefixed English path) in `locale`. */
export function localizeDocument(html, { path, locale, L }) {
  const loc = LOCALE_REGISTRY[locale];
  const root = P(html);
  const htmlEl = root.querySelector('html'), head = root.querySelector('head'), body = root.querySelector('body');
  htmlEl.setAttribute('lang', loc.htmlLang);
  htmlEl.setAttribute('data-pbe-locale', locale);
  htmlEl.setAttribute('data-pbe-path', path);
  const url = SITE + L.localizePath(path, locale);
  const tr = s => L.translateText(s, locale);
  // title, description and social tags
  const title = head.querySelector('title'); if (title) title.set_content(esc(tr(title.text)));
  for (const [sel, attr] of [['meta[name="description"]', 'content'], ['meta[property="og:title"]', 'content'], ['meta[property="og:description"]', 'content'], ['meta[name="twitter:title"]', 'content'], ['meta[name="twitter:description"]', 'content'], ['meta[property="og:image:alt"]', 'content'], ['meta[name="twitter:image:alt"]', 'content']]) {
    const m = head.querySelector(sel); if (m) m.setAttribute(attr, tr(m.getAttribute(attr) || ''));
  }
  setMeta(head, 'meta[property="og:locale"]', 'content', loc.og);
  setMeta(head, 'meta[property="og:url"]', 'content', url);
  setMeta(head, 'link[rel="canonical"]', 'href', url);
  // JSON-LD: the WebPage node describes this language version; every other node (organization, people, events) is shared.
  const ld = head.querySelector('script[type="application/ld+json"]');
  if (ld) {
    try {
      const g = JSON.parse(ld.text); const english = SITE + (path === '/' ? '/' : path);
      const page = (g['@graph'] || []).find(n => n['@id'] === english + '#webpage');
      if (page) Object.assign(page, { '@id': url + '#webpage', url, name: tr(page.name), description: tr(page.description), inLanguage: loc.hreflang });
      ld.set_content(ldJson(g));
    } catch { /* leave the English graph untouched rather than emit a broken one */ }
  }
  head.insertAdjacentHTML('beforeend', headLinks(L, path));
  addSelector(root, L, locale, path);
  if (isAcquisition(locale)) acquisition(root, locale);
  translateTree(body, L, locale);
  return root.toString();
}
