// Vendored PropBetEdge locale contract (pbe-locale/1.0.0, Global Issue #67). The copy in src/vendor/pbe-locale/ must stay
// byte-identical (LF-normalised) to LHBUSA/propbetedge-workers shared/pbe-locale/, pinned by MANIFEST.sha256 + VERSION.
// Re-vendor from the shared folder; never edit these files here.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';
import {PBE_LOCALE_VERSION} from '../src/vendor/pbe-locale/pbe-locale.js';
const dir=new URL('../src/vendor/pbe-locale/',import.meta.url);
const read=f=>fs.readFileSync(new URL(f,dir),'utf8');
const sha=t=>createHash('sha256').update(t.replace(/\r\n/g,'\n')).digest('hex');

test('pbe-locale vendor: every file matches MANIFEST.sha256 (LF-normalised), nothing extra or missing',()=>{
 const manifest=read('MANIFEST.sha256').trim().split(/\r?\n/).map(l=>l.trim().split(/\s+\*?/)).filter(x=>x.length===2);
 assert.deepEqual(manifest.map(([,f])=>f).sort(),['pbe-locale.css','pbe-locale.js']);
 for(const [hash,file] of manifest)assert.equal(sha(read(file)),hash,`${file} drifted from shared/pbe-locale (re-vendor; never edit in place)`);
 assert.deepEqual(fs.readdirSync(dir).sort(),['MANIFEST.sha256','VERSION','pbe-locale.css','pbe-locale.js']);
});

test('pbe-locale vendor: VERSION file and module agree on pbe-locale/1.0.0',()=>{
 assert.equal(read('VERSION').trim(),'pbe-locale/1.0.0');
 assert.equal(PBE_LOCALE_VERSION,'pbe-locale/1.0.0');
});
