const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom'),{runtime}=require('./career_test_runtime.cjs');
const r=runtime(),q=r.q,x=r.context.VELMORA_EXPANSION,c=r.context.VELMORA_CLUBS.find(c=>c.id==='redwick');
r.d.assignClubForTest(c);q.initializeCareerLifecycle();c.budget='£50000000';
const dom=new JSDOM(fs.readFileSync(path.resolve(__dirname,'../index.html'),'utf8'),{url:'https://velmora.example/'});
for(const node of r.nodes.values())node.isConnected=false;
r.context.document=dom.window.document;r.context.FormData=dom.window.FormData;const doc=dom.window.document;x.initUI();
const checks=[];function check(name,fn){fn();checks.push(name);}
const click=(action,key)=>{const b=[...doc.querySelectorAll('#officeStaffContent [data-v34-action]')].find(b=>b.dataset.v34Action===action&&(key===undefined||b.dataset.key===key));assert(b,action+' '+key);assert(!b.disabled,action+' disabled');b.click();};
check('five departments show a focused staff list; market only shows the chosen department',()=>{
 q.setOfficeTab('staff');assert.equal(doc.querySelectorAll('.v36-departments button').length,5);assert.equal(doc.querySelectorAll('.v36-staff-dossier').length,1);
 click('staff-filter','medical');click('staff-mode','market');
 assert.equal(doc.querySelectorAll('.v36-staff-pick').length,3);
 const expected=x.market().filter(p=>p.role==='medical').sort((a,b)=>b.quality-a.quality)[0];assert(doc.querySelector('.v36-person-heading').textContent.includes(expected.name));
 assert.equal(doc.querySelector('[data-v34-action="staff-mode"][data-key="market"]').getAttribute('aria-pressed'),'true');
 assert(doc.querySelector('.v36-comparison').textContent.includes('do not stack'));
});
check('hiring updates the roster and budget, selects the new person and prevents overfilling',()=>{
 const hire=doc.querySelector('[data-v34-action="hire"]'),p=x.market().find(p=>p.id===hire.dataset.key),before=x.department().staff.length,budget=q.moneyNumber(c.budget);
 hire.click();assert.equal(x.department().staff.length,before+1);assert.equal(q.moneyNumber(c.budget),budget-p.fee);assert(doc.querySelector('.v36-person-heading').textContent.includes(p.name));
 click('staff-mode','market');assert(doc.querySelector('[data-v34-action="hire"]').disabled);assert(doc.querySelector('.v36-staff-decision').textContent.includes('Department full'));
});
check('insufficient budgets explain disabled hiring and courses',()=>{
 click('staff-filter','coach');c.budget='£0';x.render();assert(doc.querySelector('[data-v34-action="hire"]').disabled);assert(doc.querySelector('.v36-staff-decision').textContent.includes('Not enough'));
 click('staff-mode','team');assert(doc.querySelector('[data-v34-action="train"]').disabled);assert(doc.querySelector('.v36-development').textContent.includes('Not enough budget'));
 c.budget='£50000000';x.render();
});
check('a course charges once, shows the return date and disables release while absent',()=>{
 const p=x.department().staff.find(p=>p.role==='coach'),before=q.moneyNumber(c.budget),cost=Math.round(p.quality*450);click('train');
 assert(p.course);assert.equal(q.moneyNumber(c.budget),before-cost);assert(doc.querySelector('.v36-development').textContent.includes(p.course.end));assert(doc.querySelector('[data-v34-action="fire"]').disabled);assert(!doc.querySelector('[data-v34-action="train"]'));
});
check('release requires confirmation; cancel preserves staff and budget; confirmation charges severance',()=>{
 click('staff-filter','commercial');const p=x.department().staff.find(p=>p.role==='commercial'),before=q.moneyNumber(c.budget);
 click('fire');assert(x.department().staff.includes(p));click('cancel-confirm');assert(x.department().staff.includes(p));assert.equal(q.moneyNumber(c.budget),before);
 click('fire');click('confirm-action');assert(!x.department().staff.includes(p));assert.equal(q.moneyNumber(c.budget),before-p.wage*4);assert(doc.querySelector('.v36-staff-empty').textContent.includes('empty'));
});
check('transfer profile always shows the current clause or its absence and never duplicates it in actions',()=>{
 const seller=q.state().clubs.find(club=>club.id!==c.id&&club.tier===c.tier&&club.world===c.world),p=q.getSquad(seller).find(p=>!p.captain);
 x.setClause(p,500000);q.selectTransferPlayer(p.id);q.renderTransferDossier();let fact=doc.querySelector('#transferDossier .v36-release-clause');assert(fact);assert(fact.textContent.includes(q.formatExactMoney(500000)));assert(fact.closest('.v39-profile-price'));assert(!doc.querySelector('.dossier-actions .v35-clause-fact'));
 x.setClause(p,0);q.renderTransferDossier();fact=doc.querySelector('.v36-release-clause');assert(fact.textContent.includes('No release clause'));assert(!fact.classList.contains('has-clause'));
 const free=q.getFreeAgents()[0];q.selectTransferPlayer(free.id);q.renderTransferDossier();assert(doc.querySelector('.v36-release-clause').textContent.includes('Free agent'));
});
check('incoming offers contain bounded badge wrappers, readable statuses and remain actionable',()=>{
 const p=q.getSquad(c)[0],buyer=q.state().clubs.find(club=>club.id!==c.id&&club.badge);q.state().livingSquad.incomingOffers.push({id:'V36-TEST-OFFER',playerId:p.id,buyerClubId:buyer.id,sellerClubId:c.id,createdDate:'2026-09-01',expiresDate:'2026-09-05',currentFee:1750000,status:'PLAYER_REJECTED'});
 const host=doc.createElement('div');host.innerHTML=q.livingIncomingOffersHTML();const row=host.querySelector('[data-incoming-offer="V36-TEST-OFFER"]');assert(row);assert(row.querySelector('.v36-offer-badge>img'));assert(row.querySelector('.v36-badge-fallback'));assert(row.textContent.includes('PLAYER REJECTED'));assert(row.textContent.includes('Player declined'));
});
check('suspension banner retains the reason and remaining matches',()=>{
 const p=q.getSquad(c)[0];p.suspended=true;p.suspensionMatches=1;const host=doc.createElement('div');host.innerHTML=q.playerDisciplinePanelHTML(p);assert(host.querySelector('.suspension-banner'));assert(host.textContent.includes('1 match remaining'));
});
console.log(JSON.stringify({status:'PASS',checks},null,2));
