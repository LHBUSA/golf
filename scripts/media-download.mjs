import fs from 'node:fs/promises';import sharp from 'sharp';import {safeFetch,digest} from '../workers/shared/http.js';
const sourceUrl='https://commons.wikimedia.org/wiki/File:Golf_course_sunrise_-_Panorama_(Dimitrios_Savva_and_Jarod_Guest_via_Poly_Haven).jpg';
const assetUrl='https://upload.wikimedia.org/wikipedia/commons/d/d3/Golf_course_sunrise_-_Panorama_%28Dimitrios_Savva_and_Jarod_Guest_via_Poly_Haven%29.jpg';
const capture=await safeFetch(assetUrl,{allowedHosts:['upload.wikimedia.org'],maxBytes:60*1024*1024});
const sha256=await digest(capture.bytes);await fs.mkdir('.raw/media',{recursive:true});await fs.writeFile('.raw/media/'+sha256+'.jpg',capture.bytes);
await fs.mkdir('public/media',{recursive:true});const assets=[];
for(const width of [640,1280,1920]){
 for(const format of ['webp','avif']){
 const path='public/media/golf-sunrise-'+width+'.'+format;
 await sharp(capture.bytes).resize({width}).toFormat(format,{quality:format==='avif'?52:80}).toFile(path);
 const bytes=await fs.readFile(path);assets.push({path,sha256:await digest(bytes),width,height:width/2,bytes:bytes.length});
 }}
const manifest={id:'golf-sunrise-editorial',source:'Commons / Poly Haven',source_url:sourceUrl,download_url:assetUrl,author:'Dimitrios Savva (photography), Jarod Guest (processing)',licence:'CC0-1.0',licence_url:'https://creativecommons.org/publicdomain/zero/1.0/',attribution:'Golf Course Sunrise · Dimitrios Savva / Jarod Guest / Poly Haven · CC0',entity:null,scope:'editorial_only',identity_proof:'Source identifies a real photographed golf course at sunrise. Named venue not independently verified; no player/tournament association.',rights_status:'approved',reviewed_at:'2026-09-30',captured_at:new Date().toISOString(),sha256,original_archive:'.raw/media/'+sha256+'.jpg',original_dimensions:{width:8192,height:4096},transform:'Resize/compress photographed panorama; equirectangular projection retained; no generated scene',assets};
await fs.mkdir('data/media',{recursive:true});await fs.writeFile('data/media/manifest.json',JSON.stringify(manifest,null,2));console.log(JSON.stringify({sha256,assets},null,2));
