// Shared-model behavior and actual career hooks. No browser rendering claims.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),T=require('../training.js'),P=require('../player-performance.js'),app=fs.readFileSync(path.join(root,'app.js'),'utf8');
function fn(name){const start=app.indexOf('  function '+name+'(');assert(start>=0,name);const line=app.indexOf('\n',start);return app.slice(start,app.slice(start,line).endsWith('}')?line:app.indexOf('\n  }',line)+4)}
const player=(extra={})=>({id:'p',name:'Test rider',role:'ATTACKER',age:22,ovr:75,fitness:85,sharpness:50,morale:'Happy',training:{mode:'manual',plan:'balanced'},...extra});
const clone=v=>JSON.parse(JSON.stringify(v));
const checks=[];
// Same daily input must show the meaningful schedule trade-off.
const outputs=Object.keys(T.plans).map(plan=>T.step(player({training:{mode:'manual',plan}}),'2026-09-02',{baseRecovery:4,daysToMatch:5}));
assert.deepEqual(outputs.map(x=>x.fitness),[92,89,85,83]);assert.deepEqual(outputs.map(x=>x.sharpness),[48,49.5,54,57]);checks.push('four distinct recovery/sharpness trade-offs');
const exhausted=player({fitness:59,training:{mode:'manual',plan:'intensive'}});assert.equal(T.step(exhausted,'2026-09-02',{daysToMatch:4}).plan,'recovery');
assert.equal(T.step(player({training:{mode:'manual',plan:'intensive'}}),'2026-09-02',{daysToMatch:0}).plan,'matchday');
assert.equal(T.step(player({injured:true,injuryDaysRemaining:3}),'2026-09-02',{daysToMatch:0}).plan,'medical');checks.push('fatigue protection, matchday taper and medical priority');
const auto={preferences:{automatic:true,targetFitness:85,targetSharpness:75},daysToMatch:6};
assert.equal(T.effectivePlan(player({fitness:95,training:{mode:'team'}}),auto),'intensive');
assert.equal(T.effectivePlan(player({fitness:70,training:{mode:'team'}}),auto),'recovery');
assert.equal(T.effectivePlan(player({fitness:95,training:{mode:'team'}}),{...auto,daysToMatch:1}),'balanced');
assert.equal(T.effectivePlan(player({fitness:95,training:{mode:'manual',plan:'recovery'}}),auto),'recovery');
assert.equal(T.effectivePlan(player({fitness:95,training:{mode:'manual',plan:'recovery'}}),{...auto,ai:true}),'intensive');checks.push('assistant adapts daily; manual overrides persist; AI manages its own schedules');
const migrated={id:'old',fitness:0,sharpness:'bad',training:{plan:'invalid',mode:'bad',custom:'preserve'}};T.ensure(migrated);assert.equal(migrated.sharpness,70);assert.equal(migrated.training.plan,'balanced');assert.equal(migrated.training.custom,'preserve');assert.equal(migrated.fitness,0);assert.equal(T.read({training:{plan:'__proto__'}}).plan,'balanced');
assert.equal(T.preferences({}).automatic,false);assert.equal(T.preferences({targetFitness:1}).targetFitness,75);assert.deepEqual(clone(migrated),migrated);checks.push('legacy migration, malformed fields and zero fitness');
// Forecast uses copies, exact recovery rules, and the same assistant decisions.
for(const injured of [false,true])for(const automatic of [false,true])for(const plan of Object.keys(T.plans)){
 const p=player({fitness:83,injured,injuryDaysRemaining:injured?3:0,training:{mode:automatic?'team':'manual',plan}}),snapshot=clone(p);
 const opts={preferences:{automatic},recoveryForDate:d=>2+Number(d.slice(-2))%4};
 const forecast=T.project(p,'2026-09-01','2026-09-08',opts);assert.deepEqual(p,snapshot);
 const live=clone(p);
 for(let i=1;i<=7;i++){const date=T.addDays('2026-09-01',i),medical=T.medical(live);T.applyDay(live,date,{...opts,daysToMatch:7-i,baseRecovery:opts.recoveryForDate(date)});if(medical){live.injuryDaysRemaining=Math.max(0,live.injuryDaysRemaining-1);if(!live.injuryDaysRemaining)live.injured=false;}}
 assert.equal(live.fitness,forecast.fitness);assert.equal(live.sharpness,forecast.sharpness);assert.equal(live.injured,forecast.player.injured);
 const saved=clone(live);assert(!T.applyDay(live,'2026-09-08',opts).applied);assert.deepEqual(live,saved);assert(!T.applyDay(live,'2026-09-07',opts).applied);
}
checks.push('forecast purity and exact daily parity for 16 medical/manual/assistant scenarios; duplicate-day guards');
const max=player({fitness:100,sharpness:100});for(let i=1;i<366;i++){T.applyDay(max,T.addDays('2026-09-01',i),{daysToMatch:8,baseRecovery:4});assert(max.fitness>=0&&max.fitness<=100&&max.sharpness>=0&&max.sharpness<=100)}
for(const minutes of [0,15,45,90]){const p=player({sharpness:70});T.applyMatch(p,'F1','2026-09-01',minutes);assert.equal(p.sharpness,minutes?70+3+minutes*.1:69);const saved=clone(p);assert(!T.applyMatch(p,'F1','2026-09-01',minutes));assert.deepEqual(p,saved)}checks.push('year-long bounds; actual minutes; unused bench exclusion; duplicate-match guard');
assert(T.matchModifier(player({sharpness:10}))<T.matchModifier(player({sharpness:90})));assert.equal(T.matchModifier({}),0);assert.equal(T.technicalModifier({}),0);
const suspended=player({suspended:true,fitness:95});assert.notEqual(T.effectivePlan(suspended,auto),'medical');const suspendedForecast=T.project(suspended,'2026-09-01','2026-09-03',auto);assert(!suspendedForecast.available);assert(T.recommendation(suspended,suspendedForecast).copy.includes('unavailable'));
assert(!T.project(player({injured:true}),'2026-09-01','2026-09-10',auto).available,'An unknown medical return date is not invented');
checks.push('neutral migration, bounded match effects, unknown medical return and suspension-aware advice');
// Actual application functions, including daily injury recovery and saved preferences.
const home={id:'H'},away={id:'A'},squads={H:[player({clubId:'H',injured:true,injuryDaysRemaining:2})],A:[player({id:'a',clubId:'A',fitness:90})]};
let date='2026-09-01',saveCount=0;
const fixtures=[{fixtureId:'F1',date:'2026-09-05',homeClubId:'H',awayClubId:'A',played:false}];
const tacticValues={defensive:['Balanced','Press','Drop Back'],attacking:['Balanced','Fast Break','Possession','Direct'],mentality:['Defensive','Balanced','Attacking'],width:['Compact','Balanced','Wide'],tempo:['Patient','Balanced','Urgent'],freedom:['Structured','Balanced','Fluid']};
const tacticPlans={primary:{id:'primary',name:'PRIMARY',tactics:{defensive:'Balanced',attacking:'Balanced',mentality:'Balanced',width:'Balanced',tempo:'Balanced',freedom:'Balanced'}},chase:{id:'chase',name:'CHASE GAME',tactics:{defensive:'Press',attacking:'Direct',mentality:'Attacking',width:'Wide',tempo:'Urgent',freedom:'Fluid'}},protect:{id:'protect',name:'PROTECT LEAD',tactics:{defensive:'Drop Back',attacking:'Possession',mentality:'Defensive',width:'Compact',tempo:'Patient',freedom:'Structured'}}};
const ctx=vm.createContext({console,window:{},trainingRules:T,performanceRules:P,careerExpansion:null,V96_TACTIC_VALUES:tacticValues,V96_DEFAULT_TACTICAL_PLANS:tacticPlans,v45NormalizeReleaseGrade:()=>({version:1,quickAccess:['squad','shortlist','calendar'],taskControls:{dismissed:{},snoozed:{},tracked:{}}}),clubs:[home,away],fixtures,currentClub:home,employmentStatus:'employed',careerPreferences:{training:{automatic:true},trainingFocus:'Rest'},worldSeed:'TRAINING',getSquad:c=>squads[c.id],activeStarters:c=>squads[c.id],currentCareerISO:()=>date,diffDaysISO:T.daysBetween,addDaysISO:T.addDays,addCareerInboxMessage:()=>{},scheduleCalendarEvent:()=>{},saveCareerState:()=>{saveCount++;return true},showToast:()=>{}});
for(const name of ['clamp','hashString','mulberry32','v96NormalizeTactics','v96NormalizeTacticalPlans','normalizeCareerPreferences','v23UpcomingFixtures','v23TrainingOptions','deterministicDailyRecovery','processDailyPlayerUpdates','v23ApplyMatchReadiness','v23TeamSharpness','v210EngineStat','v210PlayerAttributes','v23SetTrainingPlayer','v23SetTrainingPreference'])vm.runInContext(fn(name),ctx);
ctx.processDailyPlayerUpdates('2026-09-02');assert.equal(squads.H[0].injuryDaysRemaining,1);const savedDay=clone(squads.H[0]);ctx.processDailyPlayerUpdates('2026-09-02');assert.deepEqual(squads.H[0],savedDay);ctx.processDailyPlayerUpdates('2026-09-03');assert.equal(squads.H[0].injured,false);assert.equal(squads.H[0].fitness,85);
const prefs=ctx.normalizeCareerPreferences({training:{automatic:true,targetFitness:90,targetSharpness:80},trainingFocus:'Rest',tactics:{attacking:'Direct'}});assert.equal(prefs.training.targetFitness,90);assert.equal(prefs.training.automatic,true);assert.equal(prefs.trainingFocus,'Rest');assert.equal(prefs.tactics.attacking,'Direct');assert.deepEqual(clone(ctx.normalizeCareerPreferences(clone(prefs))),clone(prefs));
ctx.v23SetTrainingPlayer('p','recovery');assert.equal(squads.H[0].training.mode,'manual');ctx.v23SetTrainingPreference('automatic',false);ctx.v23SetTrainingPreference('automatic',true);assert.equal(squads.H[0].training.plan,'recovery');ctx.v23SetTrainingPlayer('p','team');assert.equal(squads.H[0].training.mode,'team');assert(saveCount===4);assert.equal(ctx.v23SetTrainingPlayer('not-owned','intensive'),false);
const low=ctx.v210PlayerAttributes(player({sharpness:20})),high=ctx.v210PlayerAttributes(player({sharpness:90}));assert(high.passing>low.passing);assert(high.shooting>low.shooting);assert(high.decision>low.decision);assert.equal(high.speed,low.speed);assert.equal(high.stamina,low.stamina);assert(ctx.v210PlayerAttributes(player({morale:'Happy'})).passing>ctx.v210PlayerAttributes(player({morale:'Unhappy'})).passing);
checks.push('actual career daily hooks, medical countdown idempotence, preference normalization and round trips, owned-player controls, live technical attributes and career morale vocabulary');
// No hidden development or lineup mutation from a forecast or schedule choice.
assert(!app.includes('Training remains intentionally lightweight'));assert(app.includes('matchFitnessModifier(home)+v23TeamSharpness(home)'));assert(app.includes('v24ExpectedGoals(home,away,false,fixture)'));assert(app.includes('v24ExpectedGoals(home,away,true,fixture)'));
checks.push('both user and background simulation routes include sharpness');
console.log(JSON.stringify({status:'PASS',checks},null,2));
