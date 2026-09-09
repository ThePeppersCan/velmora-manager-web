'use strict';
const {test,expect}=require('@playwright/test');

async function openMenu(page){
  await page.setViewportSize({width:1366,height:768});
  await page.route(/\.(?:mp3|wav|ogg)(?:\?.*)?$/i,route=>route.abort());
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#screenMenu.is-active')?.dataset.menuExperienceReady==='true'&&document.querySelector('#btnTutorial'));
}

test('Tutorial is a fully navigable fifth main-menu option',async({page})=>{
  await openMenu(page);
  const options=page.locator('#screenMenu .menu-actions .menu-option');
  await expect(options).toHaveCount(5);
  await expect(options.nth(2)).toHaveText(/ONLINE CAREER/);
  await expect(options.nth(4)).toHaveText(/TUTORIAL/);
  const layout=await options.evaluateAll(nodes=>nodes.map(node=>{const rect=node.getBoundingClientRect();return{top:rect.top,bottom:rect.bottom};}));
  for(let index=1;index<layout.length;index++)expect(layout[index].top).toBeGreaterThanOrEqual(layout[index-1].bottom-1);
  await options.nth(4).click();
  await expect(page.locator('#tutorialModal')).toHaveClass(/is-open/);
  await expect(page.locator('#tutorialModal')).toHaveAttribute('aria-hidden','false');
  await expect(page.locator('#screenMenu')).toHaveAttribute('aria-hidden','false');
  await expect(page.locator('#menuTutorialVideo')).toBeVisible();
  await expect.poll(()=>page.locator('#menuTutorialVideo').evaluate(video=>Number.isFinite(video.duration)&&video.duration>0)).toBe(true);
  const source=await page.locator('#menuTutorialVideo').getAttribute('src');
  expect(source).toBe('assets/tutorial/velmora-manager-tutorial.mp4');
  await page.locator('#tutorialBack').click();
  await expect(page.locator('#tutorialModal')).not.toHaveClass(/is-open/);
  await expect(page.locator('#tutorialModal')).toHaveAttribute('aria-hidden','true');
  await expect(page.locator('#menuTutorialVideo')).toHaveJSProperty('paused',true);
});

test('keyboard navigation reaches Tutorial and Escape returns to the menu',async({page})=>{
  await openMenu(page);
  await page.keyboard.press('End');
  await expect(page.locator('#btnTutorial')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#tutorialModal')).toHaveClass(/is-open/);
  await page.keyboard.press('Escape');
  await expect(page.locator('#tutorialModal')).not.toHaveClass(/is-open/);
  await expect(page.locator('#btnTutorial')).toBeFocused();
});
