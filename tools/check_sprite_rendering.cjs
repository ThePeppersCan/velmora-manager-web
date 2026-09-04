// Standalone canvas checks using the game's actual sizing and draw functions.
// This is a rendering fixture, not a captured browser session or match simulation.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const runtime=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const {createCanvas,loadImage}=require(runtime?path.join(runtime,'@napi-rs/canvas'):'@napi-rs/canvas');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'velmora-quidditch-engine.js'),'utf8');
function fn(name){const start=source.indexOf('  function '+name+'('),endline=source.indexOf('\n',start);assert(start>=0);return source.slice(start,source.slice(start,endline).endsWith('}')?endline:source.indexOf('\n  }',endline)+4);}
const catalog=JSON.parse(fs.readFileSync(path.join(root,'data/player-sprite-manifest.json'),'utf8'));
const state={careerMode:true,assets:{}},ctx=vm.createContext({state,Math,Number,console,W:1672,H:941,PLAYER_STAND_HEIGHT:90.3,PLAYER_RIDE_HEIGHT:113.4,PLAYER_SCALE:{},STANDING_VISIBLE_BOTTOM:{},actionPose:()=>({}),fixtureVisualFloorY:()=>.904,fixtureGroundY:()=>.805});
for(const name of ['playerSpriteHeight','drawSprite'])vm.runInContext(fn(name),ctx);
(async()=>{
 const chosen=[1,201,361,699,1010,1105,1198,1273,1339,1450,1523,1598];
 const rideCanvas=createCanvas(1672,941),standCanvas=createCanvas(1672,941);
 const ride=rideCanvas.getContext('2d'),stand=standCanvas.getContext('2d');
 const arena=await loadImage(path.join(root,'assets/quidditch-engine/arenas/torre-piccola-popolare-arena.webp'));
 ride.drawImage(arena,0,0,1672,941);stand.drawImage(arena,0,0,1672,941);
 let checks=0;
 for(const record of catalog.players){
   const p={id:'QA-'+record.id,name:'PLAYER '+record.id,spriteMetrics:{}};
   for(const standing of [false,true]){
     const img=await loadImage(path.join(root,record[standing?'standing_path':'flying_path']));
     state.assets[p.id+(standing?'Standing':'Riding')]=img;
     const e={player:p,x:.5,y:.5,dir:1,team:'belros'};
     const h=ctx.playerSpriteHeight(e,standing),w=h*img.width/img.height;
     assert(h<=(standing?90:82)+1e-8&&w<=(standing?124:154)+1e-8,'Oversized frame '+record.id);
     const i=chosen.indexOf(record.id);
     if(i>=0){
       e.x=.12+(i%6)*.15;e.y=standing?.805:.40+Math.floor(i/6)*.24;e.dir=i%2?1:-1;e.team=i%2?'zafran':'belros';
       if(standing){
         // Exporter uses the same symmetric transparent padding for every native pose.
         const artHeight=record.standing.bbox[3]-record.standing.bbox[1];
         p.spriteMetrics.standingBottom=(img.height+artHeight)/(2*img.height);
         if(i<6)ctx.drawSprite(stand,img,e,h,true);
       }else ctx.drawSprite(ride,img,e,h,false);
     }
     delete state.assets[p.id+(standing?'Standing':'Riding')];checks++;
   }
 }
 for(const [c,text] of [[ride,'ACTUAL SPRITE DRAW FUNCTION · FLYING POSES · RENDERING FIXTURE'],[stand,'ACTUAL SPRITE DRAW FUNCTION · STANDING POSES · RENDERING FIXTURE']]){
   c.fillStyle='rgba(8,19,33,.9)';c.fillRect(0,0,1672,58);c.font='bold 21px sans-serif';c.fillStyle='#e1edf8';c.fillText(text,28,37);
 }
 fs.writeFileSync(path.join(root,'sprite-review/render-check.png'),rideCanvas.toBuffer('image/png'));
 fs.writeFileSync(path.join(root,'sprite-review/standing-check.png'),standCanvas.toBuffer('image/png'));
 const report={status:'PASS',nativeFramesSized:checks,flyingMaximum:{width:154,height:82},standingMaximum:{width:124,height:90},renderFunction:'Actual drawSprite / playerSpriteHeight from velmora-quidditch-engine.js',browserPlaytest:'Not performed: local preview connection blocked'};
 fs.writeFileSync(path.join(root,'data/player-render-validation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
