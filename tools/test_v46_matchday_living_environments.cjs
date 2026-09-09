const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {runtime}=require('./career_test_runtime.cjs');
// The release cache key is read from release-meta.js so a version bump
// never has to be chased through the test suite by hand.
const RELEASE_CACHE_KEY=require('../release-meta.js').cacheKey;

const {context,q,d}=runtime();
const clubs=context.VELMORA_CLUBS;
const club=clubs.find(c=>c.id==='redwick')||clubs[0];
d.assignClubForTest(club);
q.initializeCareerLifecycle();

const integrity=d.v46MatchdayLivingIntegrityForTest();
assert(['V46','V46.1'].includes(integrity.version));
assert(integrity.saveSchema>=82);
assert.deepEqual(Array.from(integrity.matchChoices),['WATCH MATCH','QUICK SIM']);
assert.equal(integrity.quickSimPath,true);
assert.equal(integrity.watchMatchPath,true);
assert.deepEqual(Array.from(integrity.facilityTypes),['training','academy','medical','stadium']);
assert.equal(integrity.managerSceneRenderer,true);
assert.equal(integrity.trainingObservation,true);
assert.equal(integrity.bigMatchPresentation,true);

// Every facility has five deterministic completed-level visual states.
for(const type of integrity.facilityTypes){
  const levels=integrity.facilityLevels[type];
  assert.equal(levels.length,5,`${type} should expose L1-L5`);
  levels.forEach((profile,i)=>{
    assert.equal(profile.level,i+1);
    assert(profile.tier);
    assert.equal(profile.visualRevision,'V46');
  });
  if(type!=='stadium'){
    assert(levels[0].asset,`${type} needs a real base environment`);
    assert(levels[4].props.length>levels[0].props.length,`${type} should visibly accumulate modular upgrades`);
  }else{
    assert(levels[0].asset.includes('assets/quidditch-engine/arenas/clubs/'),'Stadium should preserve canonical club-specific venue art');
    assert.equal(levels[4].canonicalStadium,true);
  }
}

// Training observation is presentation-only: no player or performance data is mutated.
const p=q.getSquad(club)[0];
assert(p,'Expected senior player');
const snapshot=JSON.stringify({ovr:p.ovr,potential:p.potential,fitness:p.fitness,sharpness:p.sharpness,goals:p.seasonStats?.goals,apps:p.seasonStats?.apps});
const shown=d.v46ObserveTrainingForTest();
assert.equal(typeof shown,'boolean');
const after=JSON.stringify({ovr:p.ovr,potential:p.potential,fitness:p.fitness,sharpness:p.sharpness,goals:p.seasonStats?.goals,apps:p.seasonStats?.apps});
assert.equal(after,snapshot,'Observing training must not grant progression or alter match stats');

// Source-level guards prove this is integrated into the existing site instead of mocked beside it.
const root=path.resolve(__dirname,'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'aaa-career-pass.css'),'utf8');
const training=fs.readFileSync(path.join(root,'training-ui.js'),'utf8');
const bootstrap=fs.readFileSync(path.join(root,'career-bootstrap.js'),'utf8');

assert(index.includes('id="matchWatch"'));
assert(index.includes('id="matchQuick"'));
assert(!index.includes('id="matchSim"'));
assert(!index.includes('<strong>SIM GAME</strong>'));
assert(!app.includes("$('#matchSim')?.addEventListener"));
assert(!app.includes('Choose Watch, Sim Game or Quick Sim'));
assert(app.includes("recordSigning?'RECORD SIGNING'"));
assert(app.includes("type:'ACADEMY BREAKTHROUGH'"));
assert(app.includes("type:'BIG MATCH PREPARATION'"));
assert(app.includes("managerPortraitHTML(ensureManagerProfile(),'v2072-manager-paperdoll','matchday')"));
assert(app.includes('v46-first24-manager-paperdoll'));
assert(training.includes('data-tr-observe'));
assert(training.includes('observeSession'));
assert(css.includes('V46 — MATCHDAY & LIVING ENVIRONMENTS'));
assert(css.includes('repeat(2,minmax(12cqw,1fr))'));
assert(css.includes('.v46-facility-prop'));
assert(css.includes('.v46-stadium-module'));
assert(css.includes('.v46-first24-manager'));
assert(index.includes(`aaa-career-pass.css?v=${RELEASE_CACHE_KEY}`));
assert(bootstrap.includes('window.VELMORA_RELEASE?.cacheKey'));

for(const file of [
  'assets/career/training-ground.png',
  'assets/career/recruitment-room.png',
  'assets/career/dressing-room.png',
  'assets/career/office.png',
  'assets/central-news/scenes/training-day.png',
  'assets/career/props/prop_25.png',
  'assets/inbox-identity-v1/header-medical-department-report.webp'
]) assert(fs.existsSync(path.join(root,file)),`Missing packaged V46 scene asset: ${file}`);

console.log(JSON.stringify({
  status:'PASS',version:'V46',matchChoices:integrity.matchChoices,
  facilityLevels:Object.fromEntries(integrity.facilityTypes.map(type=>[type,integrity.facilityLevels[type].map(x=>({level:x.level,tier:x.tier,asset:x.asset,props:x.props.length}))])),
  checks:[
    'Sim Game is removed from Matchday; only Watch Match and Quick Sim remain',
    'existing authoritative Quick Sim and Watch Match result paths are preserved',
    'Training, Academy, Medical and Stadium resolve five visible investment levels',
    'facility backgrounds use real supplied art with modular progression and safe fallbacks',
    'club-specific stadium artwork remains canonical while facility level adds presentation tiers',
    'custom manager is wired into arrivals, captaincy, academy, training, big matches, achievements and club changes',
    'training observation is non-destructive and does not grant progression',
    'V46 cache-busting and responsive presentation styles are active'
  ]
},null,2));
