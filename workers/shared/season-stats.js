// Season statistics truth rule (ESPN). ESPN's LPGA season endpoint publishes 0.0 (or null with displayValue "0")
// for statistics it does not measure on that tour — with no rank. A real player cannot average 0 yards per drive,
// 0% fairways, 0% greens, 0 putts per GIR, 0 birdies per round or a 0.0 scoring average across a season, so for these
// rate statistics an unranked zero means "not measured", never a measurement. Unmeasured is null: it renders as —,
// gets no percentile and never enters a cohort.
export const UNMEASURED_WHEN_ZERO=new Set(['scoringAverage','yardsPerDrive','driveAccuracyPct','greensInRegPct','puttsGirAvg','savePct','birdiesPerRound','holesPerEagle']);
export function cleanStat(code,value,rank=null){
 if(value===null||value===undefined||value==='')return null;
 const n=Number(value);if(!Number.isFinite(n))return null;
 if(n===0&&UNMEASURED_WHEN_ZERO.has(code)&&!(Number(rank)>0))return null;
 return n;
}
