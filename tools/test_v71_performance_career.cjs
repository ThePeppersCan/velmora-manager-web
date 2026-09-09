'use strict';
const assert=require('node:assert/strict');
const {runtime}=require('./career_test_runtime.cjs');
const {runtime:matchRuntime}=require('./test_matchday_engine.cjs');
const {opts}=require('./audit_player_quality.cjs');
const P=require('../player-performance.js'),T=require('../player-traits.js');
const plain=v=>JSON.parse(JSON.stringify(v));

(async()=>{
  const r=runtime(),q=r.q,club=r.context.VELMORA_CLUBS.find(c=>c.id==='redwick');
  r.d.assignClubForTest(club);q.initializeCareerLifecycle();
  const squad=q.getSquad(club),p=q.activeStarters(club)[0];
  const alternate=Object.keys(P.ROLE_WEIGHTS).find(role=>role!==p.role);
  p.roleFamiliarity={[p.role]:100,[alternate]:75};p.preferredMatchRole=alternate;
  const config=q.v210PlayerConfig(p,null,club);
  assert.equal(config.role,alternate,'Real watched-match payload uses chosen secondary role');
  assert.equal(config.careerMeta.primaryRole,p.role);
  assert.equal(config.careerMeta.roleModifier,P.roleSuitability(75));
  assert.deepEqual(plain(config.attributes),P.engineAttributes(p,{sharpness:r.context.VelmoraTraining.read(p).sharpness,roleModifier:P.roleSuitability(75)}));
  const natural=q.v210PlayerAttributes(p,1);
  assert(config.attributes.decision<natural.decision,'Unfamiliar role reduces actual technical execution');
  assert.equal(config.attributes.speed,natural.speed,'Unfamiliar role does not alter physical pace');

  const starters=q.activeStarters(club);
  starters.forEach(p=>{p.morale='Happy';p.fitness=100;});
  const focused=q.matchMoraleModifier(club),fresh=q.matchFitnessModifier(club);
  const bench=squad.find(p=>!starters.includes(p));bench.morale='Very Unhappy';
  assert.equal(q.matchMoraleModifier(club),focused,'Unused bench does not change starting-team morale');
  starters.forEach(p=>{p.morale='Very Happy';p.fitness=0;});
  assert(q.matchMoraleModifier(club)<focused,'Live and simulated morale share the focused sweet spot');
  assert(q.matchFitnessModifier(club)<fresh-8,'Zero fitness cannot fall back to a fresh-player default');

  Object.assign(p,{age:19,ovr:65,potential:85,developmentProgress:.99,developmentPlan:'Attacking',form:'Good',morale:'Happy'});
  p.stats={PAC:65,SHO:65,PAS:65,HAN:65,DEF:65,STA:65};
  const month='2027-02-01';q.applyMonthlyDevelopment(month);
  assert.equal(p.ovr,66,'Monthly development raises OVR at the progress threshold');
  assert(p.stats.SHO>65&&p.stats.PAC>65,'Development improves actual match attributes');
  assert.equal(p.stats.DEF,65,'Attacking development preserves unrelated attributes');
  const grown=JSON.stringify(p);q.applyMonthlyDevelopment(month);
  assert.equal(JSON.stringify(p),grown,'Repeating the month grants no duplicate growth');
  assert(q.saveCareerState());assert(q.loadCareerState());
  const loaded=q.getSquad(club).find(x=>x.id===p.id);
  assert.equal(loaded.preferredMatchRole,alternate);assert.equal(loaded.ovr,66);
  const savedGrowth=JSON.stringify(loaded);q.applyMonthlyDevelopment(month);
  assert.equal(JSON.stringify(loaded),savedGrowth,'Monthly guard survives actual save and reload');
  const beforeStats=plain(loaded.stats);q.developSeniorPlayer(loaded);
  assert.equal(loaded.ovr,66,'Season ageing adds no second positive development award');
  assert.deepEqual(plain(loaded.stats),beforeStats);
  loaded.potential=loaded.ovr;loaded.developmentProgress=.99;q.applyMonthlyDevelopment('2027-03-01');
  assert.equal(loaded.ovr,66,'Monthly growth respects potential ceiling');

  // Apply every trait through the real engine's live refresh and career sim adapter.
  const match=matchRuntime();assert(await match.engine.open(opts()));match.q.completePrematch();
  const e=match.q.entityById('H0'),state=match.q.state;
  state.matchTime=1e6;state.carrier=e;state.possession=e.team;state.zone=.7;
  state.score[e.team]=0;state.score[e.team==='belros'?'zafran':'belros']=1;
  for(const trait of T.catalog){
    e.player.playingTraits=[];match.q.v48RefreshTraits(e);const base=plain(e.attributes);
    e.player.playingTraits=[trait.id];match.q.v48RefreshTraits(e);
    assert(Object.keys(base).some(k=>e.attributes[k]>base[k]),`${trait.name} changes real live attributes`);
    const probe={...loaded,playingTraits:[],playingTraitsVersion:2,stats:{PAC:75,SHO:75,PAS:75,HAN:75,DEF:75,STA:75}};
    const neutral=P.ATTRIBUTES.map(k=>q.v24PlayerStat(probe,k));probe.playingTraits=[trait.id];
    assert(P.ATTRIBUTES.some((k,i)=>q.v24PlayerStat(probe,k)>neutral[i]),`${trait.name} changes the actual sim stat adapter`);
  }
  e.player.playingTraits=['second_wind'];state.matchTime=0;match.q.v48RefreshTraits(e);const early=e.attributes.stamina;
  state.matchTime=1e6;match.q.v48RefreshTraits(e);assert(e.attributes.stamina>early,'Second Wind activates late in play');
  await match.engine.close();
  console.log(JSON.stringify({status:'PASS',checks:['actual secondary-role payload','physical pace preserved','starter morale and zero fitness','monthly attribute growth and potential cap','save/load and duplicate-month guard','no double season growth','all 24 traits through live refresh and actual sim stat adapter','late trait activation']},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
