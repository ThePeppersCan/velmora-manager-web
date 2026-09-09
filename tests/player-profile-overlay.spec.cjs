'use strict';
const {test,expect}=require('@playwright/test');

test('player profile closes cleanly above another game window',async({page})=>{
  await page.route(/\.(?:mp3|wav|ogg)(?:\?.*)?$/i,route=>route.abort());
  await page.goto('/?screen=squad&club=NYR',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.vmPreviewReady==='true');
  const playerId=await page.locator('[data-v48-player],[data-season-player]').first().evaluate(node=>node.dataset.v48Player||node.dataset.seasonPlayer);

  await page.evaluate(id=>{
    const underlay=document.createElement('div');
    underlay.id='careerNewsOverlay';
    underlay.className='modal-backdrop vm-news-overlay is-open';
    underlay.setAttribute('aria-hidden','false');
    underlay.innerHTML='<button type="button">Underlying window</button>';
    document.body.appendChild(underlay);
    window.VelmoraPlayerProfiles.open(id);
  },playerId);

  const profile=page.locator('#v48PlayerProfile');
  const underlay=page.locator('#careerNewsOverlay');
  await expect(profile).toBeVisible();
  await expect(profile.locator('[data-close]').first()).toContainText('Back to News');
  await expect(profile).not.toHaveAttribute('inert','');
  await expect(underlay).toHaveAttribute('inert','');
  await profile.locator('[data-close]').first().click();
  await expect(profile).toHaveCount(0);
  await expect(underlay).not.toHaveAttribute('inert','');
  await expect(underlay).toHaveAttribute('aria-hidden','false');

  await page.evaluate(id=>window.VelmoraPlayerProfiles.open(id),playerId);
  await expect(page.locator('#v48PlayerProfile')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#v48PlayerProfile')).toHaveCount(0);
  await expect(underlay).toBeVisible();
});
