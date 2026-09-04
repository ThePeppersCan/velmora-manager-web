const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom'),{runtime}=require('./career_test_runtime.cjs');
const r=runtime(),q=r.q,x=r.context.VELMORA_EXPANSION,c=q.state().clubs.find(c=>c.id==='caldria-4-riva-sola');r.d.assignClubForTest(c);q.initializeCareerLifecycle();
const dom=new JSDOM(fs.readFileSync(path.resolve(__dirname,'../index.html'),'utf8'),{url:'https://velmora.example/'});
for(const n of r.nodes.values())n.isConnected=false;r.context.document=dom.window.document;r.context.FormData=dom.window.FormData;const doc=dom.window.document;
q.populateTransferDiscoveryFilters();q.setTransferTab('search');
const checks=[];function check(name,fn){console.log('CHECK:',name);fn();checks.push(name);}
check('quick filters select the actual market and removable chips preserve the other filters',()=>{
 doc.querySelector('[data-v39-market="freeagent"]').click();assert.equal(q.getTransferFilters().type,'freeagent');assert([...doc.querySelectorAll('#transferResults [data-transfer-player]')].every(b=>q.transferPlayerById(b.dataset.transferPlayer).freeAgent));
 const role=doc.querySelector('#transferRoleFilter');role.value='DEFENDER';role.dispatchEvent(new dom.window.Event('change'));assert.equal(q.getTransferFilters().role,'DEFENDER');
 doc.querySelector('[data-v39-clear="transferTypeFilter"]').click();assert.equal(q.getTransferFilters().type,'all');assert.equal(q.getTransferFilters().role,'DEFENDER');
 doc.querySelector('#clearTransferFilters').click();assert.equal(q.getTransferFilters().role,'all');assert.equal(doc.querySelectorAll('#v39FilterChips button').length,0);
});
check('search results can load beyond the old 160 limit without duplicate players',()=>{
 let count=doc.querySelectorAll('#transferResults [data-transfer-player]').length;assert(count<=60);
 const total=q.transferSearchPool(q.getTransferFilters()).length;assert(total>180);
 for(let i=0;i<3&&doc.querySelectorAll('#transferResults [data-transfer-player]').length<180;i++){const b=doc.querySelector('.v39-load-more');assert(b);console.log('Loading from',doc.querySelectorAll('#transferResults [data-transfer-player]').length,doc.querySelector('#transferResults').dataset.v39Limit);b.click();}
 const ids=[...doc.querySelectorAll('#transferResults [data-transfer-player]')].map(b=>b.dataset.transferPlayer);assert(ids.length>=180);assert.equal(new Set(ids).size,ids.length);
 doc.querySelector('[data-v39-market="listed"]').click();assert(doc.querySelectorAll('#transferResults [data-transfer-player]').length<=60);q.v39ResetTransferFilters();
});
check('player selection, profile sections and shortlist use the original player identity',()=>{
 const card=doc.querySelector('#transferResults [data-transfer-player]'),id=card.dataset.transferPlayer;card.click();assert.equal(doc.querySelector('#transferDossier').dataset.v39Player,id);assert.equal(doc.querySelector('#transferResults .is-selected').dataset.transferPlayer,id);
 doc.querySelector('[data-v39-profile="report"]').click();assert(!doc.querySelector('[data-v39-profile-pane="report"]').hidden);assert(doc.querySelector('[data-v39-profile-pane="overview"]').hidden);
 doc.querySelector('#toggleShortlist').click();assert(doc.querySelector('#toggleShortlist').textContent.includes('Shortlisted'));assert(doc.querySelector('#transferResults .is-selected .v39-card-star'));
 q.setTransferTab('shortlist');assert(doc.querySelector(`#shortlistResults [data-transfer-player="${id}"]`));q.setTransferTab('search');
});
check('unknown players keep hidden abilities in cards and scout-report attributes',()=>{
 const p=q.getTransferPool(false).find(p=>q.visibleOvrInfo(p).kind==='unknown');assert(p);q.markRecruitmentDiscovery(p,'test');doc.querySelector('#transferSearchInput').value=p.name;q.renderTransferResults();
 assert.equal(doc.querySelector('.v39-card-rating strong').textContent,'?');assert.equal(doc.querySelector('.v39-dossier-rating strong').textContent,'?');
 const intel=q.attributeIntel(p,'PAC');assert.equal(doc.querySelector('.dossier-stat strong').textContent,intel.text||'--');assert.equal(doc.querySelector('#transferDossier').dataset.v39Player,p.id);
});
check('scouting uses the chosen available scout and survives save/reload',()=>{
 const id=doc.querySelector('#transferDossier').dataset.v39Player,select=doc.querySelector('#v34SeniorScout');assert(select);assert(!doc.querySelector('#scoutTransferPlayer').disabled);const scoutId=select.value;
 doc.querySelector('#scoutTransferPlayer').click();assert(q.scoutAssignment(q.transferPlayerById(id)));assert.equal(String(q.scoutAssignment(q.transferPlayerById(id)).scoutId),String(scoutId));assert(doc.querySelector('#scoutTransferPlayer').disabled);
 assert(q.saveCareerState());assert(q.loadCareerState());assert(q.scoutAssignment(q.transferPlayerById(id)));
});
check('no-results state can clear the search and restore cards',()=>{
 q.setTransferTab('search');doc.querySelector('#transferSearchInput').value='NO SUCH PLAYER V39';q.renderTransferResults();assert(doc.querySelector('.v39-empty-reset'));doc.querySelector('.v39-empty-reset').click();assert(doc.querySelector('#transferResults [data-transfer-player]'));
});
console.log(JSON.stringify({status:'PASS',checks},null,2));
