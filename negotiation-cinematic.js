/* V83 — continuous cast staged behind the negotiation desk. Presentation only: no career-state writes. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.VelmoraNegotiationScene=api;
})(typeof window==='object'?window:globalThis,function(){
  'use strict';

  const ROOT='assets/career/negotiation/';
  const KIT=ROOT+'cutscene-kit/';
  const PLATES=Object.freeze([
    'boardroom-wide.png','boardroom-reverse.png','boardroom-table.png',
    'cafe-wide.png','cafe-over-shoulder.png','cafe-table-wide.png','cafe-table-close.png'
  ]);
  const SHOTS=Object.freeze({
    'boardroom-wide':{
      plate:'boardroom-wide.png',foreground:'boardroom-wide-foreground.png',
      camera:'camera-left-foreground.png',light:'boardroom-light-overlay.png',
      placements:{playerManager:{x:.30,y:.46,scale:.94},oppositionManager:{x:.70,y:.46,scale:.94,flipX:true}}
    },
    'boardroom-reverse':{
      plate:'boardroom-reverse.png',foreground:'boardroom-reverse-foreground.png',
      camera:'camera-over-shoulder-foreground.png',light:'boardroom-light-overlay.png',
      placements:{playerManager:{x:.29,y:.46,scale:.92},oppositionManager:{x:.66,y:.46,scale:.96,flipX:true}}
    },
    'boardroom-table':{
      plate:'boardroom-table.png',foreground:'boardroom-table-foreground.png',
      camera:'camera-right-foreground.png',light:'boardroom-light-overlay.png',
      placements:{playerManager:{x:.31,y:.46,scale:.94},oppositionManager:{x:.69,y:.46,scale:.94,flipX:true}}
    },
    'cafe-wide':{
      plate:'cafe-wide.png',foreground:'cafe-wide-foreground.png',
      camera:'camera-left-foreground.png',light:'cafe-light-overlay.png',
      placements:{playerManager:{x:.28,y:.45,scale:.86},agent:{x:.48,y:.45,scale:.86,flipX:true},player:{x:.67,y:.44,scale:.78,flipX:true}}
    },
    'cafe-ots':{
      plate:'cafe-over-shoulder.png',foreground:'cafe-over-shoulder-foreground.png',
      camera:'camera-over-shoulder-foreground.png',light:'cafe-light-overlay.png',
      placements:{playerManager:{x:.28,y:.45,scale:.84},agent:{x:.48,y:.45,scale:.86},player:{x:.67,y:.44,scale:.78,flipX:true}}
    },
    'cafe-table-wide':{
      plate:'cafe-table-wide.png',foreground:'cafe-table-wide-foreground.png',
      camera:'camera-right-foreground.png',light:'cafe-light-overlay.png',
      placements:{playerManager:{x:.28,y:.45,scale:.86},agent:{x:.48,y:.45,scale:.86},player:{x:.67,y:.44,scale:.78,flipX:true}}
    },
    'cafe-table-close':{
      plate:'cafe-table-close.png',foreground:'cafe-table-close-foreground.png',
      camera:'camera-right-foreground.png',light:'cafe-light-overlay.png',
      placements:{playerManager:{x:.30,y:.45,scale:.84},agent:{x:.49,y:.45,scale:.86},player:{x:.68,y:.44,scale:.78,flipX:true}}
    }
  });

  const clubOpen={
    HARDLINE:['We have a squad to protect. Let us hear your proposal.','A move would need to make sense for this club.','We are listening. Put your terms on the table.'],
    PRAGMATIC:['Let us see whether there is a deal that works for both clubs.','We can discuss a move. Where would you like to begin?','We have set aside time to hear a serious proposal.'],
    PATIENT:['Take a seat. We can work through the proposal together.','There is time to discuss the details properly.','Let us begin with what you have in mind.'],
    AGGRESSIVE:['Let us get straight to the proposal.','You asked for this meeting. What are you offering?','We would like to understand your position today.'],
    FINANCIALLY_PRESSURED:['We are prepared to discuss the right move.','There may be a way forward for both clubs.','We are open to a conversation about the player.'],
    RELUCTANT_SELLER:['This player is part of our plans. We will hear you out.','We value what the player brings to our squad.','A departure would leave a gap. Tell us how you see this working.'],
    DEALMAKER:['Let us put the options on the table.','Perhaps we can find terms that suit everyone.','We are ready to explore a sensible agreement.'],
    DEADLINE_DESPERATE:['Time is short. Let us work through your proposal.','There is still time to discuss a move.','We should get to the terms while the opportunity is here.']
  };
  const agentOpen={
    ambition:['The next step needs to be the right one. Tell us about the role.','We would like to hear where the player fits into your plans.','Before anything is signed, let us talk about the opportunity.'],
    loyalty:['A move is a big decision. Let us discuss the whole picture.','We want an agreement the player can feel settled with.','Thank you for meeting us. What future are you offering?'],
    balanced:['Now let us discuss personal terms.','Take a seat. We are ready to look at your package.','Let us talk about the role, the contract and the next chapter.']
  };
  const responseLines={
    boardroom:{
      accepted:['We have an agreement on the club side.','That gives both clubs a basis to move forward.','The fee can go into the paperwork.'],
      counter:['The other side slides a revised figure across the table.','They have considered your proposal and returned with their own.','A short discussion ends with a new figure on the page.'],
      rejected:['The proposal is set back on the table.','The other side pauses before giving its answer.','The room falls quiet as they explain their position.'],
      final:['The representative underlines the figure once more.','One last proposal sits between the two sides.','The conversation comes down to this final position.'],
      walked:['The representative closes the folder.','The meeting ends without an agreement.','The papers are gathered and the chairs move back.'],
      pending:['The proposal is being reviewed.','The other side takes a moment with the figures.','Your offer is on the table.']
    },
    agent:{
      accepted:['The player’s representatives are ready to put this in writing.','The conversation turns to the final paperwork.','Personal terms are agreed. The decision is yours to complete.'],
      counter:['The agent turns the notebook towards you.','The player’s camp returns with a revised package.','A few details are circled for another discussion.'],
      rejected:['The agent explains the concerns with the proposal.','The package is placed back in front of you.','They take a moment before responding to the terms.'],
      final:['The agent sets out a closing position.','The discussion has reached its final proposal.','The last set of terms is laid out for your decision.'],
      walked:['The representatives gather their papers.','The conversation ends without a signature.','The player’s camp brings the meeting to a close.'],
      pending:['The representatives are looking over the package.','The terms are being considered across the table.','There is a pause while the package is reviewed.']
    }
  };

  const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const attr=escape;
  const hash=s=>{let n=2166136261;for(const c of String(s)){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}return n>>>0;};
  const pick=(list,key)=>list[hash(key)%list.length];
  const instances=new WeakMap();
  const probes=new Map();

  function statusFor(session,spec={}){
    if(spec.status)return spec.status;
    const result=session?.lastResponse?.result;
    if(result==='AGREE')return 'accepted';
    if(result==='COUNTER')return 'counter';
    if(result==='REJECT')return 'rejected';
    if(result==='FINAL')return 'final';
    if(session?.state==='WALKED')return 'walked';
    if(session?.state==='PENDING')return 'pending';
    return 'idle';
  }
  function shotKeyFor(stage,status,editing=false){
    if(stage==='agent'){
      if(status==='accepted')return 'cafe-table-wide';
      if(editing||status==='pending')return 'cafe-table-wide';
      if(status==='counter'||status==='rejected'||status==='final'||status==='walked')return 'cafe-table-wide';
      return 'cafe-wide';
    }
    if(status==='accepted')return 'boardroom-table';
    if(editing||status==='pending')return 'boardroom-table';
    if(status==='counter'||status==='rejected'||status==='final'||status==='walked')return 'boardroom-table';
    return 'boardroom-wide';
  }
  function plateFor(stage,status,editing=false){return ROOT+SHOTS[shotKeyFor(stage,status,editing)].plate;}
  function flavor(spec,status){
    const stage=spec.stage==='agent'?'agent':'boardroom';
    const key=[spec.session?.id,spec.playerId,stage,status].join('|');
    if(status!=='idle')return pick(responseLines[stage][status]||responseLines[stage].pending,key);
    if(stage==='agent'){
      const disposition=Number(spec.ambition)>Number(spec.loyalty)+12?'ambition':Number(spec.loyalty)>Number(spec.ambition)+12?'loyalty':'balanced';
      return pick(agentOpen[disposition],key);
    }
    return pick(clubOpen[spec.session?.personality]||clubOpen.PRAGMATIC,key);
  }
  function probe(src,ImageType){
    if(!ImageType)return Promise.resolve(false);
    if(probes.has(src))return probes.get(src);
    const request=new Promise(resolve=>{
      const image=new ImageType();
      image.onload=()=>resolve(true);
      image.onerror=()=>resolve(false);
      image.src=src;
    });
    probes.set(src,request);
    return request;
  }
  function assetURLs(shot){
    return {
      plate:ROOT+shot.plate,
      foreground:KIT+shot.foreground,
      camera:shot.camera?KIT+shot.camera:'',
      light:shot.light?KIT+shot.light:'',
      seatShadow:KIT+'contact-shadow-seat.png',
      tableShadow:KIT+'contact-shadow-table.png'
    };
  }
  function ensure(modal){
    let view=instances.get(modal);
    if(view)return view;
    const doc=modal.ownerDocument;
    const scene=doc.createElement('div');
    scene.className='v73-cutscene';
    scene.setAttribute('aria-hidden','true');
    scene.innerHTML='<div class="v73-shot"></div><div class="v73-shot"></div><div class="v73-screen-grade"></div><div class="v73-dialogue" role="presentation"></div>';
    modal.insertBefore(scene,modal.firstChild);
    view={modal,scene,layers:Array.from(scene.querySelectorAll('.v73-shot')),dialogue:scene.querySelector('.v73-dialogue'),current:-1,src:'',request:0,spec:null,status:'idle',editing:false};
    const edit=event=>{
      if(!event.target.closest?.('.offer-builder,.contract-grid,.v35-agreement-type'))return;
      if(!view.spec||view.editing)return;
      view.editing=true;
      showShot(view,shotKeyFor(view.spec.stage,view.status,true),view.spec);
    };
    modal.addEventListener('input',edit);
    modal.addEventListener('change',edit);
    instances.set(modal,view);
    return view;
  }
  function roleLabel(role){
    return role==='playerManager'?'Your manager':role==='oppositionManager'?'Club manager':role==='agent'?'Player agent':'Player';
  }
  function characterMarkup(role,placement,data,assets){
    if(!data)return '';
    const resolveHTML=value=>typeof value==='function'?value():value;
    const closed=resolveHTML(data.closedHTML||data.html)||'';
    const open=resolveHTML(data.openHTML)||closed;
    const speaker=data.isSpeaker?' is-speaker':'';
    const reacting=data.isReacting?' is-reacting':'';
    const style=`--v73-x:${placement.x*100}%;--v73-y:${placement.y*100}%;--v73-scale:${placement.scale||1};--v73-facing:${placement.flipX?-1:1};--v73-mouth-speed:${data.cadence||760}ms`;
    const shadow=assets.seatShadow?`<img class="v73-contact-shadow v73-role-${attr(role)}" src="${attr(assets.seatShadow)}" alt="" style="${style}">`:'';
    return shadow+`<div class="v73-character v73-role-${attr(role)}${speaker}${reacting}" data-v73-role="${attr(role)}" style="${style}"><div class="v73-character-frame v73-mouth-closed">${closed}</div><div class="v73-character-frame v73-mouth-open">${open}</div><span class="v73-character-label"><small>${escape(roleLabel(role))}</small>${escape(data.name||roleLabel(role))}</span></div>`;
  }
  function renderShot(layer,key,spec,ready){
    const shot=SHOTS[key];
    const urls=assetURLs(shot);
    const speaker=spec.speakerRole||(spec.stage==='agent'?'agent':'oppositionManager');
    const reaction=spec.reactionRole||'';
    const cast=spec.cast||{};
    const assets={seatShadow:ready.has(urls.seatShadow)?urls.seatShadow:''};
    const characters=Object.entries(shot.placements).map(([role,placement])=>characterMarkup(role,placement,{...cast[role],isSpeaker:role===speaker,isReacting:role===reaction},assets)).join('');
    const tableShadow=ready.has(urls.tableShadow)?`<img class="v73-table-shadow" src="${attr(urls.tableShadow)}" alt="">`:'';
    const camera=ready.has(urls.camera)?`<img class="v73-camera-depth" src="${attr(urls.camera)}" alt="">`:'';
    const light=ready.has(urls.light)?`<img class="v73-light-pass" src="${attr(urls.light)}" alt="">`:'';
    layer.dataset.v73Shot=key;
    layer.innerHTML=`<div class="v73-shot-stage"><img class="v73-plate" src="${attr(urls.plate)}" alt="">${tableShadow}<div class="v73-cast">${characters}</div><img class="v73-furniture" src="${attr(urls.foreground)}" alt="">${camera}${light}<div class="v73-shot-vignette"></div></div>`;
  }
  function afterPaint(view){
    const win=view.modal.ownerDocument.defaultView;
    if(typeof win?.requestAnimationFrame!=='function')return Promise.resolve();
    return new Promise(resolve=>win.requestAnimationFrame(()=>win.requestAnimationFrame(resolve)));
  }
  function updateDialogue(view,spec,status){
    const speakerRole=spec.speakerRole||(spec.stage==='agent'?'agent':'oppositionManager');
    const speaker=spec.cast?.[speakerRole];
    const location=spec.stage==='agent'?'Personal terms · Private meeting':'Club terms · Boardroom';
    view.dialogue.innerHTML=`<div class="v73-dialogue-kicker"><span>${escape(location)}</span><strong>${escape(status==='idle'?'Opening position':status)}</strong></div><div class="v73-dialogue-line"><small>${escape(speaker?.name||spec.counterpart||roleLabel(speakerRole))}</small><p>${escape(flavor(spec,status))}</p></div>`;
  }
  function clearArt(view){
    view.scene.classList.remove('has-art');
    view.modal.classList.remove('v72-has-art','v73-has-cast');
    view.scene.removeAttribute('data-v72-scene-art');
    view.scene.removeAttribute('data-v73-shot');
  }
  async function showShot(view,key,spec){
    const shot=SHOTS[key];
    if(!shot)return clearArt(view);
    const token=++view.request;
    const ImageType=view.modal.ownerDocument.defaultView?.Image||globalThis.Image;
    const urls=assetURLs(shot);
    const entries=Object.entries(urls).filter(([,src])=>src);
    const checks=await Promise.all(entries.map(async([name,src])=>[name,src,await probe(src,ImageType)]));
    if(token!==view.request)return;
    const ready=new Set(checks.filter(([,src,ok])=>ok&&src).map(([,src])=>src));
    if(!ready.has(urls.plate)||!ready.has(urls.foreground))return clearArt(view);
    const same=view.src===key&&view.current>=0;
    const next=same?view.current:(view.current+1)%view.layers.length;
    renderShot(view.layers[next],key,spec,ready);
    if(typeof spec.hydrate==='function')spec.hydrate(view.layers[next]);
    await afterPaint(view);
    if(token!==view.request)return;
    view.layers.forEach((layer,index)=>layer.classList.toggle('is-current',index===next));
    view.current=next;
    view.src=key;
    view.scene.dataset.v72SceneArt=urls.plate;
    view.scene.dataset.v73Shot=key;
    view.scene.classList.add('has-art');
    view.modal.classList.add('v72-has-art','v73-has-cast');
  }
  function update(modal,spec={}){
    if(!modal)return;
    const view=ensure(modal);
    const status=statusFor(spec.session,spec);
    modal.dataset.v72Stage=spec.stage==='agent'?'agent':'boardroom';
    modal.dataset.v72Status=status;
    view.spec=spec;
    view.status=status;
    view.editing=false;
    updateDialogue(view,spec,status);
    showShot(view,shotKeyFor(spec.stage,status,false),spec);
  }
  function reset(modal){
    const view=instances.get(modal);
    if(!view)return;
    view.request++;
    view.layers.forEach(layer=>{layer.classList.remove('is-current');layer.innerHTML='';});
    view.dialogue.innerHTML='';
    view.current=-1;view.src='';view.spec=null;view.editing=false;
    delete modal.dataset.v72Stage;delete modal.dataset.v72Status;
    clearArt(view);
  }

  return Object.freeze({update,reset,statusFor,shotKeyFor,plateFor,flavor,PLATES,SHOTS});
});
