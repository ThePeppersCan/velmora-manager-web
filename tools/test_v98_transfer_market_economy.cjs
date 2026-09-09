'use strict';

const assert=require('node:assert/strict');
const {runtime}=require('./career_test_runtime.cjs');

const r=runtime(),q=r.q,x=r.context.VELMORA_EXPANSION;
const buyer=r.context.VELMORA_CLUBS.find(club=>club.id==='redwick');
r.d.assignClubForTest(buyer);
q.initializeCareerLifecycle();
q.setCareerDate('2026-08-10');

const clone=value=>JSON.parse(JSON.stringify(value));
const seller=q.state().clubs.find(club=>club.id!==buyer.id&&club.tier===buyer.tier&&club.world===buyer.world);
assert(seller,'A comparable selling club is available');
const source=q.getSquad(seller).find(player=>!player.captain&&!player.onLoan&&!player.v34Precontract);
assert(source,'A transferable player is available');

// The public value is one career-wide truth, with smooth contract, potential,
// performance and role adjustments rather than screen-specific price formulas.
const valuation=q.careerPlayerValuationBreakdown(source,{club:seller});
assert.equal(q.livingPlayerMarketValue(source),valuation.value);
assert.equal(q.buildClubNegotiationSession(source).marketValue,valuation.value);

const longDeal=clone(source),finalYear=clone(source);
longDeal.contractEndDate='2030-06-30';
finalYear.contractEndDate='2027-06-30';
assert(q.careerContractValueFactor(longDeal)>q.careerContractValueFactor(finalYear),'Long contracts protect value more than final-year deals');

const prospect=clone(source),peer=clone(source);
Object.assign(prospect,{id:'V98-PROSPECT',age:20,ovr:68,potential:86,contractEndDate:'2029-06-30'});
Object.assign(peer,{id:'V98-PEER',age:20,ovr:68,potential:68,contractEndDate:'2029-06-30'});
assert(q.livingPlayerMarketValue(prospect)>q.livingPlayerMarketValue(peer),'Young upside carries a meaningful premium');

const attacker=clone(source),defender=clone(source);
Object.assign(attacker,{role:'ATTACKER',form:'Excellent',seasonStats:{apps:16,goals:12,assists:3,ratingCount:16,ratingSum:116,potm:3}});
Object.assign(defender,{role:'DEFENDER',form:'Good',seasonStats:{apps:16,goals:1,assists:3,ratingCount:16,ratingSum:114,potm:2}});
assert(q.careerPerformanceValueFactor(attacker)>1.05,'Attacking output moves the market');
assert(q.careerPerformanceValueFactor(defender)>1.04,'Defensive performance is rewarded without requiring striker numbers');

const fit=clone(source),injured=clone(source);
fit.injuryDaysRemaining=0;
injured.injuryDaysRemaining=28;
assert.equal(q.livingPlayerMarketValue(fit),q.livingPlayerMarketValue(injured),'A short injury affects availability, not intrinsic headline value');
assert(q.playerMarketExposure(injured)<q.playerMarketExposure(fit),'Injury risk still cools active market interest');

const underpaid=clone(source),signedWage=Number(source.wage||1700);
underpaid.ovr=82;
underpaid.age=25;
underpaid.wage=600;
underpaid.potential=85;
assert(q.expectedWage(underpaid,buyer)>underpaid.wage,'High-level players seek a market salary instead of inheriting an obsolete wage');
q.revaluePlayer(source);
assert.equal(Number(source.wage),signedWage,'Rating changes never rewrite a signed salary');

const abilityLadder=[55,65,75,85].map(ovr=>q.playerAbilityValue(ovr,27));
assert(abilityLadder.every((value,index)=>index===0||value>abilityLadder[index-1]),'The ability-value curve rises at every tested tier');

const standardBid=q.livingIncomingOfferValuation(source,buyer,{market:valuation.value,buyerNeed:100,competition:3,phase:'DEADLINE',negotiatorStyle:'DESPERATE',forceExceptional:false,rng:()=>.5});
const exceptionalBid=q.livingIncomingOfferValuation(source,buyer,{market:valuation.value,buyerNeed:100,competition:3,phase:'DEADLINE',negotiatorStyle:'DESPERATE',forceExceptional:true,rng:()=>.5});
assert(standardBid.maxFee<=valuation.value*1.36+50_000,'Normal incoming offers respect the economy ceiling');
assert(exceptionalBid.maxFee<=valuation.value*1.62+50_000,'Rare exceptional offers remain bounded');

const staleRawValue=source.value;
source.value=500;
assert(q.askingPrice(source)>500,'The seller asks from the canonical market value rather than a stale generation-time field');
source.value=staleRawValue;

// Structured fees create real persisted obligations. Only the first tranche is
// paid today; later instalments and earned add-ons settle once and only once.
x.state().transferPayments=[];
x.state().transferAddOns=[];
x.state().offers=[];
buyer.budget='£100000000';
seller.budget='£100000000';
q.v25ClubFinance(buyer).wageBudget=q.v25ClubWeeklyWages(buyer)+1_000_000;
q.v25ClubFinance(seller).wageBudget=q.v25ClubWeeklyWages(seller)+1_000_000;

const player=q.getSquad(seller)
  .filter(candidate=>!candidate.captain&&!candidate.onLoan&&!candidate.v34Precontract)
  .sort((a,b)=>q.livingPlayerMarketValue(a)-q.livingPlayerMarketValue(b))[0];
assert(player,'A player is available for the structured-deal simulation');
const market=q.livingPlayerMarketValue(player),fee=market*4,bonus=1_000,addOnAmount=Math.round(market*.10);
const terms={fee,wage:q.expectedWage(player)*2,bonus,years:3,role:'Rotation',sellOn:0,releaseClause:0,swapId:null,optionFee:0,wageShare:100,installments:3,addOnType:'APPEARANCES',addOnAmount};
const plan=x.transferCashPlan(terms);
assert.equal(plan.count,3);
assert.equal(plan.upfront,Math.round(fee*.55/1000)*1000);
assert.equal(plan.upfront+plan.deferred.reduce((sum,row)=>sum+row.amount,0),fee,'Guaranteed instalments sum exactly to the agreed fee');
assert(x.structuredOfferCredit(terms)<fee+addOnAmount,'Sellers discount deferred and conditional money');
assert(x.structuredOfferCredit(terms)>plan.upfront,'Credible future money still improves the package');

const offer=x.proposeDeal(player.id,'TRANSFER',terms);
assert(offer.ok,offer.message);
const buyerBefore=q.moneyNumber(buyer.budget),sellerBefore=q.moneyNumber(seller.budget);
const completed=x.confirmDeal(offer.offer.id);
assert(completed.ok,completed.message);
assert.equal(player.clubId,buyer.id);
assert.equal(q.moneyNumber(buyer.budget),buyerBefore-plan.upfront-bonus,'Only the upfront fee and signing bonus leave the buyer today');
assert.equal(q.moneyNumber(seller.budget),sellerBefore+plan.upfront,'The seller receives the upfront tranche today');

const finance=x.state();
assert.equal(finance.transferPayments.length,2,'A three-part fee creates two future instalments');
assert.equal(finance.transferAddOns.length,1,'The conditional appearance clause is persisted');
assert.equal(q.availableTransferBudget(buyer),q.moneyNumber(buyer.budget)-plan.deferred.reduce((sum,row)=>sum+row.amount,0),'Guaranteed future payments restrict spendable transfer funds');

const firstPayment=finance.transferPayments[0],due=firstPayment.due;
const buyerAtDue=q.moneyNumber(buyer.budget),sellerAtDue=q.moneyNumber(seller.budget);
x.processTransferPayments(due);
assert.equal(firstPayment.status,'PAID');
assert.equal(q.moneyNumber(buyer.budget),buyerAtDue-firstPayment.amount);
assert.equal(q.moneyNumber(seller.budget),sellerAtDue+firstPayment.amount);
const balancesAfterPayment=[q.moneyNumber(buyer.budget),q.moneyNumber(seller.budget)];
x.processTransferPayments(due);
assert.deepEqual([q.moneyNumber(buyer.budget),q.moneyNumber(seller.budget)],balancesAfterPayment,'A processed instalment can never be charged twice');

const addOn=finance.transferAddOns[0],appsBefore=Number(player.seasonStats?.apps||0);
player.seasonStats=player.seasonStats||{};
player.seasonStats.apps=appsBefore+15;
const addOnDate=q.addDaysISO(due,1),buyerBeforeAddOn=q.moneyNumber(buyer.budget),sellerBeforeAddOn=q.moneyNumber(seller.budget);
x.processTransferPayments(addOnDate);
assert.equal(addOn.status,'PAID');
assert.equal(q.moneyNumber(buyer.budget),buyerBeforeAddOn-addOnAmount);
assert.equal(q.moneyNumber(seller.budget),sellerBeforeAddOn+addOnAmount);
const balancesAfterAddOn=[q.moneyNumber(buyer.budget),q.moneyNumber(seller.budget)];
x.processTransferPayments(q.addDaysISO(addOnDate,1));
assert.deepEqual([q.moneyNumber(buyer.budget),q.moneyNumber(seller.budget)],balancesAfterAddOn,'An earned add-on is paid exactly once');

console.log(JSON.stringify({status:'PASS',checks:[
  'one canonical career valuation','smooth contract leverage','youth potential premium','role-aware performance value','injury market-risk separation','signed wages remain stable','market wage demands','bounded incoming bids','canonical seller asking prices','three-part guaranteed fees','discounted structured offers','persisted commitments','one-time instalment settlement','one-time appearance add-on settlement'
]},null,2));
