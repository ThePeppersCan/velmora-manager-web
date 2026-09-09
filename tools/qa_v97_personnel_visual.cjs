'use strict';

const {chromium}=require('@playwright/test');
const path=require('node:path');

(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_BROWSER_PATH||'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'});
  const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1});
  const consoleErrors=[],pageErrors=[],failed=[];
  page.on('console',message=>{if(message.type()==='error')consoleErrors.push({text:message.text(),location:message.location()});});
  page.on('pageerror',error=>pageErrors.push(error.message));
  page.on('requestfailed',request=>failed.push({status:'REQUEST_FAILED',url:request.url(),reason:request.failure()?.errorText||''}));
  page.on('response',response=>{if(response.status()>=400)failed.push({status:response.status(),url:response.url()});});
  const root=path.resolve(__dirname,'..','test-results');
  await page.goto('http://127.0.0.1:4173/?screen=office&club=aurelia',{waitUntil:'networkidle'});
  await page.locator('#officeSubnav [data-office-tab="staff"]').click();
  await page.waitForTimeout(300);
  const staff=[];
  for(const role of ['scout','coach','medical','academy','commercial']){
    await page.locator(`#officeStaffContent [data-v34-action="staff-filter"][data-key="${role}"]`).click();
    const image=page.locator('#officeStaffContent .v36-person-portrait img');
    await image.waitFor();
    staff.push({role,src:await image.getAttribute('src'),loaded:await image.evaluate(node=>node.complete&&node.naturalWidth>0)});
  }
  await page.screenshot({path:path.join(root,'v97-personnel-staff.png'),fullPage:true});

  await page.goto('http://127.0.0.1:4173/?screen=squad&club=aurelia',{waitUntil:'networkidle'});
  await page.locator('#squadSubnav [data-squad-view="training"]').click();
  await page.locator('.tr-assistant-art img').waitFor();
  const training=await page.locator('.tr-assistant-art img').evaluate(node=>({src:node.getAttribute('src'),loaded:node.complete&&node.naturalWidth>0}));
  await page.screenshot({path:path.join(root,'v97-personnel-training.png'),fullPage:true});

  await page.locator('#squadSubnav [data-squad-view="youth"]').click();
  await page.locator('[data-v35-academy="recruitment"]').click();
  await page.locator('.v97-personnel-brief img').waitFor();
  const academy=await page.locator('.v97-personnel-brief img').evaluate(node=>({src:node.getAttribute('src'),loaded:node.complete&&node.naturalWidth>0}));
  await page.screenshot({path:path.join(root,'v97-personnel-academy.png'),fullPage:true});

  await page.goto('http://127.0.0.1:4173/?screen=office&club=aurelia',{waitUntil:'networkidle'});
  await page.locator('#officeSubnav [data-office-tab="finances"]').click();
  const sponsorTab=page.locator('[data-v35-finance="commercial"]');
  if(await sponsorTab.count())await sponsorTab.click();
  await page.locator('.v97-personnel-brief img').waitFor();
  const commercial=await page.locator('.v97-personnel-brief img').evaluate(node=>({src:node.getAttribute('src'),loaded:node.complete&&node.naturalWidth>0}));
  await page.screenshot({path:path.join(root,'v97-personnel-commercial.png'),fullPage:true});

  await page.locator('#officeSubnav [data-office-tab="inbox"]').click();
  const routineToggle=page.locator('[data-office-routine-toggle]');
  if(await routineToggle.count())await routineToggle.click();
  const personnelMail=page.locator('#officeMessageList [data-office-message]:has(img[src*="personnel-v2"])').first();
  if(await personnelMail.count())await personnelMail.click();
  await page.waitForFunction(()=>[...document.querySelectorAll('#officeMessageList img[src*="personnel-v2"], #officeMessageReader img[src*="personnel-v2"]')].every(node=>node.complete&&node.naturalWidth>0));
  const inboxImages=await page.locator('#officeMessageList img[data-avatar-src*="personnel-v2"], #officeMessageReader img[data-avatar-src*="personnel-v2"]').evaluateAll(nodes=>nodes.map(node=>({src:node.getAttribute('data-avatar-src'),loaded:node.complete&&node.naturalWidth>0})));
  await page.screenshot({path:path.join(root,'v97-personnel-inbox.png'),fullPage:true});

  const required=[...staff,training,academy,commercial,...inboxImages],relevantFailures=failed.filter(item=>!(item.reason==='net::ERR_ABORTED'&&/\/assets\/audio\//.test(item.url))),status=!pageErrors.length&&!relevantFailures.length&&required.every(item=>item.loaded)?'PASS':'FAIL';
  console.log(JSON.stringify({status,staff,training,academy,commercial,inboxImages,pageErrors,relevantFailures,ignoredNavigationAborts:failed.length-relevantFailures.length,consoleErrors,screenshots:['v97-personnel-staff.png','v97-personnel-training.png','v97-personnel-academy.png','v97-personnel-commercial.png','v97-personnel-inbox.png']},null,2));
  await browser.close();
  if(status!=='PASS')process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});
