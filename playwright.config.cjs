'use strict';
const fs=require('node:fs');
const {defineConfig}=require('@playwright/test');

const browserCandidates=[
  process.env.VELMORA_BROWSER_EXECUTABLE,
  'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
].filter(Boolean);
const executablePath=browserCandidates.find(candidate=>fs.existsSync(candidate));

module.exports=defineConfig({
  testDir:'./tests',
  fullyParallel:false,
  workers:1,
  timeout:60_000,
  expect:{toHaveScreenshot:{animations:'disabled',maxDiffPixelRatio:.004}},
  snapshotPathTemplate:'{testDir}/__screenshots__/{arg}{ext}',
  reporter:'list',
  webServer:{
    command:'node tools/serve-preview.cjs --host 127.0.0.1 --port 4173',
    url:'http://127.0.0.1:4173',
    reuseExistingServer:true,
    timeout:30_000
  },
  use:{
    baseURL:'http://127.0.0.1:4173',
    browserName:'chromium',
    headless:true,
    launchOptions:executablePath?{executablePath}:{},
    screenshot:'only-on-failure',
    trace:'off'
  }
});
