// Real save/load and training events using the same complete app adapter as career tests.
const assert=require('node:assert/strict');
const {runtime}=require('./career_test_runtime.cjs');
const {context,q,local,node}=runtime();
const D=context.VELMORA_MANAGER_DEBUG,Q=q;assert(D&&Q,'Full app boots');
const club=context.VELMORA_CLUBS.find(c=>c.id==='redwick');D.assignClubForTest(club);Q.initializeCareerLifecycle();
const initial=Q.v23TrainingData(),p=initial.rows[0].player,playerId=p.id,lineupBefore=JSON.stringify(Q.ensureLineup(club));
assert(initial.rows.length>6);assert(initial.rows.filter(r=>r.starter).length===3);assert(initial.rows.filter(r=>r.bench).length===3);
Q.v23SetTrainingPlayer(playerId,'drills');Q.v23SetTrainingPreference('automatic',true);Q.v23SetTrainingPreference('targetFitness',90);p.sharpness=42.5;assert(Q.saveCareerState());
const saveKey='velmora-manager-career-v32-slot-1',saved=JSON.parse(context.VelmoraSaveCodec.decode(local.get(saveKey)));assert(saved.version>=78);assert.equal(saved.careerPreferences.training.targetFitness,90);assert.equal(saved.squads[club.id].find(x=>x.id===playerId).sharpness,42.5);
p.sharpness=99;p.training.plan='recovery';assert(Q.loadCareerState());const loaded=Q.v23TrainingData(),again=loaded.rows.find(r=>r.player.id===playerId).player;assert.equal(again.sharpness,42.5);assert.equal(again.training.plan,'drills');assert.equal(again.training.mode,'manual');assert.equal(loaded.preferences.automatic,true);assert.equal(loaded.preferences.targetFitness,90);assert.equal(JSON.stringify(Q.ensureLineup(club)),lineupBefore);
// Legacy migration through the real serializer/deserializer, preserving clubs and fixtures.
const legacy=JSON.parse(context.VelmoraSaveCodec.decode(local.get(saveKey)));delete legacy.careerPreferences.training;for(const squad of Object.values(legacy.squads))for(const p of squad){delete p.training;delete p.sharpness;}legacy.version=73;local.set(saveKey,JSON.stringify(legacy));assert(Q.loadCareerState());const migrated=Q.v23TrainingData();assert.equal(migrated.preferences.automatic,false);assert(migrated.rows.every(r=>r.state.sharpness===70&&r.state.plan==='balanced'));assert.equal(migrated.next.opponent,loaded.next.opponent);
// Render actual HTML and dispatch the real change/click handlers; no progression on render.
const container=node('squadTrainingContent'),before=JSON.stringify(Q.getSquad(club));Q.v23RenderTraining();assert(container.innerHTML.includes('Ready for'));assert(container.innerHTML.includes('Assistant training'));assert(container.innerHTML.includes('data-tr-player'));assert.equal(JSON.stringify(Q.getSquad(club)),before);
const first=Q.v23TrainingData().rows[0].player;
container.dispatch('change',{target:{dataset:{trPlayer:first.id},value:'intensive',matches:()=>true}});assert.equal(first.training.plan,'intensive');
container.dispatch('change',{target:{dataset:{trPref:'automatic'},type:'checkbox',checked:true,matches:()=>true}});assert.equal(Q.v23TrainingData().preferences.automatic,true);assert.equal(first.training.mode,'manual');
Q.v23RenderTraining();Q.v23RenderTraining();assert.equal(container.listenerCount('change'),1);assert.equal(container.listenerCount('click'),1);
const today=Q.currentCareerISO(),tomorrow=context.VelmoraTraining.addDays(today,1);
const sharp=first.sharpness;Q.setCareerDate(tomorrow);Q.processDailyPlayerUpdates(tomorrow);assert(first.sharpness!==sharp);const once=JSON.stringify(Q.getSquad(club));Q.processDailyPlayerUpdates(tomorrow);assert.equal(JSON.stringify(Q.getSquad(club)),once);assert(Q.saveCareerState());assert(Q.loadCareerState());const afterReload=JSON.stringify(Q.getSquad(club));Q.processDailyPlayerUpdates(tomorrow);assert.equal(JSON.stringify(Q.getSquad(club)),afterReload);
console.log(JSON.stringify({status:'PASS',runtime:'Complete application with DOM adapter; no browser rendering',clubs:context.VELMORA_CLUBS.length,seniorPlayers:migrated.rows.length,checks:['complete app bootstrap','three starters plus three live substitutes with wider senior depth','actual save/load preserves sharpness, schedules and assistant targets','legacy v73 migration through actual loader','fixture and lineup preservation','real UI render, change events and one-time event binding','no gains from opening the screen','once-per-day progression survives save/reload']},null,2));
