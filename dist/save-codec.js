// Lossless, synchronous save encoding. Legacy JSON saves remain readable.
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./vendor/pako.min.js'));
  else root.VelmoraSaveCodec=factory(root.pako);
})(typeof window!=='undefined'?window:globalThis,function(pako){
  'use strict';
  const prefix='VELMORA_GZIP_1:';
  function encode(json){
    if(!pako)throw new Error('Save compression could not load.');
    const bytes=pako.gzip(json,{level:3}),parts=[];
    for(let i=0;i<bytes.length;i+=8192)parts.push(String.fromCharCode.apply(null,bytes.subarray(i,i+8192)));
    return prefix+btoa(parts.join(''));
  }
  function decode(value){
    if(typeof value!=='string'||!value.startsWith(prefix))return value;
    if(!pako)throw new Error('Save decompression could not load.');
    const raw=atob(value.slice(prefix.length)),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
    return pako.ungzip(bytes,{to:'string'});
  }
  return Object.freeze({encode,decode});
});
