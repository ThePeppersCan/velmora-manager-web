(async function(){
  const banner=document.createElement('div');banner.id='careerStorageStatus';banner.className='career-storage-status';banner.setAttribute('role','status');document.body.appendChild(banner);
  let local;try{local=window.localStorage;}catch(_){}
  const store=window.VelmoraCareerStorage.create({indexedDB:window.indexedDB,localStorage:local,codec:window.VelmoraSaveCodec});window.VelmoraCareerStore=store;
  store.subscribe(s=>{banner.classList.toggle('has-error',!!s.error);banner.textContent=s.error?'Save failed. Open Continue Career to export your progress.':s.mode==='limited'?'Limited save storage · export regular backups':s.pending?'Saving career…':s.mode==='indexeddb'?'Career saved':'';banner.hidden=!s.pending&&!s.error&&s.mode==='indexeddb';});
  try{
    await store.ready;
    if(window.VelmoraCloudSaves){const cloud=window.VelmoraCloudSaves.create({window,document,store,codec:window.VelmoraSaveCodec});window.VelmoraCloudSaveManager=cloud;await cloud.ready;}
    const script=document.createElement('script');const cacheKey=window.VELMORA_RELEASE?.cacheKey||'v109-story-director-20260912';script.src=`app.js?v=${encodeURIComponent(cacheKey)}`;document.body.appendChild(script);
  }
  catch(error){banner.textContent='Career saves could not be opened. '+error.message+' Your existing saves have not been removed.';banner.hidden=false;}
  window.addEventListener('beforeunload',event=>{if(store.status().pending||store.status().unsaved){event.preventDefault();event.returnValue='';}});
})();
