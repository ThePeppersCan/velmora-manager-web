(async function(){
  const banner=document.createElement('div');banner.id='careerStorageStatus';banner.className='career-storage-status';banner.setAttribute('role','status');document.body.appendChild(banner);
  let local;try{local=window.localStorage;}catch(_){}
  const store=window.VelmoraCareerStorage.create({indexedDB:window.indexedDB,localStorage:local,codec:window.VelmoraSaveCodec});window.VelmoraCareerStore=store;
  store.subscribe(s=>{banner.classList.toggle('has-error',!!s.error);banner.textContent=s.error?'Save failed. Open Continue Career to export your progress.':s.mode==='limited'?'Limited save storage · export regular backups':s.pending?'Saving career…':s.mode==='indexeddb'?'Career saved':'';banner.hidden=!s.pending&&!s.error&&s.mode==='indexeddb';});
  try{await store.ready;const script=document.createElement('script');script.src='app.js?v=v68-special-wardrobe';document.body.appendChild(script);}
  catch(error){banner.textContent='Career saves could not be opened. '+error.message+' Your existing saves have not been removed.';banner.hidden=false;}
  window.addEventListener('beforeunload',event=>{if(store.status().pending||store.status().unsaved){event.preventDefault();event.returnValue='';}});
})();
