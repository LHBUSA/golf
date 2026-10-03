// Customer-facing source labels (PropBetEdge network standard: "DATA · PropSports").
// Facts supplied by an upstream collection lane are attributed to PropSports on customer surfaces;
// upstream lineage stays in ingest provenance, R2 captures, admin/debug and the Sources registry.
// Licence-required credits (Wikipedia CC BY-SA, MET Norway CC BY, OpenStreetMap ODbL, Commons per-image)
// and named publishers of linked reporting pass through unchanged.
export const DATA_BRAND='PropSports';
export const DATA_LINE='DATA · PropSports';
const UPSTREAM=/\bESPN(?:'s)?(?: Golf)?(?: core)?(?: API)?\b/gi;
export function customerSource(label){
 if(label==null)return label;
 const s=String(label).replace(UPSTREAM,DATA_BRAND);
 return s.replace(/\bPropSports(?: · PropSports)+\b/g,DATA_BRAND);
}
// A list of labels with upstream names mapped and duplicates removed (order kept).
export const customerSources=list=>[...new Set((list||[]).map(customerSource).filter(Boolean))];
