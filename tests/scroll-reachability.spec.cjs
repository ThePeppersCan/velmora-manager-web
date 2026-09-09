'use strict';
const {test,expect}=require('@playwright/test');

async function openPreview(page,path,{width=1366,height=768}={}){
  await page.setViewportSize({width,height});
  await page.route(/\.(?:mp3|wav|ogg)(?:\?.*)?$/i,route=>route.abort());
  await page.goto(path,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.vmPreviewReady==='true');
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
}

test('every staff view is vertically reachable inside the office stage',async({page})=>{
  await openPreview(page,'/?screen=office&club=NYR&tab=staff');
  await expect(page.locator('#officeStaffPane')).toHaveClass(/is-active/);
  const result=await page.evaluate(()=>{
    const pane=document.querySelector('#officeStaffPane');
    const stage=document.querySelector('.office-stage');
    const paneRect=pane.getBoundingClientRect();
    const stageRect=stage.getBoundingClientRect();
    pane.scrollTop=pane.scrollHeight;
    return{
      paneTop:paneRect.top,
      paneBottom:paneRect.bottom,
      stageTop:stageRect.top,
      stageBottom:stageRect.bottom,
      clientHeight:pane.clientHeight,
      scrollHeight:pane.scrollHeight,
      scrollTop:pane.scrollTop,
      overflowY:getComputedStyle(pane).overflowY
    };
  });
  expect(Math.abs(result.paneTop-result.stageTop)).toBeLessThanOrEqual(4);
  expect(Math.abs(result.paneBottom-result.stageBottom)).toBeLessThanOrEqual(4);
  expect(result.overflowY).toBe('auto');
  expect(result.scrollHeight).toBeGreaterThan(result.clientHeight);
  expect(result.scrollTop).toBeGreaterThan(0);
});

test('board objectives own their height and do not cover later panels',async({page})=>{
  await openPreview(page,'/?screen=office&club=NYR&tab=board',{width:1920,height:1080});
  await expect(page.locator('.office-objective-card')).toHaveCount(4);
  const result=await page.evaluate(()=>{
    const scroll=document.querySelector('#officeBoardContent');
    const objectives=document.querySelector('.board-objectives-section');
    const outlook=document.querySelector('.board-outlook-grid');
    const objectiveBottom=Math.max(...[...document.querySelectorAll('.office-objective-card')].map(node=>node.getBoundingClientRect().bottom));
    const objectiveRect=objectives.getBoundingClientRect();
    const outlookRect=outlook.getBoundingClientRect();
    scroll.scrollTop=scroll.scrollHeight;
    return{
      clientHeight:scroll.clientHeight,
      scrollHeight:scroll.scrollHeight,
      scrollTop:scroll.scrollTop,
      overflowY:getComputedStyle(scroll).overflowY,
      objectiveBottom,
      objectiveSectionBottom:objectiveRect.bottom,
      outlookTop:outlookRect.top
    };
  });
  expect(result.overflowY).toBe('auto');
  expect(result.scrollHeight).toBeGreaterThan(result.clientHeight);
  expect(result.scrollTop).toBeGreaterThan(0);
  expect(result.objectiveSectionBottom).toBeGreaterThanOrEqual(result.objectiveBottom-1);
  expect(result.outlookTop).toBeGreaterThanOrEqual(result.objectiveSectionBottom-1);
});

test('the Quidditch full-time report scrolls from the whole results panel',async({page})=>{
  await page.setViewportSize({width:1366,height:768});
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await page.addStyleTag({url:'/velmora-quidditch-engine.css'});
  await page.addScriptTag({url:'/velmora-quidditch-engine.js'});
  await page.evaluate(async()=>{
    const players=prefix=>['ATTACKER','PLAYMAKER','DEFENDER'].map((role,index)=>({
      id:`${prefix}${index}`,
      name:`${prefix} PLAYER ${index+1}`,
      role,
      unavailable:false,
      standing:'assets/quidditch-engine/standing/player-002.png',
      riding:'assets/quidditch-engine/players/player-002.webp',
      careerMeta:{ovr:70,primaryRole:role,deployedRole:role},
      attributes:{speed:.7,passing:.7,shooting:.7,tackling:.7,saving:.7,stamina:.7}
    }));
    await window.VelmoraQuidditchEngine.open({
      careerMode:true,
      disableAudio:true,
      headless:true,
      arenaUrl:'assets/quidditch-engine/arenas/clubs/ashwick.webp',
      homePlayerData:players('HOME'),
      awayPlayerData:players('AWAY')
    });
    window.VelmoraQuidditchEngine.skipToFulltime();
  });
  const report=page.locator('.wcg-v30-report-scroll');
  await expect(page.locator('#wcgFulltime')).toHaveClass(/is-open/);
  await expect(report).toHaveAttribute('role','region');
  await expect(report).toHaveAttribute('tabindex','0');
  const before=await report.evaluate(node=>({clientHeight:node.clientHeight,scrollHeight:node.scrollHeight,scrollTop:node.scrollTop}));
  expect(before.scrollHeight).toBeGreaterThan(before.clientHeight);
  await page.locator('.wcg-v30-fulltime-panel').hover();
  await page.mouse.wheel(0,900);
  await expect.poll(()=>report.evaluate(node=>node.scrollTop)).toBeGreaterThan(0);
});
