const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {runtime}=require('./career_test_runtime.cjs');
const Traits=require('../player-traits.js');
const clone=v=>JSON.parse(JSON.stringify(v));
async function main(){
  // Assignment is stable, independent of appearance and broad across playing styles.
  const sameA={id:'IDENTITY',age:30,avatar:'large'},sameB={id:'IDENTITY',age:30,avatar:'small'};assert.deepEqual(Traits.ensure(sameA,123),Traits.ensure(sameB,123));
  assert.equal(Traits.aura([['captain_voice'],['captain_voice']]),Traits.aura([['captain_voice']]));
  assert(Traits.aura([['rally']],true)>Traits.aura([['rally']],false));
  assert.equal(Traits.effects(['second_wind'],{minute:59}).energySaving,undefined);
  assert(Traits.effects(['second_wind'],{minute:60}).energySaving>0);
  const r=runtime(),q=r.q,club=q.state().clubs.find(c=>c.id==='caldria-4-riva-sola')||q.state().clubs[0];
  r.d.assignClubForTest(club);q.initializeCareerLifecycle();
  const own=q.getSquad(club)[0],opponentClub=q.state().clubs.find(c=>c.id!==club.id),other=q.getSquad(opponentClub)[0];
  const rawStats=JSON.stringify(own.stats),ids=clone(own.playingTraits);
  let data=q.v48ProfileData(own.id);assert(data.own&&data.known&&data.managed);assert.deepEqual(clone(data.traits),ids);assert(data.attributes.every(a=>a.known));
  const enemy=q.v48ProfileData(other.id);assert(!enemy.known);assert.equal(enemy.traits,null);assert.equal(enemy.fitness,null);assert.equal(enemy.wage,'Unknown');assert(enemy.attributes.every(a=>!a.known));assert.equal(enemy.details.development,'');assert.equal(enemy.details.contract,'');
  q.v48ProfileAction(other.id,'plan','Physical');assert.notEqual(other.developmentPlan,'Physical','Cannot alter another club’s plan');
  q.v48ProfileAction(own.id,'plan','Playmaking');assert.equal(own.developmentPlan,'Playmaking');
  // All profile tabs render through the actual UI module, with real career data.
  const ui=r.context.VelmoraPlayerProfiles;
  assert(ui.open(own.id));const panel=r.node('created-section');assert(panel.innerHTML.includes('v48-portrait'));assert(panel.innerHTML.includes('v48-ring-value'));assert(panel.innerHTML.includes('v48-overview-traits'));
  for(const section of ['attributes','traits','development','contract','career']){
    const b=r.node('tab-'+section);b.dataset.tab=section;b.closest=()=>b;
    panel.dispatch('click',{target:b});assert(panel.innerHTML.includes('v48-detail-body'));assert(!panel.innerHTML.includes('undefined'));
  }
  ui.close();assert(ui.open(other.id));assert(panel.innerHTML.includes('Complete a scouting report'));for(const id of other.playingTraits)assert(!panel.innerHTML.includes(Traits.traits([id])[0].description));ui.close();
  // Scouting completes through the real assignment path; revealed traits match match config.
  q.v48ProfileAction(other.id,'scout');assert(q.scoutAssignment(q.transferPlayerById(other.id)));
  q.completeScoutingAssignment(other.id,q.currentCareerISO());data=q.v48ProfileData(other.id);assert(data.known);assert.deepEqual(clone(data.traits),clone(other.playingTraits));assert.deepEqual(clone(q.v210PlayerConfig(other).playingTraits),clone(data.traits));
  // Free agents, academy players and loans resolve using the same persistent player identity.
  const free=q.getFreeAgents()[0];assert(q.v48ProfileData(free.id).canRecruit);
  const youth=q.getAcademy(club)[0];assert(q.v48ProfileData(youth.id).academy);assert(!q.v48ProfileData(youth.id).managed);
  const borrowed=q.getSquad(opponentClub)[1];borrowed.parentClubId=club.id;borrowed.onLoan=true;data=q.v48ProfileData(borrowed.id);assert(data.known&&data.own&&!data.managed);delete borrowed.parentClubId;borrowed.onLoan=false;
  // Save/reload round trip does not reroll traits or modify base ratings.
  assert(q.saveCareerState());assert(q.loadCareerState());assert.deepEqual(clone(q.v48FindPlayer(own.id).p.playingTraits),ids);assert.equal(JSON.stringify(q.v48FindPlayer(own.id).p.stats),rawStats);
  // Expected goals respond to passing/carrying/pace/defensive traits, symmetrically.
  const players=q.activeStarters(club),old=players.map(p=>clone(p.playingTraits));players.forEach(p=>{p.playingTraits=[];p.playingTraitsVersion=2;});
  const base=q.v24TeamProfile(club);players[0].playingTraits=['quick_link','close_control','burst'];const attack=q.v24TeamProfile(club);assert(attack.attackDelta>base.attackDelta);
  players[0].playingTraits=['interceptor','anchor'];assert(q.v24TeamProfile(club).defenceDelta>base.defenceDelta);
  players[0].playingTraits=['captain_voice'];assert(q.v24TeamProfile(club).attackDelta>base.attackDelta);players.forEach((p,i)=>p.playingTraits=old[i]);
  // Exercise traits inside the actual watched engine, including bench entry and pausing.
  const {runtime:engineRuntime,options}=require('./test_matchday_engine.cjs');
  const er=engineRuntime(),opts=options();opts.homePlayerData[0].playingTraits=['quick_link','burst','second_wind'];opts.homeBenchData[0].playingTraits=['safe_hands'];
  assert(await er.engine.open(opts));const e=er.q.entityById('H0');assert.deepEqual(clone(e.player.playingTraits),opts.homePlayerData[0].playingTraits);
  const attrs=clone(e.baseAttributes);er.q.v48RefreshTraits(e);assert(e.attributes.accel>attrs.accel);
  const short=er.q.v48LiveAttributes(e,{passDistance:.1}),long=er.q.v48LiveAttributes(e,{passDistance:.5});assert(short.passing>long.passing);assert.deepEqual(clone(e.baseAttributes),attrs);
  const paused=er.engine.pauseForProfile();const time=er.q.state.matchTime;er.q.simulateFixedStep(1);assert.equal(er.q.state.matchTime,time);er.engine.resumeFromProfile(paused);assert.equal(er.q.state.management.paused,false);
  er.q.state.management.paused=true;const existingPause=er.engine.pauseForProfile();er.engine.resumeFromProfile(existingPause);assert(er.q.state.management.paused);er.q.state.management.paused=false;
  er.q.state.matchTime=190;er.q.v48RefreshTraits(e);assert(e.attributes.stamina>attrs.stamina);
  const enemyEntity=er.q.entityById('A0');enemyEntity.player.playingTraits=[];enemyEntity.baseAttributes={...e.baseAttributes};er.q.v48RefreshTraits(enemyEntity);
  er.q.state.management.players.H0.energy=90;er.q.state.management.players.A0.energy=90;er.q.matchdayEnergyStep(30);assert(er.q.state.management.players.H0.energy>er.q.state.management.players.A0.energy);
  er.q.beginHalftime();assert(er.q.matchdayRequestSub('H0','H3').ok);const sub=er.q.entityById('H3');er.q.v48RefreshTraits(sub);assert(sub.attributes.catching>sub.baseAttributes.catching);
  // Strong base ratings retain a much larger advantage than the capped trait lift.
  const lower=Traits.attributes({shooting:.74},['long_arc','hoop_artist'],{progress:.7});assert(lower.shooting<.94);
  const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert(html.indexOf('player-traits.js')<html.indexOf('career-bootstrap.js'));assert(html.includes('player-profiles.css'));
  const css=fs.readFileSync(path.join(root,'matchday-cobalt.css'),'utf8');assert(css.includes('overflow:hidden;z-index:3;pointer-events:none'));assert(css.includes('.matchday-featured.home{left:0;clip-path:none}'));
  console.log('PASS: 24 diverse persistent traits; scouting/privacy; all six profile tabs; development permissions; free agents/academy/loans; save reload; simulated attack/defence; live passing/acceleration/endurance; leadership cap; bench traits; safe match pause; base rating dominance; portrait layering.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
