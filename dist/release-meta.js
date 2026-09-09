(function(root,factory){
  'use strict';
  const release=factory();
  if(typeof module==='object'&&module.exports)module.exports=release;
  if(root){
    root.VELMORA_RELEASE=release;
    const apply=()=>root.document?.querySelectorAll?.('[data-velmora-release]').forEach(node=>{
      node.textContent=`${release.label} · ${release.channel}`;
    });
    if(root.document?.readyState==='loading')root.document.addEventListener('DOMContentLoaded',apply,{once:true});
    else apply();
  }
})(typeof window==='object'?window:globalThis,function(){
  return Object.freeze({
    version:'104.3.0',
    label:'V104.3',
    channel:'ONLINE CAREER FIX',
    cacheKey:'v104-3-enter-online-20260909',
    saveSchema:86
  });
});
