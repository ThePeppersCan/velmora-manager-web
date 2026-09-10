'use strict';

// V105 · Player pathways and honest progression
//
// Holds the new-career population model, seasonal growth reset, meaningful
// training choices and readable attribute scale in place.

const assert=require('node:assert/strict');
const {runtime}=require('./career_test_runtime.cjs');

const r=runtime(),q=r.q,clubs=r.context.VELMORA_CLUBS;
q.createInitialAcademies();
const all=clubs.flatMap(club=>q.getSquad(club));
const academy=clubs.flatMap(club=>q.getAcademy(club));
const u21=all.filter(player=>player.age<=21);

function mean(rows,pick){return rows.reduce((sum,row)=>sum+pick(row),0)/Math.max(1,rows.length);}
function correlation(rows,pickA,pickB){
  const avgA=mean(rows,pickA),avgB=mean(rows,pickB);
  let numerator=0,varianceA=0,varianceB=0;
  for(const row of rows){const a=pickA(row)-avgA,b=pickB(row)-avgB;numerator+=a*b;varianceA+=a*a;varianceB+=b*b;}
  return numerator/Math.sqrt(varianceA*varianceB);
}
function population(rows){
  return{
    count:rows.length,
    meanOvr:Number(mean(rows,p=>p.ovr).toFixed(2)),
    meanPotential:Number(mean(rows,p=>p.potential).toFixed(2)),
    potential85Plus:rows.filter(p=>p.potential>=85).length,
    potential90Plus:rows.filter(p=>p.potential>=90).length,
    hiddenGems:rows.filter(p=>p.ovr<=62&&p.potential>=80).length,
    maxHeadroom:Math.max(...rows.map(p=>p.potential-p.ovr))
  };
}

assert.equal(clubs.length,288,'the complete 16-division world is generated');
assert.equal(all.length,2304,'every club begins with an eight-player senior squad');
assert.equal(academy.length,576,'every club begins with a two-player academy');
assert(all.every(p=>p.potential>=p.ovr&&p.potential<=94),'senior potential remains bounded');
assert(academy.every(p=>p.potential>=p.ovr&&p.potential<=94),'academy potential remains bounded');

const senior=population(all),youth=population(u21),academySummary=population(academy);
const abilityPotentialCorrelation=correlation(u21,p=>p.ovr,p=>p.potential);
assert.ok(abilityPotentialCorrelation<.6,`young-player potential is not a disguised OVR score (${abilityPotentialCorrelation.toFixed(3)})`);
assert.ok(youth.hiddenGems>=12,'the senior world contains genuine low-OVR, high-potential finds');
assert.ok(youth.potential85Plus>=12&&youth.potential85Plus<=50,'high-end senior prospects are rare but present');
assert.ok(youth.potential90Plus>=2&&youth.potential90Plus<=15,'special senior prospects are exceptional');
assert.ok(youth.maxHeadroom>=25,'at least one player has a genuinely long development runway');
assert.ok(academySummary.meanOvr<60,'academy prospects enter below established senior level');
assert.ok(academySummary.potential85Plus>=5&&academySummary.potential85Plus<=35,'elite academy prospects are rare');
assert.ok(academySummary.potential90Plus>=1&&academySummary.potential90Plus<=12,'special academy prospects remain exceptional');

const legacyPlayer={id:'V105-LEGACY-MIGRATION',clubId:clubs[0].id,age:18,ovr:58,potential:65,dynamicPotentialDelta:0};
q.ensurePlayerCareerMeta(legacyPlayer);
assert.equal(legacyPlayer.potentialModelVersion,2,'existing saves migrate players to the V105 potential model');
assert.ok(legacyPlayer.potential>=legacyPlayer.ovr&&legacyPlayer.potential<=94,'migrated potential remains safe and bounded');

const club=clubs[0];
r.d.assignClubForTest(club);
q.initializeCareerLifecycle();
const sample=q.getSquad(club)[0];
const veteran=q.deepClone(sample);
Object.assign(veteran,{id:'V105-VETERAN',age:35,ovr:80,potential:80,basePotential:80,dynamicPotentialDelta:0,careerGrowthThisSeason:7,lastDevelopmentGain:.14});
const veteranBefore=veteran.ovr;
q.developSeniorPlayer(veteran);
assert.ok(veteran.ovr<veteranBefore,'veterans decline at season rollover');
assert.equal(veteran.careerGrowthThisSeason,veteran.ovr-veteranBefore,'this-season growth resets to the new season movement');
assert.equal(veteran.lastDevelopmentGain,veteran.ovr-veteranBefore,'the latest development signal exposes rollover decline');
assert.equal(q.v2075DevelopmentStatus(veteran,club).key,'DECLINING','decline is visible in the player pathway UI');

const prime=q.deepClone(sample);
Object.assign(prime,{id:'V105-PRIME',age:25,ovr:70,potential:78,basePotential:78,dynamicPotentialDelta:0,careerGrowthThisSeason:6,lastDevelopmentGain:.2});
q.developSeniorPlayer(prime);
assert.equal(prime.careerGrowthThisSeason,0,'a new season does not inherit the previous season growth total');

const attacker=q.getSquad(club).find(p=>p.role==='ATTACKER');
const defender=q.getSquad(club).find(p=>p.role==='DEFENDER');
assert.ok(q.v23SetTrainingFocus('Attack'),'Attack focus can be selected through the real training control');
const attackForAttacker=q.weeklyTrainingDevelopmentFactor(attacker,club);
const attackForDefender=q.weeklyTrainingDevelopmentFactor(defender,club);
assert.ok(q.v23SetTrainingFocus('Defence'),'Defence focus can be selected through the real training control');
const defenceForDefender=q.weeklyTrainingDevelopmentFactor(defender,club);
assert.ok(attackForAttacker>attackForDefender,'Attack focus favours attacking roles');
assert.ok(defenceForDefender>attackForDefender,'Defence focus materially develops defenders');
assert.ok(q.v23SetTrainingFocus('Rest'),'Rest focus can be selected through the real training control');
const recoveryWithRest=q.deterministicDailyRecovery(attacker,q.currentCareerISO());
q.v23SetTrainingFocus('Balanced');
const recoveryBalanced=q.deterministicDailyRecovery(attacker,q.currentCareerISO());
assert.equal(recoveryWithRest,recoveryBalanced+2,'Rest is a selectable focus with a real recovery benefit');

const boardObjectives=q.buildBoardObjectives(club);
const leagueObjective=boardObjectives.find(objective=>objective.id==='league');
assert.equal(leagueObjective.status,'PENDING','the league objective is awaiting evidence before the first fixture');
assert.equal(leagueObjective.progress,0,'pre-season league position is not presented as measured progress');

q.getSquad(club).splice(4);
const emergencyPromotions=q.ensurePlayableUserSquad(club);
assert.equal(q.getSquad(club).length,6,'neglected expiries cannot leave a career below the matchday minimum');
assert.equal(emergencyPromotions.length,2,'the minimum uses explicit academy emergency registrations');

assert.equal(q.attributeBarPercent(40),4,'the lower bound remains visible');
assert.equal(q.attributeBarPercent(94),100,'the elite bound fills the track');
assert.ok(q.attributeBarPercent(57)-q.attributeBarPercent(52)>=8,'a five-point attribute difference is visually legible');

console.log(JSON.stringify({
  status:'PASS',version:'V105',
  measured:{senior,u21:youth,academy:academySummary,u21AbilityPotentialCorrelation:Number(abilityPotentialCorrelation.toFixed(3))},
  checks:[
    'new-career potential is distinct from current ability',
    'hidden gems exist while elite prospects remain rare',
    'academy intake starts at an honest development level',
    'seasonal growth resets and decline is visible',
    'Attack, Defence and Rest training choices have real effects',
    'attribute bars use a readable football-rating scale'
  ]
},null,2));
