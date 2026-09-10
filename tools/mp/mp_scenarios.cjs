'use strict';
// The online-career scenario suite.
//
// Every scenario drives the real multiplayer-client.js. Only the backend is
// swapped, so the same expectations can be checked against a live database
// with real Row Level Security. Two isolated authenticated users throughout.

const assert=require('node:assert/strict');
const path=require('node:path');
const core=require(path.resolve(__dirname,'..','..','multiplayer-core.js'));
const transport=require(path.resolve(__dirname,'..','..','multiplayer-client.js'));
const {createBridge}=require('./mp_fake_game.cjs');

const ALEX_CLUB='aurelia';
const SAM_CLUB='blackglass';

// Timers are driven by the tests, never by the clock.
const noTimers={setTimeout:()=>0,clearTimeout:()=>{}};

function makeSession(backend,userId,{clubId=null,identity={}}={}){
  const bridge=createBridge({clubId,identity});
  const client=transport.create({
    core,
    bridge,
    client:backend.clientFor(userId),
    session:{user:{id:userId}},
    clientVersion:'103.0.3',
    saveSchema:86,
    codec:{encode:v=>v,decode:v=>v},
    window:null,
    ...noTimers
  });
  return{client,bridge,userId};
}

async function run(backend,report){
  const results=[];
  const check=async(name,fn)=>{
    try{await fn();results.push({name,status:'PASS'});}
    catch(error){results.push({name,status:'FAIL',error:error.message});throw error;}
  };

  await backend.reset();
  const alexId=await backend.createUser('alex@velmora.test','Alex');
  const samId=await backend.createUser('sam@velmora.test','Sam');
  const outsiderId=await backend.createUser('outsider@velmora.test','Outsider');

  let alex=makeSession(backend,alexId,{clubId:ALEX_CLUB,identity:{managerName:'Alex'}});
  let sam=makeSession(backend,samId,{clubId:SAM_CLUB,identity:{managerName:'Sam'}});
  const outsider=makeSession(backend,outsiderId);

  let careerId=null,joinCode=null;

  // ---------------------------------------------------------------
  await check('creating and joining a career',async()=>{
    const created=await alex.client.createCareer({name:'Velmora Rivals',privacy:'INVITE',displayName:'Alex'});
    careerId=created.career_id;joinCode=created.join_code;
    assert.match(joinCode,/^[A-HJ-NP-Z2-9]{6}$/,'the join code is short and unambiguous');

    const preview=await sam.client.previewCareer(joinCode);
    assert.equal(preview.name,'Velmora Rivals','the career name is visible before joining');
    assert.equal(preview.host_name,'Alex','the host is visible before joining');
    assert.equal(preview.already_member,false);

    const joined=await sam.client.joinCareer({code:joinCode,displayName:'Sam'});
    assert.equal(joined.career_id,careerId);
    assert.equal(joined.rejoined,false);
  });

  // ---------------------------------------------------------------
  await check('preventing unauthorized access',async()=>{
    // A non-member cannot read the career, its events, or its world.
    const rows=await backend.rawSelect(outsiderId,'velmora_multiplayer_careers',{id:careerId});
    assert.equal(rows.length,0,'a non-member sees no career row at all');

    const events=await backend.rawSelect(outsiderId,'velmora_multiplayer_events',{career_id:careerId});
    assert.equal(events.length,0,'a non-member sees no events');

    await assert.rejects(()=>outsider.client.attach(careerId),/./,'a non-member cannot attach');

    // Signed out entirely: nothing is readable.
    const anonRows=await backend.rawSelect(null,'velmora_multiplayer_careers',{id:careerId});
    assert.equal(anonRows.length,0,'an unauthenticated reader sees nothing');

    // A third account cannot take a seat in a two-manager career.
    await assert.rejects(()=>outsider.client.joinCareer({code:joinCode,displayName:'Outsider'}),
      /VELMORA_CAREER_FULL/,'a third manager is refused');
  });

  // ---------------------------------------------------------------
  await check('preventing duplicate club claims',async()=>{
    await alex.client.claimClub(careerId,{clubId:ALEX_CLUB,clubName:'Aurelia',managerName:'Alex Vance'});
    await assert.rejects(
      ()=>sam.client.claimClub(careerId,{clubId:ALEX_CLUB,clubName:'Aurelia',managerName:'Sam Rhodes'}),
      /VELMORA_CLUB_TAKEN/,'the second manager cannot claim an occupied club');
    await sam.client.claimClub(careerId,{clubId:SAM_CLUB,clubName:'Blackglass',managerName:'Sam Rhodes'});

    const claims=await backend.rawSelect(alexId,'velmora_multiplayer_club_claims',{career_id:careerId});
    assert.equal(claims.length,2,'exactly one human manager per club');
    assert.equal(new Set(claims.map(row=>row.user_id)).size,2,'and one club per human manager');
  });

  // ---------------------------------------------------------------
  await check('starting the shared career',async()=>{
    await alex.client.setReady(careerId,true);
    await sam.client.setReady(careerId,true);
    const started=await alex.client.startCareer(careerId);
    assert.equal(started.status,'ACTIVE');

    assert.equal((await alex.client.attach(careerId)).ok,true,'the host attaches');
    assert.equal((await sam.client.attach(careerId)).ok,true,'the guest attaches');
    assert.equal(sam.bridge._world().worldSeed,'SEED-ONLINE-TEST','both devices load one canonical world');
  });

  // ---------------------------------------------------------------
  await check('both managers confirming before an ordinary day advances',async()=>{
    const date='2026-08-01',next='2026-08-02';
    const claims=await backend.rawSelect(alexId,'velmora_multiplayer_club_claims',{career_id:careerId});
    const required=core.requiredParticipants({fixtures:alex.bridge._world().fixtures,claims,date,requireAdvance:true});
    assert.equal(required.length,2,'a blank date still carries both Advance confirmations');
    assert.equal(required.every(row=>row.requirement==='DAY_ADVANCE'),true);
    await alex.client.openBarrier(date,required);
    const gateId=core.dayAdvanceId(date);
    await alex.client.submitMatchState(gateId,'READY',{date});
    await sam.client.refreshLobby();
    assert.equal(sam.client.status().dayAdvance.ready,false,'one click is not enough');
    const early=await alex.client.resolveBarrier(date,next);
    assert.equal(early.status,'OPEN','the server also refuses an early advance');

    await sam.client.submitMatchState(gateId,'READY',{date});
    await alex.client.refreshLobby();
    assert.equal(alex.client.status().dayAdvance.ready,true,'both confirmations complete the handshake');
    await sam.client.recordMatchResult(gateId,{date,result:{kind:'DAY_ADVANCE_CONFIRMATION'},mode:'DAY_ADVANCE'});
    const resolved=await sam.client.resolveBarrier(date,next);
    assert.equal(resolved.status,'RESOLVED');
    await alex.client.pullEvents();
    assert.equal(alex.bridge._world().date,next,'the shared date moves only after both clicks');
  });

  // ---------------------------------------------------------------
  await check('two managers changing separate club data without overwriting each other',async()=>{
    alex.bridge._world().clubState[ALEX_CLUB]={squads:['alex-1'],marker:'ALEX'};
    sam.bridge._world().clubState[SAM_CLUB]={squads:['sam-1'],marker:'SAM'};
    await alex.client.publishClubState('test');
    await sam.client.publishClubState('test');
    await alex.client.pullEvents();
    await sam.client.pullEvents();

    assert.equal(alex.bridge._world().clubState[SAM_CLUB].marker,'SAM',
      'Alex receives Sam\'s club without touching it');
    assert.equal(sam.bridge._world().clubState[ALEX_CLUB].marker,'ALEX',
      'Sam receives Alex\'s club without touching it');
    assert.equal(alex.bridge._world().clubState[ALEX_CLUB].marker,'ALEX',
      'neither write clobbered the other');

    // And a manager may not write a club they do not hold.
    await assert.rejects(()=>backend.rpc(samId,'velmora_mp_publish_club_state',{
      p_career_id:careerId,p_club_id:ALEX_CLUB,p_payload:{marker:'STOLEN'},p_expect_revision:null
    }),/VELMORA_NOT_YOUR_CLUB/,'a manager cannot publish another manager\'s club');
  });

  // ---------------------------------------------------------------
  await check('stale revision rejection',async()=>{
    // A tab that still believes it is on an older revision is refused
    // rather than allowed to overwrite the newer club state.
    await assert.rejects(()=>backend.rpc(alexId,'velmora_mp_publish_club_state',{
      p_career_id:careerId,p_club_id:ALEX_CLUB,p_payload:{marker:'STALE'},p_expect_revision:0
    }),/VELMORA_STALE_CLUB_STATE/,'a stale club write is rejected');

    const rows=await backend.rawSelect(alexId,'velmora_multiplayer_club_state',{career_id:careerId,club_id:ALEX_CLUB});
    assert.equal(rows[0].payload.marker,'ALEX','the newer club state survived the stale attempt');

    // A world event that expects an out-of-date revision is refused too.
    await assert.rejects(()=>backend.rpc(alexId,'velmora_mp_append_event',{
      p_career_id:careerId,p_kind:'WORLD_ACTION',p_payload:{},
      p_idempotency_key:'stale-probe',p_subject_key:null,p_club_id:null,
      p_fixture_id:null,p_expect_revision:1
    }),/VELMORA_STALE_REVISION/,'a stale world write is rejected');
  });

  // ---------------------------------------------------------------
  const MATCHDAY='2026-08-08';
  await check('opening the matchday barrier',async()=>{
    const claims=await backend.rawSelect(alexId,'velmora_multiplayer_club_claims',{career_id:careerId});
    const required=core.requiredParticipants({
      fixtures:alex.bridge._world().fixtures,claims,date:MATCHDAY
    });
    assert.equal(required.length,2,'only the two human clubs with a live fixture are required');
    assert.deepEqual(required.map(row=>row.fixture_id).sort(),['F1','F2'],
      'a postponed human fixture is not a blocker');
    assert.equal(required.every(row=>row.human_vs_human===false),true,
      'neither is a human-versus-human tie on this date');

    await alex.client.openBarrier(MATCHDAY,required);
    await sam.client.refreshLobby();
    assert.equal(alex.client.status().barrier.open,true);
    assert.equal(sam.client.status().barrier.locked,true,'progression is locked for both');
  });

  // ---------------------------------------------------------------
  await check('one manager completing a match first',async()=>{
    await alex.client.submitMatchState('F1','READY',{date:MATCHDAY});
    alex.bridge._playLocally('F1',2,1);
    const stored=await alex.client.recordMatchResult('F1',{
      date:MATCHDAY,homeClubId:ALEX_CLUB,awayClubId:'ai-a',homeScore:2,awayScore:1,
      result:{report:null},mode:'QUICK_SIM'
    });
    assert.equal(stored.first_write,true,'the first submission is the authoritative one');
    await sam.client.pullEvents();
    const samFixture=sam.bridge._world().fixtures.find(row=>row.fixtureId==='F1');
    assert.equal(samFixture.played,true,'the other device receives the result');
    assert.equal(samFixture.homeScore,2);
  });

  await check('the first manager remains free to use menus',async()=>{
    // Completing a fixture must not lock the finished manager out of the
    // rest of the game.
    const status=alex.client.status();
    assert.equal(status.readOnly,false,'menus stay available');
    alex.bridge._world().clubState[ALEX_CLUB]={squads:['alex-2'],marker:'ALEX-AFTER-MATCH'};
    const published=await alex.client.publishClubState('post-match');
    assert.ok(published,'the finished manager can still change their own club');
    await sam.client.pullEvents();
    assert.equal(sam.bridge._world().clubState[ALEX_CLUB].marker,'ALEX-AFTER-MATCH');
  });

  await check('the shared date stays locked while one fixture is unfinished',async()=>{
    await alex.client.refreshLobby();
    const state=alex.client.status().barrier;
    assert.equal(state.locked,true,'still locked');
    assert.equal(state.resolvable,false,'and not yet resolvable');
    assert.match(core.waitingMessage(state),/Waiting for .* to complete their fixture/,
      'the reason is stated in plain language');
    assert.match(core.waitingMessage(state),/You may continue managing your club/);

    const refused=await alex.client.resolveBarrier(MATCHDAY,'2026-08-09');
    assert.equal(refused.status,'OPEN','the barrier refuses to resolve early');
    assert.equal(alex.bridge._world().date,'2026-08-02','and the shared date has not moved again');
    assert.equal(sam.bridge._world().date,'2026-08-02');
  });

  await check('duplicate match submission is idempotent',async()=>{
    const again=await alex.client.recordMatchResult('F1',{
      date:MATCHDAY,homeClubId:ALEX_CLUB,awayClubId:'ai-a',homeScore:9,awayScore:9,
      result:{report:null},mode:'QUICK_SIM'
    });
    assert.equal(again.first_write,false,'a repeat submission does not write a second result');
    assert.equal(again.home_score,2,'the stored result is returned unchanged');
    const rows=await backend.rawSelect(alexId,'velmora_multiplayer_match_results',{career_id:careerId,fixture_id:'F1'});
    assert.equal(rows.length,1,'exactly one authoritative result exists');
    assert.equal(alex.bridge._world().counters.applyResult.F1||0,0,
      'the resolving device never re-applied its own result');
    assert.equal(sam.bridge._world().counters.applyResult.F1,1,
      'and the other device applied it exactly once');
  });

  await check('refresh during a match never runs it twice',async()=>{
    // A completely fresh client for the same account, as after a reload.
    const reloaded=makeSession(backend,alexId,{clubId:ALEX_CLUB,identity:{managerName:'Alex'}});
    const attached=await reloaded.client.attach(careerId);
    assert.equal(attached.ok,true);
    const fixture=reloaded.bridge._world().fixtures.find(row=>row.fixtureId==='F1');
    assert.equal(fixture.played,true,'the reloaded device sees the match as played');
    assert.equal(reloaded.bridge._world().counters.applyResult.F1,1,
      'and applied the stored result exactly once');
    const repeat=await reloaded.client.recordMatchResult('F1',{
      date:MATCHDAY,homeScore:5,awayScore:0,result:{},mode:'QUICK_SIM'});
    assert.equal(repeat.first_write,false,'resubmitting after a refresh changes nothing');
    alex=reloaded;
  });

  await check('the second manager completing their fixture',async()=>{
    await sam.client.submitMatchState('F2','READY',{date:MATCHDAY});
    sam.bridge._playLocally('F2',0,3);
    const stored=await sam.client.recordMatchResult('F2',{
      date:MATCHDAY,homeClubId:SAM_CLUB,awayClubId:'ai-b',homeScore:0,awayScore:3,
      result:{report:null},mode:'QUICK_SIM'
    });
    assert.equal(stored.first_write,true);
    await alex.client.refreshLobby();
    assert.equal(alex.client.status().barrier.resolvable,true,
      'with both human fixtures done the barrier can be resolved');
    assert.equal(alex.client.status().barrier.locked,false);
  });

  await check('the barrier resolves exactly once under simultaneous requests',async()=>{
    // Both devices ask at the same moment, as they would in real play.
    const [first,second]=await Promise.all([
      alex.client.resolveBarrier(MATCHDAY,'2026-08-09'),
      sam.client.resolveBarrier(MATCHDAY,'2026-08-09')
    ]);
    const winners=[first,second].filter(row=>row&&row.first_resolver===true);
    assert.equal(winners.length,1,'exactly one caller resolved the barrier');
    assert.equal(first.status,'RESOLVED');
    assert.equal(second.status,'RESOLVED');

    const advances=await backend.rawSelect(alexId,'velmora_multiplayer_events',
      {career_id:careerId,kind:'DAY_ADVANCE'});
    assert.equal(advances.filter(row=>row.payload?.from_date===MATCHDAY).length,1,
      'and exactly one advance event exists for this date');
  });

  await check('AI fixtures resolve exactly once and both worlds agree',async()=>{
    await alex.client.pullEvents();
    await sam.client.pullEvents();
    assert.equal(alex.bridge._world().date,'2026-08-09','the shared date moved for the first device');
    assert.equal(sam.bridge._world().date,'2026-08-09','and for the second');
    assert.equal(alex.bridge._world().counters.advance,2,'each of the two resolved dates applied once here');
    assert.equal(sam.bridge._world().counters.advance,2,'and once each there');
    assert.equal(alex.bridge._world().counters.aiResolved.F3,1,'the AI fixture resolved once');
    assert.equal(sam.bridge._world().counters.aiResolved.F3,1);

    const a=alex.bridge._world().fixtures.find(row=>row.fixtureId==='F3');
    const b=sam.bridge._world().fixtures.find(row=>row.fixtureId==='F3');
    assert.deepEqual([a.homeScore,a.awayScore],[b.homeScore,b.awayScore],
      'the deterministic engine produced the same AI result on both devices');

    // A pull that arrives again must not advance a second time.
    await alex.client.pullEvents();
    assert.equal(alex.bridge._world().counters.advance,2,'a repeated pull changes nothing');
  });

  // ---------------------------------------------------------------
  const H2H_DAY='2026-08-15';
  await check('human-versus-human readiness',async()=>{
    const claims=await backend.rawSelect(alexId,'velmora_multiplayer_club_claims',{career_id:careerId});
    const required=core.requiredParticipants({
      fixtures:alex.bridge._world().fixtures,claims,date:H2H_DAY});
    assert.equal(required.length,2,'both managers are required for their own tie');
    assert.equal(required.every(row=>row.fixture_id==='F4'),true);
    assert.equal(required.every(row=>row.human_vs_human===true),true,'and it is flagged as human-versus-human');

    await alex.client.openBarrier(H2H_DAY,required);
    await alex.client.refreshLobby();

    let readiness=core.humanFixtureReady({fixtureId:'F4',
      required:alex.client.status().barrier.participants,
      submissions:await backend.rawSelect(alexId,'velmora_multiplayer_match_submissions',{career_id:careerId,fixture_id:'F4'})});
    assert.equal(readiness.ready,false,'nobody is ready yet');

    await alex.client.submitMatchState('F4','READY',{date:H2H_DAY,lineup:{starters:['a1','a2','a3']}});
    readiness=core.humanFixtureReady({fixtureId:'F4',
      required:alex.client.status().barrier.participants,
      submissions:await backend.rawSelect(alexId,'velmora_multiplayer_match_submissions',{career_id:careerId,fixture_id:'F4'})});
    assert.equal(readiness.ready,false,'one confirmation is not enough');
    assert.equal(readiness.waitingOn.length,1);

    // While the opponent has not committed, changing your mind is allowed.
    await alex.client.submitMatchState('F4','PREPARING',{date:H2H_DAY,lineup:{starters:['a1','a2','a9']}});
    let mine=(await backend.rawSelect(alexId,'velmora_multiplayer_match_submissions',
      {career_id:careerId,fixture_id:'F4',user_id:alexId}))[0];
    assert.deepEqual(mine.lineup.starters,['a1','a2','a9'],'an uncommitted line-up can still be edited');
    await alex.client.submitMatchState('F4','READY',{date:H2H_DAY,lineup:{starters:['a1','a2','a3']}});

    await sam.client.submitMatchState('F4','READY',{date:H2H_DAY,lineup:{starters:['s1','s2','s3']}});
    const submissions=await backend.rawSelect(alexId,'velmora_multiplayer_match_submissions',{career_id:careerId,fixture_id:'F4'});
    readiness=core.humanFixtureReady({fixtureId:'F4',
      required:alex.client.status().barrier.participants,submissions});
    assert.equal(readiness.ready,true,'both confirmations unlock the tie');

    // Exactly one device performs the single deterministic resolution.
    const resolverA=core.humanFixtureResolver({fixtureId:'F4',
      required:alex.client.status().barrier.participants,selfUserId:alexId});
    const resolverB=core.humanFixtureResolver({fixtureId:'F4',
      required:alex.client.status().barrier.participants,selfUserId:samId});
    assert.notEqual(resolverA.isPrimary,resolverB.isPrimary,'only one side is the primary resolver');

    // Once BOTH managers have confirmed, both line-ups are locked: neither
    // side may change a selection the other has already committed against.
    const before=submissions.find(row=>row.user_id===alexId).lineup;
    await alex.client.submitMatchState('F4','PREPARING',{date:H2H_DAY,lineup:{starters:['CHEAT']}});
    const after=(await backend.rawSelect(alexId,'velmora_multiplayer_match_submissions',
      {career_id:careerId,fixture_id:'F4',user_id:alexId}))[0];
    assert.deepEqual(after.lineup,before,'the locked line-up is unchanged');
    assert.equal(after.state,'READY','and the confirmation cannot be withdrawn');
    const samAfter=(await backend.rawSelect(samId,'velmora_multiplayer_match_submissions',
      {career_id:careerId,fixture_id:'F4',user_id:samId}))[0];
    assert.equal(samAfter.state,'READY','the same lock applies to the other manager');
  });

  await check('a human-versus-human tie stores one result, not two',async()=>{
    // Both devices run the same deterministic resolution and reach the same
    // score; only one of them may store it.
    alex.bridge._playLocally('F4',1,0);
    sam.bridge._playLocally('F4',1,0);
    const [one,two]=await Promise.all([
      alex.client.recordMatchResult('F4',{date:H2H_DAY,homeClubId:ALEX_CLUB,awayClubId:SAM_CLUB,
        homeScore:1,awayScore:0,result:{report:null},mode:'QUICK_SIM'}),
      sam.client.recordMatchResult('F4',{date:H2H_DAY,homeClubId:ALEX_CLUB,awayClubId:SAM_CLUB,
        homeScore:1,awayScore:0,result:{report:null},mode:'QUICK_SIM'})
    ]);
    const writes=[one,two].filter(row=>row&&row.first_write===true);
    assert.equal(writes.length,1,'only one of the two devices wrote the result');
    const rows=await backend.rawSelect(alexId,'velmora_multiplayer_match_results',
      {career_id:careerId,fixture_id:'F4'});
    assert.equal(rows.length,1,'one authoritative result exists for the tie');
    const events=await backend.rawSelect(alexId,'velmora_multiplayer_events',
      {career_id:careerId,fixture_id:'F4'});
    assert.equal(events.filter(row=>row.kind==='MATCH_RESULT').length,1,
      'and one MATCH_RESULT event, so no contradictory history can exist');
  });

  // ---------------------------------------------------------------
  await check('transfer conflict has one winner and a clear loser',async()=>{
    const subject=core.subjectKeys.player('player-9','2026-summer');
    const [alexTry,samTry]=await Promise.all([
      alex.client.claimWorldAction({kind:'TRANSFER',subjectKey:subject,
        payload:{playerId:'player-9',toClubId:ALEX_CLUB,fee:4200000},
        idempotencyKey:'alex-signs-9'}),
      sam.client.claimWorldAction({kind:'TRANSFER',subjectKey:subject,
        payload:{playerId:'player-9',toClubId:SAM_CLUB,fee:4400000},
        idempotencyKey:'sam-signs-9'})
    ]);
    const claimed=[alexTry,samTry].filter(row=>row.claimed);
    const refused=[alexTry,samTry].filter(row=>!row.claimed);
    assert.equal(claimed.length,1,'only one manager signs the player');
    assert.equal(refused.length,1);
    assert.equal(refused[0].reason,'TAKEN');
    assert.match(refused[0].message,/completed that action first/,
      'the losing manager gets a sentence, not a database error');

    const events=await backend.rawSelect(alexId,'velmora_multiplayer_events',
      {career_id:careerId,subject_key:subject});
    assert.equal(events.length,1,'the log holds exactly one transfer for that player');

    // Repeating the winner's own request is a safe retry, not a second transfer.
    const winnerId=claimed[0].event.payload.toClubId===ALEX_CLUB?alex:sam;
    const retry=await winnerId.client.claimWorldAction({kind:'TRANSFER',subjectKey:subject,
      payload:{playerId:'player-9'},
      idempotencyKey:winnerId===alex?'alex-signs-9':'sam-signs-9'});
    assert.equal(retry.claimed,true,'the winner\'s retry succeeds');
    assert.equal(retry.event.replayed,true,'because it replays the original event');
    const after=await backend.rawSelect(alexId,'velmora_multiplayer_events',
      {career_id:careerId,subject_key:subject});
    assert.equal(after.length,1,'and still only one transfer exists');
  });

  await check('repeated prize money and inbox events cannot double-apply',async()=>{
    const prize=core.subjectKeys.prize('rsl','2026-27');
    const first=await alex.client.claimWorldAction({kind:'WORLD_ACTION',subjectKey:prize,
      payload:{award:250000},idempotencyKey:'prize-a'});
    const second=await sam.client.claimWorldAction({kind:'WORLD_ACTION',subjectKey:prize,
      payload:{award:250000},idempotencyKey:'prize-b'});
    assert.equal(first.claimed,true);
    assert.equal(second.claimed,false,'the same prize cannot be awarded twice');
  });

  // ---------------------------------------------------------------
  await check('private state never reaches the other manager',async()=>{
    alex.bridge.captureIdentity=()=>({transferShortlist:['secret-target'],careerPreferences:{tactics:'draft'}});
    await alex.client.savePrivateState();
    const mine=await alex.client.loadPrivateState(careerId);
    assert.deepEqual(mine.transferShortlist,['secret-target'],'a manager can resume their own drawer');

    const theirs=await sam.client.loadPrivateState(careerId);
    assert.equal(theirs,null,'the other manager reads nothing of it');
    const rows=await backend.rawSelect(samId,'velmora_multiplayer_manager_private',{career_id:careerId});
    assert.equal(rows.filter(row=>row.user_id===alexId).length,0,
      'and cannot select the row directly either');

    // Nothing confidential leaks through the status the interface renders.
    const shown=JSON.stringify(sam.client.status());
    assert.equal(shown.includes('secret-target'),false,'no shortlist in the shared status');
    assert.equal(shown.includes('draft'),false,'no draft tactics in the shared status');
  });

  await check('activity is reported only in broad terms',async()=>{
    await alex.client.touchPresence('transfers');
    await sam.client.refreshLobby();
    const other=sam.client.status().others.find(row=>row.user_id===alexId);
    assert.equal(other.activity,'Transfers','the other manager sees the area, not the detail');
    assert.equal(core.activityLabel('some-unmapped-private-screen'),'In the office',
      'an unmapped screen degrades to a safe label rather than leaking its name');
  });

  // ---------------------------------------------------------------
  await check('disconnect and reconnect keeps one coherent world',async()=>{
    await sam.client.detach();
    // While Sam is away, Alex changes his own club and the world moves on.
    alex.bridge._world().clubState[ALEX_CLUB]={squads:['alex-3'],marker:'WHILE-AWAY'};
    await alex.client.publishClubState('while-away');

    const reconnected=makeSession(backend,samId,{clubId:SAM_CLUB,identity:{managerName:'Sam'}});
    const attached=await reconnected.client.attach(careerId);
    assert.equal(attached.ok,true,'reconnecting restores the career');
    assert.equal(reconnected.bridge._world().clubState[ALEX_CLUB].marker,'WHILE-AWAY',
      'and catches up on everything missed');
    assert.equal(reconnected.bridge._world().date,'2026-08-09','including the shared date');
    assert.equal(reconnected.bridge._world().counters.advance<=2,true,
      'without replaying the advance a second time');
    sam=reconnected;
  });

  await check('the human-versus-human barrier resolves and both worlds move together',async()=>{
    await alex.client.refreshLobby();
    assert.equal(alex.client.status().barrier.resolvable,true,'with the tie stored the barrier can close');
    const closed=await alex.client.resolveBarrier(H2H_DAY,'2026-08-16');
    assert.equal(closed.status,'RESOLVED');
    await alex.client.pullEvents();
    await sam.client.pullEvents();
    assert.equal(alex.bridge._world().date,'2026-08-16');
    assert.equal(sam.bridge._world().date,'2026-08-16','both devices share one calendar');
  });

  await check('a manager with an unplayed fixture blocks only until it is done',async()=>{
    const claims=await backend.rawSelect(alexId,'velmora_multiplayer_club_claims',{career_id:careerId});
    const required=core.requiredParticipants({
      fixtures:alex.bridge._world().fixtures,claims,date:'2026-08-22'});
    assert.equal(required.length,1,'only Alex has a fixture on that date');
    await alex.client.openBarrier('2026-08-22',required);
    await alex.client.refreshLobby();
    assert.equal(alex.client.status().barrier.locked,true,'his own unplayed fixture blocks him');

    // An ordinary member cannot remove a manager who is demonstrably active.
    await alex.client.touchPresence('central');
    await assert.rejects(()=>sam.client.convertToAi(careerId,alexId,'ABSENT'),
      /VELMORA_MANAGER_STILL_ACTIVE/,
      'a connected manager cannot be handed to the AI by the other player');

    const audit=await backend.rawSelect(alexId,'velmora_multiplayer_audit',{career_id:careerId});
    assert.ok(audit.length>0,'membership changes are recorded in the audit history');
  });

  await check('the host is not required for progression',async()=>{
    // Sam is not the host, yet resolved a barrier earlier in this suite.
    const members=await backend.rawSelect(alexId,'velmora_multiplayer_members',{career_id:careerId});
    const host=members.find(row=>row.role==='HOST');
    assert.equal(host.user_id,alexId,'Alex is the host');
    const resolved=await backend.rawSelect(alexId,'velmora_multiplayer_matchday_barriers',
      {career_id:careerId,career_date:'2026-08-08'});
    assert.equal(resolved[0].status,'RESOLVED');
    assert.ok(resolved[0].resolved_by,'and a resolver is recorded');
  });

  await check('only the host can archive the career',async()=>{
    await assert.rejects(()=>sam.client.archiveCareer(careerId,false),
      /VELMORA_HOST_ONLY/,'a guest cannot archive the shared career');
    const list=await sam.client.listCareers();
    assert.equal(list.length,1,'the career still appears in the guest\'s online careers list');
    assert.equal(list[0].club_id,SAM_CLUB,'with their own club');
    assert.equal(list[0].is_host,false);
    assert.equal(list[0].join_code,null,'and no invitation code, which is the host\'s to share');
  });

  await check('host recovery hands an absent club to the AI, and is audited',async()=>{
    // The host may always do this, with an explicit confirmation in the
    // interface; it is recorded, and it unblocks the shared calendar.
    const converted=await alex.client.convertToAi(careerId,samId,'ABSENT');
    assert.equal(converted.changed,true);
    assert.equal(converted.status,'AI_CONTROLLED');
    assert.equal(converted.club_id,SAM_CLUB,'the club is released back to the world');

    const claims=await backend.rawSelect(alexId,'velmora_multiplayer_club_claims',{career_id:careerId});
    assert.equal(claims.some(row=>row.club_id===SAM_CLUB),false,'the claim is gone');

    const audit=await backend.rawSelect(alexId,'velmora_multiplayer_audit',{career_id:careerId});
    const entry=audit.find(row=>row.action==='MANAGER_CONVERTED_AI');
    assert.ok(entry,'the recovery action is written to the audit history');
    assert.equal(entry.target_user_id,samId);
    assert.equal(entry.detail.by_host,true);

    // An AI-controlled club is no longer a required participant.
    const required=core.requiredParticipants({
      fixtures:alex.bridge._world().fixtures,claims,date:'2026-08-22'});
    assert.equal(required.every(row=>row.user_id!==samId),true,
      'the absent manager can no longer block a matchday');

    // And the recovery is idempotent.
    const again=await alex.client.convertToAi(careerId,samId,'ABSENT');
    assert.equal(again.changed,false,'repeating the recovery changes nothing');
  });

  await check('version compatibility is checked before attaching',async()=>{
    const blocked=core.versionCompatibility('103.0.3','99.0.0');
    assert.equal(blocked.compatible,false);
    assert.match(blocked.message,/same major game version/);
    const warn=core.versionCompatibility('103.0.3','103.1.0');
    assert.equal(warn.compatible,true);
    assert.equal(warn.level,'WARN');
    const newerCareer=core.saveSchemaCompatibility(999,86);
    assert.equal(newerCareer.compatible,false,'an older client refuses a newer career');
  });

  if(report)report(results);
  return results;
}

module.exports={run,ALEX_CLUB,SAM_CLUB};
