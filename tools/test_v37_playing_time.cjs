const assert=require('node:assert/strict'),{runtime}=require('./career_test_runtime.cjs');
const r=runtime(),q=r.q,c=q.state().clubs.find(c=>c.id==='caldria-4-riva-sola');
r.d.assignClubForTest(c);q.initializeCareerLifecycle();const p=q.getSquad(c)[0],away=q.state().clubs.find(x=>x.id!==c.id);
p.squadRole='Crucial';p.morale='Unhappy';p.injured=false;p.injuryDaysRemaining=0;p.suspended=false;p.suspensionMatches=0;p.discipline.suspensions=[];
const checks=[];function check(name,fn){fn();checks.push(name);}
function fixture(i,type='LEAGUE',started=false,eligible=true){return{fixtureId:'V37-'+i,date:'2026-09-'+String(i).padStart(2,'0'),homeClubId:c.id,awayClubId:away.id,played:true,type,selectionEligibility:{[p.id]:{clubId:c.id,eligible}},matchday:{participation:{[p.id]:{team:'home',started,minutes:started?90:0}}}};}
function world(rows){q.set('fixtures',rows);p.recentParticipation=[];p.recentStartDates=[];p.recentAppearanceDates=[];}
check('five consecutive competitive starts cannot produce a minutes complaint, even with low morale',()=>{
 world([1,2,3,4,5].map(i=>fixture(i,'LEAGUE',true)));
 assert.equal(q.playerStartsInRecentMatches(p,c,6),5);assert.equal(q.v37NeedsPlayingTime(p,c),false);assert(q.playerMinutesScore(p,c)>=90);
});
check('friendlies do not dilute competitive playing time; a small sample gets a grace period',()=>{
 world([fixture(1,'LEAGUE',true),...[2,3,4,5,6].map(i=>fixture(i,'FRIENDLY',false))]);
 assert.equal(q.v37PlayingTimeWindow(p,c).total,1);assert.equal(q.v37NeedsPlayingTime(p,c),false);assert(q.livingRoleSatisfaction(p,c)>=90);
});
check('genuine repeated omission triggers concern, but two recent starts settle it',()=>{
 world([1,2,3,4,5,6].map(i=>fixture(i,'LEAGUE',false)));assert(q.v37NeedsPlayingTime(p,c));
 q.state().fixtures[4].matchday.participation[p.id].started=true;q.state().fixtures[5].matchday.participation[p.id].started=true;
 assert.equal(q.v37NeedsPlayingTime(p,c),false);
});
check('injury and suspension absences are excluded from the opportunity count',()=>{
 world([1,2,3,4,5].map(i=>fixture(i,'LEAGUE',false,false)));assert.equal(q.v37PlayingTimeWindow(p,c).total,0);assert(!q.v37NeedsPlayingTime(p,c));
});
check('old quick-sim reports recover starts when legacy date arrays are missing',()=>{
 const f=fixture(1);delete f.matchday;f.matchReport={players:[{id:p.id,clubId:c.id}],ratings:[]};world([f]);assert.equal(q.playerStartsInRecentMatches(p,c),1);
});
check('an outdated pending complaint resolves without forcing another promise',()=>{
 world([1,2,3,4,5].map(i=>fixture(i,'LEAGUE',true)));
 const e=q.queueDecisionEvent({id:'V37-STALE',kind:'PLAYING_TIME',playerId:p.id,title:'I need more minutes',body:'Old complaint',choices:[]});
 q.v37RefreshPlayingTimeDecisions();assert(e.resolved);assert.equal(e.resolution,'SELECTION_UPDATED');assert.equal(q.activePromiseForPlayer(p.id),null);
});
check('promises use the saved kickoff start, even if the player is now on the bench; replay is idempotent',()=>{
 world([]);const pr=q.createPlayingTimePromise(p,{targetStarts:2,matchesRemaining:3});const f=fixture(10,'LEAGUE',true);q.set('fixtures',[f]);
 q.moveLineupPlayerToSlot(c,p.id,'bench',0);q.evaluatePlayerPromisesAfterMatch(f);assert.equal(pr.startsDelivered,1);assert.equal(pr.matchesRemaining,2);
 q.evaluatePlayerPromisesAfterMatch(f);assert.equal(pr.startsDelivered,1);assert.equal(pr.matchesRemaining,2);
 const f2=fixture(11,'LEAGUE',true);q.state().fixtures.push(f2);q.evaluatePlayerPromisesAfterMatch(f2);assert.equal(pr.status,'fulfilled');
});
check('friendlies and unavailability cannot run down a promise; a substitute is not a promised start',()=>{
 world([]);const pr=q.createPlayingTimePromise(p,{targetStarts:1,matchesRemaining:3});
 q.evaluatePlayerPromisesAfterMatch(fixture(12,'FRIENDLY',true));assert.equal(pr.matchesRemaining,3);
 q.evaluatePlayerPromisesAfterMatch(fixture(13,'LEAGUE',false,false));assert.equal(pr.matchesRemaining,3);assert(pr.pausedReason);
 const sub=fixture(14);sub.matchday.participation[p.id].minutes=35;q.evaluatePlayerPromisesAfterMatch(sub);assert.equal(pr.startsDelivered,0);assert.equal(pr.matchesRemaining,2);
 q.evaluatePlayerPromisesAfterMatch(fixture(15));q.evaluatePlayerPromisesAfterMatch(fixture(16));assert.equal(pr.status,'broken');
});
check('legacy active promises recognise starts already delivered after creation',()=>{
 world([]);const pr=q.createPlayingTimePromise(p);delete pr.participationVersion;pr.createdDate='2026-08-01';world([fixture(17,'LEAGUE',true)]);
 q.v37RepairLegacyPromises();assert.equal(pr.status,'fulfilled');
});
check('participation recording cannot double-count the same fixture',()=>{
 const f=fixture(18,'LEAGUE',true);world([f]);const before=p.seasonStats.starts;q.recordMatchParticipation(c,f,'D');q.recordMatchParticipation(c,f,'D');assert.equal(p.seasonStats.starts,before+1);assert.equal(p.recentParticipation.length,1);
});
check('save and reload preserve letters, participation and promise replay protection',()=>{
 const pr=q.createPlayingTimePromise(p,{targetStarts:2,matchesRemaining:3});const f=fixture(19,'LEAGUE',true);q.state().fixtures.push(f);q.evaluatePlayerPromisesAfterMatch(f);
 q.addCareerInboxMessage({id:'V37-PERSIST',type:'FINANCE',sender:'FINANCE DIRECTOR',subject:'Budget update',body:['£25,000 remains available.']});
 const mail=q.buildOfficeMessages().find(m=>m.id==='V37-PERSIST'),history=JSON.stringify(p.recentParticipation),snapshot=JSON.stringify(mail);
 assert(q.saveCareerState());assert(q.loadCareerState());const restored=q.careerPlayerById(p.id);
 assert.equal(JSON.stringify(restored.recentParticipation),history);assert.equal(JSON.stringify(q.buildOfficeMessages().find(m=>m.id==='V37-PERSIST')),snapshot);
 const restoredPromise=q.activePromiseForPlayer(p.id);assert.equal(restoredPromise.id,pr.id);assert.equal(restoredPromise.startsDelivered,1);
 q.evaluatePlayerPromisesAfterMatch(f);assert.equal(restoredPromise.startsDelivered,1);assert.equal(restoredPromise.matchesRemaining,2);
});
console.log(JSON.stringify({status:'PASS',checks},null,2));
