export const GA_ID='G-BRS48R8PG9';
export function initAnalytics(win=window,doc=document){
 if(win.location.hostname!=='golf.propbetedge.ai'||win.navigator.doNotTrack==='1')return false;
 win.dataLayer=win.dataLayer||[];win.gtag=win.gtag||function(){win.dataLayer.push(arguments);};
 win.gtag('js',new Date());win.gtag('set',{pbe_surface:'golf'});win.gtag('config',GA_ID,{cookie_domain:'.propbetedge.ai',cookie_flags:'SameSite=Lax;Secure'});
 const tag=doc.createElement('script');tag.async=true;tag.src='https://www.googletagmanager.com/gtag/js?id='+GA_ID;tag.dataset.pbeGa4=GA_ID;tag.crossOrigin='anonymous';doc.head.append(tag);return true;
}
