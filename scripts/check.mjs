import { execFileSync } from 'node:child_process'; import { readdir } from 'node:fs/promises';
async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){const p=dir+'/'+e.name;if(e.isDirectory())await walk(p);else if(/\.(mjs|js)$/.test(p))execFileSync(process.execPath,['--check',p]);}}
for(const dir of ['workers','scripts','src/lib','src/i18n','tests']) await walk(dir);
console.log('JavaScript syntax checked.');
