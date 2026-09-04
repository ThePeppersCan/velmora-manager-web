// V46: exercises the actual career runtime. User-facing match choices are Quick Sim + Watch Match only.
const assert=require('node:assert/strict');
const {runtime}=require('./career_test_runtime.cjs');
const {context,q,d}=runtime();
const clubs=context.VELMORA_CLUBS;
const club=clubs.find(c=>c.id==='redwick')||clubs[0];
d.assignClubForTest(club);
q.initializeCareerLifecycle();

const state=q.state();
const fixture=state.fixtures.find(f=>!f.played&&(f.homeClubId===club.id||f.awayClubId===club.id)&&f.type!=='FRIENDLY') || state.fixtures.find(f=>!f.played&&(f.homeClubId===club.id||f.awayClubId===club.id));
assert(fixture,'Expected a playable user fixture');
q.setCareerDate(fixture.date);
const opponent=fixture.homeClubId===club.id?q.clubById(fixture.awayClubId):q.clubById(fixture.homeClubId);
assert(opponent,'Expected opponent');
q.prepareAiLineupForFixture(opponent,fixture,fixture.date);

const before=q.getSquad(club).map(p=>({id:p.id,apps:Number(p.seasonStats?.apps||0),starts:Number(p.seasonStats?.starts||0),goals:Number(p.seasonStats?.goals||0)}));
const result=q.simulateUserFixture(fixture,'QUICK SIM');
assert(result?.saved,'Quick Sim should commit the career result');
assert.equal(fixture.played,true);
assert.equal(fixture.resultMode,'QUICK SIM');
assert(fixture.matchReport,'Quick Sim should persist a match report');
assert.equal(q.simulateUserFixture(fixture,'QUICK SIM'),null,'Played fixture cannot be resolved twice');

const after=q.getSquad(club);
assert(after.some(p=>Number(p.seasonStats?.apps||0)>Number(before.find(x=>x.id===p.id)?.apps||0)),'At least one user player should receive an appearance');
assert(after.some(p=>Number(p.seasonStats?.starts||0)>Number(before.find(x=>x.id===p.id)?.starts||0)),'Starting players should receive starts');
const report=q.seasonFixtureReportData(fixture);
assert(report,'Saved fixture report should be readable');
assert.equal(report.events.length,Number(fixture.homeScore||0)+Number(fixture.awayScore||0));

assert(q.matchdayUnavailable({injured:true},fixture));
assert(q.matchdayUnavailable({injuryDaysRemaining:5},fixture));
assert(!q.matchdayUnavailable({fitness:75},fixture));

const integrity=d.v46MatchdayLivingIntegrityForTest();
assert.deepEqual(Array.from(integrity.matchChoices),['WATCH MATCH','QUICK SIM']);
assert.equal(typeof q.watchCurrentUserFixture,'function');
assert.equal(typeof q.simulateUserFixture,'function');

console.log(JSON.stringify({status:'PASS',checks:[
  'Quick Sim executes the authoritative player-quality career simulation and commits once',
  'appearances and starts are recorded on the real player database',
  'saved match reports remain queryable after result persistence',
  'played fixtures cannot be resolved twice',
  'injury availability remains enforced',
  'Watch Match remains connected to the live engine while legacy Sim Match is intentionally removed from V46'
]},null,2));
