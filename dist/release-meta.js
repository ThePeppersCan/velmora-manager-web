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
    version:'89.0.1',
    label:'V89.1',
    channel:'STABILISATION RELEASE',
    cacheKey:'v89-1-profile-overlay-stack-20260908',
    saveSchema:83
  });
});
