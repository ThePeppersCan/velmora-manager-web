'use strict';
// V104.4 · Scouting intelligence must be earned over time.
// Assigning a scout at zero elapsed days must not turn an unknown valuation
// into a range. Existing public valuation estimates remain available.

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const {runtime}=require('./career_test_runtime.cjs');

const r=runtime(),q=r.q,d=r.d;
const club=r.context.VELMORA_CLUBS.find(row=>row.id==='redwick');
d.assignClubForTest(club);
q.initializeCareerLifecycle();

const dom=new JSDOM(fs.readFileSync(path.resolve(__dirname,'..','index.html'),'utf8'),{
  url:'https://velmora.example/'
});
for(const node of r.nodes.values())node.isConnected=false;
r.context.document=dom.window.document;
r.context.FormData=dom.window.FormData;
const doc=dom.window.document;

q.populateTransferDiscoveryFilters();
q.setTransferTab('search');

const unknown=q.getTransferPool(false).find(player=>{
  const intel=d.recruitmentEstimateForTest(player.id);
  return intel?.stage?.key==='unknown'&&intel.value.kind==='unknown';
});
assert.ok(unknown,'an unknown player exists for the scouting regression');

q.markRecruitmentDiscovery(unknown,'v104-4-test');
doc.querySelector('#transferSearchInput').value=unknown.name;
q.renderTransferResults();
doc.querySelector(`[data-transfer-player="${unknown.id}"]`).click();

const before=d.recruitmentEstimateForTest(unknown.id);
assert.equal(before.stage.key,'unknown');
assert.equal(before.value.kind,'unknown');
assert.equal(before.value.text,'UNKNOWN');

const scoutButton=doc.querySelector('#scoutTransferPlayer');
assert.ok(scoutButton&&!scoutButton.disabled,'the player can be assigned to a scout');
scoutButton.click();

const immediate=d.recruitmentEstimateForTest(unknown.id);
assert.equal(immediate.stage.key,'limited','the interface records that scouting started');
assert.equal(immediate.stage.label,'SCOUTING STARTED');
assert.equal(immediate.value.kind,'unknown','zero elapsed days reveal no valuation range');
assert.equal(immediate.value.text,'UNKNOWN');
assert.equal(immediate.ovr.kind,'unknown','ability remains unknown at the same stage');

const publicProfile=q.getTransferPool(false).find(player=>{
  const intel=d.recruitmentEstimateForTest(player.id);
  return player.id!==unknown.id&&intel?.stage?.key==='limited'&&intel.value.kind==='range';
});
assert.ok(publicProfile,'a public-profile player exists');
const publicIntel=d.recruitmentEstimateForTest(publicProfile.id);
assert.equal(publicIntel.value.kind,'range','existing public estimates remain visible');

console.log(JSON.stringify({
  status:'PASS',version:'V104.4',player:unknown.name,
  beforeValue:before.value.text,immediateValue:immediate.value.text,
  checks:[
    'unknown valuation stays hidden when a scout is assigned',
    'zero elapsed scouting days reveal no value range',
    'ability and valuation unlock on the same progression model',
    'existing public valuation estimates remain available'
  ]
},null,2));
