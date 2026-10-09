// Prerender step for Golf's public languages (pbe-locale/1.0.0, Global Issue #67). Called by scripts/prerender.mjs.
// For every LOCALIZED_PATHS page it writes /<lang>/ versions from the English prerender and adds the hreflang
// alternates + language switch to the English page (its content is otherwise unchanged). An English-only ready list
// (PBE_LOCALES=en, local builds only) writes nothing.
import fs from 'node:fs/promises';
import { LOCALIZED_PATHS } from './ready.js';
import { golfLocale } from './locale.js';
import { localizeDocument, previewEnglishDocument } from './document.js';

const fileOf = (dist, path) => `${dist}${path === '/' ? '/index.html' : path + '.html'}`;
const localFileOf = (dist, locale, path) => `${dist}/${locale}${path === '/' ? '/index.html' : path + '.html'}`;

/** Planned outputs for a ready list: [{file, path, locale}] (pure; used by tests and by writeLocalePages). */
export function localePlan(ready, dist = 'dist') {
  if (!Array.isArray(ready) || ready.length < 2) return [];
  return LOCALIZED_PATHS.flatMap(path => [
    { file: fileOf(dist, path), path, locale: 'en' },
    ...ready.filter(c => c !== 'en').map(locale => ({ file: localFileOf(dist, locale, path), path, locale })),
  ]);
}

/**
 * Sitemap additions for a ready list: the localized URL paths, and the reciprocal alternates (hreflang + x-default) of
 * any sitemap path that has language versions (English or localized), else null.
 */
export function localeSitemap(ready) {
  if (!Array.isArray(ready) || ready.length < 2) return { paths: [], alternatesOf: () => null };
  const L = golfLocale(ready);
  const byUrl = new Map();
  for (const path of LOCALIZED_PATHS) for (const code of L.READY_LOCALES) byUrl.set(L.localizePath(path, code), L.alternateLinks(path));
  return {
    paths: LOCALIZED_PATHS.flatMap(path => L.READY_LOCALES.filter(c => c !== 'en').map(c => L.localizePath(path, c))),
    alternatesOf: p => byUrl.get(p) || null,
  };
}

export async function writeLocalePages(ready, { dist = 'dist', srcRoot = 'src' } = {}) {
  const plan = localePlan(ready, dist);
  if (!plan.length) return [];
  const L = golfLocale(ready);
  const english = new Map();
  for (const path of LOCALIZED_PATHS) english.set(path, await fs.readFile(fileOf(dist, path), 'utf8'));
  for (const p of plan) {
    const html = english.get(p.path);
    const out = p.locale === 'en' ? previewEnglishDocument(html, { path: p.path, L }) : localizeDocument(html, { path: p.path, locale: p.locale, L });
    await fs.mkdir(p.file.slice(0, p.file.lastIndexOf('/')), { recursive: true });
    await fs.writeFile(p.file, out);
  }
  await fs.mkdir(`${dist}/i18n`, { recursive: true });
  await fs.copyFile(`${srcRoot}/vendor/pbe-locale/pbe-locale.css`, `${dist}/i18n/pbe-locale.css`);
  await fs.copyFile(`${srcRoot}/i18n/golf-locale.css`, `${dist}/i18n/golf-locale.css`);
  return plan.map(p => p.file);
}
