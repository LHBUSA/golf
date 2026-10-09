// Language selector (pbe-locale/1.0.0; the PropBetEdge Soccer globe pattern, src/components/lang.js). A native
// <details> disclosure: it opens and closes with keyboard and touch before (or without) any script, and lists only the
// languages this build publishes. Language names are always written in their own language (translate="no").
// Choosing a language is a plain link to the same page in that language: no cookie, no storage, no redirect.
import { LOCALE_REGISTRY } from '../vendor/pbe-locale/pbe-locale.js';

const GLOBE = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M3 12h18M12 3c2.6 2.6 3.9 5.6 3.9 9s-1.3 6.4-3.9 9M12 3C9.4 5.6 8.1 8.6 8.1 12s1.3 6.4 3.9 9" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';

/** The same page in another language (path is the unprefixed English path). */
export const switchHref = (L, path, code) => L.localizePath(path, code);

export function langMenuHtml(L, locale, path) {
  const cur = LOCALE_REGISTRY[locale];
  const items = L.READY_LOCALES.map(code => {
    const l = LOCALE_REGISTRY[code];
    return `<a href="${switchHref(L, path, code)}" data-lang-switch="${code}" hreflang="${l.hreflang}" lang="${l.htmlLang}" translate="no"${code === locale ? ' aria-current="true" class="on"' : ''}><b>${l.short}</b><span>${l.native}</span></a>`;
  }).join('');
  return `<details class="pbe-lang" data-lang-menu translate="no"><summary class="pbe-lang-btn" aria-label="${cur.langLabel}: ${cur.native}">${GLOBE}<span>${cur.short}</span></summary><div class="pbe-lang-panel" role="group" aria-label="${cur.langLabel}">${items}</div></details>`;
}
