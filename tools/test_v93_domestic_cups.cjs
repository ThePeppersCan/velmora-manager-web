'use strict';

const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {runtime}=require('./career_test_runtime.cjs');
// The release cache key is read from release-meta.js so a version bump
// never has to be chased through the test suite by hand.
const RELEASE_CACHE_KEY=require('../release-meta.js').cacheKey;
const root=path.resolve(__dirname,'..');

const page=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'domestic-cups.css'),'utf8');
const manifest=fs.readFileSync(path.join(root,'tools','release_manifest.cjs'),'utf8');
const world=fs.readFileSync(path.join(root,'world-expansion.js'),'utf8');
assert(page.includes('data-season-tab="cup">DOMESTIC CUPS'),'Season navigation exposes the complete domestic cup centre');
assert(page.includes(`domestic-cups.css?v=${RELEASE_CACHE_KEY}`),'Domestic cup presentation stylesheet is loaded');
assert(manifest.includes("'domestic-cups.css'"),'Domestic cup presentation ships in release builds');
assert(css.includes('.dc-world-header')&&css.includes('.dc-match-grid'),'Domestic cup hub has full world and live-draw presentation');
for(const name of ['Velmora League Shield','Ironworks Trophy','Silver Laurel Cup','Rising Lantern Cup'])assert(world.includes(`"leagueCup": "${name}"`),`${name} is canonical world metadata`);

const {q,d}=runtime();
q.initializeCareerCalendar(true);
const integrity=d.v93DomesticCupsIntegrityForTest();
assert.equal(integrity.worlds,4,'Four worlds are active');
assert.equal(integrity.domesticCompetitions,8,'Each world has two domestic cups');
assert.equal(integrity.sharedChampionsCrownId,'champions_crown','There is one shared Champions Crown competition');
assert.equal(integrity.dateConflicts,0,'Planned cup rounds do not collide with league matchdays');
assert.equal(integrity.domesticCupQualifiesForCrown,false,'Domestic cups do not create Champions Crown qualification');
assert.equal(integrity.newSpriteDependency,false,'Existing artwork is sufficient');
for(const value of Object.values(integrity.registered))assert.equal(value,72,'Every domestic cup registers all 72 clubs in its world');
for(const value of Object.values(integrity.crownExemptions))assert.equal(value,4,'Four Champions Crown clubs per world receive delayed League Cup entry');
for(const [id,count] of Object.entries(integrity.openingFixtures))assert.equal(count,id.includes('league_cup')?27:8,`${id} has the correct staged opening draw`);
assert.deepEqual(JSON.parse(JSON.stringify(integrity.names.Velmora)),{league:'Repo Sports League',nationalCup:'Velmora Cup',leagueCup:'Velmora League Shield'});
assert.deepEqual(JSON.parse(JSON.stringify(integrity.names.Kharova)),{league:'Kharovan Guild League',nationalCup:"The Founders' Hammer",leagueCup:'Ironworks Trophy'});
assert.deepEqual(JSON.parse(JSON.stringify(integrity.names.Caldria)),{league:'Caldrian Prima Corona',nationalCup:'Cup of Towers',leagueCup:'Silver Laurel Cup'});
assert.deepEqual(JSON.parse(JSON.stringify(integrity.names.Ezuraya)),{league:'Ezurayan Sky League',nationalCup:'Moon Gate Cup',leagueCup:'Rising Lantern Cup'});

const nationalHtml=d.v93DomesticCupsHtmlForTest('Kharova','national');
const leagueHtml=d.v93DomesticCupsHtmlForTest('Ezuraya','league');
assert(nationalHtml.includes("THE FOUNDERS&#039; HAMMER")||nationalHtml.includes("THE FOUNDERS' HAMMER"),'World-specific main cup renders');
assert(leagueHtml.includes('RISING LANTERN CUP'),'World-specific League Cup renders');
assert(leagueHtml.includes('two-legged')&&leagueHtml.includes('CHAMPIONS CROWN'),'League Cup rules and shared Crown relationship are explained');
assert(!nationalHtml.includes('Competition engine connects later'),'Old placeholder copy is removed');

const completed=d.v93SimulateDomesticCupsForTest();
assert(completed.guard<100,'Full domestic cup season resolves without a progression loop');
assert.equal(completed.competitions.length,8,'All eight cup campaigns complete');
assert.equal(completed.snapshots,8,'All eight winners reach the permanent season archive');
for(const competition of completed.competitions){
  assert.equal(competition.matches,competition.played,`${competition.id} completes every scheduled fixture`);
  assert.equal(competition.rounds,7,`${competition.id} completes a seven-stage route`);
  assert.equal(competition.finals,1,`${competition.id} has one final`);
  assert.equal(competition.neutralFinals,1,`${competition.id} final is neutral`);
  assert(competition.winnerId,`${competition.id} produces a champion`);
  if(competition.kind==='league'){
    assert.equal(competition.matches,73,`${competition.id} includes the extra semi-final legs`);
    assert.equal(competition.semiFinalFixtures,4,`${competition.id} has two two-legged semi-finals`);
    assert.equal(competition.twoLeggedSemiFixtures,4,`${competition.id} marks every semi-final leg for aggregate resolution`);
  }else{
    assert.equal(competition.matches,71,`${competition.id} remains a 72-club single-elimination cup`);
    assert.equal(competition.semiFinalFixtures,2,`${competition.id} has single-leg semi-finals`);
    assert.equal(competition.twoLeggedSemiFixtures,0,`${competition.id} has no two-leg ties`);
  }
}

const finishedState=q.state();
for(const competition of completed.competitions){
  const ids=new Set(finishedState.fixtures.filter(f=>f.type==='CUP'&&f.competitionId===competition.id).flatMap(f=>[f.homeClubId,f.awayClubId]));
  assert.equal(ids.size,72,`${competition.id} actually fields every registered club`);
}

const migration=runtime();
migration.q.initializeCareerCalendar(true);
const before=migration.q.state().fixtures.filter(f=>f.type!=='CUP'||!String(f.competitionId).includes('league_cup'));
migration.q.set('fixtures',before);
const added=migration.q.ensureDomesticCupStructure();
const migrated=migration.q.state().fixtures.filter(f=>f.type==='CUP');
assert.equal(added,108,'Existing saves receive four League Cup opening rounds');
assert.equal(new Set(migrated.map(f=>f.competitionId)).size,8,'Existing save migration preserves main cups and adds the four missing competitions');

console.log('V93 domestic cup system passed: 4 worlds, 8 domestic cups, shared Champions Crown, staged entry, aggregate semi-finals, neutral finals, archive and migration verified.');
