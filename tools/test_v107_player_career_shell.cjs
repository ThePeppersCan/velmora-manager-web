'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const release=require('../release-meta.js');
const {runtime}=require('./career_test_runtime.cjs');

const root=path.resolve(__dirname,'..');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'player-career.css'),'utf8');

assert(Number(release.version.split('.')[0])>=107);
assert(Number(release.label.slice(1))>=107);
assert(release.saveSchema>=87);
assert(index.includes('screenCareerMode')&&index.includes('screenPlayerSetup'),'the player-career entry screens are mounted');
assert(!index.includes('screenPlayerHub')&&!index.includes('screenPlayerTeamsheet'),'V107 retires the bespoke player-career screens');
assert(index.includes('data-office-pane="pcstanding"')&&index.includes('data-office-pane="pccontract"')&&index.includes('data-office-pane="pcoffers"')&&index.includes('data-office-pane="pcrecord"'),'Player Career runs on the shared Office shell');
assert(index.includes(`player-career.css?v=${release.cacheKey}`),'the player-career visual layer is release-keyed');
assert(index.includes(`player-career-shell.css?v=${release.cacheKey}`),'the shared-shell layer is release-keyed');
assert(!index.includes('v106-player-career-20260911'),'the V106 browser cache key is fully retired');
assert(css.includes('@media(max-width:760px)'),'the focused slice has a compact responsive layout');

const created=runtime(),q=created.q,d=created.d;
const start=d.v106StartPlayerCareerForTest('CLUB');
let snapshot=d.v106PlayerCareerSnapshotForTest();
assert.equal(start.careerMode,'PLAYER');
assert.equal(snapshot.status,'CLUB');
assert(snapshot.isUserPlayer,'the controlled athlete is the canonical squad player record');
assert(snapshot.managerIsAi,'the club retains a real AI manager in Player Career');
assert(snapshot.playerModeEngineSupported,'live match presentation exposes a player-view mode');
assert(snapshot.managerOnlyRoutesBlocked,'the transfer desk is the only destination withheld from a player');
assert(snapshot.persistentSave,'player-career identity and state are serialized');
assert.deepEqual(snapshot.screens,{mode:true,setup:true,central:true,office:true,matchday:true});
const club=q.clubById(snapshot.clubId),player=q.playerCareerPlayer();
assert.equal(q.getSquad(club).filter(row=>row.id===player.id).length,1,'created athlete exists exactly once in the real club squad');
assert(player.contractEndDate&&player.contractStatus==='ACTIVE','club start creates a real active contract');

const verdicts={};
for(const wanted of ['STARTING','BENCH','NOT_SELECTED']){
  const selection=d.v106PrepareTeamsheetForTest(wanted);
  assert.equal(selection.verdict,wanted,`${wanted.toLowerCase()} is reachable through the deterministic selection model`);
  assert(selection.reason&&selection.reason.length>35,'the teamsheet verdict explains the decision');
  assert.equal(typeof selection.factors.selectionScore,'number');
  assert.equal(typeof selection.factors.managerTrust,'number');
  const repeated=q.ensurePlayerCareerSelection(q.fixtureById(selection.fixtureId));
  assert.deepEqual(JSON.parse(JSON.stringify(repeated)),JSON.parse(JSON.stringify(selection)),'a published teamsheet is stable when reopened');
  verdicts[wanted]={reason:selection.reason,score:selection.factors.selectionScore,gap:selection.gap};
}

const matchSelection=d.v106PrepareTeamsheetForTest('STARTING');
const trustBeforeMatch=52;
q.playerCareerPlayer().managerTrust=trustBeforeMatch;
const result=q.simulateUserFixture(q.fixtureById(matchSelection.fixtureId),'QUICK SIM');
snapshot=d.v106PlayerCareerSnapshotForTest();
assert(result?.saved,'the player-focused quick simulation saves a canonical fixture result');
assert.equal(snapshot.lastReview.fixtureId,matchSelection.fixtureId);
assert(snapshot.lastReview.minutes>0,'a starting athlete records participation minutes');
assert.equal(snapshot.lastReview.trustAfter-snapshot.lastReview.trustBefore,snapshot.lastReview.trustDelta,'post-match trust movement is auditable');
assert(snapshot.lastReview.summary.length>20,'post-match review explains the manager response');

// V107: authority and correspondence belong to the career's role.
const userClub=q.clubById(d.v106PlayerCareerSnapshotForTest().clubId);
const lineupBefore=JSON.stringify(q.ensureLineup(userClub));
assert.equal(q.moveLineupPlayerToSlot(userClub,q.playerCareerPlayer().id,'starter',0),false,'a player cannot move themselves into the side');
assert.equal(q.swapLineupPlayers(userClub,q.playerCareerPlayer().id,q.ensureLineup(userClub).starter[0]),false,'a player cannot swap the side around');
assert.equal(JSON.stringify(q.ensureLineup(userClub)),lineupBefore,'the line-up changed under a player career');
const benchId=q.ensureLineup(userClub).bench.filter(Boolean).find(id=>id!==q.playerCareerPlayer().id);
assert(benchId,'expected a substitute to test the club AI path');
assert.notEqual(q.moveLineupPlayerToSlot(userClub,benchId,'starter',0,{system:true}),false,'the club AI must still be able to name its own side');
assert(q.ensureLineup(userClub).starter.includes(benchId),'the club AI move did not apply');

const mail=q.buildOfficeMessages();
assert(mail.length,'the player mailbox is empty');
const deskIds=mail.filter(m=>/^board-season-|^scout-|^youth-|^finance-|^contracts-|^transfer-/.test(String(m.id)));
assert.equal(deskIds.length,0,'manager-desk mail reached the player: '+deskIds.map(m=>m.id).join(', '));
assert(mail.some(m=>m.senderRole==='Your representative'),'the player has no representative');
assert(mail.some(m=>/Where you stand with me/i.test(String(m.subject||''))),'the manager never says where the player stands');

const save=q.buildCareerSaveData();
assert.equal(save.version,release.saveSchema);
assert.equal(save.careerMode,'PLAYER');
assert.equal(save.playerCareerState.userPlayerId,snapshot.playerId);
q.resetCareerWorld();
assert(q.applyCareerSaveData(save,1),'a V106 player career can be loaded');
assert.equal(created.q.state().careerMode,'PLAYER');
assert.equal(created.q.state().playerCareerState.userPlayerId,snapshot.playerId);

const unsigned=runtime(),uq=unsigned.q,ud=unsigned.d;
const unsignedStart=ud.v106StartPlayerCareerForTest('UNSIGNED');
assert.equal(unsignedStart.status,'UNSIGNED');
assert.equal(unsignedStart.clubId,null);
assert.equal(unsignedStart.offers.length,3,'an unsigned athlete receives three deterministic first-contract opportunities');
const unsignedId=unsignedStart.playerId;
assert(uq.getFreeAgents().some(row=>row.id===unsignedId),'the unsigned athlete lives in the canonical free-agent pool');
assert(ud.v106AcceptFirstOfferForTest(),'an unsigned athlete can accept a contract');
const signed=ud.v106PlayerCareerSnapshotForTest();
assert.equal(signed.status,'CLUB');
assert(signed.clubId&&signed.managerIsAi);
assert.equal(uq.getSquad(uq.clubById(signed.clubId)).filter(row=>row.id===unsignedId).length,1);
assert.equal(signed.offers.filter(row=>row.status==='ACCEPTED').length,1);
assert.equal(signed.offers.filter(row=>row.status==='OPEN').length,0);

const existing=runtime(),eq=existing.q;
eq.beginPlayerCareerSetup();
const candidate=eq.playerCareerExistingCandidates()[0];
const existingId=candidate.player.id;
assert(eq.startPlayerCareer(candidate.player,candidate.club,'EXISTING'));
assert.equal(eq.playerCareerPlayer().id,existingId);
assert.equal(eq.getSquad(candidate.club).filter(row=>row.id===existingId).length,1,'selecting an existing athlete does not duplicate the player');
assert.equal(eq.state().playerCareerState.origin,'EXISTING');

const legacy=runtime(),lq=legacy.q,ld=legacy.d,legacyClub=legacy.context.VELMORA_CLUBS[0];
ld.assignClubForTest(legacyClub);
lq.initializeCareerLifecycle();
const legacySave=lq.buildCareerSaveData();
delete legacySave.careerMode;
delete legacySave.playerCareerState;
lq.resetCareerWorld();
assert(lq.applyCareerSaveData(legacySave,1));
assert.equal(lq.state().careerMode,'MANAGER','legacy saves migrate to Manager Career without ambiguity');

console.log(JSON.stringify({
  status:'PASS',
  version:'V107',
  checks:[
    'created and existing athletes use canonical world player records',
    'club and unsigned starts both reach a playable career',
    'manager trust contributes to deterministic team selection',
    'starting, bench and not-selected verdicts include clear reasons',
    'quick simulation records participation and a post-match manager review',
    'Player Career persists while legacy saves remain Manager Career',
    'the athlete cannot name the side; the club AI still can',
    'the mailbox carries only correspondence addressed to the player'
  ],
  verdicts
},null,2));
