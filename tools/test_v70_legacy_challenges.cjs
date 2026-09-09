'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {create}=require('../career-expansion.js');
// The release cache key is read from release-meta.js so a version bump
// never has to be chased through the test suite by hand.
const RELEASE_CACHE_KEY=require('../release-meta.js').cacheKey;

const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const app=read('app.js');
const index=read('index.html');
const css=read('career-legacy-challenges.css');

assert.match(index,/id="careerPathChallenge"/,'new-career screen exposes Short Challenge Careers');
assert.match(index,new RegExp(`career-legacy-challenges\.css\\?v=${RELEASE_CACHE_KEY}`),'legacy challenge presentation ships with the unified release cache key');
assert.match(app,/THE GREAT ESCAPE/,'survival challenge exists');
assert.match(app,/ACADEMY ASCENDANCY/,'academy challenge exists');
assert.match(app,/careerChallenge=normalizeCareerChallenge\(d\.careerChallenge\|\|\{\}\)/,'challenge state restores from a save');
assert.match(app,/careerPreferences,careerChallenge/,'challenge state is written to a save');
assert.match(app,/finalizeCareerChallengeSeason\(\)/,'challenge receives a season-end verdict');
assert.match(app,/queueRetiredPlayerStaffApplications\(retiring\)/,'retirements can enter the staff pathway');
assert.match(app,/onLegacyStaffHired:onRetiredPlayerStaffHired/,'staff hires reconnect to the player archive');
assert.match(css,/\.v70-challenge-overlay/,'challenge selector has a dedicated presentation');
assert.match(css,/\.v70-archive-staff/,'post-playing careers have archive presentation');

const club={id:'TEST',name:'Test Athletic',world:'Velmora',reputation:2,budget:'£1m'};
const runtime={};let hired=null,expired=null,today='2027-08-01';
const api=create({
  runtime:()=>runtime,club:()=>club,clubs:()=>[club],clubById:id=>id===club.id?club:null,
  date:()=>today,seed:()=> 'TEST-SEED',season:()=> '2027-28',year:()=>2027,
  rng:()=>()=>.42,hash:value=>String(value).length,addDays:(date)=>date,diffDays:()=>0,
  money:value=>typeof value==='number'?value:Number(String(value).replace(/[^0-9.]/g,''))*1_000_000,
  format:value=>`£${value}`,worlds:()=>['Velmora'],legacyScouts:()=>[],assignments:()=>[],
  squad:()=>[],academy:()=>[],generateYouth:()=>({}),makeStats:()=>({}),player:()=>null,
  freeAgents:()=>[],transferPool:()=>[],sales:()=>[],fixtures:()=>[],loans:()=>[],inbox:()=>{},
  value:()=>0,interest:()=>'',windowOpen:()=>true,nextWindow:()=>'',canWage:()=>true,
  weeklyWages:()=>0,wageBudget:()=>1_000_000,expectedWage:()=>0,squadCap:()=>20,ownedLoans:()=>0,
  onLegacyStaffHired:(candidate)=>{hired=candidate;},onLegacyStaffExpired:(candidate)=>{expired=candidate;}
});

const application={id:'legacy-candidate-P1',key:'legacy-candidate-P1',name:'Ari Vale',role:'coach',quality:72,wage:900,fee:0,formerPlayerId:'P1',formerPlayerRole:'PLAYMAKER',legacyLabel:'CLUB LEGEND',expiresDate:'2027-10-30'};
assert.equal(api.addLegacyCandidate(club,application).ok,true,'former-player application enters the staff pathway');
assert.ok(api.market(club).some(p=>p.id===application.id),'former-player application appears in the live staff market');
assert.equal(api.hire(application.id).ok,true,'former player can be hired through normal staff rules');
assert.ok(api.department(club).staff.some(p=>p.formerPlayerId==='P1'),'hired former player occupies a real staff position');
assert.equal(hired?.formerPlayerId,'P1','hire callback updates the permanent archive record');
assert.ok(!api.market(club).some(p=>p.id===application.id),'accepted application leaves the candidate market');

const unanswered={...application,id:'legacy-candidate-P2',key:'legacy-candidate-P2',name:'Mira Vale',formerPlayerId:'P2',expiresDate:'2027-08-02'};
assert.equal(api.addLegacyCandidate(club,unanswered).ok,true,'a second former-player application can be received');
today='2027-08-03';
assert.ok(!api.market(club).some(p=>p.id===unanswered.id),'an unanswered application expires from the market');
assert.equal(expired?.formerPlayerId,'P2','expiry callback updates the permanent archive pathway');

console.log('V70 legacy + challenge career checks: PASS');
