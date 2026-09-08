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
    version:'103.0.3',
    label:'V103.3',
    channel:'LOAN OWNERSHIP HOTFIX',
    cacheKey:'v103-3-loan-ownership-20260909',
    saveSchema:86
  });
});
