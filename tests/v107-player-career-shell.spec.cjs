'use strict';
const {test,expect}=require('@playwright/test');

async function openPreview(page,viewport={width:1440,height:810}){
  await page.setViewportSize(viewport);
  await page.route(/\.(?:mp3|wav|ogg)(?:\?.*)?$/i,route=>route.abort());
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.VELMORA_MANAGER_DEBUG);
  expect(errors,'V107 preview should not raise browser errors').toEqual([]);
}

async function openCareerMode(page){
  await page.locator('#btnNewCareer').click();
  await page.locator('[data-career-new-slot]').first().click();
  await expect(page.locator('#screenCareerMode')).toHaveClass(/is-active/);
}

async function startPlayerCareer(page){
  await page.evaluate(()=>window.VELMORA_MANAGER_DEBUG.v106StartPlayerCareerForTest('CLUB'));
  await expect(page.locator('#screenCentral')).toHaveClass(/is-active/);
}

test('V107 presents Player Career as a first-class offline career choice',async({page})=>{
  await openPreview(page);
  await openCareerMode(page);
  await expect(page.locator('#careerModeManager')).toContainText('MANAGER CAREER');
  await expect(page.locator('#careerModePlayer')).toContainText('PLAYER CAREER');
  const geometry=await page.evaluate(()=>{
    const frame=document.querySelector('.game-frame').getBoundingClientRect();
    return [...document.querySelectorAll('.pc-mode-card')].map(card=>{const box=card.getBoundingClientRect();return{left:box.left,right:box.right,top:box.top,bottom:box.bottom,frameLeft:frame.left,frameRight:frame.right,frameTop:frame.top,frameBottom:frame.bottom};});
  });
  expect(geometry).toHaveLength(2);
  for(const box of geometry){expect(box.left).toBeGreaterThanOrEqual(box.frameLeft);expect(box.right).toBeLessThanOrEqual(box.frameRight);expect(box.top).toBeGreaterThanOrEqual(box.frameTop);expect(box.bottom).toBeLessThanOrEqual(box.frameBottom);}
});

test('Player Career lands on the shared Central dashboard, not a bespoke hub',async({page})=>{
  await openPreview(page);
  await startPlayerCareer(page);
  await expect(page.locator('body')).toHaveClass(/pc-mode-player/);
  // The manager shell is intact: same top bar, same panels, player content.
  const nav=await page.evaluate(()=>[...document.querySelectorAll('#screenCentral .career-tabs>[data-career-nav]')]
    .filter(b=>getComputedStyle(b).display!=='none').map(b=>b.textContent.trim()));
  expect(nav).toEqual(['CENTRAL','TEAM','MATCHDAY','SEASON','MY CAREER']);
  await expect(page.locator('.central-objectives-panel')).toContainText('Your standing');
  await expect(page.locator('#centralObjectives')).toContainText('Manager trust');
  await expect(page.locator('.central-finances-panel')).toContainText('Your contract');
  await expect(page.locator('#centralSeasonSnapshot')).toContainText('YOUR SEASON');
  // No bespoke player screens remain.
  expect(await page.locator('#screenPlayerHub').count()).toBe(0);
  expect(await page.locator('#screenPlayerTeamsheet').count()).toBe(0);
});

test('MY CAREER runs on the Office shell with player-owned panes',async({page})=>{
  await openPreview(page);
  await startPlayerCareer(page);
  await page.evaluate(()=>document.querySelector('#screenCentral .career-tabs>[data-career-nav="office"]').click());
  await expect(page.locator('#screenOffice')).toHaveClass(/is-active/);
  const tabs=await page.evaluate(()=>[...document.querySelectorAll('#officeSubnav [data-office-tab]')]
    .filter(b=>getComputedStyle(b).display!=='none').map(b=>b.dataset.officeTab));
  expect(tabs).toEqual(['inbox','pcstanding','pccontract','pcoffers','pcrecord']);
  for(const [tab,copy] of [['pcstanding','MANAGER TRUST'],['pccontract','CURRENT DEAL'],['pcoffers','INTEREST'],['pcrecord','FULL CAREER']]){
    await page.evaluate(t=>document.querySelector(`#officeSubnav [data-office-tab="${t}"]`).click(),tab);
    await expect(page.locator(`[data-office-pane="${tab}"]`)).toContainText(tab==='pcoffers'?/INTEREST|OPPORTUNITIES/:copy);
  }
});

test('the squad screen becomes read-only for an athlete',async({page})=>{
  await openPreview(page);
  await startPlayerCareer(page);
  await page.evaluate(()=>document.querySelector('#screenCentral .career-tabs>[data-career-nav="squad"]').click());
  await expect(page.locator('#screenSquad')).toHaveClass(/is-active/);
  await expect(page.locator('#screenSquad')).toHaveClass(/pc-readonly/);
  const views=await page.evaluate(()=>[...document.querySelectorAll('#squadSubnav [data-squad-view]')]
    .filter(b=>getComputedStyle(b).display!=='none').map(b=>b.dataset.squadView));
  expect(views).toEqual(['overview','senior','dynamics','legends']);
  await expect(page.locator('#screenSquad .squad-heading h2')).toHaveText('YOUR TEAM');
  await expect(page.locator('#screenSquad .v51-sub-note')).toContainText('study it, not change it');
  expect(await page.locator('#screenSquad .is-user-athlete').count()).toBe(1);
});

test('the team-sheet verdict is published on the shared Matchday screen',async({page})=>{
  await openPreview(page);
  await startPlayerCareer(page);
  const selection=await page.evaluate(()=>window.VELMORA_MANAGER_DEBUG.v106PrepareTeamsheetForTest('BENCH'));
  expect(selection.verdict).toBe('BENCH');
  await expect(page.locator('#screenMatchday')).toHaveClass(/is-active/);
  await expect(page.locator('#matchdayStatusCard')).toContainText('YOUR TEAM SHEET');
  await expect(page.locator('#matchdayStatusCard')).toContainText('BENCH');
  await expect(page.locator('#matchdayStatusCard')).toContainText(/selection points from the Starting Three/);
  await expect(page.locator('#matchdayRecCard')).toContainText('TRUST');
  await expect(page.locator('#matchdayIntelCard')).toContainText('YOUR CONDITION');
  // A player never edits the side.
  expect(await page.locator('#matchEditTeam').evaluate(n=>getComputedStyle(n).display)).toBe('none');
  expect(await page.locator('#screenMatchday .is-user-athlete').count()).toBe(1);
});

test('Manager Career keeps its own shell untouched',async({page})=>{
  await openPreview(page);
  await page.evaluate(()=>window.VELMORA_MANAGER_DEBUG.assignClubForTest(window.VELMORA_CLUBS[0]));
  await page.evaluate(()=>document.querySelector('[data-career-nav="central"]').click());
  await expect(page.locator('#screenCentral')).toHaveClass(/is-active/);
  await expect(page.locator('body')).not.toHaveClass(/pc-mode-player/);
  const nav=await page.evaluate(()=>[...document.querySelectorAll('#screenCentral .career-tabs>[data-career-nav]')]
    .filter(b=>getComputedStyle(b).display!=='none').map(b=>b.textContent.trim()));
  expect(nav).toEqual(['CENTRAL','SQUAD','TRANSFERS','MATCHDAY','SEASON','OFFICE']);
  await expect(page.locator('.central-objectives-panel')).toContainText('Board expectations');
  await expect(page.locator('#centralFinances')).toContainText('TRANSFER BUDGET');
});

test('player career remains usable at compact Steam Deck-style width',async({page})=>{
  await openPreview(page,{width:800,height:450});
  await openCareerMode(page);
  await page.locator('#careerModePlayer').click();
  await expect(page.locator('.pc-route-grid')).toBeVisible();
  const layout=await page.evaluate(()=>({pageWidth:document.documentElement.scrollWidth,viewport:window.innerWidth,contentWidth:document.querySelector('#playerSetupContent').scrollWidth}));
  expect(layout.pageWidth).toBeLessThanOrEqual(layout.viewport+1);
  expect(layout.contentWidth).toBeLessThanOrEqual(layout.viewport+1);
});
