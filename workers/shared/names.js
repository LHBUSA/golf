// Name-variant keys for identity CANDIDATE generation (never a merge on their own).
// Covers: diacritics (Nicolás/Nicolas), hyphenated or spaced given names (You-min/Youmin, Jin-young/Jin Young),
// surname-first source ordering (Hwang You-min / Youmin Hwang, Ko Jin-young / Jin Young Ko), apostrophes and
// periods (O'Hair, J.T.). A match still requires corroboration (exact birth date) before two records join.
export const fold=s=>String(s||'').normalize('NFKD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[’'`.]/g,'').replace(/-/g,'').replace(/[^a-z]+/g,' ').trim().replace(/\s+/g,' ');
export function nameKeys(name){
 const t=fold(name).split(' ').filter(Boolean);if(!t.length)return new Set();if(t.length===1)return new Set([t[0]]);
 const keys=new Set([[...t].sort().join(' ')]);
 // Given names split across tokens join into one, with the surname taken from either end.
 for(const [sur,rest] of [[t[0],t.slice(1)],[t.at(-1),t.slice(0,-1)]])keys.add([sur,rest.join('')].sort().join(' '));
 return keys;
}
export const sameNameFamily=(a,b)=>{const ka=nameKeys(a);for(const k of nameKeys(b))if(ka.has(k))return true;return false;};
export function keyIndex(people,nameOf=p=>p.full_name){const m=new Map();for(const p of people)for(const k of nameKeys(nameOf(p))){const a=m.get(k)||[];if(!a.includes(p))a.push(p);m.set(k,a);}return m;}
