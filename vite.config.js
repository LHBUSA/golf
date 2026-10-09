import { defineConfig } from 'vite';
import { render } from './src/lib/render.js';
import { i18nBuildFlag } from './src/i18n/ready.js';
// Kalshi markets (exact golf paths, same as the vercel.json rewrites) must precede the golf-api catch-all.
const MARKETS='https://propsports-markets.sales-fd3.workers.dev';
const proxy={'^/go/kalshi-perps/config$':{target:MARKETS,changeOrigin:true,rewrite:()=>'/v1/partner/kalshi'},'^/api/markets/v1/market-intelligence/(sport/golf|event/golf/[0-9a-f-]+)$':{target:MARKETS,changeOrigin:true,rewrite:path=>path.replace(/^\/api\/markets/,'')},'/api':{target:'https://golf-api.propbetedge.ai',changeOrigin:true,rewrite:path=>path.replace(/^\/api/,'')}};
export default defineConfig({plugins:[{name:'golf-dev-shell',apply:'serve',transformIndexHtml(html,ctx){return html.replace('<!--shell-->',render(ctx.path));}}],define:{__PBE_I18N__:JSON.stringify(i18nBuildFlag(process.env))},server:{port:5173,strictPort:true,proxy},preview:{proxy},build:{target:'es2022'}});
