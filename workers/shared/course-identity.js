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
];
// Canonical duplicates proven to be the same physical course. The duplicate never takes geometry (and never holds the
// primary's geometry hostage); the identity merge itself is a database operation prepared in docs/evidence.
export const DUPLICATE_COURSES=[
 {slug:'st-andrews-links-old-course-ec37',duplicate_of:'old-course-at-st-andrews-q167245',evidence_id:'st-andrews-2026-10-02',merge:'docs/evidence/course-merge-st-andrews.json',
  evidence:[
   'Both records carry ESPN venue id 37 ("St Andrews Links (Old Course)", St. Andrews, Scotland, par 72)',
   'ec37 was created from the 2027 Open schedule stub (the-open-epga29-2027); the 2024 Women’s Open on Q167245 has the same ESPN venue 37',
   '2027 stub hole yardages match the 2022 Open setup on Q167245 within renovation tolerance (e.g. 376/375, 453/452, 618/614)',
   'Coordinates 1.0 km apart: ec37 is a town-centre point (56.343,-2.803); Q167245 is the course (56.3515,-2.8161)',
   'Not merged on name similarity: Siam Country Club (Pattaya Old Course) is a different course and stays separate']},
];
