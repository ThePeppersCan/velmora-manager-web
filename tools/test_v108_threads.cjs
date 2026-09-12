'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const release=require('../release-meta.js');
const {runtime}=require('./career_test_runtime.cjs');

const root=path.resolve(__dirname,'..');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'career-threads.css'),'utf8');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');

assert.equal(release.version,'108.0.0');
assert.equal(release.label,'V108');
assert.equal(release.channel,'CAREER THREADS');
assert.equal(release.saveSchema,88);
assert(index.includes('career-threads.css?v=v108-career-threads-20260912'),'the V108 Central panel stylesheet is mounted');
assert(css.includes('.central-career-thread-panel')&&css.includes('WHAT YOU ARE CARRYING')===false,'the thread panel has its own visual hierarchy');
assert(app.includes("title:'PREVIOUSLY'")&&app.includes('threadBeatSummary'),'later beats retain an explicit callback to the last decision');

function startManager(){
  const created=runtime(),{q,d,context}=created,club=context.VELMORA_CLUBS[0];
  d.assignClubForTest(club);q.initializeCareerLifecycle();
  return{...created,club};
}

function resolveArc(q,key,{choices=['first','first','first'],beforeStage=null}={}){
  let thread=q.v108CreateCareerThread(key,q.currentCareerISO(),true);
  assert(thread,`${key} did not start`);
  const id=thread.id,events=[];
  for(let stage=0;stage<3;stage++){
    if(beforeStage)beforeStage(stage,thread);
    const event=q.v108QueueCareerThreadBeat(thread,q.currentCareerISO(),true);
    assert(event,`${key} stage ${stage} did not queue`);
    assert.equal(event.threadId,id);
    assert(q.immersiveDecisionEvent(event),`${key} did not receive immersive presentation`);
    assert.equal(q.v108QueueCareerThreadBeat(thread,q.currentCareerISO(),true).id,event.id,`${key} double-opened its current beat`);
    if(stage>0){
      const previous=event.scene.beats.find(beat=>beat.title==='PREVIOUSLY');
      assert(previous,`${key} stage ${stage} omitted PREVIOUSLY`);
      assert(previous.text.toLowerCase().includes(thread.beats.at(-1).summary.toLowerCase()),`${key} callback did not quote the prior decision`);
    }
    const wanted=choices[stage],choice=wanted==='first'?event.choices[0]:event.choices.find(row=>row.id===wanted);
    assert(choice,`${key} stage ${stage} choice ${wanted} is unavailable`);
    const outcome=q.resolveDecisionEvent(event.id,choice.id,{deferClose:true});
    assert(outcome?.title&&outcome?.copy&&outcome?.tags?.length,`${key} stage ${stage} produced no complete outcome`);
    events.push(event);thread=q.v108ThreadById(id);
  }
  assert.equal(thread.status,'RESOLVED',`${key} did not resolve after three beats`);
  assert.equal(thread.beats.length,3,`${key} did not retain all three decisions`);
  assert.equal(q.v108CreateCareerThread(key,q.currentCareerISO(),true),null,`${key} restarted in the same season`);
  return{thread,events};
}

// Manager: the wantaway can become a real sale, with money and roster state moving.
const manager=startManager(),mq=manager.q;
const budgetBefore=mq.moneyNumber(manager.club.budget);
let wantawaySubject=null,wantawayTarget=null;
const wantaway=resolveArc(mq,'manager-wantaway',{choices:['central','value','sell'],beforeStage:(stage,thread)=>{if(stage===0){wantawaySubject=thread.subjectPlayerId;wantawayTarget=thread.targetClubId;}}});
assert.equal(mq.careerPlayerById(wantawaySubject).clubId,wantawayTarget,'the authorised sale did not move the wantaway');
assert(mq.moneyNumber(manager.club.budget)>budgetBefore,'the wantaway sale did not increase the transfer budget');
assert(Number(wantaway.thread.transferFee)>0,'the transfer fee was not retained on the storyline');

// The prospect thread reads the live season record rather than a canned branch.
let prospect=null;
const gamble=resolveArc(mq,'manager-gamble',{choices:['back','double','promote'],beforeStage:(stage,thread)=>{prospect=mq.careerPlayerById(thread.subjectPlayerId);if(stage===1)prospect.seasonStats={...(prospect.seasonStats||{}),apps:8,starts:5,goals:4,assists:2};}});
assert(gamble.events[1].body.includes('5 starts')&&gamble.events[2].body.includes('4 goals'),'the gamble did not read the prospect’s actual season stats');
assert(['Rotation','Important'].includes(prospect.squadRole),'the prospect payoff did not land on the squad role');

const board=resolveArc(mq,'manager-board',{choices:['own','points','plan']});
assert(board.events[0].body.includes('confidence is')&&board.events[2].body.includes('Board confidence stands'),'the board thread did not read live club pressure');
assert(/BOARD|PATIENCE|REVIEW/.test(board.events[2].outcome.title),'the board thread did not deliver a verdict');

const managerSave=mq.buildCareerSaveData();
assert.equal(managerSave.version,88);
assert.equal(managerSave.careerThreads.threads.length,3,'thread state is missing from the save payload');
mq.resetCareerWorld();
assert(mq.applyCareerSaveData(managerSave,1),'the V108 manager save did not reload');
assert.equal(mq.v108CareerThreads().threads.filter(row=>row.status==='RESOLVED').length,3,'resolved story memory was lost on reload');
assert(manager.d.v108CareerThreadsIntegrityForTest().saveConnected,'the product integrity surface cannot see thread saves');

// The carrying cap prevents the dashboard from becoming another feed.
const capped=startManager(),cq=capped.q;
assert(cq.v108CreateCareerThread('manager-wantaway',cq.currentCareerISO(),true));
assert(cq.v108CreateCareerThread('manager-gamble',cq.currentCareerISO(),true));
assert.equal(cq.v108CreateCareerThread('manager-board',cq.currentCareerISO(),true),null,'more than two storylines can be carried at once');
assert.equal(cq.v108ActiveCareerThreads().length,2);

// Player: a named rival, a real transfer with trust reset, and a senior-pro arc.
const playerRun=runtime(),pq=playerRun.q,pd=playerRun.d;
pd.v106StartPlayerCareerForTest('CLUB');
const shirt=resolveArc(pq,'player-shirt',{choices:['work','team','earn']});
assert(shirt.events.every(event=>event.playerId),'the shirt did not retain a named positional rival');
assert(/trust is \d+\/100/.test(shirt.events[1].body),'the training test did not read the player’s live standing');

const displaced=pq.v108CreateCareerThread('player-dressing',pq.currentCareerISO(),true);
assert(displaced,'a second old-club storyline could not be carried into the transfer decision');
const oldClubId=pq.state().currentClub.id;
const move=resolveArc(pq,'player-move',{choices:['listen','accept-terms','sign']});
assert.notEqual(pq.state().currentClub.id,oldClubId,'signing the move did not change club');
assert.equal(pq.state().currentClub.id,move.thread.targetClubId);
assert.equal(pq.playerCareerPlayer().managerTrust,48,'the new-club trust reset is not honest or deterministic');
assert.equal(pq.v108ThreadById(displaced.id).status,'ABANDONED','an old-club relationship survived the player’s move');

const dressingRun=runtime(),dq=dressingRun.q;
dressingRun.d.v106StartPlayerCareerForTest('CLUB');
const dressing=resolveArc(dq,'player-dressing',{choices:['listen','mentor','respect']});
assert(dressing.events.every(event=>event.playerId),'the dressing-room test did not retain its senior player');

const playerSave=pq.buildCareerSaveData();
const trustAtSave=pq.playerCareerPlayer().managerTrust;
assert.equal(playerSave.careerMode,'PLAYER');
assert.equal(playerSave.careerThreads.threads.length,3);
pq.resetCareerWorld();
assert(pq.applyCareerSaveData(playerSave,1),'the V108 player save did not reload');
assert.equal(pq.playerCareerPlayer().managerTrust,trustAtSave);
assert.equal(pq.v108CareerThreads().threads.find(row=>row.key==='player-dressing').status,'ABANDONED');
assert.equal(dq.v108CareerThreads().threads.find(row=>row.key==='player-dressing').beats.at(-1).choiceId,'respect');

console.log(JSON.stringify({
  status:'PASS',
  version:'V108',
  checks:[
    'six three-beat storylines run to a remembered resolution',
    'every later beat quotes the previous choice in an immersive scene',
    'the wantaway sale moves the player and fee into the live world',
    'the gamble and board verdict read current career evidence',
    'the player move changes club, closes old-club threads and resets manager trust to 48',
    'threads save and reload without duplicating or exceeding the carrying cap'
  ]
},null,2));
