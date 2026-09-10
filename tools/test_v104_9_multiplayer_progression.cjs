'use strict';
// V104.9 · Two managers, one deliberate calendar

const assert=require('node:assert/strict');
const {runtime}=require('./career_test_runtime.cjs');

const r=runtime(),q=r.q,win=r.context.window;
const core=win.VelmoraMultiplayerCore,online=win.VelmoraMultiplayerGame;
const clubs=r.context.VELMORA_CLUBS;
const mine=clubs.find(club=>club.id==='redwick');
const theirs=clubs.find(club=>club.id!==mine.id&&club.divisionKey===mine.divisionKey);

r.d.assignClubForTest(mine);
q.initializeCareerLifecycle();

const claims=[
  {user_id:'u1',club_id:mine.id,club_name:mine.name,manager_name:'Kurgen Jlopp',status:'ACTIVE'},
  {user_id:'u2',club_id:theirs.id,club_name:theirs.name,manager_name:'Second Manager',status:'ACTIVE'}
];
const members=claims.map(row=>({...row,display_name:row.manager_name}));
const submitted=[];
let submissions=[],results=[],rawBarrier=null;

function status(){
  const barrier=core.barrierState({barrier:rawBarrier,members,submissions,results});
  const date=barrier.date||q.currentCareerISO();
  const dayAdvance=core.dayAdvanceState({date,members,submissions,results});
  return{readOnly:false,careerDate:date,members,barrier,dayAdvance,
    waitingMessage:core.waitingMessage(barrier,dayAdvance),locked:barrier.locked,resolvable:barrier.resolvable};
}
function sync(){
  const next=status();
  online.update({status:next,submissions:next.barrier.participants,claims,members});
  return next;
}
const client={
  status,
  openBarrier(date,required){rawBarrier={career_date:date,status:'OPEN',required};sync();return Promise.resolve(rawBarrier);},
  submitMatchState(fixtureId,state,payload={}){
    submitted.push({fixtureId,state,payload});
    submissions=submissions.filter(row=>!(row.user_id==='u1'&&row.fixture_id===fixtureId));
    submissions.push({user_id:'u1',club_id:mine.id,fixture_id:fixtureId,state,career_date:payload.date});
    sync();return Promise.resolve({fixture_id:fixtureId,state});
  },
  recordMatchResult(fixtureId){results.push({fixture_id:fixtureId});sync();return Promise.resolve({fixture_id:fixtureId,first_write:true});},
  resolveBarrier(){return Promise.resolve({status:'OPEN'});},
  scheduleClubPublish(){},schedulePrivatePublish(){}
};
online.begin({careerId:'v104-9',clubId:mine.id,userId:'u1',humanClubIds:[mine.id,theirs.id],
  claims,members,client,identity:online.captureIdentity(),status:{readOnly:false,barrier:null}});

// The screenshot failure: an August 8 barrier was blocking a device whose
// rendered calendar was still August 3.
const localDate=q.currentCareerISO(),future=q.addDaysISO(localDate,5);
online.update({status:{readOnly:false,careerDate:future,members,
  barrier:{locked:true,date:future,outstanding:[{...claims[0],fixture_id:'FUTURE'}],participants:[]},
  waitingMessage:`Waiting for Kurgen Jlopp at ${mine.name} to complete their fixture.`}});
assert.equal(online.progressionBlock(),null,'a barrier from another date cannot block this screen');
assert.equal(win.VelmoraMultiplayerBridge.syncSharedDate(future),true,'the client catches up to the authoritative shared date');
assert.equal(q.currentCareerISO(),future);

// Even on the correct date, the local fixture route wins over the shared
// progression lock, so the manager can always enter Matchday.
const fixture=q.state().fixtures.find(row=>!row.played&&(row.homeClubId===mine.id||row.awayClubId===mine.id));
assert.ok(fixture,'the manager has a fixture to exercise');
q.setCareerDate(fixture.date);
online.update({status:{readOnly:false,careerDate:fixture.date,members,
  barrier:{locked:true,date:fixture.date,outstanding:[{...claims[0],fixture_id:fixture.fixtureId}],participants:[]},
  waitingMessage:`Waiting for Kurgen Jlopp at ${mine.name} to complete their fixture.`}});
assert.equal(q.advanceCareerDay({silent:true}).reason,'MATCHDAY','a manager is routed to their own fixture, never blocked by their own name');

// Human-versus-human Matchday used to wait for READY submissions that the UI
// never sent. Pressing Play/Quick Sim now submits this manager's line-up.
fixture.homeClubId=mine.id;fixture.awayClubId=theirs.id;fixture.played=false;
q.set('fixtures',[fixture]);
rawBarrier={career_date:fixture.date,status:'OPEN',required:core.requiredParticipants({
  fixtures:[fixture],claims,date:fixture.date,requireAdvance:true
})};
sync();

(async()=>{
  const started=await q.v104PrepareHumanFixture(fixture,'QUICK SIM');
  assert.equal(started,false,'the first manager waits instead of resolving the tie alone');
  assert.equal(submitted.some(row=>row.fixtureId===fixture.fixtureId&&row.state==='READY'),true,
    'the Matchday action submits the local line-up as ready');
  assert.equal(q.v104MatchGate(fixture).allowed,false,'one line-up confirmation is not enough');

  submissions.push({user_id:'u2',club_id:theirs.id,fixture_id:fixture.fixtureId,state:'READY',career_date:fixture.date});
  sync();
  assert.equal(q.v104MatchGate(fixture).allowed,true,'both line-ups unlock the elected resolver');

  // A failed barrier open must not poison the per-date cache. The next
  // connected attempt should perform a real retry and repair the day.
  const originalOpen=client.openBarrier;
  let openAttempts=0;
  client.openBarrier=(date,required)=>{
    openAttempts++;
    if(openAttempts===1)return Promise.reject(new Error('temporary network failure'));
    return originalOpen(date,required);
  };
  const barrierRetryDate='2034-12-31';
  assert.equal(await q.v104EnsureBarrier(barrierRetryDate),null);
  assert.ok(await q.v104EnsureBarrier(barrierRetryDate),'a failed barrier open is retried after reconnect');
  assert.equal(openAttempts,2);
  client.openBarrier=originalOpen;

  // A barrier created by the previous release has no DAY_ADVANCE rows of its
  // own. It must still wait for both managers rather than auto-resolving as
  // soon as the day's fixtures are complete.
  const legacyDate='2034-12-30',legacyId=core.dayAdvanceId(legacyDate);
  q.setCareerDate(legacyDate);
  rawBarrier={career_date:legacyDate,status:'OPEN',required:[]};
  submissions=[{user_id:'u1',club_id:mine.id,fixture_id:legacyId,state:'READY',career_date:legacyDate}];
  results=[];
  let legacyResolveCalls=0;
  client.resolveBarrier=()=>{legacyResolveCalls++;return Promise.resolve({status:'RESOLVED'});};
  const legacyWaiting=sync();
  assert.match(legacyWaiting.waitingMessage,/Second Manager.*confirm Advance/);
  assert.equal(online.progressionBlock()?.reason,'BARRIER','the confirming manager sees the older barrier as locked');
  assert.equal(await q.v104TryResolveBarrier(),null,'one confirmation cannot close an older barrier');
  assert.equal(legacyResolveCalls,0);
  submissions.push({user_id:'u2',club_id:theirs.id,fixture_id:legacyId,state:'READY',career_date:legacyDate});
  sync();
  assert.equal((await q.v104TryResolveBarrier()).status,'RESOLVED');
  assert.equal(legacyResolveCalls,1,'an older barrier closes once both managers confirm');

  // The same retry rule applies after both Advance confirmations. If result
  // recording succeeds but barrier resolution is interrupted, a later status
  // refresh must be able to finish the exact same date.
  const finalizerDate='2035-01-01',finalizerId=core.dayAdvanceId(finalizerDate);
  q.setCareerDate(finalizerDate);
  submissions=[
    {user_id:'u1',club_id:mine.id,fixture_id:finalizerId,state:'READY',career_date:finalizerDate},
    {user_id:'u2',club_id:theirs.id,fixture_id:finalizerId,state:'READY',career_date:finalizerDate}
  ];
  results=[];
  rawBarrier={career_date:finalizerDate,status:'OPEN',required:core.requiredParticipants({
    fixtures:[],claims,date:finalizerDate,requireAdvance:true
  })};
  let resolveAttempts=0;
  client.resolveBarrier=()=>Promise.resolve({status:++resolveAttempts===1?'OPEN':'RESOLVED'});
  const interrupted=await q.v104FinalizeSharedAdvanceIfReady(sync());
  assert.equal(interrupted.status,'OPEN');
  const recovered=await q.v104FinalizeSharedAdvanceIfReady(sync());
  assert.equal(recovered.status,'RESOLVED','an interrupted finalizer is retried after reconnect');
  assert.equal(resolveAttempts,2);

  console.log(JSON.stringify({status:'PASS',version:'V104.9',checks:[
    'a barrier from another date never blocks the rendered calendar',
    'an interrupted older snapshot catches up to the authoritative date',
    'a manager can always enter their own live Matchday',
    'Play and Quick Sim submit human-versus-human readiness',
    'one line-up waits and two line-ups unlock the fixture',
    'older open barriers still require both Advance confirmations',
    'failed barrier opens and finalizers retry after reconnect'
  ]},null,2));
})().catch(error=>{console.error(error);process.exit(1);});
