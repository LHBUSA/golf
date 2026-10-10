// Course Geo: documented identity evidence that may clear a matcher hold for exactly one OSM element.
// Each entry is a reviewed decision (owner-directed where noted). An entry never clears a different element, and
// `clears` lists the only matcher decisions it may override. OSM par never becomes setup truth through this file.
export const IDENTITY_EVIDENCE=[
 {slug:'black-desert-resort-golf-course-ec11307',evidence_id:'black-desert-2026-10-02',osm_course:'way/1180990815',
  // No canonical coordinates on our side; locate the extract at the OSM course centre.
  locate:{lat:37.1546393,lon:-113.6513218},clears:['review_no_canonical_coords'],
  decided:'2026-10-02 (owner directive: clear physical identity, keep OSM par as conflicting metadata)',
  evidence:[
   'OSM way/1180990815 name "Black Desert Golf Course", operator "Black Desert Resort", addr 250 South Weiskopf Way, Ivins, Utah 84738',
   'Black Desert Resort (first party): 18-hole championship course in Ivins, Utah — blackdesertresort.com/golf/black-desert-course',
   'PGA TOUR: Bank of Utah Championship played at Black Desert Resort, Ivins, Utah',
   'Only other golf courses inside the 2 km extract are differently named (Snow Canyon Country Club, Entrada at Snow Canyon) — no competing Black Desert identity',
   'Holes are proven inside the matched boundary with unique refs 1–18 (matcher evidence recorded per run)']},
 {slug:'hoakalei-country-club-ec11161',evidence_id:'hoakalei-2026-10-02',osm_course:'relation/11026026',
  // No canonical coordinates on our side; locate the extract at the OSM course centre (relation centroid).
  locate:{lat:21.31477,lon:-158.0346594},clears:['review_no_canonical_coords'],
  decided:'2026-10-02 (owner directive: evidence-grade review like Black Desert; OSM par stays metadata)',
  evidence:[
   'OSM relation/11026026 name "Hoakalei Country Club", golf:course=18_hole, leisure=golf_course (multipolygon, Ewa Beach, Oahu)',
   'Hoakalei Country Club (first party, hoakaleicountryclub.com): "91-1620 Keoneula Blvd, Ewa Beach, HI 96706"; "proud host of the LOTTE Championship"',
   'LPGA (lpga.com, 2022): Hoakalei Country Club hosts the LOTTE Championship; our 2026 LOTTE Championship edition names Hoakalei Country Club',
   'Within 6 km the only other OSM courses are differently named (Coral Creek, Ewa Beach Golf Club, Hawaii Prince, Kapolei, West Loch, Ewa Villages) plus one unnamed polygon (way/221300526) that contains 0 hole ways and does not overlap Hoakalei (0/25 vertices inside)',
   'Exactly 18 golf=hole ways with unique refs 1-18 lie inside the relation boundary (11 others within 2 km belong to neighbouring courses)']},
 {slug:'yokohama-country-club-ec11328',evidence_id:'yokohama-2026-10-10',osm_course:'relation/2194674',
  // No canonical coordinates on our side; locate at the Wikidata Q11542847 point (ja.wikipedia agrees). The name is
  // Japanese-only in OSM, so name scoring cannot confirm it; identity rests on the wikidata tag + hole evidence below.
  locate:{lat:35.445972,lon:139.548972},clears:['review_no_canonical_coords','review_weak_identity'],
  decided:'2026-10-10 (owner GO, golf#11: connect the verified Baycurrent Classic routing)',
  // Composite championship routing (club West + East courses in one OSM boundary, both numbered 1-18): championship hole
  // -> OSM golf=hole way. West 2 and West 3 are not used. Club refs are kept as osm_ref in the ODbL dataset.
  crosswalk:{1:'way/1441603126',2:'way/1437063187',3:'way/1441603793',4:'way/1437065629',5:'way/1441604888',6:'way/1441605695',7:'way/1437060907',8:'way/1441604882',9:'way/1437063725',
   10:'way/1436094748',11:'way/1441597932',12:'way/1441597941',13:'way/1437061094',14:'way/1441599747',15:'way/1441603118',16:'way/1437065636',17:'way/1442826044',18:'way/1442828482'},
  // 2026: the 18th tee and green were relocated (PGA TOUR, 2026-10-05). The OSM route (way/1442828482 v1, 2025-10-17)
  // predates that, so it is not drawn as the championship 18th until the mapping is updated and re-reviewed.
  withhold:{18:'setup_changed_after_mapping'},
  evidence:[
   'OSM relation/2194674 name "横浜カントリークラブ", wikidata=Q11542847, wikipedia=ja:横浜カントリークラブ; Wikidata Q11542847 P625 35.445972,139.548972 (Hodogaya-ku, Yokohama). Not Q8054619 (Yokohama Country & Athletic Club).',
   'The earlier auto candidate way/248384113 (YOKOHAMA SPORTS COMPLEX driving range) was correctly rejected (0 holes) and is not used.',
   'Inside the relation: 36 golf=hole ways = two complete 1-18 sets (western set = West course, eastern set = East course); all hole ways mapped 2025-10-12..17 (v1).',
   'Crosswalk (Golf Digest Minna, 2025-10-07, golfdigest-minna.jp/_ct/17794285): championship 1-9 = West 10-18, 10-16 = West 1 and West 4-9 (West 2/3 dropped), 17-18 = East 17-18. PGA TOUR facts & figures 2026-10-06: "combines 16 holes from the West Course and two holes from the East Course"; Power Rankings 2026-10-05: closing pair of par 4s "commissioned from the East Course", +7 yards all at the 18th.',
   'Geometry agreement with the 2026 PGA TOUR card (course-stats R2026527): all 18 mapped routes within 25% of setup yards (W16 182/182, W8 387/387, W6 336/337, W9 230/237, W13 525/536); the three par 3s fall exactly on championship 3, 7, 16.',
   'Routing coherence: green-to-next-tee 40-163 m for every consecutive pair except the clubhouse turn (9->10 220 m, 18->1 207 m) and the West->East crossover (16->17 326 m).',
   'OSM par tags differ on championship 9, 12 and 18 (club par 5s played as par 4s): metadata conflicts only; setup par/yardage come from tournament sources.']},
];
// Canonical duplicates proven to be the same physical course. The duplicate never takes geometry (and never holds the
// primary's geometry hostage); the identity merge itself is a database operation prepared in docs/evidence.
export const DUPLICATE_COURSES=[
 {slug:'st-andrews-links-old-course-ec37',duplicate_of:'old-course-at-st-andrews-q167245',evidence_id:'st-andrews-2026-10-02',merge:'docs/evidence/course-merge-st-andrews.json',
  // 2026-10-03 owner-approved merge (proven same course): applied as a projection alias, DB rows untouched; /course/<ec37> 308s.
  alias:true,
  evidence:[
   'Both records carry ESPN venue id 37 ("St Andrews Links (Old Course)", St. Andrews, Scotland, par 72)',
   'ec37 was created from the 2027 Open schedule stub (the-open-epga29-2027); the 2024 Women’s Open on Q167245 has the same ESPN venue 37',
   '2027 stub hole yardages match the 2022 Open setup on Q167245 within renovation tolerance (e.g. 376/375, 453/452, 618/614)',
   'Coordinates 1.0 km apart: ec37 is a town-centre point (56.343,-2.803); Q167245 is the course (56.3515,-2.8161)',
   'Not merged on name similarity: Siam Country Club (Pattaya Old Course) is a different course and stays separate']},
 {slug:'tpc-sawgrass-the-players-stadium-course-ec19',duplicate_of:'tpc-sawgrass-q4586108',evidence_id:'tpc-sawgrass-2026-10-03',merge:'docs/evidence/course-review-tpc-sawgrass.json',
  // 2026-10-03 owner decision: alias the ESPN Stadium Course record into the 42-edition Players history record.
  alias:true,
  evidence:[
   'Every Players Championship 1982-2023 on tpc-sawgrass-q4586108 was played on the THE PLAYERS Stadium Course; ec19 holds 2024-2027 Players editions at the same course',
   'ec19 setups (par 72, 7,256-7,352 yd) continue the Stadium Course setups on Q4586108 (par 72, 7,093-7,215 yd in 2002-2007; later lengthened)',
   'NOT merged: tpc-sawgrass-dye-s-valley-course-ec11094 (Dye\'s Valley, par 70, Q-School) and sawgrass-country-club-q7428632 (different club, 1977-81 venue)']},
];

// Human-reviewed layouts (owner lane, 2026-10-03). A person reviewed the course identity and the mapped routing; the
// championship setup publishes no hole-by-hole table, so YARDAGE IS NOT VALIDATED. This tier is never equivalent to
// auto-identity-v1 (which requires >=15 setup-length agreements) and is labelled so on every surface.
// Each entry: {slug, osm_course, evidence_id, reviewer, decided, checks:{...}, evidence:[...]} -- added only on approval.
export const HUMAN_REVIEWED_LAYOUTS=[];
