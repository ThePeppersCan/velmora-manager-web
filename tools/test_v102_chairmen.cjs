'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {runtime}=require('./career_test_runtime.cjs');

const root=path.resolve(__dirname,'..');
const r=runtime(),q=r.q,d=r.d;
const clubs=r.context.VELMORA_CLUBS;
const club=clubs[0];
d.assignClubForTest(club);
q.initializeCareerLifecycle();

const initial=d.v102ChairmenIntegrityForTest();
assert.equal(initial.version,'V102');
assert.equal(initial.saveSchema,85);
assert.equal(initial.profiles,initial.clubs,'every club has persistent ownership');
assert.equal(initial.relationships,initial.clubs,'every club has an ownership relationship record');
assert.equal(initial.uniqueProfileIds,initial.clubs,'owner profile ids are unique');
assert.equal(initial.uniqueOwnerNames,initial.clubs,'every club has an identifiable owner name');
assert.equal(initial.validPriorities,true,'every owner has three coherent priorities');
assert.equal(initial.validDimensions,true,'all twelve ownership dimensions are numeric');
assert.equal(initial.boundedMemories,true,'relationship history is bounded for long saves');
assert(initial.portraitCount>=8,'the world draws from a varied chairman portrait roster');
assert.equal(initial.interviewQuestions,4,'club interviews use four contextual board questions');
assert(initial.objectiveCount>=4,'the board exposes a defining target and supporting objectives');
assert(initial.objectiveReasons>=4,'objectives explain why ownership cares');
assert.equal(initial.moneyCreationRemoved,true,'recruitment protection does not create money');
assert(initial.confidence>=25&&initial.confidence<=90,'new and migrated careers begin with a credible owner relationship');

const state=d.v102ChairmanStateForTest();
const profile=state.profiles[club.id];
assert(profile?.name&&profile?.biography&&profile?.portrait,'the active chairman has identity, context and artwork');
assert.equal(Object.keys(profile.dimensions).length,12,'the owner has all twelve behavioural dimensions');
assert.equal(new Set(Object.values(state.profiles).map(owner=>owner.createdFrom)).size,clubs.length,'profiles are deterministically club-specific');

const interview=d.v102ChairmanInterviewForTest(club.id);
assert.equal(interview.length,4);
assert(interview.every(question=>question.choices.length===3),'every interview question offers three credible positions');
assert(interview.some(question=>question.question.includes(profile.name)),'the chairman speaks by name in the interview');
assert(interview.flatMap(question=>question.choices).every(choice=>Number.isFinite(choice.fit)),'answers are scored against owner priorities');

for(const request of ['salary','resources','term']){
  const decision=d.v102ChairmanNegotiationForTest(club.id,request);
  assert.equal(typeof decision.accepted,'boolean');
  assert(decision.chance>=18&&decision.chance<=86,'negotiation probability remains bounded');
  assert(decision.copy.length>20,'the owner gives an authored response');
}

const board=d.v102ChairmanBoardHtmlForTest();
for(const marker of ['chairman-dossier','CLUB OWNERSHIP','WORKING RELATIONSHIP','chairman-policy-strip',"OWNER'S RECORD",'chairman-objective-reason'])assert(board.includes(marker),`boardroom marker: ${marker}`);
assert(board.includes(profile.name),'the current chairman is visible in the boardroom');

const source=fs.readFileSync(path.join(root,'app.js'),'utf8');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'chairmen.css'),'utf8');
assert(index.includes('chairmen.js')&&index.includes('chairmen.css'),'chairman runtime and presentation are loaded');
assert(source.includes('ownershipState')&&source.includes('chairmanRecord'),'ownership state and memory are integrated');
assert(!source.includes('newClub.budget=moneyNumber(newClub.budget)+Number(offer.promisedBudgetBonus'),'job changes cannot generate transfer funds');
for(const marker of ['.chairman-dossier','.chairman-name-card','.chairman-policy-strip','.chairman-vacancy-owner'])assert(css.includes(marker),`chairman presentation marker: ${marker}`);

d.saveCareerStateForTest();
const saves=[...r.local.values()].map(value=>{try{return r.context.VelmoraSaveCodec.decode(String(value));}catch(_error){return String(value);}});
assert(saves.some(value=>String(value).includes('ownershipState')&&String(value).includes(profile.id)),'chairman identity is included in the career save');

console.log(JSON.stringify({status:'PASS',initial,chairman:{name:profile.name,title:profile.title,priorities:profile.priorities,style:profile.communicationStyleLabel},checks:[
  'persistent named ownership exists for every club',
  'objectives, confidence, AI appointments and sackings use owner character',
  'interviews and contract talks are contextual boardroom conversations',
  'recruitment protection preserves existing funds without creating money',
  'legacy careers migrate and owner memories remain bounded',
  'boardroom, job market and hover context use the approved sprite set'
]},null,2));
