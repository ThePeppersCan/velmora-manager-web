(function(root,factory){
  'use strict';
  const api=factory();
  root.VelmoraCloudSaves=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  const SUPABASE_URL='https://hvdrwmjieguurxvrgzfu.supabase.co';
  const SUPABASE_KEY='sb_publishable_bln84LaJ8iYmnkYK9mh0Pg_XxP7O1OZ';
  const TABLE='velmora_manager_career_slots';
  const BUCKET='velmora-manager-careers';
  const PREFIX='velmora-manager-career-v32-slot-';
  const SLOT_COUNT=5;

  function create(options={}){
    const scope=options.window||(typeof window==='object'?window:null);
    const doc=options.document||scope?.document||null;
    const store=options.store;
    const codec=options.codec;
    const now=options.now||(()=>Date.now());
    const debounceMs=Number(options.debounceMs??4500);
    const rows=new Map(),pending=new Map(),timers=new Map(),listeners=new Set();
    let client=options.client||null,user=null,queue=Promise.resolve(),suppressCommits=0,unsubscribeCommits=null;
    let state={mode:'connecting',label:'CONNECTING',detail:'Checking your Repo Company account…',connected:false,pending:0,error:null,setupRequired:false,lastSyncedAt:null,accountName:null};

    const status=()=>({...state});
    function emit(patch={}){
      state={...state,...patch,pending:pending.size};
      listeners.forEach(fn=>fn(status()));
      renderStatus();
      if(scope?.dispatchEvent&&typeof scope.CustomEvent==='function')scope.dispatchEvent(new scope.CustomEvent('velmora-cloud-status',{detail:status()}));
    }
    function subscribe(fn){listeners.add(fn);fn(status());return()=>listeners.delete(fn);}
    function slotKey(slot){return PREFIX+slot;}
    function slotFromKey(key){const match=String(key||'').match(/^velmora-manager-career-v32-slot-([1-5])$/);return match?Number(match[1]):null;}
    function objectPath(slot,previous=false){return `${user.id}/slot-${slot}${previous?'.previous':''}.velmora`;}
    function validSlot(slot){return Number.isInteger(Number(slot))&&Number(slot)>=1&&Number(slot)<=SLOT_COUNT;}
    function decoded(raw){
      try{
        const data=JSON.parse(codec.decode(raw));
        if(!data?.worldSeed||!data.squads)return null;
        const stamp=Date.parse(data.careerRuntime?.lastSavedAt||'');
        return{data,timestamp:Number.isFinite(stamp)?stamp:0,schema:Number(data.version||0),manager:String(data.manager?.identity?.name||data.manager?.name||data.managerName||''),clubId:data.currentClubId||null,seasonId:data.careerTime?.seasonId||null,careerDate:data.careerTime?.currentDate||null};
      }catch(_){return null;}
    }
    async function digest(raw){
      if(scope?.crypto?.subtle&&typeof scope.TextEncoder==='function'){
        const bytes=new scope.TextEncoder().encode(raw),hash=await scope.crypto.subtle.digest('SHA-256',bytes);
        return Array.from(new Uint8Array(hash)).map(v=>v.toString(16).padStart(2,'0')).join('');
      }
      let hash=2166136261;
      for(let i=0;i<raw.length;i++){hash^=raw.charCodeAt(i);hash=Math.imul(hash,16777619);}
      return `fnv-${(hash>>>0).toString(16)}`;
    }
    function accountName(value){const meta=value?.user_metadata||{};return String(meta.username||meta.user_name||meta.name||value?.email?.split('@')[0]||'Repo Company player');}
    function setupError(error){const text=String(error?.message||error||'').toLowerCase();return error?.code==='42P01'||error?.statusCode==='404'||text.includes('does not exist')||text.includes('bucket not found')||text.includes('not found');}
    function friendlyError(error){
      if(setupError(error))return'Cloud save storage has not been activated yet. Your browser save is still safe.';
      return'Cloud sync is temporarily unavailable. Your browser save is safe and play can continue.';
    }
    function requireResult(result,label){if(result?.error){const error=result.error;error.context=label;throw error;}return result?.data;}
    async function download(path){const blob=requireResult(await client.storage.from(BUCKET).download(path),'download');return blob.text();}
    async function upload(path,raw){requireResult(await client.storage.from(BUCKET).upload(path,new Blob([raw],{type:'application/octet-stream'}),{upsert:true,cacheControl:'0',contentType:'application/octet-stream'}),'upload');}
    async function latestRow(slot){
      const result=await client.from(TABLE).select('*').eq('user_id',user.id).eq('slot',slot).maybeSingle();
      return requireResult(result,'metadata')||null;
    }
    async function importLocal(slot,raw){
      suppressCommits++;
      try{await store.importSlot(slot,raw);await store.flush();}
      finally{suppressCommits--;}
    }
    function rowTimestamp(row){const value=Date.parse(row?.save_timestamp||row?.updated_at||'');return Number.isFinite(value)?value:0;}
    function rowMeta(info){return{manager:info.manager||null,club_id:info.clubId,season_id:info.seasonId,career_date:info.careerDate};}
    async function writeSlot(slot,raw,{force=false}={}){
      const info=decoded(raw);if(!info)throw new Error(`Slot ${slot} is not a valid Velmora career.`);
      const localChecksum=await digest(raw),remote=await latestRow(slot),remoteTime=rowTimestamp(remote);
      if(!force&&remote&&remoteTime>info.timestamp&&remote.checksum!==localChecksum){
        const newer=await download(remote.object_path);if(decoded(newer)){await importLocal(slot,newer);rows.set(slot,remote);return{direction:'download',slot};}
      }
      if(remote?.checksum===localChecksum){rows.set(slot,remote);return{direction:'unchanged',slot};}
      const current=objectPath(slot),previous=objectPath(slot,true);
      let hasPrevious=!!remote?.has_previous;
      if(remote?.object_path){
        const previousRaw=await download(remote.object_path);
        await upload(previous,previousRaw);
        hasPrevious=true;
      }
      await upload(current,raw);
      const stamp=new Date(info.timestamp||now()).toISOString();
      const record={user_id:user.id,slot,object_path:current,previous_object_path:hasPrevious?previous:null,has_previous:hasPrevious,save_schema:info.schema,save_bytes:raw.length,checksum:localChecksum,save_timestamp:stamp,revision:Number(remote?.revision||0)+1,metadata:rowMeta(info),updated_at:new Date(now()).toISOString()};
      const saved=requireResult(await client.from(TABLE).upsert(record,{onConflict:'user_id,slot'}).select('*').single(),'metadata');
      rows.set(slot,saved||record);
      return{direction:'upload',slot};
    }
    async function deleteSlot(slot){
      const remote=await latestRow(slot);
      const paths=[remote?.object_path,remote?.previous_object_path].filter(Boolean);
      if(paths.length){const removal=await client.storage.from(BUCKET).remove(paths);if(removal?.error&&!setupError(removal.error))throw removal.error;}
      requireResult(await client.from(TABLE).delete().eq('user_id',user.id).eq('slot',slot),'metadata');
      rows.delete(slot);
      return{direction:'delete',slot};
    }
    async function perform(event){return event.deleted?deleteSlot(event.slot):writeSlot(event.slot,event.raw);}
    function schedule(event){
      if(!user||state.setupRequired)return;
      pending.set(event.slot,event);clearTimeout(timers.get(event.slot));
      timers.set(event.slot,setTimeout(()=>{timers.delete(event.slot);const latest=pending.get(event.slot);pending.delete(event.slot);emit({mode:'saving',label:'SAVING CLOUD',detail:'Your local save is safe. Updating your private cloud copy…'});queue=queue.catch(()=>undefined).then(()=>perform(latest)).then(()=>emit({mode:'synced',label:'CLOUD SAVED',detail:'Local and cloud careers are up to date.',error:null,lastSyncedAt:new Date(now()).toISOString()})).catch(handleSyncError);},debounceMs));
      emit({mode:'saving',label:'CLOUD QUEUED',detail:'Career saved locally. Cloud copy queued…'});
    }
    function handleCommit(event){const slot=slotFromKey(event?.key);if(!slot||suppressCommits)return;schedule({slot,raw:event.value,deleted:event.deleted});}
    function handleSyncError(error){
      const needsSetup=setupError(error);
      emit({mode:needsSetup?'local-only':'offline',label:'LOCAL SAFE',detail:friendlyError(error),error:String(error?.message||error),setupRequired:needsSetup});
    }
    async function loadRows(){
      const data=requireResult(await client.from(TABLE).select('*').eq('user_id',user.id).order('slot',{ascending:true}),'metadata')||[];
      rows.clear();data.forEach(row=>rows.set(Number(row.slot),row));return data;
    }
    async function reconcile(){
      if(!user)return[];
      emit({mode:'syncing',label:'CLOUD SYNC',detail:'Comparing local and cloud career slots…',error:null,setupRequired:false});
      await loadRows();const actions=[];
      for(let slot=1;slot<=SLOT_COUNT;slot++){
        const raw=store.getItem(slotKey(slot)),info=raw?decoded(raw):null,row=rows.get(slot)||null;
        if(!row&&info){actions.push(await writeSlot(slot,raw));continue;}
        if(row&&!info){const cloudRaw=await download(row.object_path);if(decoded(cloudRaw)){await importLocal(slot,cloudRaw);actions.push({direction:'download',slot});}continue;}
        if(!row||!info)continue;
        const remoteTime=rowTimestamp(row);
        if(remoteTime>info.timestamp){const cloudRaw=await download(row.object_path);if(decoded(cloudRaw)){await importLocal(slot,cloudRaw);actions.push({direction:'download',slot});}}
        else if(info.timestamp>remoteTime)actions.push(await writeSlot(slot,raw));
        else{const localChecksum=await digest(raw);if(row.checksum!==localChecksum){const cloudRaw=await download(row.object_path);if(decoded(cloudRaw)){await importLocal(slot,cloudRaw);actions.push({direction:'download',slot});}}}
      }
      emit({mode:'synced',label:'CLOUD SAVED',detail:'Local and cloud careers are up to date.',error:null,lastSyncedAt:new Date(now()).toISOString()});
      if(actions.length&&scope?.dispatchEvent&&typeof scope.CustomEvent==='function')scope.dispatchEvent(new scope.CustomEvent('velmora-cloud-saves-updated',{detail:{actions}}));
      return actions;
    }
    async function flush(){
      for(const timer of timers.values())clearTimeout(timer);timers.clear();
      const work=[...pending.values()];pending.clear();
      if(work.length){emit({mode:'saving',label:'SAVING CLOUD',detail:'Finishing your private cloud copy…'});for(const event of work)queue=queue.catch(()=>undefined).then(()=>perform(event));}
      try{await queue;if(user&&!state.setupRequired)emit({mode:'synced',label:'CLOUD SAVED',detail:'Local and cloud careers are up to date.',error:null,lastSyncedAt:new Date(now()).toISOString()});}
      catch(error){handleSyncError(error);throw error;}
    }
    async function syncNow(){
      if(!user)return false;
      try{await store.flush();await flush();await reconcile();return true;}
      catch(error){handleSyncError(error);return false;}
    }
    function hasCloudBackup(slot){return !!rows.get(Number(slot))?.has_previous;}
    async function restorePrevious(slot){
      slot=Number(slot);if(!user||!validSlot(slot)||!hasCloudBackup(slot))throw new Error('No cloud recovery copy is available for this slot.');
      const row=rows.get(slot),raw=await download(row.previous_object_path||objectPath(slot,true));
      if(!decoded(raw))throw new Error('The cloud recovery copy could not be read.');
      await importLocal(slot,raw);await writeSlot(slot,raw,{force:true});
      emit({mode:'synced',label:'CLOUD SAVED',detail:`Slot ${slot} was restored from its previous cloud copy.`,lastSyncedAt:new Date(now()).toISOString()});
      if(scope?.dispatchEvent&&typeof scope.CustomEvent==='function')scope.dispatchEvent(new scope.CustomEvent('velmora-cloud-saves-updated',{detail:{actions:[{direction:'restore',slot}]}}));
      return true;
    }
    function allowedParent(origin){
      if(origin==='https://repocompany.uk'||origin==='https://www.repocompany.uk')return true;
      try{const url=new URL(origin);return (url.hostname==='127.0.0.1'||url.hostname==='localhost')&&(scope?.location?.hostname==='127.0.0.1'||scope?.location?.hostname==='localhost');}catch(_){return false;}
    }
    async function sessionFromBridge(){
      const bridge=new URLSearchParams(scope?.location?.search||'').get('repoBridge');
      if(!bridge||!scope?.parent||scope.parent===scope)return null;
      return new Promise(resolve=>{
        let complete=false;
        const finish=value=>{if(complete)return;complete=true;scope.removeEventListener('message',receive);clearTimeout(timer);resolve(value);};
        const receive=async event=>{
          const data=event.data||{};
          if(event.source!==scope.parent||!allowedParent(event.origin)||data.type!=='velmora-manager-auth'||data.bridge!==bridge)return;
          if(data.guest||!data.accessToken||!data.refreshToken){finish(null);return;}
          try{const result=await client.auth.setSession({access_token:data.accessToken,refresh_token:data.refreshToken});finish(requireResult(result,'authentication')?.session||null);}
          catch(_){finish(null);}
        };
        scope.addEventListener('message',receive);
        let target='https://repocompany.uk';
        try{const referrer=new URL(doc?.referrer||'');if(allowedParent(referrer.origin))target=referrer.origin;}catch(_){ }
        scope.parent.postMessage({type:'velmora-manager-ready',bridge},target);
        const timer=setTimeout(()=>finish(null),3500);
      });
    }
    function mountStatus(){
      if(!doc?.body||doc.getElementById('velmoraCloudStatus'))return;
      const wrap=doc.createElement('aside');wrap.id='velmoraCloudStatus';wrap.className='velmora-cloud-status';
      wrap.innerHTML='<button type="button" class="velmora-cloud-chip" aria-expanded="false"><span class="velmora-cloud-dot"></span><b data-cloud-label>CONNECTING</b></button><section class="velmora-cloud-panel" hidden><header><div><small>SAVE PROTECTION</small><strong>VELMORA CLOUD</strong></div><button type="button" data-cloud-close aria-label="Close cloud save details">×</button></header><p data-cloud-detail></p><dl><div><dt>ACCOUNT</dt><dd data-cloud-account>Checking…</dd></div><div><dt>LOCAL SAVE</dt><dd>Always active</dd></div><div><dt>CLOUD COPY</dt><dd data-cloud-copy>Checking…</dd></div></dl><p class="velmora-cloud-note">Careers save to this browser first, so a network interruption cannot stop play. Signed-in Repo Company players also receive a private recovery copy for other devices.</p><footer><button type="button" data-cloud-sync>SYNC NOW</button><a href="https://repocompany.uk/" target="_top" data-cloud-login>SIGN IN AT REPO COMPANY</a></footer></section>';
      doc.body.appendChild(wrap);const chip=wrap.querySelector('.velmora-cloud-chip'),panel=wrap.querySelector('.velmora-cloud-panel');
      chip.addEventListener('click',()=>{const open=panel.hidden;panel.hidden=!open;chip.setAttribute('aria-expanded',String(open));});
      wrap.querySelector('[data-cloud-close]').addEventListener('click',()=>{panel.hidden=true;chip.setAttribute('aria-expanded','false');});
      wrap.querySelector('[data-cloud-sync]').addEventListener('click',syncNow);
      renderStatus();
    }
    function renderStatus(){
      const wrap=doc?.getElementById('velmoraCloudStatus');if(!wrap)return;
      wrap.dataset.mode=state.mode;const set=(query,value)=>{const el=wrap.querySelector(query);if(el)el.textContent=value;};
      // A completed sync hides the status widget. Always collapse its details
      // first so the next autosave can only reveal the compact status chip.
      if(state.mode==='synced'||state.mode==='local-only'){
        const panel=wrap.querySelector('.velmora-cloud-panel'),chip=wrap.querySelector('.velmora-cloud-chip');
        if(panel)panel.hidden=true;
        if(chip)chip.setAttribute('aria-expanded','false');
      }
      set('[data-cloud-label]',state.label);set('[data-cloud-detail]',state.detail);set('[data-cloud-account]',state.accountName||'Guest player');
      set('[data-cloud-copy]',state.connected?(state.mode==='saving'?'Updating…':state.mode==='offline'||state.setupRequired?'Needs attention':'Protected'):'Local only');
      const sync=wrap.querySelector('[data-cloud-sync]'),login=wrap.querySelector('[data-cloud-login]');if(sync){sync.hidden=!state.connected;sync.disabled=state.mode==='saving'||state.mode==='syncing';}if(login)login.hidden=state.connected;
    }
    async function initialise(){
      if(!store||!codec)throw new Error('Career storage must be ready before cloud saves start.');
      mountStatus();await store.ready;
      const createClient=options.createClient||scope?.supabase?.createClient;
      if(!client&&createClient)client=createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:false,autoRefreshToken:true,detectSessionInUrl:false}});
      if(!client){emit({mode:'local-only',label:'LOCAL SAVE',detail:'Cloud sign-in is unavailable. Careers still save in this browser.',connected:false});return false;}
      const session=options.session||await sessionFromBridge();user=session?.user||null;
      if(!user){emit({mode:'local-only',label:'LOCAL SAVE',detail:'Guest career. Launch while signed in at Repo Company to add a private cloud copy.',connected:false});return false;}
      emit({connected:true,accountName:accountName(user),detail:'Connected to your Repo Company account.'});
      try{await reconcile();}
      catch(error){handleSyncError(error);}
      unsubscribeCommits=store.subscribeCommits?.(handleCommit)||null;
      if(doc)doc.addEventListener('visibilitychange',()=>{if(doc.visibilityState==='hidden')flush().catch(()=>{});});
      scope?.addEventListener?.('pagehide',()=>{flush().catch(()=>{});});
      return true;
    }
    const ready=initialise().catch(error=>{handleSyncError(error);return false;});
    // V104: the online career reuses this signed-in connection instead of
    // asking a player to sign in a second time.
    return{ready,status,subscribe,flush,syncNow,restorePrevious,hasCloudBackup,client:()=>client,user:()=>user,destroy(){unsubscribeCommits?.();for(const timer of timers.values())clearTimeout(timer);timers.clear();listeners.clear();},_rows:rows,_reconcile:reconcile};
  }
  return{create,SUPABASE_URL,SUPABASE_KEY,TABLE,BUCKET,PREFIX,SLOT_COUNT};
});
