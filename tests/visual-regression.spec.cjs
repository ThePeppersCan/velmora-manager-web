'use strict';
const {test,expect}=require('@playwright/test');

const viewports=[
  {name:'laptop',width:1366,height:768},
  {name:'desktop',width:1920,height:1080},
  {name:'wide-short',width:2048,height:1080}
];
const coreScreens=['central','squad','transfers','matchday'];

async function openPreview(page,path,viewport){
  await page.setViewportSize({width:viewport.width,height:viewport.height});
  await page.route(/\.(?:mp3|wav|ogg)(?:\?.*)?$/i,route=>route.abort());
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(path,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.vmPreviewReady==='true');
  await page.evaluate(async()=>{
    document.documentElement.dataset.vmReducedMotion='true';
    if(document.fonts?.ready)await document.fonts.ready;
    const visibleImages=[...document.images].filter(image=>image.offsetParent!==null);
    const settled=Promise.all(visibleImages.map(image=>image.complete?Promise.resolve():new Promise(resolve=>{image.addEventListener('load',resolve,{once:true});image.addEventListener('error',resolve,{once:true});})));
    await Promise.race([settled,new Promise(resolve=>setTimeout(resolve,5000))]);
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  });
  expect(errors,'preview should not raise browser errors').toEqual([]);
}

async function expectFrameContract(page,viewport){
  const geometry=await page.evaluate(()=>{
    const frame=document.querySelector('.game-frame'),active=document.querySelector('.screen.is-active'),body=document.body,html=document.documentElement;
    const rect=node=>{const r=node.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
    return{frame:rect(frame),active:rect(active),scrollWidth:Math.max(body.scrollWidth,html.scrollWidth),scrollHeight:Math.max(body.scrollHeight,html.scrollHeight)};
  });
  expect(geometry.scrollWidth).toBeLessThanOrEqual(viewport.width+1);
  expect(geometry.scrollHeight).toBeLessThanOrEqual(viewport.height+1);
  expect(geometry.frame.x).toBeGreaterThanOrEqual(-.5);
  expect(geometry.frame.y).toBeGreaterThanOrEqual(-.5);
  expect(geometry.frame.right).toBeLessThanOrEqual(viewport.width+.5);
  expect(geometry.frame.bottom).toBeLessThanOrEqual(viewport.height+.5);
  expect(geometry.frame.width/geometry.frame.height).toBeCloseTo(16/9,2);
  expect(Math.abs((geometry.frame.x*2+geometry.frame.width)-viewport.width)).toBeLessThanOrEqual(2);
  expect(Math.abs((geometry.frame.y*2+geometry.frame.height)-viewport.height)).toBeLessThanOrEqual(2);
  expect(geometry.active.width).toBeCloseTo(geometry.frame.width,0);
  expect(geometry.active.height).toBeCloseTo(geometry.frame.height,0);
}

for(const viewport of viewports){
  for(const screen of coreScreens){
    test(`${screen} respects the ${viewport.name} frame`,async({page})=>{
      await openPreview(page,`/?screen=${screen}&club=NYR`,viewport);
      await expectFrameContract(page,viewport);
      await expect(page).toHaveScreenshot(`${screen}-${viewport.name}.png`,{fullPage:true});
    });
  }
}

test('Career Threads has a readable, non-overlapping home on Central',async({page})=>{
  await openPreview(page,'/?screen=central&club=NYR',viewports[0]);
  const panel=page.locator('#centralCareerThreads');
  await expect(panel).toBeVisible();
  await expect(panel.locator('header strong')).toHaveText('WHAT YOU ARE CARRYING');
  await expect(panel.locator('.central-thread-empty')).toBeVisible();
  const geometry=await page.evaluate(()=>{
    const rect=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
    const panel=document.querySelector('#centralCareerThreads');
    return{panel:rect('#centralCareerThreads'),snapshot:rect('#centralSeasonSnapshot'),briefing:rect('.central-manager-briefing'),frame:rect('.game-frame'),background:getComputedStyle(panel).backgroundImage,titleSize:parseFloat(getComputedStyle(panel.querySelector('header strong')).fontSize)};
  });
  expect(geometry.panel.x).toBeGreaterThanOrEqual(geometry.snapshot.right-1);
  expect(geometry.panel.y).toBeGreaterThanOrEqual(geometry.briefing.bottom-1);
  expect(geometry.panel.right).toBeLessThanOrEqual(geometry.frame.right+1);
  expect(geometry.panel.bottom).toBeLessThanOrEqual(geometry.frame.bottom+1);
  expect(geometry.background).not.toBe('none');
  expect(geometry.titleSize).toBeGreaterThanOrEqual(8);
});

test('Club Pulse exposes four independent audience dossiers',async({page})=>{
  const viewport=viewports[0];
  await openPreview(page,'/?screen=central&club=NYR',viewport);
  await expect(page.locator('[data-club-pulse-audience]')).toHaveCount(4);
  await expect(page.locator('[data-club-pulse-audience="press"]')).toBeVisible();
  await page.locator('[data-v65-pulse-details]').click();
  await expect(page.locator('#clubPulseDossier')).toBeVisible();
  await expect(page.locator('.club-pulse-dossier-grid>article')).toHaveCount(4);
  await expect(page.locator('.club-pulse-memory-list')).toHaveCount(4);
  await expect(page).toHaveScreenshot('club-pulse-dossier-laptop.png',{fullPage:true});
});

for(const viewport of [viewports[0],viewports[2]]){
  test(`manager career fills the command centre at ${viewport.name}`,async({page})=>{
    await openPreview(page,'/?screen=manager-career&club=NYR&view=career',viewport);
    await expectFrameContract(page,viewport);
    await expect(page.locator('.mc-command-hero')).toBeVisible();
    await expect(page.locator('.mc-signal-grid article')).toHaveCount(4);
    await expect(page.locator('.mc-target-grid article')).toHaveCount(4);
    const geometry=await page.evaluate(()=>{const root=document.querySelector('#officeManagerContent'),pane=document.querySelector('.office-pane[data-office-pane="manager"]'),r=root.getBoundingClientRect(),p=pane.getBoundingClientRect();return{rootWidth:r.width,paneWidth:p.width,scrollWidth:root.scrollWidth,clientWidth:root.clientWidth};});
    expect(geometry.rootWidth).toBeGreaterThan(geometry.paneWidth*.95);
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth+1);
    await expect(page).toHaveScreenshot(`manager-career-overview-${viewport.name}.png`,{fullPage:true});
  });
}

test('manager market remains useful with no vacancies',async({page})=>{
  const viewport=viewports[0];
  await openPreview(page,'/?screen=manager-career&club=NYR&view=vacancies',viewport);
  await expectFrameContract(page,viewport);
  await expect(page.locator('.mc-market-intelligence')).toBeVisible();
  await expect(page.locator('.mc-intel-grid>div')).toHaveCount(4);
  await expect(page.locator('.mc-target-grid article')).toHaveCount(4);
  await expect(page).toHaveScreenshot('manager-career-no-vacancies-laptop.png',{fullPage:true});
});

for(const scene of ['interview','offer','contract']){
  test(`manager career ${scene} is an immersive conversation`,async({page})=>{
    const viewport=viewports[0];
    await openPreview(page,`/?screen=manager-career&club=NYR&scene=${scene}`,viewport);
    await expectFrameContract(page,viewport);
    await expect(page.locator('.mc-boardroom-scene')).toBeVisible();
    await expect(page.locator('.mc-boardroom-chairman')).toBeVisible();
    await expect(page.locator('.career-music-mini')).toBeHidden();
    if(scene==='interview')await expect(page.locator('[data-int-answer]')).toHaveCount(3);
    if(scene==='offer')await expect(page.locator('[data-offer-counter]')).toHaveCount(3);
    if(scene==='contract')await expect(page.locator('[data-contract-counter]')).toHaveCount(3);
    await expect(page).toHaveScreenshot(`manager-career-${scene}-laptop.png`,{fullPage:true});
  });
}

test('manager offer and contract counters produce a board response',async({page})=>{
  const viewport=viewports[0];
  await openPreview(page,'/?screen=manager-career&club=NYR&scene=offer',viewport);
  await page.locator('[data-offer-counter="salary"]').click();
  await expect(page.locator('.mc-board-response')).toBeVisible();
  await expect(page.locator('[data-offer-counter]')).toHaveCount(2);
  await expect(page.locator('[data-offer-accept]')).toBeVisible();

  await page.goto('/?screen=manager-career&club=NYR&scene=contract',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.vmPreviewReady==='true');
  await page.locator('[data-contract-counter="term"]').click();
  await expect(page.locator('.mc-board-response')).toBeVisible();
  await expect(page.locator('[data-contract-counter]')).toHaveCount(2);
  await expect(page.locator('[data-contract-accept]')).toBeVisible();
});

for(const viewport of [viewports[0],viewports[2]]){
  test(`season table uses the full stage at ${viewport.name}`,async({page})=>{
    await openPreview(page,'/?screen=season&club=NYR',viewport);
    await expectFrameContract(page,viewport);
    await expect(page.locator('.vm-table-broadcast')).toBeVisible();
    await expect(page.locator('.vm-table-metric')).toHaveCount(4);
    await expect(page.locator('.live-table-head [role="columnheader"]')).toHaveCount(9);
    await expect(page.locator('.vm-table-rows .live-table-row')).toHaveCount(18);
    await expect(page.locator('.vm-table-rows .vm-table-form')).toHaveCount(18);
    const seasonGeometry=await page.evaluate(()=>{const root=document.querySelector('.vm-table-broadcast'),main=document.querySelector('.season-main-content');return{scrollWidth:root.scrollWidth,clientWidth:root.clientWidth,bottom:root.getBoundingClientRect().bottom,mainBottom:main.getBoundingClientRect().bottom};});
    expect(seasonGeometry.scrollWidth).toBeLessThanOrEqual(seasonGeometry.clientWidth+1);
    expect(Math.abs(seasonGeometry.mainBottom-seasonGeometry.bottom)).toBeLessThanOrEqual(14);
    await expect(page).toHaveScreenshot(`season-table-${viewport.name}.png`,{fullPage:true});
  });

  test(`board expectations uses the full stage at ${viewport.name}`,async({page})=>{
    await openPreview(page,'/?screen=office&club=NYR&tab=board',viewport);
    await expectFrameContract(page,viewport);
    await expect(page.locator('#officeBoardPane')).toHaveClass(/is-active/);
    await expect(page.locator('.office-objective-card')).toHaveCount(4);
    await expect(page.locator('.board-kpi-ribbon article')).toHaveCount(4);
    await expect(page.locator('.board-assessment-card section')).toHaveCount(4);
    await expect(page.locator('.board-checkpoint-card')).toBeVisible();
    await expect(page.locator('.board-checkpoint-plan section')).toHaveCount(3);
    const boardGeometry=await page.evaluate(()=>{
      const root=document.querySelector('.board-expectations-dashboard'),scroll=document.querySelector('#officeBoardContent'),objectives=document.querySelector('.board-objectives-section'),outlook=document.querySelector('.board-outlook-grid');
      const cardBottom=Math.max(...[...document.querySelectorAll('.office-objective-card')].map(card=>card.getBoundingClientRect().bottom));
      return{scrollWidth:root.scrollWidth,clientWidth:root.clientWidth,scrollHeight:scroll.scrollHeight,clientHeight:scroll.clientHeight,objectivesBottom:objectives.getBoundingClientRect().bottom,cardBottom,outlookTop:outlook.getBoundingClientRect().top};
    });
    expect(boardGeometry.scrollWidth).toBeLessThanOrEqual(boardGeometry.clientWidth+1);
    expect(boardGeometry.scrollHeight).toBeGreaterThan(boardGeometry.clientHeight);
    expect(boardGeometry.objectivesBottom).toBeGreaterThanOrEqual(boardGeometry.cardBottom-1);
    expect(boardGeometry.outlookTop).toBeGreaterThanOrEqual(boardGeometry.objectivesBottom-1);
    await expect(page).toHaveScreenshot(`board-expectations-${viewport.name}.png`,{fullPage:true});
  });
}

for(const viewport of [viewports[0],viewports[2]]){
  for(const scene of [
    {name:'club-opening',query:'stage=club&state=idle',roles:2},
    {name:'personal-opening',query:'stage=agent&state=idle',roles:3},
    {name:'personal-agreed',query:'stage=agent&state=accepted',roles:3}
  ]){
    test(`${scene.name} stays seated and protected at ${viewport.name}`,async({page})=>{
      await openPreview(page,`/?screen=negotiation&club=NYR&${scene.query}`,viewport);
      await expectFrameContract(page,viewport);
      await expect(page.locator('#negotiationModal')).toHaveClass(/v73-has-cast/);
      await expect(page.locator('.v73-shot.is-current .v73-character')).toHaveCount(scene.roles);
      await expect(page.locator('.career-music-mini')).toBeHidden();
      const composition=await page.evaluate(()=>{
        const box=node=>{const r=node.getBoundingClientRect();return{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
        const frame=box(document.querySelector('.game-frame')),card=box(document.querySelector('#negotiationModal .negotiation-card')),characters=[...document.querySelectorAll('.v73-shot.is-current .v73-character')].map(node=>({role:node.dataset.v73Role,...box(node),z:Number(getComputedStyle(node).zIndex||0)}));
        return{frame,card,characters,cardZ:Number(getComputedStyle(document.querySelector('#negotiationModal .negotiation-card')).zIndex||0)};
      });
      expect(composition.card.left).toBeGreaterThanOrEqual(composition.frame.left);
      expect(composition.card.right).toBeLessThanOrEqual(composition.frame.right);
      expect(composition.card.bottom).toBeLessThanOrEqual(composition.frame.bottom);
      for(const character of composition.characters){
        expect(character.left,`${character.role} left edge`).toBeGreaterThanOrEqual(composition.frame.left-1);
        expect(character.right,`${character.role} right edge`).toBeLessThanOrEqual(composition.frame.right+1);
        expect(character.top,`${character.role} head`).toBeGreaterThanOrEqual(composition.frame.top-1);
        expect(composition.card.top-character.top,`${character.role} must have a visibly seated upper body above the deal desk`).toBeGreaterThanOrEqual(Math.max(70,viewport.height*.09));
        expect(character.bottom,`${character.role} should continue behind the deal desk`).toBeGreaterThan(composition.card.top);
        expect(composition.cardZ).toBeGreaterThan(character.z);
      }
      await expect(page).toHaveScreenshot(`negotiation-${scene.name}-${viewport.name}.png`,{fullPage:true});
    });
  }
}

for(const viewport of [viewports[0],viewports[2]]){
  for(const phase of ['dialogue','choices']){
    test(`clubhouse ${phase} fills the scene at ${viewport.name}`,async({page})=>{
      await openPreview(page,`/?screen=clubhouse-event&club=NYR&phase=${phase}`,viewport);
      await expectFrameContract(page,viewport);
      await expect(page.locator('.career-decision-card')).toHaveClass(/is-immersive/);
      await expect(page.locator('.career-event-character')).toHaveCount(2);
      await expect(page.locator('.career-decision-card .v48-name')).toHaveCount(0);
      await expect(page.locator('.career-music-mini')).toBeHidden();
      if(phase==='dialogue'){
        await expect(page.locator('.career-event-story')).toBeVisible();
        await expect(page.locator('.career-event-choice-tray')).toBeHidden();
        await expect(page.locator('[data-event-dialogue]')).not.toBeEmpty();
      }else{
        await expect(page.locator('.career-event-story')).toBeHidden();
        await expect(page.locator('.career-event-choice-tray')).toBeVisible();
        await expect(page.locator('[data-career-decision-choice]')).toHaveCount(4);
      }
      const composition=await page.evaluate(()=>{
        const box=node=>{const r=node.getBoundingClientRect();return{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
        const frame=box(document.querySelector('.game-frame')),card=box(document.querySelector('.career-decision-card')),world=box(document.querySelector('.career-event-world'));
        return{frame,card,world};
      });
      expect(composition.card.left).toBeGreaterThanOrEqual(composition.frame.left-1);
      expect(composition.card.top).toBeGreaterThanOrEqual(composition.frame.top-1);
      expect(composition.card.right).toBeLessThanOrEqual(composition.frame.right+1);
      expect(composition.card.bottom).toBeLessThanOrEqual(composition.frame.bottom+1);
      expect(composition.world.width).toBeCloseTo(composition.card.width,0);
      expect(composition.world.height).toBeCloseTo(composition.card.height,0);
      await expect(page).toHaveScreenshot(`clubhouse-event-${phase}-${viewport.name}.png`,{fullPage:true});
    });
  }
}

test('clubhouse conversation can be heard through and resolved',async({page})=>{
  const viewport=viewports[0];
  await openPreview(page,'/?screen=clubhouse-event&club=NYR&phase=dialogue',viewport);
  const speaker=page.locator('[data-event-speaker]'),dialogue=page.locator('[data-event-dialogue]');
  const opening=await dialogue.textContent();
  await page.locator('[data-event-next]').click();
  await expect(speaker).not.toHaveText('ASSISTANT COACH');
  await expect(dialogue).not.toHaveText(opening);
  await page.locator('[data-event-next]').click();
  await expect(page.locator('[data-event-progress]')).toHaveText('3 / 3');
  await page.locator('[data-event-next]').click();
  await expect(page.locator('.career-event-choice-tray')).toBeVisible();
  await page.locator('[data-career-decision-choice="internal"]').click();
  await expect(page.locator('.career-event-outcome')).toBeVisible();
  await expect(page.locator('.career-event-outcome h2')).not.toBeEmpty();
  await page.locator('[data-event-finish]').click();
  await expect(page.locator('#careerDecisionOverlay')).not.toHaveClass(/is-open/);
});

test('submitting a club offer reaches a durable save and releases the action',async({page})=>{
  const viewport=viewports[0];
  await openPreview(page,'/?screen=negotiation&club=NYR&stage=club&state=idle',viewport);
  await page.locator('#submitTransferOffer').click();
  await expect.poll(()=>page.evaluate(()=>window.VelmoraCareerStore?.status?.()),{timeout:15000,message:'the submitted offer must leave browser storage fully settled'}).toMatchObject({pending:0,error:null,unsaved:0});
  await expect(page.locator('#careerSaveFailure')).toHaveCount(0);
  await expect(page.locator('#submitTransferOffer')).not.toHaveText(/SUBMITTING|SAVING/i);
});
