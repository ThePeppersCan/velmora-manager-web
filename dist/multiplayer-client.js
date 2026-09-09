// Velmora Manager · Online Career · Supabase transport
//
// The only file that talks to the network. It owns session discovery,
// the ordered event pull, realtime subscriptions, the offline retry queue
// and conflict recovery. It never decides game rules: those live in
// multiplayer-core.js, and the game itself is reached only through the
// injected `bridge`, so this file can be tested without a browser.
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.VelmoraMultiplayerClient=api;
})(typeof window==='object'?window:globalThis,function(){
  'use strict';

  const CORE=(typeof require==='function'&&typeof module==='object')
    ? require('./multiplayer-core.js')
    : (typeof window==='object'?window.VelmoraMultiplayerCore:null);

  const SUPABASE_URL='https://hvdrwmjieguurxvrgzfu.supabase.co';
  const SUPABASE_KEY='sb_publishable_bln84LaJ8iYmnkYK9mh0Pg_XxP7O1OZ';

  const T={
    careers:'velmora_multiplayer_careers',
    members:'velmora_multiplayer_members',
    claims:'velmora_multiplayer_club_claims',
    clubState:'velmora_multiplayer_club_state',
    events:'velmora_multiplayer_events',
    barriers:'velmora_multiplayer_matchday_barriers',
    submissions:'velmora_multiplayer_match_submissions',
    results:'velmora_multiplayer_match_results',
    presence:'velmora_multiplayer_presence',
    audit:'velmora_multiplayer_audit'
  };

  function create(options={}){
    const core=options.core||CORE;
    if(!core)throw new Error('VelmoraMultiplayerCore must load before the online career client.');

    const scope=options.window||(typeof window==='object'?window:null);
    const bridge=options.bridge||null;              // the game, injected
    const codec=options.codec||scope?.VelmoraSaveCodec||null;
    const now=options.now||(()=>Date.now());
    const timer=options.setTimeout||((fn,ms)=>setTimeout(fn,ms));
    const clearTimer=options.clearTimeout||(id=>clearTimeout(id));
    const clientVersion=options.clientVersion||scope?.VELMORA_RELEASE?.version||'0.0.0';
    const saveSchema=Number(options.saveSchema||scope?.VELMORA_RELEASE?.saveSchema||0);
    const clubPublishDebounceMs=Number(options.clubPublishDebounceMs??2500);
    const presenceIntervalMs=Number(options.presenceIntervalMs??20000);
    const pollIntervalMs=Number(options.pollIntervalMs??6000);
    const snapshotEveryEvents=Number(options.snapshotEveryEvents??40);

    let client=options.client||null;
    let session=options.session||null;
    let user=session?.user||null;

    let career=null;                 // the attached career row
    let members=[];
    let barrier=null;
    let submissions=[];
    let results=[];
    let clubStateRevisions=new Map(); // clubId -> revision we have applied
    let myClubId=null;
    let lastSeq=0;
    let eventsSinceSnapshot=0;
    let channel=null;
    let presenceTimer=0,pollTimer=0,clubTimer=0;
    let attached=false,applying=false;
    let queue=[];                    // offline / failed writes, replayed in order
    let queueRunning=false;
    const listeners=new Set();

    let state={
      mode:'idle',                   // idle|connecting|online|saving|offline|readonly|conflict
      label:'OFFLINE CAREER',
      detail:'',
      online:false,
      readOnly:false,
      pending:0,
      error:null,
      lastSyncedAt:null,
      revision:0
    };

    // ---------------------------------------------------------------
    // Status
    // ---------------------------------------------------------------
    function snapshotStatus(){
      const bar=core.barrierState({barrier,members,submissions,results,now:now()});
      return{
        ...state,
        pending:queue.length,
        careerId:career?.career_id||null,
        careerName:career?.name||null,
        isHost:!!(career&&user&&career.host_user_id===user.id),
        joinCode:career?.join_code||null,
        careerDate:career?.career_date||null,
        myClubId,
        members:members.map(publicMember),
        others:members.filter(row=>row.user_id!==user?.id).map(publicMember),
        barrier:bar,
        waitingMessage:core.waitingMessage(bar),
        locked:bar.locked,
        resolvable:bar.resolvable
      };
    }
    // Only broad, non-confidential fields ever leave this function.
    function publicMember(row){
      return{
        user_id:row.user_id,
        display_name:row.display_name,
        manager_name:row.manager_name||row.display_name,
        club_id:row.club_id||null,
        club_name:row.club_name||null,
        role:row.role,
        status:row.status,
        ready:!!row.ready,
        client_version:row.client_version||null,
        activity:core.activityLabel(row.activity||''),
        activity_raw:row.activity||null,
        online:row.presence_status==='ONLINE'&&recentlySeen(row),
        last_seen_at:row.presence_at||row.last_seen_at||null
      };
    }
    function recentlySeen(row){
      const seen=Date.parse(row.presence_at||row.last_seen_at||'')||0;
      return seen>0&&(now()-seen)<90000;
    }
    function emit(patch={}){
      state={...state,...patch};
      const value=snapshotStatus();
      listeners.forEach(fn=>{try{fn(value);}catch(error){console.error?.('[Velmora] online status listener failed',error);}});
      if(scope?.dispatchEvent&&typeof scope.CustomEvent==='function')
        scope.dispatchEvent(new scope.CustomEvent('velmora-multiplayer-status',{detail:value}));
    }
    function subscribe(fn){listeners.add(fn);fn(snapshotStatus());return()=>listeners.delete(fn);}

    function fail(error,{readOnly=false}={}){
      const message=core.friendlyError(error);
      emit({mode:readOnly?'readonly':'offline',label:readOnly?'READ ONLY':'RECONNECTING',
            detail:message,online:false,readOnly,error:message});
      return message;
    }

    // ---------------------------------------------------------------
    // Session
    // ---------------------------------------------------------------
    async function resolveSession(){
      if(session?.user)return session;
      // Reuse the cloud-save connection so an online career never asks for
      // a second sign-in.
      const cloud=options.cloud||scope?.VelmoraCloudSaveManager||null;
      if(cloud){
        try{await cloud.ready;}catch(_){}
        const cloudClient=typeof cloud.client==='function'?cloud.client():null;
        const cloudUser=typeof cloud.user==='function'?cloud.user():null;
        if(cloudClient&&cloudUser){client=client||cloudClient;session={user:cloudUser};return session;}
      }
      if(!client){
        const createClient=options.createClient||scope?.supabase?.createClient;
        if(createClient)client=createClient(SUPABASE_URL,SUPABASE_KEY,
          {auth:{persistSession:false,autoRefreshToken:true,detectSessionInUrl:false}});
      }
      if(client?.auth?.getSession){
        try{
          const result=await client.auth.getSession();
          if(result?.data?.session?.user){session=result.data.session;return session;}
        }catch(_){}
      }
      return null;
    }

    async function ensureSignedIn(){
      const found=await resolveSession();
      user=found?.user||null;
      return!!user;
    }

    // ---------------------------------------------------------------
    // Low level calls
    // ---------------------------------------------------------------
    function unwrap(result,label){
      if(result?.error){const error=result.error;error.context=label;throw error;}
      return result?.data;
    }
    async function rpc(name,args={}){
      if(!client)throw new Error('VELMORA_NOT_SIGNED_IN');
      return unwrap(await client.rpc(name,args),name);
    }
    async function selectRows(table,build){
      if(!client)throw new Error('VELMORA_NOT_SIGNED_IN');
      let query=client.from(table).select('*');
      if(build)query=build(query);
      return unwrap(await query,table)||[];
    }

    // ---------------------------------------------------------------
    // Retry queue
    //
    // Non-conflicting writes survive a network drop. Every queued job
    // carries a stable idempotency key, so replaying it after a reconnect
    // can never apply the same intent twice.
    // ---------------------------------------------------------------
    function enqueue(job){
      queue=queue.filter(existing=>existing.key!==job.key);
      queue.push(job);
      emit({});
      runQueue();
    }
    async function runQueue(){
      if(queueRunning||!queue.length||!client||!user)return;
      queueRunning=true;
      try{
        while(queue.length){
          const job=queue[0];
          try{
            await job.run();
            queue.shift();
          }catch(error){
            if(core.isConflictError(error)){
              queue.shift();
              job.onConflict?.(error);
              continue;
            }
            if(core.isStaleError(error)){
              queue.shift();
              await recoverFromConflict(error);
              continue;
            }
            throw error;
          }
        }
        if(state.mode==='offline'||state.mode==='readonly')
          emit({mode:'online',label:'ONLINE CAREER',detail:'Reconnected.',online:true,readOnly:false,error:null});
        else emit({});
      }catch(error){
        fail(error);
      }finally{
        queueRunning=false;
      }
    }

    // ---------------------------------------------------------------
    // Lobby and membership
    // ---------------------------------------------------------------
    async function listCareers(){
      if(!await ensureSignedIn())return[];
      const rows=await rpc('velmora_mp_my_careers');
      return Array.isArray(rows)?rows:[];
    }
    async function createCareer({name,privacy='INVITE',password=null,displayName='Manager'}={}){
      if(!await ensureSignedIn())throw new Error('VELMORA_NOT_SIGNED_IN');
      return rpc('velmora_mp_create_career',{
        p_name:name,p_privacy:privacy,p_password:password||null,
        p_game_version:clientVersion,p_save_schema:saveSchema,p_display_name:displayName
      });
    }
    async function previewCareer(code){
      if(!await ensureSignedIn())throw new Error('VELMORA_NOT_SIGNED_IN');
      return rpc('velmora_mp_preview_career',{p_code:String(code||'').toUpperCase().trim()});
    }
    async function joinCareer({code,password=null,displayName='Manager'}={}){
      if(!await ensureSignedIn())throw new Error('VELMORA_NOT_SIGNED_IN');
      return rpc('velmora_mp_join_career',{
        p_code:String(code||'').toUpperCase().trim(),p_password:password||null,
        p_display_name:displayName,p_client_version:clientVersion
      });
    }
    async function claimClub(careerId,{clubId,clubName='',customClub=null,managerName='Career Manager',managerProfile={}}={}){
      const row=await rpc('velmora_mp_claim_club',{
        p_career_id:careerId,p_club_id:clubId,p_club_name:clubName,
        p_custom_club:customClub,p_manager_name:managerName,p_manager_profile:managerProfile
      });
      if(career&&career.career_id===careerId)myClubId=clubId;
      return row;
    }
    async function releaseClub(careerId){
      const row=await rpc('velmora_mp_release_club',{p_career_id:careerId});
      if(career&&career.career_id===careerId)myClubId=null;
      return row;
    }
    function setReady(careerId,ready){
      return rpc('velmora_mp_set_ready',{p_career_id:careerId,p_ready:!!ready});
    }
    function leaveCareer(careerId){return rpc('velmora_mp_leave_career',{p_career_id:careerId});}
    function archiveCareer(careerId,remove=false){
      return rpc('velmora_mp_archive_career',{p_career_id:careerId,p_delete:!!remove});
    }
    function convertToAi(careerId,userId,reason='ABSENT'){
      return rpc('velmora_mp_convert_to_ai',{p_career_id:careerId,p_user_id:userId,p_reason:reason,p_grace_minutes:15});
    }
    function claimHost(careerId){return rpc('velmora_mp_claim_host',{p_career_id:careerId,p_grace_minutes:60});}

    async function startCareer(careerId){
      const built=bridge.buildSnapshot();
      return rpc('velmora_mp_start_career',{
        p_career_id:careerId,p_world_seed:String(built.worldSeed||''),
        p_career_date:built.careerDate,p_season_id:built.seasonId||null,
        p_snapshot:built.payload,p_checksum:built.checksum||'',p_save_schema:Number(built.saveSchema||saveSchema)
      });
    }

    // ---------------------------------------------------------------
    // Attach: rebuild the world, then keep it current
    // ---------------------------------------------------------------
    async function attach(careerId){
      if(!await ensureSignedIn())throw new Error('VELMORA_NOT_SIGNED_IN');
      emit({mode:'connecting',label:'CONNECTING',detail:'Opening the shared career…',online:false,readOnly:false});
      detachTimers();
      lastSeq=0;clubStateRevisions=new Map();eventsSinceSnapshot=0;

      const sync=await rpc('velmora_mp_sync',{p_career_id:careerId,p_since_seq:0});
      applySyncMetadata(sync);

      const compatibility=core.versionCompatibility(clientVersion,career.game_version);
      const schema=core.saveSchemaCompatibility(career.save_schema,saveSchema);
      if(!compatibility.compatible||!schema.compatible){
        emit({mode:'readonly',label:'UPDATE NEEDED',
              detail:!compatibility.compatible?compatibility.message:schema.message,
              online:false,readOnly:true});
        return{ok:false,reason:'VERSION',message:!compatibility.compatible?compatibility.message:schema.message};
      }

      const restored=await restoreWorld(careerId);
      if(!restored.ok)return restored;

      attached=true;
      await subscribeRealtime(careerId);
      startTimers();
      emit({mode:'online',label:'ONLINE CAREER',detail:'Shared world is up to date.',
            online:true,readOnly:false,error:null,lastSyncedAt:new Date(now()).toISOString(),
            revision:career.revision});
      return{ok:true,compatibility};
    }

    async function restoreWorld(careerId){
      const snapshot=await rpc('velmora_mp_fetch_snapshot',{p_career_id:careerId,p_revision:null});
      if(!snapshot||!snapshot.found)
        return{ok:false,reason:'NO_SNAPSHOT',message:'This career has not been started by its host yet.'};
      if(!bridge.applySnapshot(snapshot.payload))
        return{ok:false,reason:'SNAPSHOT_UNREADABLE',
               message:'The shared career could not be opened on this device. Your own saves are unaffected.'};
      lastSeq=Number(snapshot.revision||0);

      // Everyone else's published club partitions sit outside the snapshot.
      const clubRows=await selectRows(T.clubState,q=>q.eq('career_id',careerId));
      clubRows.forEach(row=>{
        clubStateRevisions.set(String(row.club_id),Number(row.revision||0));
        if(String(row.club_id)!==String(myClubId))bridge.applyClubState(String(row.club_id),row.payload||{});
      });

      await pullEvents(careerId);
      return{ok:true};
    }

    function applySyncMetadata(sync){
      if(!sync)return;
      career=sync.career||career;
      members=Array.isArray(sync.members)?sync.members:members;
      barrier=sync.barrier||null;
      submissions=Array.isArray(sync.submissions)?sync.submissions:submissions;
      const mine=members.find(row=>row.user_id===user?.id);
      myClubId=mine?.club_id||myClubId;
      (sync.club_state||[]).forEach(row=>{
        if(!clubStateRevisions.has(String(row.club_id)))clubStateRevisions.set(String(row.club_id),0);
      });
    }

    // ---------------------------------------------------------------
    // Event application
    //
    // Strictly ordered and strictly once. `lastSeq` only ever moves
    // forwards, so a refresh, a second tab or a duplicated realtime frame
    // cannot replay a match or an advance.
    // ---------------------------------------------------------------
    async function pullEvents(careerId=career?.career_id){
      if(!careerId||applying)return;
      applying=true;
      try{
        let guard=0;
        while(guard++<40){
          const sync=await rpc('velmora_mp_sync',{p_career_id:careerId,p_since_seq:lastSeq});
          applySyncMetadata(sync);
          const events=Array.isArray(sync.events)?sync.events:[];
          if(!events.length)break;
          for(const event of events)await applyEvent(event,careerId);
          if(events.length<500)break;
        }
        results=await selectRows(T.results,q=>q.eq('career_id',careerId));
        emit({revision:career?.revision||lastSeq,lastSyncedAt:new Date(now()).toISOString()});
        bridge.onRemoteChange?.(snapshotStatus());
      }finally{
        applying=false;
      }
    }

    async function applyEvent(event,careerId){
      const seq=Number(event.seq||0);
      if(seq<=lastSeq)return;               // already applied; never twice
      switch(event.kind){
        case'CLUB_STATE':{
          const clubId=String(event.payload?.club_id||event.club_id||'');
          const revision=Number(event.payload?.club_revision||0);
          if(clubId&&clubId!==String(myClubId)&&revision>(clubStateRevisions.get(clubId)||0)){
            const rows=await selectRows(T.clubState,q=>q.eq('career_id',careerId).eq('club_id',clubId));
            const row=rows[0];
            if(row){
              clubStateRevisions.set(clubId,Number(row.revision||revision));
              bridge.applyClubState(clubId,row.payload||{});
            }
          }
          break;
        }
        case'MATCH_RESULT':{
          const fixtureId=String(event.payload?.fixture_id||event.fixture_id||'');
          if(fixtureId)bridge.applyMatchResult(fixtureId,event.payload?.result||{},{
            homeScore:Number(event.payload?.home_score||0),
            awayScore:Number(event.payload?.away_score||0),
            mode:event.payload?.resolution_mode||'QUICK_SIM'
          });
          break;
        }
        case'DAY_ADVANCE':{
          bridge.advanceSharedDay(event.payload?.from_date,event.payload?.to_date);
          break;
        }
        case'MANAGER_CONVERTED_AI':{
          bridge.onManagerConvertedToAi?.(event.payload?.user_id,event.payload?.club_id);
          break;
        }
        case'WORLD_ACTION':
        case'TRANSFER':{
          bridge.applyWorldAction?.(event.kind,event.payload||{},event.subject_key);
          break;
        }
        default:break;                       // lifecycle events need no world change
      }
      lastSeq=seq;
      eventsSinceSnapshot++;
    }

    // ---------------------------------------------------------------
    // Realtime
    // ---------------------------------------------------------------
    async function subscribeRealtime(careerId){
      if(!client?.channel)return;
      try{
        if(channel)await client.removeChannel?.(channel);
        channel=client.channel(`velmora-mp-${careerId}`);
        const filter=`career_id=eq.${careerId}`;
        const bump=()=>{pullEvents(careerId).catch(error=>fail(error));};
        const refresh=()=>{refreshLobby(careerId).catch(()=>{});};
        channel
          .on('postgres_changes',{event:'INSERT',schema:'public',table:T.events,filter},bump)
          .on('postgres_changes',{event:'*',schema:'public',table:T.barriers,filter},refresh)
          .on('postgres_changes',{event:'*',schema:'public',table:T.submissions,filter},refresh)
          .on('postgres_changes',{event:'*',schema:'public',table:T.members,filter},refresh)
          .on('postgres_changes',{event:'*',schema:'public',table:T.presence,filter},refresh);
        await channel.subscribe?.(status=>{
          if(status==='SUBSCRIBED')emit({online:true});
          if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')
            emit({mode:'offline',label:'RECONNECTING',
                  detail:'Reconnecting to the shared career. Your club is safe.',online:false});
        });
      }catch(_){ /* polling below is the safety net */ }
    }

    // Read a career's lobby state without attaching to it, for the lobby
    // screen and the online-careers list.
    async function syncFor(careerId){
      if(!await ensureSignedIn())throw new Error('VELMORA_NOT_SIGNED_IN');
      return rpc('velmora_mp_sync',{p_career_id:careerId,p_since_seq:0});
    }

    async function refreshLobby(careerId=career?.career_id){
      if(!careerId)return null;
      const sync=await rpc('velmora_mp_sync',{p_career_id:careerId,p_since_seq:lastSeq});
      applySyncMetadata(sync);
      if(Array.isArray(sync.events)&&sync.events.length)await pullEvents(careerId);
      else{
        results=await selectRows(T.results,q=>q.eq('career_id',careerId));
        emit({});
        bridge.onRemoteChange?.(snapshotStatus());
      }
      // A successful poll proves the connection is back. Wake any writes
      // that were safely coalesced while the network was unavailable.
      if(queue.length&&!queueRunning)await runQueue();
      return snapshotStatus();
    }

    function startTimers(){
      presenceTimer=timer(function tick(){
        touchPresence().catch(()=>{});
        presenceTimer=timer(tick,presenceIntervalMs);
      },0);
      pollTimer=timer(function tick(){
        // Polling is the safety net when a realtime frame is missed. It is
        // never the only path, and never the authority.
        if(attached)refreshLobby().catch(error=>fail(error));
        pollTimer=timer(tick,pollIntervalMs);
      },pollIntervalMs);
    }
    function detachTimers(){
      [presenceTimer,pollTimer,clubTimer].forEach(id=>{if(id)clearTimer(id);});
      presenceTimer=pollTimer=clubTimer=0;
    }

    async function detach(){
      attached=false;
      detachTimers();
      if(channel&&client?.removeChannel){try{await client.removeChannel(channel);}catch(_){}}
      channel=null;
      emit({mode:'idle',label:'OFFLINE CAREER',detail:'',online:false,readOnly:false});
    }

    // ---------------------------------------------------------------
    // Presence (informative only)
    // ---------------------------------------------------------------
    async function touchPresence(activity){
      if(!career||!user)return;
      const label=activity||bridge.activityRoute?.()||'central';
      try{
        await rpc('velmora_mp_touch_presence',{
          p_career_id:career.career_id,p_status:'ONLINE',
          p_activity:core.activityLabel(label),p_client_id:options.clientId||null
        });
        // Presence is the second recovery heartbeat. Whichever successful
        // request notices the restored network first drains the retry queue.
        if(queue.length&&!queueRunning)await runQueue();
      }catch(error){
        if(!core.isStaleError(error))emit({});
      }
    }

    // ---------------------------------------------------------------
    // Writing this manager's own club
    // ---------------------------------------------------------------
    function scheduleClubPublish(reason='autosave'){
      if(!career||!myClubId||state.readOnly)return;
      if(clubTimer)clearTimer(clubTimer);
      clubTimer=timer(()=>{clubTimer=0;publishClubState(reason).catch(()=>{});},clubPublishDebounceMs);
      emit({mode:'saving',label:'SAVING',detail:'Saving your club to the shared career…'});
    }

    async function publishClubState(reason='autosave'){
      if(!career||!myClubId)return null;
      const payload=bridge.buildClubState(myClubId);
      const expect=clubStateRevisions.get(String(myClubId))??0;
      const run=async()=>{
        try{
          const row=await rpc('velmora_mp_publish_club_state',{
            p_career_id:career.career_id,p_club_id:myClubId,
            p_payload:payload,p_expect_revision:expect
          });
          clubStateRevisions.set(String(myClubId),Number(row.revision||expect+1));
          lastSeq=Math.max(lastSeq,Number(career.revision||0));
          emit({mode:'online',label:'ONLINE CAREER',detail:'Shared career saved.',
                online:true,error:null,lastSyncedAt:new Date(now()).toISOString()});
          await maybeCompact();
          return row;
        }catch(error){
          if(core.isStaleError(error)){
            // Another tab of ours wrote first. Take the newer club state and
            // republish from it rather than overwriting with older data.
            await recoverFromConflict(error);
            const fresh=await selectRows(T.clubState,
              q=>q.eq('career_id',career.career_id).eq('club_id',myClubId));
            if(fresh[0])clubStateRevisions.set(String(myClubId),Number(fresh[0].revision||0));
            throw error;
          }
          throw error;
        }
      };
      try{return await run();}
      catch(error){
        if(core.isStaleError(error))return null;
        enqueue({key:`club:${myClubId}`,run,onConflict:()=>{}});
        fail(error);
        return null;
      }
    }

    // ---------------------------------------------------------------
    // Matchday
    // ---------------------------------------------------------------
    async function openBarrier(date,required){
      if(!career)return null;
      const row=await rpc('velmora_mp_open_barrier',{
        p_career_id:career.career_id,p_career_date:date,p_required:required
      });
      await refreshLobby();
      return row;
    }
    async function submitMatchState(fixtureId,stateName,{lineup={},tactics={},date=null}={}){
      if(!career||!myClubId)return null;
      const key=`submission:${fixtureId}:${stateName}`;
      const run=()=>rpc('velmora_mp_submit_match_state',{
        p_career_id:career.career_id,p_fixture_id:fixtureId,p_club_id:myClubId,
        p_state:stateName,p_career_date:date,p_lineup:lineup,p_tactics:tactics
      });
      try{
        const row=await run();
        await refreshLobby();
        return row;
      }catch(error){
        enqueue({key,run});
        fail(error);
        return null;
      }
    }

    // The one place a completed match becomes canonical. Returns the
    // authoritative result whether or not this device won the race.
    async function recordMatchResult(fixtureId,payload={}){
      if(!career)return null;
      const run=()=>rpc('velmora_mp_record_match_result',{
        p_career_id:career.career_id,p_fixture_id:fixtureId,
        p_result:payload.result||{},p_career_date:payload.date||career.career_date||null,
        p_home_club_id:payload.homeClubId||null,p_away_club_id:payload.awayClubId||null,
        p_home_score:Number(payload.homeScore||0),p_away_score:Number(payload.awayScore||0),
        p_resolution_mode:payload.mode||'QUICK_SIM'
      });
      try{
        const row=await run();
        await pullEvents();
        return row;
      }catch(error){
        if(core.isStaleError(error)){await recoverFromConflict(error);return null;}
        enqueue({key:`result:${fixtureId}`,run});
        fail(error);
        return null;
      }
    }

    async function resolveBarrier(date,nextDate){
      if(!career)return null;
      try{
        const row=await rpc('velmora_mp_resolve_barrier',{
          p_career_id:career.career_id,p_career_date:date,p_next_date:nextDate
        });
        await pullEvents();
        return row;
      }catch(error){
        fail(error);
        return null;
      }
    }

    // Contested world mutations: transfers, prize money, one-off world events.
    async function claimWorldAction({kind='WORLD_ACTION',subjectKey,payload={},idempotencyKey=null,clubId=null}={}){
      if(!career)return{claimed:false,reason:'OFFLINE'};
      try{
        const row=await rpc('velmora_mp_claim_world_action',{
          p_career_id:career.career_id,p_kind:kind,p_subject_key:subjectKey,
          p_payload:payload,p_idempotency_key:idempotencyKey,p_club_id:clubId
        });
        await pullEvents();
        return{claimed:true,event:row};
      }catch(error){
        if(core.isConflictError(error))
          return{claimed:false,reason:'TAKEN',message:core.friendlyError(error)};
        fail(error);
        return{claimed:false,reason:'ERROR',message:core.friendlyError(error)};
      }
    }

    // ---------------------------------------------------------------
    // Manager-private drawer
    //
    // Shortlists, scouting and draft tactics follow the manager between
    // devices without ever becoming visible to the other player: the row
    // is readable only by its owner, in policy and in the RPC.
    // ---------------------------------------------------------------
    async function savePrivateState(){
      if(!career||!bridge.captureIdentity)return null;
      const identity=bridge.captureIdentity();
      const payload=codec?codec.encode(JSON.stringify(identity)):JSON.stringify(identity);
      const run=()=>rpc('velmora_mp_save_private',
        {p_career_id:career.career_id,p_payload:payload,p_save_schema:saveSchema});
      try{return await run();}
      catch(error){enqueue({key:'private',run});return null;}
    }
    async function loadPrivateState(careerId=career?.career_id){
      if(!careerId)return null;
      try{
        const row=await rpc('velmora_mp_load_private',{p_career_id:careerId});
        if(!row||!row.found)return null;
        return JSON.parse(codec?codec.decode(row.payload):row.payload);
      }catch(_){return null;}
    }

    // ---------------------------------------------------------------
    // Compaction and conflict recovery
    // ---------------------------------------------------------------
    async function maybeCompact(){
      if(eventsSinceSnapshot<snapshotEveryEvents||!career)return;
      eventsSinceSnapshot=0;
      const built=bridge.buildSnapshot();
      try{
        await rpc('velmora_mp_write_snapshot',{
          p_career_id:career.career_id,p_revision:lastSeq,p_snapshot:built.payload,
          p_checksum:built.checksum||'',p_save_schema:Number(built.saveSchema||saveSchema),
          p_career_date:built.careerDate||null
        });
      }catch(_){ /* compaction is an optimisation; the log remains the truth */ }
    }

    async function recoverFromConflict(error){
      const target=core.serverRevisionFromError(error);
      emit({mode:'conflict',label:'SYNCING',
            detail:'The shared career moved on. Bringing this device up to date…'});
      try{
        await pullEvents();
        emit({mode:'online',label:'ONLINE CAREER',detail:'Shared world is up to date.',
              online:true,error:null,revision:target||career?.revision||lastSeq});
      }catch(inner){fail(inner);}
    }

    async function goReadOnly(reason){
      emit({mode:'readonly',label:'READ ONLY',
            detail:reason||'Velmora cannot reach the shared career. You can look around, but changes are paused.',
            online:false,readOnly:true});
    }

    const ready=(async()=>{
      const signedIn=await ensureSignedIn();
      emit(signedIn
        ?{mode:'idle',label:'ONLINE READY',detail:'Signed in. Online careers are available.'}
        :{mode:'idle',label:'SIGN IN REQUIRED',
          detail:'Launch Velmora Manager while signed in at Repo Company to play an online career.'});
      return signedIn;
    })();

    return{
      ready,subscribe,status:snapshotStatus,
      signedIn:()=>!!user,currentUser:()=>user,currentCareer:()=>career,
      listCareers,createCareer,previewCareer,joinCareer,
      claimClub,releaseClub,setReady,startCareer,
      attach,detach,refreshLobby,syncFor,pullEvents,restoreWorld,
      scheduleClubPublish,publishClubState,savePrivateState,loadPrivateState,
      openBarrier,submitMatchState,recordMatchResult,resolveBarrier,claimWorldAction,
      touchPresence,convertToAi,claimHost,leaveCareer,archiveCareer,
      goReadOnly,runQueue,
      // exposed for tests and diagnostics only
      _internals:()=>({lastSeq,queue:queue.length,clubStateRevisions:new Map(clubStateRevisions),myClubId})
    };
  }

  return{create,SUPABASE_URL,SUPABASE_KEY,TABLES:T};
});
