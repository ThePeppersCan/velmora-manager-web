const assert=require('node:assert/strict');
const {create}=require('../career-storage.js');

(async()=>{
  const data=new Map();
  const local={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};
  const codec={decode:x=>x};
  const store=create({indexedDB:null,localStorage:local,codec});
  await store.ready;
  const raw=n=>JSON.stringify({worldSeed:100+n,fixtures:[],squads:{club:[]},slot:n});
  for(let slot=1;slot<=5;slot++)await store.importSlot(slot,raw(slot));
  for(let slot=1;slot<=5;slot++)assert.equal(store.exportSlot(slot),raw(slot));
  await assert.rejects(store.importSlot(6,raw(6)),/valid Velmora career file/);
  store.removeItem('velmora-manager-career-v32-slot-4');
  assert.equal(store.exportSlot(4),null);
  assert.equal(store.exportSlot(5),raw(5));
  const source=require('node:fs').readFileSync(require('node:path').resolve(__dirname,'..','career-storage.js'),'utf8');
  assert(source.includes('SLOT_COUNT=5'));
  assert(source.includes('i<=SLOT_COUNT'));
  console.log(JSON.stringify({status:'PASS',checks:['limited-mode storage accepts slots 1-5','slot 6 rejected','deleting slot 4 preserves slot 5','IndexedDB migration loops are keyed to SLOT_COUNT=5']},null,2));
})().catch(err=>{console.error(err);process.exitCode=1;});
