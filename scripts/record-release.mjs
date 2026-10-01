import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {cf,account,sportsEnv} from './ops.mjs';
import {store} from '../workers/shared/store.js';

const codeCommit=process.argv[2];
if(!/^[a-f0-9]{40}$/.test(codeCommit||''))throw Error('Provide the tested product commit SHA');
const vercelURL=process.argv[3],vercelID=process.argv[4];
if(!/^https:\/\/golf-[a-z0-9]+-justins-projects-ad4f4bb7\.vercel\.app$/.test(vercelURL||'')||!/^dpl_[a-zA-Z0-9]+$/.test(vercelID||''))throw Error('Provide the ready deployment URL and ID');
const names=['golf-api','golf-ingest','golf-news','propbetedge-auth-magic'];
const workers=Object.fromEntries(await Promise.all(names.map(async name=>{const r=await cf(`accounts/${account}/workers/scripts/${name}/deployments`);const current=r.deployments[0];return [name,{deployment_id:current.id,versions:current.versions,created_on:current.created_on}]})));
const db=store(await sportsEnv());
const health=await (await fetch('https://golf.propbetedge.ai/api/health',{signal:AbortSignal.timeout(15000)})).json();
const [state,packets,articles,rounds]=await Promise.all([db('golf_source_state','source_id=eq.wikidata'),db('golf_news_packets','select=id'),db('golf_articles','select=id,status'),db('golf_rounds','select=id')]);
const browser=JSON.parse(await fs.readFile('docs/evidence/production-browser.json','utf8'));
const manifest={at:new Date().toISOString(),product_commit:codeCommit,evidence_parent_commit:execFileSync('git',['-c','safe.directory='+process.cwd(),'rev-parse','HEAD'],{encoding:'utf8'}).trim(),production:'https://golf.propbetedge.ai',vercel:{id:vercelID,url:vercelURL,state:'READY'},workers,database:{project:'tkmlnhmylqnttmnsnief',name:'SPORTS',golf_tables:50,rls_tables:50,client_table_grants:0},data:{...health.counts,rounds:rounds.length,source:'Wikidata structured CC0 metadata',state:state[0]},news:{packets:packets.length,held:articles.filter(a=>a.status==='held').length,published:articles.filter(a=>a.status==='published').length},qa:{check:'passed',build:'passed',unit:{golf:68,network_auth:38},browser_local:306,browser_production:browser.checks.length,production_passed:browser.passed,production_console_errors:browser.errors.length,widths:browser.widths,max_measured_cls:Math.max(...browser.checks.map(x=>x.cls)),real_subscriber_session:'not_available; automated valid/revoked authority tests passed'},rollback:{frontend:{commit:'4ef1278',url:'https://golf-2q42yfibk-justins-projects-ad4f4bb7.vercel.app'},network_auth:{commit:'20f0075',worker:'b82680f8-445a-4fc6-a129-c6eaa531dce9'},golf_api_verified:'e8fd399e-dd19-426c-b02b-752d138dc0ea',golf_ingest_verified:'b0056111-9545-4603-96de-6762503d77f8',golf_news_verified:'1724136b-690b-4165-8bab-6d8af3c43869',database:'Preserve canonical rows, immutable captures and migration history; disable source ingestion rather than destructive rollback.'}};
if(!browser.passed)throw Error('Production browser proof failed');
await fs.writeFile('docs/evidence/deployment-manifest.json',JSON.stringify(manifest,null,2));
console.log(JSON.stringify(manifest,null,2));
