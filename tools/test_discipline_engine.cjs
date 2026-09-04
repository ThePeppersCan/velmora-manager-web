const assert=require('node:assert/strict');
const {runtime,options}=require('./test_matchday_engine.cjs');
(async()=>{
  const r=runtime(),q=r.q;assert(await r.engine.open(options('home',90126)));q.completePrematch();
  const offender=q.entityById('H0');assert(offender);
  const first=q.disciplineApplyCard(offender,{card:'YELLOW',reason:'CAUTION'});assert.equal(first.card,'YELLOW');assert.equal(q.state.playerStats.H0.yellowCards,1);assert.equal(q.state.teamStats.belros.yellowCards,1);assert(q.entityById('H0'));
  const second=q.disciplineApplyCard(offender,{card:'SECOND_YELLOW',reason:'SECOND_YELLOW'});assert.equal(second.card,'SECOND_YELLOW');assert.equal(q.state.playerStats.H0.yellowCards,2);assert.equal(q.state.playerStats.H0.redCards,1);assert.equal(q.state.teamStats.belros.redCards,1);assert.equal(q.entityById('H0'),undefined);assert.equal(q.teamEntities('belros').length,2);assert.equal(q.state.management.players.H0.sentOff,true);assert.equal(q.state.management.players.H0.active,false);
  q.skipCareerToFulltime();assert.equal(q.state.phase,'fulltime');const report=q.careerResultSnapshot();assert.equal(report.engine,'REPO_SPORTS_V2_CAREER_V26');assert.equal(report.matchday.version,2);assert.equal(report.matchday.participation.H0.sentOff,true);assert.equal(report.disciplineEvents.length,2);assert.equal(JSON.stringify(report.disciplineEvents.map(e=>e.card)),JSON.stringify(['YELLOW','SECOND_YELLOW']));assert.equal(report.teamStats.home.yellowCards,2);assert.equal(report.teamStats.home.redCards,1);
  console.log(JSON.stringify({status:'PASS',checks:['live yellow card recorded','second yellow becomes dismissal','sent-off player removed from active entities','team continues short-handed','card totals enter career snapshot','matchday participation records dismissal']},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
