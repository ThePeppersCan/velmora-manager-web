'use strict';

const assert=require('node:assert/strict');
const {performance}=require('node:perf_hooks');
const core=require('../multiplayer-core.js');
const transport=require('../multiplayer-client.js');
const scenarios=require('./mp/mp_scenarios.cjs');
const {createServer}=require('./mp/mp_server_memory.cjs');
const {createBridge,makeWorld,hash}=require('./mp/mp_fake_game.cjs');

const SCENARIO_ITERATIONS=Number(process.env.VELMORA_STRESS_SCENARIOS||500);
const RACE_WIDTH=Number(process.env.VELMORA_STRESS_RACE_WIDTH||1000);
const EVENT_FLOOD=Number(process.env.VELMORA_STRESS_EVENTS||19500);
const RECONNECT_CLIENTS=Number(process.env.VELMORA_STRESS_RECONNECTS||12);
const OFFLINE_EDITS=Number(process.env.VELMORA_STRESS_OFFLINE_EDITS||250);
const noTimers={setTimeout:()=>0,clearTimeout:()=>{}};

function backendFor(server){
  return{
    async reset(){server.reset();},
    async createUser(email,name){return server.createUser(email,name);},
    clientFor(userId){return server.createClient(userId);},
    async rpc(userId,name,args){
      return rpc(server.createClient(userId),name,args);
    },
    async rawSelect(userId,table,filters={}){
      let query=server.createClient(userId).from(table).select('*');
      Object.entries(filters).forEach(([key,value])=>{query=query.eq(key,value);});
      const result=await query;
      return result.data||[];
    }
  };
}

async function rpc(client,name,args={}){
  const result=await client.rpc(name,args);
  if(result.error)throw result.error;
  return result.data;
}

async function setupCareer({clientFactory=null}={}){
  const server=createServer();
  const hostId=server.createUser('host@stress.test','Host');
  const guestId=server.createUser('guest@stress.test','Guest');
  const hostRaw=(clientFactory||((id)=>server.createClient(id)))(hostId,server);
  const guestRaw=(clientFactory||((id)=>server.createClient(id)))(guestId,server);
  const created=await rpc(hostRaw,'velmora_mp_create_career',{
    p_name:'Stress Career',p_privacy:'INVITE',p_password:null,
    p_game_version:'104.3.0',p_save_schema:86,p_display_name:'Host'
  });
  await rpc(guestRaw,'velmora_mp_join_career',{
    p_code:created.join_code,p_password:null,p_display_name:'Guest',p_client_version:'104.3.0'
  });
  await rpc(hostRaw,'velmora_mp_claim_club',{
    p_career_id:created.career_id,p_club_id:'aurelia',p_club_name:'Aurelia',
    p_custom_club:null,p_manager_name:'Host',p_manager_profile:{}
  });
  await rpc(guestRaw,'velmora_mp_claim_club',{
    p_career_id:created.career_id,p_club_id:'blackglass',p_club_name:'Blackglass',
    p_custom_club:null,p_manager_name:'Guest',p_manager_profile:{}
  });
  await rpc(hostRaw,'velmora_mp_set_ready',{p_career_id:created.career_id,p_ready:true});
  await rpc(guestRaw,'velmora_mp_set_ready',{p_career_id:created.career_id,p_ready:true});
  const world=makeWorld();
  const {counters,...snapshot}=world;
  await rpc(hostRaw,'velmora_mp_start_career',{
    p_career_id:created.career_id,p_world_seed:world.worldSeed,
    p_career_date:world.date,p_season_id:'2026-27',p_snapshot:JSON.stringify(snapshot),
    p_checksum:String(hash(world.date)),p_save_schema:86
  });
  return{server,hostId,guestId,hostRaw,guestRaw,careerId:created.career_id};
}

function makeTransport(raw,userId,bridge=createBridge()){
  return transport.create({
    core,bridge,client:raw,session:{user:{id:userId}},clientVersion:'104.3.0',saveSchema:86,
    codec:{encode:value=>value,decode:value=>value},window:null,...noTimers
  });
}

async function select(raw,table,filters={}){
  let query=raw.from(table).select('*');
  Object.entries(filters).forEach(([key,value])=>{query=query.eq(key,value);});
  const result=await query;
  if(result.error)throw result.error;
  return result.data||[];
}

async function runRepeatedScenarios(){
  const server=createServer();
  const backend=backendFor(server);
  const started=performance.now();
  for(let iteration=1;iteration<=SCENARIO_ITERATIONS;iteration++){
    const result=await scenarios.run(backend);
    assert.equal(result.length,28,`scenario count changed on iteration ${iteration}`);
    assert.equal(result.every(row=>row.status==='PASS'),true,`scenario failure on iteration ${iteration}`);
  }
  return{
    iterations:SCENARIO_ITERATIONS,
    scenarioChecks:SCENARIO_ITERATIONS*28,
    elapsedMs:Math.round(performance.now()-started)
  };
}

async function runResultRace(){
  const env=await setupCareer();
  const calls=Array.from({length:RACE_WIDTH},(_,index)=>{
    const raw=index%2?env.hostRaw:env.guestRaw;
    return raw.rpc('velmora_mp_record_match_result',{
      p_career_id:env.careerId,p_fixture_id:'RACE-FIXTURE',p_career_date:'2026-08-08',
      p_home_club_id:'aurelia',p_away_club_id:'blackglass',
      p_home_score:index%7,p_away_score:(index*3)%7,
      p_result:{attempt:index},p_resolution_mode:'QUICK_SIM'
    });
  });
  const replies=await Promise.all(calls);
  assert.equal(replies.every(row=>!row.error),true,'a match-result retry returned an error');
  const values=replies.map(row=>row.data);
  assert.equal(values.filter(row=>row.first_write).length,1,'more than one match result won');
  assert.equal(new Set(values.map(row=>`${row.home_score}:${row.away_score}`)).size,1,
    'callers did not receive one canonical score');
  const rows=await select(env.hostRaw,'velmora_multiplayer_match_results',{
    career_id:env.careerId,fixture_id:'RACE-FIXTURE'
  });
  const events=await select(env.hostRaw,'velmora_multiplayer_events',{
    career_id:env.careerId,fixture_id:'RACE-FIXTURE'
  });
  assert.equal(rows.length,1);
  assert.equal(events.filter(row=>row.kind==='MATCH_RESULT').length,1);
  return{contenders:RACE_WIDTH,canonicalRows:rows.length,canonicalEvents:events.length};
}

async function runBarrierRace(){
  const env=await setupCareer();
  await rpc(env.hostRaw,'velmora_mp_open_barrier',{
    p_career_id:env.careerId,p_career_date:'2026-09-01',p_required:[]
  });
  const replies=await Promise.all(Array.from({length:RACE_WIDTH},(_,index)=>{
    const raw=index%2?env.hostRaw:env.guestRaw;
    return raw.rpc('velmora_mp_resolve_barrier',{
      p_career_id:env.careerId,p_career_date:'2026-09-01',p_next_date:'2026-09-02'
    });
  }));
  assert.equal(replies.every(row=>!row.error),true,'a barrier retry returned an error');
  const values=replies.map(row=>row.data);
  assert.equal(values.filter(row=>row.first_resolver).length,1,'more than one barrier resolver won');
  assert.equal(values.every(row=>row.status==='RESOLVED'),true,'a caller saw an unresolved barrier');
  const events=await select(env.hostRaw,'velmora_multiplayer_events',{
    career_id:env.careerId,kind:'DAY_ADVANCE'
  });
  assert.equal(events.length,1,'the barrier wrote more than one day advance');
  return{contenders:RACE_WIDTH,firstResolvers:1,dayAdvanceEvents:events.length};
}

async function runSubjectAndRetryRaces(){
  const env=await setupCareer();
  const subjectReplies=await Promise.all(Array.from({length:RACE_WIDTH},(_,index)=>{
    const raw=index%2?env.hostRaw:env.guestRaw;
    return raw.rpc('velmora_mp_claim_world_action',{
      p_career_id:env.careerId,p_kind:'TRANSFER',p_subject_key:'PLAYER:stress-player:window',
      p_payload:{attempt:index},p_idempotency_key:`stress-claim-${index}`,p_club_id:null
    });
  }));
  assert.equal(subjectReplies.filter(row=>!row.error).length,1,'more than one subject claim won');
  assert.equal(subjectReplies.filter(row=>/VELMORA_SUBJECT_TAKEN/.test(row.error?.message||'')).length,
    RACE_WIDTH-1,'subject losers were not consistently rejected');

  const retryReplies=await Promise.all(Array.from({length:RACE_WIDTH},(_,index)=>{
    const raw=index%2?env.hostRaw:env.guestRaw;
    return raw.rpc('velmora_mp_append_event',{
      p_career_id:env.careerId,p_kind:'WORLD_ACTION',p_payload:{stable:true},
      p_idempotency_key:'same-network-retry',p_subject_key:null,
      p_club_id:null,p_fixture_id:null,p_expect_revision:null
    });
  }));
  assert.equal(retryReplies.every(row=>!row.error),true,'an idempotent retry was rejected');
  assert.equal(retryReplies.map(row=>row.data).filter(row=>!row.replayed).length,1,
    'the retry storm created more than one original event');
  const events=await select(env.hostRaw,'velmora_multiplayer_events',{career_id:env.careerId});
  assert.equal(events.filter(row=>row.idempotency_key==='same-network-retry').length,1);
  return{
    subjectContenders:RACE_WIDTH,subjectWinners:1,subjectLosers:RACE_WIDTH-1,
    identicalRetries:RACE_WIDTH,originalEvents:1
  };
}

async function runClubRevisionRace(){
  const env=await setupCareer();
  const round=async(expect,prefix)=>Promise.all(Array.from({length:RACE_WIDTH},(_,index)=>
    env.hostRaw.rpc('velmora_mp_publish_club_state',{
      p_career_id:env.careerId,p_club_id:'aurelia',p_payload:{marker:`${prefix}-${index}`},
      p_expect_revision:expect
    })
  ));
  const first=await round(0,'first');
  const second=await round(1,'second');
  for(const [label,replies] of [['first',first],['second',second]]){
    assert.equal(replies.filter(row=>!row.error).length,1,`${label} revision race had multiple winners`);
    assert.equal(replies.filter(row=>/VELMORA_STALE_CLUB_STATE/.test(row.error?.message||'')).length,
      RACE_WIDTH-1,`${label} revision race did not reject every stale writer`);
  }
  const rows=await select(env.hostRaw,'velmora_multiplayer_club_state',{
    career_id:env.careerId,club_id:'aurelia'
  });
  assert.equal(rows.length,1);
  assert.equal(rows[0].revision,2,'club revision did not advance exactly twice');
  const events=await select(env.hostRaw,'velmora_multiplayer_events',{
    career_id:env.careerId,kind:'CLUB_STATE'
  });
  assert.equal(events.length,2,'stale club writes leaked into the event log');
  return{attempts:RACE_WIDTH*2,winners:2,staleRejected:(RACE_WIDTH-1)*2,finalRevision:2};
}

async function runEventFloodAndReconnects(){
  const env=await setupCareer();
  const started=performance.now();
  const batchSize=250;
  for(let offset=0;offset<EVENT_FLOOD;offset+=batchSize){
    const count=Math.min(batchSize,EVENT_FLOOD-offset);
    const replies=await Promise.all(Array.from({length:count},(_,inner)=>{
      const index=offset+inner;
      const raw=index%2?env.hostRaw:env.guestRaw;
      return raw.rpc('velmora_mp_append_event',{
        p_career_id:env.careerId,p_kind:'WORLD_ACTION',p_payload:{index},
        p_idempotency_key:`flood-${index}`,p_subject_key:null,
        p_club_id:null,p_fixture_id:null,p_expect_revision:null
      });
    }));
    assert.equal(replies.every(row=>!row.error),true,`event flood failed at offset ${offset}`);
  }
  const events=await select(env.hostRaw,'velmora_multiplayer_events',{career_id:env.careerId});
  assert.equal(events.length,EVENT_FLOOD+1,'event log lost or duplicated rows');
  assert.equal(events.every((row,index)=>row.seq===index+1),true,'event sequence contains a gap');

  const applied=Array(RECONNECT_CLIENTS).fill(0);
  const sessions=Array.from({length:RECONNECT_CLIENTS},(_,index)=>{
    const bridge=createBridge({clubId:index%2?'aurelia':'blackglass'});
    bridge.applyWorldAction=()=>{applied[index]++;return true;};
    const userId=index%2?env.hostId:env.guestId;
    return makeTransport(env.server.createClient(userId),userId,bridge);
  });
  const attached=await Promise.all(sessions.map(client=>client.attach(env.careerId)));
  assert.equal(attached.every(row=>row.ok),true,'a reconnecting client failed to attach');
  const finalSeq=EVENT_FLOOD+1;
  sessions.forEach((client,index)=>{
    assert.equal(client._internals().lastSeq,finalSeq,`client ${index} stopped before the log tail`);
    assert.equal(applied[index],EVENT_FLOOD,`client ${index} missed or duplicated world actions`);
  });
  await Promise.all(sessions.map(client=>client.pullEvents()));
  sessions.forEach((client,index)=>{
    assert.equal(client._internals().lastSeq,finalSeq);
    assert.equal(applied[index],EVENT_FLOOD,'a repeat pull replayed an event');
  });
  return{
    events:EVENT_FLOOD,sequenceStart:1,sequenceEnd:finalSeq,
    reconnectingClients:RECONNECT_CLIENTS,eventApplications:EVENT_FLOOD*RECONNECT_CLIENTS,
    elapsedMs:Math.round(performance.now()-started)
  };
}

async function runOfflineCoalescing(){
  let offline=false;
  let flakyRaw=null;
  const env=await setupCareer({clientFactory:(id,server)=>{
    const raw=server.createClient(id);
    const wrapped={
      ...raw,
      rpc(name,args){
        if(offline&&name==='velmora_mp_publish_club_state')
          return Promise.resolve({data:null,error:new Error('Failed to fetch: simulated outage')});
        return raw.rpc(name,args);
      }
    };
    if(!flakyRaw)flakyRaw=wrapped;
    return wrapped;
  }});
  const bridge=createBridge({clubId:'aurelia'});
  const client=makeTransport(flakyRaw,env.hostId,bridge);
  assert.equal((await client.attach(env.careerId)).ok,true);
  offline=true;
  for(let index=0;index<OFFLINE_EDITS;index++){
    bridge._world().clubState.aurelia={marker:`offline-${index}`};
    await client.publishClubState('stress-offline');
  }
  assert.equal(client._internals().queue,1,'offline club edits did not coalesce to one queued write');
  offline=false;
  // Let the failed background drain finish, then mimic the client's normal
  // six-second recovery poll. The successful heartbeat must wake the queue.
  await new Promise(resolve=>setImmediate(resolve));
  await client.refreshLobby();
  assert.equal(client._internals().queue,0,'the queued write did not drain after reconnect');
  const rows=await select(env.hostRaw,'velmora_multiplayer_club_state',{
    career_id:env.careerId,club_id:'aurelia'
  });
  assert.equal(rows.length,1);
  assert.equal(rows[0].revision,1);
  assert.equal(rows[0].payload.marker,`offline-${OFFLINE_EDITS-1}`,
    'reconnect did not preserve the newest offline club state');
  return{offlineEdits:OFFLINE_EDITS,queuedWrites:1,publishedWrites:1,newestStatePreserved:true};
}

(async()=>{
  const started=performance.now();
  const report={
    repeatedCareers:await runRepeatedScenarios(),
    matchResultContention:await runResultRace(),
    barrierContention:await runBarrierRace(),
    exclusivityAndRetries:await runSubjectAndRetryRaces(),
    clubRevisionContention:await runClubRevisionRace(),
    eventFloodAndReconnects:await runEventFloodAndReconnects(),
    offlineCoalescing:await runOfflineCoalescing()
  };
  console.log(JSON.stringify({
    status:'PASS',
    backend:'in-process contract implementation',
    durationMs:Math.round(performance.now()-started),
    ...report
  },null,2));
})().catch(error=>{
  console.error(JSON.stringify({status:'FAIL',error:error.stack||error.message||String(error)},null,2));
  process.exitCode=1;
});
