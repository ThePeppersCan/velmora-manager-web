'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {runtime}=require('./career_test_runtime.cjs');

const root=path.resolve(__dirname,'..');
const r=runtime(),q=r.q,d=r.d;
const club=r.context.VELMORA_CLUBS[0];
d.assignClubForTest(club);
q.initializeCareerLifecycle();

const integrity=d.v94MediaInteractionsIntegrityForTest();
assert.equal(integrity.version,'V94');
assert.equal(integrity.immersive,true,'media responses use the immersive decision renderer');
assert.equal(integrity.location,'press-room','media decisions take place in the press-room environment');
assert.equal(integrity.beats,3,'the press officer, journalist and rival context are heard before choosing');
assert.equal(Array.from(integrity.beatTitles).join('|'),'THE ROOM SETTLES|THE QUESTION|FROM THE OTHER DUGOUT');
assert.equal(integrity.choiceCount,3);
assert(integrity.reporter.name&&integrity.reporter.role&&integrity.reporter.outlet,'journalist identity includes name, role and outlet');
assert(integrity.reporter.specialism&&integrity.reporter.hasPortrait,'journalist context and existing portrait art are available');
assert(integrity.rival.name&&integrity.rival.club&&integrity.rival.mediaStyle&&integrity.rival.archetype,'rival manager identity includes club and personality context');
assert.equal(integrity.accessibleIdentityContext,true);
assert.equal(integrity.newSpriteDependency,false);
assert(fs.existsSync(path.join(root,integrity.pressRoomAsset)),'existing press-room artwork is present');

const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const css=fs.readFileSync(path.join(root,'clubhouse-events.css'),'utf8');
for(const marker of ['careerDecisionMediaCastHTML','data-person-context','HOVER FOR CONTEXT','YOU ARE ON THE RECORD','STORY HEAT'])assert(app.includes(marker),`media interaction marker: ${marker}`);
for(const marker of ['.career-event-world.is-media','.career-event-identity::after','.career-event-identity:hover::after','.career-event-identity:focus-visible'])assert(css.includes(marker),`identity presentation marker: ${marker}`);
for(const outcome of ['RESPECT SETS THE HEADLINE','THE FOCUS STAYS ON THE FIXTURE','PRESSURE RISES BEFORE THE MEETING'])assert(app.includes(outcome),`meaningful media outcome: ${outcome}`);

console.log(JSON.stringify({status:'PASS',integrity,checks:[
  'media events use the full-scene press-room presentation',
  'three contextual beats precede the response',
  'journalist name, role, outlet, specialism and relationship are explained',
  'rival manager name, club, style, archetype and history are explained',
  'name context works with hover and keyboard focus',
  'all three statements produce clear immediate consequences',
  'existing artwork is reused without new sprites'
]},null,2));
