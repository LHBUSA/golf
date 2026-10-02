// Video presentation helpers shared by pages, articles and JSON-LD. Poster-first; no iframe until a click.
import {e,fmtDate} from './ui.js';
export const TYPE_LABEL={full_round:'Full round',round_highlights:'Round highlights',tournament_highlights:'Tournament highlights',player_highlights:'Player highlights',winner_highlights:'Winner highlights',shot_highlights:'Shot highlights',press_conference:'Press conference',interview:'Interview',course_flyover:'Course flyover',course_preview:'Course preview',witb:'What’s in the bag',historical:'Historical',other:'Video'};
// VideoObject only for videos actually rendered on the page (same eligibility as the UI).
export function videoNode(v,id){
 return {'@type':'VideoObject','@id':id,name:v.title,description:v.description||v.title,thumbnailUrl:[`https://i.ytimg.com/vi/${v.video_id}/hqdefault.jpg`],uploadDate:v.published_at,embedUrl:`https://www.youtube-nocookie.com/embed/${v.video_id}`,url:`https://www.youtube.com/watch?v=${v.video_id}`,...(v.duration_iso?{duration:v.duration_iso}:{}),inLanguage:v.language||'en',publisher:{'@type':'Organization',name:v.channel}};
}
export function videoTile(v,{label=null}={}){
 const poster=`https://i.ytimg.com/vi/${encodeURIComponent(v.video_id)}/hqdefault.jpg`;
 return `<div class="yt" data-yt="${e(v.video_id)}" data-yt-title="${e(v.title)}" data-yt-type="${e(v.video_type||'other')}" data-yt-channel="${e(v.channel_id||'')}"><button class="yt-poster" type="button" aria-label="Play video: ${e(v.title)}"><img src="${e(poster)}" alt="" loading="lazy" width="480" height="360"><span class="yt-play" aria-hidden="true">▶</span><span class="yt-type">${e(label||TYPE_LABEL[v.video_type]||'Video')}</span></button><p class="yt-meta"><b>${e(v.title)}</b><span>${e(v.channel||'')}${v.published_at?' · '+e(fmtDate(v.published_at.slice(0,10))):''}</span><a href="https://www.youtube.com/watch?v=${encodeURIComponent(v.video_id)}" rel="noopener" data-yt-out>Watch on YouTube</a></p></div>`;
}
export function videoRail(videos,{title='Official video',max=6}={}){
 const vs=(videos||[]).slice(0,max);if(!vs.length)return '';
 return `<div class="yt-rail yt-n${Math.min(vs.length,3)}" role="list" aria-label="${e(title)}">${vs.map(v=>`<div role="listitem">${videoTile(v)}</div>`).join('')}</div><p class="gnote">Official channels only. Videos play from YouTube (privacy-enhanced mode) after you press play.</p>`;
}
