'use strict';

const assert=require('node:assert/strict');
const core=require('../multiplayer-core.js');
const transport=require('../multiplayer-client.js');
const {createServer}=require('./mp/mp_server_memory.cjs');
const {createBridge,makeWorld,hash}=require('./mp/mp_fake_game.cjs');

const noTimers={setTimeout:()=>0,clearTimeout:()=>{}};

async function rpc(client,name,args={}){
  const result=await client.rpc(name,args);
  if(result.error)throw result.error;
  return result.data;
}

async function rows(client,table,filters={}){
  let query=client.from(table).select('*');
  Object.entries(filters).forEach(([key,value])=>{query=query.eq(key,value);});
  const result=await query;
  if(result.error)throw result.error;
  return result.data||[];
}

(async()=>{
  const server=createServer();
  const hostId=server.createUser('host@retry.test','Host');
  const guestId=server.createUser('guest@retry.test','Guest');
  const hostRaw=server.createClient(hostId);
  const guestRaw=server.createClient(guestId);
  const created=await rpc(hostRaw,'velmora_mp_create_career',{
    p_name:'Retry recovery',p_privacy:'INVITE',p_password:null,
    p_game_version:'104.3.0',p_save_schema:86,p_display_name:'Host'
  });
  const careerId=created.career_id;
  await rpc(guestRaw,'velmora_mp_join_career',{
    p_code:created.join_code,p_password:null,p_display_name:'Guest',p_client_version:'104.3.0'
  });
  await rpc(hostRaw,'velmora_mp_claim_club',{
    p_career_id:careerId,p_club_id:'aurelia',p_club_name:'Aurelia',
    p_custom_club:null,p_manager_name:'Host',p_manager_profile:{}
  });
  await rpc(guestRaw,'velmora_mp_claim_club',{
    p_career_id:careerId,p_club_id:'blackglass',p_club_name:'Blackglass',
    p_custom_club:null,p_manager_name:'Guest',p_manager_profile:{}
  });
  await rpc(hostRaw,'velmora_mp_set_ready',{p_career_id:careerId,p_ready:true});
  await rpc(guestRaw,'velmora_mp_set_ready',{p_career_id:careerId,p_ready:true});
  const world=makeWorld();
  const {counters,...snapshot}=world;
  await rpc(hostRaw,'velmora_mp_start_career',{
    p_career_id:careerId,p_world_seed:world.worldSeed,p_career_date:world.date,
    p_season_id:'2026-27',p_snapshot:JSON.stringify(snapshot),
    p_checksum:String(hash(world.date)),p_save_schema:86
  });

  let offline=false;
  const flaky={
    ...hostRaw,
    rpc(name,args){
      if(offline&&name==='velmora_mp_publish_club_state')
        return Promise.resolve({data:null,error:new Error('Failed to fetch: simulated outage')});
      return hostRaw.rpc(name,args);
    }
  };
  const bridge=createBridge({clubId:'aurelia'});
  const client=transport.create({
    core,bridge,client:flaky,session:{user:{id:hostId}},clientVersion:'104.3.0',saveSchema:86,
    codec:{encode:value=>value,decode:value=>value},window:null,...noTimers
  });
  assert.equal((await client.attach(careerId)).ok,true,'the manager attaches before the outage');

  offline=true;
  for(let index=0;index<25;index++){
    bridge._world().clubState.aurelia={marker:`poll-${index}`};
    await client.publishClubState('offline-poll');
  }
  assert.equal(client._internals().queue,1,'offline edits coalesce to one pending club write');
  offline=false;
  await new Promise(resolve=>setImmediate(resolve));
  await client.refreshLobby();
  assert.equal(client._internals().queue,0,'a successful poll drains the retry queue');

  let saved=await rows(hostRaw,'velmora_multiplayer_club_state',{
    career_id:careerId,club_id:'aurelia'
  });
  assert.equal(saved.length,1);
  assert.equal(saved[0].revision,1);
  assert.equal(saved[0].payload.marker,'poll-24','the poll publishes the newest offline state');

  offline=true;
  for(let index=0;index<25;index++){
    bridge._world().clubState.aurelia={marker:`presence-${index}`};
    await client.publishClubState('offline-presence');
  }
  assert.equal(client._internals().queue,1);
  offline=false;
  await new Promise(resolve=>setImmediate(resolve));
  await client.touchPresence('central');
  assert.equal(client._internals().queue,0,'a successful presence heartbeat drains the retry queue');

  saved=await rows(hostRaw,'velmora_multiplayer_club_state',{
    career_id:careerId,club_id:'aurelia'
  });
  assert.equal(saved.length,1);
  assert.equal(saved[0].revision,2);
  assert.equal(saved[0].payload.marker,'presence-24','the heartbeat publishes the newest offline state');
  const events=await rows(hostRaw,'velmora_multiplayer_events',{
    career_id:careerId,kind:'CLUB_STATE'
  });
  assert.equal(events.length,2,'each recovered batch produces exactly one club-state event');

  console.log(JSON.stringify({
    status:'PASS',version:'V104.3',offlineEdits:50,publishedWrites:2,finalRevision:2,
    checks:[
      'offline club edits coalesce to one queued write',
      'a successful sync poll wakes the retry queue',
      'a successful presence heartbeat wakes the retry queue',
      'only the newest offline state is published',
      'each recovered batch creates exactly one revision and event'
    ]
  },null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
