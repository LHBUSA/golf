import test from 'node:test';
import assert from 'node:assert/strict';
import {selectEditionVideos,pickVideos,VIDEO_MAX} from '../src/lib/video.js';

const v=(id,type,{round=null,date='2026-10-04'}={})=>({video_id:id,video_type:type,round,published_at:date,title:id,channel:'Official'});

test('edition video: one featured recap, at most three diverse supporting links, rest in archive',()=>{
 const rows=[
  v('cond-r3','full_round',{round:3}),
  v('round-r3','round_highlights',{round:3}),
  v('yamashita','player_highlights',{round:3}),
  v('jeeno','winner_highlights',{round:3}),
  v('lydia','interview'),
  v('cond-r2','full_round',{round:2,date:'2026-10-03'}),
  v('round-r2','round_highlights',{round:2,date:'2026-10-03'}),
  v('alim-r2','player_highlights',{round:2,date:'2026-10-03'})
 ];
 const out=selectEditionVideos(rows);
 assert.equal(out.featured.video_id,'cond-r3','latest-round condensed/full round is the featured fallback');
 assert.ok(out.support.length<=3);
 assert.ok(out.support.some(x=>x.video_type==='round_highlights'));
 assert.ok(out.support.some(x=>['winner_highlights','player_highlights'].includes(x.video_type)));
 assert.ok(out.support.some(x=>['interview','press_conference'].includes(x.video_type)));
 assert.equal(new Set([out.featured,...out.support,...out.archive].map(x=>x.video_id)).size,rows.length,'every source video appears exactly once across featured/support/archive');
});

test('edition video: tournament highlights outrank round recaps when available',()=>{
 const out=selectEditionVideos([
  v('round4','full_round',{round:4}),
  v('tournament','tournament_highlights',{date:'2026-10-05'})
 ]);
 assert.equal(out.featured.video_id,'tournament');
});

test('edition video: support cap is enforced',()=>{
 const out=selectEditionVideos(Array.from({length:10},(_,i)=>v('v'+i,'other',{date:'2026-10-'+String(10-i).padStart(2,'0')})),{supportMax:3});
 assert.equal(out.support.length,3);
 assert.equal(out.archive.length,6);
});

test('pickVideos: every page shows exactly three playable videos, edition recap first',()=>{
 assert.equal(VIDEO_MAX,3);
 const rows=Array.from({length:20},(_,i)=>v('o'+i,'other',{date:'2026-10-'+String(20-i).padStart(2,'0')}));
 rows.push(v('tour','tournament_highlights',{date:'2026-09-01'}));
 const ed=pickVideos(rows,{kind:'edition'});
 assert.equal(ed.length,3);assert.equal(ed[0].video_id,'tour');
 assert.equal(pickVideos(rows,{kind:'player'}).length,3);
 assert.equal(pickVideos(rows.slice(0,2),{kind:'course'}).length,2,'fewer than three: show what exists');
 assert.deepEqual(pickVideos([],{kind:'edition'}),[]);
});

test('pickVideos: player/course take one per priority group before filling',()=>{
 const rows=[v('h1','player_highlights'),v('h2','player_highlights'),v('h3','player_highlights'),v('i1','interview'),v('w1','witb')];
 const groups=[['hl',x=>/highlights/.test(x.video_type)],['int',x=>x.video_type==='interview'],['witb',x=>x.video_type==='witb']];
 assert.deepEqual(pickVideos(rows,{kind:'player',groups}).map(x=>x.video_id),['h1','i1','w1']);
});
