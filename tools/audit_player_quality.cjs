// Controlled comparisons on the actual career adapter, match engine and simulation functions.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const {runtime,options}=require('./test_matchday_engine.cjs'),root=path.resolve(__dirname,'..');
const source=fs.readFileSync(process.env.VELMORA_AUDIT_APP_PATH||path.join(root,'app.js'),'utf8');
function fn(name){const start=source.indexOf('  function '+name+'(');assert(start>=0,name);const line=source.indexOf('\n',start);return source.slice(start,source.slice(start,line).endsWith('}')?line:source.indexOf('\n  }',line)+4)}
const traitRules=require('../player-traits.js');
const ctx=vm.createContext({console,Math,Number,Map,Set,trainingRules:require('../training.js'),performanceRules:require('../player-performance.js'),window:{VelmoraTraits:traitRules},v49EnsureTraits:p=>{if(!Array.isArray(p.playingTraits))p.playingTraits=[];return p.playingTraits;}});
for(const name of ['clamp','hashString','mulberry32','v210EngineStat','v210PlayerAttributes'])vm.runInContext(fn(name),ctx);
function player(side,index,rating,statOverrides={}){const p={id:side+index,name:side+index,role:['ATTACKER','PLAYMAKER','DEFENDER'][index%3],ovr:rating,stats:{PAC:rating,PAS:rating,SHO:rating,HAN:rating,DEF:rating,STA:rating,...statOverrides},fitness:100,sharpness:70,form:'Average',morale:'Content'};return {...p,standing:'standing.png',riding:'flying.webp',attributes:ctx.v210PlayerAttributes(p),careerMeta:{ovr:rating,fitness:100,sharpness:70,form:'Average',morale:'Content'}}}
function opts(home=75,away=75,seed=1){return {...options('home',seed),homeName:'HOME',awayName:'AWAY',homePlayerData:[0,1,2].map(i=>player('H',i,home)),awayPlayerData:[0,1,2].map(i=>player('A',i,away)),homeBenchData:[],awayBenchData:[],homeTactics:{defensive:'Balanced',attacking:'Balanced',mentality:'Balanced'},awayTactics:{defensive:'Balanced',attacking:'Balanced',mentality:'Balanced'}}}
function aggregate(){return {matches:0,wins:0,draws:0,losses:0,goalsFor:0,goalsAgainst:0,shots:0,opponentShots:0,passes:0,completed:0,opponentPasses:0,opponentCompleted:0}}
function record(out,r,side){const a=side==='home'?r.homeScore:r.awayScore,b=side==='home'?r.awayScore:r.homeScore,other=side==='home'?'away':'home';out.matches++;out[a>b?'wins':a<b?'losses':'draws']++;out.goalsFor+=a;out.goalsAgainst+=b;out.shots+=r.teamStats[side].shots;out.opponentShots+=r.teamStats[other].shots;out.passes+=r.teamStats[side].passes;out.completed+=r.teamStats[side].completed;out.opponentPasses+=r.teamStats[other].passes;out.opponentCompleted+=r.teamStats[other].completed}
module.exports={ctx,fn,player,opts};
if(require.main===module)(async()=>{
 const report={runtime:'Actual engine with DOM/audio adapter; simulation functions extracted from actual app',liveFixtures:[],micro:{}};
 const micro=runtime();await micro.engine.open(opts());const q=micro.q,s=q.state,shooter=q.entityById('H0');s.zone=.85;shooter.x=.7;shooter.y=.5;shooter.vx=0;shooter.vy=0;for(const d of q.teamEntities('zafran')){d.x=.4;d.y=.3}
 const shots=50000;
 for(const penalty of [false,true])for(const rating of [50,90]){
   shooter.attributes=ctx.v210PlayerAttributes({ovr:75,stats:{SHO:rating},sharpness:70,morale:'Content',form:'Average'});s.simRand=ctx.mulberry32(12345);
   const counts={goal:0,save:0,post:0,miss:0};for(let i=0;i<shots;i++)counts[q.chooseShotOutcome(shooter,penalty)]++;
   report.micro[(penalty?'penalty':'openPlay')+rating]={attempts:shots,...counts};
 }
 report.micro.attributes50=player('H',0,50).attributes;report.micro.attributes90=player('H',0,90).attributes;await micro.engine.close();
 const count=Number(process.env.VELMORA_AUDIT_PAIRS||16);
 for(const ratings of (process.env.VELMORA_AUDIT_SCENARIOS||'90:55').split(',')){
 const [strong,weak]=ratings.split(':').map(Number),mixed=aggregate();
 for(let i=0;i<count;i++)for(const side of ['home','away']){
   const r=runtime();await r.engine.open(opts(side==='home'?strong:weak,side==='away'?strong:weak,901+i*13));r.q.skipCareerToFulltime();assert.equal(r.q.state.phase,'fulltime');const result=r.q.careerResultSnapshot();record(mixed,result,side);await r.engine.close();
   if(mixed.matches%8===0)process.stderr.write(`Completed ${mixed.matches}/${count*2} live fixtures (${ratings})\n`);
 }
 report.liveFixtures.push({scenario:`${strong} versus ${weak} across all six attributes, identical tactics/fitness/sharpness, home and away`,...mixed});
 }
 // Raw simulation quality: fixed lineup, discipline and world effects disabled,
 // actual score-generating function. Friendlies bypass season-stat bookkeeping.
 const squads={},home={id:'H'},away={id:'A'};let currentFixture;
 Object.assign(ctx,{worldSeed:'QUALITY-AUDIT',currentClub:home,clubs:[home,away],getSquad:c=>squads[c.id],activeStarters:c=>squads[c.id],aiTacticalCohesionModifier:()=>0,moraleIndex:()=>2,prepareAiLineupForFixture:()=>{},fixtureClubs:()=>({home,away}),v44DeployedRoleFor:p=>p.role,v44RoleSuitabilityModifier:()=>1,v44FixtureClubStrength:c=>squads[c.id].reduce((sum,p)=>sum+Number(p.ovr||60),0)/squads[c.id].length,resolveChampionsCrownDecider:()=>{},v202MarkCompetitionDataDirty:()=>{},applyBackgroundMatchEffects:()=>{},ensurePlayerCareerMeta:()=>{},championsCrownAfterFixture:()=>{}});
 for(const name of ['v24PlayerStat','v24TeamProfile','v24ExpectedGoals','v24ScorerWeight','matchMoraleModifier','matchFitnessModifier','backgroundClubStrength','v44FixtureClubStrength','backgroundGoals','v23TeamSharpness','weightedScorer','simulateBackgroundFixture'])if(source.includes('  function '+name+'('))vm.runInContext(fn(name),ctx);
 Object.assign(ctx,{v37CaptureSelectionEligibility:()=>{},disciplineServingSnapshot:()=>[],disciplineSimulatedEvents:()=>[],disciplineRedImpact:()=>0,disciplineServeFixtureForClub:()=>{},disciplineApplyEvents:()=>{}});
 const sims=[];
 for(const settings of [{name:'OVR 75 v 75 control',strong:75,weak:75},{name:'OVR 80 v 70',strong:80,weak:70},{name:'OVR 90 v 55',strong:90,weak:55},{name:'Same OVR 75; all attributes 90 v 50',strong:75,weak:75,stats:true}]){
  let wins=0,draws=0,losses=0,gf=0,ga=0,identical=0;const total=4000;
  for(let i=0;i<total;i++){
   const side=i%2===0?'H':'A',other=side==='H'?'A':'H';squads[side]=[0,1,2].map(n=>({...player(side,n,settings.strong,settings.stats?{PAC:90,PAS:90,SHO:90,HAN:90,DEF:90,STA:90}:{}),seasonStats:{goals:0}}));squads[other]=[0,1,2].map(n=>({...player(other,n,settings.weak,settings.stats?{PAC:50,PAS:50,SHO:50,HAN:50,DEF:50,STA:50}:{}),seasonStats:{goals:0}}));
   currentFixture={fixtureId:'SIM-'+i,homeClubId:'H',awayClubId:'A',date:'2026-09-01',type:'FRIENDLY'};ctx.simulateBackgroundFixture(currentFixture);const a=side==='H'?currentFixture.homeScore:currentFixture.awayScore,b=side==='H'?currentFixture.awayScore:currentFixture.homeScore;wins+=a>b;draws+=a===b;losses+=a<b;gf+=a;ga+=b;
   if(settings.stats){for(const list of Object.values(squads))for(const p of list)for(const key of Object.keys(p.stats))p.stats[key]=75;const same={...currentFixture,played:false};ctx.simulateBackgroundFixture(same);if(same.homeScore===currentFixture.homeScore&&same.awayScore===currentFixture.awayScore)identical++;}
  }
  sims.push({scenario:settings.name,matches:total,wins,draws,losses,goalsFor:gf,goalsAgainst:ga,identicalToEqualAttributes:settings.stats?identical:undefined});
 }
 report.simulation=sims;
 assert(Math.abs(sims[0].wins-sims[0].losses)<sims[0].matches*.05,'Equal teams remain balanced across venues');
 assert(sims[1].wins>sims[1].losses*2,'Ten rating points produce a clear advantage');
 assert(sims[2].wins>sims[1].wins,'Larger quality gap increases the win rate');
 assert(sims[3].wins>sims[3].losses*2,'Attributes matter independently of displayed OVR');
 assert(report.micro.openPlay90.goal>report.micro.openPlay50.goal,'SHO improves open-play finishing');
 assert(report.micro.penalty90.goal>report.micro.penalty50.goal,'SHO improves penalties');
 if(count>=16)for(const row of report.liveFixtures){if(!row.scenario.startsWith('75 versus 75'))assert(row.wins>row.losses&&row.goalsFor>row.goalsAgainst,'Live quality advantage: '+row.scenario);}
 report.status='PASS';
 console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
