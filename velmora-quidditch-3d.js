/*
 * VELMORA QUIDDITCH — 3D BROADCAST RENDERER (V49.2)
 * -------------------------------------------------
 * Additive presentation layer only. Reads live per-frame snapshots pushed by
 * velmora-quidditch-engine.js (which remains the sole source of truth for
 * simulation, tactics, substitutions, stats and career results) and renders
 * them through a Three.js scene instead of the 2D canvas.
 *
 * WHY THERE ARE TWO SPRITE PATHS
 * A browser opened straight from disk (file://) treats every local file as a
 * separate origin. The old 2D canvas may still DRAW those images, but WebGL
 * refuses to upload them as textures, which is why an earlier build showed an
 * empty pitch. Rather than force a dev server on the player, this build picks
 * its sprite path automatically:
 *
 *   WEBGL SPRITES  — used when the artwork can be uploaded (any http/https
 *                    address, i.e. the live site and any local server).
 *                    Real art, correct depth sorting against hoops.
 *   DOM SPRITES    — used when it cannot (file://). The same artwork is placed
 *                    as <img> elements projected through the very same camera,
 *                    so the real riders still appear. Depth ordering between
 *                    riders is preserved; they always draw over the pitch.
 *
 * Either way the player sees their own art, and the hosted site gets the
 * higher-fidelity path with no code change.
 *
 * Public API: window.Velmora3D = { init(config), onFrame(snapshot), dispose() }
 */
(function(){
  'use strict';

  const PITCH_LENGTH = 120;
  const PITCH_WIDTH  = 46;
  const MAX_ALTITUDE = 40;
  const HOOP_X_INSET = 8;
  const PLAYER_H     = 8.2;

  const TEAM_COLOURS = {
    belros:{primary:'#ffd166',secondary:'#7a4b12',trim:'#fff3d0'},
    zafran:{primary:'#5fd0ff',secondary:'#0d3c5c',trim:'#d8f4ff'}
  };

  function clamp(v,a,b){return v<a?a:v>b?b:v}

  function hash01(str){
    let h=2166136261>>>0;str=String(str||'');
    for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}
    h^=h>>>15;return ((h>>>0)%10000)/10000;
  }

  // WebGL will not accept an image the page cannot read pixels from. A single
  // one-pixel read is a reliable synchronous probe for that condition.
  function artworkUsable(image){
    if(!image)return false;
    try{
      const c=document.createElement('canvas');c.width=c.height=2;
      const ctx=c.getContext('2d');
      ctx.drawImage(image,0,0,2,2);
      ctx.getImageData(0,0,1,1);
      return true;
    }catch(_){return false}
  }

  function texFromImage(image){
    const t=new THREE.Texture(image);
    t.needsUpdate=true;t.minFilter=THREE.LinearFilter;t.magFilter=THREE.LinearFilter;t.generateMipmaps=false;
    return t;
  }
  function texFromCanvas(canvas){
    const t=new THREE.CanvasTexture(canvas);
    t.minFilter=THREE.LinearFilter;t.magFilter=THREE.LinearFilter;t.generateMipmaps=false;
    return t;
  }
  function imgAspect(image,fallback=0.66){
    if(image&&image.naturalWidth&&image.naturalHeight)return image.naturalWidth/image.naturalHeight;
    if(image&&image.width&&image.height)return image.width/image.height;
    return fallback;
  }
  function imageSrc(image){return (image&&(image.currentSrc||image.src))||''}

  function radialCanvas(inner,outer){
    const size=128,c=document.createElement('canvas');c.width=c.height=size;
    const ctx=c.getContext('2d');
    const g=ctx.createRadialGradient(size/2,size/2,0,size/2,size/2,size/2);
    g.addColorStop(0,inner);g.addColorStop(1,outer);
    ctx.fillStyle=g;ctx.fillRect(0,0,size,size);
    return c;
  }

  function riderCanvas(team,seed){
    const w=160,h=224,c=document.createElement('canvas');c.width=w;c.height=h;
    const ctx=c.getContext('2d');
    const col=TEAM_COLOURS[team]||TEAM_COLOURS.belros;
    ctx.translate(w/2,h/2);ctx.rotate((seed-0.5)*0.28);ctx.translate(-w/2,-h/2);
    ctx.strokeStyle='#6b4a24';ctx.lineWidth=9;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(22,168);ctx.lineTo(138,140);ctx.stroke();
    ctx.fillStyle='#9a7038';
    ctx.beginPath();ctx.moveTo(138,140);ctx.lineTo(156,124);ctx.lineTo(158,156);ctx.closePath();ctx.fill();
    ctx.fillStyle=col.secondary;
    ctx.beginPath();ctx.moveTo(58,96);ctx.quadraticCurveTo(24,132,34,164);ctx.quadraticCurveTo(62,150,78,132);ctx.closePath();ctx.fill();
    ctx.fillStyle=col.primary;
    ctx.beginPath();ctx.ellipse(88,118,26,32,-0.22,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=col.secondary;ctx.lineWidth=5;ctx.stroke();
    ctx.strokeStyle=col.primary;ctx.lineWidth=9;
    ctx.beginPath();ctx.moveTo(96,112);ctx.lineTo(126,138);ctx.stroke();
    ctx.strokeStyle=col.secondary;ctx.lineWidth=11;
    ctx.beginPath();ctx.moveTo(78,140);ctx.lineTo(58,170);ctx.stroke();
    ctx.fillStyle='#f2d7b8';
    ctx.beginPath();ctx.arc(104,80,20,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=col.trim;
    ctx.beginPath();ctx.arc(104,72,20,Math.PI,Math.PI*2);ctx.fill();
    return c;
  }

  function nameTagCanvas(name,team){
    const w=256,h=64,c=document.createElement('canvas');c.width=w;c.height=h;
    const ctx=c.getContext('2d');
    const col=TEAM_COLOURS[team]||TEAM_COLOURS.belros;
    const label=String(name||'').toUpperCase().slice(0,16);
    ctx.font='700 26px Arial, sans-serif';
    const tw=Math.min(w-16,ctx.measureText(label).width+30);
    ctx.fillStyle='rgba(4,14,26,.74)';
    const x=(w-tw)/2,y=14,r=13;
    ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+tw,y,x+tw,y+36,r);ctx.arcTo(x+tw,y+36,x,y+36,r);
    ctx.arcTo(x,y+36,x,y,r);ctx.arcTo(x,y,x+tw,y,r);ctx.closePath();ctx.fill();
    ctx.strokeStyle=col.primary;ctx.lineWidth=2;ctx.stroke();
    ctx.fillStyle='#fff';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(label,w/2,y+18);
    return c;
  }

  function skyCanvas(){
    const w=8,h=256,c=document.createElement('canvas');c.width=w;c.height=h;
    const ctx=c.getContext('2d'),g=ctx.createLinearGradient(0,0,0,h);
    g.addColorStop(0,'#08203c');g.addColorStop(0.45,'#0d3457');
    g.addColorStop(0.78,'#14527d');g.addColorStop(1,'#1c6b8f');
    ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
    return c;
  }

  function crowdCanvas(){
    const w=512,h=128,c=document.createElement('canvas');c.width=w;c.height=h;
    const ctx=c.getContext('2d');
    ctx.fillStyle='#0a1b2c';ctx.fillRect(0,0,w,h);
    for(let i=0;i<2600;i++){
      const shade=40+Math.random()*90;
      ctx.fillStyle=`rgba(${shade+30},${shade+40},${shade+60},${0.25+Math.random()*0.5})`;
      ctx.fillRect(Math.random()*w,Math.random()*h,2.2,2.2);
    }
    const g=ctx.createLinearGradient(0,0,0,h);
    g.addColorStop(0,'rgba(4,12,22,.85)');g.addColorStop(1,'rgba(4,12,22,.15)');
    ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
    return c;
  }

  function pitchCanvas(){
    const w=1024,h=Math.round(w*(PITCH_WIDTH/PITCH_LENGTH));
    const c=document.createElement('canvas');c.width=w;c.height=h;
    const ctx=c.getContext('2d');
    for(let i=0;i<10;i++){
      ctx.fillStyle=i%2?'rgba(24,78,44,.92)':'rgba(20,68,38,.92)';
      ctx.fillRect(Math.round(i*w/10),0,Math.ceil(w/10),h);
    }
    ctx.strokeStyle='rgba(255,255,255,.42)';ctx.lineWidth=Math.max(2,w*0.0032);
    ctx.strokeRect(w*0.02,h*0.05,w*0.96,h*0.9);
    ctx.beginPath();ctx.moveTo(w*0.5,h*0.05);ctx.lineTo(w*0.5,h*0.95);ctx.stroke();
    ctx.beginPath();ctx.arc(w*0.5,h*0.5,h*0.22,0,Math.PI*2);ctx.stroke();
    [0.085,0.915].forEach(fx=>{ctx.beginPath();ctx.arc(w*fx,h*0.5,h*0.3,0,Math.PI*2);ctx.stroke()});
    return c;
  }

  const S={
    active:false,disposed:true,
    renderer:null,scene:null,camera:null,canvas:null,
    assets:null,teamMeta:null,
    webglTextures:false,   // artwork can be uploaded to WebGL
    domSprites:false,      // artwork exists but must be shown as DOM images
    domLayer:null,domNodes:new Map(),domBall:null,domRef:null,
    viewW:1280,viewH:720,
    yTop:0.205,yBottom:0.820,
    sprites:new Map(),zSeed:new Map(),fallbackTex:{},
    ball:null,ballShadow:null,ref:null,refShadow:null,
    shadowTex:null,glowTex:null,
    camPos:null,camLook:null,proj:null,
    shot:{name:'',until:0,sx:0,sz:0},
    lastTs:0,resizeObserver:null
  };

  function worldX(nx){return (clamp(nx,0,1)-0.5)*PITCH_LENGTH}
  function worldY(ny){
    const span=Math.max(0.001,S.yBottom-S.yTop);
    return clamp((S.yBottom-clamp(ny,S.yTop,S.yBottom))/span,0,1)*MAX_ALTITUDE;
  }
  function worldZ(id){
    if(!S.zSeed.has(id))S.zSeed.set(id,(hash01(id)-0.5)*PITCH_WIDTH*0.7);
    return S.zSeed.get(id);
  }
  function fallbackTexture(team,id){
    const key=team+'|'+id;
    if(!S.fallbackTex[key])S.fallbackTex[key]=texFromCanvas(riderCanvas(team,hash01(id)));
    return S.fallbackTex[key];
  }

  // --- DOM sprite layer (file:// path) ---------------------------------
  function ensureDomLayer(){
    if(S.domLayer)return S.domLayer;
    const host=S.canvas&&S.canvas.parentNode;
    if(!host)return null;
    const layer=document.createElement('div');
    layer.className='v3d-dom-layer';
    layer.setAttribute('aria-hidden','true');
    host.appendChild(layer);
    S.domLayer=layer;
    return layer;
  }

  function domNode(id,image,name,team){
    let rec=S.domNodes.get(id);
    if(rec)return rec;
    const layer=ensureDomLayer();
    if(!layer)return null;
    const wrap=document.createElement('div');
    wrap.className='v3d-dom-rider';
    const img=document.createElement('img');
    img.alt='';img.draggable=false;
    if(image)img.src=imageSrc(image);
    const tag=document.createElement('span');
    tag.className='v3d-dom-tag';
    tag.textContent=String(name||'').toUpperCase().slice(0,18);
    if(team)tag.dataset.team=team;
    wrap.appendChild(tag);wrap.appendChild(img);
    layer.appendChild(wrap);
    rec={wrap,img,tag,src:imageSrc(image)};
    S.domNodes.set(id,rec);
    return rec;
  }

  const _p=typeof THREE!=='undefined'?null:null;
  function projectWorld(x,y,z){
    S.proj.set(x,y,z).project(S.camera);
    return {
      x:(S.proj.x*0.5+0.5)*S.viewW,
      y:(-S.proj.y*0.5+0.5)*S.viewH,
      behind:S.proj.z>1
    };
  }

  function placeDomSprite(rec,x,y,z,heightWorld,dir,image){
    if(!rec)return;
    const base=projectWorld(x,y,z);
    const top=projectWorld(x,y+heightWorld,z);
    if(base.behind||top.behind){rec.wrap.style.display='none';return}
    const hpx=Math.abs(base.y-top.y);
    if(hpx<2||hpx>S.viewH*3){rec.wrap.style.display='none';return}
    const wpx=hpx*imgAspect(image);
    if(base.x<-wpx*2||base.x>S.viewW+wpx*2){rec.wrap.style.display='none';return}
    rec.wrap.style.display='block';
    rec.wrap.style.width=wpx+'px';
    rec.wrap.style.height=hpx+'px';
    rec.wrap.style.transform=`translate(${base.x}px,${base.y}px) translate(-50%,-100%)`;
    rec.img.style.transform=dir<0?'scaleX(-1)':'';
    const dist=S.camera.position.distanceTo(S.proj.set(x,y,z));
    rec.wrap.style.zIndex=String(clamp(Math.round(4000-dist*8),1,9000));
    if(image){
      const src=imageSrc(image);
      if(src&&rec.src!==src){rec.img.src=src;rec.src=src}
    }
  }

  function hideUnusedDomNodes(seen){
    for(const [id,rec] of S.domNodes){
      if(seen.has(id))continue;
      rec.wrap.remove();
      S.domNodes.delete(id);
    }
  }

  // --- Scene construction ---------------------------------------------
  function buildStadium(scene){
    scene.background=texFromCanvas(skyCanvas());
    const turf=new THREE.Mesh(
      new THREE.PlaneGeometry(PITCH_LENGTH*1.08,PITCH_WIDTH*1.14),
      new THREE.MeshBasicMaterial({map:texFromCanvas(pitchCanvas())})
    );
    turf.rotation.x=-Math.PI/2;scene.add(turf);

    const apron=new THREE.Mesh(
      new THREE.PlaneGeometry(PITCH_LENGTH*2.4,PITCH_WIDTH*3.2),
      new THREE.MeshBasicMaterial({color:0x0b2a1c})
    );
    apron.rotation.x=-Math.PI/2;apron.position.y=-0.08;scene.add(apron);

    const crowdTex=texFromCanvas(crowdCanvas());
    crowdTex.wrapS=THREE.RepeatWrapping;crowdTex.repeat.set(6,1);
    const bowl=new THREE.Mesh(
      new THREE.CylinderGeometry(PITCH_LENGTH*0.78,PITCH_LENGTH*0.62,34,56,1,true),
      new THREE.MeshBasicMaterial({map:crowdTex,side:THREE.BackSide})
    );
    bowl.position.y=17;scene.add(bowl);

    const rim=new THREE.Mesh(
      new THREE.CylinderGeometry(PITCH_LENGTH*0.79,PITCH_LENGTH*0.79,3,56,1,true),
      new THREE.MeshBasicMaterial({color:0x0a1f33,side:THREE.DoubleSide})
    );
    rim.position.y=35;scene.add(rim);
  }

  function buildArenaBackdrop(scene,arenaImg){
    const aspect=imgAspect(arenaImg,16/9);
    const width=PITCH_LENGTH*2.7,height=width/aspect;
    const mesh=new THREE.Mesh(
      new THREE.PlaneGeometry(width,height),
      new THREE.MeshBasicMaterial({map:texFromImage(arenaImg),fog:false,depthWrite:false})
    );
    mesh.position.set(0,height*0.34,-PITCH_LENGTH*0.92);
    mesh.renderOrder=-1;scene.add(mesh);
  }

  function buildHoops(scene){
    const poleMat=new THREE.MeshBasicMaterial({color:0x9fb4c6});
    const ringMat=new THREE.MeshBasicMaterial({color:0xe6bf62});
    [-1,1].forEach(side=>{
      const x=side*(PITCH_LENGTH/2-HOOP_X_INSET);
      [[-11,15],[0,23],[11,17]].forEach(([z,height])=>{
        const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.4,0.5,height,10),poleMat);
        pole.position.set(x,height/2,z);scene.add(pole);
        const ring=new THREE.Mesh(new THREE.TorusGeometry(3.4,0.34,10,26),ringMat);
        ring.position.set(x,height+3.1,z);ring.rotation.y=Math.PI/2;scene.add(ring);
      });
    });
  }

  function ensureSprite(id,team,name){
    let rec=S.sprites.get(id);
    if(rec)return rec;
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({transparent:true,depthWrite:false}));
    sprite.renderOrder=3;
    const shadow=new THREE.Sprite(new THREE.SpriteMaterial({map:S.shadowTex,transparent:true,depthWrite:false,opacity:.45}));
    shadow.renderOrder=1;
    S.scene.add(shadow);S.scene.add(sprite);
    rec={sprite,shadow,tag:null,team};
    if(!S.domSprites){
      const tag=new THREE.Sprite(new THREE.SpriteMaterial({map:texFromCanvas(nameTagCanvas(name,team)),transparent:true,depthWrite:false,opacity:.92}));
      tag.renderOrder=4;tag.scale.set(11,2.75,1);
      S.scene.add(tag);rec.tag=tag;
    }
    S.sprites.set(id,rec);
    return rec;
  }

  function applyPlayerTexture(rec,entity,phase){
    const mat=rec.sprite.material;
    let image=null;
    if(S.webglTextures&&S.assets){
      const grounded=phase==='intro'||phase==='halftime'||phase==='secondcountdown'||phase==='fulltime';
      image=grounded
        ?(S.assets[entity.id+'Standing']||S.assets[entity.id+'Riding'])
        :(S.assets[entity.id+'Riding']||S.assets[entity.id+'Standing']);
    }
    if(image){
      if(mat.__img!==image){
        if(mat.map)mat.map.dispose();
        mat.map=texFromImage(image);mat.__img=image;mat.needsUpdate=true;
      }
      rec.sprite.visible=true;
      rec.sprite.scale.set((entity.dir<0?-1:1)*PLAYER_H*imgAspect(image),PLAYER_H,1);
    }else if(S.domSprites){
      rec.sprite.visible=false;   // the DOM layer draws this rider
    }else{
      const tex=fallbackTexture(entity.team||rec.team,entity.id);
      if(mat.map!==tex){mat.map=tex;mat.__img=null;mat.needsUpdate=true}
      rec.sprite.visible=true;
      rec.sprite.scale.set((entity.dir<0?-1:1)*PLAYER_H*0.72,PLAYER_H,1);
    }
  }

  function playerImage(id,phase){
    if(!S.assets)return null;
    const grounded=phase==='intro'||phase==='halftime'||phase==='secondcountdown'||phase==='fulltime';
    return grounded
      ?(S.assets[id+'Standing']||S.assets[id+'Riding'])
      :(S.assets[id+'Riding']||S.assets[id+'Standing']);
  }

  // --- Camera director -------------------------------------------------
  function actionFocus(snapshot){
    let cx=worldX(snapshot.ball?snapshot.ball.x:0.5);
    let cy=worldY(snapshot.ball?snapshot.ball.y:0.6);
    if(snapshot.entities&&snapshot.entities.length){
      let ex=0,ey=0;
      for(const e of snapshot.entities){ex+=worldX(e.x);ey+=worldY(e.y)}
      ex/=snapshot.entities.length;ey/=snapshot.entities.length;
      cx=cx*0.62+ex*0.38;cy=cy*0.55+ey*0.45;
    }
    return {x:cx,y:cy};
  }

  function chooseShot(now,snapshot){
    const s=S.shot;
    if(now<s.until&&s.name)return s;
    const goal=!!snapshot.celebration;
    const dead=snapshot.phase==='intro'||snapshot.phase==='halftime'||snapshot.phase==='secondcountdown'||snapshot.phase==='fulltime';
    s.name=goal?'GOAL':dead?'WIDE':['MAIN','MAIN','SIDE','HIGH'][Math.floor(Math.random()*4)];
    s.until=now+(goal?4600:dead?7000:6000+Math.random()*3000);
    s.sx=Math.random()<0.5?-1:1;
    s.sz=(Math.random()-0.5)*10;
    return s;
  }

  function cameraTarget(snapshot){
    const f=actionFocus(snapshot);
    const shot=chooseShot(performance.now(),snapshot);
    const look=new THREE.Vector3(f.x,clamp(f.y*0.75+5,6,26),0);
    let pos;
    switch(shot.name){
      case 'GOAL':{
        const team=snapshot.celebration&&snapshot.celebration.team;
        const dir=(S.teamMeta&&S.teamMeta[team]&&S.teamMeta[team].attack)||1;
        const hoopX=dir*(PITCH_LENGTH/2-HOOP_X_INSET);
        pos=new THREE.Vector3(hoopX-dir*34,20,26*shot.sx);
        look.set(hoopX-dir*6,18,0);
        break;
      }
      case 'WIDE': pos=new THREE.Vector3(0,38,96);look.set(0,14,0);break;
      case 'HIGH': pos=new THREE.Vector3(f.x*0.6,46,58);look.set(f.x,clamp(f.y*0.6+4,5,22),0);break;
      case 'SIDE': pos=new THREE.Vector3(f.x-30*shot.sx,17,44+shot.sz);break;
      case 'MAIN':
      default:     pos=new THREE.Vector3(f.x*0.55,27,66+shot.sz);break;
    }
    return {pos,look};
  }

  function stepCamera(snapshot,dt){
    const {pos,look}=cameraTarget(snapshot);
    const k=clamp(1-Math.pow(0.0016,dt),0,1);
    S.camPos.lerp(pos,k);
    S.camLook.lerp(look,clamp(k*1.25,0,1));
    S.camera.position.copy(S.camPos);
    S.camera.lookAt(S.camLook);
    S.camera.updateMatrixWorld();
  }

  // --- Public API -------------------------------------------------------
  function init(config){
    if(typeof THREE==='undefined'){console.error('[VELMORA 3D] THREE.js unavailable');return}
    dispose();

    S.canvas=config.canvas;
    S.assets=config.assets||{};
    S.teamMeta=config.teamMeta||{};
    S.yTop=(config.flightBounds&&config.flightBounds.top)||0.205;
    S.yBottom=(config.flightBounds&&config.flightBounds.bottom)||0.820;
    S.sprites=new Map();S.zSeed=new Map();S.fallbackTex={};S.domNodes=new Map();

    S.webglTextures=artworkUsable(S.assets.arena)||artworkUsable(S.assets.ball);
    const hasRiderArt=Object.keys(S.assets).some(k=>/Riding$|Standing$/.test(k));
    S.domSprites=!S.webglTextures&&hasRiderArt;

    if(!S.webglTextures){
      console.info('[VELMORA 3D] This page cannot upload its artwork to WebGL (usual cause: the game was opened directly from disk as file://). '+
        (S.domSprites
          ?'Riders are being drawn as images over the 3D pitch so your real sprites still appear. Serving the folder over http also restores the painted stadium backdrop.'
          :'Falling back to procedural riders.'));
    }
    const badge=document.querySelector('.wcg-3d-badge');
    if(badge)badge.textContent=S.webglTextures?'3D BROADCAST':(S.domSprites?'3D BROADCAST':'3D BROADCAST · PLACEHOLDER RIDERS');

    const renderer=new THREE.WebGLRenderer({canvas:S.canvas,antialias:true,alpha:false});
    renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
    const rect=S.canvas.getBoundingClientRect();
    S.viewW=Math.max(2,Math.round(rect.width||config.width||1280));
    S.viewH=Math.max(2,Math.round(rect.height||config.height||720));
    renderer.setSize(S.viewW,S.viewH,false);
    renderer.setClearColor(0x0d3457,1);
    S.renderer=renderer;

    const scene=new THREE.Scene();
    scene.fog=new THREE.Fog(0x14527d,150,340);
    S.scene=scene;

    S.camera=new THREE.PerspectiveCamera(48,S.viewW/S.viewH,0.5,900);
    S.camPos=new THREE.Vector3(0,32,86);
    S.camLook=new THREE.Vector3(0,12,0);
    S.proj=new THREE.Vector3();
    S.camera.position.copy(S.camPos);
    S.camera.lookAt(S.camLook);
    S.camera.updateMatrixWorld();

    S.shadowTex=texFromCanvas(radialCanvas('rgba(0,0,0,.6)','rgba(0,0,0,0)'));
    S.glowTex=texFromCanvas(radialCanvas('rgba(255,214,120,.95)','rgba(255,214,120,0)'));

    buildStadium(scene);
    if(S.webglTextures&&S.assets.arena)buildArenaBackdrop(scene,S.assets.arena);
    buildHoops(scene);

    S.ball=new THREE.Sprite(new THREE.SpriteMaterial({
      map:(S.webglTextures&&S.assets.ball)?texFromImage(S.assets.ball):S.glowTex,
      transparent:true,depthWrite:false
    }));
    S.ball.scale.set(3.1,3.1,1);S.ball.renderOrder=5;scene.add(S.ball);
    S.ballShadow=new THREE.Sprite(new THREE.SpriteMaterial({map:S.shadowTex,transparent:true,depthWrite:false,opacity:.4}));
    S.ballShadow.scale.set(3.4,1.8,1);scene.add(S.ballShadow);

    S.ref=new THREE.Sprite(new THREE.SpriteMaterial({transparent:true,depthWrite:false}));
    S.ref.renderOrder=3;S.ref.visible=false;scene.add(S.ref);
    S.refShadow=new THREE.Sprite(new THREE.SpriteMaterial({map:S.shadowTex,transparent:true,depthWrite:false,opacity:.4}));
    S.refShadow.scale.set(5,2.4,1);S.refShadow.visible=false;scene.add(S.refShadow);

    if(S.domSprites)ensureDomLayer();

    S.active=true;S.disposed=false;S.lastTs=performance.now();S.shot.until=0;S.shot.name='';

    try{
      S.resizeObserver=new ResizeObserver(handleResize);
      S.resizeObserver.observe(S.canvas);
    }catch(_){}

    renderer.render(scene,S.camera);
  }

  function handleResize(){
    if(!S.renderer||!S.canvas)return;
    const rect=S.canvas.getBoundingClientRect();
    S.viewW=Math.max(2,Math.round(rect.width));
    S.viewH=Math.max(2,Math.round(rect.height));
    S.renderer.setSize(S.viewW,S.viewH,false);
    S.camera.aspect=S.viewW/S.viewH;
    S.camera.updateProjectionMatrix();
  }

  function onFrame(snapshot){
    if(!S.active||!S.renderer||!snapshot)return;
    const now=performance.now();
    const dt=clamp((now-(S.lastTs||now))/1000,0,0.12);
    S.lastTs=now;

    // Camera first: the DOM layer projects through this exact camera.
    stepCamera(snapshot,dt);

    const seen=new Set();
    for(const e of (snapshot.entities||[])){
      seen.add(e.id);
      const rec=ensureSprite(e.id,e.team,e.name||e.id);
      applyPlayerTexture(rec,e,snapshot.phase);
      const x=worldX(e.x),y=Math.max(1.2,worldY(e.y)),z=worldZ(e.id);
      rec.sprite.position.set(x,y+PLAYER_H*0.5,z);
      if(rec.tag)rec.tag.position.set(x,y+PLAYER_H*1.12,z);
      rec.shadow.position.set(x,0.05,z);
      const near=clamp(1-(y/MAX_ALTITUDE)*0.55,0.35,1);
      rec.shadow.scale.set(7*near,3.4*near,1);
      rec.shadow.material.opacity=0.45*near;
    }
    for(const [id,rec] of S.sprites){
      if(seen.has(id))continue;
      S.scene.remove(rec.sprite);S.scene.remove(rec.shadow);
      if(rec.tag)S.scene.remove(rec.tag);
      if(rec.sprite.material.map&&rec.sprite.material.__img)rec.sprite.material.map.dispose();
      rec.sprite.material.dispose();rec.shadow.material.dispose();
      if(rec.tag){if(rec.tag.material.map)rec.tag.material.map.dispose();rec.tag.material.dispose()}
      S.sprites.delete(id);
    }

    // Referee
    if(snapshot.ref&&S.webglTextures&&S.assets){
      const refImg=((snapshot.phase==='intro'||snapshot.phase==='halftime'||snapshot.phase==='fulltime')?S.assets.refStanding:S.assets.refFlying)||S.assets.refStanding;
      if(refImg){
        const mat=S.ref.material;
        if(mat.__img!==refImg){if(mat.map)mat.map.dispose();mat.map=texFromImage(refImg);mat.__img=refImg;mat.needsUpdate=true}
        S.ref.visible=true;S.refShadow.visible=true;
        S.ref.scale.set((snapshot.ref.dir<0?-1:1)*PLAYER_H*imgAspect(refImg),PLAYER_H,1);
        const x=worldX(snapshot.ref.x),y=Math.max(1.2,worldY(snapshot.ref.y)),z=worldZ('__ref__');
        S.ref.position.set(x,y+PLAYER_H*0.5,z);
        S.refShadow.position.set(x,0.05,z);
      }
    }

    // Ball
    if(snapshot.ball){
      const visible=snapshot.ball.visible!==false;
      S.ball.visible=visible&&!(S.domSprites&&S.assets&&S.assets.ball);
      S.ballShadow.visible=visible;
      const x=worldX(snapshot.ball.x),y=Math.max(1.4,worldY(snapshot.ball.y)),z=worldZ('__ball__');
      if(visible){
        S.ball.position.set(x,y,z);
        S.ballShadow.position.set(x,0.06,z);
        const s=snapshot.ball.flight?3.6:3.1;
        S.ball.scale.set(s,s,1);
      }
    }

    S.renderer.render(S.scene,S.camera);

    // DOM sprite pass — real artwork projected through the same camera.
    if(S.domSprites){
      const domSeen=new Set();
      for(const e of (snapshot.entities||[])){
        const image=playerImage(e.id,snapshot.phase);
        if(!image)continue;
        domSeen.add(e.id);
        const rec=domNode(e.id,image,e.name||e.id,e.team);
        placeDomSprite(rec,worldX(e.x),Math.max(1.2,worldY(e.y)),worldZ(e.id),PLAYER_H,e.dir,image);
      }
      if(snapshot.ref){
        const refImg=((snapshot.phase==='intro'||snapshot.phase==='halftime'||snapshot.phase==='fulltime')?S.assets.refStanding:S.assets.refFlying)||S.assets.refStanding;
        if(refImg){
          domSeen.add('__ref__');
          const rec=domNode('__ref__',refImg,'REFEREE','');
          if(rec)rec.tag.style.display='none';
          placeDomSprite(rec,worldX(snapshot.ref.x),Math.max(1.2,worldY(snapshot.ref.y)),worldZ('__ref__'),PLAYER_H,snapshot.ref.dir,refImg);
        }
      }
      if(snapshot.ball&&snapshot.ball.visible!==false&&S.assets.ball){
        domSeen.add('__ball__');
        const rec=domNode('__ball__',S.assets.ball,'','');
        if(rec)rec.tag.style.display='none';
        placeDomSprite(rec,worldX(snapshot.ball.x),Math.max(1.4,worldY(snapshot.ball.y)),worldZ('__ball__'),3.2,1,S.assets.ball);
      }
      hideUnusedDomNodes(domSeen);
    }
  }

  function dispose(){
    if(S.disposed)return;
    S.active=false;
    try{S.resizeObserver&&S.resizeObserver.disconnect()}catch(_){}
    S.resizeObserver=null;
    if(S.domLayer){try{S.domLayer.remove()}catch(_){}}
    S.domLayer=null;S.domNodes=new Map();
    if(S.scene){
      S.scene.traverse(obj=>{
        if(obj.material){
          if(obj.material.map)obj.material.map.dispose();
          obj.material.dispose();
        }
        if(obj.geometry)obj.geometry.dispose();
      });
      if(S.scene.background&&S.scene.background.dispose)S.scene.background.dispose();
    }
    if(S.renderer){try{S.renderer.dispose()}catch(_){}}
    S.renderer=null;S.scene=null;S.camera=null;
    S.sprites=new Map();S.zSeed=new Map();S.fallbackTex={};
    S.ball=null;S.ballShadow=null;S.ref=null;S.refShadow=null;
    S.disposed=true;
  }

  window.Velmora3D={init,onFrame,dispose,get active(){return S.active}};
})();
