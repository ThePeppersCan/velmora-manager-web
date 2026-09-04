const assert=require('node:assert/strict');
const {runtime}=require('./career_test_runtime.cjs');
const r=runtime(),q=r.q,d=r.context.VELMORA_MANAGER_DEBUG;
const report={status:'PASS',checks:[],measurements:{}};
const check=(name,fn)=>{fn();report.checks.push(name)};
check('expanded banks contain 3,000 Velmora and 3,000 sports-style full-name seeds',()=>{
  const x=r.context.VELMORA_NAME_EXPANSION;
  assert.equal(x.velmoraFull.length,3000);
  assert.equal(x.sportsFull.length,3000);
  assert(x.velmoraFirst.length>=180);
  assert(x.velmoraSurnames.length>=650);
  assert(x.sportsFirst.length>=250);
  assert(x.sportsSurnames.length>=400);
  report.measurements.banks={velmoraFull:x.velmoraFull.length,sportsFull:x.sportsFull.length,velmoraFirst:x.velmoraFirst.length,velmoraSurnames:x.velmoraSurnames.length,sportsFirst:x.sportsFirst.length,sportsSurnames:x.sportsSurnames.length};
});
check('all 2,304 initial senior players have unique full names',()=>{
  const qa=d.v261NameDiversityIntegrityForTest();
  assert.equal(qa.activeSeniorPlayers,2304);
  assert.equal(qa.duplicateFullNames,0);
  assert.equal(qa.uniqueSeniorNames,2304);
  report.measurements.initialSenior={players:qa.activeSeniorPlayers,unique:qa.uniqueSeniorNames};
});
check('no initial club squad repeats a surname',()=>{
  const qa=d.v261NameDiversityIntegrityForTest();
  assert.equal(qa.clubsWithRepeatedSquadSurname,0);
  assert.equal(qa.repeatedSquadSurnameCount,0);
});
check('free-agent pool has unique full names and surnames',()=>{
  const free=q.getFreeAgents();
  const names=free.map(p=>p.name.toLowerCase());
  const surnames=free.map(p=>p.name.trim().split(/\s+/).at(-1).toLowerCase());
  assert.equal(new Set(names).size,names.length);
  assert.equal(new Set(surnames).size,surnames.length);
  assert(free.every(p=>!/[0-9]/.test(p.name)));
  report.measurements.freeAgents={players:free.length,uniqueNames:new Set(names).size,uniqueSurnames:new Set(surnames).size};
});
check('youth generation avoids active-name collisions and numeric fallback names',()=>{
  const club=r.context.VELMORA_CLUBS[0];
  q.createInitialAcademies();
  const before=new Set(r.context.VELMORA_CLUBS.flatMap(c=>q.getSquad(c)).map(p=>p.name.toLowerCase()));
  const prospect=q.generateYouthProspect(club,77,'NAME-QA');
  assert(!before.has(prospect.name.toLowerCase()));
  assert(!/[0-9]/.test(prospect.name));
  assert(prospect.name.trim().split(/\s+/).length>=2);
  report.measurements.youthSample=prospect.name;
});
console.log(JSON.stringify(report,null,2));
