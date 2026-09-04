const assert=require('node:assert/strict'),{runtime}=require('./career_test_runtime.cjs');
const r=runtime(),q=r.q,x=r.context.VELMORA_EXPANSION,c=q.state().clubs.find(c=>c.id==='redwick');r.d.assignClubForTest(c);q.initializeCareerLifecycle();c.budget='£100000000';q.v25ClubFinance(c).wageBudget=1000000;
const players=q.state().clubs.flatMap(c=>q.getSquad(c)),checks=[];
function check(name,fn){console.log('CHECK:',name);fn();checks.push(name);console.log('OK:',name);}
check('clauses are rare and span bargains through expensive buyouts',()=>{x.seedClauses();const holders=players.filter(p=>p.releaseClause),ratio=holders.length/players.length;assert(ratio>.07&&ratio<.13,ratio);const amounts=holders.map(p=>p.releaseClause/q.livingPlayerMarketValue(p));assert(amounts.some(r=>r<.9));assert(amounts.some(r=>r>2.4));assert(holders.every(p=>p.releaseClauseOrigin.type==='generated'));});
check('buyout stays fixed after player development',()=>{const p=players.find(p=>p.releaseClause),amount=p.releaseClause;p.ovr+=5;p.potential+=5;p.value*=2;x.seedClauses();assert.equal(p.releaseClause,amount);});
check('V34 migration reduces only identifiable generated clauses and preserves negotiated contracts',()=>{
 const all=q.state().clubs.flatMap(c=>q.getSquad(c));delete x.state().clausePolicyVersion;
 for(const p of all){delete p.v35ClauseChecked;delete p.releaseClause;delete p.releaseClauseOrigin;p.v34ClauseChecked=true;p.lastContractReason='';}
 const seed=q.state().worldSeed;
 for(const p of all)if(q.hashString(seed+'clause'+p.id)%5===0)p.releaseClause=Math.round(q.livingPlayerMarketValue(p)*(1.6+(q.hashString(p.id)%8)/10)/1000)*1000;
 const automatic=all.filter(p=>p.releaseClause),explicit=automatic[0],amended=automatic[1],renewed=automatic[2],removed=all.find(p=>!p.releaseClause);
 explicit.releaseClause=1234567;const amendmentValue=amended.releaseClause,renewalValue=renewed.releaseClause;renewed.lastContractReason='RENEWAL';x.department().ledger.unshift({label:'Contract amendment: '+amended.name});
 x.seedClauses();assert.equal(explicit.releaseClause,1234567);assert.equal(amended.releaseClause,amendmentValue);assert.equal(renewed.releaseClause,renewalValue);assert(!removed.releaseClause);
 assert(all.filter(p=>p.releaseClause).length<automatic.length*.7);assert.equal(x.state().clausePolicyVersion,2);
});
check('ordinary signings have no clause unless explicitly agreed',()=>{
 const free=q.getFreeAgents()[0];const first=q.completeTransferSigning(free,0,free.wage*2,0,'Rotation',3);assert(first.ok,first.message);assert(!first.player.releaseClause);assert.equal(first.player.releaseClauseOrigin.type,'negotiated');
 const other=q.getFreeAgents()[0],amount=Math.round(q.livingPlayerMarketValue(other)*1.5);const second=q.completeTransferSigning(other,0,other.wage*2,0,'Rotation',3,amount);assert(second.ok,second.message);assert.equal(second.player.releaseClause,amount);
 q.saveCareerState();q.loadCareerState();assert.equal(q.careerPlayerById(second.player.id).releaseClause,amount);assert(!q.careerPlayerById(first.player.id).releaseClause);
});
check('no-clause players cannot be purchased via a release clause',()=>{const p=q.state().clubs.filter(a=>a.id!==c.id).flatMap(a=>q.getSquad(a)).find(p=>!p.releaseClause&&!p.captain);const result=x.proposeDeal(p.id,'RELEASE',{fee:100000,wage:p.wage*2,bonus:0,years:3,role:'Rotation'});assert(!result.ok);assert(/clause/i.test(result.message));});
console.log(JSON.stringify({status:'PASS',checks},null,2));
