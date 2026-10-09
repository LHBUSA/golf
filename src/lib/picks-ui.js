// Golf Picks + Track Record (All Access). The static page carries only the method and a lock: no golfer,
// selection or probability is ever prerendered. Member values arrive from /api/v1/picks after server-side
// verification (golf-api, no-store) and render with picksMember / trackRecordMember.
import {e} from './ui.js';
const pct=p=>p===null||p===undefined?'—':(p*100>=10?Math.round(p*100):Math.round(p*1000)/10)+'%';
const fmt=t=>t?new Date(t).toISOString().replace('T',' ').slice(0,16)+' UTC':'—';
const GRADE_CLASS={WIN:'pk-win',LOSS:'pk-loss',VOID:'pk-void',PENDING:'pk-pending'};
export function picksPage(){
 return `<section class="page-heading data-heading"><div><p class="eyebrow">GOLF PICKS · RESEARCH</p><h1>Golf Picks and Track Record</h1><p>Full-field finish probabilities from one joint simulation of every round and the cut, locked before the first tee time of each PGA TOUR and LPGA event and graded after the official result.</p></div></section>
<div class="page-body data-body picks-page">
<div data-picks-preview></div>
<section class="data-section"><h2>What is locked each week</h2>
<ul class="pk-families"><li><b>Tournament winner</b> probability for every golfer in the published field</li><li><b>Top 10 and Top 20</b> selections (ties count)</li><li><b>Make the cut</b> in events with a 36-hole cut</li><li><b>Head to head</b> finish-ahead selections</li></ul>
<p class="gnote">Inputs are observed round scores from complete-field results only (missed cuts listed), adjusted for field strength and recency. Every selection is graded WIN, LOSS, VOID or PENDING in its own family and every loss stays on the record. Research forecasts, not betting advice; no sportsbook odds are used.</p></section>
<div class="premium-lock" data-premium="picks"><span class="lock-mark" aria-hidden="true">◆</span><div><h3>This week’s selections and the full track record</h3><p>Selections, probabilities, actual finishes and grades are included with PropBetEdge All Access.</p><p class="premium-status" role="status">Included with PropBetEdge All Access.</p><a class="button button-gold" href="/all-access">All Access details</a></div></div>
</div>`;
}
// Public view (from /api/v1/picks/preview): readiness of the next supported tournament and resolved results.
// Only real status facts render; when the API has nothing to say the slot is removed (no empty-state filler).
const day=d=>d?new Date(d+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'}):'';
export function readinessHtml(r){
 if(!r?.edition)return '';
 const done=r.checks.filter(c=>c.ok).length;
 return `<section class="pk-ready" aria-labelledby="pk-ready-h"><p class="eyebrow">NEXT LOCK · ${e(r.edition.tour||'')}</p><h2 id="pk-ready-h">${e(r.edition.name)}</h2>
<p class="pk-ready-meta">${e(day(r.edition.starts_on))}${r.edition.ends_on?'–'+e(day(r.edition.ends_on)):''} · <b class="${r.state==='READY'?'pk-win':'pk-pending'}">${r.state==='READY'?'READY TO LOCK':'WAITING ON SOURCE DATA'}</b> · ${done} of ${r.checks.length} checks passed</p>
<p class="pk-ready-meta">Selections lock automatically by ${e(fmt(r.expected_lock_by))} (${e(r.start_basis)}${r.first_tee?`: ${e(fmt(r.first_tee))}`:''}). Nothing locks after play begins.</p>
<ul class="pk-checks">${r.checks.map(c=>`<li class="${c.ok?'ok':'wait'}"><span aria-hidden="true">${c.ok?'✓':'…'}</span> ${e(c.label)} <small>${c.ok?'passed':'pending'}</small></li>`).join('')}</ul>
<p class="gnote">Checked ${e(fmt(r.checked_at))}. Status updates every 10 minutes.</p></section>`;
}
export function resolvedHtml(rows){
 if(!rows?.length)return '';
 return `<section class="pk-record pk-resolved"><h2>Resolved results</h2><p class="gnote">Every graded selection from locked tournaments, losses included. Research forecasts, not betting advice.</p><div class="table-wrap" tabindex="0" role="region" aria-label="Resolved results"><table class="index-table"><thead><tr><th>Event</th><th>Selection</th><th>Forecast</th><th>Actual</th><th>Result</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${e(r.edition)}</td><td>${e(r.name)} ${e(r.family==='h2h'?'ahead of '+(r.opponent||''):r.proposition)}</td><td>${pct(r.p)}</td><td>${e(r.actual||'—')}</td><td><b class="${GRADE_CLASS[r.grade]||''}">${e(r.grade)}</b></td></tr>`).join('')}</tbody></table></div></section>`;
}
export function picksPreviewHtml(p){
 if(!p)return '';
 const parts=[readinessHtml(p.readiness),resolvedHtml(p.resolved)];
 if(p.tournaments_locked)parts.push(`<p class="gnote pk-preview">${e(p.tournaments_locked)} tournament${p.tournaments_locked===1?'':'s'} locked so far · ${e(p.selections_graded)} graded selection${p.selections_graded===1?'':'s'} on the record · model ${e(p.model)} (RESEARCH)</p>`);
 return parts.join('');
}
function selectionCard(s){
 const prop=s.family==='h2h'?`${e(s.name)} to finish ahead of ${e(s.opponent?.name||'')}`:`${e(s.name)} ${e(s.proposition)}`;
 return `<li class="pk-card ${GRADE_CLASS[s.grade]||''}"><p class="pk-fam">${e(s.family_label)}</p>
<dl><div><dt>Our selection</dt><dd><a class="player-link" href="/player/${e(s.slug)}">${prop}</a></dd></div><div><dt>Forecast probability</dt><dd>${pct(s.p)}</dd></div><div><dt>Actual finish</dt><dd>${e(s.actual||'—')}</dd></div><div><dt>Result</dt><dd><b class="pk-grade">${e(s.grade)}</b> <small>${e(s.reason||'')}</small></dd></div></dl>
<p class="pk-facts">${e(s.factors?.rounds_rated)} rated rounds · rating ${e(s.factors?.rating_strokes_vs_field)} strokes vs field · round SD ${e(s.factors?.round_sd)}${s.p_tie!==undefined?` · tie chance ${pct(s.p_tie)} (VOID)`:''}</p></li>`;
}
export function picksMember(data){
 const items=data?.items||[];
 if(!items.length)return '';
 return `<h2>Golf Picks</h2><p class="gnote">${e(data.label||'RESEARCH')} · ${e(data.model)} · ${e(data.policy)}</p>`+items.map(it=>`<section class="pk-event"><p class="eyebrow">${e(it.edition.tour||'')} · ${e(it.edition.starts_on)}</p><h3><a class="text-link" href="/tournament/${e(it.edition.slug)}">${e(it.edition.name)}</a></h3>
<p class="pk-lockline">Locked ${e(fmt(it.locked_at))}${it.start_evidence?.first_tee?` · first tee ${e(fmt(it.start_evidence.first_tee))}`:''} · field ${e(it.field_size)} · ${it.cut?.applies?`cut top ${e(it.cut.rank)} and ties`:'no cut'} · ${e(it.sims)} simulations · seal ${e(String(it.lock_sha256).slice(0,12))}</p>
<ul class="pk-cards">${it.selections.map(selectionCard).join('')}</ul>
<details class="pk-probs"><summary>Win, top 10, top 20 and make-cut probabilities (top 40 by win)</summary><div class="table-wrap" tabindex="0" role="region" aria-label="Probabilities"><table class="index-table"><thead><tr><th>Golfer</th><th>Win</th><th>Top 10</th><th>Top 20</th><th>Make cut</th><th>Rated rounds</th></tr></thead><tbody>${(it.probabilities||[]).map(p=>`<tr><td>${p.slug&&!/^espn-/.test(p.slug)?`<a href="/player/${e(p.slug)}">${e(p.name)}</a>`:e(p.name)}</td><td>${pct(p.win)}</td><td>${pct(p.top10)}</td><td>${pct(p.top20)}</td><td>${p.make_cut===null?'—':pct(p.make_cut)}</td><td>${e(p.rounds_rated)}</td></tr>`).join('')}</tbody></table></div></details></section>`).join('');
}
export function trackRecordMember(rec){
 if(!rec)return '';
 const fams=(rec.families||[]).filter(f=>f.selections);
 if(!fams.length)return '';
 return `<section class="pk-record"><h2>Track record</h2><p class="gnote">Prospective locks only (locked before the first tee). Backtests never appear here. Expected wins is the sum of the forecast probabilities of graded selections.</p>
<div class="table-wrap" tabindex="0" role="region" aria-label="Track record by family"><table class="index-table"><thead><tr><th>Family</th><th>Selections</th><th>Win</th><th>Loss</th><th>Void</th><th>Pending</th><th>Hit rate</th><th>Expected wins</th><th>Brier</th></tr></thead><tbody>${fams.map(f=>`<tr><td>${e(f.label)}</td><td>${e(f.selections)}</td><td>${e(f.WIN)}</td><td>${e(f.LOSS)}</td><td>${e(f.VOID)}</td><td>${e(f.PENDING)}</td><td>${f.hit_rate===null?'—':pct(f.hit_rate)}</td><td>${e(f.expected_wins)}</td><td>${f.brier===null?'—':e(f.brier)}</td></tr>`).join('')}</tbody></table></div>
${rec.rows?.length?`<div class="table-wrap" tabindex="0" role="region" aria-label="Every graded selection"><table class="index-table"><thead><tr><th>Event</th><th>Selection</th><th>Forecast</th><th>Actual</th><th>Result</th></tr></thead><tbody>${rec.rows.map(r=>`<tr><td>${e(r.edition_name)}</td><td>${e(r.name)} ${e(r.family==='h2h'?'ahead of '+(r.opponent?.name||''):r.proposition)}</td><td>${pct(r.p)}</td><td>${e(r.actual||'—')}</td><td><b class="${GRADE_CLASS[r.grade]||''}">${e(r.grade)}</b></td></tr>`).join('')}</tbody></table></div>`:''}</section>`;
}
