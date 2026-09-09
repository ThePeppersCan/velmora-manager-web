'use strict';
// V104.2 · Expected goals
//
// xG is the probability a shot becomes a goal for an AVERAGE shooter, so that
// goals measured against xG still reveal who finishes well. The live engine
// already computed that probability and discarded it; quick-simmed and AI
// matches model no shots at all, so a seeded shot set is synthesised whose xG
// sums to the team's existing expected-goals figure.
//
// The properties that matter are calibration (goals track xG over a season),
// determinism (two devices agree), and that nothing invents xG for a match
// that was never played.

const assert=require('node:assert/strict');
const {runtime}=require('./career_test_runtime.cjs');

function career(){
  const r=runtime(),q=r.q;
  const club=r.context.VELMORA_CLUBS.find(c=>c.id==='redwick');
  r.d.assignClubForTest(club);
  q.initializeCareerLifecycle();
  return{r,q,club};
}

const {r,q,club}=career();

// ---------------------------------------------------------------
// Every resolved match carries xG
// ---------------------------------------------------------------
const pending=q.state().fixtures.filter(f=>!f.played&&f.type==='LEAGUE').slice(0,120);
assert.ok(pending.length>=60,'a meaningful sample of fixtures is available');

const untouched=pending[0];
assert.equal(untouched.xg,undefined,'an unplayed fixture has no xG');

pending.forEach(f=>q.simulateBackgroundFixture(f));
const played=pending.filter(f=>f.played);
assert.equal(played.length,pending.length,'the sample resolved');
assert.equal(played.every(f=>f.xg&&Number.isFinite(f.xg.home)&&Number.isFinite(f.xg.away)),true,
  'every resolved match records xG for both sides');

// ---------------------------------------------------------------
// Calibration: over a season, goals and xG track each other
// ---------------------------------------------------------------
const goals=played.reduce((n,f)=>n+Number(f.homeScore||0)+Number(f.awayScore||0),0);
const expected=played.reduce((n,f)=>n+Number(f.xg.home||0)+Number(f.xg.away||0),0);
const ratio=goals/expected;
assert.ok(ratio>0.80&&ratio<1.25,
  `goals track expected goals across the sample (ratio ${ratio.toFixed(2)})`);

// Individual matches must still vary, or xG is just the scoreline restated.
const identical=played.filter(f=>
  Math.round(Number(f.xg.home))===Number(f.homeScore)&&
  Math.round(Number(f.xg.away))===Number(f.awayScore)).length;
assert.ok(identical<played.length*.6,
  'xG diverges from the scoreline in individual matches, as it must to be useful');

// Values stay in a believable range for a single team in a single match.
for(const f of played){
  for(const side of ['home','away']){
    assert.ok(f.xg[side]>=0&&f.xg[side]<=6,
      `${f.fixtureId} ${side} xG is plausible (${f.xg[side]})`);
  }
}

// ---------------------------------------------------------------
// Determinism: a second device on the same career seed agrees exactly
// ---------------------------------------------------------------
const second=career();
const mirror=second.q.state().fixtures.filter(f=>!f.played&&f.type==='LEAGUE').slice(0,120);
mirror.forEach(f=>second.q.simulateBackgroundFixture(f));
const key=list=>list.filter(f=>f.played).map(f=>`${f.fixtureId}:${f.xg.home}/${f.xg.away}`).join('|');
assert.equal(key(mirror),key(played),
  'both devices derive identical xG from the shared career seed');

// ---------------------------------------------------------------
// It reaches player records, and reads the way the manager expects
// ---------------------------------------------------------------
let best=null;
for(const c of q.state().clubs){
  for(const p of q.getSquad(c)){
    const summary=q.v43CurrentPlayerSummary(p,c);
    if(summary&&summary.apps>0&&(!best||Number(summary.xg||0)>Number(best.xg||0)))best=summary;
  }
}
assert.ok(best,'players accumulated statistics');
assert.ok(Number(best.xg||0)>0,'including expected goals');
assert.ok(Number(best.shots||0)>0,'and the shots behind them');
assert.ok(Number(best.xg)<=Number(best.shots),
  'a player cannot accumulate more xG than shots taken');

// A season total should be a sane rate per appearance.
const perApp=Number(best.xg)/Math.max(1,Number(best.apps));
assert.ok(perApp<3,`xG per appearance stays believable (${perApp.toFixed(2)})`);

// ---------------------------------------------------------------
// Friendlies are excluded from the statistical record, as before
// ---------------------------------------------------------------
const friendly=q.state().fixtures.find(f=>!f.played&&f.type==='FRIENDLY');
if(friendly){
  q.simulateBackgroundFixture(friendly);
  assert.ok(friendly.xg,'a friendly still reports match xG for the result screen');
}

// ---------------------------------------------------------------
// The neutral model: identical shots must not be worth more to a better
// finisher, or goals-minus-xG stops measuring finishing at all.
// ---------------------------------------------------------------
const engineSource=require('node:fs')
  .readFileSync(require('node:path').resolve(__dirname,'..','velmora-quidditch-engine.js'),'utf8');
assert.match(engineSource,/function neutralShotXg/,'the engine computes a neutral xG');
assert.equal(/neutralShotXg\([^)]*shooting/.test(engineSource),false,
  'and never feeds the shooter\'s own finishing into it');
assert.match(engineSource,/XG_NEUTRAL_SKILL/,'it uses an explicit neutral skill point');

console.log(JSON.stringify({
  status:'PASS',
  version:'V104.2',
  matchesSampled:played.length,
  goals,
  expectedGoals:Number(expected.toFixed(1)),
  calibrationRatio:Number(ratio.toFixed(3)),
  checks:[
    'unplayed fixtures carry no xG',
    'every resolved match records xG for both sides',
    'goals track xG across a season',
    'xG diverges from the scoreline in individual matches',
    'per-match values stay in a believable range',
    'two devices on one seed derive identical xG',
    'players accumulate xG and shots',
    'xG never exceeds shots taken',
    'xG per appearance stays believable',
    'the engine model excludes the shooter\'s own finishing'
  ]
},null,2));
