// Golf Desk v5 writers for preview, course intelligence and round recap. Same token contract as the finals
// writer: no number outside a fact token, every sentence conditional on its facts, every module introduced.
const S=(heading,paragraphs,module=null,em=null)=>{const ps=paragraphs.filter(Boolean);return ps.length?{heading,paragraphs:ps,...(module?{module}:{}),...(em?{em}:{})}:null;};
const join=(...xs)=>xs.filter(Boolean).join(' ');
function kit(p){
 const has=id=>p.facts.some(f=>f.id===id),ent=k=>p.entities.some(x=>x.key===k),val=id=>p.facts.find(f=>f.id===id)?.value,charts=new Set(Object.keys(p.chart_data||{}));
 const course=has('course')?(ent('c1')?'{e:c1}':'{f:course}'):null,event=ent('t1')?'the {e:t1}':'the {f:event_full}';
 const sig=new Set((p.context.signals||[]).map(s=>s.name));
 const pr=p.context.pronoun,He=pr?pr.subj[0].toUpperCase()+pr.subj.slice(1):null,his=pr?pr.poss:null;
 return {has,ent,val,charts,course,event,sig,He,his};
}
const done=(d,p)=>{d.sections=d.sections.filter(Boolean);d.seo_description=d.seo_description||d.dek;d.social_headline=d.social_headline||d.headline;
 const render=t=>String(t).replace(/\{f:([a-z0-9_]+)\}/g,(_,id)=>p.facts.find(f=>f.id===id)?.display||'').replace(/\{e:([a-z0-9]+)\}/g,(_,k)=>p.entities.find(x=>x.key===k)?.name||'');
 d.seo_title=(d.seo_titles||[]).find(t=>render(t).length<=65)||d.seo_title;delete d.seo_titles;return d;};

// Shared course paragraphs (used by preview and course intelligence).
function coursePieces(p,k){const {has,val}=k;const w=val('cd_window_type'),dm=val('cd_demand_type');
 return {
  mix:has('par')&&has('yards')?join(`{f:course} plays to {f:par} and {f:yards}${has('cd_par_mix')?', with {f:cd_par_mix}':''}.`):null,
  underpar:has('cd_under_par_rounds')?`In the full-field editions in our record, {f:cd_under_par_rounds} finished under par${has('cd_under_par_pct')?', the {f:cd_under_par_pct} among measured courses':''}.`:null,
  window:w&&has('cd_par'+w+'_avg')?`The scoring comes on the {f:cd_window_type}: the field averaged {f:cd_par${w}_avg}, worth {f:cd_par${w}_total}${has('cd_hole_year')?' in {f:cd_hole_year}':''}.`:null,
  demand:dm&&has('cd_par'+dm+'_avg')&&val('cd_par'+dm+'_avg')>val('cd_par'+w+'_avg')?(val('cd_par'+dm+'_avg')>0?`The {f:cd_demand_type} are where it pushes back: they played over par, at {f:cd_par${dm}_avg} and {f:cd_par${dm}_total}.`:`The {f:cd_demand_type} give up the least, at {f:cd_par${dm}_avg}.`):null,
  hardest:has('cd_hardest')?join('The hardest holes were {f:cd_hardest}; the toughest averaged {f:cd_hardest_avg} against par.',has('cd_over_par_holes')?(val('cd_over_par_holes')<=3?'Only {f:cd_over_par_holes} played over par on average.':'In all, {f:cd_over_par_holes} played over par on average.'):null):null,
  easiest:has('cd_easiest')?'The best chances came at {f:cd_easiest}, where the easiest averaged {f:cd_easiest_avg}.':null,
  longiron:has('cd_long_par4s')&&has('cd_long_par4_gap')?(p.context.course_signature?.long_iron||val('cd_long_par4_gap')>=0.1?'Length matters: its {f:cd_long_par4s} played {f:cd_long_par4_gap} than the shorter holes of the same par. That gap is consistent with a test of long approach play.':'Its {f:cd_long_par4s} played {f:cd_long_par4_gap} than the shorter holes of the same par.'):null,
  par3:has('cd_par3_yards')?'Its one-shot holes average {f:cd_par3_yards}.':null,
  nines:has('cd_front_nine')&&has('cd_back_nine')?'Per round, the field played the front nine in {f:cd_front_nine} and the back nine in {f:cd_back_nine} against par.':null};
}
function historyPlayers(p,k,{inField}){const {has,ent,val}=k;const out=[];
 const dm=val('cd_demand_type');const types=[has('cd_window_type')?'score on the {f:cd_window_type}':null,dm&&val('cd_par'+dm+'_avg')>0?'hold their ground on the {f:cd_demand_type}':null,p.context.course_signature?.long_iron?'handle long approach shots':null].filter(Boolean);
 const lead=types.length?`On these numbers, the course aligns with players who ${types.join(' and ')}.`:null;
 for(const key of ['ch1','ch2','ch3','ch4'])if(ent(key)&&has(key+'_record')){const dnaId=p.facts.find(f=>f.id.startsWith(key+'_dna_'))?.id;out.push(`${out.length?'':'At this course, '}{e:${key}} has {f:${key}_record}${dnaId?`, and ranks in the {f:${dnaId}} in Player DNA`:''}.`);}
  if(!out.length)return lead?[lead]:[];
 return [lead,inField?'Among players in the field, the strongest records here belong to these players.':'The strongest records here in our results belong to these players. The field for this edition has not been published yet, so they may not all be entered.',...out].filter(Boolean);
}

export function previewV5(p){const k=kit(p),{has,ent,val,charts,course,event}=k,c=coursePieces(p,k);
 const d={chart_intents:[...charts],link_intents:p.entities.map(x=>x.key),known_limits:[...p.limits],sections:[]};
 d.headline=has('defending')?'{f:defending} returns to defend the {f:event}':'What to know before the {f:event}';
 d.dek=`The {f:year} {f:event} starts {f:start_day}${course?' at {f:course}':''}.${has('cd_under_par_rounds')?' In our record, {f:cd_under_par_rounds} there finished under par.':has('field_major_champions')?' The field includes {f:field_major_champions}.':''}`;
 d.sections.push(S('',[join(`${event.replace(/^the /,'The ')} begins {f:start_day}${course?` at ${course}`:''}${has('locality')?' in {f:locality}':''}${has('tour')?' on the {f:tour}':''}.`,has('defending')?`${ent('p1')?'{e:p1}':'{f:defending}'} is the defending champion.`:null),
  has('cd_spread_pct')&&p.context.course_signature?.separation==='separates'?'Rounds there vary more than at most courses we measure: its scoring spread ranks in the {f:cd_spread_pct}.':has('cd_spread_pct')&&p.context.course_signature?.separation==='bunches'?'Rounds there vary less than at most courses we measure: its scoring spread ranks in the {f:cd_spread_pct}.':null]));
 d.sections.push(S('What the week demands',[c.mix,c.underpar,join(c.window,c.demand),join(c.hardest,c.longiron),c.par3,charts.has('hole_difficulty')?'The hole chart shows the field’s average score against par on every hole from that edition.':null],charts.has('hole_difficulty')?'hole_difficulty':null,'cd_under_par_rounds'));
 d.sections.push(S('Who fits the course',historyPlayers(p,k,{inField:p.context.field_published})));
 const form=[];if(has('defending')&&(has('dc_recent')||has('dc_form_pct')))form.push(join(has('dc_recent')?'{f:defending} enters with {f:dc_recent} as the latest starts in our record.':null,has('dc_top10')?'That is {f:dc_top10}.'.replace('That is','The run includes'):null,has('dc_form_pct')?'In Player DNA, the defending champion sits in the {f:dc_form_pct}.':null));
 for(const key of ['fm1','fm2','fm3'])if(ent(key)&&has(key+'_form_pct'))form.push(join(`{e:${key}} enters with Player DNA in the {f:${key}_form_pct}.`,has(key+'_recent')?`Latest starts: {f:${key}_recent}.`:null));
 d.sections.push(S('Form to watch',form));
 if(ent('m1'))d.sections.push(S('Key matchups',['{e:m1} is the head-to-head to open: the matchup page compares their shared events and Player DNA side by side.']));
 if(charts.has('course_dna'))d.sections.push(S('Course DNA',['The Course DNA panel sets each measured dimension of the course against the other courses in our record.'],'course_dna'));
 if(has('recent_winners')||charts.has('past_winners'))d.sections.push(S('Recent champions',[has('recent_winners')?'Recent champions in our record: {f:recent_winners}.':null,charts.has('past_winners')?'The table lists every champion we hold for this event, with winning scores.':null],charts.has('past_winners')?'past_winners':null));
 const watch=[has('max_gust')?'The strongest gust in the daytime forecast for the tournament days is {f:max_gust}.':null,charts.has('weather')?'The forecast below is issued before play and is not observed conditions.':null,has('cd_back_nine')&&has('cd_front_nine')?c.nines:null];
 d.sections.push(S('What to watch',watch,charts.has('weather')?'weather':null));
 d.seo_titles=['{f:event} preview: course demands and history','{f:event} preview','{f:event}: what to know'];d.seo_title='{f:event} preview';d.social_headline=has('defending')?'{f:defending} defends at the {f:event}':'{f:event}: what to know';
 return done(d,p);
}

export function courseV5(p){const k=kit(p),{has,ent,val,charts,course,event}=k,c=coursePieces(p,k),sg=p.context.course_signature||{};
 const d={chart_intents:[...charts],link_intents:p.entities.map(x=>x.key),known_limits:[...p.limits],sections:[]};
 d.headline='How {f:course} plays: Course DNA for the {f:event}';
 d.dek=has('cd_under_par_rounds')?'{f:cd_under_par_rounds} at {f:course} finished under par across {f:dna_editions} full-field editions. Here is where it gives and where it takes.':'Measured across {f:dna_editions} full-field editions in our record.';
 d.sections.push(S('',[join(`${course||'{f:course}'} hosts ${event}${has('start_day')?' from {f:start_day}':''}.`,has('difficulty')?`Across {f:dna_editions} full-field editions${has('cd_years')?' from {f:cd_years}':''}, the field averaged {f:difficulty} strokes to par per round${has('difficulty_pct')?', the {f:difficulty_pct} for difficulty among measured courses':''}.`:null),
  has('dna_editions')&&val('dna_editions')<=3?'A sample of {f:dna_editions} editions is limited, so these figures describe recent setups rather than a settled profile.':null,
  sg.separation==='separates'&&has('cd_spread_pct')?`${sg.difficulty==='easy'?'It gives up scores, but it still':'It'} separates the field: its scoring spread ranks in the {f:cd_spread_pct}.`:sg.separation==='bunches'&&has('cd_spread_pct')?'It bunches the field: its scoring spread ranks in the {f:cd_spread_pct}.':null]));
 d.sections.push(S('What kind of course is this?',[c.mix,c.underpar]));
 d.sections.push(S('Where it creates separation',[c.demand,c.hardest,has('cd_spread_pct')?'Spread is the standard deviation of round scores within an edition; a higher percentile means rounds here vary more than at most courses.':null]));
 d.sections.push(S('Scoring profile',[c.window,c.easiest,c.nines],null,null));
 d.sections.push(S('Hole and yardage demands',[c.longiron,c.par3,charts.has('hole_difficulty')?'The chart shows every hole’s field average against par from that edition’s published cards.':null],charts.has('hole_difficulty')?'hole_difficulty':null));
 d.sections.push(S('Player types that fit',historyPlayers(p,k,{inField:false})));
 d.sections.push(S('Historical context',[has('cd_champions')?'Champions here in our record: {f:cd_champions}.':null,has('cd_winning_range')?`Winning scores have run ${'{f:cd_winning_range}'}${has('cd_avg_winning')?', an average of {f:cd_avg_winning}':''}.`:null]));
 if(charts.has('course_dna'))d.sections.push(S('Course DNA',['The panel below sets each measured dimension against the other courses in our record, with its confidence.'],'course_dna'));
 if(charts.has('weather'))d.sections.push(S('Conditions',['The tournament-week forecast is below. It is a forecast issued before play, not observed conditions.',has('max_gust')?'The strongest daytime gust in it is {f:max_gust}.':null],'weather'));
 for(const [h,id] of [['What kind of course is this?','cd_under_par_rounds'],['Where it creates separation','cd_hardest_avg'],['Scoring profile','cd_par5_total']])for(const s of d.sections)if(s?.heading===h&&has(id))s.em=id;
 d.seo_titles=['How {f:course} plays: Course DNA','{f:course} Course DNA'];d.seo_title='{f:course} Course DNA';d.social_headline='How {f:course} plays';
 return done(d,p);
}

export function recapV5(p){const k=kit(p),{has,ent,val,charts,course,event,sig,He,his}=k;
 const multi=(val('leaders')||[]).length>1,L=ent('p1')?'{e:p1}':'{f:leaders}';
 const d={chart_intents:[...charts],link_intents:p.entities.map(x=>x.key),known_limits:[...p.limits],sections:[]};
 d.headline=`${multi?'{f:leaders} share':'{f:leaders} leads'} the {f:event} after the {f:round_word} round`;
 d.dek=`${multi?'{f:leaders} are tied':'{f:leaders} is'} at {f:lead_score}${course?' at {f:course}':''}.${has('lead_margin')?' The lead is {f:lead_margin}.':''}${has('rounds_left')?' The schedule has {f:rounds_left} left.':''}`;
 d.sections.push(S('',[join(`${multi?'{f:leaders} share the lead':L+' leads'} ${event} after the {f:round_word} round at {f:lead_score}, a total of {f:lead_total}.`,has('lead_margin')&&has('chasers')?`${(val('chasers')||[]).length>1?'{f:chasers} are':'{f:chasers} is'} {f:lead_margin} back.`:null),
  has('leader_round')?join(`{f:leaders} shot {f:leader_round}, {f:leader_round_to_par}, in the round.`,has('leader_from')?`${He||'The leader'} began the day in {f:leader_from}${has('leader_was_back')?', {f:leader_was_back} behind {f:prev_leaders}':''}.`:null):null]));
 const changed=[];
 if(sig.has('lead_changed')&&has('prev_leaders'))changed.push(join('The lead changed hands.',has('prev_leader_round')?`{f:prev_leaders} shot {f:prev_leader_round}${has('prev_leader_now')?' and is now in {f:prev_leader_now}':''}.`:`{f:prev_leaders} led entering the round.`));
 else if(sig.has('lead_held')&&has('prev_leaders'))changed.push(`${multi?'The leaders held their place':'{f:leaders} held the lead'} from the previous round.`);
 if(has('round_average'))changed.push(join('The field averaged {f:round_average} strokes for the round, with {f:under_par_count} of {f:round_field} players under par.'));
 d.sections.push(S('What changed today',changed));
 const moved=[];if(has('movers'))moved.push('The biggest climbs into the top ten: {f:movers}.');else if(has('climber'))moved.push(`{e:x1} climbed from {f:climber_from} to {f:climber_to}.`);
 if(has('made_cut'))moved.push('{f:made_cut} players are through to the weekend.');
 d.sections.push(S('Who moved',moved));
 if(has('low_round'))d.sections.push(S('Low round',[join(`The low round of the day was {f:low_round}, by ${['l1','l2'].filter(ent).map(x=>`{e:${x}}`).join(' and ')||'{f:low_round_players}'}.`,has('low_round_pos')?'It moved that player into {f:low_round_pos}.':null)],null,'low_round'));
 const mvChart=charts.has('movement')?'movement':charts.has('leaderboard')?'leaderboard':null;
 d.sections.push(S('Leaderboard movement',[mvChart==='movement'?'The movement chart plots each observed scoring snapshot during the round. Markers are observations; dotted links between them are not measured positions.':mvChart?'The leaderboard below is computed from completed round scores only.':null],mvChart));
 if(charts.has('round_progress'))d.sections.push(S('Round by round',['The chart tracks the leaders’ totals after each completed round.'],'round_progress'));
 const ctx=[];if(!multi&&(has('ldr_recent')||has('ldr_form_pct')))ctx.push(join(has('ldr_recent')?`Before this week, ${his||'the leader’s'} latest starts in our record were {f:ldr_recent}.`:null,has('ldr_top10')?`${He||'The leader'} had {f:ldr_top10}.`:null,has('ldr_form_pct')?`In Player DNA, ${He?He.toLowerCase():'the leader'} sits in the {f:ldr_form_pct}.`:null));
 if(charts.has('leader_dna')&&ctx.length)ctx.push('The full profile is below; percentiles compare players within the same tour cohort.');
 d.sections.push(S('Form context',ctx,charts.has('leader_dna')&&ctx.length?'leader_dna':null));
 d.sections.push(S('What it sets up',[has('within_three')?`${has('rounds_left')?'With {f:rounds_left} left on the schedule, ':'At the top, '}{f:within_three} of the lead.`:has('rounds_left')?'The schedule has {f:rounds_left} left.':null,'This recap describes completed rounds only; it says nothing about how the event will finish.']));
 d.seo_titles=[`{f:event} round recap: {f:leaders} ${multi?'share the lead':'leads'}`,`{f:leaders} ${multi?'share':'leads'} the {f:event}`];d.seo_title='{f:event} round recap';
 return done(d,p);
}
