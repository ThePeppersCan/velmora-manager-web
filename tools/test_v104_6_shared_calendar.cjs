'use strict';
// V104.6 · The shared calendar is shared
//
// The barrier machinery existed and was never wired to the game: nothing in
// app.js ever opened a barrier, so no date was ever locked and the shared
// date never moved. Two managers drifted apart silently. This holds the game
// to actually asking the shared world before its own calendar moves.

const assert=require('node:assert/strict');
const {runtime}=require('./career_test_runtime.cjs');

const r=runtime(),q=r.q,win=r.context.window;
const bridge=win.VelmoraMultiplayerBridge,online=win.VelmoraMultiplayerGame;
const clubs=r.context.VELMORA_CLUBS;
const mine=clubs.find(club=>club.id==='redwick');
const theirs=clubs.find(club=>club.divisionKey===mine.divisionKey&&club.id!==mine.id);

r.d.assignClubForTest(mine);
q.initializeCareerLifecycle();

// A solo career still moves its own calendar, with no shared world involved.
const soloFrom=q.state().careerTime.currentDate;
assert.equal(q.advanceCareerDay({silent:true}).advanced,true,'a solo career advances locally');
assert.notEqual(q.state().careerTime.currentDate,soloFrom);

// ---------------------------------------------------------------
// A recording stand-in for the transport. Only the two calls that move the
// shared calendar matter here; everything else is the real game.
// ---------------------------------------------------------------
const calls={opened:[],resolved:[]};
const client={
  openBarrier(date,required){calls.opened.push({date,required});return Promise.resolve({career_date:date,status:'OPEN',required});},
  resolveBarrier(date,nextDate){calls.resolved.push({date,nextDate});return Promise.resolve({status:'RESOLVED',next_date:nextDate});},
  scheduleClubPublish(){},schedulePrivatePublish(){}
};
const claims=[{user_id:'u1',club_id:mine.id},{user_id:'u2',club_id:theirs.id}];
online.begin({
  careerId:'shared-calendar',clubId:mine.id,userId:'u1',
  humanClubIds:[mine.id,theirs.id],claims,members:claims,
  identity:online.captureIdentity(),client,
  status:{readOnly:false,barrier:null}
});

// Move to a day this manager has no fixture on, so nothing local blocks.
let guard=0;
const daySettled=()=>!q.userFixtureOnDate(q.state().careerTime.currentDate)&&!q.pendingDecisionEvent();
while(!daySettled()&&guard++<60){
  const decision=q.pendingDecisionEvent();
  if(decision){
    const choice=(decision.choices||decision.options||[])[0];
    q.resolveDecisionEvent(decision.id,choice&&(choice.id||choice.key),{silent:true});
    if(q.pendingDecisionEvent()===decision)break;
    continue;
  }
  if(q.userFixtureOnDate(q.state().careerTime.currentDate))q.setCareerDate(q.addDaysISO(q.state().careerTime.currentDate,1));
}
assert.equal(daySettled(),true,'the test starts on an ordinary day');

const settle=()=>new Promise(resolve=>setImmediate(resolve));

(async function main(){
const from=q.state().careerTime.currentDate;
const step=q.advanceCareerDay({silent:true});
await settle();
assert.equal(step.advanced,false,'an online career does not move its own date');
assert.equal(step.reason,'ONLINE_SYNC');
assert.equal(q.state().careerTime.currentDate,from,'the local date waits for the shared world');
assert.equal(calls.opened.length,1,'the barrier for today is opened');
assert.equal(calls.opened[0].date,from);
assert.deepEqual(calls.resolved,[{date:from,nextDate:q.addDaysISO(from,1)}],
  'and the shared advance is requested exactly once');

// Asking again while the request is in flight must not open a second barrier
// for the same date -- one row, one winner.
q.advanceCareerDay({silent:true});
await settle();
assert.equal(calls.opened.filter(row=>row.date===from).length,1,
  'the same date is never opened twice by this device');

// The date moves only when the log says so, and the next day is prepared at
// once so the other manager's fixture blocks on the first click.
const to=q.addDaysISO(from,1);
assert.equal(bridge.advanceSharedDay(from,to),true,'the DAY_ADVANCE event moves this device');
await settle();
assert.equal(q.state().careerTime.currentDate,to,'both devices now agree on the date');
assert.equal(calls.opened.some(row=>row.date===to),true,'the next day already has a barrier');

// A locked barrier refuses, and does not ask the server to resolve it.
const resolvedBefore=calls.resolved.length;
online.update({status:{readOnly:false,waitingMessage:'Waiting for Sam at '+theirs.name+' to complete their fixture.',
  barrier:{locked:true,date:to,outstanding:[{user_id:'u2',club_id:theirs.id}],participants:[]}}});
const blocked=q.advanceCareerDay({silent:true});
await settle();
assert.equal(blocked.reason,'ONLINE_BARRIER','an outstanding human fixture holds the calendar');
assert.equal(q.state().careerTime.currentDate,to,'and the date does not move');
assert.equal(calls.resolved.length,resolvedBefore,'a locked barrier is never asked to resolve');

// A required-participant list is derived from the real fixture list, so a
// date where the other manager plays genuinely names them.
const rival=q.state().fixtures.find(f=>!f.played&&(f.homeClubId===theirs.id||f.awayClubId===theirs.id));
assert.ok(rival,'the other manager has a fixture');
const required=online.requiredParticipants(rival.date);
assert.equal(required.some(row=>row.user_id==='u2'&&row.fixture_id===rival.fixtureId),true,
  'and they are required before that date can pass');

console.log(JSON.stringify({status:'PASS',version:'V104.6',
  checks:[
    'a solo career still advances locally',
    'an online career never moves its own date',
    'the barrier for the current date is opened by the game',
    'a date is only ever opened once per device',
    'the date moves when DAY_ADVANCE arrives',
    'the next day is prepared immediately',
    'a locked barrier blocks and is never force-resolved'
  ]},null,2));
})().catch(error=>{console.error(error);process.exit(1);});
