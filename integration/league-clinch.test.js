const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const app = fs.readFileSync(path.join(__dirname, '..', 'dist', 'app.js'), 'utf8');
function source(name) {
  const start = app.indexOf(`  function ${name}(`);
  assert.notEqual(start, -1, name);
  return app.slice(start, app.indexOf('\n  function ', start + 1));
}

function race({ points = [60, 50, 49, 45, 40, 30], remaining = [2, 2, 2, 2, 2, 2], own = 0, tier = 1, survival = false } = {}) {
  const rows = points.map((pts, i) => ({ pts, pos: i + 1, club: { id: `club-${i}`, name: `Club ${i}`, divisionKey: 'league', division: 'League', tier } }));
  const club = rows[own].club;
  const fixture = { fixtureId: 'current', type: 'LEAGUE', competitionId: 'league', homeClubId: club.id, awayClubId: 'opponent', homeScore: 1, awayScore: 0, played: true, round: 34, date: '2027-04-01' };
  // Pending records model the per-club schedules. Dates include overdue games:
  // a rescheduled fixture still contributes to the maximum points available.
  const fixtures = [fixture];
  remaining.forEach((count, i) => {
    for (let n = 0; n < count; n++) fixtures.push({ fixtureId: `remaining-${i}-${n}`, type: 'LEAGUE', competitionId: 'league', homeClubId: rows[i].club.id, awayClubId: `opponent-${i}-${n}`, round: 33, played: false, date: '2027-03-01' });
  });
  const result = { fixture, saved: true, resultCode: 'W', occasion: { race: { label: survival ? 'SURVIVAL DECIDER' : '' } } };
  const context = vm.createContext({
    currentClub: club, selectedClub: club, fixtures,
    standingsForDivision: () => rows,
    matchOccasionProfile: () => result.occasion,
    isDomesticCupFinal: f => f?.type === 'CUP' && f.cupStage === 'FINAL',
    plural: (n, word) => `${n} ${word}s`,
  });
  vm.runInContext(['leagueFixtureRoundMax', 'isFinalLeagueMatchday', 'v2072LeagueClinchedType', 'v2072DerivedAchievementMoment', 'matchResultMomentData', 'v2072AchievementType'].map(source).join('\n'), context);
  return { context, result, rows, type: () => context.v2072LeagueClinchedType(result) };
}

test('third place with games in hand prevents a title even when second cannot catch the leader', () => {
  const run = race({ remaining: [2, 2, 4, 2, 2, 2] }); // Third can reach 61, second only 56.
  assert.notEqual(run.type(), 'league');
  assert.equal(run.type(), 'qualification');
});

test('every rival must be unable to reach the leader, regardless of table position', () => {
  for (let challenger = 1; challenger < 6; challenger++) {
    const remaining = [2, 0, 0, 0, 0, 0];
    const points = [60, 50, 49, 45, 40, 30];
    remaining[challenger] = Math.ceil((60 - points[challenger]) / 3);
    assert.notEqual(race({ points, remaining }).type(), 'league', `challenger ${challenger}`);
  }
});

test('a genuine unassailable lead awards the title in top and lower divisions', () => {
  assert.equal(race().type(), 'league');
  assert.equal(race({ tier: 2 }).type(), 'promotion-title');
});

test('a rival able to finish level on points prevents an early title', () => {
  const run = race({ points: [60, 54, 49, 45, 40, 30] });
  assert.notEqual(run.type(), 'league');
});

test('a finished rival level on points can still win if the leader has games left', () => {
  const run = race({ points: [60, 60, 49, 45, 40, 30], remaining: [1, 0, 0, 0, 0, 0] });
  assert.notEqual(run.type(), 'league');
});

test('completed schedules use the final table tie-break', () => {
  const spec = { points: [60, 60, 49, 45, 40, 30], remaining: [0, 0, 0, 0, 0, 0] };
  assert.equal(race(spec).type(), 'league');
  assert.notEqual(race({ ...spec, own: 1 }).type(), 'league');
});

test('irrelevant competitions and already played matches cannot change available league points', () => {
  const run = race();
  run.context.fixtures.push(
    { type: 'CUP', competitionId: 'league', homeClubId: 'club-1', played: false },
    { type: 'LEAGUE', competitionId: 'other-league', homeClubId: 'club-1', played: false },
    { type: 'LEAGUE', competitionId: 'league', homeClubId: 'club-1', played: true },
  );
  assert.equal(run.type(), 'league');
});

test('home and away games both count, even when their scheduled date has passed', () => {
  const run = race({ remaining: [0, 4, 0, 0, 0, 0] });
  run.context.fixtures.filter(f => f.fixtureId.startsWith('remaining-1')).forEach(f => {
    [f.homeClubId, f.awayClubId] = [f.awayClubId, f.homeClubId];
  });
  assert.notEqual(run.type(), 'league');
});

test('automatic promotion checks challengers below third place', () => {
  const run = race({ tier: 2, own: 1, points: [70, 60, 50, 49, 48, 45], remaining: [0, 1, 3, 4, 0, 0] });
  assert.equal(run.type(), null);
  run.context.fixtures.find(f => f.fixtureId === 'remaining-3-3').played = true;
  assert.equal(run.type(), 'promotion');
});

test('top-four qualification checks challengers below fifth place', () => {
  const run = race({ own: 3, points: [90, 80, 70, 60, 50, 49, 20, 10], remaining: [0, 0, 0, 1, 3, 4, 0, 0] });
  assert.equal(run.type(), null);
  run.context.fixtures.find(f => f.fixtureId === 'remaining-5-3').played = true;
  assert.equal(run.type(), 'qualification');
});

test('survival checks all relegation contenders with games in hand', () => {
  const run = race({ own: 4, points: [90, 80, 70, 60, 50, 40, 39, 30], remaining: [0, 0, 0, 0, 1, 3, 4, 0], survival: true });
  assert.equal(run.type(), null);
  run.context.fixtures.find(f => f.fixtureId === 'remaining-6-3').played = true;
  assert.equal(run.type(), 'survival');
});

test('relegation compares against the last safe place, not another relegation place', () => {
  const spec = { own: 6, points: [90, 80, 70, 60, 40, 39, 30, 20], remaining: [0, 0, 0, 0, 0, 0, 3, 0] };
  assert.equal(race(spec).type(), 'relegation'); // Maximum 39 cannot catch fifth on 40.
  assert.equal(race({ ...spec, points: [90, 80, 70, 60, 39, 38, 30, 20] }).type(), null);
  assert.equal(race({ ...spec, tier: 4 }).type(), null);
});

test('finishing the user schedule does not award a title while a rival can catch up', () => {
  const run = race({ remaining: [0, 4, 0, 0, 0, 0] });
  assert.equal(run.context.isFinalLeagueMatchday(run.result.fixture), true);
  assert.equal(run.context.matchResultMomentData(run.result), null);
  assert.notEqual(run.context.v2072AchievementType(run.result), 'league');
});

test('a cached champions label cannot bypass the mathematical check', () => {
  const run = race({ remaining: [0, 4, 0, 0, 0, 0] });
  run.result.resultMoment = { label: 'CHAMPIONS', title: 'LEAGUE CHAMPIONS' };
  assert.notEqual(run.context.v2072AchievementType(run.result), 'league');
});

test('completed league results still produce the title presentation', () => {
  const run = race({ remaining: [0, 0, 0, 0, 0, 0] });
  assert.equal(run.context.matchResultMomentData(run.result).label, 'CHAMPIONS');
  assert.equal(run.context.v2072AchievementType(run.result), 'league');
});

test('cup and playoff final celebrations retain their result-based behaviour', () => {
  const run = race();
  for (const [fixture, expected] of [[{ type: 'CUP', cupStage: 'FINAL' }, 'cup'], [{ type: 'PLAYOFF', round: 'FINAL' }, 'promotion']]) {
    assert.equal(run.context.v2072AchievementType({ fixture, resultCode: 'W' }, { label: 'WINNERS' }), expected);
  }
});

test('missing league data cannot declare a title', () => {
  const run = race();
  run.context.fixtures = [];
  assert.equal(run.type(), null);
});
