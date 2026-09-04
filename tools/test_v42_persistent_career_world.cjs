const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {runtime}=require('./career_test_runtime.cjs');

const r=runtime(),q=r.q,d=r.d,x=r.context.VELMORA_EXPANSION;
const club=r.context.VELMORA_CLUBS.find(c=>c.id==='redwick')||r.context.VELMORA_CLUBS[0];
d.assignClubForTest(club);
q.initializeCareerLifecycle();

const integrity=d.v42PersistentCareerWorldIntegrityForTest();
assert.equal(integrity.version,'V42');
assert(integrity.saveSchema>=80);
assert.equal(integrity.saveCompatible,true);
assert(integrity.livingSquadVersion>=6);
assert.equal(integrity.memoryVersion,1);
assert.equal(integrity.legacyMigrationVersion,1);
assert.equal(integrity.duplicateEvents,0);
assert(integrity.environmentSlots>=8);
assert.equal(integrity.journeyRenderer,true);
assert.equal(integrity.formerPlayerContext,true);

const player=q.getSquad(club)[0];
const testKey=`V42-TEST-MILESTONE-${player.id}`;
const before=d.careerMemoryEventsForPlayerForTest(player.id).length;
const first=d.recordCareerMemoryForTest({type:'APPEARANCE_50',clubId:club.id,playerId:player.id,date:'2026-09-02',seasonId:'2026-27',importance:'NOTABLE',key:testKey,metadata:{milestone:50}});
const duplicate=d.recordCareerMemoryForTest({type:'APPEARANCE_50',clubId:club.id,playerId:player.id,date:'2026-09-02',seasonId:'2026-27',importance:'NOTABLE',key:testKey,metadata:{milestone:50}});
assert.equal(first.id,duplicate.id);
assert.equal(d.careerMemoryEventsForPlayerForTest(player.id).length,before+1);

// Long-career structural stress: twelve seasons of significant memories stay unique and queryable.
for(let i=0;i<12;i++){
  const y=2026+i,season=`${y}-${String((y+1)%100).padStart(2,'0')}`;
  d.recordCareerMemoryForTest({type:i%4===0?'LEAGUE_TITLE':'MEMORABLE_MATCH',clubId:club.id,date:`${y}-12-15`,seasonId:season,importance:i%4===0?'HISTORIC':'NOTABLE',key:`V42-LONG-${club.id}-${season}`,metadata:{label:i%4===0?`${club.name} title season`:`Season ${i+1} landmark`,competition:club.division}});
}
const longRows=d.careerMemoryEventsForClubForTest(club.id,'NOTABLE').filter(e=>String(e.key||'').startsWith('V42-LONG-'));
assert.equal(longRows.length,12);
assert.equal(new Set(longRows.map(e=>e.key)).size,12);

// Save/load preserves the exact structured event rather than regenerating prose.
assert(q.saveCareerState());
q.state().livingSquad.careerMemory.events=q.state().livingSquad.careerMemory.events.filter(e=>e.key!==testKey);
assert(!d.careerMemoryEventsForPlayerForTest(player.id).some(e=>e.key===testKey));
assert(q.loadCareerState());
assert(d.careerMemoryEventsForPlayerForTest(player.id).some(e=>e.key===testKey));
assert.equal(d.v42PersistentCareerWorldIntegrityForTest().duplicateEvents,0);

// The existing transfer engine is extended, not replaced: an out-of-window agreement is remembered,
// the player stays put, and the arrival creates one completion memory on the valid window date.
q.setCareerDate('2026-09-10');
const buyer=q.clubById(club.id);buyer.budget='£100000000';q.v25ClubFinance(buyer).wageBudget=1000000;
const seller=q.state().clubs.find(c=>c.id!==buyer.id&&c.tier===buyer.tier&&c.world===buyer.world);
const transferPlayer=q.getSquad(seller).find(p=>!p.captain&&!p.v34Precontract);
const transferResult=q.completeTransferSigning({...transferPlayer,club:seller},200000,q.expectedWage(transferPlayer)*2,1000,'Rotation',3,0);
assert(transferResult.ok,transferResult.message);assert.equal(transferResult.deferred,true);
assert.equal(q.careerPlayerById(transferPlayer.id).clubId,seller.id);
let transferMemories=d.careerMemoryEventsForPlayerForTest(transferPlayer.id);
assert.equal(transferMemories.filter(e=>e.type==='FUTURE_TRANSFER_AGREED').length,1);
assert(q.saveCareerState());assert(q.loadCareerState());
q.setCareerDate(transferResult.joinDate);x.processPrecontracts(q.currentCareerISO());
assert.equal(q.careerPlayerById(transferPlayer.id).clubId,buyer.id);
transferMemories=d.careerMemoryEventsForPlayerForTest(transferPlayer.id);
assert.equal(transferMemories.filter(e=>e.type==='FUTURE_TRANSFER_AGREED').length,1);
assert.equal(transferMemories.filter(e=>e.type==='TRANSFER_COMPLETED').length,1);
x.processPrecontracts(q.currentCareerISO());
assert.equal(d.careerMemoryEventsForPlayerForTest(transferPlayer.id).filter(e=>e.type==='TRANSFER_COMPLETED').length,1);

const root=path.resolve(__dirname,'..');
const css=fs.readFileSync(path.join(root,'aaa-career-pass.css'),'utf8');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const expansion=fs.readFileSync(path.join(root,'career-expansion.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert(css.includes('V42 — inbox collision repair'));
assert(css.includes('body.v20-ui #officeMessageList {\n  display: block !important;'));
assert(css.includes('height: auto !important;'));
assert(css.includes('.v42-memory-dashboard'));
assert(css.includes('.v42-career-identities span'));
assert(app.includes("['overview','OVERVIEW'],['memory','CLUB MEMORY']"));
assert(app.includes("type:'COMPETITIVE_DEBUT'"));
assert(app.includes("type:'ACADEMY_PROMOTION'"));
assert(app.includes("type:'PLAYER_RETIRED'"));
assert(expansion.includes("type:'FUTURE_TRANSFER_AGREED'"));
assert(expansion.includes("type:'FUTURE_TRANSFER_CANCELLED'"));
assert(/aaa-career-pass\.css\?v=/.test(html));
assert(/career-expansion\.js\?v=/.test(html));

console.log(JSON.stringify({
  status:'PASS',
  integrity:d.v42PersistentCareerWorldIntegrityForTest(),
  longCareerMemories:longRows.length,
  checks:[
    'shared career-memory schema initializes and migrates safely',
    'stable event keys prevent duplicate milestones',
    'structured memories survive the existing save/load path',
    'twelve-season memory stress remains unique and queryable',
    'Club Memory and Player Journey presentation hooks are present',
    'future-transfer agreement/arrival hooks use the live transfer processor and deduplicate after reload',
    'inbox rows use content-driven height and block list flow to prevent overlap',
    'V43 cache keys preserve the V42 systems'
  ]
},null,2));
