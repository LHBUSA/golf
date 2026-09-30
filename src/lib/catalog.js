export const ALL_ACCESS_URL = 'https://propbetedge.ai/pro';
export const routes = [
{path:'/',label:'Home',title:'Read the game between the shots.',description:'Players. Courses. Championships. Connected.',indexable:false},
{path:'/today',label:'Today',title:'The golf day, in focus.',description:'Tournament context across the men’s and women’s game.',empty:'Today’s tournament coverage is not available yet.'},
{path:'/live',label:'Live',title:'Follow every turning point.',description:'Live leaderboards, round context and scorecards from verified sources.',empty:'Live scoring is unavailable.'},
{path:'/tournaments',label:'Tournaments',title:'The story of every tournament.',description:'PGA TOUR at the center. LPGA, majors and the global game in view.',empty:'Tournament editions have not been added yet.'},
{path:'/players',label:'Players',title:'Beyond the leaderboard.',description:'Career history, major records and proven performance.',empty:'Verified player profiles are not available yet.'},
{path:'/courses',label:'Courses',title:'Every course has a character.',description:'Course history, evolving layouts and the details that shape competition.',empty:'Course intelligence is not available yet.'},
{path:'/rankings',label:'Rankings',title:'Perspective on every move.',description:'World rankings and tour standings, with a history behind every position.',empty:'Licensed ranking snapshots are not available yet.'},
{path:'/majors',label:'Majors',title:'The championships that define careers.',description:'Four men’s majors. Five women’s majors. One connected history.'},
{path:'/pbecast',label:'PBEcast',title:'The tournament command center.',description:'A closer view of the round, grounded in observed play.',empty:'PBEcast is waiting for verified tournament data.'},
{path:'/news',label:'News',title:'The game. With evidence.',description:'Golf reporting built on verified tournament facts.',empty:'No stories have passed the editorial desk yet.'},
{path:'/intelligence',label:'Intelligence',title:'Understand what separates the field.',description:'Player DNA, Course DNA and descriptive Course Fit. Included with All Access.'},
{path:'/all-access',label:'All Access',title:'One membership. The entire edge.',description:'Golf Intelligence is part of PropBetEdge All Access / Pro Club.'}
];
export const majors = [
['Masters Tournament','Men','masters'],['PGA Championship','Men','pga-championship'],['U.S. Open','Men','us-open'],['The Open Championship','Men','the-open'],
['Chevron Championship','Women','chevron'],['U.S. Women’s Open','Women','us-womens-open'],['Women’s PGA Championship','Women','womens-pga'],['Evian Championship','Women','evian'],['Women’s Open','Women','womens-open']
];
export const modules = [
['Player DNA','A profile built on proven performance.','Driving, approach, around the green, putting and scoring. Every comparison will identify its tour, season and sample.'],
['Course DNA','The character behind the scorecard.','Layout changes, hole difficulty and actual scoring history. Course signals require documented evidence.'],
['Course Fit','Understand the relationship.','A descriptive comparison of player strengths and a course’s historical demands. Components, coverage and reasoning stay visible.'],
['Matchup Lab','Compare with context.','A future workspace for comparable player samples. No prediction or composite score is available.']
];
export function routeFor(path) {
 const clean = path === '/' ? path : path.replace(/\/$/,'');
 const known = routes.find(r=>r.path===clean);
 if(known) return known;
 const major = majors.find(m=>'/majors/'+m[2]===clean);
 if(major) return {path:clean,label:major[0],title:major[0],description:major[1]+' major championship history.',empty:'Championship editions and results have not been added yet.',major};
 return {path:clean,label:'Not found',title:'This page is out of bounds.',description:'Return to the golf intelligence home.',empty:'The requested page could not be found.',notFound:true};
}
