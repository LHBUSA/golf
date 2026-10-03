// Source-brand guard (PropBetEdge network standard; Golf port 2026-10-03 of the Tennis/NHL template).
// Customer-facing data attribution is "DATA · PropSports" (https://propsports.proptechusa.ai).
// Upstream providers stay in ingest provenance, R2 captures, logs, admin/debug, the Sources registry and tests.
// Unlike the Tennis/NHL template this also scans src/lib (the SSR/prerender renderers) and the public API
// serializers (golf-api, shared views/live, newsroom prose), because Golf renders from those.
// A line that IS a licence credit, image credit or named-publisher label carries `source-brand:allow (<why>)`.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SCOPE = [
  'index.html',
  'src',
  'workers/golf-api/src',
  'workers/shared/views.js',
  'workers/shared/live.js',
  'workers/shared/news/desk.js',
  'workers/shared/news/desk-pre.js',
  'workers/shared/news/desk-final.js',
  'workers/shared/news/plan.js',
  'workers/shared/news/narrative.js',
  'workers/shared/news/narrative-pre.js',
  'workers/shared/news/extras.js',
];
const EXTENSIONS = new Set(['.js', '.mjs', '.ts', '.html', '.css']);
const PROVIDERS = String.raw`(?:ESPN|PGA TOUR API|DataGolf|Data Golf|OWGR|Sportradar|SportsDataIO|The Odds API|MLB Stats API|NBA\.com|NFL\.com|NHL\.com|WNBA\.com)`;
const FORBIDDEN = [
  /\bESPN API\b/gi,
  /\bThe Odds API\b/gi,
  new RegExp(String.raw`\b(?:per|via|from|by|through) ${PROVIDERS}\b`, 'gi'),
  new RegExp(String.raw`\b(?:Data|Source|Sources|Sourced from|Powered by|Data provided by|Data from|Results data from)\s*[:·]?\s*${PROVIDERS}\b`, 'gi'),
  /\bESPN (?:update|snapshots?|athlete|season|event|scoring|core|Golf|feed|board|reports|lists|live)\b/gi,
  /(?:observed|Last|consecutive) ESPN\b/gi,
  /\(ESPN\)/g,
  /· ESPN\b/g,
  // any upstream provider inside a string literal on a customer surface
  /(['"`])[^'"`\n]*\bESPN\b[^'"`\n]*\1/g,
];

function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ''))
    .replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ''))
    .replace(/^[ \t]*\/\/.*$/gm, '');
}

function files(rel, out = []) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) return out;
  if (fs.statSync(full).isFile()) { out.push(rel); return out; }
  for (const e of fs.readdirSync(full, { withFileTypes: true })) {
    const r = rel + '/' + e.name;
    if (e.isDirectory()) files(r, out);
    else if (EXTENSIONS.has(path.extname(e.name).toLowerCase())) out.push(r);
  }
  return out;
}

// UPSTREAM_BROWSER_DEPENDENCY (network v2.2): browser-shipped code (src, index.html) must not fetch raw
// data-provider APIs; Golf's browser reads data only through same-origin /api/v1 (golf-api). Image CDNs and
// publisher links are not data hosts; a deliberate exception carries `upstream-host:allow (<why>)`.
const DATA_HOSTS = /(?<![\w-])(?:site\.api\.espn\.com|site\.web\.api\.espn\.com|sports\.core\.api\.espn\.com|core\.api\.espn\.com|now\.core\.api\.espn\.com|cdn\.espn\.com\/core|statsapi\.mlb\.com|baseballsavant\.mlb\.com\/(?:statcast|gf|leaderboard|api)|api-web\.nhle\.com|api\.nhle\.com|statsapi\.web\.nhl\.com|stats\.nba\.com|cdn\.nba\.com\/static\/json|data\.nba\.net|stats\.wnba\.com|api\.the-odds-api\.com|the-odds-api\.com\/v4|api\.openligadb\.de|api\.jolpi\.ca|ergast\.com\/api|api\.openf1\.org|ufcstats\.com|query\.wikidata\.org|www\.wikidata\.org\/w\/api|[a-z]{2,3}\.wikipedia\.org\/(?:api|w\/api)|commons\.wikimedia\.org\/w\/api|api\.met\.no|api\.weather\.gov|api\.open-meteo\.com|archive-api\.open-meteo\.com|kalshi\.com\/trade-api|api\.elections\.kalshi\.com)/i;
const BROWSER_SCOPE = ['index.html', 'src'];
function scanBrowser(root) {
  const out = [];
  for (const rel of BROWSER_SCOPE.flatMap((s) => files(s))) {
    const raw = fs.readFileSync(path.join(root, rel), 'utf8').split('\n');
    const lines = stripComments(raw.join('\n')).split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (raw[i].includes('upstream-host:allow')) continue;
      const m = lines[i].match(DATA_HOSTS);
      if (m) out.push(`UPSTREAM_BROWSER_DEPENDENCY ${rel}:${i + 1}: ${m[0]}`);
    }
  }
  return out;
}

export function scan(root = ROOT) {
  const violations = [];
  for (const rel of SCOPE.flatMap((s) => files(s))) {
    const raw = fs.readFileSync(path.join(root, rel), 'utf8').split('\n');
    const lines = stripComments(raw.join('\n')).split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (raw[i].includes('source-brand:allow')) continue;
      for (const pattern of FORBIDDEN) {
        pattern.lastIndex = 0;
        if (pattern.test(lines[i])) { violations.push(`${rel}:${i + 1}: ${lines[i].trim().slice(0, 200)}`); break; }
      }
    }
  }
  return [...new Set([...violations, ...scanBrowser(root)])];
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll('\\', '/')}` || process.argv[1]?.endsWith('guard-source-brand.mjs')) {
  const violations = scan();
  if (violations.length) {
    console.error('\nUpstream provider branding detected in consumer-facing source or public API serializers.');
    console.error('Customer-facing attribution is "DATA · PropSports" (https://propsports.proptechusa.ai).');
    console.error('Keep licence credits, image credits and named publishers; mark those lines `source-brand:allow (<why>)`.\n');
    for (const v of violations) console.error(` - ${v}`);
    process.exit(1);
  }
  console.log('PASS source-brand guard: no upstream provider branding in customer surfaces or public API serializers.');
}
