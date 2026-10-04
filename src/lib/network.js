// PropBetEdge family footer registry (Golf). Mirrors src/lib/family.json, vendored from
// LHBUSA/propbetedge-workers shared/network/family.json; tests/network-parity.test.mjs fails on drift.
// Predictions is a separate non-sport product: never add it to SPORTS.
export const SELF='golf';
export const SPORTS=Object.freeze([
 ['mlb','MLB','https://mlb.propbetedge.ai/'],['nfl','NFL','https://nfl.propbetedge.ai/'],['nba','NBA','https://nba.propbetedge.ai/'],
 ['wnba','WNBA','https://wnba.propbetedge.ai/'],['nhl','NHL','https://nhl.propbetedge.ai/'],['ufc','UFC','https://ufc.propbetedge.ai/'],
 ['tennis','Tennis','https://tennis.propbetedge.ai/'],['soccer','Soccer','https://soccer.propbetedge.ai/'],['golf','Golf','https://golf.propbetedge.ai/'],
 ['f1','F1 Intelligence','https://f1.propbetedge.ai/']].map(([key,label,url])=>Object.freeze({key,label,url})));
export const PRODUCTS=Object.freeze([Object.freeze({key:'predictions',label:'PropBetEdge Predictions',url:'https://predictions.propbetedge.ai/'})]);
export const NETWORK=Object.freeze([['hub','PropBetEdge','https://propbetedge.ai/'],['all_access','All Access','https://propbetedge.ai/pro'],['learn','Learn','https://learn.propbetedge.ai/']].map(([key,label,url])=>Object.freeze({key,label,url})));
const link=(x,self)=>`<a href="${self?'/':x.url}"${self?' aria-current="page"':''}>${x.label}</a>`;
const group=(id,title,items)=>`<div class="footer-family-group"><p class="footer-family-title" id="footer-${id}">${title}</p><ul aria-labelledby="footer-${id}">${items.map(x=>`<li>${link(x,x.key===SELF)}</li>`).join('')}</ul></div>`;
export function familyFooterHtml(){return `<nav class="footer-family" aria-label="PropBetEdge network">${group('sports','Sports',SPORTS)}${group('intelligence','Intelligence',PRODUCTS)}${group('network','Network',NETWORK)}</nav>`;}
