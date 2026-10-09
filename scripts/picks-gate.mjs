// Read-only Golf Picks gate check (owner, 2026-10-09). Prints READY / NOT_READY for the next eligible event.
// Re-enabling is a separate human step: only when this prints READY, set PICKS_ENABLED "1" in
// workers/golf-ingest/wrangler.jsonc, commit, and deploy golf-ingest (docs/PICKS_V1.md).
// Usage: node scripts/picks-gate.mjs [--health]   (admin token from GOLF_ADMIN_TOKEN_FILE or D:/Workers/secrets/golf-admin-token)
import fs from 'node:fs';
const file=process.env.GOLF_ADMIN_TOKEN_FILE||'D:/Workers/secrets/golf-admin-token';
const token=fs.readFileSync(file,'utf8').trim(),api=process.env.GOLF_API||'https://golf-api.propbetedge.ai';
const path=process.argv.includes('--health')?'/admin/picks-health':'/admin/picks-gate';
const r=await fetch(api+path,{method:'POST',headers:{authorization:'Bearer '+token}});
const body=await r.json();console.log(JSON.stringify(body,null,1));
const state=path.endsWith('gate')?body.state:body.status;console.error(`${path}: ${state}`);process.exitCode=state==='READY'||state==='PASS'?0:2;
