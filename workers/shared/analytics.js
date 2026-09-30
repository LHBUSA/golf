export function percentile(value,cohort,{tour,season,minimumSample,sampleSize,direction='higher'}={}){
 if(!tour||!season||!Number.isInteger(minimumSample)||minimumSample<1||!Number.isInteger(sampleSize)||sampleSize<minimumSample||!Number.isFinite(value)||!Array.isArray(cohort)||cohort.length<2||cohort.some(v=>!Number.isFinite(v))||!['higher','lower'].includes(direction))return {value:null,reason:'insufficient_comparable_sample'};
 const better=cohort.filter(v=>direction==='higher'?v<value:v>value).length;
 const equal=cohort.filter(v=>v===value).length;
 return {value:100*(better+equal/2)/cohort.length,tour,season,minimum_sample:minimumSample,sample_size:sampleSize,cohort_size:cohort.length,methodology:'golf-percentile/midrank-1'};
}
export function courseFitComponent({playerValue,tourPercentile,courseSignal,sample,basis,coverage,methodologyVersion}){
 if(!Number.isFinite(playerValue)||!Number.isFinite(tourPercentile)||!Number.isFinite(courseSignal)||!sample||sample.editions<3||sample.players<50||sample.rounds<100||!basis||coverage!=='comparable'||!methodologyVersion)return {available:false,reason:'validated_course_signal_required'};
 return {available:true,player_value:playerValue,tour_percentile:tourPercentile,course_signal:courseSignal,sample,basis,coverage,methodology_version:methodologyVersion,prediction:false};
}

