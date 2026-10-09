// Shared catalog helpers for Golf (pbe-locale/1.0.0). Pure data + functions; browser and Node.
// Dates on Golf pages are rendered in English by ui.js (fmtDate: "Oct 4, 2026", ranges "Oct 1 – Oct 4, 2026").
// These patterns re-word them per language WITHOUT changing the day, month or year.
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const M = `(${MON.join('|')})`;
const mi = m => MON.indexOf(m) + 1;

/**
 * Date patterns for a language.
 * @param day   (d, m) -> "4 oct" / "10月4日"
 * @param full  (d, m, y) -> "4 oct 2026" / "2026年10月4日"
 * @param range (d1, m1, d2, m2, y) -> "1 oct – 4 oct 2026" / "2026年10月1日～10月4日"
 */
export function datePatterns({ day, full, range }) {
  return [
    [new RegExp(`^${M} (\\d{1,2}) – ${M} (\\d{1,2}), (\\d{4})$`), (m1, d1, m2, d2, y) => range(d1, mi(m1), d2, mi(m2), y)],
    [new RegExp(`^${M} (\\d{1,2}), (\\d{4})$`), (m, d, y) => full(d, mi(m), y)],
    [new RegExp(`^${M} (\\d{1,2})$`), (m, d) => day(d, mi(m))],
  ];
}

// Country names as the Golf projection writes them (English) -> the reader's language, via the platform's own
// Intl.DisplayNames (no hand-typed list, no network). Extra names cover golf's home nations and data spellings.
const EXTRA = {
  es: { England: 'Inglaterra', Scotland: 'Escocia', Wales: 'Gales', 'Northern Ireland': 'Irlanda del Norte', "People's Republic of China": 'China', 'Chinese Taipei': 'China Taipéi', 'United States': 'Estados Unidos', 'United Kingdom': 'Reino Unido', 'South Korea': 'Corea del Sur' },
  ja: { England: 'イングランド', Scotland: 'スコットランド', Wales: 'ウェールズ', 'Northern Ireland': '北アイルランド', "People's Republic of China": '中国', 'Chinese Taipei': 'チャイニーズタイペイ', 'United States': 'アメリカ', 'United Kingdom': 'イギリス', 'South Korea': '韓国' },
};
export function regionNames(locale) {
  const out = {};
  try {
    const en = new Intl.DisplayNames(['en'], { type: 'region' }), loc = new Intl.DisplayNames([locale], { type: 'region' });
    const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (const a of A) for (const b of A) {
      const code = a + b; let name, local;
      try { name = en.of(code); local = loc.of(code); } catch { continue; }
      if (name && local && name !== code && /^[A-Z][A-Za-z .,'’()&-]+$/.test(name) && !/Unknown|Region|Outlying|Pseudo/.test(name)) out[name] = local;
    }
  } catch { /* no Intl.DisplayNames: country names stay in English (source fallback) */ }
  return { ...out, ...(EXTRA[locale] || {}) };
}
