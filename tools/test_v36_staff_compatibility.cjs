const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom'),{runtime}=require('./career_test_runtime.cjs');
const r=runtime(),q=r.q,x=r.context.VELMORA_EXPANSION,clubs=q.state().clubs;
const club=clubs.find(c=>c.id==='caldria-4-riva-sola');
r.d.assignClubForTest(club);q.initializeCareerLifecycle();
const dom=new JSDOM(fs.readFileSync(path.resolve(__dirname,'../index.html'),'utf8'),{url:'https://velmora.example/'});
for(const node of r.nodes.values())node.isConnected=false;
r.context.document=dom.window.document;r.context.FormData=dom.window.FormData;x.initUI();
const doc=dom.window.document,checks=[];
function check(name,fn){fn();checks.push(name);}
check('Riva Sola opens Staff with legacy scouts missing a specialism',()=>{
 const staff=x.department(club).staff;staff.filter(p=>p.role==='scout').forEach(p=>delete p.specialism);
 assert.doesNotThrow(()=>q.setOfficeTab('staff'));
 assert(doc.querySelector('.v36-backroom'));assert(doc.querySelector('.v36-staff-dossier'));
 assert(doc.querySelector('.v36-impact').textContent.includes('general specialist'));
 assert.equal(doc.querySelector('#officeStaffPane').getAttribute('aria-hidden'),'false');
});
check('legacy missing and null specialisms survive saved-state JSON and every department remains usable',()=>{
 const saved=JSON.parse(JSON.stringify(x.department(club)));saved.staff.find(p=>p.role==='scout').specialism=null;
 x.state().clubs[club.id]=saved;
 q.setOfficeTab('staff');assert(doc.querySelector('.v36-staff-dossier'));
 for(const role of ['scout','coach','medical','academy','commercial']){
  doc.querySelector(`[data-v34-action="staff-filter"][data-key="${role}"]`).click();
  assert(doc.querySelector('.v36-staff-dossier'));
  doc.querySelector('[data-v34-action="staff-mode"][data-key="market"]').click();
  assert.equal(doc.querySelectorAll('.v36-staff-pick').length,3);
  doc.querySelector('[data-v34-action="staff-mode"][data-key="team"]').click();
 }
});
check('all clubs generate valid scout specialisms and render Staff',()=>{
 for(const c of clubs){
  q.set('currentClub',c);
  const scouts=q.recruitmentScoutProfilesLegacy(c);
  assert(scouts.every(p=>typeof p.specialism==='string'&&p.specialism.length),c.name+' specialism');
  assert.doesNotThrow(()=>x.staffHTML(),c.name+' staff render');
 }
 q.set('currentClub',club);
});
console.log(JSON.stringify({status:'PASS',clubsChecked:clubs.length,checks},null,2));
