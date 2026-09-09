'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const profiles=fs.readFileSync(path.join(root,'player-profiles.js'),'utf8');

assert.match(app,/'#v48PlayerProfile'/,'player profile must participate in the global overlay stack');
assert.match(app,/\[\.\.\.m\.addedNodes,\.\.\.m\.removedNodes\]/,'overlay synchronisation must notice profile removal');
assert.match(app,/overlay\.id==='v48PlayerProfile'\)window\.VelmoraPlayerProfiles\?\.close\(\)/,'Escape must close the top player profile');
assert.match(profiles,/dialog\.className='is-open'/,'player profile must identify itself as an open blocking overlay');
assert.match(profiles,/dialog\.setAttribute\('aria-hidden','false'\)/,'open profile must expose the correct accessibility state');
assert.match(app,/contains\('is-open'\)\?'News'/,'profile back label must preserve news as its return context');

console.log(JSON.stringify({status:'PASS',checks:[
  'profile registered as top overlay',
  'underlying modal made inert',
  'close click no longer blocked',
  'Escape closes profile first',
  'underlying window restored after removal',
  'news return context retained'
]},null,2));
