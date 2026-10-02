// Technical SEO: one connected JSON-LD @graph per page, canonical/robots/Open Graph/X tags, safe escaping.
import {e} from './ui.js';
import {ownedImage,licensedImage,compositeImage,imageObject} from './image-metadata.js';
export const SITE='https://golf.propbetedge.ai',PARENT='https://propbetedge.ai';
const ORG_ID=PARENT+'/#organization',DESK_ID=SITE+'/#desk',SITE_ID=SITE+'/#website';
const mediaUrl=(sha,w)=>`${SITE}/api/v1/media/${sha}/${w}.webp`;
// JSON inside <script> must never be able to close the tag.
export const ldJson=o=>JSON.stringify(o).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');
export const ogImage=(kind,slug)=>`${SITE}/og/${kind}/${encodeURIComponent(slug)}.png`;
export const ogDefault=()=>`${SITE}/og/site/default.png`;
const baseNodes=()=>[
 {'@type':'Organization','@id':ORG_ID,name:'PropBetEdge',url:PARENT+'/'},
 {'@type':'NewsMediaOrganization','@id':DESK_ID,name:'PropBetEdge Golf',url:SITE+'/',parentOrganization:{'@id':ORG_ID},publishingPrinciples:SITE+'/intelligence',logo:imageObject(ownedImage({url:SITE+'/og/site/logo.png',width:600,height:60,caption:'PropBetEdge Golf'}))},
 {'@type':'WebSite','@id':SITE_ID,url:SITE+'/',name:'PropBetEdge Golf',inLanguage:'en-US',publisher:{'@id':DESK_ID},isPartOf:{'@id':PARENT+'/#website'},potentialAction:{'@type':'SearchAction',target:{'@type':'EntryPoint',urlTemplate:SITE+'/search?q={search_term_string}'},'query-input':'required name=search_term_string'}}];
// An approved Commons photo record ({author,licence,licence_url,source_url}) as an image record. No author or licence -> held.
// Commons fills a missing author with "No machine-readable author provided. X assumed": a guess, not a recorded author.
const recordedAuthor=a=>/no machine-readable author|\bassumed\b|^unknown\b|^anonymous\b/i.test(String(a||''))?'':a;
export const photoRecord=(photo,base={})=>licensedImage({...base,author:recordedAuthor(photo?.author),license:photo?.licence,license_url:photo?.licence_url,source_page:photo?.source_url});
export function photoNode(id,photo,name){
 if(!photo?.sha256)return null;
 return imageObject(photoRecord(photo,{url:mediaUrl(photo.sha256,960),width:960,height:photo.width&&photo.height?Math.round(960*photo.height/photo.width):undefined,caption:name||undefined}),{'@id':id});
}
// What a generated /og card embeds: the approved photos workers/golf-api/src/og.js composites (sha256 + derivatives or licence).
const cardPhotos=photos=>(photos||[]).filter(p=>p?.sha256&&(p.derivatives||p.licence));
export const personNode=(p,{image}={})=>({'@type':'Person','@id':`${SITE}/player/${p.slug}#person`,name:p.name,url:`${SITE}/player/${p.slug}`,...(p.birth_date?{birthDate:p.birth_date}:{}),...(p.country?{nationality:{'@type':'Country',name:p.country}}:{}),...(p.bio?.college?{alumniOf:{'@type':'CollegeOrUniversity',name:p.bio.college}}:{}),...(p.bio?.birth_place?{birthPlace:{'@type':'Place',name:p.bio.birth_place}}:{}),...(p.wikidata_id?{sameAs:['https://www.wikidata.org/wiki/'+p.wikidata_id]}:{}),...(image?{image:{'@id':image}}:{}),knowsAbout:'Golf'});
export const courseNode=(c,{image}={})=>({'@type':'GolfCourse','@id':`${SITE}/course/${c.slug}#course`,name:c.name,url:`${SITE}/course/${c.slug}`,...(c.locality||c.country_code?{address:{'@type':'PostalAddress',...(c.locality?{addressLocality:c.locality}:{}),...(c.country_code?{addressCountry:c.country_code}:{})}}:{}),...(Number.isFinite(c.latitude)&&Number.isFinite(c.longitude)?{geo:{'@type':'GeoCoordinates',latitude:c.latitude,longitude:c.longitude}}:{}),...(c.opened_year?{foundingDate:String(c.opened_year)}:{}),...(c.wikidata_id?{sameAs:['https://www.wikidata.org/wiki/'+c.wikidata_id]}:{}),...(image?{image:{'@id':image}}:{})});
export const eventNode=d=>({'@type':'SportsEvent','@id':`${SITE}/tournament/${d.slug}#event`,name:d.name,url:`${SITE}/tournament/${d.slug}`,sport:'Golf',eventAttendanceMode:'https://schema.org/OfflineEventAttendanceMode',eventStatus:d.status==='cancelled'?'https://schema.org/EventCancelled':'https://schema.org/EventScheduled',...(d.starts_on?{startDate:d.starts_on}:{}),...(d.ends_on?{endDate:d.ends_on}:{}),...(d.course?{location:{'@id':`${SITE}/course/${d.course.slug}#course`}}:{}),...(d.tours?.length||d.espn?.tour_label?{organizer:{'@type':'SportsOrganization',name:d.espn?.tour_label||d.tours[0]}}:{})});
// Build the full document head for a route result.
export function headHtml(path,r){
 const url=SITE+(path==='/404'?'/':path),title=r.fullTitle,desc=r.description||'';
 const og=r.og||{url:ogDefault(),width:1200,height:630,alt:'PropBetEdge Golf'};
 const crumbs=r.crumbs?.length?{'@type':'BreadcrumbList','@id':url+'#breadcrumb',itemListElement:[['Golf','/'],...r.crumbs].map(([name,p],i)=>({'@type':'ListItem',position:i+1,name,item:SITE+p}))}:null;
 const page={'@type':r.pageType||'WebPage','@id':url+'#webpage',url,name:title,description:desc,isPartOf:{'@id':SITE_ID},inLanguage:'en-US',...(crumbs?{breadcrumb:{'@id':crumbs['@id']}}:{}),primaryImageOfPage:{'@id':url+'#primaryimage'},...(r.about?{about:r.about.map(id=>({'@id':id}))}:{}),...(r.mainEntity?{mainEntity:{'@id':r.mainEntity}}:{})};
 const primary=imageObject(compositeImage({url:og.url,width:og.width||1200,height:og.height||630,caption:og.alt||title,year:og.year,parts:cardPhotos(og.photos).map(ph=>photoRecord(ph))}),{'@id':url+'#primaryimage'});
 const graph={'@context':'https://schema.org','@graph':[...baseNodes(),page,primary,...(crumbs?[crumbs]:[]),...(r.nodes||[]).filter(Boolean)]};
 const art=r.article;
 return [`<link rel="canonical" href="${e(url)}">`,`<meta name="robots" content="${r.indexable?'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1':'noindex,follow'}">`,
  `<meta property="og:site_name" content="PropBetEdge Golf">`,`<meta property="og:locale" content="en_US">`,`<meta property="og:title" content="${e(r.socialTitle||title)}">`,`<meta property="og:description" content="${e(desc)}">`,`<meta property="og:type" content="${art?'article':'website'}">`,`<meta property="og:url" content="${e(url)}">`,
  `<meta property="og:image" content="${e(og.url)}">`,`<meta property="og:image:width" content="${og.width||1200}">`,`<meta property="og:image:height" content="${og.height||630}">`,`<meta property="og:image:alt" content="${e(og.alt||title)}">`,
  ...(art?[`<meta property="article:published_time" content="${e(art.published)}">`,`<meta property="article:modified_time" content="${e(art.modified)}">`,`<meta property="article:section" content="${e(art.section)}">`,...(art.tags||[]).slice(0,6).map(t=>`<meta property="article:tag" content="${e(t)}">`)]:[]),
  `<meta name="twitter:card" content="summary_large_image">`,`<meta name="twitter:site" content="@PROPBETEDGE">`,`<meta name="twitter:title" content="${e(r.socialTitle||title)}">`,`<meta name="twitter:description" content="${e(desc)}">`,`<meta name="twitter:image" content="${e(og.url)}">`,`<meta name="twitter:image:alt" content="${e(og.alt||title)}">`,
  ...(r.feed?[`<link rel="alternate" type="application/rss+xml" title="PropBetEdge Golf news" href="${SITE}/feed.xml">`]:[]),
  `<script type="application/ld+json">${ldJson(graph)}</script>`].join('');
}
// The whole HTML document from the built template (prerender and Worker SSR share this).
export function documentHtml(template,path,r,shellHtml){
 return template.replace('<!--shell-->',shellHtml).replace(/<title>.*?<\/title>/,`<title>${e(r.fullTitle)}</title>`).replace(/<meta name="description"[^>]*>/,`<meta name="description" content="${e(r.description)}">`).replace(/<meta name="robots"[^>]*>/,'').replace('</head>',headHtml(path,r)+'</head>');
}
export const fullTitle=(path,title)=>path==='/'?'Golf Intelligence | PropBetEdge':title.length>48?title:title+' | PropBetEdge Golf';
