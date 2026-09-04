// World competition progression; this deliberately does not model every daily decision.
const assert=require('node:assert/strict');const {runtime}=require('./career_test_runtime.cjs');
const r=runtime(),q=r.q,club=r.context.VELMORA_CLUBS.find(c=>c.id==='redwick');r.d.assignClubForTest(club);q.initializeCareerLifecycle();
const before=q.state().careerTime.seasonId,result=q.simulateRoadToGlorySeasonForTest();assert(result.ok);assert.equal(q.state().fixtures.filter(f=>!f.played).length,0);assert(q.completeSeasonRollover());assert.notEqual(q.state().careerTime.seasonId,before);
const divisions=Object.fromEntries([...new Set(q.state().clubs.map(c=>c.divisionKey))].map(k=>[k,q.state().clubs.filter(c=>c.divisionKey===k).length]));assert.equal(Object.keys(divisions).length,16);assert(Object.values(divisions).every(n=>n===18));assert(q.saveCareerState());assert(q.loadCareerState());assert.equal(q.state().roadToGlory.careerHistory.length,1);
console.log(JSON.stringify({status:'PASS',resolved:result.resolved,seasonBefore:before,seasonAfter:q.state().careerTime.seasonId,divisions,storedCharacters:r.local.get(q.careerSlotKey(1)).length},null,2));
