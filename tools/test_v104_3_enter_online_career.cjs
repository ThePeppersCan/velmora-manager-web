'use strict';
// V104.3 · Entering an online career
//
// Found by running the two-browser walkthrough rather than the API: the career
// was created, the world was generated and published, both managers showed
// READY -- and neither could get in. The lobby simply sat there.
//
// The cause was an ordering assumption. Applying the shared world snapshot
// needs the online session to exist first, because the snapshot deliberately
// carries no identity: the manager, the club and the list of human clubs are
// all read back out of the session. The UI attached (which applies the
// snapshot) and only then called begin(), so every attach failed.
//
// The earlier suites missed it because they called begin() first -- the order
// that is convenient to write, not the order the product uses. These checks
// therefore drive the same sequence the interface drives, and assert on the
// two failure modes that made this invisible: a world that will not apply,
// and an error the interface then throws away.

const assert=require('node:assert/strict');
const {runtime}=require('./career_test_runtime.cjs');

const HOST_CLUB='ashwick';
const GUEST_CLUB='aurelia';

// A host generates the shared world exactly as prepareWorld() does.
const host=runtime();
const hostClub=host.context.VELMORA_CLUBS.find(c=>c.id===HOST_CLUB);
const guestClub=host.context.VELMORA_CLUBS.find(c=>c.id===GUEST_CLUB);
assert.ok(hostClub&&guestClub,'both test clubs exist in the world');
host.d.assignClubForTest(hostClub);
host.q.initializeCareerLifecycle();
const snapshot=host.context.window.VelmoraMultiplayerBridge.buildSnapshot();
assert.ok(snapshot&&snapshot.payload,'the host publishes a world snapshot');

function joiningDevice(){
  const dev=runtime();
  const G=dev.context.window.VelmoraMultiplayerGame;
  const B=dev.context.window.VelmoraMultiplayerBridge;
  const session={
    careerId:'career-1',clubId:guestClub.id,userId:'u2',
    humanClubIds:[hostClub.id,guestClub.id],
    claims:[{user_id:'u1',club_id:hostClub.id},{user_id:'u2',club_id:guestClub.id}],
    identity:G.captureIdentity(),client:null,status:null
  };
  return{dev,G,B,session};
}

// ---------------------------------------------------------------
// The order the interface actually uses must work
// ---------------------------------------------------------------
const a=joiningDevice();
a.G.begin(a.session);
assert.equal(a.B.applySnapshot(snapshot.payload),true,
  'a device that has begun its session can apply the shared world');
assert.equal(a.dev.q.state().currentClub?.id,guestClub.id,
  'and lands in the career holding its own club');
assert.equal(a.dev.q.state().worldSeed,host.q.state().worldSeed,
  'sharing the host world seed');

// ---------------------------------------------------------------
// The order that shipped must not silently produce a clubless career
// ---------------------------------------------------------------
const b=joiningDevice();
const appliedWithoutSession=b.B.applySnapshot(snapshot.payload);
if(appliedWithoutSession){
  assert.notEqual(b.dev.q.state().currentClub?.id,null,
    'applying a world without a session must never leave the career with no club');
}

// ---------------------------------------------------------------
// The other human's club is reserved, so this device never simulates it
// ---------------------------------------------------------------
const reserved=a.dev.context.window.VelmoraMultiplayerGame.session();
assert.deepEqual([...(reserved.humanClubIds||[])].sort(),[hostClub.id,guestClub.id].sort(),
  'both human clubs are registered on the joining device');
const hostFixture=a.dev.q.state().fixtures.find(f=>
  !f.played&&(f.homeClubId===hostClub.id||f.awayClubId===hostClub.id));
if(hostFixture){
  a.dev.q.simulateWorldFixturesForDate(hostFixture.date);
  const after=a.dev.q.state().fixtures.find(f=>f.fixtureId===hostFixture.fixtureId);
  assert.equal(after.played,false,
    'the other manager\'s fixture is never resolved locally');
}

// ---------------------------------------------------------------
// A failure to enter has to reach the manager, not be swallowed
// ---------------------------------------------------------------
const uiSource=require('node:fs')
  .readFileSync(require('node:path').resolve(__dirname,'..','multiplayer-ui.js'),'utf8');
assert.match(uiSource,/const noticeBefore=notice;/,
  'the action guard remembers the notice it started with');
assert.match(uiSource,/if\(notice===noticeBefore\)clearNotice\(\);/,
  'so a message raised during the action survives instead of being cleared');
assert.match(uiSource,/game\(\)\?\.begin\(\{[\s\S]{0,600}?\}\);\s*\n\s*const attached=await client\.attach/,
  'the interface begins the session before it attaches');

// ---------------------------------------------------------------
// The lobby keeps itself current before there is anything to attach to
// ---------------------------------------------------------------
assert.match(uiSource,/function startLobbyPoll\(\)/,'the lobby has its own heartbeat');
assert.match(uiSource,/stopLobbyPoll\(\);\s*\n\s*if\(!overlay\)return;/,
  'and it stops when the lobby closes');
assert.match(uiSource,/await loadLobby\(lobby\.careerId\);\s*\n\s*const seats=lobby\.members\|\|\[\];/,
  'starting a career re-reads the seats first');
assert.match(uiSource,/seats\.length<2\|\|!seats\.every\(row=>row\.ready&&row\.club_id\)/,
  'and refuses to start on a half-known lobby');

console.log(JSON.stringify({
  status:'PASS',
  version:'V104.3',
  hostClub:hostClub.name,
  guestClub:guestClub.name,
  appliedWithoutSession,
  checks:[
    'a begun session can apply the shared world',
    'the joining device lands holding its own club',
    'both devices share one career seed',
    'applying without a session never yields a clubless career',
    'both human clubs are reserved on the joining device',
    'the other manager\'s fixture is never resolved locally',
    'an error raised during an action is not cleared by the guard',
    'the interface begins the session before attaching',
    'the lobby polls while it is open and stops when closed',
    'starting a career re-reads the seats and refuses a half-known lobby'
  ]
},null,2));
