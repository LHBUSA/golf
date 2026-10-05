import test from 'node:test';
import assert from 'node:assert/strict';
import {selectEditionVideos} from '../src/lib/video.js';

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
