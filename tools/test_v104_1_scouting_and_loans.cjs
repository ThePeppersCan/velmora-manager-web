'use strict';
// V104.1 · Scouting-aware valuations and believable loans
//
// Two long-standing holes in the deal form, checked against the real career
// engine:
//   1. It pre-filled the player's true market value and exact wage demand,
//      handing you a precise ability readout for someone you had never
//      scouted -- while every other screen correctly showed UNSCOUTED.
//   2. Incoming loans skipped the selling club entirely. The only gate was a
//      loan fee of 4% of value, so any club could hold an elite prospect.

const assert=require('node:assert/strict');
const {runtime}=require('./career_test_runtime.cjs');

const r=runtime(),q=r.q,d=r.d;
const clubs=r.context.VELMORA_CLUBS;
const mine=clubs.find(club=>club.id==='redwick');
d.assignClubForTest(mine);
q.initializeCareerLifecycle();

const myLevel=q.divisionLevel(mine);
const myStrength=Math.round(q.backgroundClubStrength(mine));

// Every player at every other club, so the fixtures below are real squad
// members rather than invented ones.
const world=[];
for(const club of clubs){
  if(club.id===mine.id)continue;
  for(const player of q.getSquad(club))world.push({player,club});
}

// ---------------------------------------------------------------
// 1. An unscouted player's valuation must not appear in the deal form
// ---------------------------------------------------------------
const unscouted=world.find(row=>{
  const info=d.v1041KnowledgeForTest(row.player.id);
  return info&&!info.scouted&&info.knowledge<60&&info.value>1_000_000;
});
assert.ok(unscouted,'an unscouted, valuable player exists to test against');

const before=d.v1041KnowledgeForTest(unscouted.player.id);
assert.equal(before.scouted,false);
assert.ok(before.knowledge<60,'and the game genuinely considers him poorly known');

const blurred=d.v1041DealFormForTest(unscouted.player.id);
assert.ok(blurred.length>200,'the deal form renders');
assert.equal(blurred.includes(String(before.value)),false,
  'the exact market value is not printed into the form');
assert.equal(blurred.includes(String(Math.round(before.wage))),false,
  'nor is the exact wage demand');
assert.match(blurred,/Your scouts value/,'the form says plainly that the figures are estimates');
assert.match(blurred,/Scout him further/,'and points at how to sharpen them');

// The estimate is stable: re-opening the form must not reroll it, or a player
// could reopen repeatedly and average their way to the true figure.
const reopened=d.v1041DealFormForTest(unscouted.player.id);
assert.equal(reopened,blurred,'the estimate is stable across renders');

// It is still a usable anchor rather than noise.
const shown=Number((blurred.match(/name="fee" value="(\d+)"/)||[])[1]);
assert.ok(Number.isFinite(shown)&&shown>0,'a figure is pre-filled to negotiate from');
const drift=Math.abs(shown-before.value)/before.value;
assert.ok(drift<=0.5,`the estimate stays within its stated band (${Math.round(drift*100)}%)`);

// ---------------------------------------------------------------
// 2. Scouting the player sharpens it to the truth
// ---------------------------------------------------------------
d.v1041MarkScoutedForTest(unscouted.player.id);
const after=d.v1041KnowledgeForTest(unscouted.player.id);
assert.equal(after.scouted,true);
const sharp=d.v1041DealFormForTest(unscouted.player.id);
assert.equal(sharp.includes(String(after.value)),true,
  'a fully scouted player shows his real valuation');
assert.equal(/Your scouts value/.test(sharp),false,
  'and the estimate caveat disappears');

// ---------------------------------------------------------------
// 3. Loans respect the owner's tier, strength and age bars
// ---------------------------------------------------------------
const elite=world
  .filter(row=>row.player.age<=21&&row.player.ovr>=myStrength+15)
  .sort((a,b)=>b.player.ovr-a.player.ovr)[0];
assert.ok(elite,'a far stronger young player exists somewhere in the world');

const refused=d.v1041LoanGateForTest(elite.player.id,elite.club.id);
assert.equal(refused.ok,false,'an elite prospect cannot be loaned to a much weaker squad');
assert.match(refused.message,/will not loan|tested, not carried/);
assert.equal(/\d{4,}/.test(refused.message),false,
  'and the refusal leaks no figures');

const peer=world.find(row=>
  Math.abs(row.player.ovr-myStrength)<=6&&row.player.age<=24&&q.divisionLevel(row.club)===myLevel);
if(peer){
  const allowed=d.v1041LoanGateForTest(peer.player.id,peer.club.id);
  assert.equal(allowed.ok,true,'a comparable player at a comparable club is still loanable');
  assert.ok(Math.abs(allowed.gap)<=10,'because he is within reach of the squad');
}

// Age bars a loan only where the player is stronger than the borrowing squad,
// so "development loan" is the pretext. Older squad players stay available.
const oldAndBetter=world.find(row=>row.player.age>=29&&row.player.ovr-myStrength>4&&row.player.ovr-myStrength<=10);
if(oldAndBetter){
  const aged=d.v1041LoanGateForTest(oldAndBetter.player.id,oldAndBetter.club.id);
  assert.equal(aged.ok,false,'an older player above the squad is not a development loan');
  assert.match(aged.message,/development loan/i);
}
const oldAndLevel=world.find(row=>row.player.age>=29&&Math.abs(row.player.ovr-myStrength)<=2);
if(oldAndLevel){
  const fine=d.v1041LoanGateForTest(oldAndLevel.player.id,oldAndLevel.club.id);
  assert.equal(fine.ok,true,'an experienced player at your own level is still loanable');
}

// ---------------------------------------------------------------
// 4. The refusal reaches the actual deal path, not just the helper
// ---------------------------------------------------------------
const attempt=d.v1041ProposeForTest(elite.player.id,'LOAN_BUY',{
  playerId:elite.player.id,kind:'LOAN_BUY',
  fee:Math.ceil(q.livingPlayerMarketValue(elite.player)*.05),
  optionFee:Math.ceil(q.livingPlayerMarketValue(elite.player)*.85),
  wage:Math.ceil(q.expectedWage(elite.player,mine)),
  wageShare:100,bonus:0,years:3,role:'Important',sellOn:0,releaseClause:0
});
assert.ok(attempt&&attempt.ok===false,'proposing that loan is rejected outright');

console.log(JSON.stringify({
  status:'PASS',
  version:'V104.1',
  club:mine.name,
  clubStrength:myStrength,
  sampleKnowledge:before.knowledge,
  estimateDriftPercent:Math.round(drift*100),
  checks:[
    'unscouted valuation never printed into the deal form',
    'unscouted wage demand never printed either',
    'estimate is stable across re-renders',
    'estimate stays inside its stated band',
    'scouting sharpens the figures to the truth',
    'elite prospect refused a loan to a far weaker squad',
    'comparable player at a comparable club still loanable',
    'older player above the squad refused a development loan',
    'experienced player at your own level still loanable',
    'refusal messages leak no figures',
    'the loan gate applies on the real proposeDeal path'
  ]
},null,2));
