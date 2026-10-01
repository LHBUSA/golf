import { defineConfig } from 'vite';
import { render } from './src/lib/render.js';
const proxy={'/api':{target:'https://golf-api.propbetedge.ai',changeOrigin:true,rewrite:path=>path.replace(/^\/api/,'')}};
export default defineConfig({plugins:[{name:'golf-dev-shell',apply:'serve',transformIndexHtml(html,ctx){return html.replace('<!--shell-->',render(ctx.path));}}],server:{port:5173,strictPort:true,proxy},preview:{proxy},build:{target:'es2022'}});
