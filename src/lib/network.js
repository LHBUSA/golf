// PropBetEdge family footer registry (Golf). Mirrors src/lib/family.json, vendored from
// LHBUSA/propbetedge-workers shared/network/family.json; tests/network-parity.test.mjs fails on drift.
// All Access tools are separate non-sport products: never add them to SPORTS.
export const SELF='golf';
export const SPORTS=Object.freeze([
 ['mlb','MLB','https://mlb.propbetedge.ai/'],['nfl','NFL','https://nfl.propbetedge.ai/'],['nba','NBA','https://nba.propbetedge.ai/'],
 ['wnba','WNBA','https://wnba.propbetedge.ai/'],['nhl','NHL','https://nhl.propbetedge.ai/'],['ufc','UFC','https://ufc.propbetedge.ai/'],
 ['tennis','Tennis','https://tennis.propbetedge.ai/'],['soccer','Soccer','https://soccer.propbetedge.ai/'],['golf','Golf','https://golf.propbetedge.ai/'],
 ['f1','F1 Intelligence','https://f1.propbetedge.ai/']].map(([key,label,url])=>Object.freeze({key,label,url})));
export const PRODUCTS=Object.freeze([Object.freeze({key:'members',label:'Command Center',url:'https://members.propbetedge.ai/'}),Object.freeze({key:'compare',label:'Compare',url:'https://compare.propbetedge.ai/'}),Object.freeze({key:'predictions',label:'Predictions',url:'https://predictions.propbetedge.ai/'})]);
export const ALL_ACCESS=Object.freeze([Object.freeze({key:'all_access',label:'All Access',url:'https://propbetedge.ai/pro'}),...PRODUCTS]);
export const NETWORK=Object.freeze([['hub','PropBetEdge','https://propbetedge.ai/'],['learn','Learn','https://learn.propbetedge.ai/']].map(([key,label,url])=>Object.freeze({key,label,url})));
const link=(x,self)=>`<a href="${self?'/':x.url}"${self?' aria-current="page"':''}>${x.label}</a>`;
const group=(id,title,items)=>`<div class="footer-family-group"><p class="footer-family-title" id="footer-${id}">${title}</p><ul aria-labelledby="footer-${id}">${items.map(x=>`<li>${link(x,x.key===SELF)}</li>`).join('')}</ul></div>`;
export function familyFooterHtml(){return `<nav class="footer-family" aria-label="PropBetEdge network">${group('sports','Sports',SPORTS)}${group('all-access','All Access',ALL_ACCESS)}${group('network','Network',NETWORK)}</nav>`;}
