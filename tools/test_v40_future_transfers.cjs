const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{runtime}=require('./career_test_runtime.cjs');
const r=runtime(),q=r.q,x=r.context.VELMORA_EXPANSION;
let c=q.state().clubs.find(c=>c.id==='redwick');r.d.assignClubForTest(c);q.initializeCareerLifecycle();q.setCareerDate('2026-09-10');
c.budget='£100000000';q.v25ClubFinance(c).wageBudget=1000000;
const seller=q.state().clubs.find(t=>t.id!==c.id&&t.tier===c.tier&&t.world===c.world);
const p=q.getSquad(seller).find(p=>!p.captain),id=p.id,sellerId=seller.id,buyerId=c.id;
const fee=200000,bonus=1000,wage=q.expectedWage(p)*2,budget=q.moneyNumber(c.budget),sellerBudget=q.moneyNumber(seller.budget),size=q.getSquad(c).length;
const done=q.completeTransferSigning({...p,club:seller},fee,wage,bonus,'Rotation',3,0);
assert(done.ok,done.message);assert(done.deferred);assert.equal(done.joinDate,'2027-01-01');assert.equal(p.clubId,seller.id);assert.equal(q.getSquad(c).length,size);assert.equal(q.moneyNumber(c.budget),budget-fee-bonus);assert.equal(q.moneyNumber(seller.budget),sellerBudget);assert.equal(x.reservedPlaces(c),1);assert.equal(x.reservedWages(c),wage);
assert(!q.completeTransferSigning({...p,club:seller},fee,wage,bonus,'Rotation',3,0).ok);assert(!x.proposeDeal(id,'TRANSFER',{fee,wage,bonus,years:3,role:'Rotation'}).ok);assert.equal(q.moneyNumber(c.budget),budget-fee-bonus);
assert(q.saveCareerState());assert(q.loadCareerState());c=q.clubById(buyerId);assert.equal(x.reservedPlaces(c),1);assert.equal(q.careerPlayerById(id).v34Precontract,done.agreement.id);assert.equal(x.state().precontracts.find(t=>t.playerId===id).escrow,fee+bonus);
q.setCareerDate('2026-12-31');x.processPrecontracts(q.currentCareerISO());assert.equal(q.careerPlayerById(id).clubId,sellerId);
q.setCareerDate('2027-01-01');x.processPrecontracts(q.currentCareerISO());assert.equal(q.careerPlayerById(id).clubId,buyerId);assert.equal(q.getSquad(c).length,size+1);assert.equal(x.reservedPlaces(c),0);assert.equal(x.reservedWages(c),0);assert.equal(q.moneyNumber(c.budget),budget-fee-bonus);assert.equal(q.moneyNumber(q.clubById(sellerId).budget),sellerBudget+fee);assert.equal(q.careerPlayerById(id).wage,wage);
const history=q.state().livingSquad.transferHistory.filter(t=>t.playerId===id);assert.equal(history.length,1);assert.equal(history[0].date,'2027-01-01');
x.processPrecontracts(q.currentCareerISO());assert.equal(q.moneyNumber(q.clubById(sellerId).budget),sellerBudget+fee);assert.equal(q.getSquad(c).filter(p=>p.id===id).length,1);
assert.equal(q.nextTransferWindowStart('2027-02-01'),'2027-07-01');assert.equal(q.nextTransferWindowStart('2027-09-02'),'2028-01-01');
// Expanded release-clause agreements share the same deferred registration path.
q.setCareerDate('2027-02-02');const other=q.getSquad(q.clubById(sellerId)).find(p=>!p.captain);other.releaseClause=100000;
const terms={fee:100000,wage:q.expectedWage(other)*2,bonus:2000,years:3,role:'Rotation',releaseClause:0};
let offer=x.proposeDeal(other.id,'RELEASE',terms);assert(offer.ok,offer.message);let result=x.confirmDeal(offer.offer.id);assert(result.ok,result.message);assert(result.deferred);assert.equal(result.joinDate,'2027-07-01');assert(!x.confirmDeal(offer.offer.id).ok);
// Unavailable arrivals refund the full held package once and release commitments.
const heldBudget=q.moneyNumber(c.budget);other.retired=true;q.setCareerDate('2027-07-01');x.processPrecontracts(q.currentCareerISO());assert.equal(q.moneyNumber(c.budget),heldBudget+102000);assert.equal(x.reservedPlaces(c),0);assert(!other.v34Precontract);x.processPrecontracts(q.currentCareerISO());assert.equal(q.moneyNumber(c.budget),heldBudget+102000);
// Free agents retain immediate registration outside the window.
q.setCareerDate('2027-09-10');const free=q.getFreeAgents().find(p=>!p.v34Precontract);const freeResult=q.completeTransferSigning(free,0,q.expectedWage(free)*2,0,'Rotation',3);assert(freeResult.ok,freeResult.message);assert(!freeResult.deferred);assert(q.getSquad(c).some(p=>p.id===free.id));
const html=fs.readFileSync(path.resolve(__dirname,'../index.html'),'utf8');assert(!html.includes('data-v39-market="prospect"'));assert(!html.includes('value="prospect"'));assert(html.includes('value="u21"'));
console.log(JSON.stringify({status:'PASS',checks:['closed-window normal signing reserves funds, place and wages without moving player','duplicate commitments rejected without another charge','agreement and escrow survive save/reload','arrival on window opening pays seller once and registers once','next-season summer and winter dates','release-clause deal can be agreed outside window','cancelled arrival refunds once and releases reservations','free agents join immediately','prospect shortcuts removed while age search remains']},null,2));
