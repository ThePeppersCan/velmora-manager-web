// Actual engine execution with a lightweight DOM/audio adapter. Not a browser playtest.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(process.env.VELMORA_AUDIT_ENGINE_PATH||path.join(root,'velmora-quidditch-engine.js'),'utf8');
function runtime(imageFailures=new Set()){
 const imageRequests=[];
 const nodes=new Map(),noop=()=>{},classes=()=>({add:noop,remove:noop,toggle:noop,contains:()=>false});
 function node(id=''){if(nodes.has(id))return nodes.get(id);const n={id,style:{setProperty:noop,removeProperty:noop},dataset:{},classList:classes(),hidden:false,children:[],textContent:'',innerHTML:'',setAttribute:noop,removeAttribute:noop,getAttribute:()=>null,addEventListener:noop,removeEventListener:noop,appendChild:noop,append:noop,prepend:noop,remove:noop,focus:noop,querySelector:s=>node(id+s),querySelectorAll:()=>[],getBoundingClientRect:()=>({width:1672,height:941}),getContext:()=>new Proxy({measureText:()=>({width:80}),createLinearGradient:()=>({addColorStop:noop})},{get:(o,k)=>o[k]||noop})};n.parentElement=n;n.parentNode=n;nodes.set(id,n);return n}
 class Image{constructor(){this.width=100;this.height=100;this.naturalWidth=100;this.naturalHeight=100;this.complete=true}set src(s){this._src=s;imageRequests.push(s);Promise.resolve().then(()=>imageFailures.has(s.split('?')[0])?this.onerror?.():this.onload?.())}get src(){return this._src}}
 class Audio{constructor(){this.paused=true;this.volume=0}play(){return Promise.resolve()}pause(){}addEventListener(){}removeEventListener(){}load(){}}
 const doc={getElementById:node,createElement:node,querySelector:s=>node(s),querySelectorAll:()=>[],addEventListener:noop,body:node('body'),head:node('head'),hidden:false};
 const window={addEventListener:noop,removeEventListener:noop,innerHeight:1000,innerWidth:1672,parent:{postMessage:noop}};
 let now=1000;const ctx=vm.createContext({console,window,document:doc,Image,Audio,performance:{now:()=>now},setTimeout:()=>1,clearTimeout:noop,setInterval:()=>1,clearInterval:noop,requestAnimationFrame:()=>1,cancelAnimationFrame:noop,ResizeObserver:class{observe(){}},URLSearchParams,location:{search:''},navigator:{userAgent:'engine-test'},Math,Date,Map,Set,Promise});
 vm.runInContext(fs.readFileSync(path.join(root,'player-performance.js'),'utf8'),ctx);
 vm.runInContext(fs.readFileSync(path.join(root,'player-traits.js'),'utf8'),ctx);
 const expose=`window.qa={v48LiveAttributes,v48RefreshTraits,v48TraitContext,state,chooseShotOutcome,executionSkill,performPass,updateFlight,steerEntity,attemptCarrierTackle,matchdayHandleEscape,applyFixtureConfig,initMatchday,createEntities,resetStats,completePrematch,matchdayShow,matchdayResume,matchdayHide,matchdayRequestSub,matchdayProcessPending,matchdayApplyTactics,matchdayReport,matchdayEnergyStep,simulateFixedStep,catchUpTo,beginHalftime,handleSecondHalf,skipCareerToFulltime,careerResultSnapshot,deliverCareerResult,entityById,teamEntities,disciplineCardDecision,disciplineApplyCard,disciplineSendOff,recordEvent,finalCareerGoalEvents,scorerSummary,renderMatchdayPanel,matchdayPlayerCard,localTargetElapsed,beginShootout};render=()=>{};\n`;
 vm.runInContext(source.replace('  window.VelmoraQuidditchEngine=',expose+'  window.VelmoraQuidditchEngine='),ctx);
 return {imageRequests,ctx,q:window.qa,engine:window.VelmoraQuidditchEngine,nodes,advanceClock:ms=>{now+=ms}};
}
function player(id,i){return {id,name:id,role:['ATTACKER','DEFENDER','PLAYMAKER'][i%3],standing:'standing.png',riding:'flying.webp',attributes:{stamina:.8,speed:.8},careerMeta:{ovr:70,fitness:90,form:'Good'}}}
function options(side='home',seed=123){return {careerMode:true,headless:true,disableAudio:true,homeName:'HOME CLUB',awayName:'AWAY CLUB',homePlayerData:[0,1,2].map(i=>player('H'+i,i)),awayPlayerData:[0,1,2].map(i=>player('A'+i,i)),homeBenchData:[3,4,5].map(i=>player('H'+i,i)),awayBenchData:[3,4,5].map(i=>player('A'+i,i)),managerSide:side,seed}}
async function open(opts=options()){const r=runtime();assert(await r.engine.open(opts),'Engine opens');return r}
function tickUntil(q,condition,max=60000){let n=0;while(!condition()&&n++<max)q.simulateFixedStep(1/30);assert(condition(),'Simulation reached requested state within guard')}
module.exports={runtime,options};
if(require.main===module)(async()=>{
 const r=await open(),q=r.q,s=q.state;q.completePrematch();
 assert.equal(r.engine.getStatus().playerCount,12);assert.equal(s.entities.length,6);
 tickUntil(q,()=>s.matchTime>=30);q.matchdayShow();const time=s.matchTime,elapsed=s.engineElapsed;r.advanceClock(120000);q.catchUpTo(elapsed+120);q.simulateFixedStep(1);assert.equal(s.matchTime,time);assert.equal(s.engineElapsed,elapsed);assert.equal(q.localTargetElapsed(),elapsed);
 assert(q.matchdayApplyTactics({defensive:'Press',attacking:'Direct',mentality:'Attacking'}));assert.equal(s.teamTactics.belros.profile.id,'DIRECT');
 assert(!q.matchdayRequestSub('A0','H3').ok,'Cannot manage opponent');assert(!q.matchdayRequestSub('H0','H1').ok,'Cannot bring on an active player');
 // Force a live-ball reference to establish that the queued path cannot replace it.
 s.ball.flight={t:0,dur:1};const queued=q.matchdayRequestSub('H0','H3');assert(queued.ok&&queued.queued);assert(q.entityById('H0'));assert(!q.entityById('H3'));assert(!q.matchdayRequestSub('H0','H4').ok);
 s.ball.flight=null;s.pendingPass=null;s.special=null;s.delay=null;s.celebration=null;s.replay=null;s.replayIntro=null;s.replayOutro=null;s.kickoffReceiver=null;s.carrier=q.entityById('H1');
 q.matchdayProcessPending();assert(q.entityById('H3'));assert(!q.entityById('H0'));assert.equal(q.teamEntities('belros').length,3);assert.equal(s.entities.length,6);assert(!q.matchdayRequestSub('H3','H0').ok,'No re-entry');
 assert(q.matchdayHandleEscape({key:'Escape',preventDefault(){},stopPropagation(){}}));assert(s.open,'Escape returns to the match, never aborts it');assert.equal(q.localTargetElapsed(),s.engineElapsed,'Resume rebases wall clock');
 tickUntil(q,()=>s.phase==='halftime');assert.equal(s.matchTime,135);assert(s.management.paused);assert.equal(q.matchdayReport().participation.H0.started,true);assert.equal(q.matchdayReport().participation.H3.started,false);
 const halfTime=s.engineElapsed;q.catchUpTo(halfTime+3600);assert.equal(s.engineElapsed,halfTime);assert.equal(s.phase,'halftime');
 assert(q.matchdayRequestSub('H1','H4').ok);assert(q.matchdayRequestSub('H2','H5').ok);assert.equal(s.management.events.filter(e=>e.team==='home').length,3);
 q.matchdayResume();tickUntil(q,()=>s.phase==='fulltime');assert.equal(s.matchTime,270);assert.equal(s.entities.length,6);
 const report=q.careerResultSnapshot();for(const team of ['home','away']){const minutes=Object.values(report.matchday.participation).filter(p=>p.team===team).reduce((n,p)=>n+p.minutes,0);assert(Math.abs(minutes-270)<.001,'Each team totals 270 player minutes')}
 assert(report.matchday.participation.H3.minutes>0);assert(report.matchday.participation.H4.minutes===45);assert(report.matchday.participation.H0.minutes<45);
 assert(report.matchday.substitutions.length<=6);
 // Dedicated goal history retains outgoing scorer identity after broadcast feed expires.
 s.playerStats.H0.goals=1;s.playerStats.H3.goals=1;q.recordEvent('goal',{player:'H0',playerId:'H0',team:'belros'},6);q.recordEvent('goal',{player:'H3',playerId:'H3',team:'belros'},6);for(let i=0;i<120;i++)q.recordEvent('tactic',{});const goals=q.finalCareerGoalEvents();assert(goals.some(e=>e.playerId==='H0'));assert(goals.some(e=>e.playerId==='H3'));assert(q.scorerSummary('belros').includes('H0'));
 const away=await open(options('away',456));away.q.completePrematch();away.q.beginHalftime();assert.equal(away.q.state.management.team,'zafran');assert(away.q.matchdayRequestSub('A0','A3').ok);assert(!away.q.matchdayRequestSub('H0','H3').ok);away.q.skipCareerToFulltime();assert.equal(away.q.state.phase,'fulltime');
 const depleted=await open({...options(),homeBenchData:[],awayBenchData:[]});depleted.q.skipCareerToFulltime();assert.equal(depleted.q.state.phase,'fulltime');assert.equal(depleted.q.state.management.events.length,0);
 const unused=await open(options());unused.q.skipCareerToFulltime();assert.equal(unused.q.matchdayReport().participation.H3.minutes,0);assert.equal(unused.q.matchdayReport().participation.H3.fitnessCost,0);
 let deliveries=0;unused.q.state.onCareerComplete=()=>deliveries++;unused.q.deliverCareerResult();unused.q.deliverCareerResult();await new Promise(resolve=>setImmediate(resolve));assert.equal(deliveries,1);
 // Force a tied knockout at regulation's end and execute the actual shootout.
 const ko=await open({...options(),knockoutDecider:true});ko.q.completePrematch();ko.q.state.phase='second';ko.q.state.matchTime=269.99;ko.q.state.score={belros:0,zafran:0};ko.q.state.special=null;ko.q.state.celebration=null;ko.q.simulateFixedStep(1/30);assert.equal(ko.q.state.phase,'shootout');ko.q.skipCareerToFulltime();assert.equal(ko.q.state.phase,'fulltime');assert(ko.q.careerResultSnapshot().shootoutWinner);
 // Equal starting energy and time: pressing must cost more than drop-back.
 const energy=await open(options());energy.q.matchdayApplyTactics({defensive:'Press'},'belros');energy.q.matchdayApplyTactics({defensive:'Drop Back'},'zafran');energy.q.matchdayEnergyStep(135);assert(energy.q.matchdayReport().participation.H0.energy<energy.q.matchdayReport().participation.A0.energy);
 console.log(JSON.stringify({status:'PASS',runtime:'Actual engine with DOM/audio adapter; no browser',checks:['12-player squad / six active entities','pause / heartbeat clock rebase / Escape resumes safely','live tactics / pressing energy cost','queued substitutions / no re-entry / ownership','halftime stop / two halves','natural and skipped full time','home and away management','depleted bench / unused substitute exclusion','270 player-minutes per team','outgoing scorer retained beyond feed expiry','single completion callback','knockout shootout']},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
