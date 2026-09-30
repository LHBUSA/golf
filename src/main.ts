const menu = document.querySelector<HTMLButtonElement>('.menu-toggle');
menu?.addEventListener('click',()=>{ const open=menu.getAttribute('aria-expanded')!=='true'; menu.setAttribute('aria-expanded',String(open)); document.querySelector('#primary-navigation')?.classList.toggle('open',open); });
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&menu?.getAttribute('aria-expanded')==='true'){menu.setAttribute('aria-expanded','false');document.querySelector('#primary-navigation')?.classList.remove('open');menu.focus();}});
document.querySelectorAll<HTMLButtonElement>('[data-tour]').forEach(button=>button.addEventListener('click',()=>{
 document.querySelectorAll('[data-tour]').forEach(b=>{ b.setAttribute('aria-pressed',String(b===button)); b.classList.toggle('selected',b===button); });
 const status=document.querySelector('.filter-description'); if(status) status.textContent=button.dataset.tour==='All tours'?'Showing all tour coverage.':'Showing '+button.dataset.tour+' coverage. Verified data is unavailable.';
}));

