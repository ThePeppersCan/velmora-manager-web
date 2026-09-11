'use strict';
const {test,expect}=require('@playwright/test');

async function openPreview(page,viewport={width:1440,height:810}){
  await page.setViewportSize(viewport);
  await page.route(/\.(?:mp3|wav|ogg)(?:\?.*)?$/i,route=>route.abort());
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.VELMORA_MANAGER_DEBUG);
  expect(errors,'V106 preview should not raise browser errors').toEqual([]);
}

async function openCareerMode(page){
  await page.locator('#btnNewCareer').click();
  await page.locator('[data-career-new-slot]').first().click();
  await expect(page.locator('#screenCareerMode')).toHaveClass(/is-active/);
}

test('V106 presents Player Career as a first-class offline career choice',async({page})=>{
  await openPreview(page);
  await openCareerMode(page);
  await expect(page.locator('#careerModeManager')).toContainText('MANAGER CAREER');
  await expect(page.locator('#careerModePlayer')).toContainText('PLAYER CAREER');
  await expect(page.locator('#careerModePlayer')).toContainText('DETERMINISTIC SELECTION');
  const geometry=await page.evaluate(()=>{
    const frame=document.querySelector('.game-frame').getBoundingClientRect();
    return [...document.querySelectorAll('.pc-mode-card')].map(card=>{const box=card.getBoundingClientRect();return{left:box.left,right:box.right,top:box.top,bottom:box.bottom,frameLeft:frame.left,frameRight:frame.right,frameTop:frame.top,frameBottom:frame.bottom};});
  });
  expect(geometry).toHaveLength(2);
  for(const box of geometry){expect(box.left).toBeGreaterThanOrEqual(box.frameLeft);expect(box.right).toBeLessThanOrEqual(box.frameRight);expect(box.top).toBeGreaterThanOrEqual(box.frameTop);expect(box.bottom).toBeLessThanOrEqual(box.frameBottom);}
  await expect(page.locator('#screenCareerMode')).toHaveScreenshot('player-career-mode.png',{mask:[page.locator('.career-music-mini')]});
});

test('created athlete reaches a club hub with a real manager, trust and fixture',async({page})=>{
  await openPreview(page);
  await openCareerMode(page);
  await page.locator('#careerModePlayer').click();
  await page.evaluate(()=>window.VELMORA_MANAGER_DEBUG.v106SetWorldSeedForTest('VELMORA-V106-VISUAL-QA'));
  await page.locator('[data-pc-route="create"]').click();
  await page.locator('#pcPlayerName').fill('Mara Voss');
  await page.locator('[data-pc-role="DEFENDER"]').click();
  await page.locator('[data-pc-create-continue]').click();
  await page.locator('[data-pc-start="club"]').click();
  await page.locator('[data-pc-club]').first().click();
  await expect(page.locator('#screenPlayerHub')).toHaveClass(/is-active/);
  await expect(page.locator('.pc-player-hero')).toContainText('Mara Voss');
  await expect(page.locator('.pc-trust-panel')).toContainText('MANAGER TRUST');
  await expect(page.locator('.pc-manager-card')).toContainText('YOUR MANAGER');
  await expect(page.locator('.pc-next-match')).toContainText('NEXT FIXTURE');
  const snapshot=await page.evaluate(()=>window.VELMORA_MANAGER_DEBUG.v106PlayerCareerSnapshotForTest());
  expect(snapshot.careerMode).toBe('PLAYER');
  expect(snapshot.managerIsAi).toBe(true);
  expect(snapshot.isUserPlayer).toBe(true);
  await expect(page.locator('#screenPlayerHub')).toHaveScreenshot('player-career-hub.png',{mask:[page.locator('.career-music-mini')]});
});

test('official teamsheet gives a stable bench verdict with visible reasons',async({page})=>{
  await openPreview(page);
  const selection=await page.evaluate(()=>{window.VELMORA_MANAGER_DEBUG.v106StartPlayerCareerForTest('CLUB');return window.VELMORA_MANAGER_DEBUG.v106PrepareTeamsheetForTest('BENCH');});
  expect(selection.verdict).toBe('BENCH');
  await expect(page.locator('#screenPlayerTeamsheet')).toHaveClass(/is-active/);
  await expect(page.locator('.pc-verdict')).toContainText('BENCH');
  await expect(page.locator('.pc-verdict')).toContainText(/selection points from the Starting Three/);
  await expect(page.locator('.pc-reason-list')).toContainText('ABILITY');
  await expect(page.locator('.pc-reason-list')).toContainText('TACTICAL FIT');
  await expect(page.locator('.pc-reason-list')).toContainText('MANAGER TRUST');
  const userRows=page.locator('.pc-sheet-row.is-user');
  await expect(userRows).toHaveCount(1);
  await expect(page.locator('#screenPlayerTeamsheet')).toHaveScreenshot('player-career-teamsheet-bench.png',{mask:[page.locator('.career-music-mini')]});
});

test('player career remains usable at compact Steam Deck-style width',async({page})=>{
  await openPreview(page,{width:800,height:450});
  await openCareerMode(page);
  await page.locator('#careerModePlayer').click();
  await expect(page.locator('.pc-route-grid')).toBeVisible();
  const layout=await page.evaluate(()=>({pageWidth:document.documentElement.scrollWidth,viewport:window.innerWidth,contentWidth:document.querySelector('#playerSetupContent').scrollWidth}));
  expect(layout.pageWidth).toBeLessThanOrEqual(layout.viewport+1);
  expect(layout.contentWidth).toBeLessThanOrEqual(layout.viewport+1);
  await expect(page.locator('[data-pc-route="create"]')).toBeVisible();
  await expect(page.locator('[data-pc-route="existing"]')).toBeVisible();
});
