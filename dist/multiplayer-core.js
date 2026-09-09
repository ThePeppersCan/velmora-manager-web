// Velmora Manager · Online Career · shared rules
//
// Environment-free on purpose: no DOM, no network, no Supabase. Everything
// here is a pure function of its arguments so that both browser clients and
// the Node test suites reason about the same rules. If a decision matters to
// whether two devices agree, it belongs in this file.
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.VelmoraMultiplayerCore=api;
})(typeof window==='object'?window:globalThis,function(){
  'use strict';

  const SCHEMA_VERSION=1;
  const CLIENT_PROTOCOL='velmora-online-career-1';

  // ---------------------------------------------------------------
  // State classification
  //
  // Audited against saveCareerState() in app.js. Anything not listed is
  // treated as SHARED, because silently privatising world state is the
  // failure mode that lets two devices disagree about the same career.
  // ---------------------------------------------------------------

  // Owned by the manager who holds the club. Published so the other
  // manager sees a correct squad, but only its owner may write it.
  const CLUB_SCOPED_KEYS=Object.freeze(['squads','lineups','clubBudgets','academies']);

  // Never leaves the owning manager's device.
  const PRIVATE_KEYS=Object.freeze([
    'transferShortlist',          // private shortlist
    'transferScouted',            // revealed-to-me scouting knowledge
    'scoutingAssignments',        // scouting assignments, unrevealed reports
    'recruitmentIntel',
    'recruitmentWorldKnowledge',
    'officeReadMessages',         // unopened inbox state
    'careerInboxMessages',        // this manager's correspondence
    'careerDecisionEvents',       // confidential inbox decisions
    'careerEventCooldowns',
    'careerPreferences',          // draft tactics before submission, UI prefs
    'careerChallenge',
    'firstWeekState',
    'jobSearchState',
    'playerPromises',
    'avatarCooldowns',
    'selectedCalendarDate',
    'seasonCalendarCursor',
    'manager',
    'managerName',
    'currentClubId',
    'employmentStatus',
    'careerRuntime'               // board confidence etc: about my club, not the world
  ]);

  // The canonical world. Every one of these must be identical on both
  // devices at the same revision.
  const SHARED_KEYS=Object.freeze([
    'version','worldSeed','recruitmentDay','careerSeason','careerYear',
    'careerTime','fixtures','calendarEvents','transferWindows','processedCalendarEvents',
    'clubMembership','freeAgents','retiredPlayers','aiTransferHistory','developmentSnapshots',
    'unexpectedEvents','preSeasonExperience','cupRuntime','roadToGlory','managerMarket',
    'ownershipState','audienceWorldState','championsCrown','livingSquad','mediaWorld',
    'negotiationEngine','careerNewsStories','transferActivity'
  ]);

  function classifyKey(key){
    if(CLUB_SCOPED_KEYS.includes(key))return'club';
    if(PRIVATE_KEYS.includes(key))return'private';
    return'shared';
  }

  // Split a full career blob into the three partitions. `ownedClubIds` are
  // the clubs this device is allowed to author.
  function splitCareerState(data,ownedClubIds=[]){
    const owned=new Set((ownedClubIds||[]).filter(Boolean).map(String));
    const shared={},priv={},club={};
    owned.forEach(id=>{club[id]={};});
    Object.keys(data||{}).forEach(key=>{
      const kind=classifyKey(key);
      if(kind==='private'){priv[key]=data[key];return;}
      if(kind==='club'){
        const map=data[key]&&typeof data[key]==='object'?data[key]:{};
        const rest={};
        Object.keys(map).forEach(clubId=>{
          if(owned.has(String(clubId))){club[String(clubId)][key]=map[clubId];}
          else rest[clubId]=map[clubId];
        });
        shared[key]=rest;
        return;
      }
      shared[key]=data[key];
    });
    return{shared,private:priv,club};
  }

  // Rebuild a full career blob from the shared world plus every published
  // club partition plus this device's own private state.
  function composeCareerState(shared,clubStates={},privateState={}){
    const out={...(shared||{})};
    CLUB_SCOPED_KEYS.forEach(key=>{
      out[key]={...(shared&&shared[key]&&typeof shared[key]==='object'?shared[key]:{})};
    });
    Object.keys(clubStates||{}).forEach(clubId=>{
      const payload=clubStates[clubId]||{};
      CLUB_SCOPED_KEYS.forEach(key=>{
        if(Object.prototype.hasOwnProperty.call(payload,key))out[key][clubId]=payload[key];
      });
    });
    Object.keys(privateState||{}).forEach(key=>{out[key]=privateState[key];});
    return out;
  }

  // ---------------------------------------------------------------
  // Keys: retry safety vs exclusivity
  //
  // idempotencyKey  the same intent retried must not apply twice
  // subjectKey      only one actor may ever claim this subject
  // ---------------------------------------------------------------
  function idempotencyKey(...parts){
    return parts.filter(part=>part!==null&&part!==undefined&&part!=='')
      .map(part=>String(part).replace(/\s+/g,'-')).join(':').slice(0,180);
  }
  const subjectKeys=Object.freeze({
    fixture:fixtureId=>`FIXTURE:${fixtureId}`,
    day:date=>`DAY:${date}`,
    barrier:date=>`BARRIER:${date}`,
    player:(playerId,windowId)=>`PLAYER:${playerId}:${windowId||'open'}`,
    prize:(competitionId,seasonId)=>`PRIZE:${competitionId}:${seasonId}`,
    inbox:eventId=>`INBOX:${eventId}`,
    managerAi:userId=>`MANAGER_AI:${userId}`
  });

  // Human seats are part of the shared world, not AI manager slots. These
  // helpers deliberately use only the public lobby roster so every client
  // resolves the same club owner and stable manager id.
  function humanMemberForClub(members,clubId){
    const id=String(clubId||'');
    if(!id)return null;
    return (members||[]).find(row=>row&&row.status!=='AI_CONTROLLED'&&
      String(row.club_id||'')===id)||null;
  }
  function humanManagerId(userId){
    const id=String(userId||'').trim();
    return id?`HUMAN-MANAGER:${id}`:null;
  }
  function humanTransferActorAllowed(kind,payload,actorUserId,members){
    const p=payload&&typeof payload==='object'?payload:{};
    const actor=String(actorUserId||'');
    const buyer=humanMemberForClub(members,p.buyerClubId||p.buyer_club_id);
    const seller=humanMemberForClub(members,p.sellerClubId||p.seller_club_id);
    if(!actor||!buyer||!seller||buyer.user_id===seller.user_id)return false;
    if(kind==='HUMAN_TRANSFER_OFFER'||kind==='HUMAN_TRANSFER_COMPLETE')
      return String(buyer.user_id)===actor;
    if(kind==='HUMAN_TRANSFER_RESPONSE')return String(seller.user_id)===actor;
    return false;
  }

  // ---------------------------------------------------------------
  // Determinism
  //
  // Authoritative simulation must never read the wall clock or an
  // unseeded Math.random(). Every seed is a pure function of the career.
  // ---------------------------------------------------------------
  function simulationSeed(parts={}){
    const {worldSeed,careerId,competitionId,seasonId,matchday,fixtureId,revision,channel}=parts;
    return[
      'VELMORA-MP',channel||'SIM',worldSeed||'',careerId||'',competitionId||'',
      seasonId||'',matchday===undefined||matchday===null?'':String(matchday),
      fixtureId||'',revision===undefined||revision===null?'':String(revision)
    ].join('|');
  }
  // Rejects seeds that would make two devices disagree.
  function assertDeterministicSeed(seed){
    const text=String(seed||'');
    if(!text)throw new Error('A simulation seed is required.');
    if(/\b1[6-9]\d{11}\b/.test(text))throw new Error('A simulation seed must not contain a timestamp.');
    return text;
  }

  // ---------------------------------------------------------------
  // Matchday barrier
  // ---------------------------------------------------------------

  // A human club only becomes a required participant when it genuinely has
  // an unplayed fixture on the date. Byes, postponements and blank dates
  // are absent from the list, so they can never block progression.
  function requiredParticipants({fixtures=[],claims=[],date}={}){
    const byClub=new Map();
    (claims||[]).forEach(claim=>{
      if(claim&&claim.club_id&&claim.user_id)byClub.set(String(claim.club_id),claim);
    });
    const seen=new Set(),required=[];
    (fixtures||[]).forEach(fixture=>{
      if(!fixture||fixture.date!==date)return;
      if(fixture.played)return;
      if(fixture.postponed||fixture.abandoned||fixture.bye)return;
      [[fixture.homeClubId,fixture.awayClubId],[fixture.awayClubId,fixture.homeClubId]]
        .forEach(([clubId,opponentId])=>{
          const claim=byClub.get(String(clubId));
          if(!claim)return;
          const key=`${claim.user_id}:${fixture.fixtureId}`;
          if(seen.has(key))return;
          seen.add(key);
          required.push({
            user_id:claim.user_id,
            club_id:String(clubId),
            fixture_id:String(fixture.fixtureId),
            opponent_club_id:opponentId?String(opponentId):null,
            human_vs_human:byClub.has(String(opponentId))
          });
        });
    });
    return required.sort((a,b)=>String(a.fixture_id).localeCompare(String(b.fixture_id)));
  }

  const PARTICIPANT_STATES=Object.freeze(['PREPARING','READY','PLAYING','COMPLETED','DISCONNECTED']);

  // What the readiness board shows, and whether the calendar may move.
  function barrierState({barrier,members=[],submissions=[],results=[],now=Date.now(),offlineMs=90000}={}){
    const required=(barrier&&Array.isArray(barrier.required)?barrier.required:[]);
    const resultIds=new Set((results||[]).map(row=>String(row.fixture_id)));
    const subByKey=new Map();
    (submissions||[]).forEach(row=>subByKey.set(`${row.user_id}:${row.fixture_id}`,row));
    const memberById=new Map((members||[]).map(row=>[String(row.user_id),row]));

    const participants=required.map(entry=>{
      const member=memberById.get(String(entry.user_id))||{};
      const submission=subByKey.get(`${entry.user_id}:${entry.fixture_id}`)||null;
      const complete=resultIds.has(String(entry.fixture_id));
      const aiControlled=member.status==='AI_CONTROLLED';
      const seenAt=Date.parse(member.presence_at||member.last_seen_at||'')||0;
      const offline=!aiControlled&&(member.presence_status==='OFFLINE'||(seenAt&&(now-seenAt)>offlineMs));
      let state='PREPARING';
      if(complete)state='COMPLETED';
      else if(aiControlled)state='COMPLETED';
      else if(offline)state='DISCONNECTED';
      else if(submission&&submission.state==='PLAYING')state='PLAYING';
      else if(submission&&submission.state==='READY')state='READY';
      return{
        ...entry,
        display_name:member.display_name||'Manager',
        manager_name:member.manager_name||member.display_name||'Manager',
        club_name:member.club_name||entry.club_id,
        ai_controlled:aiControlled,
        offline:!!offline,
        last_seen_at:member.presence_at||member.last_seen_at||null,
        state,
        blocking:!complete&&!aiControlled
      };
    });

    const outstanding=participants.filter(row=>row.blocking);
    return{
      date:barrier?barrier.career_date:null,
      status:barrier?barrier.status:null,
      open:!!barrier&&barrier.status==='OPEN',
      participants,
      outstanding,
      locked:!!barrier&&barrier.status==='OPEN'&&outstanding.length>0,
      // Resolution needs no host: any active member may finish an
      // otherwise-complete barrier.
      resolvable:!!barrier&&barrier.status==='OPEN'&&outstanding.length===0,
      humanVsHuman:participants.filter(row=>row.human_vs_human)
    };
  }

  // Both managers must confirm before an H2H fixture resolves.
  function humanFixtureReady({fixtureId,required=[],submissions=[]}={}){
    const parties=required.filter(row=>String(row.fixture_id)===String(fixtureId));
    if(parties.length<2)return{ready:parties.length>0,parties,waitingOn:[]};
    const byUser=new Map((submissions||[])
      .filter(row=>String(row.fixture_id)===String(fixtureId))
      .map(row=>[String(row.user_id),row]));
    const waitingOn=parties.filter(row=>{
      const submission=byUser.get(String(row.user_id));
      return!submission||!['READY','PLAYING','COMPLETED'].includes(submission.state);
    });
    return{ready:waitingOn.length===0,parties,waitingOn};
  }

  // Deciding who runs the single deterministic resolution of an H2H tie
  // without a coordinator: lowest user id wins the right to try first, and
  // the other side falls back after a short delay if no result appears.
  function humanFixtureResolver({fixtureId,required=[],selfUserId}={}){
    const ids=required.filter(row=>String(row.fixture_id)===String(fixtureId))
      .map(row=>String(row.user_id)).sort();
    if(!ids.length)return{primary:null,isPrimary:false,fallbackDelayMs:0};
    const primary=ids[0];
    return{primary,isPrimary:String(selfUserId)===primary,fallbackDelayMs:primary===String(selfUserId)?0:4000};
  }

  // ---------------------------------------------------------------
  // Revisions and conflict
  // ---------------------------------------------------------------
  function isStale(localRevision,serverRevision){
    return Number(serverRevision||0)>Number(localRevision||0);
  }
  function conflictPlan({localRevision,serverRevision,pendingClubWrites=0}={}){
    if(!isStale(localRevision,serverRevision))return{action:'NONE'};
    // A stale device never uploads a whole world. It pulls the newer world
    // and replays only its own club partition on top.
    return{
      action:pendingClubWrites>0?'REBASE_CLUB_STATE':'RELOAD_WORLD',
      from:Number(localRevision||0),
      to:Number(serverRevision||0)
    };
  }

  // ---------------------------------------------------------------
  // Version compatibility
  // ---------------------------------------------------------------
  function parseVersion(value){
    const parts=String(value||'0').split('.').map(part=>Number(String(part).replace(/\D/g,''))||0);
    return{major:parts[0]||0,minor:parts[1]||0,patch:parts[2]||0};
  }
  function versionCompatibility(a,b){
    const left=parseVersion(a),right=parseVersion(b);
    if(left.major!==right.major)return{compatible:false,level:'BLOCKED',
      message:'These builds are too far apart to share a career. Both managers need the same major game version.'};
    if(left.minor!==right.minor)return{compatible:true,level:'WARN',
      message:'One manager is on a slightly different build. Update when convenient to keep results identical.'};
    return{compatible:true,level:'OK',message:'Both managers are on the same build.'};
  }
  function saveSchemaCompatibility(careerSchema,clientSchema){
    const career=Number(careerSchema||0),client=Number(clientSchema||0);
    if(!career||!client)return{compatible:true,level:'OK',message:''};
    if(client<career)return{compatible:false,level:'BLOCKED',
      message:'This career was created by a newer version of the game. Update Velmora Manager to continue.'};
    return{compatible:true,level:'OK',message:''};
  }

  // ---------------------------------------------------------------
  // Activity labels
  //
  // Deliberately an allowlist of broad descriptions. Anything unmapped
  // degrades to "In the office" so a new screen can never leak a private
  // detail such as a transfer target or a bid.
  // ---------------------------------------------------------------
  const ACTIVITY_LABELS=Object.freeze({
    menu:'Main menu',central:'Club office',squad:'Squad',training:'Training',
    tactics:'Tactics',transfers:'Transfers',recruitment:'Transfers',scouting:'Transfers',
    inbox:'Inbox',office:'Club office',finances:'Finances',staff:'Staff',
    season:'Competitions',fixtures:'Competitions',table:'Competitions',records:'Competitions',
    academy:'Academy',matchday:'Playing match',results:'Match result',
    lobby:'Online lobby',preparing:'Preparing for a match'
  });
  function activityLabel(route){
    const key=String(route||'').toLowerCase();
    return ACTIVITY_LABELS[key]||'In the office';
  }

  // ---------------------------------------------------------------
  // Player-facing language
  //
  // Database errors never reach a player. Every branch returns a sentence
  // a manager can act on.
  // ---------------------------------------------------------------
  function friendlyError(error){
    const raw=String(error&&(error.message||error.code||error)||'');
    const code=raw.split(':')[0].trim();
    const table={
      VELMORA_NOT_SIGNED_IN:'Sign in at Repo Company to play an online career.',
      VELMORA_NOT_A_MEMBER:'You are no longer part of this online career.',
      VELMORA_CODE_UNKNOWN:'That invitation code does not match an online career.',
      VELMORA_CAREER_ARCHIVED:'This online career has been archived by its host.',
      VELMORA_CAREER_FULL:'This career already has two managers.',
      VELMORA_BAD_PASSWORD:'That career password is not correct.',
      VELMORA_CLUB_TAKEN:'The other manager claimed that club first. Choose another club.',
      VELMORA_CLUB_REQUIRED:'Choose a club before confirming you are ready.',
      VELMORA_NOT_YOUR_CLUB:'You can only manage your own club in this career.',
      VELMORA_HOST_ONLY:'Only the host can do that.',
      VELMORA_MANAGERS_NOT_READY:'Both managers need a club and a ready confirmation before kick-off.',
      VELMORA_STALE_REVISION:'The shared world moved on while you were away. Reloading the latest state.',
      VELMORA_STALE_CLUB_STATE:'Your club was updated in another tab. Reloading the newest version.',
      VELMORA_SUBJECT_TAKEN:'The other manager completed that action first.',
      VELMORA_SNAPSHOT_AHEAD:'Your save is behind the shared career. Reloading the latest state.',
      VELMORA_NO_BARRIER:'There is no matchday waiting to be resolved.',
      VELMORA_MANAGER_STILL_ACTIVE:'That manager is still connected, so their club cannot be handed to the AI yet.',
      VELMORA_HOST_STILL_ACTIVE:'The host is still connected.',
      VELMORA_NAME_REQUIRED:'Give the career a name.',
      VELMORA_CODE_EXHAUSTED:'Could not generate an invitation code. Try again in a moment.'
    };
    if(table[code])return table[code];
    if(/networkerror|failed to fetch|fetch failed|timeout|offline/i.test(raw))
      return'Velmora cannot reach the online career right now. Your club is safe and will reconnect automatically.';
    return'Something went wrong with the online career. Your progress is safe; try that again in a moment.';
  }
  function isStaleError(error){
    return/VELMORA_STALE_REVISION|VELMORA_STALE_CLUB_STATE|VELMORA_SNAPSHOT_AHEAD/.test(String(error&&error.message||error||''));
  }
  function isConflictError(error){
    return/VELMORA_SUBJECT_TAKEN|VELMORA_CLUB_TAKEN/.test(String(error&&error.message||error||''));
  }
  function serverRevisionFromError(error){
    const match=String(error&&error.message||error||'').match(/VELMORA_STALE_(?:REVISION|CLUB_STATE):(\d+)/);
    return match?Number(match[1]):null;
  }

  // The single sentence shown when progression is blocked.
  function waitingMessage(state){
    if(!state||!state.locked)return null;
    const names=state.outstanding.map(row=>{
      const manager=row.manager_name||row.display_name||'the other manager';
      return`${manager} at ${row.club_name||row.club_id}`;
    });
    if(!names.length)return null;
    const who=names.length===1?names[0]:`${names.slice(0,-1).join(', ')} and ${names[names.length-1]}`;
    const disconnected=state.outstanding.some(row=>row.state==='DISCONNECTED');
    return disconnected
      ?`Waiting for ${who} to reconnect and complete their fixture. You may continue managing your club.`
      :`Waiting for ${who} to complete their fixture. You may continue managing your club.`;
  }

  return Object.freeze({
    SCHEMA_VERSION,CLIENT_PROTOCOL,
    SHARED_KEYS,PRIVATE_KEYS,CLUB_SCOPED_KEYS,PARTICIPANT_STATES,ACTIVITY_LABELS,
    classifyKey,splitCareerState,composeCareerState,
    idempotencyKey,subjectKeys,
    humanMemberForClub,humanManagerId,humanTransferActorAllowed,
    simulationSeed,assertDeterministicSeed,
    requiredParticipants,barrierState,humanFixtureReady,humanFixtureResolver,
    isStale,conflictPlan,
    parseVersion,versionCompatibility,saveSchemaCompatibility,
    activityLabel,friendlyError,isStaleError,isConflictError,serverRevisionFromError,waitingMessage
  });
});
