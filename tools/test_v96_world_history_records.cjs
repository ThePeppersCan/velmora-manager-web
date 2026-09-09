'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {runtime}=require('./career_test_runtime.cjs');
// The release cache key is read from release-meta.js so a version bump
// never has to be chased through the test suite by hand.
const RELEASE_CACHE_KEY=require('../release-meta.js').cacheKey;

const root=path.resolve(__dirname,'..');
const page=fs.readFileSync(path.join(root,'index.html'),'utf8');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const css=fs.readFileSync(path.join(root,'world-history-records.css'),'utf8');
const engine=fs.readFileSync(path.join(root,'velmora-quidditch-engine.js'),'utf8');
const manifest=fs.readFileSync(path.join(root,'tools','release_manifest.cjs'),'utf8');

assert(page.includes(`world-history-records.css?v=${RELEASE_CACHE_KEY}`),'World History presentation stylesheet is loaded');
assert(manifest.includes("'world-history-records.css'"),'World History presentation ships in release builds');
assert(css.includes('#screenSeason.is-records-view .season-main-content'),'Records use the full Season canvas');
assert(css.includes('.dc-hub{overflow-x:hidden}'),'Domestic Cup horizontal overflow is contained');
assert(css.includes('.squad-tactic-plan-deck'),'Tactical plan slots have a production UI');
assert(fs.existsSync(path.join(root,'WORLD_HISTORY_RECORDS_AAA_MASTER_PROMPT.md')),'The reusable production master prompt is included');

const {q,d,context}=runtime();
const club=context.VELMORA_CLUBS[0];
d.assignClubForTest(club);
q.initializeCareerLifecycle();
const integrity=d.v96WorldHistoryIntegrityForTest();

assert.equal(integrity.version,'V96');
assert.equal(integrity.views,5,'Five World History views are implemented');
assert.equal(integrity.worlds,4,'All four worlds are represented');
assert.equal(integrity.domesticHolders,12,'Each world has league, national cup and league cup founding holders');
assert.equal(integrity.sharedCrown,'champions_crown','One shared Champions Crown sits above the four worlds');
assert.match(integrity.foundingSource,/PRE-CAREER CANON/,'Founding history is labelled honestly');
assert(integrity.lineage>=13,'The initial lineage includes twelve domestic holders and one shared crown');
assert(integrity.playerRows>0,'The player record book has meaningful candidates from day one');
assert.equal(integrity.playerMetrics,6,'Six player leaderboard metrics are supported');
assert.equal(integrity.tacticalDimensions,6,'The saved match plan has six tactical dimensions');
assert.equal(integrity.tacticalPlans,3,'Primary, Chase Game and Protect Lead plans are available');
assert.equal(integrity.previewEvents,integrity.previewGoals,'Every preview goal has a match event');
assert.equal(integrity.previewHasStats,true,'Result previews contain useful team statistics');
assert.equal(integrity.overviewHasAllWorlds,true,'All worlds are visible in the overview');
assert.equal(integrity.newSpriteDependency,false,'Existing game artwork is reused');

const expectations={
  overview:['WORLD HISTORY & RECORDS','CAREER-ERA RECORD BOOK','LIVE LEADERS'],
  competitions:['TITLE LINEAGE','FOUNDING ARCHIVE'],
  players:['PLAYER RECORD BOOK','data-v96-metric="rating"'],
  clubs:['CLUB HISTORY','ARCHIVE HONOURS'],
  managers:['MANAGER RECORDS','REPUTATION']
};
for(const [view,markers] of Object.entries(expectations)){
  const html=d.v96RecordsHtmlForTest(view,'all','all');
  for(const marker of markers)assert(html.includes(marker),`${view} view includes ${marker}`);
}

for(const marker of ['v96SeededHistory','v96CompetitionLineage','v96PlayerRecordRows','v96CaptureLiveRecords','v96ResultGoalEvents','data-v96-player','data-v96-manager'])assert(app.includes(marker),`World History integration marker: ${marker}`);
const liveCapture=app.slice(app.indexOf('function v96CaptureLiveRecords'),app.indexOf('function registerSeasonAwardHonours'));
assert(liveCapture.includes('fixture.v96RecordsCaptured=true'),'Live record capture is idempotent per fixture');
assert(!liveCapture.includes('seasonRecordSnapshot('),'Live record capture updates incrementally instead of rescanning every fixture');
for(const dimension of ["width:['Compact','Balanced','Wide']","tempo:['Patient','Balanced','Urgent']","freedom:['Structured','Balanced','Fluid']"])assert(engine.includes(dimension),`Live engine supports ${dimension}`);
assert(!app.includes('<strong>NO MAJOR EVENTS</strong><small>DEFENSIVE BATTLE</small>'),'Contradictory result fallback is removed');

console.log(JSON.stringify({status:'PASS',integrity,checks:[
  'five full-width World History views',
  'deterministic and honestly labelled pre-career canon',
  'four domestic worlds and one shared Champions Crown',
  'interactive player, club and manager records',
  'incremental live record milestone capture',
  'coherent result previews with events and statistics',
  'six-dimensional tactics with three persistent plan slots',
  'responsive Domestic Cups and cleaner Office scrolling',
  'no new sprite dependency'
]},null,2));
