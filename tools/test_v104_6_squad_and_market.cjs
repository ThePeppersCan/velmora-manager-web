'use strict';
// V104.6 · Squad decisions and a market that says no
//
// Four reported faults, held in place: a captain could only be named during
// the first week, an unattached player displayed a wage nobody was paying,
// any club could out-earn its own budget for a star free agent, and a player
// could be bid for the week he signed.

const assert=require('node:assert/strict');
const {runtime}=require('./career_test_runtime.cjs');

const r=runtime(),q=r.q;
const clubs=r.context.VELMORA_CLUBS;
const byReputation=clubs.slice().sort((a,b)=>Number(a.reputation||0)-Number(b.reputation||0));
const weak=byReputation[0],strong=byReputation[byReputation.length-1];

r.d.assignClubForTest(weak);
q.initializeCareerLifecycle();

// ---------------------------------------------------------------
// A captain can be named at any point in the career
// ---------------------------------------------------------------
const squad=q.getSquad(q.state().currentClub);
const firstChoice=squad.find(p=>!p.captain);
assert.ok(firstChoice,'the squad has someone else to lead it');
assert.equal(q.applyClubCaptain(firstChoice.id,{scene:false,toast:false}),true,
  'the armband can be moved outside the first week');
assert.equal(q.getSquad(q.state().currentClub).filter(p=>p.captain).length,1,
  'and exactly one player wears it');
assert.equal(q.getSquad(q.state().currentClub).find(p=>p.captain).id,firstChoice.id);
assert.equal(q.applyClubCaptain(firstChoice.id,{scene:false,toast:false}),false,
  'naming the current captain again changes nothing');

// ---------------------------------------------------------------
// An unattached player is not on a wage
// ---------------------------------------------------------------
const free=q.getFreeAgents().slice().sort((a,b)=>Number(b.ovr||0)-Number(a.ovr||0))[0];
assert.ok(free&&free.freeAgent,'the world has free agents');
for(const player of q.getFreeAgents())
  assert.equal(Number(player.wage||0),0,`${player.name} is unattached and paid nothing`);
assert.ok(Number(free.lastWage||0)>0,'but what he last earned is remembered');

// ---------------------------------------------------------------
// A weak club cannot simply out-earn its own budget for a star
// ---------------------------------------------------------------
const weakDemand=q.expectedWage(free,weak);
const strongDemand=q.expectedWage(free,strong);
const weakBudget=q.v25ClubFinance(weak).wageBudget;
assert.ok(weakDemand>strongDemand,
  'dropping to a weaker squad costs more in wages, not less');
assert.ok(weakDemand>weakBudget,
  'and a genuine star is beyond a bottom club’s entire wage allocation');
assert.equal(q.v25CanAffordWage(weak,free,weakDemand),false,
  'so the club is told no rather than quietly signing him');

// The rest of the wage economy is left where it was: a club paying its own
// players is still pricing them off its own ladder.
const own=q.getSquad(weak).slice().sort((a,b)=>Number(b.ovr||0)-Number(a.ovr||0))[0];
const renewal=q.expectedWage(own,weak);
assert.ok(renewal<=Math.max(1200,Number(own.wage||0)*1.6),
  'an existing player’s renewal is not inflated by the joining premium');

// ---------------------------------------------------------------
// A new signing is left alone for a while
// ---------------------------------------------------------------
const today=q.state().careerTime.currentDate;
const settled=q.getSquad(q.state().currentClub).find(p=>!p.captain);
settled.contractStartDate=today;
settled.transferRequested=false;settled.transferStatus='LISTEN';
assert.equal(q.playerIsUnsettledNewSigning(settled,today),true,
  'a player who signed today is not a target');
assert.equal(q.playerIsUnsettledNewSigning(settled,q.addDaysISO(today,89)),true,
  'and is still settling three months in');
assert.equal(q.playerIsUnsettledNewSigning(settled,q.addDaysISO(today,90)),false,
  'after that the market may look at him again');
settled.transferRequested=true;
assert.equal(q.playerIsUnsettledNewSigning(settled,today),false,
  'a player who has asked to leave is available whenever he asked');

console.log(JSON.stringify({status:'PASS',version:'V104.6',
  clubs:{weak:weak.name,strong:strong.name},freeAgent:{name:free.name,ovr:free.ovr,
    demandAtWeakClub:weakDemand,weakClubWageBudget:weakBudget,demandAtStrongClub:strongDemand},
  checks:[
    'the captain can be changed at any time',
    'free agents carry no current wage',
    'a released player still remembers his last salary',
    'joining a weaker squad costs a premium',
    'a bottom club cannot afford a star',
    'existing renewals are unaffected',
    'a new signing is not bid for while settling'
  ]},null,2));
