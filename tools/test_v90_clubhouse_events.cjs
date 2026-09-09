'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {runtime}=require('./career_test_runtime.cjs');
// The release cache key is read from release-meta.js so a version bump
// never has to be chased through the test suite by hand.
const RELEASE_CACHE_KEY=require('../release-meta.js').cacheKey;

const root=path.resolve(__dirname,'..');
const r=runtime(),q=r.q,d=r.d;
const club=r.context.VELMORA_CLUBS[0];
d.assignClubForTest(club);
q.initializeCareerLifecycle();

const integrity=d.v90ClubhouseEventsIntegrityForTest();
assert.equal(integrity.version,'V90');
assert(integrity.incidentVariants>=12,'at least twelve genuinely different conflict setups');
assert.equal(integrity.distinctIncidentTitles,integrity.incidentVariants,'incident titles are not recycled');
assert(integrity.immersiveKinds>=9,'the scene system covers the main human career interactions');
assert.equal(integrity.sampleChoices,4,'conflicts offer mediation and shared accountability as well as taking sides');
assert(integrity.sampleBeats>=3,'the manager hears staff and both players before deciding');
assert(integrity.clubLifeInteractionProfiles>=14,'each interactive Club Life family has its own response writing');
assert(integrity.uniqueClubLifeChoiceLabels>=35,'Club Life no longer repeats the same three labels');
assert(integrity.sceneLocations>=3,'stories move between real club locations');
assert.equal(integrity.delayedFollowUps,true);
assert.equal(integrity.fullBodySpriteReuse,true);
assert(fs.existsSync(path.join(root,integrity.sampleBackdrop)),'sample scene backdrop exists');

const squad=q.getSquad(club);
const [first,second]=squad;
const incidentIds=new Set();
for(let day=1;day<=28;day++){
  const date=`2026-09-${String(day).padStart(2,'0')}`;
  incidentIds.add(q.buildTrainingClashDecision(first,second,date).incidentId);
}
assert(incidentIds.size>=9,'different dates should expose broad incident variety');

const event=q.buildTrainingClashDecision(first,second,q.currentCareerISO());
q.queueDecisionEvent(event);
const outcome=q.resolveDecisionEvent(event.id,'internal',{deferClose:true});
let resolved=d.getLivingCareerState().careerDecisionEvents.find(row=>row.id===event.id);
assert(resolved?.resolved,'decision resolves through the authoritative career pipeline');
assert(resolved.incidentOutcome?.state,'relationship state is stored with the event');
assert(resolved.followUpDate,'a delayed dressing-room follow-up is scheduled');
assert(outcome?.title&&outcome.tags?.length>=3,'the player sees a meaningful immediate outcome');
q.processDressingRoomIncidentFollowUps(resolved.followUpDate);
resolved=d.getLivingCareerState().careerDecisionEvents.find(row=>row.id===event.id);
assert.equal(resolved.followUpDelivered,resolved.followUpDate,'the later callback is delivered once');
q.processDressingRoomIncidentFollowUps(resolved.followUpDate);
resolved=d.getLivingCareerState().careerDecisionEvents.find(row=>row.id===event.id);
assert.equal(resolved.followUpDelivered,resolved.followUpDate,'the callback remains idempotent');

const css=fs.readFileSync(path.join(root,'clubhouse-events.css'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const marker of ['.career-event-world','.career-event-cast','.career-event-story','.career-event-choice-tray','.career-event-outcome'])assert(css.includes(marker),`immersive presentation marker: ${marker}`);
assert(html.includes(`clubhouse-events.css?v=${RELEASE_CACHE_KEY}`),'Clubhouse Stories stylesheet uses the unified release cache key');

console.log(JSON.stringify({
  status:'PASS',
  integrity,
  sampledIncidentVariety:incidentIds.size,
  checks:[
    'twelve contextual conflict setups',
    'staff and both players speak before the choice',
    'four materially different management approaches',
    'personality-sensitive immediate outcomes',
    'persistent pair tension and delayed follow-ups',
    'scene-led full-body presentation in real club locations',
    'scene-specific Club Life response writing',
    'existing player sprites reused without a new sprite dependency'
  ]
},null,2));
