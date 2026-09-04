const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom'),{runtime}=require('./career_test_runtime.cjs');
const r=runtime(),q=r.q,x=r.context.VELMORA_EXPANSION,c=r.context.VELMORA_CLUBS.find(c=>c.id==='redwick');
r.d.assignClubForTest(c);q.initializeCareerLifecycle();c.budget='£50000000';q.v25ClubFinance(c).wageBudget=1000000;
const dom=new JSDOM(fs.readFileSync(path.resolve(__dirname,'../index.html'),'utf8'),{url:'https://velmora.example/'});
for(const node of r.nodes.values())node.isConnected=false;
r.context.document=dom.window.document;r.context.FormData=dom.window.FormData;r.context.HTMLElement=dom.window.HTMLElement;r.context.Element=dom.window.Element;const doc=dom.window.document;x.initUI();
const checks=[];function check(name,fn){fn();checks.push(name);}
check('all seven career screens retain exactly six primary navigation items',()=>{
 for(const nav of doc.querySelectorAll('.career-tabs')){assert.equal(nav.children.length,6);assert.deepEqual([...nav.children].map(x=>x.textContent),['CENTRAL','SQUAD','TRANSFERS','MATCHDAY','SEASON','OFFICE']);}
 assert.equal(doc.querySelectorAll('[data-v34-open="staff"],[data-v34-open="saves"],[data-v34-open="deals"]').length,0);
});
check('staff lives in Office; hire and course actions work without a second modal',()=>{
 q.setOfficeTab('staff');assert.equal(doc.querySelector('#officeStaffPane').getAttribute('aria-hidden'),'false');
 assert(doc.querySelector('#officeStaffContent').textContent.includes('Your backroom team'));
 doc.querySelector('#officeStaffContent [data-v34-action="staff-mode"][data-key="market"]').click();
 assert(doc.querySelector('#officeStaffContent').textContent.includes('STAFF MARKET'));
 const before=x.department().staff.length;doc.querySelector('#officeStaffContent [data-v34-action="hire"]').click();assert.equal(x.department().staff.length,before+1);
 doc.querySelector('#officeStaffContent [data-v34-action="train"]').click();assert(x.department().staff.some(p=>p.course));
 assert(!doc.getElementById('careerExpansion'));assert(!doc.getElementById('app').inert);
});
check('finances contains investment, sponsor and operating-cost sections',()=>{
 q.setOfficeTab('finances');doc.querySelector('[data-v35-finance="facilities"]').click();
 assert(doc.querySelector('[data-v34-action="upgrade"]'));doc.querySelector('[data-v34-action="upgrade"]').click();assert.equal(x.department().projects.length,1);
 doc.querySelector('[data-v35-finance="commercial"]').click();doc.querySelector('[data-v34-action="sponsor"]').click();assert.equal(x.department().sponsor.status,'ACTIVE');
 doc.querySelector('[data-v35-finance="ledger"]').click();assert(doc.querySelector('#v35FinanceWorkspace').textContent.includes('CLUB OPERATING LEDGER'));
 doc.querySelector('[data-v35-finance="overview"]').click();assert(doc.querySelector('.office-finance-metrics'));
});
check('academy recruitment and league share the existing Youth Academy section',()=>{
 q.setSquadView('youth');assert(doc.querySelector('#v35AcademyWorkspace').hidden);doc.querySelector('[data-v35-academy="recruitment"]').click();
 const form=doc.querySelector('#v35AcademyWorkspace [data-v34-form="mission"]');assert(form);assert(doc.querySelector('#youthAcademyGrid').hidden);
 form.querySelector('[name="region"]').value='Caldria';form.querySelector('[name="role"]').value='DEFENDER';form.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));assert.equal(x.department().missions.length,1);
 doc.querySelector('[data-v35-academy="league"]').click();assert(doc.querySelector('[data-v34-form="youth-team"]'));assert(!doc.querySelector('#v35AcademyWorkspace [data-v34-form="mission"]'));
 doc.querySelector('[data-v35-academy="prospects"]').click();assert(!doc.querySelector('#youthAcademyGrid').hidden);assert(doc.querySelector('#v35AcademyWorkspace').hidden);
});
const seller=q.state().clubs.find(club=>club.id!==c.id&&club.tier===c.tier&&club.world===c.world),p=q.getSquad(seller).find(p=>!p.captain),target={...p,club:seller};
check('one recruitment search and native approach selector; only clause holders offer activation',()=>{
 x.setClause(p,0);q.openNegotiation({...target,releaseClause:undefined});let select=doc.querySelector('#v35AgreementType');assert(select);assert(![...select.options].some(o=>o.value==='RELEASE'));
 select.value='SWAP';select.dispatchEvent(new dom.window.Event('change',{bubbles:true}));assert(doc.querySelector('#negotiationModal.is-open'));assert(doc.querySelector('[name="swapId"]'));assert(!doc.querySelector('[name="optionFee"]'));assert(!doc.querySelector('[data-v34-form="target-search"]'));
 select=doc.querySelector('#v35AgreementType');select.value='LOAN_BUY';select.dispatchEvent(new dom.window.Event('change',{bubbles:true}));assert(doc.querySelector('[name="optionFee"]'));assert(!doc.querySelector('[name="swapId"]'));
 x.setClause(p,500000);q.v35OpenDeal(target,'RELEASE');assert([...doc.querySelector('#v35AgreementType').options].some(o=>o.value==='RELEASE'));assert.equal(doc.querySelector('[data-v34-form="deal"] [name="fee"]').value,'500000');
 const toggle=doc.querySelector('[data-v35-clause-toggle]'),amount=doc.querySelector('[name="releaseClause"]');assert.equal(toggle.checked,false);assert(amount.disabled);toggle.checked=true;toggle.dispatchEvent(new dom.window.Event('change',{bubbles:true}));assert(!amount.disabled);assert(!amount.closest('label').hidden);
 assert.equal(doc.querySelectorAll('#transferSearchInput').length,1);
});
check('ordinary player contract talks default to no release clause, with optional persisted terms',()=>{
 q.openContractNegotiation(target,100000);assert.equal(doc.querySelector('#contractClauseMode').value,'none');assert(doc.querySelector('#contractClauseAmountField').hidden);
 const select=doc.querySelector('#contractClauseMode');select.value='add';select.dispatchEvent(new dom.window.Event('change',{bubbles:true}));assert(!doc.querySelector('#contractClauseAmountField').hidden);
 const session=q.contractNegotiationSession(target,'SIGNING',true);doc.querySelector('#contractClauseAmount').value=String(Math.round(q.livingPlayerMarketValue(p)*1.5));assert(q.v35ReadClauseFields('contract',target,session).ok);
 q.renderContractNegotiation(target,100000,{status:'counter'});assert.equal(doc.querySelector('#contractClauseMode').value,'add');assert.equal(Number(doc.querySelector('#contractClauseAmount').value),session.v35ClauseAmount);
 doc.querySelector('#contractClauseMode').value='none';assert.equal(q.v35ReadClauseFields('contract',target,session).amount,0);q.closeNegotiation();
});
check('release purchase submits, reviews and completes through the original negotiation modal',()=>{
 q.v35OpenDeal(target,'RELEASE');const before=q.getSquad(c).length,form=doc.querySelector('[data-v34-form="deal"]');form.querySelector('[name="wage"]').value=String(q.expectedWage(p)*2);
 form.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));assert(doc.querySelector('[data-v34-action="confirm-deal"]'),doc.querySelector('#v35NegotiationTerms').textContent);
 doc.querySelector('[data-v34-action="confirm-deal"]').click();assert.equal(q.getSquad(c).length,before);doc.querySelector('[data-v34-action="confirm-action"]').click();assert.equal(q.getSquad(c).length,before+1);assert(!p.releaseClause);assert(!doc.querySelector('#negotiationModal.is-open'));
});
check('commitments and loan options occupy existing Transfer Hub tabs',()=>{
 q.renderTransferHub();doc.querySelector('[data-living-hub="future"]').click();assert(doc.querySelector('#v35TransferCommitments').textContent.includes('No future signings agreed'));
 doc.querySelector('[data-living-hub="loans"]').click();assert(doc.querySelector('#v35TransferCommitments').textContent.includes('LOAN BUY OPTIONS'));
 doc.querySelector('[data-living-hub="active"]').click();assert(doc.querySelector('#v35TransferCommitments').textContent.includes('AGREED PACKAGES'));
});
check('existing save slots include export and the same dialog includes backup import',()=>{
 q.saveCareerState();q.openCareerSaveMenu('continue');assert(doc.querySelector('#careerSaveOverlay.is-open'));assert(doc.querySelector('.career-save-slot [data-v34-action="export"]'));assert(doc.querySelector('#careerSaveOverlay [data-v34-form="import"]'));assert(!doc.getElementById('careerExpansion'));
});
console.log(JSON.stringify({status:'PASS',runtime:'JSDOM native renders and DOM events',checks},null,2));
