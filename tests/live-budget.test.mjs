// Provider request budget: measurement only, private KV doc per UTC day.
import test from 'node:test';
import assert from 'node:assert/strict';
import {recordBudget} from '../workers/golf-ingest/src/live.js';

test('live budget: per-day, per-edition counters accumulate across ticks', async () => {
  const kv = new Map();
  const env = {STATE: {get: async (k) => kv.get(k) ?? null, put: async (k, v) => kv.set(k, v)}};
  const ev = (b) => ({edition: 'bank-of-utah-2026', mode: 'fast', requests: {total: b.total}, tape_events: 3, budget: {kinds: {status: 1, competitors: 1, golfer_status: b.gs, linescores: b.ls}, errors: b.err, http_429: b.r429, busy_5xx: 0, golfers: 120, read: b.gs, skipped: 120 - b.gs, useful_reads: b.useful, no_change_reads: b.gs - b.useful, cards_changed: b.cc, active_on_course: 60}});
  const now = new Date('2026-10-03T19:00:00Z');
  await recordBudget(env, now, {mode: 'fast', events: [ev({total: 40, gs: 30, ls: 8, err: 1, r429: 0, useful: 12, cc: 6})]}, 900);
  await recordBudget(env, new Date('2026-10-03T19:01:00Z'), {mode: 'full', events: [ev({total: 242, gs: 120, ls: 120, err: 0, r429: 1, useful: 20, cc: 10})]}, 4000);
  const d = JSON.parse(kv.get('live:budget:2026-10-03'));
  assert.deepEqual(d.ticks, {fast: 1, full: 1});
  assert.equal(d.wall_ms, 4900);
  const e = d.editions['bank-of-utah-2026'];
  assert.equal(e.requests, 282);
  assert.equal(e.kinds.golfer_status, 150);
  assert.equal(e.kinds.linescores, 128);
  assert.equal(e.useful_reads, 32);
  assert.equal(e.no_change_reads, 118);
  assert.equal(e.errors, 1);
  assert.equal(e.http_429, 1);
  assert.equal(e.active_golfer_ticks, 120);
  assert.equal(e.tape_events, 6);
  assert.equal(e.first_at, '2026-10-03T19:00:00.000Z');
});
