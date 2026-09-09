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
const playerClub=r.context.VELMORA_CLUBS[0];
d.assignClubForTest(playerClub);
q.initializeCareerLifecycle();

const integrity=d.v92SeasonBoardIntegrityForTest();
assert.equal(integrity.version,'V92');
assert.equal(integrity.seasonMetrics,4,'season hero contains four useful live metrics');
assert.equal(integrity.seasonRows,18,'season table renders the full division');
assert.equal(integrity.seasonRowForms,18,'every club row carries recent form');
assert.equal(integrity.drawsColumn,true,'draws have a dedicated standings column');
assert.equal(integrity.formColumn,true,'form has a dedicated standings column');
assert.equal(integrity.boardDashboard,true,'board expectations owns a full dashboard surface');
assert.equal(integrity.boardKpis,4,'board dashboard has four live headline indicators');
assert.equal(integrity.boardSignals,4,'board confidence has four explainable drivers');
assert.equal(integrity.boardCheckpoint,true,'next board checkpoint is surfaced');
assert.equal(integrity.liveBoardCopy,true,'stale not-yet-simulated copy has been removed');

const season=d.v92SeasonTableHtmlForTest();
for(const marker of ['vm-table-identity','vm-hero-form','BOARD TARGET','SEASON PROGRESS','title="Draws"','role="columnheader">FORM','table-zone-tag','vm-table-form'])assert(season.includes(marker),`season table contains ${marker}`);

const board=d.v92BoardHtmlForTest();
for(const marker of ['board-expectations-dashboard','board-kpi-ribbon','board-objectives-section','board-assessment-card','board-checkpoint-card','board-checkpoint-plan','EVIDENCE WINDOW','BOARD BENCHMARK','STATUS TRIGGER','WHY CONFIDENCE IS MOVING','NEXT BOARD CHECKPOINT'])assert(board.toUpperCase().includes(marker.toUpperCase()),`board expectations contains ${marker}`);
assert.equal((board.match(/class="office-objective-card/g)||[]).length,4,'baseline club has a defining objective plus three supporting priorities');

const css=fs.readFileSync(path.join(root,'season-board-polish.css'),'utf8');
const page=fs.readFileSync(path.join(root,'index.html'),'utf8');
const manifest=fs.readFileSync(path.join(root,'tools','release_manifest.cjs'),'utf8');
for(const marker of ['.vm-table-identity','.vm-table-metric','.vm-table-form','.board-kpi-ribbon','.board-outlook-grid','.board-checkpoint-card'])assert(css.includes(marker),`presentation marker ${marker}`);
assert(page.includes(`season-board-polish.css?v=${RELEASE_CACHE_KEY}`),'season and board stylesheet uses the unified release cache key');
assert(manifest.includes("'season-board-polish.css'"),'season and board stylesheet ships in release builds');

console.log(JSON.stringify({status:'PASS',integrity,checks:['nine-column live standings','season context and progress','per-club recent form','full-height board dashboard','explainable confidence drivers','next board checkpoint','release packaging']},null,2));
