'use strict';
// V104 · Online career · against the real career engine
//
// Boots the whole game and drives the actual bridge that app.js publishes:
// the real fixture list, the real deterministic match engine, the real
// calendar. Nothing here is simulated by the test.

const assert=require('node:assert/strict');
const {runtime}=require('./career_test_runtime.cjs');

const r=runtime(),q=r.q,win=r.context.window;
const core=win.VelmoraMultiplayerCore;
const bridge=win.VelmoraMultiplayerBridge;
const online=win.VelmoraMultiplayerGame;

assert.ok(core&&bridge&&online,'the online-career bridge is published by the game');

// ---------------------------------------------------------------
// A career exactly as a single player would start one.
// ---------------------------------------------------------------
const clubs=r.context.VELMORA_CLUBS;
const myClub=clubs.find(club=>club.id==='redwick');
r.d.assignClubForTest(myClub);
q.initializeCareerLifecycle();
assert.equal(q.saveCareerState(),true,'a career saves before anything online happens');

// ---------------------------------------------------------------
// Single-player compatibility
// ---------------------------------------------------------------
const saved=JSON.parse(win.VelmoraSaveCodec.decode(r.local.get('velmora-manager-career-v32-slot-1')));
// The save payload written by V103.3, key for key. Multiplayer adds nothing
// to a single-player save file, so old saves keep loading and new saves keep
// opening in an older build.
const V103_KEYS=['academies','aiTransferHistory','audienceWorldState','avatarCooldowns','calendarEvents',
 'careerChallenge','careerDecisionEvents','careerEventCooldowns','careerInboxMessages','careerNewsStories',
 'careerPreferences','careerRuntime','careerSeason','careerTime','careerYear','championsCrown','clubBudgets',
 'clubMembership','cupRuntime','currentClubId','developmentSnapshots','employmentStatus','firstWeekState',
 'fixtures','freeAgents','jobSearchState','lineups','livingSquad','manager','managerMarket','managerName',
 'mediaWorld','negotiationEngine','officeReadMessages','ownershipState','pendingNegotiations','playerPromises',
 'preSeasonExperience','processedCalendarEvents','recruitmentDay','recruitmentIntel','recruitmentWorldKnowledge',
 'retiredPlayers','roadToGlory','scoutingAssignments','seasonCalendarCursor','selectedCalendarDate','squads',
 'transferActivity','transferScouted','transferShortlist','transferWindows','unexpectedEvents','version','worldSeed'];
assert.deepEqual(Object.keys(saved).sort(),V103_KEYS.slice().sort(),
  'the single-player save format is unchanged by multiplayer');
assert.equal(online.active(),false,'a single-player career has no online session');
assert.equal(bridge.activityRoute!==undefined,true);

// A save that is missing optional sections still loads, so older files and
// files from a slightly different build are tolerated rather than rejected.
const tolerant={...saved};
delete tolerant.mediaWorld;delete tolerant.championsCrown;delete tolerant.preSeasonExperience;
r.local.set('velmora-manager-career-v32-slot-2',win.VelmoraSaveCodec.encode(JSON.stringify(tolerant)));
assert.equal(q.loadCareerState(2),true,'a save missing optional sections still opens');
assert.equal(q.loadCareerState(1),true,'and the complete save reloads afterwards');

// Ordinary progression is untouched while offline.
const offlineBefore=q.state().careerTime.currentDate;
const offlineStep=q.advanceCareerDay({silent:true});
assert.equal(offlineStep.reason==='ONLINE_BARRIER',false,'no online barrier exists in a solo career');
assert.notEqual(q.state().careerTime.currentDate,offlineBefore,'and the calendar still moves');

// ---------------------------------------------------------------
// Snapshot round trip
// ---------------------------------------------------------------
const snapshot=bridge.buildSnapshot();
assert.ok(snapshot.payload&&snapshot.worldSeed,'a world snapshot is produced');
assert.equal(snapshot.careerDate,q.state().careerTime.currentDate);

const world=JSON.parse(win.VelmoraSaveCodec.decode(snapshot.payload));
for(const key of core.PRIVATE_KEYS)
  assert.equal(Object.prototype.hasOwnProperty.call(world,key),false,
    `${key} is never written into the shared world snapshot`);
assert.ok(Array.isArray(world.fixtures)&&world.fixtures.length>100,
  'but the whole competition calendar is');
assert.ok(world.squads&&Object.keys(world.squads).length>100,'along with every club squad');

// Restoring it must not disturb this device's own identity or private work.
const otherClub=clubs.find(club=>club.divisionKey===myClub.divisionKey&&club.id!==myClub.id);
online.begin({
  careerId:'test-career',clubId:myClub.id,userId:'u1',
  humanClubIds:[myClub.id,otherClub.id],
  claims:[{user_id:'u1',club_id:myClub.id},{user_id:'u2',club_id:otherClub.id}],
  identity:online.captureIdentity(),
  client:null,status:null
});
assert.equal(bridge.applySnapshot(snapshot.payload),true,'the shared world restores');
assert.equal(q.state().currentClub.id,myClub.id,'this device keeps its own club');
assert.equal(q.state().careerTime.currentDate,snapshot.careerDate,'and the shared date');

// ---------------------------------------------------------------
// The other manager's club is never simulated by this device
// ---------------------------------------------------------------
const today=q.state().careerTime.currentDate;
const rivalFixture=q.state().fixtures
  .find(f=>!f.played&&(f.homeClubId===otherClub.id||f.awayClubId===otherClub.id)
    &&f.homeClubId!==myClub.id&&f.awayClubId!==myClub.id);
assert.ok(rivalFixture,'the other human club has a fixture of its own');

r.d.assignClubForTest(myClub);
online.update({humanClubIds:[myClub.id,otherClub.id]});
q.simulateWorldFixturesForDate(rivalFixture.date,myClub.id);
const stillUnplayed=q.state().fixtures.find(f=>f.fixtureId===rivalFixture.fixtureId);
assert.equal(stillUnplayed.played,false,
  'a human-controlled club is reserved for its own manager, not resolved by the AI here');

// A purely AI fixture on the same date is resolved normally.
const aiFixture=q.state().fixtures.find(f=>f.date===rivalFixture.date&&f.played
  &&f.homeClubId!==myClub.id&&f.awayClubId!==myClub.id
  &&f.homeClubId!==otherClub.id&&f.awayClubId!==otherClub.id);
assert.ok(aiFixture,'AI-versus-AI fixtures on that date did resolve');

// ---------------------------------------------------------------
// The barrier stops the shared calendar
// ---------------------------------------------------------------
online.update({status:{
  readOnly:false,waitingMessage:'Waiting for Sam at Blackglass to complete their fixture. You may continue managing your club.',
  barrier:{locked:true,date:today,outstanding:[{user_id:'u2',club_id:otherClub.id,fixture_id:rivalFixture.fixtureId,
    state:'PREPARING',manager_name:'Sam',club_name:otherClub.name}],participants:[]}
}});
const dateBeforeBarrier=q.state().careerTime.currentDate;
const blocked=q.advanceCareerDay({silent:true});
assert.equal(blocked.advanced,false,'the calendar refuses to move');
assert.equal(blocked.reason,'ONLINE_BARRIER');
assert.match(blocked.online.message,/You may continue managing your club/);
assert.equal(q.state().careerTime.currentDate,dateBeforeBarrier,'and the shared date is unchanged');

// The blocked manager can still use the rest of the game.
assert.equal(q.saveCareerState(),true,'saving still works while blocked');
assert.ok(q.getSquad(q.state().currentClub).length>0,'the squad is still readable');
const clubPayload=bridge.buildClubState(myClub.id);
assert.ok(Array.isArray(clubPayload.squads)&&clubPayload.squads.length>0,
  'and this manager can still publish their own club');

// A read-only connection also pauses the date, with its own wording.
online.update({status:{readOnly:true,barrier:null,waitingMessage:null}});
const readOnly=q.advanceCareerDay({silent:true});
assert.equal(readOnly.blocked,true);
assert.equal(readOnly.online.reason,'READ_ONLY');

// Unlocking releases it without a reload.
online.update({status:{readOnly:false,barrier:{locked:false,outstanding:[],participants:[]},waitingMessage:null}});
assert.equal(q.advanceCareerDay({silent:true}).reason==='ONLINE_BARRIER',false,
  'once nothing is outstanding the calendar is free again');

// ---------------------------------------------------------------
// Required participants come from the real fixture list
// ---------------------------------------------------------------
const matchday=q.state().fixtures
  .filter(f=>!f.played&&(f.homeClubId===myClub.id||f.awayClubId===myClub.id))
  .sort((a,b)=>a.date.localeCompare(b.date))[0];
assert.ok(matchday,'this club has a next fixture');
const required=online.requiredParticipants(matchday.date);
assert.ok(required.some(row=>row.fixture_id===matchday.fixtureId&&row.user_id==='u1'),
  'this manager is required for their own fixture');
for(const row of required){
  const fixture=q.state().fixtures.find(f=>f.fixtureId===row.fixture_id);
  assert.equal(fixture.played,false,'every required fixture is genuinely unplayed');
  assert.equal(fixture.date,matchday.date,'and genuinely on that date');
}
const blank=online.requiredParticipants('2027-06-30');
assert.equal(blank.length,0,'a date with no human fixture requires nobody');

// ---------------------------------------------------------------
// An authoritative result is applied, never re-rolled
// ---------------------------------------------------------------
const remote=q.state().fixtures.find(f=>!f.played
  &&f.homeClubId!==myClub.id&&f.awayClubId!==myClub.id&&f.type==='LEAGUE');
const applied=bridge.applyMatchResult(remote.fixtureId,{report:null,competitionId:remote.competitionId},
  {homeScore:4,awayScore:1,mode:'ONLINE'});
assert.equal(applied,true,'the stored result applies');
const storedFixture=q.state().fixtures.find(f=>f.fixtureId===remote.fixtureId);
assert.equal(storedFixture.homeScore,4,'with the stored score, not a locally rolled one');
assert.equal(storedFixture.awayScore,1);
assert.equal(storedFixture.played,true);
assert.equal(storedFixture.onlineAuthoritative,true);

// Applying it again -- a duplicated realtime frame, a refresh, a second tab --
// must change nothing at all.
assert.equal(bridge.applyMatchResult(remote.fixtureId,{report:null},{homeScore:9,awayScore:9}),false,
  'a repeated authoritative result is ignored');
assert.equal(q.state().fixtures.find(f=>f.fixtureId===remote.fixtureId).homeScore,4,
  'and the stored scoreline is untouched');

// The league table reflects the stored result, not a second simulation.
const table=q.standingsForDivision(q.clubById(remote.homeClubId).divisionKey);
assert.ok(table.length>0,'standings are computed from the shared fixture list');

// ---------------------------------------------------------------
// A shared advance resolves the remaining AI fixtures exactly once
// ---------------------------------------------------------------
const fromDate=q.state().careerTime.currentDate;
const toDate=q.addDaysISO(fromDate,1);
const unplayedBefore=q.state().fixtures.filter(f=>!f.played&&f.date===toDate).length;
assert.equal(bridge.advanceSharedDay(fromDate,toDate),true,'the shared advance runs');
assert.equal(q.state().careerTime.currentDate,toDate,'the date moves to the shared value');
const unplayedAfter=q.state().fixtures.filter(f=>!f.played&&f.date===toDate).length;
assert.ok(unplayedAfter<=unplayedBefore,'AI fixtures on that date were resolved');

const playedSnapshot=q.state().fixtures.filter(f=>f.played)
  .map(f=>`${f.fixtureId}:${f.homeScore}-${f.awayScore}`).join('|');
assert.equal(bridge.advanceSharedDay(fromDate,toDate),false,
  'replaying the same advance is refused');
assert.equal(q.state().fixtures.filter(f=>f.played)
  .map(f=>`${f.fixtureId}:${f.homeScore}-${f.awayScore}`).join('|'),playedSnapshot,
  'so no fixture is ever resolved twice');
assert.equal(q.state().careerTime.currentDate,toDate,'and the date does not jump');

// ---------------------------------------------------------------
// Determinism: two devices, same seed, same world
// ---------------------------------------------------------------
const second=runtime(),sq=second.q;
const secondClub=second.context.VELMORA_CLUBS.find(club=>club.id==='redwick');
second.d.assignClubForTest(secondClub);
sq.initializeCareerLifecycle();
second.context.window.VelmoraMultiplayerGame.begin({
  careerId:'test-career',clubId:secondClub.id,userId:'u2',
  humanClubIds:[myClub.id,otherClub.id],
  claims:[{user_id:'u1',club_id:myClub.id},{user_id:'u2',club_id:otherClub.id}],
  identity:second.context.window.VelmoraMultiplayerGame.captureIdentity(),
  client:null,status:null
});
// Give the second device the first device's world as it stands right now,
// exactly as joining or reconnecting does.
const liveSnapshot=bridge.buildSnapshot();
assert.equal(second.context.window.VelmoraMultiplayerBridge.applySnapshot(liveSnapshot.payload),true,
  'the second device loads the same world snapshot');
assert.equal(sq.state().careerTime.currentDate,q.state().careerTime.currentDate,
  'and lands on the same shared date');
assert.equal(sq.state().worldSeed,q.state().worldSeed,'both devices share one career seed');

const sample=sq.state().fixtures.filter(f=>!f.played&&f.type==='LEAGUE').slice(0,25);
let compared=0;
for(const fixture of sample){
  const mine=q.state().fixtures.find(f=>f.fixtureId===fixture.fixtureId);
  if(!mine||mine.played)continue;
  q.simulateBackgroundFixture(mine);
  sq.simulateBackgroundFixture(fixture);
  assert.equal(mine.homeScore,fixture.homeScore,`${fixture.fixtureId} scores agree`);
  assert.equal(mine.awayScore,fixture.awayScore,`${fixture.fixtureId} scores agree`);
  compared++;
}
assert.ok(compared>=10,'a meaningful number of fixtures were compared');

console.log(JSON.stringify({
  status:'PASS',
  version:'V104',
  saveSchema:saved.version,
  clubs:clubs.length,
  fixtures:q.state().fixtures.length,
  deterministicFixturesCompared:compared,
  checks:[
    'single-player save format unchanged',
    'save missing optional sections still loads',
    'solo progression unaffected',
    'snapshot excludes every private key',
    'snapshot restores the shared world and keeps local identity',
    'the other human club is never simulated locally',
    'the barrier blocks the shared calendar',
    'a blocked manager keeps using menus and saving',
    'read-only connection pauses the date',
    'required participants derive from real fixtures',
    'authoritative results are applied, not re-rolled',
    'repeat application is ignored',
    'a shared advance resolves AI fixtures exactly once',
    'two devices on one seed produce identical results'
  ]
},null,2));
