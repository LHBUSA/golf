// 1200x630 social cards as SVG (rendered to PNG by og.js). Pure functions: tested without a renderer.
// Real photographs only when rights-cleared (approved derivatives); otherwise original branded art.
export const W=1200,H=630,CARD_VERSION='golf-og/2';
const x=s=>String(s??'').replace(/[<>&'"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[c]));
// Greedy word wrap by estimated glyph width (fonts are fixed, so the estimate is stable).
export function wrap(text,{size,maxWidth,maxLines,factor=.55}){
 const words=String(text||'').split(/\s+/).filter(Boolean),cap=Math.max(4,Math.floor(maxWidth/(size*factor)));const lines=[];let cur='';
 for(const w of words){if((cur+' '+w).trim().length<=cap)cur=(cur+' '+w).trim();else{if(cur)lines.push(cur);cur=w;}}
 if(cur)lines.push(cur);
 if(lines.length>maxLines){const keep=lines.slice(0,maxLines);keep[maxLines-1]=keep[maxLines-1].replace(/\s*\S*$/,'')+'…';return keep;}
 return lines;
}
// Pick a headline size that fits in the allowed lines.
export function fit(text,{sizes,maxWidth,maxLines,factor}){for(const size of sizes){const l=wrap(text,{size,maxWidth,maxLines:99,factor});if(l.length<=maxLines)return {size,lines:l};}const size=sizes.at(-1);return {size,lines:wrap(text,{size,maxWidth,maxLines,factor})};}
const defs=`<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0d2920"/><stop offset=".6" stop-color="#09241d"/><stop offset="1" stop-color="#061510"/></linearGradient><linearGradient id="fade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#061510" stop-opacity=".96"/><stop offset=".55" stop-color="#061510" stop-opacity=".78"/><stop offset="1" stop-color="#061510" stop-opacity=".15"/></linearGradient><linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#061510" stop-opacity=".25"/><stop offset="1" stop-color="#061510" stop-opacity=".92"/></linearGradient><radialGradient id="glow" cx=".85" cy=".1" r=".9"><stop offset="0" stop-color="#1f5a45" stop-opacity=".9"/><stop offset="1" stop-color="#0d2920" stop-opacity="0"/></radialGradient></defs>`;
const brand=(y=582)=>`<rect x="0" y="540" width="1200" height="82" fill="#061510" fill-opacity=".86"/><text x="64" y="${y}" font-family="Inter" font-weight="800" font-size="22" letter-spacing="4" fill="#ffffff">PROP<tspan fill="#c8aa68">BET</tspan>EDGE<tspan fill="#c8aa68"> / </tspan>GOLF</text><text x="1136" y="${y}" font-family="Inter" font-weight="500" font-size="20" fill="#c9d3cc" text-anchor="end">golf.propbetedge.ai</text>`;
const kicker=(t,y=110,xp=64)=>`<rect x="${xp}" y="${y-26}" width="6" height="32" fill="#c8aa68"/><text x="${xp+20}" y="${y-2}" font-family="Inter" font-weight="800" font-size="22" letter-spacing="3" fill="#c8aa68">${x(String(t).toUpperCase())}</text>`;
const lines=(ls,{xp=64,y,size,family='Playfair Display',weight=700,fill='#ffffff',lh=1.12})=>ls.map((l,i)=>`<text x="${xp}" y="${y+i*size*lh}" font-family="${family}" font-weight="${weight}" font-size="${size}" fill="${fill}">${x(l)}</text>`).join('');
// Photo panel: cover-cropped with the focal point toward the upper third (faces).
const photo=(href,{px,py,pw,ph,id='p'})=>`<clipPath id="${id}"><rect x="${px}" y="${py}" width="${pw}" height="${ph}"/></clipPath><image href="${href}" x="${px}" y="${py}" width="${pw}" height="${ph}" preserveAspectRatio="xMidYMin slice" clip-path="url(#${id})"/>`;
const chips=(items,{y,xp=64})=>{let cx=xp;return items.filter(i=>i&&i[1]!==null&&i[1]!==undefined&&i[1]!=='').map(([label,value])=>{const w=Math.max(150,String(value).length*30+40,label.length*11+40);const s=`<rect x="${cx}" y="${y}" width="${w}" height="96" rx="4" fill="#ffffff12" stroke="#ffffff2e"/><text x="${cx+20}" y="${y+52}" font-family="Playfair Display" font-weight="700" font-size="44" fill="#ffffff">${x(value)}</text><text x="${cx+20}" y="${y+80}" font-family="Inter" font-weight="500" font-size="16" letter-spacing="1.5" fill="#c9d3cc">${x(label.toUpperCase())}</text>`;cx+=w+14;return s;}).join('');};
const frame=body=>`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${defs}<rect width="${W}" height="${H}" fill="url(#bg)"/><rect width="${W}" height="${H}" fill="url(#glow)"/>${body}<rect x="0" y="${H-8}" width="${W}" height="8" fill="#c8aa68"/></svg>`;
export function playerCard(p,img){
 const t=fit(p.name,{sizes:[84,72,60,50],maxWidth:img?640:1000,maxLines:2});
 return frame(`${img?photo(img,{px:760,py:0,pw:440,ph:622})+`<rect x="700" y="0" width="120" height="622" fill="url(#fade)"/>`:''}${kicker('Player DNA')}${lines(t.lines,{y:200,size:t.size})}<text x="64" y="${200+(t.lines.length-1)*t.size*1.12+52}" font-family="Inter" font-weight="500" font-size="26" fill="#d9e1db">${x([p.country,p.tour].filter(Boolean).join(' · '))}</text>${chips([['Wins',p.wins],['Majors',p.majors],['Events',p.events]],{y:Math.max(380,200+(t.lines.length-1)*t.size*1.12+86)})}${brand()}`);
}
export function courseCard(c,img){
 const t=fit(c.name,{sizes:[80,68,58,48],maxWidth:1050,maxLines:2});
 return frame(`${img?photo(img,{px:0,py:0,pw:W,ph:622,id:'c'})+`<rect width="${W}" height="622" fill="url(#shade)"/>`:''}${kicker('Course DNA',470-t.lines.length*t.size*1.12-40)}${lines(t.lines,{y:470-(t.lines.length-1)*t.size*1.12-24,size:t.size})}<text x="64" y="${505}" font-family="Inter" font-weight="500" font-size="26" fill="#e5ebe6">${x([c.locality,c.hosted?`${c.hosted} championships in our record`:null].filter(Boolean).join(' · '))}</text>${brand()}`);
}
export function tournamentCard(d,img){
 const t=fit(d.name,{sizes:[76,66,56,48],maxWidth:1060,maxLines:2});const y=455-(t.lines.length-1)*t.size*1.12-24;
 return frame(`${img?photo(img,{px:0,py:0,pw:W,ph:622,id:'t'})+`<rect width="${W}" height="622" fill="url(#shade)"/>`:''}${kicker(d.kicker,y-t.size-20)}${lines(t.lines,{y,size:t.size})}<text x="64" y="505" font-family="Inter" font-weight="500" font-size="27" fill="#e5ebe6">${x(d.subtitle)}</text>${brand()}`);
}
export function matchupCard(m,imgA,imgB){
 const half=(img,i,name)=>`${img?photo(img,{px:i?600:0,py:0,pw:600,ph:622,id:'m'+i}):`<rect x="${i?600:0}" y="0" width="600" height="622" fill="${i?'#0b2a20':'#0e3226'}"/>`}<rect x="${i?600:0}" y="300" width="600" height="322" fill="url(#shade)"/>`;
 const nm=(n,xp,anchor)=>{const t=fit(n,{sizes:[52,44,38],maxWidth:500,maxLines:2});return t.lines.map((l,k)=>`<text x="${xp}" y="${500+k*t.size*1.1-(t.lines.length-1)*t.size*1.1}" font-family="Playfair Display" font-weight="700" font-size="${t.size}" fill="#ffffff" text-anchor="${anchor}">${x(l)}</text>`).join('');};
 return frame(`${half(imgA,0)}${half(imgB,1)}<circle cx="600" cy="300" r="56" fill="#c8aa68"/><text x="600" y="316" font-family="Inter" font-weight="800" font-size="40" fill="#061510" text-anchor="middle">VS</text><text x="600" y="70" font-family="Inter" font-weight="800" font-size="22" letter-spacing="4" fill="#c8aa68" text-anchor="middle">MATCHUP DNA</text>${nm(m.a,64,'start')}${nm(m.b,1136,'end')}${brand()}`);
}
export function newsCard(a,img){
 const t=fit(a.headline,{sizes:[64,56,50,44],maxWidth:img?700:1060,maxLines:4,factor:.52});
 return frame(`${img?photo(img,{px:780,py:0,pw:420,ph:622,id:'n'})+`<rect x="720" y="0" width="120" height="622" fill="url(#fade)"/>`:''}${kicker(a.category)}${lines(t.lines,{y:200,size:t.size})}${a.meta?`<text x="64" y="${Math.min(530,200+t.lines.length*t.size*1.12+10)}" font-family="Inter" font-weight="500" font-size="22" fill="#c9d3cc">${x(a.meta)}</text>`:''}${brand()}`);
}
export function siteCard(){return frame(`${kicker('Golf intelligence',250)}${lines(['Every round, every number,','traced to the record.'],{y:340,size:64})}${brand()}`);}
export function logoCard(){return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="60" viewBox="0 0 600 60"><rect width="600" height="60" fill="#09241d"/><text x="20" y="40" font-family="Inter" font-weight="800" font-size="28" letter-spacing="4" fill="#ffffff">PROP<tspan fill="#c8aa68">BET</tspan>EDGE<tspan fill="#c8aa68"> / </tspan>GOLF</text></svg>`;}
