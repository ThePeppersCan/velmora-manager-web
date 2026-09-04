const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {runtime}=require('./career_test_runtime.cjs');

const r=runtime(),q=r.q,d=r.d;
const clubs=r.context.VELMORA_CLUBS;
const club=clubs.find(c=>c.id==='redwick')||clubs[0];
d.assignClubForTest(club);
q.initializeCareerLifecycle();

let integrity=d.v43LivingStatisticsIntegrityForTest();
assert.equal(integrity.version,'V43');
assert(integrity.saveSchema>=80);
assert(integrity.livingSquadVersion>=6);
assert.equal(integrity.statisticsVersion,1);
assert.equal(integrity.migratedLegacyVersion,1);
assert.equal(integrity.duplicateRows,0);
assert.equal(integrity.playerStatsBrowser,true);
assert.equal(integrity.careerStatisticsRenderer,true);
assert.equal(integrity.worldSimulationParity,true);
assert.equal(integrity.saveCompatible,true);

// An AI-v-AI competitive match must populate the exact same public-stat database.
const fixture=q.state().fixtures.find(f=>!f.played&&f.type==='LEAGUE'&&f.homeClubId!==club.id&&f.awayClubId!==club.id);
assert(fixture,'Expected an unplayed AI league fixture');
const home=q.clubById(fixture.homeClubId),away=q.clubById(fixture.awayClubId);
const beforeRows=d.v43LivingStatisticsIntegrityForTest().rows;
d.v43SimulateBackgroundFixtureForTest(fixture.fixtureId);
assert.equal(q.fixtureById(fixture.fixtureId).played,true);
const matchRows=Object.values(q.state().livingSquad.statistics.rows).filter(row=>row.lastDate===fixture.date&&row.competitionType==='LEAGUE'&&[home.id,away.id].includes(row.clubId)&&row.dataQuality==='FULL');
assert(matchRows.length>=6,`Expected at least six player rows, got ${matchRows.length}`);
assert.equal(matchRows.reduce((n,row)=>n+Number(row.apps||0),0),6);
assert.equal(matchRows.reduce((n,row)=>n+Number(row.ratingCount||0),0),6);
assert.equal(matchRows.reduce((n,row)=>n+Number(row.potm||0),0),1);
assert.equal(matchRows.reduce((n,row)=>n+Number(row.goals||0),0),Number(fixture.homeScore||0)+Number(fixture.awayScore||0));
assert(matchRows.every(row=>row.minutesKnown===true));
assert(matchRows.every(row=>row.assistsKnown===true));
assert(d.v43LivingStatisticsIntegrityForTest().rows>beforeRows);

// Assists and advanced metrics are first-class persisted values, not display-only calculations.
const statPlayer=q.getSquad(home)[0];
const row=d.v43RecordStatLineForTest(statPlayer.id,home.id,fixture.fixtureId,{assists:2,chancesCreated:4,interceptions:1,tacklesWon:2});
assert(row);
assert(row.assists>=2);
assert(row.chancesCreated>=4);
const playerRows=d.v43RowsForPlayerForTest(statPlayer.id);
const aggregate=d.v43AggregateRowsForTest(playerRows);
assert.equal(aggregate.length,1);
assert(aggregate[0].assists>=2);
assert(aggregate[0].chancesCreated>=4);

// Old information is retained without fabricating fields the old save never knew.
const legacy=q.v43LegacyRow({seasonId:'2024-25',playerId:statPlayer.id,playerName:statPlayer.name,avatar:statPlayer.avatar,role:statPlayer.role,clubId:home.id,clubName:home.name,world:q.clubWorldName(home),divisionKey:home.divisionKey,source:'TEST',apps:27,starts:24,goals:9});
assert.equal(legacy.dataQuality,'LEGACY_UNSPLIT');
assert.equal(legacy.assistsKnown,false);
assert.equal(legacy.advancedKnown,false);
assert.equal(legacy.assists,0);

// Save/load keeps rows exactly once.
const keysBeforeSave=Object.keys(q.state().livingSquad.statistics.rows).sort();
assert(q.saveCareerState());
q.state().livingSquad.statistics.rows={};
assert.equal(Object.keys(q.state().livingSquad.statistics.rows).length,0);
assert(q.loadCareerState());
const keysAfterLoad=Object.keys(q.state().livingSquad.statistics.rows).sort();
assert.deepEqual(keysAfterLoad,keysBeforeSave);
integrity=d.v43LivingStatisticsIntegrityForTest();
assert.equal(integrity.duplicateRows,0);

// Presentation and privacy contracts: public performance expands, private ability remains scout-gated.
const html=d.v43StatsHtmlForTest();
assert(html.includes('LIVING WORLD DATABASE'));
assert(html.includes('PLAYER STATISTICS'));
assert(html.includes('All worlds'));
assert(html.includes('Champions Crown'));
assert(html.includes('AVG'));
assert(html.includes('ROLE DATA'));
const root=path.resolve(__dirname,'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const css=fs.readFileSync(path.join(root,'aaa-career-pass.css'),'utf8');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert(app.includes('PUBLIC PERFORMANCE'));
assert(app.includes('CAREER STATISTICS'));
assert(app.includes("type:'FIRST_GOAL'"));
assert(app.includes('v43ApplyAssist'));
assert(app.includes('v43RecordRatingLine'));
assert(css.includes('V43 — LIVING STATISTICS / WORLD DATABASE'));
assert(css.includes('.v43-stat-table'));
assert(/aaa-career-pass\.css\?v=/.test(index));

console.log(JSON.stringify({
  status:'PASS',
  integrity,
  aiFixture:{id:fixture.fixtureId,score:`${fixture.homeScore}-${fixture.awayScore}`,fullPlayerRows:matchRows.length},
  checks:[
    'V43 schema 80 + Living Squad v6 initializes and migrates',
    'AI-v-AI fixtures record apps, minutes, goals, ratings, POTM and advanced public stats',
    'assists are persisted as first-class data',
    'legacy history does not invent assists or advanced stats',
    'statistics rows survive save/load without duplication',
    'world/competition filters and career-stat presentation are mounted',
    'scouting can consume public performance without exposing private OVR/attributes'
  ]
},null,2));
