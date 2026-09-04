const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {runtime}=require('./career_test_runtime.cjs');
const root=path.resolve(__dirname,'..');
const must=[
 'assets/matchday-presentation/backdrops/velmora-matchday-neutral.png',
 'assets/matchday-presentation/brooms/01-elegant-upright.png',
 'assets/matchday-presentation/shadows/shadow-standard.png',
 'assets/matchday-presentation/status/captain-star.png',
 'assets/matchday-presentation/frames/frame-broadcast-block.png',
 'assets/matchday-presentation/captain/captain-c.png',
 'assets/matchday-presentation/lighting/light-halo.png',
 'assets/matchday-presentation/decorations/three-hoops.png'
];
const withoutAssets=process.argv.includes('--without-assets');
if(!withoutAssets)must.forEach(f=>assert.ok(fs.existsSync(path.join(root,f)),`missing ${f}`));
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const heroStart=html.indexOf('<section class="central-match-hero ');
const heroEnd=html.indexOf('<section class="central-manager-briefing"',heroStart);
const btn=html.indexOf('id="centralContinue"',heroStart);
assert.ok(heroStart>=0&&heroEnd>heroStart&&btn>heroStart&&btn<heroEnd,'central match preview button is missing from the Central sequence');
assert.ok(btn<html.indexOf('</section>',heroStart),'Match Preview stays within its fixture card');
assert.ok(html.indexOf('<footer class="central-fixture-footer"',heroStart)<btn,'Match Preview has a dedicated footer');
assert.equal((html.match(/id="centralContinue"/g)||[]).length,1,'only one preview action exists');
for(const id of ['centralHomeCaptainSprite','centralAwayCaptainSprite','centralHomeStarters','centralAwayStarters','centralHomeSubs','centralAwaySubs','centralCompetitionLabel'])assert.ok(html.includes(`id="${id}"`),`missing ${id}`);
const r=runtime(),club=r.q.state().clubs[0];
r.q.set('currentClub',club);r.q.initializeCareerLifecycle();
const preview=r.node('centralContinue'),footer=r.node('#screenCentral .central-fixture-footer');
let moves=0;footer.appendChild=n=>{moves++;n.parentElement=footer;};
r.q.renderCentral();r.q.renderCentral();
assert.equal(moves,1,'repeated rendering does not detach or duplicate the preview button');
assert.equal(preview.listenerCount('click'),1,'preview retains its original action listener');
preview.dispatch('click',{currentTarget:preview,preventDefault(){},stopPropagation(){}});
assert.equal(r.d.screenArchitectureIntegrityForTest().activePrimary,'matchday','preview opens the actual matchday screen');
const managerAction=r.node('#centralSeasonSnapshot [data-central-manager-career]');
assert.ok(managerAction.listenerCount('click')>0,'manager status retains its action');
managerAction.dispatch('click',{});
assert.equal(r.d.screenArchitectureIntegrityForTest().activePrimary,'office','manager status opens the actual office screen');

const node=id=>r.nodes.get(id)||r.node(id),countLi=x=>(x.match(/<li\b/g)||[]).length;
assert.equal(countLi(node('centralHomeStarters').innerHTML),3,'home Starting Three should show three slots');
assert.equal(countLi(node('centralAwayStarters').innerHTML),3,'away Starting Three should show three slots');
assert.equal(countLi(node('centralHomeSubs').innerHTML),5,'home substitutes should show five slots');
assert.equal(countLi(node('centralAwaySubs').innerHTML),5,'away substitutes should show five slots');
assert.match(String(node('centralHomeCaptainSprite').src||''),/assets\/quidditch-engine\/standing\/player-\d+\.png/,'home featured player should use existing standing sprite');
assert.match(String(node('centralAwayCaptainSprite').src||''),/assets\/quidditch-engine\/standing\/player-\d+\.png/,'away featured player should use existing standing sprite');
assert.ok(node('centralHomeCaptainName').textContent,'home featured captain name is populated');
assert.ok(node('centralAwayCaptainName').textContent,'away featured captain name is populated');
assert.ok(node('centralCompetitionLabel').textContent,'competition label is populated');
console.log(JSON.stringify({status:'PASS',checks:[
 withoutAssets?'asset checks skipped explicitly (asset folders omitted from this upload)':'existing presentation assets are installed',
 'Match Preview is nested in the fixture footer in normal document flow',
 'repeat renders retain one preview button and its original listener',
 'preview opens Matchday and manager status opens Office',
 'both featured captains use existing standing player sprites',
 'both full Starting Three lists render',
 'both five-player substitute lists render',
 'competition and featured-player presentation data populate through the live career renderer'
],sample:{homeCaptain:node('centralHomeCaptainName').textContent,awayCaptain:node('centralAwayCaptainName').textContent,competition:node('centralCompetitionLabel').textContent}},null,2));
