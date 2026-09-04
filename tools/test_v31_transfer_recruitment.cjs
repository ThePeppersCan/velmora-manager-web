const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {runtime}=require('./career_test_runtime.cjs');
const r=runtime(),q=r.q,c=r.context.VELMORA_CLUBS.find(c=>c.id==='redwick');
r.d.assignClubForTest(c);q.initializeCareerLifecycle();
const report={status:'PASS',checks:[],measurements:{}};
const check=(name,fn)=>{fn();report.checks.push(name)};

check('money shorthand parser handles k/m, decimals and case',()=>{
  assert.equal(q.moneyNumber('2m'),2_000_000);
  assert.equal(q.moneyNumber('10M'),10_000_000);
  assert.equal(q.moneyNumber('650k'),650_000);
  assert.equal(q.moneyNumber('10k'),10_000);
  assert.equal(q.moneyNumber('1K'),1_000);
  assert.equal(q.moneyNumber('6.5k'),6_500);
  assert.equal(q.moneyNumber('£ 6,500'),6_500);
});

check('compact wage display preserves meaningful precision',()=>{
  assert.equal(q.formatMoney(6500),'£6.5k');
  assert.equal(q.formatMoney(6800),'£6.8k');
  assert.equal(q.formatMoney(10000),'£10k');
  assert.notEqual(q.formatMoney(6500),'£7k');
});

check('normal transfer search includes free agents and filter can isolate them',()=>{
  const f={q:'',role:'all',age:'all',minOvr:0,country:'all',division:'all',type:'all',scouting:'all',sort:'relevance'};
  const free=q.getFreeAgents();
  const all=q.transferSearchPool(f);
  assert(free.length>0);
  assert(free.every(p=>all.some(x=>x.id===p.id)));
  const only=q.transferSearchPool({...f,type:'freeagent'});
  assert(only.length>0);
  assert(only.every(p=>p.freeAgent));
  report.measurements.search={all:all.length,freeAgents:free.length,freeOnly:only.length};
});

check('scouting assignment stores a due date and completion becomes a full report',()=>{
  const seller=q.state().clubs.find(x=>x.id!==c.id),p=q.getSquad(seller)[2];
  q.scoutTransferPlayer({...p,club:seller,clubId:seller.id,clubName:seller.name,freeAgent:false});
  const live=q.scoutAssignment(p);
  assert(live);
  assert.match(String(live.completionDate||''),/^\d{4}-\d{2}-\d{2}$/);
  q.completeScoutingAssignment(p.id,live.completionDate);
  assert.equal(q.isScouted(p),true);
  report.measurements.scouting={playerId:p.id,due:live.completionDate};
});

check('loan rows use a bounded crest wrapper',()=>{
  const p=q.getSquad(c).find(x=>!x.captain),borrower=q.state().clubs.find(x=>x.id!==c.id&&q.getSquad(x).length<10);
  assert(q.completeLivingLoan({id:'V31-LOAN',parentClubId:c.id,expectedRole:'Important',wageContribution:50},p,borrower));
  const html=q.livingLoansHTML();
  assert.match(html,/living-loan-crest/);
});

check('transfer navigation contains Scouting and no Free Agents tab',()=>{
  const html=fs.readFileSync(path.resolve(__dirname,'..','index.html'),'utf8');
  assert.match(html,/data-transfer-tab="scouting"[^>]*>SCOUTING</);
  assert.doesNotMatch(html,/data-transfer-tab="free-agents"/);
});

console.log(JSON.stringify(report,null,2));
