// Run with node tools/test_player_sprites.cjs. Exercises the actual app functions.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'app.js'),'utf8');
function fn(name){const start=source.indexOf('  function '+name+'(');assert(start>=0,name);const endline=source.indexOf('\n',start);return source.slice(start,source.slice(start,endline).endsWith('}')?endline:source.indexOf('\n  }',endline)+4);}
const ctx=vm.createContext({window:{},trainingRules:require('../training.js'),Set,Map,Math,Number,String,Array,console});
vm.runInContext(fs.readFileSync(path.join(root,'data/player-sprites.js'),'utf8'),ctx);
vm.runInContext(`const playerSpriteCatalog=window.VELMORA_PLAYER_SPRITES,playerSpriteIds=new Set(playerSpriteCatalog.ids);
let avatarOrder=null,fullAvatarOrder=null,worldSeed='SPRITE-QA';
const V210_STANDING_ROOT='assets/quidditch-engine/standing/',V210_RIDER_ROOT='assets/quidditch-engine/players/';
const clubWorldName=club=>club.world||'Velmora';
const Image=()=>{throw new Error('Prepared avatars must not be recropped')};
`,ctx);
for(const name of ['hashString','mulberry32','clamp','escapeHtml','playerSpriteAssetUrl','preparedPlayerAvatar','getAvatarOrder','getFullAvatarOrder','seniorAvatarPathFor','repairSeniorSquadAvatars','v210AvatarNumber','v210EngineStat','v210PlayerAttributes','matchdayUnavailable','v210PlayerConfig','avatarHTML','v202StartAvatarHydration'])vm.runInContext(fn(name),ctx);
const catalog=ctx.window.VELMORA_PLAYER_SPRITES;
assert.equal(catalog.ids.length,1609);assert.equal(new Set(catalog.ids).size,1609);
for(const n of catalog.ids){
 const player={id:'QA-'+n,avatar:`assets/player-avatars/player-${String(n).padStart(3,'0')}.png`,name:'Source '+n};
 assert.equal(ctx.v210AvatarNumber(player),n,'Avatar / match identity mismatch');
 const config=ctx.v210PlayerConfig(player);
 for(const file of [player.avatar,config.standing,config.riding])assert(fs.existsSync(path.join(root,file.split('?')[0])),file);
 assert(config.standing.endsWith('?sprite=alpha-2')&&config.riding.endsWith('?sprite=alpha-2'));
 const img={dataset:{},getAttribute:()=>player.avatar};ctx.v202StartAvatarHydration(img);assert.equal(img.dataset.avatarHydrationState,'done');
 assert(ctx.avatarHTML(player.avatar,player.name).includes('player-full-body-avatar'));
 assert(ctx.avatarHTML(player.avatar,player.name).includes('.png?sprite=alpha-2'));
 assert(!player.avatar.includes('?'),'Cache version leaked into saved appearance');
}
for(const world of ['Velmora','Kharova','Caldria','Ezuraya']){
 const club={id:'QA-'+world,world},selected=Array.from({length:6},(_,i)=>ctx.seniorAvatarPathFor(club,i));
 assert.equal(new Set(selected).size,6);
 for(const file of selected)assert(catalog.pools[world].includes(Number(file.match(/player-(\d+)/)[1])));
}
const legacy={id:'SAVED-PLAYER',name:'Existing player',avatar:'assets/player-avatars/player-216.png',ovr:77,goals:9};
ctx.repairSeniorSquadAvatars({id:'KH-TEST',world:'Kharova'},[legacy]);
assert(catalog.pools.Kharova.includes(Number(legacy.avatar.match(/player-(\d+)/)[1])));
const identity=legacy.avatar;
ctx.repairSeniorSquadAvatars({id:'EZ-TRANSFER',world:'Ezuraya'},[legacy]);
assert.equal(legacy.avatar,identity,'Transfer changed an existing appearance');
assert.equal(legacy.id,'SAVED-PLAYER');assert.equal(legacy.ovr,77);assert.equal(legacy.goals,9);
const oldHome={avatar:'assets/player-avatars/player-216.png'};
ctx.repairSeniorSquadAvatars({id:'VM',world:'Velmora'},[oldHome]);assert.equal(oldHome.avatar,'assets/player-avatars/player-216.png');
assert(catalog.ids.includes(ctx.v210AvatarNumber({id:'BAD',avatar:'assets/player-avatars/player-9999.png'})));
console.log(JSON.stringify({status:'PASS',matchedPlayerIds:catalog.ids.length,resolvedImagePaths:catalog.ids.length*3,preparedAvatarBypasses:catalog.ids.length,worldPools:Object.fromEntries(Object.entries(catalog.pools).map(([k,v])=>[k,v.length])),saveMigration:'PASS',transferIdentity:'PASS',invalidIdFallback:'PASS'},null,2));
