// Which languages a Golf BUILD publishes (pbe-locale/1.0.0, Global Issue #67).
// Decided once at build time; the prerender and vite.config.js both read it.
//
//   PUBLIC_LOCALES are published by every build, production included (owner GO 2026-10-09, "OWNER GO — PROPBETEDGE
//   GLOBAL"): /es/, /ja/ and /ko/ home + All Access are indexable, self-canonical pages with reciprocal hreflang, a
//   language switch and sitemap entries; the English pages gain only the hreflang alternates and the switch.
//   PBE_LOCALES=en (or any subset) narrows a LOCAL build, e.g. to compare English output; it can never add a language
//   outside PUBLIC_LOCALES, and production ignores it.
//
// Adding a language is an owner decision (Golf AGENTS.md) and needs its own change here.
export const PUBLIC_LOCALES = Object.freeze(['es', 'ja', 'ko']);
/** Acquisition languages: sports data and analysis only — no prediction-market, sportsbook or partner modules. */
export const ACQUISITION_LOCALES = Object.freeze(['ja', 'ko']);
/** The only pages localized; every other link from them goes to the English URL. */
export const LOCALIZED_PATHS = Object.freeze(['/', '/all-access']);

export function readyLocales(env = {}) {
  if (env.VERCEL_ENV === 'production' || env.PBE_LOCALES == null) return ['en', ...PUBLIC_LOCALES];
  const asked = String(env.PBE_LOCALES).split(',').map(s => s.trim()).filter(Boolean);
  return ['en', ...PUBLIC_LOCALES.filter(c => asked.includes(c))];
}
/** Compile-time switch for the browser bundle (vite `define`). */
export const i18nBuildFlag = (env = {}) => readyLocales(env).length > 1;
