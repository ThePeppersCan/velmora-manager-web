const fs=require('fs'), vm=require('vm');
function makeEl(){
  const cl={toggle(){},add(){},remove(){},contains(){return false}};
  return {classList:cl,dataset:{},style:{},value:'',checked:false,disabled:false,innerHTML:'',textContent:'',options:{length:0},
    addEventListener(){},removeEventListener(){},setAttribute(){},removeAttribute(){},getAttribute(){return ''},querySelector(){return makeEl()},querySelectorAll(){return []},closest(){return null},
    appendChild(){},append(){},replaceChildren(){},remove(){},focus(){},play(){return Promise.resolve()},pause(){},load(){},getContext(){return null}};
}
const local=new Map();
const context={console,Map,Set,WeakMap,Array,Object,String,Number,Boolean,Math,Date,JSON,RegExp,URLSearchParams,Promise,parseInt,parseFloat,isNaN,encodeURI,decodeURI,
  setTimeout,clearTimeout,requestAnimationFrame:(cb)=>{cb();return 1},cancelAnimationFrame(){},location:{search:''},navigator:{userAgent:''},
  MutationObserver:class{observe(){}disconnect(){}},
  localStorage:{getItem:k=>local.get(k)||null,setItem:(k,v)=>local.set(k,String(v)),removeItem:k=>local.delete(k)},
  Audio:function(){return makeEl()},Image:function(){return makeEl()},
  document:{documentElement:makeEl(),body:makeEl(),getElementById(){return makeEl()},querySelector(){return makeEl()},querySelectorAll(){return []},addEventListener(){},createElement(){return makeEl()}},
};
context.addEventListener=()=>{};context.removeEventListener=()=>{};context.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});context.window=context;context.globalThis=context;
context.VelmoraSaveCodec={encode:value=>value,decode:value=>value};
vm.createContext(context);
for(const f of ['clubs.js','names.js','assets/manager/manager-assets.js','world-expansion.js','data/player-sprites.js','training.js','player-traits.js','app.js']) vm.runInContext(fs.readFileSync(require('path').resolve(__dirname,'../../..',f),'utf8'),context,{filename:f});
const D=context.VELMORA_MANAGER_DEBUG;if(!D)throw new Error('debug API missing');
function assert(cond,msg){if(!cond)throw new Error(msg)}
const counts=D.assetCounts();assert(Object.values(counts).reduce((a,b)=>a+b,0)===1033,'asset count');
console.log('1 asset count PASS');
let legacy={name:'Legacy Coach',age:41,nationId:'vardesh',cityId:'rsl-1',skinId:'skin_01',faceId:'face_01',hairId:'hair_01',hairPaletteId:'hair_black',facialHairId:'facial_hair_00',outfitId:'outfit_coach_01',eyewearId:'eyewear_00',accessoryId:'accessory_00'};
let migrated=D.normalizeManagerProfile(legacy);assert(migrated.managerAppearanceSchemaVersion===5&&migrated.appearance.legacyFaceFallback,'legacy migration');
let legacyPlan=D.managerBuildRenderPlan(migrated,'office').plan.map(x=>x.category);assert(legacyPlan.includes('legacy_face')&&!legacyPlan.includes('eyes')&&!legacyPlan.includes('eyebrows'),'legacy face fallback plan');
console.log('2 legacy migration/fallback PASS');
let p=D.createDefaultManagerProfile();p.wardrobePresets.office.outfitId='outfit_coach_01';p.wardrobePresets.matchday.outfitId='outfit_coach_02';D.setManagerProfile(p);D.copyPreset('matchday','training');let q=D.getManagerProfile();q.wardrobePresets.training.outfitId='outfit_coach_03';D.setManagerProfile(q);let after=D.getManagerProfile();assert(after.wardrobePresets.matchday.outfitId==='outfit_coach_02'&&after.wardrobePresets.training.outfitId==='outfit_coach_03','preset independence');assert(Object.keys(after.wardrobePresets).length===8,'8 presets');
console.log('3 independent wardrobe presets PASS');
let continuity=D.createDefaultManagerProfile();continuity.wardrobePresets.office.outfitId='outfit_reference_m_butter_outline_hoodie';continuity.wardrobePresets.formal.outfitId='outfit_formal_03';let prepared=D.prepareManagerWardrobesForCareer(continuity);assert(prepared.wardrobePresets.matchday.outfitId==='outfit_reference_m_butter_outline_hoodie','untouched preset did not inherit confirmed outfit');assert(prepared.wardrobePresets.formal.outfitId==='outfit_formal_03','customized preset was overwritten');
console.log('3a confirmed wardrobe continuity PASS');
const cats=D.managerBuildRenderPlan(after,'match').plan.map(x=>x.category);assert(cats.filter(x=>x==='eyes').length===1&&cats.filter(x=>x==='eyebrows').length===1&&cats.includes('face_base'),'modular face');
const expCats=D.managerBuildRenderPlan(after,'match','expression_03').plan.map(x=>x.category);assert(!expCats.includes('eyes')&&!expCats.includes('eyebrows')&&expCats.includes('expression'),'expression plan');
console.log('4 modular face/expression PASS');
let ageP=D.createDefaultManagerProfile();ageP.appearance.autoVisualAgeing=true;ageP.appearance.manualAgeOverlayPinned=false;ageP.identity.age=18;assert(D.managerResolvedAgeOverlay(ageP)==='age_overlay_01','age18');ageP.identity.age=80;assert(D.managerResolvedAgeOverlay(ageP)==='age_overlay_07','age80');
console.log('5 age rules PASS');
let base=D.createDefaultManagerProfile();D.setManagerProfile(base);let r1=D.randomizeForTest('all','professional','SAME-SEED',['hair']);D.setManagerProfile(base);let r2=D.randomizeForTest('all','professional','SAME-SEED',['hair']);assert(JSON.stringify(r1)===JSON.stringify(r2),'seed reproducibility');assert(r1.appearance.hairId===base.appearance.hairId,'hair lock');
console.log('6 seeded randomization/locks PASS');
D.setManagerProfile(base);const club=context.VELMORA_CLUBS[0];const brandTest=D.assignClubForTest(club);assert(brandTest.before===brandTest.after,'club switch outfit changed');assert(brandTest.branding.clubId===club.id,'branding club');
console.log('7 club branding preserves outfit PASS');
// Save/reload manager record through the actual career save code.
let saveP=D.getManagerProfile();saveP.identity.name='Reload Test';saveP.appearance.eyeId='eye_07';saveP.wardrobePresets.press.outfitId='outfit_formal_03';D.setManagerProfile(saveP);assert(D.saveCareerStateForTest()===true,'save failed');D.setManagerProfile(D.createDefaultManagerProfile());assert(D.loadCareerStateForTest()===true,'load failed');let loaded=D.getManagerProfile();assert(loaded.identity.name==='Reload Test'&&loaded.appearance.eyeId==='eye_07'&&loaded.wardrobePresets.press.outfitId==='outfit_formal_03','save reload mismatch');
console.log('8 save/reload PASS');
const worldCounts={clubs:context.VELMORA_CLUBS.length,divisions:new Set(context.VELMORA_CLUBS.map(c=>c.divisionKey)).size,worlds:new Set(context.VELMORA_CLUBS.map(c=>c.world||'Velmora')).size};
assert(worldCounts.clubs===288&&worldCounts.divisions===16&&worldCounts.worlds===4,'world browser data coverage');
assert([...new Set(context.VELMORA_CLUBS.map(c=>c.divisionKey))].every(key=>context.VELMORA_CLUBS.filter(c=>c.divisionKey===key).length===18),'league membership integrity');
console.log('9 world/league browser coverage PASS');
console.log('ALL LOGIC TESTS PASS');
