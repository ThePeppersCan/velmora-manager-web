const assert=require('node:assert/strict');
const {runtime}=require('./career_test_runtime.cjs');
const r=runtime(),q=r.q,x=r.context.VELMORA_EXPANSION;
const club=r.context.VELMORA_CLUBS.find(c=>c.id==='redwick');r.d.assignClubForTest(club);q.initializeCareerLifecycle();
club.budget='£100000000';q.v25ClubFinance(club).wageBudget=1000000;
const checks=[];function check(name,fn){fn();checks.push(name);}
check('staff recruitment, wages, course fees and assignment locks',()=>{
  const d=x.department(),candidate=x.market().find(p=>p.role==='scout'),before=q.moneyNumber(club.budget);
  assert(x.hire(candidate.id).ok);assert.equal(q.moneyNumber(club.budget),before-candidate.fee);assert.equal(x.hire(candidate.id).ok,false);
  const scout=x.freeScouts().find(p=>p.key===candidate.key);assert(scout);
  assert(x.sendScout(scout.key,'Caldria','DEFENDER',1).ok);assert.equal(x.fire(scout.key).ok,false);assert.equal(x.trainStaff(scout.key).ok,false);
  const coach=d.staff.find(p=>p.role==='coach'),quality=coach.quality;assert(x.trainStaff(coach.key).ok);assert(!x.trainStaff(coach.key).ok);
  q.setCareerDate('2026-08-31');x.daily(q.currentCareerISO());assert.equal(coach.quality,quality+3);assert.equal(coach.course,null);
  assert(d.reports.length>0);assert(d.reports.every(r=>r.player.role==='DEFENDER'&&r.region==='Caldria'));assert.equal(d.missions[0].status,'COMPLETE');assert(x.freeScouts().some(p=>p.key===scout.key));
  const report=d.reports[0],count=q.getAcademy(club).length;assert(x.signProspect(report.id).ok);assert.equal(q.getAcademy(club).length,count+1);assert(!x.signProspect(report.id).ok);
});
check('academy competition records youth appearances without senior appearances and progresses once',()=>{
  const league=x.youthCompetition(club),players=q.getAcademy(club).slice(0,3);assert(x.setYouthTeam(players.map(p=>p.id),'DEVELOPMENT').ok);assert.equal(x.setYouthTeam([players[0].id,players[0].id,players[2].id],'BALANCED').ok,false);
  const before=players.map(p=>p.seasonStats?.apps||0);q.setCareerDate('2026-09-05');x.daily(q.currentCareerISO());assert(league.fixtures.some(f=>f.played));assert(players.every(p=>p.academyStats.apps===1));assert.deepEqual(players.map(p=>p.seasonStats?.apps||0),before);
  const snapshot=JSON.stringify(x.state());x.daily(q.currentCareerISO());assert.equal(JSON.stringify(x.state()),snapshot);
});
check('construction, operating costs and sponsor payments are date-driven and idempotent',()=>{
  const d=x.department(),capacity=d.capacity;assert(x.upgrade('stadium').ok);assert(!x.upgrade('stadium').ok);assert.equal(d.capacity,capacity);assert(x.signSponsor('community').ok);assert(!x.signSponsor('growth').ok);
  q.setCareerDate('2026-10-01');x.daily(q.currentCareerISO());const balance=club.budget;assert.equal(d.sponsor.months,1);assert(d.ledger.some(t=>t.label.includes('Staff wages')));x.daily(q.currentCareerISO());assert.equal(club.budget,balance);
  q.setCareerDate('2026-12-15');x.daily(q.currentCareerISO());assert(d.capacity>capacity);assert.equal(d.facilities.stadium,2);
});
function otherPlayer(){const seller=q.state().clubs.find(c=>c.id!==club.id&&c.tier===club.tier&&c.world===club.world);seller.budget='£100000000';q.v25ClubFinance(seller).wageBudget=1000000;const p=q.getSquad(seller).find(p=>!p.captain&&!p.onLoan&&!p.v34Precontract);return {seller,p};}
function terms(p,extra={}){return {fee:Math.round(q.livingPlayerMarketValue(p)*4),wage:Math.ceil(q.expectedWage(p)*1.4),bonus:1000,years:3,role:'Rotation',sellOn:0,releaseClause:0,optionFee:Math.round(q.livingPlayerMarketValue(p)*1.5),wageShare:100,...extra};}
check('release clauses commit ownership, money and one player identity exactly once',()=>{
  q.setCareerDate('2027-01-10');const {seller,p}=otherPlayer();p.releaseClause=500000;const old=q.moneyNumber(seller.budget),own=q.getSquad(club).length,t=terms(p,{releaseClause:Math.round(q.livingPlayerMarketValue(p)*2)}),proposal=x.proposeDeal(p.id,'RELEASE',t);assert(proposal.ok,proposal.message);
  const result=x.confirmDeal(proposal.offer.id);assert(result.ok,result.message);assert.equal(q.getSquad(club).length,own+1);assert.equal(q.moneyNumber(seller.budget),old+500000);assert(q.getSquad(club).some(a=>a.id===p.id));assert.equal(p.releaseClause,t.releaseClause);assert(!x.confirmDeal(proposal.offer.id).ok);
});
check('pre-contracts reserve wages/places, block native transfers, then register once on arrival',()=>{
  const {seller,p}=otherPlayer();p.age=28;p.contractEndDate='2027-06-30';p.contractYears=1;const proposal=x.proposeDeal(p.id,'PRECONTRACT',terms(p));assert(proposal.ok,proposal.message);assert(x.confirmDeal(proposal.offer.id).ok);assert.equal(x.reservedPlaces(club),1);assert(x.reservedWages(club)>0);assert(!q.completeTransferSigning({...p,club:seller},1,1000,0,'Rotation',3).ok);
  q.setCareerDate('2027-07-01');x.processPrecontracts(q.currentCareerISO());assert.equal(p.clubId,club.id);assert.equal(x.reservedPlaces(club),0);const n=q.getSquad(club).length;x.processPrecontracts(q.currentCareerISO());assert.equal(q.getSquad(club).length,n);
});
check('sell-on clauses pay the former club on the next permanent transfer',()=>{
  const former=q.state().clubs.find(c=>c.id!==club.id),p=q.getSquad(club).find(p=>!p.onLoan),buyer=q.state().clubs.find(c=>c.id!==club.id&&c.id!==former.id);p.v34SellOn={beneficiary:former.id,owedBy:club.id,percent:20};const old=q.moneyNumber(former.budget),own=q.moneyNumber(club.budget);club.budget=q.formatExactMoney(own+1000000);q.recordLivingTransfer(p,club,buyer,1000000);assert.equal(q.moneyNumber(former.budget),old+200000);assert.equal(q.moneyNumber(club.budget),own+800000);assert.equal(p.v34SellOn,undefined);
});
check('loan buy option preserves loan ownership until exercised',()=>{
  q.setCareerDate('2027-01-20');const {seller,p}=otherPlayer();p.contractEndDate='2030-06-30';const t=terms(p,{fee:Math.ceil(q.livingPlayerMarketValue(p)*.1)}),offer=x.proposeDeal(p.id,'LOAN_BUY',t);assert(offer.ok,offer.message);assert(x.confirmDeal(offer.offer.id).ok);assert.equal(p.ownerClubId,seller.id);assert(p.onLoan);const loan=q.livingLoanForPlayer(p.id);assert(loan.buyOption);const result=x.exerciseOption(loan.id);assert(result.ok,result.message);assert.equal(p.ownerClubId,club.id);assert.equal(p.onLoan,false);assert.equal(loan.status,'PURCHASED');assert(!x.exerciseOption(loan.id).ok);
});
check('all expansion state survives career save/load and slot switching',()=>{
  assert(q.saveCareerState());const original=JSON.parse(JSON.stringify(x.state())),staff=x.department().staff.length;assert(q.loadCareerState());assert.equal(x.department().staff.length,staff);const reloaded=JSON.parse(JSON.stringify(x.state()));
  for(const [clubId,department] of Object.entries(original.clubs))assert.deepEqual(reloaded.clubs[clubId],department,`saved expansion department changed for ${clubId}`);
  for(const key of ['customClubs','precontracts','sequence'])assert.deepEqual(reloaded[key],original[key],`saved expansion ${key} changed`);
});
check('create-a-club maintains league membership and isolates identity between slots',()=>{
  q.setActiveCareerSlot(2);q.set('employmentStatus','setup');const base=q.state().clubs.find(c=>c.id!==club.id),oldName=base.name,originalCount=q.state().clubs.length;const result=x.createClub({replaceId:base.id,name:'Skyward Athletic',abbr:'SKY',stadium:'Skyward Arena',primary:'#14b8a6',secondary:'#10243b',badge:'round',budget:'standard'});assert(result.ok,result.message);assert.equal(base.name,'Skyward Athletic');assert.equal(q.state().clubs.length,originalCount);assert(q.badgeHTML(base).includes('SKY'));assert(q.saveCareerState());assert(q.loadCareerState(1));assert.equal(base.name,oldName);assert(q.loadCareerState(2));assert.equal(base.name,'Skyward Athletic');assert.equal(q.state().currentClub.id,base.id);
});
console.log(JSON.stringify({status:'PASS',checks},null,2));
