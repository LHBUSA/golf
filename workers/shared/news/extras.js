// Article Experience V2: which packet facts the application shows as highlights / course fingerprint.
// Shared by the planner (golf-article/5 documents) and the renderer (derived from the ledger for golf-article/4).
export const HIGHLIGHT_FACTS={
 preview:['cd_under_par_rounds','cd_par5_total','cd_par3_total','cd_hardest_avg','dc_form_pct','max_gust','field_major_champion_count'],
 course_intelligence:['cd_under_par_rounds','cd_avg_winning','cd_par5_total','cd_par3_total','cd_hardest_avg','dna_editions'],
 final:['to_par','margin','total','runner_up','round_low','winner_form_pct'],
 round_recap:['lead_score','lead_margin','round_average','low_round','under_par_count'],
 notable_round:['round_strokes','round_to_par','vs_field','birdies'],
 cut:['cut_line','made_cut','missed_major_champions'],
 course_weather:['max_gust','max_rain','max_temp'],
 major_history:['editions_in_record','last_champions'],
 player_form:['recent_top10','recent_starts','form_vs_field'],
 play_suspended:['lead_score','snapshot_time'],playoff:['playoff_players','playoff_score']};
export const FINGERPRINT_FACTS=['cd_front_nine','cd_back_nine','cd_par3_avg','cd_par4_avg','cd_par5_avg','cd_long_par4_gap','cd_over_par_holes','cd_hardest','cd_easiest'];
