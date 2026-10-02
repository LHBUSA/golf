// Deployment rule guard: golf-api renders news HTML with the site's own renderer, so SEO/article changes need a
// golf-api deploy as well as the Vercel push (docs/RELEASE.md). If this sharing changes, the rule must be revisited.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
test('deploy rule: golf-api news SSR shares the site renderer and SEO modules',()=>{
 const ssr=fs.readFileSync('workers/golf-api/src/news-ssr.js','utf8');
 for(const m of ['src/lib/render.js','src/lib/seo.js','src/lib/article.js'])assert.ok(ssr.includes(m),'news-ssr imports '+m);
 assert.match(fs.readFileSync('src/lib/seo.js','utf8'),/image-metadata\.js/,'seo.js uses the ImageObject contract');
 const rel=fs.readFileSync('docs/RELEASE.md','utf8');assert.match(rel,/fresh `golf-api` deployment/);assert.match(fs.readFileSync('AGENTS.md','utf8'),/fresh `golf-api` deploy/);});
