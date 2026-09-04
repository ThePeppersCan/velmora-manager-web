(function(root){
  'use strict';
  const PREFIX='velmora-manager-career-v32-slot-', LEGACY='velmora-manager-career-v3-2', SLOT_COUNT=5;
  function create(options={}){
    const idb=options.indexedDB, local=options.localStorage, cache=new Map(), committed=new Map(), listeners=new Set(), unsaved=new Map();
    let db=null, queue=Promise.resolve(), pending=0, lastError=null, mode='initialising';
    const status=()=>({mode,pending,error:lastError,unsaved:unsaved.size});
    function notify(){listeners.forEach(fn=>fn(status()));}
    function readLocal(key){try{return local?.getItem(key)||null;}catch(_){return null;}}
    function transaction(work){return new Promise((resolve,reject)=>{const tx=db.transaction('careers','readwrite');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||new Error('Career storage write failed'));tx.onabort=()=>reject(tx.error||new Error('Career storage write cancelled'));work(tx.objectStore('careers'));});}
    function valid(raw){try{const d=JSON.parse(options.codec.decode(raw));return !!d.worldSeed&&Array.isArray(d.fixtures)&&d.squads&&typeof d.squads==='object';}catch(_){return false;}}
    const ready=(async()=>{
      if(!idb){mode='limited';notify();return;}
      db=await new Promise((resolve,reject)=>{const req=idb.open('velmora-manager-careers',1);req.onupgradeneeded=()=>req.result.createObjectStore('careers');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);req.onblocked=()=>reject(new Error('Close other Velmora tabs, then reload to finish upgrading saves.'));});
      db.onversionchange=()=>{db.close();lastError='Reload this tab to reconnect your career saves.';notify();};
      await new Promise((resolve,reject)=>{const tx=db.transaction('careers','readonly'),req=tx.objectStore('careers').openCursor();req.onsuccess=()=>{const cur=req.result;if(cur){cache.set(cur.key,cur.value);committed.set(cur.key,cur.value);cur.continue();}};tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});
      const imports=[];
      for(let i=1;i<=SLOT_COUNT;i++){const key=PREFIX+i,raw=readLocal(key);if(raw&&!cache.has(key)&&!cache.has(key+':deleted')&&valid(raw))imports.push([key,raw]);}
      // Keep the original legacy file. Import once only; deletion tombstones prevent resurrection.
      const old=readLocal(LEGACY);
      if(!cache.has('legacy-checked')&&!cache.has(PREFIX+1)&&!cache.has(PREFIX+'1:deleted')&&!imports.some(([k])=>k===PREFIX+1)&&old&&valid(old))imports.push([PREFIX+1,old]);
      await transaction(store=>{imports.forEach(([k,v])=>store.put(v,k));store.put(true,'legacy-checked');});
      imports.forEach(([k,v])=>{cache.set(k,v);committed.set(k,v);});cache.set('legacy-checked',true);
      // Only remove a local slot after its identical bytes are durably stored.
      for(let i=1;i<=SLOT_COUNT;i++){const key=PREFIX+i,raw=readLocal(key);if(raw&&committed.get(key)===raw){try{local.removeItem(key);}catch(_){}}}
      mode='indexeddb';notify();
    })().catch(error=>{mode='unavailable';lastError=error.message;notify();throw error;});
    function enqueue(key,value){
      if(mode==='unavailable'||mode==='initialising')throw new Error(lastError||'Career storage is not ready');
      if(mode==='limited'){
        if(value===null)local.removeItem(key);else local.setItem(key,value);
        return;
      }
      if(value===null)cache.delete(key);else cache.set(key,value);
      unsaved.set(key,value);pending++;lastError=null;notify();
      queue=queue.then(async()=>{
        const previous=committed.get(key);
        try{
          await transaction(store=>{
            if(value===null){store.delete(key);store.delete(key+':backup');store.put(true,key+':deleted');}
            else{if(previous&&valid(previous))store.put(previous,key+':backup');store.put(value,key);store.delete(key+':deleted');}
          });
          if(value===null){committed.delete(key);cache.delete(key+':backup');cache.set(key+':deleted',true);}
          else{committed.set(key,value);cache.delete(key+':deleted');if(previous&&valid(previous))cache.set(key+':backup',previous);}
          if(unsaved.get(key)===value)unsaved.delete(key);
          if(!unsaved.size)lastError=null;
        }catch(error){lastError=error.message||'Unable to save career';if(cache.get(key)===value||value===null){if(previous)cache.set(key,previous);else cache.delete(key);}}
        finally{pending--;notify();}
      });
    }
    return {ready,status,subscribe(fn){listeners.add(fn);fn(status());return()=>listeners.delete(fn);},
      getItem(key){return mode==='indexeddb'?(cache.get(key)??null):readLocal(key);},
      setItem(key,value){enqueue(key,String(value));},removeItem(key){enqueue(key,null);},
      async flush(){await ready;while(pending)await queue;if(lastError)throw new Error(lastError);},
      exportSlot(slot){const key=PREFIX+slot;return unsaved.get(key)||cache.get(key)||readLocal(key);},
      async importSlot(slot,raw){await ready;if(!Number.isInteger(slot)||slot<1||slot>SLOT_COUNT||!valid(raw))throw new Error('This is not a valid Velmora career file.');enqueue(PREFIX+slot,raw);await this.flush();},
      async recover(slot){await this.flush();const raw=cache.get(PREFIX+slot+':backup');if(!raw||!valid(raw))throw new Error('No recovery copy is available for this slot.');enqueue(PREFIX+slot,raw);await this.flush();},
      hasBackup(slot){return !!cache.get(PREFIX+slot+':backup');},valid
    };
  }
  root.VelmoraCareerStorage={create};
  if(typeof module==='object'&&module.exports)module.exports={create};
})(typeof window==='object'?window:globalThis);
