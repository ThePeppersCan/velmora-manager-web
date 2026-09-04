// V32.1 — complete 288-club stadium routing regression.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {runtime,options}=require('./test_matchday_engine.cjs');
const root=path.resolve(__dirname,'..');
const context=vm.createContext({window:{},console,Math,Set,Map});
for(const file of ['clubs.js','world-expansion.js','data/club-stadiums.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context);
const clubs=context.window.VELMORA_CLUBS,catalog=context.window.VELMORA_STADIUMS,byId=new Map(clubs.map(c=>[c.id,c]));
const mapped=Object.keys(catalog.byClubId);
assert.equal(clubs.length,288,'Career database should contain 288 clubs');
assert.equal(mapped.length,clubs.length,'Every career club must have stadium artwork');
assert.equal(new Set(mapped).size,clubs.length,'Club IDs must be unique');
assert.equal(new Set(Object.values(catalog.byClubId)).size,clubs.length,'Every club must have its own asset path');
assert(fs.existsSync(path.join(root,catalog.fallbackImage)),'Emergency fallback artwork must be installed');
for(const c of clubs){
  assert(Object.prototype.hasOwnProperty.call(catalog.byClubId,c.id),'Mapped club ID '+c.id);
  assert(Object.prototype.hasOwnProperty.call(catalog.venueByClubId,c.id),'Mapped venue '+c.id);
  assert(fs.existsSync(path.join(root,catalog.byClubId[c.id])),'Installed asset '+c.id);
  const a=catalog.forHomeClub(c);
  assert.equal(a.stadiumClubId,c.id);
  assert.equal(a.stadiumArtworkPending,false,'Current career club should not use pending/fallback artwork: '+c.id);
  assert.equal(a.venue,String(catalog.venueByClubId[c.id]).toUpperCase());
}
const redwick=byId.get('redwick'),amber=byId.get('amber-step'),hrafnvik=byId.get('hrafnvik'),riva=byId.get('caldria-4-riva-sola');
assert.equal(catalog.forHomeClub(redwick).venue,'KILN LANE');
assert.equal(catalog.forHomeClub(amber).venue,'WAYSTATION PARK');
assert.equal(catalog.forHomeClub(hrafnvik).venue,'HRAFNVIK AERIE');
assert.equal(catalog.forHomeClub(riva).venue,'RIVA SOLA POPOLARE ARENA');
const before=catalog.forHomeClub(redwick).arenaUrl;
assert.equal(catalog.forHomeClub({...redwick,divisionKey:'rsl',tier:1}).arenaUrl,before,'Promotion does not move a club out of its ground');
const clone=catalog.forHomeClub(redwick);clone.hoops.left[0].x=.9;assert.equal(catalog.forHomeClub(redwick).hoops.left[0].x,.082,'Mutable engine copies never corrupt shared calibration');
assert.throws(()=>catalog.forHomeClub(null));
const unknown=catalog.forHomeClub({id:'future-club',name:'Future Club',arena:'Future Field'});
assert(unknown.stadiumArtworkPending);assert(unknown.arenaUrl.startsWith(catalog.fallbackImage));assert.equal(unknown.venue,'FUTURE FIELD');

// Feed every club into the actual Watch Match launcher, both as manager's home and away opponent.
let captured=null; const noop=()=>{};
Object.assign(context,{document:{body:{classList:{add:noop,remove:noop}}},worldSeed:'STADIUM-TEST',currentClub:null,fixtureClubs:f=>({home:byId.get(f.homeClubId),away:byId.get(f.awayClubId)}),prepareAiLineupForFixture:noop,prepareFixtureLineupsForMatchday:()=>({ready:true}),activeStarters:c=>[0,1,2].map(i=>({id:c.id+'-'+i})),matchdayUnavailable:()=>false,matchdayBench:()=>[],v210PlayerConfig:p=>p,v210ClubTactics:()=>({}),v210KnockoutConfig:()=>({}),matchOccasionProfile:()=>({}),v20731UpdateMusicMiniPlayer:noop,v210ResumeCareerMusic:noop,hashString:()=>123,ensureVelmoraQuidditchEngineLoaded:async()=>({open:async opts=>{captured=opts;return true}}),showToast:message=>{throw new Error(message)}});
vm.runInContext('let v210WatchActive=false;const menuMusic=null;',context);
const app=fs.readFileSync(path.join(root,'app.js'),'utf8'),start=app.indexOf('  async function v210OpenCareerMatch('),end=app.indexOf('\n  }',start)+4;
assert(start>=0);vm.runInContext(app.slice(start,end),context);
(async()=>{
 let launches=0;
 for(const home of clubs){
   const away=home.id===redwick.id?amber:redwick;
   const fixture={fixtureId:'QA-'+home.id,homeClubId:home.id,awayClubId:away.id,type:'LEAGUE',date:'2026-09-01'};
   for(const manager of [home,away]){
     context.currentClub=manager;captured=null;await context.v210OpenCareerMatch(fixture);assert(captured,'Fixture launched');
     const expected=catalog.forHomeClub(home);
     assert.equal(captured.stadiumClubId,home.id);assert.equal(captured.arenaUrl,expected.arenaUrl);assert.equal(captured.venue,expected.venue);
     assert.equal(captured.managerSide,manager===home?'home':'away');assert.equal(captured.careerFixtureId,fixture.fixtureId);captured.onClose();launches++;
   }
 }
 // Verify image changes across repeated matches in one engine, never retaining the previous venue.
 const game=runtime();
 for(const home of [redwick,amber,riva,hrafnvik,redwick]){
   const expected=catalog.forHomeClub(home);assert(await game.engine.open({...options(),...expected}));const status=game.engine.getStatus();
   assert.equal(status.stadiumClubId,home.id);assert.equal(status.venue,expected.venue);assert.equal(status.stadiumArtworkUrl,expected.arenaUrl);assert.equal(status.stadiumFallbackUsed,false);await game.engine.close();
 }
 // Missing registered image: retry the installed fallback once while preserving fixture identity and ground name.
 const broken=runtime(new Set([catalog.byClubId.redwick]));const expectedRedwick=catalog.forHomeClub(redwick);
 assert(await broken.engine.open({...options(),...expectedRedwick}));const status=broken.engine.getStatus();
 assert.equal(status.stadiumClubId,'redwick');assert.equal(status.venue,'KILN LANE');assert(status.stadiumFallbackUsed);assert(status.stadiumArtworkUrl.startsWith(catalog.fallbackImage));
 assert.equal(broken.imageRequests.filter(p=>p.startsWith(catalog.byClubId.redwick)).length,1);assert.equal(broken.imageRequests.filter(p=>p.startsWith(catalog.fallbackImage)).length,1);
 broken.q.skipCareerToFulltime();assert.equal(broken.q.state.phase,'fulltime');assert.equal(broken.q.careerResultSnapshot().venue,'KILN LANE');await broken.engine.close();
 const report={status:'PASS',clubs:clubs.length,installedClubStadiums:mapped.length,clubsUsingFallback:0,actualCareerLaunchesChecked:launches,checks:['all 288 career clubs map to unique installed stadium assets','home and away fixtures select fixture home club','all mapped venue names resolve by permanent club ID','promotion/relegation retains stadium','shared hoop/floor coordinates preserved','consecutive fixtures replace previous stadium','missing registered image falls back once','fallback fixture completes and reports the correct venue']};
 console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
