// Which languages a Golf BUILD publishes (pbe-locale/1.0.0, Global Issue #67, proof integration).
// Decided once at build time from the environment; the prerender and vite.config.js both read it.
//
//   Production builds (VERCEL_ENV=production) are English-only, always: no /es/ or /ja/ file is written, no
//   language selector or hreflang is added, and the browser bundle compiles the locale code out
//   (__PBE_I18N__ = false), so /es/ and /ja/ answer 404 exactly as before.
//   Vercel PREVIEW builds (VERCEL_ENV=preview) publish the proof languages (PREVIEW_LOCALES) as noindex pages.
//   Local builds publish them only when asked: PBE_PREVIEW_LOCALES=es,ja npm run build:local
//
// Promoting a language to production is an owner decision (Golf AGENTS.md) and needs its own change here.
export const PREVIEW_LOCALES = Object.freeze(['es', 'ja']);
/** The only pages localized in this proof; every other link from them goes to the English URL. */
export const LOCALIZED_PATHS = Object.freeze(['/', '/all-access']);

export function readyLocales(env = {}) {
  if (env.VERCEL_ENV === 'production') return ['en'];
  const asked = env.PBE_PREVIEW_LOCALES != null
    ? String(env.PBE_PREVIEW_LOCALES).split(',').map(s => s.trim()).filter(Boolean)
    : env.VERCEL_ENV === 'preview' ? [...PREVIEW_LOCALES] : [];
  return ['en', ...PREVIEW_LOCALES.filter(c => asked.includes(c))];
}
/** Compile-time switch for the browser bundle (vite `define`). */
export const i18nBuildFlag = (env = {}) => readyLocales(env).length > 1;
