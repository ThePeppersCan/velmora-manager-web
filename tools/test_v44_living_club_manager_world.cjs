const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {runtime}=require('./career_test_runtime.cjs');

const r=runtime(),q=r.q,d=r.d;
const clubs=r.context.VELMORA_CLUBS;
const club=clubs.find(c=>c.id==='redwick')||clubs[0];
d.assignClubForTest(club);
q.initializeCareerLifecycle();

const integrity=d.v44LivingWorldIntegrityForTest();
assert.equal(integrity.version,'V44');
assert(integrity.saveSchema>=81);
assert.equal(integrity.livingSquadVersion,7);
assert.equal(integrity.managerMarketVersion,4);
assert.equal(integrity.clubLifeVersion,2);
assert.equal(integrity.secondaryRoleSystem,true);
assert.equal(integrity.caretakerLifecycle,true);
assert.equal(integrity.jobWatchlist,true);
assert.equal(integrity.jobWatchlistLimit,6);
assert.equal(integrity.recommendedJobs,true);
assert.equal(integrity.facilityResolver,true);
assert.equal(integrity.managerSceneRenderer,true);
assert(integrity.clubLifeScenes>=27);
assert.equal(integrity.clubLifeFacts,true);
assert.equal(integrity.saveCompatible,true);

// Secondary roles remain distinct from primary-role conversion and produce a bounded real suitability effect.
const player=q.getSquad(club)[0];
const alt=['ATTACKER','PLAYMAKER','DEFENDER','ALL-ROUNDER'].find(role=>role!==player.role);
assert(player&&alt,'Expected a player and alternate role');
assert.equal(d.v44RoleFamiliarityForTest(player.id,player.role).familiarity,100);
d.v44SetRoleFamiliarityForTest(player.id,alt,35);
const low=d.v44RoleFamiliarityForTest(player.id,alt);
d.v44SetRoleFamiliarityForTest(player.id,alt,80);
const high=d.v44RoleFamiliarityForTest(player.id,alt);
assert(high.modifier>low.modifier,'80% familiarity should outperform 35% familiarity');
assert(low.modifier>=.84&&high.modifier<=1,'Role suitability must stay bounded');
const beforeGrow=high.familiarity;
d.v44GrowRoleFamiliarityForTest(player.id,club.id,alt,2,'2026-09-02');
assert(d.v44RoleFamiliarityForTest(player.id,alt).familiarity>beforeGrow,'Genuine use/training should be able to grow familiarity slowly');
const roleMapBefore=JSON.stringify(d.v44RoleFamiliarityForTest(player.id,alt).map);
assert(q.saveCareerState());
player.roleFamiliarity={};
assert(q.loadCareerState());
const playerAfter=q.careerPlayerById(player.id);
assert.equal(JSON.stringify(d.v44RoleFamiliarityForTest(playerAfter.id,alt).map),roleMapBefore,'Role familiarity must survive save/load');

// AI vacancy receives a real caretaker while the permanent vacancy remains open.
const aiClub=clubs.find(c=>c.id!==club.id&&q.getSquad(c).length>=3);
assert(aiClub,'Expected an AI club');
const vacancyResult=d.v44OpenVacancyForTest(aiClub.id,'2026-09-02');
assert(vacancyResult?.vacancy,'Vacancy should be created');
assert.equal(vacancyResult.vacancy.status,'OPEN');
assert(vacancyResult.caretaker?.id,'Caretaker should be assigned');
assert.equal(vacancyResult.assignedManagerId,vacancyResult.caretaker.id);
const caretakerId=vacancyResult.caretaker.id;
const caretaker=d.v44CaretakerForClubForTest(aiClub.id);
assert.equal(caretaker.id,caretakerId);
assert.equal(caretaker.isCaretaker,true);
assert.equal(typeof caretaker.permanentScore,'number');
assert(q.saveCareerState());
assert(q.loadCareerState());
assert.equal(d.v44CaretakerForClubForTest(aiClub.id)?.id,caretakerId,'Caretaker must not duplicate after reload');

// Job watchlist is per-save state and recommendations reuse the real vacancy/suitability system.
let watch=d.v44ToggleWatchForTest(aiClub.id);
assert(watch.watchlist.includes(aiClub.id));
assert(q.saveCareerState());
assert(q.loadCareerState());
assert(q.state().managerMarket.jobWatchlist.includes(aiClub.id),'Watchlist should persist');
const recs=d.v44RecommendedForTest();
assert(Array.isArray(recs));
assert(recs.every(x=>Number.isFinite(Number(x.score))&&Array.isArray(x.reasons)));
const marketHtml=d.v44ManagerMarketHtmlForTest();
assert(marketHtml.includes('RECOMMENDED FOR YOU'));
assert(marketHtml.includes('CARETAKER')||marketHtml.includes('INTERIM'));

// Facility visuals derive from completed facility state and remain safe when the art package is absent.
for(const type of ['training','academy','medical','stadium']){
  const state=d.v44FacilityStateForTest(club.id,type);
  assert(state&&state.type===type);
  assert(Number(state.level)>=1&&Number(state.level)<=5);
  assert(typeof state.assetPath==='string'||state.assetPath==null);
}

// Club Life uses structured, deduplicated continuity facts rather than persisted prose.
const fact1=d.v44ClubLifeFactForTest('FIRST_GOAL',{playerId:playerAfter.id},'2026-09-03');
const fact2=d.v44ClubLifeFactForTest('FIRST_GOAL',{playerId:playerAfter.id},'2026-09-03');
assert(fact1?.id&&fact2?.id);
assert.equal(fact1.id,fact2.id,'Same structured fact should deduplicate');
const pending=d.v44ClubLifePendingFactForTest('FIRST_GOAL','2026-09-04');
assert(pending&&pending.id===fact1.id);
assert.equal(Object.prototype.hasOwnProperty.call(fact1,'story'),false);
assert.equal(Object.prototype.hasOwnProperty.call(fact1,'body'),false);

// Source-level integration guards: V44 must affect authoritative match, facility and UI paths rather than mocked screens.
const root=path.resolve(__dirname,'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const expansion=fs.readFileSync(path.join(root,'career-expansion.js'),'utf8');
const css=fs.readFileSync(path.join(root,'aaa-career-pass.css'),'utf8');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const bootstrap=fs.readFileSync(path.join(root,'career-bootstrap.js'),'utf8');
assert(app.includes('function v44FixtureClubStrength'));
assert(app.includes('v44FixtureClubStrength(home,fixture)'));
assert(app.includes('v44RoleSuitabilityModifier'));
assert(app.includes('fixture.v44RoleAssignments'));
assert(app.includes('function v44AppointCaretaker'));
assert(app.includes('function v44RecommendedVacancies'));
assert(app.includes('function v44ShowManagerScene'));
assert(app.includes("type:'SECONDARY_ROLE_ESTABLISHED'"));
assert(expansion.includes('facilityCompleted'));
assert(expansion.includes('facilityVisual'));
assert(css.includes('V44 — LIVING CLUB & MANAGER WORLD'));
assert(css.includes('.v44-role-versatility'));
assert(css.includes('.v44-manager-scene-overlay'));
assert(css.includes('.v44-job-watchlist'));
assert(/aaa-career-pass\.css\?v=/.test(index));
assert(/app\.js\?v=/.test(bootstrap));

console.log(JSON.stringify({
  status:'PASS',
  integrity,
  roleSuitability:{player:playerAfter.name,primary:playerAfter.role,secondary:alt,low:low.modifier,high:high.modifier,afterGrowth:d.v44RoleFamiliarityForTest(playerAfter.id,alt).familiarity},
  caretaker:{club:aiClub.name,id:caretakerId,permanentScore:caretaker.permanentScore},
  watchedClub:aiClub.name,
  checks:[
    'V44 schema and subsystem versions initialize safely',
    'secondary-role familiarity is bounded, persistent and wired into match strength',
    'AI vacancies receive persistent caretakers while permanent recruitment stays open',
    'job watchlist persists and recommendations use existing suitability',
    'facility visual resolver is level-aware and asset-light safe',
    'manager scene and club-life continuity layers are mounted',
    'structured Club Life facts deduplicate without storing generated prose',
    'V44 cache-busting and UI styles are active'
  ]
},null,2));
