const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
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

const original=q.activeStarters(club);
assert.equal(original.length,3,'Expected three user starters before readiness test');
const unavailable=original[0];
unavailable.injuryDaysRemaining=5;
unavailable.injured=true;

let readiness=q.matchdayLineupReadiness(club,fixture);
assert.equal(readiness.ready,false,'An injured listed starter must not count as match-ready');
assert.equal(readiness.canAutoRepair,true,'A normal senior squad should have an eligible replacement');
assert(q.lineupHtml(club,fixture).includes('is-unavailable'),'Matchday lineup must visually flag an unavailable starter');
assert(q.lineupHtml(club,fixture).includes('INJURED'),'Matchday lineup must explain why the starter is unavailable');
const suspendedProbe={id:'QA-SUSPENSION',name:'Suspended Probe',suspended:true,suspensionMatches:1};
assert.equal(q.matchdayUnavailableReason(suspendedProbe,fixture),'SUSPENDED · 1 MATCH','Suspensions must surface as an exact matchday availability reason');

const prepared=q.prepareFixtureLineupsForMatchday(fixture,{repairUser:true,notify:false});
assert.equal(prepared.ready,true,'Matchday preflight should repair a replaceable unavailable starter');
const repaired=q.activeStarters(club);
assert.equal(repaired.length,3);
assert(!repaired.some(p=>p.id===unavailable.id),'Unavailable starter should be moved out of the Starting Three');
assert(!repaired.some(p=>q.matchdayUnavailable(p,fixture)),'All repaired starters must be eligible for the fixture');

const integrity=d.v46MatchdayLivingIntegrityForTest();
assert.equal(integrity.version,'V46.1');
assert.deepEqual(Array.from(integrity.matchChoices),['WATCH MATCH','QUICK SIM']);

const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'aaa-career-pass.css'),'utf8');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
assert(html.includes('class="match-action-number">01</span><span class="match-action-label"><strong>WATCH MATCH</strong>'),'Watch action must use explicit structured label markup');
assert(html.includes('class="match-action-number">02</span><span class="match-action-label"><strong>QUICK SIM</strong>'),'Quick Sim action must use explicit structured label markup');
assert(css.includes('V46.1 — MATCHDAY STABILITY + ACTION CARD REPAIR'));
assert(css.includes('.match-action-label > strong'));
assert(app.includes('prepareFixtureLineupsForMatchday(fixture,{repairUser:true,notify:true})'));
assert(!app.includes("showToast('Both clubs need three available starters before Watch Match can begin')"),'Generic false-looking Watch Match blocker should be removed');

console.log(JSON.stringify({status:'PASS',version:'V46.1',checks:[
  'listed injured/suspended starters no longer masquerade as available',
  'matchday UI shows the exact unavailable reason',
  'Watch Match / Quick Sim preflight automatically swaps in an eligible replacement when possible',
  'preflight preserves exactly three eligible starters',
  'Watch Match and Quick Sim action labels use stable two-line markup rather than concatenated text',
  'generic both-clubs starter warning has been replaced by precise readiness handling'
]},null,2));
