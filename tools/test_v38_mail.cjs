const assert=require('node:assert/strict'),{runtime}=require('./career_test_runtime.cjs');
const r=runtime(),q=r.q,c=q.state().clubs.find(c=>c.id==='caldria-4-riva-sola');r.d.assignClubForTest(c);q.initializeCareerLifecycle();q.setCareerDate('2026-09-10');
const p=q.getSquad(c)[0],away=q.state().clubs.find(x=>x.id!==c.id);p.squadRole='Crucial';p.morale='Unhappy';p.injured=false;p.injuryDaysRemaining=0;p.suspended=false;p.suspensionMatches=0;p.discipline.suspensions=[];
q.set('fixtures',[1,2,3,4,5,6].map(i=>({fixtureId:'V38-'+i,date:'2026-09-0'+i,homeClubId:c.id,awayClubId:away.id,played:true,type:'LEAGUE',selectionEligibility:{[p.id]:{clubId:c.id,eligible:true}},matchday:{participation:{[p.id]:{team:'home',started:false,minutes:0}}}})));
const e=q.queueDecisionEvent({id:'V38-PLAY',kind:'PLAYING_TIME',playerId:p.id,title:'I need more minutes',body:"Boss, I've started 0 of the last 6 competitive games I was available for. Can we talk?",choices:[{id:'promise',label:"YOU'LL GET YOUR CHANCE",copy:'One start in the next three eligible competitive games.'}]});
const checks=[];function check(name,fn){fn();checks.push(name);}
check('existing letter gets a personal voice without changing its source or the recorded match counts',()=>{
 const source={id:'decision-'+e.id,decisionId:e.id,sender:p.name,senderRole:'First-team player',senderVoice:'Reserved',subject:e.title,body:[e.body],correspondenceVersion:37};const before=JSON.stringify(source);
 const m=q.v38MailView(source);assert.notEqual(m.subject,e.title);assert(m.body.join(' ').includes("I've started 0 of the last 6"));assert(m.body[0].includes('ask')||m.body[0].includes('talking'));assert.equal(JSON.stringify(source),before);assert.equal(q.v38MailView(m),m);
 const driven=q.v38MailView({...source,senderVoice:'Driven'});assert.notEqual(driven.body[0],m.body[0]);
});
check('market correspondence retains the interested clubs, money and other event facts',()=>{
 const m=q.v38MailView({id:'market-agent-test',type:'TRANSFERS',subject:'Market interest: Test Player',body:["5 clubs are currently tracking the player's availability.",'Riva Sola currently show the strongest level of interest.','Asking price: £1.75m.']});
 assert(m.body.join(' ').includes('5 clubs'));assert(m.body.join(' ').includes('Riva Sola'));assert(m.body.join(' ').includes('£1.75m'));
});
check('old appeal results join the original discipline conversation',()=>{
 const m=q.v38MailView({id:'discipline-appeal-result-BAN-12',body:['The original 1-match suspension stands.']});assert.equal(m.threadKey,'discipline-BAN-12');assert(m.body[0].includes('1-match'));
});
check('player, official, scout and finance letters have distinct presentation identities',()=>{
 const styles=[{senderRole:'First-team player'},{senderRole:'Competition administration'},{type:'SCOUTING'},{type:'FINANCE'}].map(m=>q.v38MailStyle(m).key);assert.equal(new Set(styles).size,4);
});
check('reply links to the actual promise; progress remains accurate after save and reload',()=>{
 q.resolveDecisionEvent(e.id,'promise');const pr=q.activePromiseForPlayer(p.id);assert(pr);assert.equal(e.promiseId,pr.id);
 let m=q.buildOfficeMessages().find(m=>m.decisionId===e.id);assert.equal(q.v38MailPromise(m).id,pr.id);assert(q.v38PromiseHTML(m).includes('0 / 1'));
 assert(q.saveCareerState());assert(q.loadCareerState());m=q.buildOfficeMessages().find(m=>m.decisionId===e.id);const loaded=q.v38MailPromise(m);assert.equal(loaded.id,pr.id);assert.equal(loaded.startsDelivered,0);
 loaded.startsDelivered=1;loaded.status='fulfilled';assert(q.v38PromiseHTML(m).includes('You kept your word'));assert(q.v38PromiseHTML(m).includes('1 / 1'));
});
console.log(JSON.stringify({status:'PASS',checks},null,2));
