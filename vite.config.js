import { defineConfig } from 'vite';
import { render } from './src/lib/render.js';
export default defineConfig({plugins:[{name:'golf-dev-shell',apply:'serve',transformIndexHtml(html,ctx){return html.replace('<!--shell-->',render(ctx.path));}}],server:{port:5173,strictPort:true},build:{target:'es2022'}});
