// Browser side of the Golf locale proof (pbe-locale/1.0.0). Loaded only by multi-language builds: main.ts imports it
// behind the compile-time __PBE_I18N__ flag, which is false for production, so production bundles never contain it.
//
// The prerender already wrote the page in its language. This keeps what main.ts paints later (account status, the
// All Access membership panel, live hero/rails, hub refreshes, the consent banner) in the same language, using the
// vendored observeLocale() with Golf's catalogs and protected containers.
import { golfLocale, localHref } from './locale.js';

const SEL_A = 'a[href]:not([data-lang-switch])';

function mountMenu(doc) {
  const menu = doc.querySelector('[data-lang-menu]');
  if (!menu) return;
  doc.addEventListener('keydown', ev => { if (ev.key === 'Escape' && menu.open) { menu.open = false; menu.querySelector('summary')?.focus(); } });
  doc.addEventListener('click', ev => { if (menu.open && !menu.contains(ev.target)) menu.open = false; });
}

export function startLocale(doc = document) {
  mountMenu(doc);
  const locale = doc.documentElement.dataset.pbeLocale;
  if (!locale || locale === 'en') return null;
  // Translation-only instance (ready = English only): the package's own href pass then never rewrites a link, because
  // in this proof only LOCALIZED_PATHS exist in other languages. Links to those two pages are prefixed below.
  const T = golfLocale(['en']);
  const L = golfLocale(['en', locale]);
  const fixLinks = root => {
    const list = root.nodeType === 1 ? [...(root.matches?.(SEL_A) ? [root] : []), ...root.querySelectorAll(SEL_A)] : [];
    for (const a of list) { const h = a.getAttribute('href'); const l = localHref(L, h, locale); if (l !== h) a.setAttribute('href', l); }
  };
  const mo = new MutationObserver(records => { for (const r of records) for (const n of r.addedNodes) fixLinks(n); });
  mo.observe(doc.body, { childList: true, subtree: true });
  T.observeLocale(doc.body, locale);
  return { locale, T, L };
}
