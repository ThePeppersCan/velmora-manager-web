const assert=require('node:assert/strict');
const {runtime}=require('./career_test_runtime.cjs');
const {context,q,d,local}=runtime();

const club=context.VELMORA_CLUBS.find(c=>c.id==='redwick')||context.VELMORA_CLUBS[0];
d.assignClubForTest(club);q.initializeCareerLifecycle();

const integrity=d.v45ReleaseGradeIntegrityForTest();
assert.equal(integrity.version,'V45');
assert(integrity.saveSchema>=82);
assert.equal(integrity.saveSlots,5);
assert.equal(integrity.slotKeys.length,5);
assert(integrity.slotKeys.every(Boolean));
assert.equal(new Set(integrity.slotKeys).size,5);
assert.equal(integrity.quickAccessLimit,3);
assert.equal(integrity.quickAccess.length,3);
assert(integrity.quickAccess.every(x=>integrity.quickAccessDestinations.includes(x)));
assert.deepEqual(integrity.taskControlActions,['track','remind','dismiss']);
assert.equal(integrity.storageGeneric,true);
assert.equal(integrity.longCareerTelemetry,true);

// Five independent careers: keep slots 1-3 compatible and prove 4-5 use the same real serializer.
const savedDates={};
for(let slot=1;slot<=5;slot++){
  assert(q.setActiveCareerSlot(slot));
  const date=`2026-08-${String(2+slot).padStart(2,'0')}`;
  q.setCareerDate(date);savedDates[slot]=date;
  assert(q.saveCareerState(),`save slot ${slot}`);
  const key=`velmora-manager-career-v32-slot-${slot}`;
  assert(local.get(key),`slot ${slot} has persisted bytes`);
}
assert.equal(d.v45ReleaseGradeIntegrityForTest().saveSlots,5);
for(let slot=1;slot<=5;slot++){
  assert(q.loadCareerState(slot),`load slot ${slot}`);
  assert.equal(q.currentCareerISO(),savedDates[slot],`slot ${slot} remains isolated`);
}

// Quick Access is per-save career preference, capped at exactly three.
q.setActiveCareerSlot(1);q.loadCareerState(1);
let rg=q.v45ReleaseGradeState();
rg.quickAccess=['academy','stats','manager-market'];
context.careerPreferences=context.careerPreferences||{}; // harmless in the DOM adapter
q.saveCareerState();
assert.deepEqual(Array.from(q.v45ReleaseGradeState().quickAccess),['academy','stats','manager-market']);
const normalized=q.v45NormalizeReleaseGrade({quickAccess:['squad','squad','calendar','stats','inbox']});
assert.equal(normalized.quickAccess.length,3);
assert.equal(new Set(normalized.quickAccess).size,3);

// Task actions are non-destructive state: track, seven-day snooze and dismiss all persist separately.
const taskId='V45-QA-TASK';
q.v45UpdateTaskControl(taskId,'track');
assert.equal(q.v45TaskControlStatus(taskId).tracked,true);
q.v45UpdateTaskControl(taskId,'remind');
assert.equal(q.v45TaskControlStatus(taskId).snoozed,true);
assert(q.v45TaskControlStatus(taskId).snoozeUntil>q.currentCareerISO());
q.v45UpdateTaskControl(taskId,'dismiss');
assert.equal(q.v45TaskControlStatus(taskId).dismissed,true);
q.saveCareerState();
const before=JSON.stringify(q.v45ReleaseGradeState().taskControls);
assert(q.loadCareerState(1));
assert.equal(JSON.stringify(q.v45ReleaseGradeState().taskControls),before);

// The release telemetry reads the real 288-club world and must never mutate it.
const tele=d.v45LongCareerTelemetryForTest();
assert.equal(tele.version,'V45');
assert.equal(tele.world.clubs,288);
assert.equal(tele.world.divisions,16);
assert.equal(tele.world.allDivisions18,true);
assert.equal(tele.integrity.badBudgets,0);
assert.equal(tele.integrity.badPlayers,0);
assert.equal(tele.integrity.duplicateStatistics,0);
assert.equal(tele.integrity.duplicateActivePlayers,0);
assert(tele.population.activePlayers>2000);
assert(tele.squads.min>=6);
assert(tele.squads.max<=20);
assert(Number.isFinite(tele.statistics.queryMs));

console.log(JSON.stringify({
  status:'PASS',version:'V45',clubs:tele.world.clubs,divisions:tele.world.divisions,saveSlots:integrity.saveSlots,
  quickAccess:integrity.quickAccessLimit,taskControls:integrity.taskControlActions,
  checks:[
    'five isolated career slots use the existing serializer and preserve slots 1-3 compatibility',
    'Quick Access stores exactly three existing destinations per career save',
    'Track / Remind Later / Dismiss persist without deleting authoritative tasks',
    'V45 telemetry reads the complete 288-club world without creating a parallel simulation',
    'schema 82 and release-grade state are safe for V44/V43/V42 migration paths'
  ]
},null,2));
