// Behavioral regressions for real career ratings and the engine integration boundary.
const assert=require('node:assert/strict'),vm=require('node:vm');
const {runtime}=require('./test_matchday_engine.cjs');
const {ctx,fn,player,opts}=require('./audit_player_quality.cjs');
const plain=value=>JSON.parse(JSON.stringify(value));
(async()=>{
 const lowBand=runtime();assert(lowBand.engine.attributesFromCareerPlayer({ovr:50,stats:{SHO:39}}).shooting>lowBand.engine.attributesFromCareerPlayer({ovr:50,stats:{SHO:35}}).shooting,'Lower league attributes retain differences below 40');
 const r=runtime(),o=opts();o.homeBenchData=[player('H',3,90)];
 // Raw career payloads must produce exactly the same technical attributes as the app adapter.
 for(const p of [...o.homePlayerData,...o.awayPlayerData,...o.homeBenchData])delete p.attributes;
 assert(await r.engine.open(o));const q=r.q,s=q.state;
 for(const info of r.engine.getPlayerQuality()){
   const p=[...o.homePlayerData,...o.awayPlayerData,...o.homeBenchData].find(p=>p.id===info.id);
   assert.equal(info.source,'career-stats');
   for(const [key,value] of Object.entries(ctx.v210PlayerAttributes(p)))assert.equal(info.attributes[key],value,key);
 }
 q.completePrematch();q.beginHalftime();const old=q.entityById('H0').attributes.shooting;
 assert(q.matchdayRequestSub('H0','H3').ok);assert(q.entityById('H3').attributes.shooting>old,'Incoming player brings their own shooting');
 assert.equal(q.entityById('H3').attributes.shooting,ctx.v210PlayerAttributes(o.homeBenchData[0]).shooting);
 await r.engine.close();
 // Migrated integrations can supply OVR only, but may not silently omit every quality field.
 const fallback=opts();for(const p of [...fallback.homePlayerData,...fallback.awayPlayerData]){delete p.attributes;delete p.stats;}
 assert(await r.engine.open(fallback));assert(r.engine.getPlayerQuality().every(p=>p.source==='overall-fallback'));await r.engine.close();
 const failures=[];const logger=r.ctx.console;r.ctx.console={...console,error:()=>{}};
 for(const bad of [{attributes:{},careerMeta:{},ovr:undefined,stats:undefined},{attributes:{shooting:90}},{attributes:undefined,stats:{SHO:'bad'}},{careerMeta:{fitness:Infinity}},{stats:{PAC:101}}]){
   const broken=opts();Object.assign(broken.homePlayerData[0],bad);assert.equal(await r.engine.open(broken),false);assert(r.engine.getStatus().lastOpenError);failures.push(r.engine.getStatus().lastOpenError);
 }
 r.ctx.console=logger;
 // Exercise the actual pass completion callback at a fixed reception point; no interception.
 const measured={};
 for(const stat of ['PAS','HAN'])for(const rating of [50,90]){
   const t=runtime();await t.engine.open(opts());const q=t.q,s=q.state;q.completePrematch();
   const from=q.entityById('H0');let completed=0;const trials=12000;
   for(let i=0;i<trials;i++){
     s.simRand=ctx.mulberry32(71000+i);s.zone=.5;s.ball.flight=null;s.pendingPass=null;s.carrier=from;s.possession='belros';s.special=null;s.delay=null;
     for(const [n,e] of s.entities.entries()){
       Object.assign(e,{x:e.team==='belros'?.3+n*.02:.9,y:e.team==='belros'?.5:.8,vx:0,vy:0,form:0});
       e.attributes=ctx.v210PlayerAttributes(player('T',0,75,stat==='PAS'&&e===from?{PAS:rating}:stat==='HAN'&&e.team==='belros'&&e!==from?{HAN:rating}:{}));
     }
     s.teamTactics.belros.memory.lanePressure={};s.teamTactics.belros.memory.hotPlayer=null;
     q.performPass();const flight=s.ball.flight;assert(flight?.meta?.kind==='pass');
     const receiver=flight.meta.receiver;s.ball.x=receiver.x;s.ball.y=receiver.y;s.ball.flight=null;
     const before=s.teamStats.belros.completed;flight.onDone();completed+=s.teamStats.belros.completed-before;
   }
   measured[stat+rating]={trials,completed};await t.engine.close();
 }
 for(const stat of ['PAS','HAN'])assert(measured[stat+'90'].completed>measured[stat+'50'].completed+100,stat+' improves actual reception outcomes');
 // Repeat actual tackle attempts from identical contact geometry and identical trial seeds.
 for(const stat of ['DEF','HAN'])for(const rating of [50,90]){
   const t=runtime();await t.engine.open(opts());const q=t.q,s=q.state;q.completePrematch();const defender=q.entityById('A0'),carrier=q.entityById('H0');let won=0;const trials=12000;
   for(let i=0;i<trials;i++){
     s.simRand=ctx.mulberry32(31000+i);s.ball.flight=null;s.special=null;s.delay=null;s.carrier=carrier;s.possession=carrier.team;
     Object.assign(carrier,{x:.5,y:.5,vx:0,vy:0,form:0});Object.assign(defender,{x:.55,y:.5,vx:0,vy:0,form:0});
     defender.attributes=ctx.v210PlayerAttributes(player('T',0,75,stat==='DEF'?{DEF:rating}:{}));carrier.attributes=ctx.v210PlayerAttributes(player('T',0,75,stat==='HAN'?{HAN:rating}:{}));
     won+=q.attemptCarrierTackle(defender,carrier);
   }
   measured['tackle'+stat+rating]={trials,won};await t.engine.close();
 }
 assert(measured.tackleDEF90.won>measured.tackleDEF50.won+150,'Defending improves ball winning');assert(measured.tackleHAN90.won<measured.tackleHAN50.won-150,'Handling protects the ball');
 const pace=opts();pace.homePlayerData[0]=player('H',0,75,{PAC:50,STA:50});pace.homePlayerData[1]=player('H',1,75,{PAC:90,STA:90});
 assert(await r.engine.open(pace));q.completePrematch();const low=q.entityById('H0'),high=q.entityById('H1');assert(high.maxSpeed>low.maxSpeed*1.10,'Pace changes the movement envelope');q.matchdayEnergyStep(135);
 assert(s.management.players.H1.energy>s.management.players.H0.energy+2,'Stamina preserves energy at equal workload');await r.engine.close();
 // Each advertised stat must affect the expected score, independently of OVR.
 const home={id:'H'},away={id:'A'},squads={H:[0,1,2].map(i=>player('H',i,75)),A:[0,1,2].map(i=>player('A',i,75))};
 Object.assign(ctx,{activeStarters:c=>squads[c.id],backgroundClubStrength:()=>75,v44FixtureClubStrength:()=>75,v44DeployedRoleFor:p=>p.role,v44RoleSuitabilityModifier:()=>1,matchMoraleModifier:()=>0,matchFitnessModifier:()=>0,v23TeamSharpness:()=>0,currentClub:home,userTacticalModifier:()=>0});
 for(const name of ['v24PlayerStat','v24TeamProfile','v24ExpectedGoals','v24ScorerWeight','weightedScorer'])vm.runInContext(fn(name),ctx);
 const baseline=plain(ctx.v24ExpectedGoals(home,away));
 for(const stat of ['PAC','PAS','SHO','HAN','DEF','STA']){
   for(const p of squads.H)p.stats[stat]=95;const better=plain(ctx.v24ExpectedGoals(home,away));
   if(stat==='DEF')assert(better.away<baseline.away,stat);else assert(better.home>baseline.home,stat);
   if(stat!=='SHO')assert(better.away<baseline.away,stat+' contributes defensively');
   for(const p of squads.H)p.stats[stat]=75;
 }
 assert.deepEqual(plain(ctx.v24ExpectedGoals(home,away,true)),baseline,'Same quality model for user and background sims with neutral tactics');
 // Actual weighted scorer selection, same role and OVR; better shooting must be selected more often.
 squads.H=[player('H',0,75,{SHO:50}),player('H',1,75,{SHO:90})];squads.H.forEach(p=>p.role='ATTACKER');const rng=ctx.mulberry32(809),scorers={H0:0,H1:0};for(let i=0;i<12000;i++)scorers[ctx.weightedScorer(home,rng).id]++;assert(scorers.H1>scorers.H0*1.5);
 console.log(JSON.stringify({status:'PASS',runtime:'Actual match engine and app functions, DOM/audio adapter',checks:['raw stats match career adapter','substitute retains individual attributes','explicit OVR fallback','missing and malformed quality rejected','passing and handling improve receptions','defending wins tackles and handling resists them','pace changes speed and stamina preserves energy','all six stats affect simulation independently of OVR','shared quality model for user/background sims','shooting affects scorer selection'],measured,scorers,rejectedPayloads:failures},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
