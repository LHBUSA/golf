// Prerender step for the locale proof (pbe-locale/1.0.0). Called once at the end of scripts/prerender.mjs.
// With an English-only ready list (every production build) it returns immediately and writes nothing: no /es/ or /ja/
// file exists, so those URLs answer 404 exactly as before, and the English pages stay byte-for-byte unchanged.
import fs from 'node:fs/promises';
import { LOCALIZED_PATHS } from './ready.js';
import { golfLocale } from './locale.js';
import { localizeDocument, previewEnglishDocument } from './document.js';

const fileOf = (dist, path) => `${dist}${path === '/' ? '/index.html' : path + '.html'}`;
const localFileOf = (dist, locale, path) => `${dist}/${locale}${path === '/' ? '/index.html' : path + '.html'}`;

/** Planned outputs for a ready list: [{file, from, locale}] (pure; used by tests and by writeLocalePages). */
export function localePlan(ready, dist = 'dist') {
  if (!Array.isArray(ready) || ready.length < 2) return [];
  return LOCALIZED_PATHS.flatMap(path => [
    { file: fileOf(dist, path), path, locale: 'en' },
    ...ready.filter(c => c !== 'en').map(locale => ({ file: localFileOf(dist, locale, path), path, locale })),
  ]);
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
