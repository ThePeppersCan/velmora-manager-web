const assert=require('node:assert/strict');const {runtime}=require('./career_test_runtime.cjs');
const r=runtime(),q=r.q,c=r.context.VELMORA_CLUBS.find(c=>c.id==='redwick');r.d.assignClubForTest(c);q.initializeCareerLifecycle();
const report={status:'PASS',checks:[],measurements:{}};
const check=(name,fn)=>{fn();report.checks.push(name)};
const key=q.careerSlotKey(1),codec=r.context.VelmoraSaveCodec;
check('compressed save round trip including legacy JSON, with real 288-club data',()=>{
 assert(q.saveCareerState());const encoded=r.local.get(key),raw=codec.decode(encoded),saved=JSON.parse(raw);assert.equal(Object.keys(saved.squads).length,288);assert(encoded.length<raw.length*.3);assert(q.loadCareerState());r.local.set(key,raw);assert(q.loadCareerState());assert(q.saveCareerState());report.measurements.save={rawCharacters:raw.length,storedCharacters:encoded.length,estimatedUTF16Bytes:encoded.length*2};
 const edge=JSON.stringify({unicode:'Velmora 🐉 é 漢字',nil:null,zero:0,empty:'',negative:-3,nested:[true,false,{x:'\u0000'}]});assert.equal(codec.decode(codec.encode(edge)),edge);
});
check('save succeeds within a 5 MiB quota; failure preserves the old save and its timestamp',()=>{
 const normal=r.context.localStorage.setItem;r.context.localStorage.setItem=(k,v)=>{const bytes=[...r.local].filter(([id])=>id!==k).reduce((s,[id,val])=>s+(id.length+val.length)*2,0)+(k.length+String(v).length)*2;if(bytes>5*1024*1024)throw new Error('QuotaExceededError');normal(k,v)};assert(q.saveCareerState());const old=r.local.get(key),timestamp=q.state().careerRuntime.lastSavedAt;
 r.context.localStorage.setItem=()=>{throw new Error('QuotaExceededError')};const log=r.context.console;r.context.console={...console,error:()=>{}};assert.equal(q.saveCareerState(),false);r.context.console=log;assert.equal(r.local.get(key),old);assert.equal(q.state().careerRuntime.lastSavedAt,timestamp);assert(r.nodes.has('careerSaveFailure'));r.context.localStorage.setItem=normal;
});
check('wage ceiling stays fixed and excessive offers are rejected before commitment',()=>{
 const before=q.officeFinanceSnapshot(),p=q.getSquad(c)[0],wage=p.wage;p.wage*=5;const after=q.officeFinanceSnapshot();assert.equal(after.wageBudget,before.wageBudget);assert(after.wageRatio>before.wageRatio);assert(after.health<before.health);p.wage=wage;
 const seller=q.state().clubs.find(x=>x.id!==c.id),candidate=q.getSquad(seller)[2],session=q.contractNegotiationSession(candidate,'SIGNING',true),state=JSON.stringify(session);assert.equal(q.evaluateContractPackage(candidate,{wage:before.wageBudget*2,bonus:0,years:3,role:'Crucial'},session).status,'rejected');assert.equal(JSON.stringify(session),state);report.measurements.wageCeiling=before.wageBudget;
});
let purchase;
check('permanent purchase credits seller, debits buyer once, and transfers one player identity',()=>{
 const seller=q.state().clubs.find(x=>x.id!==c.id),p=q.getSquad(seller)[3],fee=100000,bonus=5000;c.budget='£20m';const a=q.moneyNumber(c.budget),b=q.moneyNumber(seller.budget),n=q.getSquad(c).length,old=q.getSquad(seller).length;
 const result=q.completeTransferSigning({...p,club:seller},fee,1000,bonus,'Rotation',3);assert(result.ok,result.message);assert.equal(q.moneyNumber(seller.budget),b+fee);assert.equal(q.moneyNumber(c.budget),a-fee-bonus);assert.equal(q.getSquad(c).length,n+1);assert.equal(q.getSquad(seller).length,old-1);assert.equal(result.player.id,p.id);
 assert.equal(q.completeTransferSigning({...p,club:seller},fee,1000,bonus,'Rotation',3).ok,false);assert.equal(q.moneyNumber(c.budget),a-fee-bonus);purchase=result.player;report.measurements.transfer={fee,buyerDebit:a-q.moneyNumber(c.budget),sellerCredit:q.moneyNumber(seller.budget)-b};
});
check('failed transfer leaves accepted talks and player registration unchanged',()=>{
 const seller=q.state().clubs.find(x=>x.id!==c.id),p=q.getSquad(seller)[4],session=q.contractNegotiationSession(p,'SIGNING',true);session.state='AGREED';const budget=c.budget;c.budget='£0';const result=q.completeTransferSigning({...p,club:seller},100000,1000,0,'Rotation',3);assert.equal(result.ok,false);assert.equal(session.state,'AGREED');assert(q.getSquad(seller).some(x=>x.id===p.id));c.budget=budget;
});
check('stale free-agent offers cannot create duplicate registered players',()=>{
 const budget=c.budget,n=q.getSquad(c).length,stale={...purchase,freeAgent:true,clubId:null};assert.equal(q.completeTransferSigning(stale,0,500,0,'Rotation',2).ok,false);assert.equal(q.getSquad(c).length,n);assert.equal(c.budget,budget);
});
let loanPlayer,loan,borrower;
check('loaned player can start for borrower; wage sharing follows the agreed percentage',()=>{
 loanPlayer=q.getSquad(c).find(p=>!p.captain&&p.id!==purchase.id);borrower=q.state().clubs.find(x=>x.id!==c.id&&q.getSquad(x).length<10);loanPlayer.ovr=94;loanPlayer.potential=94;for(const stat of Object.keys(loanPlayer.stats))loanPlayer.stats[stat]=94;const parentPay=q.v25ClubWeeklyWages(c),borrowerPay=q.v25ClubWeeklyWages(borrower),wage=loanPlayer.wage;
 assert(q.completeLivingLoan({id:'TEST-LOAN',parentClubId:c.id,expectedRole:'Important',wageContribution:50},loanPlayer,borrower));loan=q.livingLoanForPlayer(loanPlayer.id);assert(loan);assert(!q.getSquad(c).some(p=>p.id===loanPlayer.id));assert(q.getSquad(borrower).some(p=>p.id===loanPlayer.id));assert(Math.abs(q.v25ClubWeeklyWages(c)-(parentPay-wage*.5))<=1);assert(Math.abs(q.v25ClubWeeklyWages(borrower)-(borrowerPay+wage*.5))<=1);
 q.prepareAiLineupForFixture(borrower,{fixtureId:'LOAN-QA',date:q.currentCareerISO(),type:'LEAGUE',homeClubId:borrower.id,awayClubId:c.id});assert(q.activeStarters(borrower).some(p=>p.id===loanPlayer.id));
});
check('loan reports cannot create appearances; actual fixtures drive loan records',()=>{
 const before=loanPlayer.seasonStats.apps;q.processLivingLoanMonth('2026-08-01');assert.equal(loanPlayer.seasonStats.apps,before);assert.equal(loan.lastMonthStarts,0);
 const other=q.state().clubs.find(x=>x.id!==borrower.id&&x.id!==c.id),f={fixtureId:'QA-LOAN-FIXTURE',date:'2026-09-03',type:'LEAGUE',homeClubId:borrower.id,awayClubId:other.id};q.state().fixtures.push(f);q.simulateBackgroundFixture(f);assert(f.played);assert.equal(loanPlayer.seasonStats.apps,before+1);assert.equal(loan.appearances,1);assert.equal(loan.matchMonths['2026-09'].starts,1);q.processLivingLoanMonth('2026-10-01');assert.equal(loanPlayer.seasonStats.apps,before+1);assert.equal(loan.lastMonthStarts,1);q.processLivingLoanMonth('2026-10-01');assert.equal(loan.appearances,1);report.measurements.loan={actualAppearances:loan.appearances,reportedStarts:loan.lastMonthStarts};
});
check('loan return restores unique ownership and salary commitments',()=>{
 assert(q.returnLivingLoan(loan,'2027-06-30'));assert.equal(loan.status,'RETURNED');assert.equal(loanPlayer.onLoan,false);assert(q.getSquad(c).some(p=>p.id===loanPlayer.id));assert(!q.getSquad(borrower).some(p=>p.id===loanPlayer.id));const all=q.state().clubs.flatMap(c=>q.getSquad(c));assert.equal(all.filter(p=>p.id===loanPlayer.id).length,1);
});
check('quick sim repairs a replaceable injured starter before committing a fixture',()=>{
 const p=q.activeStarters(c)[0],other=q.state().clubs.find(x=>x.id!==c.id);p.injured=true;p.injuryDaysRemaining=10;const f={fixtureId:'INJURED-QA',homeClubId:c.id,awayClubId:other.id,date:'2026-08-10',type:'LEAGUE'};const r=q.simulateUserFixture(f,'QUICK SIM');assert(r?.saved);assert(f.played);assert(!q.activeStarters(c).some(x=>x.id===p.id));p.injured=false;p.injuryDaysRemaining=0;
});
check('budget chart uses observed balances; finance state survives save/load',()=>{
 q.saveCareerState();const before=q.v25ClubFinance(c).wageBudget,history=JSON.stringify(q.v25ClubFinance(c).history);q.officeFinanceTrend();q.officeFinanceTrend();assert.equal(JSON.stringify(q.v25ClubFinance(c).history),history);assert(q.loadCareerState());assert.equal(q.v25ClubFinance(c).wageBudget,before);assert.equal(JSON.stringify(q.v25ClubFinance(c).history),history);
});
check('monthly development is bounded and processes each month once',()=>{
 q.applyMonthlyDevelopment('2026-09-01');const before=JSON.stringify(q.getSquad(c));q.applyMonthlyDevelopment('2026-09-01');assert.equal(JSON.stringify(q.getSquad(c)),before);assert(q.getSquad(c).every(p=>Number.isFinite(p.ovr)&&p.ovr<=p.potential));
});
console.log(JSON.stringify(report,null,2));
