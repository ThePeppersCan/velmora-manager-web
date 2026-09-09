'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {JSDOM}=require('jsdom'),{runtime}=require('./career_test_runtime.cjs');
const root=path.resolve(__dirname,'..'),read=name=>fs.readFileSync(path.join(root,name),'utf8');
const tick=async()=>{for(let i=0;i<24;i++)await Promise.resolve();};
const clone=x=>JSON.parse(JSON.stringify(x));

(async()=>{
  const r=runtime(),q=r.q,c=r.context.VELMORA_CLUBS.find(club=>club.id==='redwick');
  r.d.assignClubForTest(c);q.initializeCareerLifecycle();q.setCareerDate('2026-08-10');c.budget='£100000000';q.v25ClubFinance(c).wageBudget=1000000;
  const dom=new JSDOM(read('index.html'),{url:'https://velmora.example/'}),doc=dom.window.document,requests=[];
  class Image{set src(value){requests.push(value);Promise.resolve().then(()=>this.onload?.());}}
  dom.window.Image=Image;for(const node of r.nodes.values())node.isConnected=false;
  r.context.document=doc;r.context.FormData=dom.window.FormData;r.context.Element=dom.window.Element;r.context.HTMLElement=dom.window.HTMLElement;
  r.context.VELMORA_EXPANSION.initUI();
  const seller=q.state().clubs.find(club=>club.id!==c.id&&club.tier===c.tier&&club.world===c.world),original=q.getSquad(seller).find(player=>!player.captain),p={...original,club:seller};
  const modal=doc.querySelector('#negotiationModal'),scene=()=>modal.querySelector('.v73-cutscene'),shot=()=>scene()?.dataset.v72SceneArt||'',current=()=>scene()?.querySelector('.v73-shot.is-current');

  q.openNegotiation(p);await tick();
  assert(shot().endsWith('boardroom-wide.png'));assert(modal.classList.contains('v73-has-cast'));
  assert(current().querySelector('[data-v73-role="playerManager"]'),'Player manager is staged');
  assert(current().querySelector('[data-v73-role="oppositionManager"]'),'Selling manager is staged');
  assert(current().querySelector('[data-v73-role="oppositionManager"].is-speaker'),'Selling manager delivers the opening line');
  assert.equal(current().querySelectorAll('[data-v73-role="oppositionManager"] .v73-character-frame').length,2,'Speaking manager has closed/open expression frames');
  assert(current().querySelector('.v73-furniture').src.endsWith('boardroom-wide-foreground.png'),'Furniture foreground occludes the cast');
  assert.equal(current().querySelector('.v73-plate').tagName,'IMG','Scene plates use decoded image elements to prevent black transition frames');
  assert(current().querySelector('.v73-camera-depth'),'Camera-depth foreground is present');
  assert(current().querySelector('.v73-light-pass'),'Lighting pass is present');
  assert(doc.querySelector('#v35AgreementType'),'Original deal controls remain live');

  // Advanced fee structures are still negotiated in the boardroom cutscene.
  const dealType=doc.querySelector('#v35AgreementType');dealType.value='TRANSFER';dealType.dispatchEvent(new dom.window.Event('change',{bubbles:true}));await tick();
  assert(modal.classList.contains('v73-has-cast'),'Structured deals retain the cinematic room');
  assert(/boardroom-(wide|table)\.png$/.test(shot()),'Sell-ons, instalments and add-ons stay in the boardroom');
  assert(doc.querySelector('#v35NegotiationTerms [name="installments"]'),'The cutscene desk exposes guaranteed payment schedules');
  assert(doc.querySelector('#v35NegotiationTerms [name="addOnType"]'),'The cutscene desk exposes conditional add-ons');
  q.openNegotiation(p);await tick();

  const session=q.clubNegotiationSession(p,true),before=JSON.stringify(session),firstManagerRenderIds=[...current().querySelectorAll('canvas[data-manager-render-id]')].map(node=>node.dataset.managerRenderId);
  q.v72StageNegotiation(p,'boardroom',session,'idle');await tick();assert.equal(JSON.stringify(session),before,'Staging never writes session state');
  const refreshedManagerRenderIds=[...current().querySelectorAll('canvas[data-manager-render-id]')].map(node=>node.dataset.managerRenderId);
  assert(firstManagerRenderIds.length>=4&&refreshedManagerRenderIds.length>=4,'Both manager expression pairs receive render requests');
  assert(refreshedManagerRenderIds.every(id=>!firstManagerRenderIds.includes(id)),'Every staged render gets fresh manager canvas requests');
  const low=[.8,.85,.9,.95].map(f=>Math.round(session.preferredPrice*f/1000)*1000).find(amount=>q.evaluateClubTransferOffer(p,amount,clone(session)).outcome==='counter');assert(low,'Find an actual counter proposal');
  doc.querySelector('#offerAmount').value=String(low);doc.querySelector('#submitTransferOffer').click();await tick();assert(shot().endsWith('boardroom-table.png'));for(const role of ['playerManager','oppositionManager'])assert(current().querySelector(`[data-v73-role="${role}"]`),`${role} remains visible in the table shot`);
  doc.querySelector('#offerAmount').value=String(session.lastSellerCounter);doc.querySelector('#submitTransferOffer').click();await tick();assert(shot().endsWith('boardroom-table.png'));for(const role of ['playerManager','oppositionManager'])assert(current().querySelector(`[data-v73-role="${role}"]`),`${role} remains visible at the table`);
  doc.querySelector('#submitTransferOffer').click();await tick();assert(shot().endsWith('cafe-wide.png'));assert(!doc.querySelector('#v35AgreementType'),'Deal types remain club-side only');
  for(const role of ['playerManager','agent','player'])assert(current().querySelector(`[data-v73-role="${role}"]`),`${role} is staged in contract talks`);
  const agentName=current().querySelector('[data-v73-role="agent"] .v73-character-label').textContent.trim();
  assert(current().querySelector('[data-v73-role="agent"].is-speaker'),'Generated agent is the speaker');
  assert(current().querySelector('[data-v73-role="player"] .smart-avatar'),'The real player avatar is used');

  doc.querySelector('#walkAwayContract').click();await tick();assert(shot().endsWith('boardroom-table.png'),'Back preserves agreed-fee shot');
  q.openContractNegotiation(p,session.agreedFee);await tick();assert.equal(current().querySelector('[data-v73-role="agent"] .v73-character-label').textContent.trim(),agentName,'Generated agent identity stays stable within the negotiation');
  const contract=q.contractNegotiationSession(p,'SIGNING',true),packageFor=f=>({wage:Math.round(contract.expectedWage*f/100)*100,bonus:0,role:contract.desiredRole,years:contract.preferredYears});
  const offer=[.85,.9,.8,.95].map(packageFor).find(pack=>q.evaluateContractPackage(p,pack,clone(contract)).status==='counter');assert(offer,'Find a real personal-terms counter');
  for(const [id,value] of Object.entries({contractWage:offer.wage,contractBonus:offer.bonus,contractRole:offer.role,contractYears:offer.years}))doc.getElementById(id).value=String(value);
  doc.querySelector('#submitContractOffer').click();await tick();assert(shot().endsWith('cafe-table-wide.png'));for(const role of ['playerManager','agent','player'])assert(current().querySelector(`[data-v73-role="${role}"]`),`${role} remains visible in the table shot`);
  const wage=doc.querySelector('#contractWage');wage.value=String(contract.expectedWage*2);wage.dispatchEvent(new dom.window.Event('input',{bubbles:true}));await tick();assert(shot().endsWith('cafe-table-wide.png'));for(const role of ['playerManager','agent','player'])assert(current().querySelector(`[data-v73-role="${role}"]`),`${role} remains visible in the table-wide shot`);
  doc.querySelector('#submitContractOffer').click();await tick();assert(shot().endsWith('cafe-table-wide.png'));for(const role of ['playerManager','agent','player'])assert(current().querySelector(`[data-v73-role="${role}"]`),`${role} remains visible in the agreed table shot`);
  const originalCount=q.getSquad(c).length;doc.querySelector('#submitContractOffer').click();await tick();assert.equal(q.getSquad(c).length,originalCount+1);assert(!modal.classList.contains('is-open'),'Original confirm button completes signing');

  // A club walkout must replace the opening screen with a visible terminal result.
  const walkSource=q.getSquad(seller).find(player=>!player.captain),walkPlayer={...walkSource,club:seller};
  q.openNegotiation(walkPlayer);await tick();doc.querySelector('#offerAmount').value='1';doc.querySelector('#submitTransferOffer').click();await tick();
  assert(doc.querySelector('#negotiationResponse').classList.contains('is-walked'),'Walkout response is rendered instead of being swallowed by the closed-talks guard');
  assert.match(doc.querySelector('#negotiationResponse').textContent,/walk away|closed/i);assert.equal(doc.querySelector('#submitTransferOffer').disabled,true,'Closed talks cannot be resubmitted');
  assert.equal(q.state().transferActivity.get(walkPlayer.id).status,'Talks Collapsed');q.closeNegotiation();

  const api=r.context.VelmoraNegotiationScene;
  for(const stage of ['boardroom','agent'])for(const status of ['idle','accepted','counter','rejected','final','walked']){
    const lines=new Set();for(let i=0;i<40;i++)lines.add(api.flavor({stage,status,playerId:'P'+i,session:{id:'S'+i,personality:'HARDLINE'},ambition:85}));
    assert(lines.size>=3,`${stage} ${status}: three distinct cosmetic lines`);
    for(const line of lines)assert(!/HARDLINE|ROLE_FOCUSED|DEALMAKER|FINANCIALLY_PRESSURED/.test(line));
  }

  // A late load from an obsolete shot cannot replace the current scene.
  const pending=[];dom.window.Image=class{set src(src){pending.push({src,image:this});}};
  vm.runInContext(read('negotiation-cinematic.js'),r.context);
  const fresh=r.context.VelmoraNegotiationScene,spec={stage:'boardroom',status:'idle',playerId:p.id,playerName:p.name,clubName:seller.name,session:{id:'race'},cast:{}};
  fresh.update(modal,spec);fresh.update(modal,{...spec,stage:'agent'});
  for(const item of pending.filter(x=>!x.src.endsWith('boardroom-wide.png')&&!x.src.endsWith('boardroom-wide-foreground.png')))item.image.onload?.();
  await tick();assert.equal(modal.dataset.v72Stage,'agent');assert(shot().endsWith('cafe-wide.png'));
  for(const item of pending.filter(x=>x.src.endsWith('boardroom-wide.png')||x.src.endsWith('boardroom-wide-foreground.png')))item.image.onload?.();
  await tick();assert(shot().endsWith('cafe-wide.png'),'Obsolete boardroom load is ignored');
  fresh.reset(modal);assert(!modal.classList.contains('v73-has-cast'));

  // Asset-light builds keep the original accessible form instead of showing broken layers.
  dom.window.Image=class{set src(_value){Promise.resolve().then(()=>this.onerror?.());}};vm.runInContext(read('negotiation-cinematic.js'),r.context);
  q.renderNegotiation({...p,club:seller},100000,null);await tick();assert(!modal.classList.contains('v73-has-cast'));assert(doc.querySelector('#offerAmount'));assert(doc.querySelector('#submitTransferOffer'));assert(doc.querySelector('#v35AgreementType'));
  q.renderContractNegotiation(p,100000,null);await tick();assert(!modal.classList.contains('v73-has-cast'));assert(doc.querySelector('#contractWage'));assert(doc.querySelector('#contractClauseMode'));

  const css=read('negotiation-cinematic.css');
  assert(css.includes('@media (prefers-reduced-motion:reduce)'));assert(css.includes('transition:none!important'));assert(css.includes('@media (max-width:720px)'));assert(css.includes('@media (max-width:520px)'));
  assert(css.includes('.v73-furniture'));assert(css.includes('.v73-mouth-open'));assert(css.includes('max-height:min(54cqh,640px)'));assert(css.includes('width:clamp(190px,min(15cqw,28cqh),320px)'));assert(css.includes('scaleX(var(--v73-facing,1))'));
  assert(css.includes('.v73-shot-stage{position:absolute;inset:0;width:100%;height:100%;overflow:hidden}'),'Cinematic coordinates are owned by the game frame, not the browser viewport');
  assert(css.includes('.v73-shot[data-v73-shot^="cafe"] .v73-cast{z-index:5}'),'Café characters stay continuous above the sofa art while the negotiation desk covers their lower bodies');
  assert(css.includes('.v73-character-label{top:-6%;bottom:auto}'),'Short viewports must not stretch character labels over the cast');
  assert(css.includes('width:min(1460px,calc(100% - 48px))'),'Large viewports receive a properly proportioned deal desk');
  assert(css.includes('overflow:hidden!important'),'The card shell keeps its header and close control fixed while the body handles overflow');
  assert(css.includes('padding:12px 66px 12px 20px'),'The header reserves space for the close control');
  assert(css.includes('#negotiationModal.v73-has-cast #v35NegotiationTerms'),'Advanced transfer structures are presented inside the cinematic deal desk');
  assert(api.SHOTS['cafe-wide'].placements.agent.scale<=.92&&api.SHOTS['cafe-wide'].placements.player.scale<api.SHOTS['cafe-wide'].placements.agent.scale,'Café cast is reduced to seated proportions, with the player slightly smaller than the representatives');
  assert(api.SHOTS['cafe-wide'].placements.agent.y>=.4&&api.SHOTS['cafe-wide'].placements.playerManager.y>=.4,'Café representatives extend naturally behind the negotiation desk instead of ending at a hard crop');
  assert(api.SHOTS['cafe-wide'].placements.player.x>=.64&&api.SHOTS['cafe-wide'].placements.player.x<=.70&&api.SHOTS['cafe-wide'].placements.player.y>=.4&&api.SHOTS['cafe-wide'].placements.player.flipX,'The player sits beside the agent, faces the representatives and stays clear of the plant');
  for(const shot of ['cafe-wide','cafe-ots','cafe-table-wide','cafe-table-close'])for(const role of ['playerManager','agent','player'])assert(!('cropBottom' in api.SHOTS[shot].placements[role]),`${shot} keeps the complete ${role} sprite so the desk, not a clipping rectangle, hides the lower body`);
  for(const shot of ['boardroom-wide','boardroom-reverse','boardroom-table'])for(const role of ['playerManager','oppositionManager'])assert(api.SHOTS[shot].placements[role].y>=.42&&api.SHOTS[shot].placements[role].y<=.5,`${shot} keeps ${role}'s upper body above the desk and lower body behind it`);
  for(const shot of ['cafe-wide','cafe-ots','cafe-table-wide','cafe-table-close'])for(const role of ['playerManager','agent','player'])assert(api.SHOTS[shot].placements[role].y>=.4&&api.SHOTS[shot].placements[role].y<=.5,`${shot} keeps ${role}'s upper body above the desk and lower body behind it`);
  assert(api.SHOTS['cafe-table-close'].placements.playerManager.x>=.28&&api.SHOTS['cafe-table-close'].placements.agent.x>=.46&&api.SHOTS['cafe-table-close'].placements.player.x>=.64,'The close café composition keeps the group clear of the foreground mugs and plant');
  assert(api.SHOTS['boardroom-reverse'].placements.playerManager.x>=.24,'Reverse shot keeps the player manager inside frame');
  assert(api.SHOTS['cafe-ots'].placements.agent.x>=.45&&api.SHOTS['cafe-ots'].placements.agent.y>=.4&&api.SHOTS['cafe-ots'].placements.agent.scale<=.90,'Café reverse fallback keeps the speaking agent behind the desk');
  assert(api.SHOTS['cafe-ots'].placements.player.x>=.64&&api.SHOTS['cafe-ots'].placements.player.x<=.70&&api.SHOTS['cafe-ots'].placements.player.y>=.4,'Café reverse fallback keeps the player beside the agent and behind the desk');
  assert(css.includes('top:calc(var(--v73-y) - 9cqh)'),'Short desktop frames lift the cast enough to preserve visible seated torsos');
  assert(css.includes('.v73-character.v73-role-player .v73-character-label{top:26%}'),'Player labels follow the visible artwork instead of floating above transparent sprite padding');
  for(const plate of ['boardroom-wide.png','boardroom-table.png','cafe-wide.png','cafe-table-wide.png'])assert(requests.some(src=>src.endsWith(plate)),`${plate} loaded during the stable real flow`);
  for(const shot of Object.values(api.SHOTS))assert(api.PLATES.includes(shot.plate),`${shot.plate} remains a registered fallback plate`);
  assert(requests.some(src=>src.includes('cutscene-kit/')&&src.endsWith('-foreground.png')));assert(requests.some(src=>src.includes('cutscene-kit/')&&src.endsWith('-light-overlay.png')));assert(requests.some(src=>src.includes('cutscene-kit/camera-')));
  console.log(JSON.stringify({status:'PASS',checks:['live club and contract negotiation paths','visible terminal result after a club walkout','fresh manager canvases on every shot','proportionate complete cast in every stable camera angle','persistent generated agent identity','closed/open speaking frames','decoded scene plates without black transition frames','furniture occlusion, camera depth, shadows and light','frame-relative wide and table cuts','unchanged simulation state','stale-load protection','asset-light fallback','desktop, laptop, mobile and reduced-motion contracts']},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
