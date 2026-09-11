'use strict';
// V105.2 — countable copy and the deferred Champions Crown celebration.
// Source-level and pure-function checks; no DOM required.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8').split('\r\n').join('\n');

/* ---------- 1. the helper itself ---------- */
const start=app.indexOf('  function plural(');
assert.ok(start>=0,'app.js declares a plural() helper');
const body=app.slice(start,app.indexOf('\n  }',start)+4);
const plural=new Function(`${body}; return plural;`)();

const cases=[
  [[0,'goal'],'0 goals'],
  [[1,'goal'],'1 goal'],
  [[2,'goal'],'2 goals'],
  [[1,'match','matches'],'1 match'],
  [[3,'match','matches'],'3 matches'],
  [[1,'loss','losses'],'1 loss'],
  [[0,'loss','losses'],'0 losses'],
  [[NaN,'day'],'0 days'],
  [[undefined,'day'],'0 days'],
  [['4','point'],'4 points']
];
for(const [args,expected] of cases){
  assert.equal(plural(...args),expected,`plural(${JSON.stringify(args)})`);
}

/* ---------- 2. no unguarded countable phrase survives ---------- */
// Phrases where the word is not a count: a subject noun, a verb, or a legacy
// statistic that renders as '+' or '—' when the real figure was never recorded.
const NOT_COUNTS=[
  "${String(reporter.specialism||'matchday').replace(/_/g,' ').toLowerCase()} stories",
  "${success?'rises by 8':'rises by 2'} points",
  "${owner?.name||'The board'} offers"
];
const NOUNS=['goals','assists','matches','days','starts','points','wins','draws',
  'defeats','losses','clubs','prospects','appearances','players','meetings','years'];
const scan=new RegExp(`\\$\\{([^{}]{1,90})\\}\\s(${NOUNS.join('|')})\\b`,'g');
const offenders=[];
let m;
while((m=scan.exec(app))){
  const expr=m[1].trim();
  if(NOT_COUNTS.includes(m[0]))continue;
  if(/v43StatDisplay/.test(expr))continue;
  if(/===1\?|[!=]==1|\?''\s*:\s*'s'|\?'':'s'/.test(expr))continue;   // hand-guarded
  if(!(/^(Number\(|Math\.)/.test(expr)||/\.length$/.test(expr)||/^[A-Za-z_$][\w$.?]*$/.test(expr)))continue;
  offenders.push(m[0]);
}
assert.deepEqual(offenders,[],'every countable phrase is pluralised');
for(const phrase of NOT_COUNTS){
  assert.ok(app.includes(phrase),`a non-count phrase was left alone: ${phrase}`);
}
const pluralCalls=app.split('${plural(').length-1;
assert.ok(pluralCalls>=90,`the sweep is still applied (${pluralCalls} call sites)`);

/* ---------- 3. the Champions Crown final is celebrated on every path ---------- */
assert.ok(app.includes('function maybeShowChampionsCrownFinalCelebration('),
  'a deferred Champions Crown celebration exists');
assert.ok(app.includes('    maybeShowChampionsCrownFinalCelebration();\n    maybeOpenSeasonReview();'),
  'Central runs it before the season review, so the Crown takes precedence');
const deferred=app.slice(app.indexOf('function maybeShowChampionsCrownFinalCelebration('));
const deferredBody=deferred.slice(0,deferred.indexOf('\n  }')+4);
assert.ok(deferredBody.includes('championsCrown.presentation.finalCelebratedSeason===ed.seasonId'),
  'finalCelebratedSeason is read, not merely written');
assert.ok(deferredBody.indexOf('championsCrown.presentation.finalCelebratedSeason=ed.seasonId')
        < deferredBody.indexOf('showChampionsCrownFinalCelebration(ed)'),
  'the season is claimed before the overlay opens, so a refusal cannot loop');
assert.ok(deferredBody.includes('mine!==ed.championClubId&&mine!==ed.runnerUpClubId'),
  'only a final your own club reached is celebrated');
assert.ok(deferredBody.includes('if(v2072CelebrationBlocking)return false'),
  'it never opens on top of another celebration');
assert.ok(app.includes('if(wasFinal)championsCrown.presentation.finalCelebratedSeason='),
  'the live results path claims the season whether or not the edition had finalised');
// Its own definition plus at least one real caller: it is no longer dead code.
assert.ok((app.match(/(?<![A-Za-z])showChampionsCrownFinalCelebration\b/g)||[]).length>=2,
  'showChampionsCrownFinalCelebration is no longer dead code');

console.log(JSON.stringify({
  status:'PASS',
  version:'V105.2',
  measured:{pluralCallSites:pluralCalls,helperCases:cases.length,phrasesLeftAlone:NOT_COUNTS.length},
  checks:[
    'plural() handles zero, one, many, irregulars and non-numeric input',
    'no countable phrase in app.js can render "1 goals"',
    'subject nouns, verbs and unknown legacy statistics are left alone',
    'a Champions Crown final is celebrated even when the result arrives from another device or a reload',
    'the celebration claims its season before opening, so it cannot repeat',
    'only a final your own club reached is celebrated, and never over another overlay'
  ]
},null,2));
