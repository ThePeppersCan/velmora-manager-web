const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {runtime}=require('./career_test_runtime.cjs');

const r=runtime(),q=r.q;
const club=r.context.VELMORA_CLUBS.find(c=>c.id==='redwick')||r.context.VELMORA_CLUBS[0];
const opponent=r.context.VELMORA_CLUBS.find(c=>c.divisionKey===club.divisionKey&&c.id!==club.id);
assert(club&&opponent,'Need two clubs in the same division');
r.d.assignClubForTest(club);q.initializeCareerLifecycle();
const report={status:'PASS',checks:[],measurements:{}};
const check=(name,fn)=>{fn();report.checks.push(name);};

check('league form only uses completed league fixtures from the selected competition',()=>{
  q.setCareerDate('2026-08-10');
  const other=r.context.VELMORA_CLUBS.find(c=>c.id!==club.id&&c.id!==opponent.id);
  const custom=[
    {fixtureId:'V32-L1',date:'2026-08-02',type:'LEAGUE',competitionId:club.divisionKey,homeClubId:club.id,awayClubId:opponent.id,homeScore:2,awayScore:0,played:true},
    {fixtureId:'V32-CUP',date:'2026-08-03',type:'CUP',competitionId:'CUP-X',homeClubId:club.id,awayClubId:other.id,homeScore:0,awayScore:4,played:true},
    {fixtureId:'V32-L2',date:'2026-08-05',type:'LEAGUE',competitionId:club.divisionKey,homeClubId:opponent.id,awayClubId:club.id,homeScore:1,awayScore:1,played:true},
    {fixtureId:'V32-FRIENDLY',date:'2026-08-06',type:'FRIENDLY',competitionId:'FRIENDLY',homeClubId:club.id,awayClubId:other.id,homeScore:0,awayScore:2,played:true},
    {fixtureId:'V32-L3',date:'2026-08-08',type:'LEAGUE',competitionId:club.divisionKey,homeClubId:club.id,awayClubId:opponent.id,homeScore:0,awayScore:1,played:true}
  ];
  q.set('fixtures',custom);
  const form=q.recentLeagueClubForm(club,5,club.divisionKey),row=q.standingsForDivision(club.divisionKey).find(x=>x.club.id===club.id);
  assert.deepEqual(Array.from(form),['L','D','W']);assert.equal(row.played,3);
  report.measurements.form={played:row.played,markers:Array.from(form)};
});

check('incoming buyer valuation stays market-anchored and a high asking price does not raise the private ceiling',()=>{
  const p={...q.getSquad(club).find(x=>!x.captain),age:29,contractYears:1,potential:61,ovr:59,askingPrice:855000};
  const buyer=r.context.VELMORA_CLUBS.find(c=>c.id!==club.id);buyer.budget='£20m';
  const common={market:855000,buyerNeed:65,competition:0,phase:'EARLY',negotiatorStyle:'PRAGMATIC',status:'LISTEN',allowExceptional:false,rng:()=>.5};
  const normal=q.livingIncomingOfferValuation(p,buyer,{...common,asking:855000});
  const ambitious=q.livingIncomingOfferValuation({...p,askingPrice:2000000},buyer,{...common,asking:2000000});
  assert.equal(ambitious.maxFee,normal.maxFee);assert(ambitious.maxFee<=855000*1.36+50000);assert(ambitious.idealFee<=855000*1.12+50000);
  const exceptional=q.livingIncomingOfferValuation(p,buyer,{...common,allowExceptional:true,forceExceptional:true,rng:()=>.5});assert(exceptional.maxFee>=normal.maxFee);assert(exceptional.maxFee<=855000*1.62+50000);
  report.measurements.transfer={market:855000,normalMax:normal.maxFee,normalOpening:normal.idealFee,exceptionalMax:exceptional.maxFee};
});

check('incoming negotiation header exposes player age',()=>{
  const source=fs.readFileSync(path.resolve(__dirname,'..','app.js'),'utf8');
  assert(source.includes("OVR · AGE ${Number(p.age||0)} · ${escapeHtml(livingContractLabel(p))}"));
});

check('five save slots are independent and deletion only removes the selected slot',()=>{
  q.set('currentClub',club);q.set('employmentStatus','employed');q.initializeCareerLifecycle();
  const dates={1:'2026-08-12',2:'2026-09-14',3:'2026-10-16',4:'2026-11-18',5:'2026-12-20'},raw={};
  for(let slot=1;slot<=5;slot++){q.setActiveCareerSlot(slot);q.setCareerDate(dates[slot]);assert(q.saveCareerState());const key=q.careerSlotKey(slot);raw[slot]=r.local.get(key);assert(raw[slot]);}
  assert.equal(new Set(Object.values(raw)).size,5);
  for(let slot=1;slot<=5;slot++){assert(q.loadCareerState(slot));assert.equal(q.currentCareerISO(),dates[slot]);}
  const key1=q.careerSlotKey(1),key4=q.careerSlotKey(4);assert(q.deleteCareerSlot(4));assert(r.local.has(key1));assert(!r.local.has(key4));assert(r.local.has(q.careerSlotKey(5)));
  report.measurements.saves={slots:5,slot1Date:dates[1],slot5Date:dates[5]};
  // Leave only slot 1 populated so the following legacy single-save migration case remains isolated.
  [2,3,5].forEach(slot=>q.deleteCareerSlot(slot));
});

check('legacy single-save data migrates once into slot 1 without destroying the legacy backup',()=>{
  const slot1=q.careerSlotKey(1),legacy='velmora-manager-career-v3-2',marker='velmora-manager-career-v32-migrated';
  const encoded=r.local.get(slot1);assert(encoded);r.local.set(legacy,encoded);r.local.delete(slot1);r.local.delete(marker);
  assert.equal(q.ensureCareerSaveMigration(),true);assert.equal(r.local.get(slot1),encoded);assert.equal(r.local.get(legacy),encoded);assert(r.local.get(marker));
});

console.log(JSON.stringify(report,null,2));
