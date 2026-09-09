'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Pulse=require('../club-pulse.js');
const {runtime}=require('./career_test_runtime.cjs');

const root=path.resolve(__dirname,'..');
const pure=Pulse.normalizeState({});
const club=Pulse.ensureClub(pure,'TEST-CLUB','2026-08-01');
assert.deepEqual(Object.keys(club.audiences),['board','dressing','supporters','press']);
assert.equal(new Set(Object.values(club.audiences).map(row=>row.memories)).size,4,'audiences never share a memory array');
Pulse.remember(pure,{clubId:'TEST-CLUB',audience:'board',date:'2026-08-02',title:'Board-only memory',summary:'Only the board records this.',valence:1,strength:3});
assert.equal(club.audiences.board.memories.length,2);
assert.equal(club.audiences.dressing.memories.length,1,'board memories cannot leak into the dressing room');
const thread=Pulse.schedule(pure,{clubId:'TEST-CLUB',sourceId:'QA-DECISION',createdDate:'2026-08-03',dueDate:'2026-08-24',title:'A live choice',choiceId:'back',choiceLabel:'BACK THE GROUP',evaluation:'FORM',impacts:{board:{initialValence:-1,strength:2},dressing:{initialValence:1,strength:4}}});
assert.equal(Pulse.due(pure,'2026-08-23').length,0);
assert.equal(Pulse.due(pure,'2026-08-24').length,1);
Pulse.settle(pure,thread.id,{date:'2026-08-24',verdict:'MIXED',title:'The verdict remains mixed',copy:'Different audiences reached different conclusions.',impacts:{board:{valence:-1},dressing:{valence:1}}});
assert.equal(pure.resolvedOutcomes.length,1);

const r=runtime(),q=r.q,d=r.d,activeClub=r.context.VELMORA_CLUBS[0];
d.assignClubForTest(activeClub);q.initializeCareerLifecycle();
const initial=d.v103ClubPulseIntegrityForTest();
assert.equal(initial.version,'V103');
assert.equal(initial.saveSchema,86);
assert.deepEqual(Array.from(initial.audienceKeys),['board','dressing','supporters','press']);
assert.equal(initial.distinctMemoryArrays,true);
assert.equal(initial.pressAudience,true);
assert.equal(initial.independentStores,true);
assert.equal(initial.boundedMemories,true);
assert.equal(initial.decisionMemory,true);
assert.equal(initial.pressMemory,true);
assert.equal(initial.delayedScheduler,true);
assert.equal(initial.dailyResolution,true);
assert.equal(initial.instantVerdictSuppressed,true);
assert.equal(initial.transferResponseDelayReintroduced,false,'delayed dilemmas must not restore artificial transfer waits');

const event={id:'QA-BAD-RUN',kind:'BAD_RUN',category:'DRESSING ROOM',title:'The group needs a response',choices:[{id:'back',label:'BACK THE GROUP',copy:'Protect the players.'}]};
q.recordDecisionAudienceMemory(event,event.choices[0]);
assert(event.delayedOutcomeId,'eligible choices create one durable delayed thread');
assert.equal(event.outcome.title,'THE CONSEQUENCES ARE STILL MOVING');
assert(event.outcome.tags.includes('NO INSTANT VERDICT'));
let state=q.state().audienceWorldState;
const pending=state.pendingOutcomes.find(row=>row.sourceId===event.id);
assert(pending&&pending.dueDate>pending.createdDate,'the follow-up date is fixed when the choice is made');
const boardMemories=state.clubs[activeClub.id].audiences.board.memories;
const dressingMemories=state.clubs[activeClub.id].audiences.dressing.memories;
assert(boardMemories.some(row=>row.id.includes(event.id))&&dressingMemories.some(row=>row.id.includes(event.id)),'the same decision creates audience-specific memories');
assert.notEqual(boardMemories.at(-1).summary,dressingMemories.at(-1).summary,'audiences do not receive rewritten copies of one message');

q.setCareerDate(pending.dueDate);const resolved=q.processDelayedAudienceOutcomes(pending.dueDate);
assert.equal(resolved.length,1,'the thread matures through normal career time');
state=q.state().audienceWorldState;
assert.equal(state.pendingOutcomes.find(row=>row.id===pending.id).status,'RESOLVED');
assert(state.resolvedOutcomes.some(row=>row.id===pending.id),'the mature consequence enters the permanent archive');

const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),css=fs.readFileSync(path.join(root,'club-pulse.css'),'utf8'),app=fs.readFileSync(path.join(root,'app.js'),'utf8'),prompt=fs.readFileSync(path.join(root,'FOUR_AUDIENCES_DELAYED_DILEMMAS_AAA_MASTER_PROMPT.md'),'utf8');
assert(html.includes('club-pulse.js')&&html.includes('club-pulse.css'));
for(const marker of ['.club-pulse-dossier-grid','.club-pulse-memory-list','.club-pulse-thread-rail','.v103-pulse-memory'])assert(css.includes(marker),`presentation marker: ${marker}`);
for(const marker of ['processDelayedAudienceOutcomes','recordDecisionAudienceMemory','recordPressConferenceAudienceMemory','OPEN CLUB PULSE'])assert(app.includes(marker),`career integration marker: ${marker}`);
assert(prompt.includes('four audiences continuously interpret')&&prompt.includes('do not announce a correct or incorrect choice'));

d.saveCareerStateForTest();
const saves=[...r.local.values()].map(value=>{try{return r.context.VelmoraSaveCodec.decode(String(value));}catch(_error){return String(value);}});
assert(saves.some(value=>String(value).includes('audienceWorldState')&&String(value).includes(pending.id)),'audience memories and delayed outcomes persist in career saves');

console.log(JSON.stringify({status:'PASS',initial,resolved:{id:pending.id,date:pending.dueDate,verdict:resolved[0].verdict},checks:['four independent audience memory ledgers','existing Club Pulse expanded with Press and a memory dossier','career decisions and press conferences write specific memories','delayed outcomes use future career context','no immediate correct-answer feedback','save, migration and memory bounds protected']},null,2));
