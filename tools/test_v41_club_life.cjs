const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {runtime}=require('./career_test_runtime.cjs');

const r=runtime(),q=r.q,d=r.d;
const club=r.context.VELMORA_CLUBS[0];
d.assignClubForTest(club);
q.initializeCareerLifecycle();

const integrity=d.v41ClubLifeIntegrityForTest();
assert.equal(integrity.version,'V41');
assert.equal(integrity.saveCompatible,true);
assert(integrity.sceneTemplates>=20);
assert(integrity.interactiveTemplates>=12);
assert(integrity.passiveTemplates>=5);
assert.deepEqual(Array.from(integrity.responseTones),['SUPPORTIVE','PLAYFUL','FOCUSED']);
assert.equal(integrity.importantBlockingPreserved,true);
assert.equal(integrity.promisesPreserved,true);

const quiet=d.simulateClubLifeForTest(156,'QUIET');
const standard=d.simulateClubLifeForTest(156,'STANDARD');
const lively=d.simulateClubLifeForTest(156,'LIVELY');
for(const report of [quiet,standard,lively]){
  assert.equal(report.seasons,3);
  assert.equal(report.repeatViolations,0);
  assert.equal(report.negativeClubLifeEvents,0);
  assert(report.uniqueScenes>=8);
  assert(report.relationships>0);
}
assert(quiet.interactive<standard.interactive);
assert(standard.interactive<lively.interactive);
assert(quiet.quietWeeks>standard.quietWeeks);
assert(standard.quietWeeks>0);
assert(standard.conversationsPerWeek>=.18&&standard.conversationsPerWeek<=.42,`Standard conversation rate ${standard.conversationsPerWeek}`);

q.state().livingSquad.clubLife.frequency='QUIET';
assert(q.saveCareerState());
q.state().livingSquad.clubLife.frequency='LIVELY';
assert(q.loadCareerState());
assert.equal(q.state().livingSquad.clubLife.frequency,'QUIET');

const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'aaa-career-pass.css'),'utf8');
const liveText=['app.js','velmora-quidditch-engine.js','index.html'].map(file=>fs.readFileSync(path.join(root,file),'utf8')).join('\n');
for(const id of ['centralWeekMatch','centralWeekStory','centralWeekAttention'])assert(html.includes(`id="${id}"`),`Central club-life mount missing: ${id}`);
assert(/aaa-career-pass\.css\?v=/.test(html));
assert(css.includes('.central-week-card'));
assert(css.includes('.office-routine-toggle'));
assert(!/\bfootball(?:er|ers)?\b/i.test(liveText));

console.log(JSON.stringify({
  status:'PASS',
  measurements:{quiet,standard,lively,integrity},
  checks:[
    'three-season frequency simulation preserves natural quiet weeks',
    'Standard reserves interactive scenes for roughly one meaningful moment every three to five in-game weeks',
    'scene, player and pair cooldowns prevent rapid repeats',
    'club-life scenes do not manufacture negative management tasks',
    'relationship continuity develops across later scenes',
    'Club Life frequency survives the existing save/load path',
    'Central hub and routine-mail grouping styles are mounted',
    'live generated text is clear of leftover football terminology'
  ]
},null,2));
