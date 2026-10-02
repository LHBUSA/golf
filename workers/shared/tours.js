// Canonical tour registry. Every edition resolves to one tour key from evidence (ESPN league, then source
// labels, then major status); nothing is guessed: unresolved editions stay 'unassigned'.
export const TOURS=[
 {key:'pga',name:'PGA TOUR',short:'PGA TOUR',division:'men',espn:'pga',aliases:['pga tour','pga-tour']},
 {key:'lpga',name:'LPGA Tour',short:'LPGA',division:'women',espn:'lpga',aliases:['lpga tour','lpga']},
 {key:'dpwt',name:'DP World Tour',short:'DP WORLD',division:'men',espn:'eur',aliases:['dp world tour','european tour']},
 {key:'champions',name:'PGA TOUR Champions',short:'CHAMPIONS',division:'men',espn:'champions-tour',aliases:['pga tour champions','champions tour']},
 {key:'kft',name:'Korn Ferry Tour',short:'KORN FERRY',division:'men',espn:'ntw',aliases:['korn ferry tour','web.com tour','nationwide tour']},
 {key:'liv',name:'LIV Golf',short:'LIV',division:'men',espn:'liv',aliases:['liv golf','liv golf league']},
 {key:'olympic',name:'Olympic Golf',short:'OLYMPICS',division:null,espn:['mens-olympics-golf','womens-olympics-golf'],aliases:['olympics','olympic golf']},
 {key:'tgl',name:'TGL',short:'TGL',division:'men',espn:'tgl',aliases:['tgl']},
 {key:'major_men',name:'Men’s major',short:'MAJOR',division:'men',espn:null,aliases:[]},
 {key:'major_women',name:'Women’s major',short:'MAJOR',division:'women',espn:null,aliases:[]}];
const BY=new Map(TOURS.map(t=>[t.key,t]));
export const tourByKey=k=>BY.get(k)||null;
export function tourKeyOf(e){
 const lg=e?.espn?.league;if(lg){const t=TOURS.find(t=>[].concat(t.espn||[]).includes(lg));if(t)return t.key;}
 for(const label of e?.tours||[]){const l=String(label).toLowerCase().trim();const t=TOURS.find(t=>t.aliases.includes(l));if(t)return t.key;}
 if(e?.is_major)return e.division==='women'?'major_women':'major_men';
 return 'unassigned';
}
export function tourRef(e){const k=tourKeyOf(e),t=BY.get(k);return t?{key:k,name:t.name,short:t.short}:{key:'unassigned',name:null,short:null};}
