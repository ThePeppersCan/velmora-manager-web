'use strict';
const {test,expect}=require('@playwright/test');

async function openPreview(page,path,viewport){
  await page.setViewportSize(viewport);
  await page.route(/\.(?:mp3|wav|ogg)(?:\?.*)?$/i,route=>route.abort());
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(path,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.vmPreviewReady==='true');
  expect(errors,'preview should not raise browser errors').toEqual([]);
}

test('compact club selection keeps the browser and preview usable side by side',async({page})=>{
  await openPreview(page,'/?screen=select&club=NYR',{width:800,height:450});
  const layout=await page.evaluate(()=>{
    const frame=document.querySelector('.game-frame').getBoundingClientRect();
    const browser=document.querySelector('.club-browser').getBoundingClientRect();
    const preview=document.querySelector('.club-preview').getBoundingClientRect();
    return{frame:{left:frame.left,right:frame.right,top:frame.top,bottom:frame.bottom},browser:{left:browser.left,right:browser.right,top:browser.top,bottom:browser.bottom,width:browser.width},preview:{left:preview.left,right:preview.right,top:preview.top,bottom:preview.bottom,width:preview.width},pageWidth:document.documentElement.scrollWidth};
  });
  expect(layout.pageWidth).toBeLessThanOrEqual(801);
  expect(layout.browser.width).toBeGreaterThan(400);
  expect(layout.preview.width).toBeGreaterThan(260);
  expect(layout.preview.left).toBeGreaterThan(layout.browser.right);
  expect(layout.browser.top).toBeCloseTo(layout.preview.top,0);
  expect(layout.browser.bottom).toBeLessThanOrEqual(layout.frame.bottom+1);
  expect(layout.preview.right).toBeLessThanOrEqual(layout.frame.right+1);
});

test('training exposes every club focus and saves the selection',async({page})=>{
  await openPreview(page,'/?screen=squad&club=NYR&view=training',{width:1440,height:810});
  const focus=page.locator('[data-tr-club-focus]');
  await expect(focus).toBeVisible();
  await expect(focus.locator('option')).toHaveText(['Balanced','Attack','Defence','Fitness','Technical','Youth','Rest']);
  await focus.selectOption('Attack');
  await expect(focus).toHaveValue('Attack');
  await expect.poll(()=>page.evaluate(()=>window.VELMORA_MANAGER_DEBUG.getCareerPreferences().trainingFocus)).toBe('Attack');
  await focus.selectOption('Rest');
  await expect.poll(()=>page.evaluate(()=>window.VELMORA_MANAGER_DEBUG.getCareerPreferences().trainingFocus)).toBe('Rest');
});

test('pre-season board objectives read as awaiting evidence rather than failure',async({page})=>{
  await openPreview(page,'/?screen=office&club=NYR&tab=board',{width:1440,height:810});
  const leagueCard=page.locator('.office-objective-card',{has:page.locator('.objective-tag span',{hasText:/LEAGUE$/})});
  await expect(leagueCard).toContainText('PENDING');
  await expect(leagueCard).toContainText('AWAITING DATA');
  await expect(page.locator('.board-kpi-ribbon')).toContainText('PRE-SEASON');
  await expect(page.locator('.board-kpi-ribbon')).toContainText('awaiting evidence');
});

test('the music mini-player stays clear of manager creation',async({page})=>{
  await page.setViewportSize({width:1366,height:768});
  await page.route(/\.(?:mp3|wav|ogg)(?:\?.*)?$/i,route=>route.abort());
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await page.locator('#btnNewCareer').click();
  await page.locator('[data-career-new-slot]').first().click();
  await expect(page.locator('#screenManagerCreator')).toHaveClass(/is-active/);
  await expect(page.locator('.career-music-mini')).toBeHidden();
});
