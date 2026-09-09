'use strict';
// V104 · Online career interface
//
// Layout, keyboard access and reduced motion for the lobby and the in-career
// status component, at phone, laptop and wide-screen sizes.

const {test,expect}=require('@playwright/test');

const SIZES={
  mobile:{width:390,height:844},
  laptop:{width:1366,height:768},
  wide:{width:1920,height:1080}
};

async function openMenu(page,size=SIZES.laptop){
  await page.setViewportSize(size);
  await page.route(/\.(?:mp3|wav|ogg)(?:\?.*)?$/i,route=>route.abort());
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>
    document.querySelector('#screenMenu.is-active')?.dataset.menuExperienceReady==='true'
    && !!document.getElementById('btnOnlineCareer'));
  // The transport needs no network for these interface checks.
  await page.waitForFunction(()=>!!window.VelmoraMultiplayerUI);
}

test('Online Career is a first-class main-menu option',async({page})=>{
  await openMenu(page);
  const options=page.locator('#screenMenu .menu-actions .menu-option');
  await expect(options).toHaveCount(5);
  await expect(options.nth(2)).toHaveText(/ONLINE CAREER/);
  // The menu stacks without overlapping.
  const layout=await options.evaluateAll(nodes=>nodes.map(node=>{
    const rect=node.getBoundingClientRect();return{top:rect.top,bottom:rect.bottom};}));
  for(let i=1;i<layout.length;i++)expect(layout[i].top).toBeGreaterThanOrEqual(layout[i-1].bottom-1);
});

test('the lobby opens, traps focus and closes on Escape',async({page})=>{
  await openMenu(page);
  await page.locator('#btnOnlineCareer').click();
  const dialog=page.locator('#velmoraOnlineOverlay');
  await expect(dialog).toHaveClass(/is-open/);
  await expect(dialog).toHaveAttribute('aria-hidden','false');
  await expect(dialog.locator('[role="dialog"]')).toHaveAttribute('aria-modal','true');

  // Guests are told plainly what to do, with no developer wording.
  const body=await dialog.locator('.mp-body').innerText();
  expect(body).not.toMatch(/undefined|null|error|VELMORA_|supabase/i);

  // Tab cycles inside the dialog rather than escaping to the page behind it.
  const inside=async()=>page.evaluate(()=>
    !!document.getElementById('velmoraOnlineOverlay')?.contains(document.activeElement));
  for(let i=0;i<12;i++){await page.keyboard.press('Tab');expect(await inside()).toBe(true);}

  await page.keyboard.press('Escape');
  await expect(dialog).not.toHaveClass(/is-open/);
  await expect(page.locator('#btnOnlineCareer')).toBeFocused();
});

for(const [name,size] of Object.entries(SIZES)){
  test(`the lobby fits a ${name} screen without horizontal scrolling`,async({page})=>{
    await openMenu(page,size);
    await page.locator('#btnOnlineCareer').click();
    await expect(page.locator('#velmoraOnlineOverlay')).toHaveClass(/is-open/);
    const overflow=await page.evaluate(()=>{
      const dialog=document.querySelector('#velmoraOnlineOverlay .mp-dialog');
      return{
        scrollX:dialog.scrollWidth-dialog.clientWidth,
        withinViewport:dialog.getBoundingClientRect().width<=window.innerWidth+1,
        withinHeight:dialog.getBoundingClientRect().height<=window.innerHeight+1
      };
    });
    expect(overflow.scrollX).toBeLessThanOrEqual(1);
    expect(overflow.withinViewport).toBe(true);
    expect(overflow.withinHeight).toBe(true);
  });
}

test('the in-career status chip is compact, expandable and keyboard operable',async({page})=>{
  await openMenu(page);
  // Render the component directly with a representative locked state; this is
  // the interface test, not the transport test.
  await page.evaluate(()=>{
    window.VelmoraMultiplayerUI.render({
      careerId:'c1',careerName:'Sunday League Rivals',careerDate:'2026-08-08',
      online:true,readOnly:false,pending:0,locked:true,resolvable:false,
      waitingMessage:'Waiting for Sam at Blackglass to complete their fixture. You may continue managing your club.',
      others:[{user_id:'u2',manager_name:'Sam Rhodes',club_name:'Blackglass',
        online:true,activity:'Transfers',status:'ACTIVE'}],
      barrier:{locked:true,participants:[{user_id:'u2',state:'PREPARING'}],outstanding:[{user_id:'u2',state:'PREPARING'}]}
    });
  });
  const chip=page.locator('#velmoraOnlineStatus');
  await expect(chip).toBeVisible();
  await expect(chip).toHaveAttribute('data-mode','locked');

  // It stays small until asked to expand: no blocking modal.
  const chipBox=await chip.locator('.mp-status-chip').boundingBox();
  expect(chipBox.height).toBeLessThan(60);
  await expect(page.locator('#velmoraOnlinePanel')).toBeHidden();

  const button=chip.locator('.mp-status-chip');
  await expect(button).toHaveAttribute('aria-expanded','false');
  await button.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#velmoraOnlinePanel')).toBeVisible();
  await expect(button).toHaveAttribute('aria-expanded','true');

  const panelText=await page.locator('#velmoraOnlinePanel').innerText();
  expect(panelText).toContain('Waiting for Sam at Blackglass');
  expect(panelText).toContain('You may continue managing your club');
  expect(panelText).toContain('Sam Rhodes');
  expect(panelText).toContain('Transfers');
  // Nothing confidential and nothing technical.
  expect(panelText).not.toMatch(/VELMORA_|uuid|career_id|u2|undefined/);

  await page.keyboard.press('Escape');
  await expect(page.locator('#velmoraOnlinePanel')).toBeHidden();
  await expect(button).toBeFocused();

  // No browser dialog is ever used for normal operation.
  let dialogs=0;
  page.on('dialog',async d=>{dialogs++;await d.dismiss();});
  await button.click();await button.click();
  expect(dialogs).toBe(0);
});

test('reduced motion is respected in both the browser and game settings',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await openMenu(page);
  await page.locator('#btnOnlineCareer').click();
  const animation=await page.locator('#velmoraOnlineOverlay .mp-dialog')
    .evaluate(node=>getComputedStyle(node).animationName);
  expect(animation).toBe('none');

  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.evaluate(()=>{document.documentElement.dataset.vmReducedMotion='true';});
  const gameSetting=await page.locator('#velmoraOnlineOverlay .mp-dialog')
    .evaluate(node=>getComputedStyle(node).animationName);
  expect(gameSetting).toBe('none');
});
