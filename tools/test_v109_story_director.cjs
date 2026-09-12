'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const release=require('../release-meta.js');
const {runtime}=require('./career_test_runtime.cjs');

const root=path.resolve(__dirname,'..');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'story-director.css'),'utf8');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');

assert.equal(release.version,'109.0.0');
assert.equal(release.label,'V109');
assert.equal(release.channel,'STORY DIRECTOR');
assert.equal(release.saveSchema,89);
assert(index.includes(`story-director.css?v=${release.cacheKey}`),'Story Director presentation CSS is not release-mounted');
assert(css.includes('.central-advance-next')&&css.includes('.v109-advance-recap-overlay'),'advance control or recap presentation is missing');
assert(app.includes('V109_STORY_PHASES')&&app.includes("title:'PRESSURES COLLIDE'")&&app.includes('directorAction'),'director systems are not connected');

function managerRuntime(){
  const created=runtime(),club=created.context.VELMORA_CLUBS[0];
  created.d.assignClubForTest(club);created.q.initializeCareerLifecycle();
  return{...created,club};
}

// A prior promise changes the second scene and live trust can close it early.
const manager=managerRuntime(),q=manager.q;
let thread=q.v108CreateCareerThread('manager-wantaway',q.currentCareerISO(),true);
const opening=q.v108QueueCareerThreadBeat(thread,q.currentCareerISO(),true);
q.resolveDecisionEvent(opening.id,'central',{deferClose:true});
thread=q.v108ThreadById(thread.id);
const player=q.careerPlayerById(thread.subjectPlayerId);
player.managerTrust=74;
const consequence=q.v108QueueCareerThreadBeat(thread,q.currentCareerISO(),true);
assert(consequence.title.includes('CONSEQUENCES'),'later scene is not visibly branch-directed');
assert(consequence.body.includes('You promised importance.'),'later scene did not remember the precise prior route');
assert(consequence.directorEvidence.includes('trust 74/100'),'later scene did not read current player evidence');
assert(consequence.scene.beats.some(beat=>beat.title==='PREVIOUSLY'),'branch-directed scene lost the V108 callback');
const early=consequence.choices.find(choice=>choice.id==='commit-early');
assert(early?.terminal,'earned early ending is unavailable');
q.resolveDecisionEvent(consequence.id,early.id,{deferClose:true});
thread=q.v108ThreadById(thread.id);
assert.equal(thread.status,'RESOLVED');
assert.equal(thread.beats.length,2,'early ending manufactured an unnecessary third crisis');
assert.equal(thread.resolution.early,true);
assert.equal(player.transferRequested,false);

// Two simultaneous pressures generate a remembered collision scene.
const collisionRun=managerRuntime(),cq=collisionRun.q;
let wantaway=cq.v108CreateCareerThread('manager-wantaway',cq.currentCareerISO(),true);
let gamble=cq.v108CreateCareerThread('manager-gamble',cq.currentCareerISO(),true);
const wantawayOpen=cq.v108QueueCareerThreadBeat(wantaway,cq.currentCareerISO(),true);
cq.resolveDecisionEvent(wantawayOpen.id,'central',{deferClose:true});
const gambleOpen=cq.v108QueueCareerThreadBeat(gamble,cq.currentCareerISO(),true);
cq.resolveDecisionEvent(gambleOpen.id,'back',{deferClose:true});
wantaway=cq.v108ThreadById(wantaway.id);
const collision=cq.v108QueueCareerThreadBeat(wantaway,cq.currentCareerISO(),true);
assert(collision.collision,'two live threads did not collide');
assert(collision.scene.beats.some(beat=>beat.title==='PRESSURES COLLIDE'),'collision was not staged in the conversation');
assert.equal(cq.v108ThreadById(wantaway.id).collisions.length,1,'collision memory was not retained');

// Player loyalty also earns a non-forced ending when the live relationship supports it.
const playerRun=runtime(),pq=playerRun.q;
playerRun.d.v106StartPlayerCareerForTest('CLUB');
let move=pq.v108CreateCareerThread('player-move',pq.currentCareerISO(),true);
const interest=pq.v108QueueCareerThreadBeat(move,pq.currentCareerISO(),true);
pq.resolveDecisionEvent(interest.id,'loyal',{deferClose:true});
pq.playerCareerPlayer().managerTrust=75;
move=pq.v108ThreadById(move.id);
const loyalty=pq.v108QueueCareerThreadBeat(move,pq.currentCareerISO(),true);
const close=loyalty.choices.find(choice=>choice.id==='close-interest');
assert(close?.terminal,'loyalty did not unlock a justified early close');
pq.resolveDecisionEvent(loyalty.id,close.id,{deferClose:true});
assert.equal(pq.v108ThreadById(move.id).resolution.early,true);
assert.equal(pq.state().currentClub.id,move.clubId,'closing the interest incorrectly moved the player');

// The recap is assembled only from the result records produced while advancing.
const recap=q.v109BeginAdvanceRecap();
q.setCareerDate(q.addDaysISO(recap.before.date,1));
q.v109CaptureAdvanceRecapDay(recap,{advanced:true,resolvedFixtures:[{fixtureId:'WORLD-1'}],events:[]});
q.setCareerDate(q.addDaysISO(recap.before.date,2));
q.v109CaptureAdvanceRecapDay(recap,{advanced:true,events:[],important:{title:'Board checkpoint',detail:'The directors reviewed the latest results.'}});
const finished=q.v109FinishAdvanceRecap(recap,{reason:'IMPORTANT_EVENT'});
assert.equal(finished.daysAdvanced,2);
assert.equal(finished.days[0].items[0].title,'The wider game moved on');
assert.equal(finished.days[1].items[0].title,'Board checkpoint');
assert(!JSON.stringify(finished.days).includes('fictional'),'recap contains unsupported filler');

const integrity=manager.d.v109StoryDirectorIntegrityForTest();
assert.equal(integrity.version,'V109');
assert(integrity.earlyResolutions>=1);
assert(integrity.phaseDirected&&integrity.recapOverlayReady&&integrity.saveConnected);

console.log(JSON.stringify({
  status:'PASS',
  version:'V109',
  checks:[
    'later beats branch from the exact prior choice and quote live evidence',
    'earned early endings resolve without a manufactured third crisis',
    'simultaneous story pressures collide and retain collision memory',
    'manager and player career routes both receive consequence-aware direction',
    'multi-day recap rows come only from processed advance results',
    'phase direction, persistence and presentation are release-connected'
  ]
},null,2));
