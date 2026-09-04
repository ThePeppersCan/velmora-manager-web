const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom'),{runtime}=require('./career_test_runtime.cjs');
const r=runtime(),q=r.q,c=q.state().clubs.find(c=>c.id==='caldria-4-riva-sola');r.d.assignClubForTest(c);q.initializeCareerLifecycle();
const dom=new JSDOM(fs.readFileSync(path.resolve(__dirname,'../index.html'),'utf8'),{url:'https://velmora.example/'});
for(const node of r.nodes.values())node.isConnected=false;r.context.document=dom.window.document;r.context.FormData=dom.window.FormData;
const doc=dom.window.document,checks=[];function check(name,fn){fn();checks.push(name);}
check('departmental letters retain facts, use named senders and remain stable after saving',()=>{
 const source={id:'V37-FINANCE',type:'FINANCE',sender:'FINANCE DIRECTOR',subject:'Budget',body:['£1.75m available. Weekly wages: £25,000.'],date:'2026-09-01'};
 q.addCareerInboxMessage(source);const mail=q.buildOfficeMessages().find(m=>m.id===source.id);
 assert.notEqual(mail.sender,source.sender);assert(mail.body.join(' ').includes('£1.75m'));assert(mail.body.join(' ').includes('£25,000'));
 assert.equal(mail.correspondenceVersion,37);assert.deepEqual(q.v37Correspondence(JSON.parse(JSON.stringify(mail))),JSON.parse(JSON.stringify(mail)));
});
check('player letters use first person and retain the correct player identity',()=>{
 const p=q.getSquad(c)[0],m=q.v37Correspondence({id:'promise-kept-TEST',type:'SQUAD',sender:p.name,body:['The player appreciated the opportunity.']});
 assert.equal(m.sender,p.name);assert.equal(m.senderPortrait,p.avatar);assert(m.body.join(' ').includes("I'd")||m.body.join(' ').includes("I'd get")||m.body.join(' ').includes("I'd get a chance"));assert(!m.body.join(' ').includes('The player appreciated'));
});
check('suspension and appeal become one actionable correspondence; replying applies the real decision exactly once',()=>{
 const p=q.getSquad(c)[1],away=q.state().clubs.find(x=>x.id!==c.id),f={fixtureId:'V37-CARD',date:q.currentCareerISO(),type:'LEAGUE',competitionId:c.divisionKey,homeClubId:c.id,awayClubId:away.id,played:true};
 const out=q.disciplineApplyEvent(f,{team:'home',playerId:p.id,card:'RED',reason:'DENIAL_GOAL_OPPORTUNITY',minute:25},c,away);
 const e=r.d.getLivingCareerState().careerDecisionEvents.find(e=>e.suspensionId===out.suspension.id),id='decision-'+e.id;
 const mails=q.buildOfficeMessages();assert(!mails.some(m=>m.id==='discipline-ban-'+out.suspension.id));const mail=mails.find(m=>m.id===id);assert(mail);assert.notEqual(mail.sender,p.name);assert.equal(mail.senderRole,'Club secretary');assert(q.officeMessageMatchesFilter(mail,'action'));
 q.openOfficeInbox('all',id);assert(doc.querySelector('.v37-letter'));assert.equal(doc.querySelectorAll('[data-mail-reply]').length,2);assert.equal(doc.querySelectorAll('.office-document-art').length,0);
 doc.querySelector('[data-mail-reply="accept"]').click();assert.equal(out.suspension.appealStatus,'ACCEPTED');assert.equal(out.suspension.matchesRemaining,1);assert(doc.querySelector('.v37-reply-receipt'));assert.equal(doc.querySelectorAll('[data-mail-reply]').length,0);assert(!q.officeMessageMatchesFilter(q.buildOfficeMessages().find(m=>m.id===id),'action'));
 q.resolveDecisionEvent(e.id,'appeal');assert.equal(out.suspension.appealStatus,'ACCEPTED');
});
check('related letters retain earlier correspondence without duplicating the current one',()=>{
 for(const n of [1,2])q.addCareerInboxMessage({id:'V37-THREAD-'+n,type:'SCOUTING',threadKey:'scouting-test',sender:'HEAD OF RECRUITMENT',subject:'Report '+n,body:['Assessment '+n],date:'2026-08-0'+n});
 q.openOfficeInbox('all','V37-THREAD-2');assert(doc.querySelector('.v37-mail-history'));assert(doc.querySelector('.v37-mail-history').textContent.includes('Assessment 1'));assert(!doc.querySelector('.v37-mail-history').textContent.includes('Assessment 2'));
});
check('scout letter attachment opens the exact dossier and scouting records remain keyboard accessible',()=>{
 const club=q.state().clubs.find(x=>x.id!==c.id),p=q.getSquad(club)[0];q.addCareerInboxMessage({id:'V37-SCOUT',type:'SCOUTING',sender:'HEAD OF RECRUITMENT',subject:'Report ready',body:['Report complete.'],action:{label:'Open player dossier',route:'dossier',playerId:p.id}});
 q.openOfficeInbox('all','V37-SCOUT');doc.querySelector('[data-office-route]').click();assert(doc.querySelector('#transferDossier').textContent.includes(p.name));assert.equal(doc.querySelector('#scoutingTabContent').tabIndex,0);assert.equal(doc.querySelector('#scoutingTabContent').getAttribute('role'),'region');
});
check('message content is escaped rather than interpreted as HTML',()=>{
 q.addCareerInboxMessage({id:'V37-ESCAPE',type:'STAFF',sender:'<test>',subject:'<script>bad()</script>',body:['<img src=x onerror=bad()>']});q.openOfficeInbox('all','V37-ESCAPE');
 assert(!doc.querySelector('.v37-letter script'));assert(!doc.querySelector('.v37-letter-body img'));assert(doc.querySelector('.v37-letter-body').textContent.includes('<img'));
});
console.log(JSON.stringify({status:'PASS',checks},null,2));
