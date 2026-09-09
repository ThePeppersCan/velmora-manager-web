'use strict';
// V104 · Online career · shared rules
//
// Pure logic: the partitioning of career state, matchday participation,
// determinism guards, conflict handling and the language shown to players.

const assert=require('node:assert/strict');
const core=require('../multiplayer-core.js');

// ---- state classification ------------------------------------------
// Audited against the real save payload built by app.js.
const SAVE_KEYS=['version','worldSeed','recruitmentDay','careerSeason','careerYear','currentClubId',
  'employmentStatus','jobSearchState','firstWeekState','careerPreferences','careerChallenge','careerTime',
  'fixtures','calendarEvents','transferWindows','careerInboxMessages','careerNewsStories',
  'pendingNegotiations','processedCalendarEvents','selectedCalendarDate','seasonCalendarCursor',
  'careerDecisionEvents','playerPromises','careerEventCooldowns','aiTransferHistory','developmentSnapshots',
  'careerRuntime','unexpectedEvents','preSeasonExperience','cupRuntime','roadToGlory','managerMarket',
  'ownershipState','audienceWorldState','championsCrown','livingSquad','mediaWorld','negotiationEngine',
  'clubMembership','squads','lineups','clubBudgets','freeAgents','academies','retiredPlayers',
  'avatarCooldowns','transferShortlist','transferScouted','transferActivity','scoutingAssignments',
  'recruitmentIntel','recruitmentWorldKnowledge','officeReadMessages','managerName','manager'];

for(const key of SAVE_KEYS)assert.ok(['shared','private','club'].includes(core.classifyKey(key)),
  `${key} is classified`);

// The confidential drawer is private, without exception.
for(const key of ['transferShortlist','transferScouted','scoutingAssignments','recruitmentIntel',
  'careerPreferences','careerInboxMessages','officeReadMessages','careerDecisionEvents'])
  assert.equal(core.classifyKey(key),'private',`${key} never leaves the owning device`);

// The canonical world is shared, without exception.
for(const key of ['worldSeed','careerTime','fixtures','calendarEvents','clubMembership','freeAgents',
  'managerMarket','livingSquad','transferActivity','retiredPlayers','roadToGlory'])
  assert.equal(core.classifyKey(key),'shared',`${key} is part of the canonical world`);

// An unknown key defaults to shared rather than being quietly privatised.
assert.equal(core.classifyKey('someFutureWorldSystem'),'shared');

// ---- split and compose ----------------------------------------------
const save={
  worldSeed:'SEED',careerTime:{currentDate:'2026-08-01'},fixtures:[{fixtureId:'F1'}],
  squads:{aurelia:['a'],blackglass:['b'],ai1:['x']},
  lineups:{aurelia:{starters:['a']},ai1:{starters:['x']}},
  clubBudgets:{aurelia:10,blackglass:20,ai1:30},
  academies:{aurelia:['y']},
  transferShortlist:['secret'],careerPreferences:{tactics:'draft'},manager:{name:'Alex'}
};
const split=core.splitCareerState(save,['aurelia']);
assert.deepEqual(split.club.aurelia.squads,['a'],'the owned club is partitioned out');
assert.equal(split.shared.squads.aurelia,undefined,'and removed from the shared world');
assert.deepEqual(split.shared.squads.blackglass,['b'],'the other human club stays in the shared copy');
assert.deepEqual(split.shared.squads.ai1,['x'],'AI clubs stay in the shared world');
assert.deepEqual(split.private.transferShortlist,['secret'],'the shortlist is private');
assert.equal(split.shared.transferShortlist,undefined,'and is not in the shared world');
assert.equal(split.shared.careerPreferences,undefined,'draft tactics are not in the shared world');

const composed=core.composeCareerState(split.shared,{aurelia:split.club.aurelia},split.private);
assert.deepEqual(composed.squads,save.squads,'the full squad map is rebuilt exactly');
assert.deepEqual(composed.lineups.aurelia,save.lineups.aurelia);
assert.deepEqual(composed.clubBudgets,save.clubBudgets);
assert.deepEqual(composed.transferShortlist,['secret'],'private state is restored from this device');

// ---- keys ------------------------------------------------------------
assert.equal(core.subjectKeys.fixture('F1'),'FIXTURE:F1');
assert.equal(core.subjectKeys.day('2026-08-08'),'DAY:2026-08-08');
assert.equal(core.subjectKeys.player('p9','summer'),'PLAYER:p9:summer');
assert.equal(core.idempotencyKey('result','F1'),'result:F1');
assert.equal(core.idempotencyKey('a',null,'','b'),'a:b','empty parts are dropped');

// ---- determinism -----------------------------------------------------
const seedA=core.simulationSeed({worldSeed:'S',careerId:'C',fixtureId:'F1',season:'2026-27',matchday:3});
const seedB=core.simulationSeed({worldSeed:'S',careerId:'C',fixtureId:'F1',season:'2026-27',matchday:3});
assert.equal(seedA,seedB,'the same inputs always produce the same seed');
assert.notEqual(seedA,core.simulationSeed({worldSeed:'S',careerId:'C',fixtureId:'F2'}));
assert.equal(core.assertDeterministicSeed(seedA),seedA);
assert.throws(()=>core.assertDeterministicSeed(`SEED-${Date.now()}`),/timestamp/,
  'a wall-clock value can never be used as an authoritative seed');
assert.throws(()=>core.assertDeterministicSeed(''),/required/);

// ---- required participants -------------------------------------------
const claims=[{user_id:'u1',club_id:'aurelia'},{user_id:'u2',club_id:'blackglass'}];
const fixtures=[
  {fixtureId:'F1',date:'2026-08-08',homeClubId:'aurelia',awayClubId:'ai1',played:false},
  {fixtureId:'F2',date:'2026-08-08',homeClubId:'blackglass',awayClubId:'ai2',played:false},
  {fixtureId:'F3',date:'2026-08-08',homeClubId:'ai3',awayClubId:'ai4',played:false},
  {fixtureId:'F4',date:'2026-08-08',homeClubId:'aurelia',awayClubId:'ai5',played:true},
  {fixtureId:'F5',date:'2026-08-08',homeClubId:'blackglass',awayClubId:'ai6',postponed:true},
  {fixtureId:'F6',date:'2026-08-15',homeClubId:'aurelia',awayClubId:'blackglass',played:false}
];
const required=core.requiredParticipants({fixtures,claims,date:'2026-08-08'});
assert.deepEqual(required.map(row=>row.fixture_id),['F1','F2'],
  'only live human fixtures are required');
assert.equal(required.every(row=>row.human_vs_human===false),true);

const derby=core.requiredParticipants({fixtures,claims,date:'2026-08-15'});
assert.equal(derby.length,2,'a human-versus-human tie requires both managers');
assert.equal(derby.every(row=>row.human_vs_human===true),true);
assert.equal(new Set(derby.map(row=>row.fixture_id)).size,1,'for the one shared fixture');

// A club with no fixture at all is never listed.
assert.deepEqual(core.requiredParticipants({fixtures,claims,date:'2026-09-01'}),[],
  'a blank date requires nobody');

// ---- barrier state ---------------------------------------------------
const now=Date.parse('2026-08-08T12:00:00Z');
const members=[
  {user_id:'u1',display_name:'Alex',manager_name:'Alex Vance',club_name:'Aurelia',
   status:'ACTIVE',presence_status:'ONLINE',presence_at:new Date(now-5000).toISOString()},
  {user_id:'u2',display_name:'Sam',manager_name:'Sam Rhodes',club_name:'Blackglass',
   status:'ACTIVE',presence_status:'ONLINE',presence_at:new Date(now-5000).toISOString()}
];
const barrier={career_date:'2026-08-08',status:'OPEN',required};

let state=core.barrierState({barrier,members,submissions:[],results:[],now});
assert.equal(state.locked,true,'nothing done yet, so progression is locked');
assert.equal(state.resolvable,false);
assert.equal(state.participants.length,2);
assert.deepEqual(state.participants.map(row=>row.state),['PREPARING','PREPARING']);

state=core.barrierState({barrier,members,
  submissions:[{user_id:'u1',fixture_id:'F1',state:'READY'}],results:[],now});
assert.equal(state.participants.find(row=>row.user_id==='u1').state,'READY');

state=core.barrierState({barrier,members,
  submissions:[{user_id:'u1',fixture_id:'F1',state:'PLAYING'}],results:[],now});
assert.equal(state.participants.find(row=>row.user_id==='u1').state,'PLAYING');

state=core.barrierState({barrier,members,submissions:[],results:[{fixture_id:'F1'}],now});
assert.equal(state.participants.find(row=>row.user_id==='u1').state,'COMPLETED');
assert.equal(state.locked,true,'one done, one outstanding: still locked');
assert.match(core.waitingMessage(state),/Sam Rhodes at Blackglass/);
assert.match(core.waitingMessage(state),/You may continue managing your club\./);

// A manager who has dropped off is shown as disconnected, and still blocks.
const stale=[members[0],{...members[1],presence_at:new Date(now-600000).toISOString()}];
state=core.barrierState({barrier,members:stale,submissions:[],results:[{fixture_id:'F1'}],now});
assert.equal(state.participants.find(row=>row.user_id==='u2').state,'DISCONNECTED');
assert.equal(state.locked,true,'a disconnect does not unlock the calendar');
assert.match(core.waitingMessage(state),/reconnect and complete their fixture/);

// A club handed to the AI no longer blocks.
const handed=[members[0],{...members[1],status:'AI_CONTROLLED'}];
state=core.barrierState({barrier,members:handed,submissions:[],results:[{fixture_id:'F1'}],now});
assert.equal(state.locked,false,'an AI-controlled club cannot block progression');
assert.equal(state.resolvable,true);
assert.equal(core.waitingMessage(state),null,'and nothing is shown as waiting');

state=core.barrierState({barrier,members,submissions:[],
  results:[{fixture_id:'F1'},{fixture_id:'F2'}],now});
assert.equal(state.locked,false);
assert.equal(state.resolvable,true,'both fixtures done: any member may resolve');

assert.equal(core.barrierState({barrier:null,members,submissions:[],results:[],now}).locked,false,
  'no barrier means nothing is blocked');

// ---- human versus human ---------------------------------------------
const h2h=core.requiredParticipants({fixtures,claims,date:'2026-08-15'});
assert.equal(core.humanFixtureReady({fixtureId:'F6',required:h2h,submissions:[]}).ready,false);
assert.equal(core.humanFixtureReady({fixtureId:'F6',required:h2h,
  submissions:[{fixture_id:'F6',user_id:'u1',state:'READY'}]}).ready,false,'one is not enough');
assert.equal(core.humanFixtureReady({fixtureId:'F6',required:h2h,
  submissions:[{fixture_id:'F6',user_id:'u1',state:'READY'},
               {fixture_id:'F6',user_id:'u2',state:'READY'}]}).ready,true);

const primary=core.humanFixtureResolver({fixtureId:'F6',required:h2h,selfUserId:'u1'});
const secondary=core.humanFixtureResolver({fixtureId:'F6',required:h2h,selfUserId:'u2'});
assert.notEqual(primary.isPrimary,secondary.isPrimary,'exactly one device resolves the tie');
assert.equal(primary.primary,secondary.primary,'and both agree which one it is');
assert.ok(secondary.fallbackDelayMs>0,'the other side has a fallback, not a race');

// ---- conflict handling ------------------------------------------------
assert.equal(core.isStale(5,7),true);
assert.equal(core.isStale(7,7),false);
assert.deepEqual(core.conflictPlan({localRevision:7,serverRevision:7}),{action:'NONE'});
assert.equal(core.conflictPlan({localRevision:4,serverRevision:9}).action,'RELOAD_WORLD');
assert.equal(core.conflictPlan({localRevision:4,serverRevision:9,pendingClubWrites:1}).action,
  'REBASE_CLUB_STATE','a device with unsent club changes rebases rather than uploading an old world');

assert.equal(core.isStaleError(new Error('VELMORA_STALE_REVISION:12')),true);
assert.equal(core.serverRevisionFromError(new Error('VELMORA_STALE_REVISION:12')),12);
assert.equal(core.isConflictError(new Error('VELMORA_SUBJECT_TAKEN:FIXTURE:F1')),true);
assert.equal(core.isConflictError(new Error('VELMORA_STALE_REVISION:1')),false);

// ---- language shown to players ---------------------------------------
const messages=[
  'VELMORA_CLUB_TAKEN','VELMORA_CAREER_FULL','VELMORA_BAD_PASSWORD','VELMORA_NOT_A_MEMBER',
  'VELMORA_SUBJECT_TAKEN:FIXTURE:F1','VELMORA_STALE_REVISION:9','VELMORA_HOST_ONLY',
  'TypeError: Failed to fetch','duplicate key value violates unique constraint "x"'
].map(text=>core.friendlyError(new Error(text)));
for(const message of messages){
  assert.ok(message.length>10,'every branch returns a real sentence');
  assert.equal(/VELMORA_|SQLSTATE|constraint|null|undefined|Error:/.test(message),false,
    `player-facing text stays free of developer wording: ${message}`);
  assert.match(message,/^[A-Z]/,'and reads as a sentence');
}
assert.match(core.friendlyError(new Error('VELMORA_CLUB_TAKEN')),/Choose another club/);
assert.match(core.friendlyError(new Error('boom')),/progress is safe/);

// ---- activity labels are an allowlist ---------------------------------
assert.equal(core.activityLabel('transfers'),'Transfers');
assert.equal(core.activityLabel('squad'),'Squad');
assert.equal(core.activityLabel('matchday'),'Playing match');
assert.equal(core.activityLabel('secret-negotiation-screen'),'In the office',
  'an unmapped route can never leak its own name');
assert.equal(core.activityLabel(''),'In the office');
assert.equal(core.activityLabel(null),'In the office');
for(const label of Object.values(core.ACTIVITY_LABELS))
  assert.ok(label.length<=24&&!/[0-9]/.test(label),'labels stay broad and free of identifiers');

// ---- versions ---------------------------------------------------------
assert.equal(core.versionCompatibility('103.0.3','103.0.3').level,'OK');
assert.equal(core.versionCompatibility('103.0.3','103.1.0').level,'WARN');
assert.equal(core.versionCompatibility('103.0.3','104.0.0').compatible,false);
assert.equal(core.saveSchemaCompatibility(86,86).compatible,true);
assert.equal(core.saveSchemaCompatibility(90,86).compatible,false,'an older client refuses a newer career');
assert.equal(core.saveSchemaCompatibility(80,86).compatible,true,'a newer client opens an older career');

console.log(JSON.stringify({
  status:'PASS',
  version:'V104',
  sharedKeys:core.SHARED_KEYS.length,
  privateKeys:core.PRIVATE_KEYS.length,
  clubScopedKeys:core.CLUB_SCOPED_KEYS.length,
  checks:['state classification','partition split and compose','idempotency and subject keys',
    'deterministic seeds','required participants','barrier states','disconnect handling',
    'AI handover unblocks','human-versus-human readiness','single resolver election',
    'conflict plans','player-facing language','activity allowlist','version compatibility']
},null,2));
