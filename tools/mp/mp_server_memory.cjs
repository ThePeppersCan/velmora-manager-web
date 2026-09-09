'use strict';
// An in-process implementation of the same contract as
// supabase-velmora-manager-multiplayer.sql, so the online-career scenarios
// can run anywhere `node` runs -- including a machine with no database.
//
// It is held to the identical scenario suite as the real PostgreSQL backend
// (tools/test_v104_multiplayer_database.cjs), so any divergence between this
// and the shipped SQL shows up as a failing scenario on one side or the other.
//
// Every call yields once before it mutates, so two overlapping requests
// genuinely interleave and the check-then-act paths are exercised rather
// than accidentally serialised.

const tick=()=>new Promise(resolve=>setImmediate(resolve));

function err(message,code){const e=new Error(message);e.code=code;return e;}
const CODE_ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function createServer(){
  const db={
    users:new Map(),
    careers:new Map(),
    members:new Map(),          // careerId -> Map(userId -> row)
    profiles:new Map(),
    privates:new Map(),
    claims:new Map(),           // careerId -> Map(clubId -> row)
    clubState:new Map(),        // careerId -> Map(clubId -> row)
    events:new Map(),           // careerId -> [rows]
    snapshots:new Map(),        // careerId -> Map(revision -> row)
    barriers:new Map(),         // careerId -> Map(date -> row)
    submissions:new Map(),      // careerId -> Map(`${fixture}:${user}` -> row)
    results:new Map(),          // careerId -> Map(fixtureId -> row)
    presence:new Map(),
    audit:new Map(),
    invitations:new Map()
  };
  let codeCounter=0;

  const bucket=(map,key)=>{if(!map.has(key))map.set(key,new Map());return map.get(key);};
  const list=(map,key)=>{if(!map.has(key))map.set(key,[]);return map.get(key);};

  function newCode(){
    codeCounter++;
    let value='',n=codeCounter*7919;
    for(let i=0;i<6;i++){value+=CODE_ALPHABET[n%CODE_ALPHABET.length];n=Math.floor(n/7)+i*31+13;}
    return value;
  }
  function careerOr404(id){
    const row=db.careers.get(id);
    if(!row)throw err('VELMORA_CAREER_UNKNOWN','P0002');
    return row;
  }
  function memberRow(careerId,userId){return bucket(db.members,careerId).get(userId)||null;}
  function isMember(careerId,userId){
    const row=memberRow(careerId,userId);
    return!!row&&['ACTIVE','AI_CONTROLLED'].includes(row.status);
  }
  function isActive(careerId,userId){
    const row=memberRow(careerId,userId);
    return!!row&&row.status==='ACTIVE';
  }
  function isHost(careerId,userId){
    const row=memberRow(careerId,userId);
    return!!row&&row.role==='HOST'&&row.status==='ACTIVE';
  }
  function ownsClub(careerId,userId,clubId){
    const row=bucket(db.claims,careerId).get(String(clubId));
    return!!row&&row.user_id===userId;
  }
  function requireActive(careerId,userId){
    if(!userId)throw err('VELMORA_NOT_SIGNED_IN','42501');
    if(!isActive(careerId,userId))throw err('VELMORA_NOT_A_MEMBER','42501');
  }
  function audit(careerId,action,actor,target,detail){
    list(db.audit,careerId).push({career_id:careerId,action,actor_user_id:actor,
      target_user_id:target||null,detail:detail||{},created_at:new Date().toISOString()});
  }

  // ---- the ordered, gap-free event log -------------------------------
  function appendEvent(uid,{careerId,kind,payload={},idempotencyKey,subjectKey=null,
                            clubId=null,fixtureId=null,expectRevision=null}){
    requireActive(careerId,uid);
    const rows=list(db.events,careerId);
    const key=idempotencyKey||`auto-${rows.length}-${Math.random()}`;
    const replay=rows.find(row=>row.idempotency_key===key);
    if(replay)return{seq:replay.seq,kind:replay.kind,replayed:true,
      payload:replay.payload,subject_key:replay.subject_key};

    const career=careerOr404(careerId);
    if(career.status==='ARCHIVED')throw err('VELMORA_CAREER_ARCHIVED','42501');
    if(expectRevision!==null&&expectRevision!==undefined&&Number(expectRevision)!==career.revision)
      throw err(`VELMORA_STALE_REVISION:${career.revision}`,'40001');
    if(subjectKey&&rows.some(row=>row.subject_key===subjectKey))
      throw err(`VELMORA_SUBJECT_TAKEN:${subjectKey}`,'23505');

    career.revision+=1;
    career.updated_at=new Date().toISOString();
    const event={career_id:careerId,seq:career.revision,kind,actor_user_id:uid,club_id:clubId,
      fixture_id:fixtureId,subject_key:subjectKey,idempotency_key:key,payload,
      created_at:new Date().toISOString()};
    rows.push(event);
    return{seq:event.seq,kind,replayed:false,payload,subject_key:subjectKey,revision:career.revision};
  }

  const rpcs={
    async velmora_mp_create_career(uid,a){
      if(!uid)throw err('VELMORA_NOT_SIGNED_IN','42501');
      if(!a.p_name||!String(a.p_name).trim())throw err('VELMORA_NAME_REQUIRED','22023');
      await tick();
      const id=`career-${db.careers.size+1}-${Date.now().toString(36)}`;
      const code=newCode();
      const career={id,name:String(a.p_name).trim(),
        privacy:String(a.p_privacy||'INVITE').toUpperCase()==='PRIVATE'?'PRIVATE':'INVITE',
        host_user_id:uid,join_code:code,
        password_hash:a.p_password?`h:${a.p_password}`:null,
        max_members:2,status:'LOBBY',game_version:a.p_game_version||'0.0.0',
        save_schema:Number(a.p_save_schema||0),world_seed:null,career_date:null,season_id:null,
        revision:0,snapshot_revision:0,schema_version:1,
        created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
      db.careers.set(id,career);
      bucket(db.members,id).set(uid,{career_id:id,user_id:uid,role:'HOST',status:'ACTIVE',
        display_name:a.p_display_name||'Manager',ready:false,client_version:a.p_game_version||null,
        joined_at:new Date().toISOString(),last_seen_at:new Date().toISOString()});
      list(db.invitations,id).push({career_id:id,code,created_by:uid,uses:0,max_uses:1});
      audit(id,'CAREER_CREATED',uid,null,{name:career.name,privacy:career.privacy});
      return{career_id:id,name:career.name,join_code:code,privacy:career.privacy,
        status:career.status,revision:0,max_members:2,game_version:career.game_version,
        requires_password:!!career.password_hash};
    },

    async velmora_mp_preview_career(uid,a){
      if(!uid)throw err('VELMORA_NOT_SIGNED_IN','42501');
      await tick();
      const career=[...db.careers.values()]
        .find(row=>row.join_code===String(a.p_code||'').toUpperCase().trim());
      if(!career)throw err('VELMORA_CODE_UNKNOWN','P0002');
      if(career.status==='ARCHIVED')throw err('VELMORA_CAREER_ARCHIVED','P0002');
      const members=[...bucket(db.members,career.id).values()];
      return{career_id:career.id,name:career.name,
        host_name:(members.find(row=>row.role==='HOST')||{}).display_name||'Host',
        status:career.status,members:members.filter(row=>row.status==='ACTIVE').length,
        max_members:career.max_members,game_version:career.game_version,
        save_schema:career.save_schema,career_date:career.career_date,season_id:career.season_id,
        requires_password:!!career.password_hash,
        already_member:isMember(career.id,uid),
        claimed_club_ids:[...bucket(db.claims,career.id).keys()]};
    },

    async velmora_mp_join_career(uid,a){
      if(!uid)throw err('VELMORA_NOT_SIGNED_IN','42501');
      await tick();
      const career=[...db.careers.values()]
        .find(row=>row.join_code===String(a.p_code||'').toUpperCase().trim());
      if(!career)throw err('VELMORA_CODE_UNKNOWN','P0002');
      if(career.status==='ARCHIVED')throw err('VELMORA_CAREER_ARCHIVED','P0002');
      if(career.password_hash&&career.password_hash!==`h:${a.p_password||''}`)
        throw err('VELMORA_BAD_PASSWORD','42501');
      const members=bucket(db.members,career.id);
      if(isMember(career.id,uid)){
        members.get(uid).last_seen_at=new Date().toISOString();
        return{career_id:career.id,rejoined:true,status:career.status};
      }
      if([...members.values()].filter(row=>row.status==='ACTIVE').length>=career.max_members)
        throw err('VELMORA_CAREER_FULL','23505');
      members.set(uid,{career_id:career.id,user_id:uid,role:'MANAGER',status:'ACTIVE',
        display_name:a.p_display_name||'Manager',ready:false,
        client_version:a.p_client_version||null,
        joined_at:new Date().toISOString(),last_seen_at:new Date().toISOString()});
      audit(career.id,'MEMBER_JOINED',uid,null,{display_name:a.p_display_name});
      return{career_id:career.id,rejoined:false,status:career.status};
    },

    async velmora_mp_claim_club(uid,a){
      requireActive(a.p_career_id,uid);
      if(!a.p_club_id)throw err('VELMORA_CLUB_REQUIRED','22023');
      await tick();
      const claims=bucket(db.claims,a.p_career_id);
      const held=claims.get(String(a.p_club_id));
      if(held&&held.user_id!==uid)throw err('VELMORA_CLUB_TAKEN','23505');
      [...claims.entries()].forEach(([clubId,row])=>{
        if(row.user_id===uid&&clubId!==String(a.p_club_id))claims.delete(clubId);
      });
      claims.set(String(a.p_club_id),{career_id:a.p_career_id,club_id:String(a.p_club_id),
        user_id:uid,club_name:a.p_club_name||'',custom_club:a.p_custom_club||null,
        claimed_at:new Date().toISOString()});
      bucket(db.profiles,a.p_career_id).set(uid,{career_id:a.p_career_id,user_id:uid,
        manager_name:a.p_manager_name||'Career Manager',profile:a.p_manager_profile||{},
        updated_at:new Date().toISOString()});
      audit(a.p_career_id,'CLUB_CLAIMED',uid,null,{club_id:a.p_club_id,club_name:a.p_club_name});
      return{career_id:a.p_career_id,club_id:a.p_club_id,user_id:uid};
    },

    async velmora_mp_release_club(uid,a){
      requireActive(a.p_career_id,uid);
      await tick();
      const claims=bucket(db.claims,a.p_career_id);
      let released=null;
      [...claims.entries()].forEach(([clubId,row])=>{if(row.user_id===uid){released=clubId;claims.delete(clubId);}});
      const member=memberRow(a.p_career_id,uid);
      if(member)member.ready=false;
      return{released_club_id:released};
    },

    async velmora_mp_set_ready(uid,a){
      requireActive(a.p_career_id,uid);
      const holds=[...bucket(db.claims,a.p_career_id).values()].some(row=>row.user_id===uid);
      if(a.p_ready&&!holds)throw err('VELMORA_CLUB_REQUIRED','22023');
      await tick();
      memberRow(a.p_career_id,uid).ready=!!a.p_ready;
      return{ready:!!a.p_ready};
    },

    async velmora_mp_start_career(uid,a){
      if(!isHost(a.p_career_id,uid))throw err('VELMORA_HOST_ONLY','42501');
      await tick();
      const career=careerOr404(a.p_career_id);
      if(career.status==='ACTIVE')
        return{career_id:career.id,status:'ACTIVE',already_started:true,revision:career.revision};
      if(career.status==='ARCHIVED')throw err('VELMORA_CAREER_ARCHIVED','42501');
      const members=[...bucket(db.members,career.id).values()].filter(row=>row.status==='ACTIVE');
      const claims=[...bucket(db.claims,career.id).values()];
      if(members.some(row=>!row.ready||!claims.some(claim=>claim.user_id===row.user_id)))
        throw err('VELMORA_MANAGERS_NOT_READY','22023');
      career.status='ACTIVE';
      career.world_seed=a.p_world_seed;
      career.career_date=a.p_career_date;
      career.season_id=a.p_season_id;
      career.save_schema=Number(a.p_save_schema||career.save_schema);
      career.started_at=new Date().toISOString();
      bucket(db.snapshots,career.id).set(career.revision,{career_id:career.id,
        revision:career.revision,payload:a.p_snapshot,bytes:String(a.p_snapshot||'').length,
        checksum:a.p_checksum||'',save_schema:career.save_schema,career_date:a.p_career_date,
        created_by:uid,created_at:new Date().toISOString()});
      career.snapshot_revision=Math.max(career.snapshot_revision,career.revision);
      appendEvent(uid,{careerId:career.id,kind:'CAREER_STARTED',
        payload:{world_seed:a.p_world_seed,career_date:a.p_career_date,season_id:a.p_season_id},
        idempotencyKey:`career-started:${career.id}`,subjectKey:'CAREER_STARTED'});
      audit(career.id,'CAREER_STARTED',uid,null,{career_date:a.p_career_date});
      return{career_id:career.id,status:'ACTIVE',already_started:false,revision:career.revision};
    },

    async velmora_mp_append_event(uid,a){
      await tick();
      return appendEvent(uid,{careerId:a.p_career_id,kind:a.p_kind,payload:a.p_payload||{},
        idempotencyKey:a.p_idempotency_key,subjectKey:a.p_subject_key,clubId:a.p_club_id,
        fixtureId:a.p_fixture_id,expectRevision:a.p_expect_revision});
    },

    async velmora_mp_publish_club_state(uid,a){
      requireActive(a.p_career_id,uid);
      if(!ownsClub(a.p_career_id,uid,a.p_club_id))throw err('VELMORA_NOT_YOUR_CLUB','42501');
      await tick();
      const states=bucket(db.clubState,a.p_career_id);
      const current=states.get(String(a.p_club_id));
      const expect=a.p_expect_revision;
      if(!current){
        if(expect!==null&&expect!==undefined&&Number(expect)!==0)
          throw err('VELMORA_STALE_CLUB_STATE:0','40001');
        states.set(String(a.p_club_id),{career_id:a.p_career_id,club_id:String(a.p_club_id),
          revision:1,payload:a.p_payload||{},updated_by:uid,updated_at:new Date().toISOString()});
      }else{
        if(expect!==null&&expect!==undefined&&Number(expect)!==current.revision)
          throw err(`VELMORA_STALE_CLUB_STATE:${current.revision}`,'40001');
        current.revision+=1;
        current.payload=a.p_payload||{};
        current.updated_by=uid;
        current.updated_at=new Date().toISOString();
      }
      const next=states.get(String(a.p_club_id)).revision;
      appendEvent(uid,{careerId:a.p_career_id,kind:'CLUB_STATE',
        payload:{club_id:String(a.p_club_id),club_revision:next},
        idempotencyKey:`club:${a.p_club_id}:${next}`,clubId:String(a.p_club_id)});
      memberRow(a.p_career_id,uid).last_seen_at=new Date().toISOString();
      return{club_id:a.p_club_id,revision:next};
    },

    async velmora_mp_write_snapshot(uid,a){
      if(!isMember(a.p_career_id,uid))throw err('VELMORA_NOT_A_MEMBER','42501');
      await tick();
      const career=careerOr404(a.p_career_id);
      if(Number(a.p_revision)>career.revision)
        throw err(`VELMORA_SNAPSHOT_AHEAD:${career.revision}`,'40001');
      if(Number(a.p_revision)<=career.snapshot_revision)
        return{written:false,snapshot_revision:career.snapshot_revision};
      const snaps=bucket(db.snapshots,a.p_career_id);
      snaps.set(Number(a.p_revision),{career_id:a.p_career_id,revision:Number(a.p_revision),
        payload:a.p_snapshot,bytes:String(a.p_snapshot||'').length,checksum:a.p_checksum||'',
        save_schema:Number(a.p_save_schema||0),career_date:a.p_career_date,created_by:uid,
        created_at:new Date().toISOString()});
      career.snapshot_revision=Number(a.p_revision);
      if(a.p_career_date)career.career_date=a.p_career_date;
      [...snaps.keys()].sort((x,y)=>y-x).slice(3).forEach(key=>snaps.delete(key));
      return{written:true,snapshot_revision:career.snapshot_revision};
    },

    async velmora_mp_fetch_snapshot(uid,a){
      if(!isMember(a.p_career_id,uid))throw err('VELMORA_NOT_A_MEMBER','42501');
      await tick();
      const snaps=bucket(db.snapshots,a.p_career_id);
      const revision=a.p_revision!==null&&a.p_revision!==undefined
        ?Number(a.p_revision):[...snaps.keys()].sort((x,y)=>y-x)[0];
      const row=snaps.get(revision);
      if(!row)return{found:false};
      return{found:true,revision:row.revision,payload:row.payload,checksum:row.checksum,
        save_schema:row.save_schema,career_date:row.career_date,bytes:row.bytes};
    },

    async velmora_mp_open_barrier(uid,a){
      requireActive(a.p_career_id,uid);
      await tick();
      const barriers=bucket(db.barriers,a.p_career_id);
      const existing=barriers.get(a.p_career_date);
      if(existing)return{career_date:existing.career_date,status:existing.status,
        required:existing.required,created:false};
      const claims=bucket(db.claims,a.p_career_id);
      const clean=(a.p_required||[]).filter(row=>{
        const claim=claims.get(String(row.club_id));
        const member=memberRow(a.p_career_id,row.user_id);
        return!!claim&&claim.user_id===row.user_id&&!!member&&member.status==='ACTIVE'&&!!row.fixture_id;
      });
      barriers.set(a.p_career_date,{career_id:a.p_career_id,career_date:a.p_career_date,
        status:'OPEN',required:clean,opened_by:uid,opened_at:new Date().toISOString(),
        resolved_by:null,resolved_at:null,resolution_seq:null,next_date:null});
      appendEvent(uid,{careerId:a.p_career_id,kind:'BARRIER_OPENED',
        payload:{career_date:a.p_career_date,required:clean},
        idempotencyKey:`barrier-open:${a.p_career_date}`,subjectKey:`BARRIER:${a.p_career_date}`});
      return{career_date:a.p_career_date,status:'OPEN',required:clean,created:true};
    },

    async velmora_mp_submit_match_state(uid,a){
      requireActive(a.p_career_id,uid);
      if(!ownsClub(a.p_career_id,uid,a.p_club_id))throw err('VELMORA_NOT_YOUR_CLUB','42501');
      const state=String(a.p_state||'PREPARING').toUpperCase();
      if(!['PREPARING','READY','PLAYING','COMPLETED'].includes(state))
        throw err('VELMORA_BAD_STATE','22023');
      await tick();
      const subs=bucket(db.submissions,a.p_career_id);
      const key=`${a.p_fixture_id}:${uid}`;
      const existing=subs.get(key);
      const resolved=bucket(db.results,a.p_career_id).has(a.p_fixture_id);
      const opponentCommitted=[...subs.values()].some(row=>
        row.fixture_id===a.p_fixture_id&&row.user_id!==uid&&
        ['READY','PLAYING','COMPLETED'].includes(row.state));

      if(existing&&existing.state==='COMPLETED')
        return{fixture_id:a.p_fixture_id,state:'COMPLETED',frozen:true};
      if(resolved||(opponentCommitted&&existing&&['READY','PLAYING','COMPLETED'].includes(existing.state)))
        return{fixture_id:a.p_fixture_id,state:existing?existing.state:state,frozen:true};

      subs.set(key,{career_id:a.p_career_id,fixture_id:a.p_fixture_id,user_id:uid,
        club_id:a.p_club_id,career_date:a.p_career_date||existing?.career_date||null,state,
        lineup:a.p_lineup||{},tactics:a.p_tactics||{},
        locked_at:['READY','PLAYING','COMPLETED'].includes(state)?new Date().toISOString():null,
        updated_at:new Date().toISOString()});
      memberRow(a.p_career_id,uid).last_seen_at=new Date().toISOString();
      return{fixture_id:a.p_fixture_id,state,frozen:false};
    },

    async velmora_mp_record_match_result(uid,a){
      requireActive(a.p_career_id,uid);
      const results=bucket(db.results,a.p_career_id);
      const early=results.get(a.p_fixture_id);
      if(early)return{fixture_id:early.fixture_id,authoritative:early.result,
        home_score:early.home_score,away_score:early.away_score,event_seq:early.event_seq,
        first_write:false,resolved_by:early.resolved_by};
      await tick();
      const again=results.get(a.p_fixture_id);
      if(again)return{fixture_id:again.fixture_id,authoritative:again.result,
        home_score:again.home_score,away_score:again.away_score,event_seq:again.event_seq,
        first_write:false,resolved_by:again.resolved_by};

      const event=appendEvent(uid,{careerId:a.p_career_id,kind:'MATCH_RESULT',
        payload:{fixture_id:a.p_fixture_id,home_score:Number(a.p_home_score||0),
          away_score:Number(a.p_away_score||0),result:a.p_result||{},
          resolution_mode:a.p_resolution_mode||'QUICK_SIM'},
        idempotencyKey:`result:${a.p_fixture_id}`,subjectKey:`FIXTURE:${a.p_fixture_id}`,
        fixtureId:a.p_fixture_id});
      const row={career_id:a.p_career_id,fixture_id:a.p_fixture_id,career_date:a.p_career_date,
        home_club_id:a.p_home_club_id,away_club_id:a.p_away_club_id,
        home_score:Math.max(0,Number(a.p_home_score||0)),away_score:Math.max(0,Number(a.p_away_score||0)),
        result:a.p_result||{},resolved_by:uid,resolution_mode:a.p_resolution_mode||'QUICK_SIM',
        event_seq:event.seq,created_at:new Date().toISOString()};
      results.set(a.p_fixture_id,row);
      bucket(db.submissions,a.p_career_id).forEach(sub=>{
        if(sub.fixture_id===a.p_fixture_id)sub.state='COMPLETED';
      });
      return{fixture_id:row.fixture_id,authoritative:row.result,home_score:row.home_score,
        away_score:row.away_score,event_seq:row.event_seq,first_write:true,resolved_by:uid};
    },

    async velmora_mp_resolve_barrier(uid,a){
      requireActive(a.p_career_id,uid);
      await tick();
      const barrier=bucket(db.barriers,a.p_career_id).get(a.p_career_date);
      if(!barrier)throw err('VELMORA_NO_BARRIER','P0002');
      if(barrier.status==='RESOLVED')
        return{career_date:a.p_career_date,status:'RESOLVED',resolved_by:barrier.resolved_by,
          next_date:barrier.next_date,resolution_seq:barrier.resolution_seq,first_resolver:false};

      const results=bucket(db.results,a.p_career_id);
      const outstanding=(barrier.required||[]).filter(row=>{
        const member=memberRow(a.p_career_id,row.user_id);
        return member&&member.status==='ACTIVE'&&!results.has(row.fixture_id);
      });
      if(outstanding.length)
        return{career_date:a.p_career_date,status:'OPEN',outstanding,first_resolver:false};

      let event;
      try{
        event=appendEvent(uid,{careerId:a.p_career_id,kind:'DAY_ADVANCE',
          payload:{from_date:a.p_career_date,to_date:a.p_next_date},
          idempotencyKey:`advance:${a.p_career_date}`,subjectKey:`DAY:${a.p_career_date}`});
      }catch(error){
        // Another caller won the race; report the settled barrier.
        const settled=bucket(db.barriers,a.p_career_id).get(a.p_career_date);
        return{career_date:a.p_career_date,status:settled.status,resolved_by:settled.resolved_by,
          next_date:settled.next_date,resolution_seq:settled.resolution_seq,first_resolver:false};
      }
      if(barrier.status!=='OPEN')
        return{career_date:a.p_career_date,status:barrier.status,resolved_by:barrier.resolved_by,
          next_date:barrier.next_date,resolution_seq:barrier.resolution_seq,first_resolver:false};
      barrier.status='RESOLVED';
      barrier.resolved_by=uid;
      barrier.resolved_at=new Date().toISOString();
      barrier.resolution_seq=event.seq;
      barrier.next_date=a.p_next_date;
      careerOr404(a.p_career_id).career_date=a.p_next_date;
      return{career_date:a.p_career_date,status:'RESOLVED',resolved_by:uid,
        next_date:a.p_next_date,resolution_seq:event.seq,first_resolver:true};
    },

    async velmora_mp_claim_world_action(uid,a){
      if(!a.p_subject_key)throw err('VELMORA_SUBJECT_REQUIRED','22023');
      await tick();
      return appendEvent(uid,{careerId:a.p_career_id,kind:a.p_kind||'WORLD_ACTION',
        payload:a.p_payload||{},idempotencyKey:a.p_idempotency_key||a.p_subject_key,
        subjectKey:a.p_subject_key,clubId:a.p_club_id});
    },

    async velmora_mp_touch_presence(uid,a){
      if(!isMember(a.p_career_id,uid))throw err('VELMORA_NOT_A_MEMBER','42501');
      await tick();
      bucket(db.presence,a.p_career_id).set(uid,{career_id:a.p_career_id,user_id:uid,
        status:['ONLINE','AWAY','OFFLINE'].includes(String(a.p_status||'').toUpperCase())
          ?String(a.p_status).toUpperCase():'ONLINE',
        activity:String(a.p_activity||'Menus').slice(0,40),client_id:a.p_client_id||null,
        last_seen_at:new Date().toISOString()});
      memberRow(a.p_career_id,uid).last_seen_at=new Date().toISOString();
      return{ok:true};
    },

    async velmora_mp_convert_to_ai(uid,a){
      requireActive(a.p_career_id,uid);
      await tick();
      const member=memberRow(a.p_career_id,a.p_user_id);
      if(!member)throw err('VELMORA_NOT_A_MEMBER','P0002');
      if(member.status==='AI_CONTROLLED')
        return{user_id:a.p_user_id,status:'AI_CONTROLLED',changed:false};
      if(!isHost(a.p_career_id,uid)){
        const presence=bucket(db.presence,a.p_career_id).get(a.p_user_id);
        const seen=Math.max(Date.parse(member.last_seen_at)||0,Date.parse(presence?.last_seen_at||'')||0);
        const grace=Math.max(Number(a.p_grace_minutes||15),5)*60000;
        if(seen>Date.now()-grace)throw err('VELMORA_MANAGER_STILL_ACTIVE','42501');
      }
      const claims=bucket(db.claims,a.p_career_id);
      let clubId=null;
      [...claims.entries()].forEach(([id,row])=>{if(row.user_id===a.p_user_id){clubId=id;claims.delete(id);}});
      member.status='AI_CONTROLLED';
      member.ready=false;
      appendEvent(uid,{careerId:a.p_career_id,kind:'MANAGER_CONVERTED_AI',
        payload:{user_id:a.p_user_id,club_id:clubId,reason:a.p_reason||'ABSENT'},
        idempotencyKey:`convert-ai:${a.p_user_id}:${clubId||'none'}`,
        subjectKey:`MANAGER_AI:${a.p_user_id}`,clubId});
      audit(a.p_career_id,'MANAGER_CONVERTED_AI',uid,a.p_user_id,
        {club_id:clubId,reason:a.p_reason||'ABSENT',by_host:isHost(a.p_career_id,uid)});
      return{user_id:a.p_user_id,status:'AI_CONTROLLED',club_id:clubId,changed:true};
    },

    async velmora_mp_leave_career(uid,a){
      if(!isMember(a.p_career_id,uid))throw err('VELMORA_NOT_A_MEMBER','42501');
      await tick();
      const career=careerOr404(a.p_career_id);
      const claims=bucket(db.claims,a.p_career_id);
      let clubId=null;
      [...claims.entries()].forEach(([id,row])=>{if(row.user_id===uid){clubId=id;claims.delete(id);}});
      const member=memberRow(a.p_career_id,uid);
      member.status=career.status==='ACTIVE'?'AI_CONTROLLED':'LEFT';
      member.ready=false;
      audit(a.p_career_id,'MEMBER_LEFT',uid,null,{club_id:clubId,was_role:member.role});
      return{left:true,released_club_id:clubId};
    },

    async velmora_mp_archive_career(uid,a){
      if(!isHost(a.p_career_id,uid))throw err('VELMORA_HOST_ONLY','42501');
      await tick();
      audit(a.p_career_id,a.p_delete?'CAREER_DELETED':'CAREER_ARCHIVED',uid,null,{});
      if(a.p_delete){db.careers.delete(a.p_career_id);return{deleted:true};}
      const career=careerOr404(a.p_career_id);
      career.status='ARCHIVED';
      career.archived_at=new Date().toISOString();
      return{archived:true};
    },

    async velmora_mp_claim_host(uid,a){
      requireActive(a.p_career_id,uid);
      await tick();
      const members=bucket(db.members,a.p_career_id);
      const host=[...members.values()].find(row=>row.role==='HOST');
      if(host&&host.user_id===uid)return{host_user_id:uid,changed:false};
      if(host&&host.status==='ACTIVE'){
        const presence=bucket(db.presence,a.p_career_id).get(host.user_id);
        const seen=Math.max(Date.parse(host.last_seen_at)||0,Date.parse(presence?.last_seen_at||'')||0);
        if(seen>Date.now()-Math.max(Number(a.p_grace_minutes||60),15)*60000)
          throw err('VELMORA_HOST_STILL_ACTIVE','42501');
      }
      if(host)host.role='MANAGER';
      members.get(uid).role='HOST';
      careerOr404(a.p_career_id).host_user_id=uid;
      audit(a.p_career_id,'HOST_TRANSFERRED',uid,host?.user_id||null,{reason:'HOST_ABSENT'});
      return{host_user_id:uid,changed:true};
    },

    async velmora_mp_save_private(uid,a){
      if(!isMember(a.p_career_id,uid))throw err('VELMORA_NOT_A_MEMBER','42501');
      await tick();
      bucket(db.privates,a.p_career_id).set(uid,{career_id:a.p_career_id,user_id:uid,
        payload:a.p_payload||'',bytes:String(a.p_payload||'').length,
        save_schema:Number(a.p_save_schema||0),updated_at:new Date().toISOString()});
      return{saved:true,bytes:String(a.p_payload||'').length};
    },

    async velmora_mp_load_private(uid,a){
      if(!isMember(a.p_career_id,uid))throw err('VELMORA_NOT_A_MEMBER','42501');
      await tick();
      const row=bucket(db.privates,a.p_career_id).get(uid);
      if(!row)return{found:false};
      return{found:true,payload:row.payload,save_schema:row.save_schema,updated_at:row.updated_at};
    },

    async velmora_mp_my_careers(uid){
      await tick();
      const rows=[];
      db.careers.forEach(career=>{
        const member=memberRow(career.id,uid);
        if(!member||!['ACTIVE','AI_CONTROLLED'].includes(member.status))return;
        const claim=[...bucket(db.claims,career.id).values()].find(row=>row.user_id===uid);
        const profile=bucket(db.profiles,career.id).get(uid);
        rows.push({career_id:career.id,name:career.name,status:career.status,privacy:career.privacy,
          join_code:member.role==='HOST'?career.join_code:null,is_host:member.role==='HOST',
          member_status:member.status,game_version:career.game_version,save_schema:career.save_schema,
          career_date:career.career_date,season_id:career.season_id,revision:career.revision,
          snapshot_revision:career.snapshot_revision,club_id:claim?.club_id||null,
          club_name:claim?.club_name||null,manager_name:profile?.manager_name||null,
          members:[...bucket(db.members,career.id).values()].filter(row=>row.status==='ACTIVE').length,
          max_members:career.max_members,last_played_at:member.last_seen_at,
          updated_at:career.updated_at});
      });
      return rows.sort((a,b)=>String(b.updated_at).localeCompare(String(a.updated_at)));
    },

    async velmora_mp_sync(uid,a){
      if(!isMember(a.p_career_id,uid))throw err('VELMORA_NOT_A_MEMBER','42501');
      await tick();
      const career=careerOr404(a.p_career_id);
      const claims=bucket(db.claims,a.p_career_id);
      const profiles=bucket(db.profiles,a.p_career_id);
      const presence=bucket(db.presence,a.p_career_id);
      const since=Number(a.p_since_seq||0);
      const barrier=[...bucket(db.barriers,a.p_career_id).values()]
        .filter(row=>row.status==='OPEN').sort((x,y)=>String(x.career_date).localeCompare(String(y.career_date)))[0]||null;
      return{
        career:{career_id:career.id,name:career.name,status:career.status,privacy:career.privacy,
          host_user_id:career.host_user_id,
          join_code:isHost(career.id,uid)?career.join_code:null,
          game_version:career.game_version,save_schema:career.save_schema,world_seed:career.world_seed,
          career_date:career.career_date,season_id:career.season_id,revision:career.revision,
          snapshot_revision:career.snapshot_revision,max_members:career.max_members,
          server_time:new Date().toISOString()},
        members:[...bucket(db.members,a.p_career_id).values()].map(member=>{
          const claim=[...claims.values()].find(row=>row.user_id===member.user_id);
          const profile=profiles.get(member.user_id);
          const seen=presence.get(member.user_id);
          return{user_id:member.user_id,role:member.role,status:member.status,
            display_name:member.display_name,ready:member.ready,client_version:member.client_version,
            last_seen_at:member.last_seen_at,manager_name:profile?.manager_name||null,
            club_id:claim?.club_id||null,club_name:claim?.club_name||null,
            presence_status:seen?.status||null,activity:seen?.activity||null,
            presence_at:seen?.last_seen_at||null};
        }),
        club_state:[...bucket(db.clubState,a.p_career_id).values()].map(row=>({
          club_id:row.club_id,revision:row.revision,updated_by:row.updated_by,updated_at:row.updated_at})),
        barrier,
        submissions:[...bucket(db.submissions,a.p_career_id).values()].map(row=>({
          fixture_id:row.fixture_id,user_id:row.user_id,club_id:row.club_id,state:row.state,
          career_date:row.career_date,updated_at:row.updated_at})),
        events:list(db.events,a.p_career_id).filter(row=>row.seq>since).slice(0,500).map(row=>({
          seq:row.seq,kind:row.kind,club_id:row.club_id,fixture_id:row.fixture_id,
          subject_key:row.subject_key,actor_user_id:row.actor_user_id,payload:row.payload,
          created_at:row.created_at}))
      };
    }
  };

  // Table reads, with the same visibility rules the policies enforce.
  const TABLES={
    velmora_multiplayer_careers:(uid)=>[...db.careers.values()]
      .filter(row=>isMember(row.id,uid)).map(row=>({...row,career_id:row.id})),
    velmora_multiplayer_members:(uid)=>flat(db.members,uid),
    velmora_multiplayer_club_claims:(uid)=>flat(db.claims,uid),
    velmora_multiplayer_club_state:(uid)=>flat(db.clubState,uid),
    velmora_multiplayer_events:(uid)=>flatList(db.events,uid),
    velmora_multiplayer_matchday_barriers:(uid)=>flat(db.barriers,uid),
    velmora_multiplayer_match_submissions:(uid)=>flat(db.submissions,uid),
    velmora_multiplayer_match_results:(uid)=>flat(db.results,uid),
    velmora_multiplayer_presence:(uid)=>flat(db.presence,uid),
    velmora_multiplayer_audit:(uid)=>flatList(db.audit,uid),
    // The private drawer is visible only to its owner, exactly as in policy.
    velmora_multiplayer_manager_private:(uid)=>flat(db.privates,uid)
      .filter(row=>row.user_id===uid),
    velmora_multiplayer_manager_profiles:(uid)=>flat(db.profiles,uid)
  };
  function flat(map,uid){
    const out=[];
    map.forEach((inner,careerId)=>{if(isMember(careerId,uid))inner.forEach(row=>out.push(row));});
    return out;
  }
  function flatList(map,uid){
    const out=[];
    map.forEach((rows,careerId)=>{if(isMember(careerId,uid))rows.forEach(row=>out.push(row));});
    return out;
  }

  function createClient(uid){
    return{
      uid,
      async rpc(name,args={}){
        const fn=rpcs[name];
        if(!fn)return{data:null,error:err(`unknown function ${name}`,'42883')};
        try{return{data:await fn(uid,args),error:null};}
        catch(error){return{data:null,error};}
      },
      from(table){
        const filters=[];
        const builder={
          select(){return builder;},
          eq(key,value){filters.push([key,value]);return builder;},
          order(){return builder;},
          limit(n){builder._limit=n;return builder;},
          then(resolve,reject){
            return Promise.resolve().then(()=>{
              const reader=TABLES[table];
              if(!reader)return{data:[],error:null};
              let rows=reader(uid);
              filters.forEach(([key,value])=>{rows=rows.filter(row=>String(row[key])===String(value));});
              if(builder._limit)rows=rows.slice(0,builder._limit);
              return{data:rows.map(row=>({...row})),error:null};
            }).then(resolve,reject);
          }
        };
        return builder;
      },
      channel(){return{on(){return this;},subscribe(){return Promise.resolve('SUBSCRIBED');}};},
      removeChannel(){return Promise.resolve();}
    };
  }

  return{
    db,createClient,
    createUser(email,name){
      const id=`user-${db.users.size+1}-${String(name||'').toLowerCase()}`;
      db.users.set(id,{id,email,name});
      return id;
    },
    reset(){Object.values(db).forEach(map=>map.clear());codeCounter=0;}
  };
}

module.exports={createServer};
