'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),P=require('../player-performance.js'),T=require('../player-traits.js'),Training=require('../training.js');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),manifest=fs.readFileSync(path.join(root,'tools/release_manifest.cjs'),'utf8');
const player=(role,ovr,stats={})=>({id:role,role,ovr,stats:{PAC:ovr,SHO:ovr,PAS:ovr,HAN:ovr,DEF:ovr,STA:ovr,...stats},fitness:82,sharpness:70,form:'Average',morale:'Content'});

for(const [role,weights] of Object.entries(P.ROLE_WEIGHTS))assert(Math.abs(Object.values(weights).reduce((a,b)=>a+b,0)-1)<1e-9,`${role} weights sum to one`);
const specialist={PAC:79,SHO:91,PAS:65,HAN:82,DEF:48,STA:73},attacker=player('ATTACKER',76,specialist);
assert(P.roleRating(attacker,'ATTACKER')>P.roleRating(attacker,'DEFENDER')+12,'specialist attributes create a meaningful positional identity');
for(const role of Object.keys(P.ROLE_WEIGHTS)){
  const calibrated=P.calibrateStats(player(role,74,{PAC:80,SHO:84,PAS:76,HAN:78,DEF:60,STA:75}).stats,74,role);
  assert(Math.abs(P.roleRating({ovr:74,stats:calibrated},role)-74)<=1,`${role} generated stats stay aligned with displayed OVR`);
}
assert(P.performanceOverall(player('ATTACKER',90), 'ATTACKER')>P.performanceOverall(player('ATTACKER',55),'ATTACKER')+30,'higher OVR produces clearly higher performance');
assert.equal(P.roleSuitability(100,true),1);assert(P.roleSuitability(35)<P.roleSuitability(75));assert(P.effectiveRating(80,P.roleSuitability(35))>74,'emergency roles penalise execution without erasing player quality');
for(const rating of [0,30,40,50,60,75,99]){
  assert(P.effectiveRating(rating,.84)<=rating,'Unfamiliar positions never improve low-rated players');
  assert.equal(P.effectiveRating(rating,1),rating,'Natural positions preserve every rating band');
}

const base=player('ALL-ROUNDER',75),shoot=P.engineAttributes(player('ALL-ROUNDER',75,{SHO:95})),defend=P.engineAttributes(player('ALL-ROUNDER',75,{DEF:95}));
assert(shoot.shooting>P.engineAttributes(base).shooting+.08,'SHO materially raises live finishing');
assert(defend.interception>P.engineAttributes(base).interception+.08,'DEF materially raises live ball winning');
assert(P.engineAttributes({...base,morale:'Happy'}).decision>P.engineAttributes({...base,morale:'Very Happy'}).decision,'focused morale sweet spot beats complacency');
assert.equal(P.engineAttributes({...base,sharpness:100}).speed,P.engineAttributes({...base,sharpness:20}).speed,'sharpness does not manufacture pace');
assert(P.engineAttributes({...base,sharpness:100}).passing>P.engineAttributes({...base,sharpness:20}).passing,'sharpness changes technical execution');
assert.equal(P.engineAttributes({...base,fitness:100}).shooting,P.engineAttributes({...base,fitness:50}).shooting,'fitness does not manufacture finishing');
assert(P.engineAttributes({...base,fitness:100}).stamina>P.engineAttributes({...base,fitness:50}).stamina,'fitness changes physical match output');

const balanced=['ATTACKER','PLAYMAKER','DEFENDER'].map(r=>player(r,75)),unbalanced=['A','B','C'].map(id=>({...player('ATTACKER',75),id}));
const balancedProfile=P.teamProfile(balanced),unbalancedProfile=P.teamProfile(unbalanced);
assert(balancedProfile.defenceDelta>unbalancedProfile.defenceDelta+4,'a proper defender materially protects the team shape');
assert(balancedProfile.creationDelta>unbalancedProfile.creationDelta+2.5,'a proper playmaker materially improves creation');

for(const trait of T.catalog){
  const p={...player(trait.roles?.[0]||'ALL-ROUNDER',80),playingTraits:[trait.id]};
  const effects=T.expectedEffects(p),translated=['PAC','SHO','PAS','HAN','DEF','STA'].reduce((sum,key)=>sum+T.stat(p,key),0),impact=Object.values(effects).reduce((sum,n)=>sum+Math.abs(n),0)+translated+T.aura([p],true)+(1-T.energyMultiplier(p));
  assert(impact>0,`${trait.name} has a consumed live/sim effect`);
}
const trainingPlayer={fitness:95,sharpness:55,training:{plan:'intensive',mode:'manual'}};
const trained=Training.step(trainingPlayer,'2026-09-06',{baseRecovery:3.5,daysToMatch:4});
assert(trained.sharpness>trainingPlayer.sharpness&&trained.fitness<trainingPlayer.fitness,'training keeps a real fitness/sharpness trade-off');

assert(app.includes('performanceRules.teamProfile'),'quick simulation uses the shared model');
assert(app.includes('role=v44DeployedRoleFor(player,owner,fixture)'),'watched matches receive the deployed role');
assert(!/function developSeniorPlayer\(p\)[\s\S]{0,500}if\(p\.age<=20\)/.test(app),'season rollover no longer duplicates positive monthly growth');
assert(html.indexOf('player-performance.js')<html.indexOf('career-bootstrap.js'),'performance model loads before the career');
assert(manifest.includes("'player-performance.js'"),'performance model ships in builds');
console.log(JSON.stringify({status:'PASS',version:'V71',checks:16,roleWeights:P.ROLE_WEIGHTS,roleSuitability:{emergency:P.roleSuitability(35),comfortable:P.roleSuitability(75),natural:P.roleSuitability(85)},balancedProfile,unbalancedProfile,traitsVerified:T.catalog.length},null,2));
