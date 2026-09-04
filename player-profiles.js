/* Unified player profile and accessible name links. No game state is copied. */
(function(root){
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const names={PAC:'Speed',SHO:'Scoring',PAS:'Passing',HAN:'Handling',DEF:'Defending',STA:'Stamina'};
  const sections=[['overview','Overview','⌂'],['attributes','Attributes','≋'],['traits','Traits','◇'],['development','Development','↗'],['contract','Contract','▤'],['career','Career','◷']];
  let bridge,dialog,playerId,tab='overview',returnFocus,source='',observer,timer,index=[],nameRegex,inertRecords=[],matchPause=null;
  function traitHTML(ids,compact=false,info={}){
    const heading=label=>`<h4>PLAYING TRAITS <span>${label}</span></h4>`;
    if(ids===null)return `<section class="v48-traits ${compact?'is-compact':''}">${heading(info.hints?.length?'SCOUT OBSERVATIONS':'UNSCOUTED')}${(info.hints||[]).map(h=>`<p class="v49-trait-hint">${esc(h)}</p>`).join('')}<p class="v48-locked">◇ Complete a scouting report to reveal this player’s traits.</p></section>`;
    const list=root.VelmoraTraits?.traits(ids)||[],limit=compact?3:4;
    const render=t=>{const origin=info.origins?.[t.id],source=({NATURAL:'Natural tendency',DEVELOPED:'Developed',CAREER_EARNED:'Career earned'})[origin?.source]||'Natural tendency';return `<article class="v48-trait" title="${esc(t.description)}">${root.VelmoraTraits.icon(t.id)}<div><small>${esc(t.category)}</small><strong>${esc(t.name)}</strong>${compact?'':`<p>${esc(t.description)}</p><span class="v49-trait-origin">${esc(source)}${origin?.source!=='NATURAL'&&origin?.date?' · '+esc(origin.date):''}</span>${origin?.source&&origin.source!=='NATURAL'?`<p class="v49-trait-reason">${esc(origin.reason)}</p>`:''}`}</div></article>`;};
    return `<section class="v48-traits ${compact?'is-compact':''}">${heading(list.length?'PLAYER IDENTITY':'NO DISTINCTIVE TRAITS')}${list.length?`<div class="v48-trait-grid">${list.slice(0,limit).map(render).join('')}</div>${list.length>limit?`<details class="v49-more-traits"><summary>Show ${list.length-limit} more</summary><div class="v48-trait-grid">${list.slice(limit).map(render).join('')}</div></details>`:''}`:'<p class="v49-no-traits">No distinctive traits. Attributes and performances define this player’s strengths.</p>'}</section>`;
  }
  function card(title,body,cls=''){return `<section class="v48-card ${cls}"><h3>${esc(title)}</h3>${body}</section>`;}
  function row(label,value){return `<div class="v48-fact"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`;}
  function button(label,attrs='',primary=false){return `<button type="button" class="v48-button ${primary?'is-primary':''}" ${attrs}>${esc(label)}</button>`;}
  function attributeHTML(d){return `<div class="v48-attribute-bars">${d.attributes.map(a=>`<div><span>${names[a.key]}</span><i><b style="width:${Math.max(0,Math.min(100,Number(a.value)||0))}%"></b></i><strong>${esc(a.text)}</strong></div>`).join('')}</div>`;}
  function statsHTML(d){return card('This season',`<div class="v48-season-stats">${[['Appearances',d.stats.apps],['Goals',d.stats.goals],['Assists',d.stats.assists],['Avg rating',d.stats.rating]].map(([label,value])=>`<div><strong>${esc(value)}</strong><span>${label}</span></div>`).join('')}</div>`,'v48-season');}
  function actionsHTML(d){if(d.managed)return button('Renew contract','data-action="renew" '+(d.canRenew?'':'disabled'),true)+button('Contract details','data-tab="contract"');if(d.canRecruit)return button(d.scoutLabel,'data-action="scout" '+(d.canScout?'':'disabled'),true)+button(d.shortlisted?'Remove from shortlist':'Add to shortlist','data-action="shortlist"');return '';}
  function overviewHTML(d){
    const fitness=d.fitness===null?'—':`${Math.round(d.fitness)}<small>%</small>`,circumference=565.49;
    return `<div class="v48-overview">
      <div class="v48-name-watermark" aria-hidden="true">${esc(d.name.split(' ').slice(-1)[0])}</div>
      <div class="v48-portrait"><img src="${esc(d.sprite)}" alt="${esc(d.name)}" /><div class="v48-portrait-floor"></div></div>
      ${card('Player identity',`<header class="v48-identity-head"><div><span>${esc(d.name.split(' ').slice(0,-1).join(' ')||d.name)}</span><h2>${esc(d.name.split(' ').slice(-1)[0])}</h2></div><div class="v48-ovr"><strong>${esc(d.ovr)}</strong><span>OVR</span></div></header><div class="v48-fact"><span>Club</span><strong class="v48-club">${d.badge}${esc(d.club)}</strong></div>${row('Country',d.country)}${row('Position',d.role)}${row('Age',d.age)}${row('Squad role',d.squadRole)}${button('View career history →','data-tab="career"')}`,'v48-identity')}
      ${card('Attribute overview',attributeHTML(d)+(!d.known?'<p class="v48-muted">Estimates improve through scouting.</p>':''),'v48-attributes')}
      <section class="v48-fitness" aria-label="${d.fitness===null?'Fitness unknown':Math.round(d.fitness)+' percent match fitness'}"><svg viewBox="0 0 220 220" aria-hidden="true"><circle cx="110" cy="110" r="90" class="v48-ring-track"/><circle cx="110" cy="110" r="90" class="v48-ring-value" style="stroke-dasharray:${circumference};stroke-dashoffset:${circumference*(1-(d.fitness||0)/100)}"/></svg><div><strong>${fitness}</strong><span>MATCH FITNESS</span><small>${esc(d.availability)}</small></div></section>
      ${card('Current condition',row('Fitness',d.fitness===null?'Unknown':Math.round(d.fitness)+'%')+`<div class="v48-condition-track"><i style="width:${d.fitness||0}%"></i></div>`+row('Morale',d.morale)+row('Form',d.form)+(d.managed?button('Edit team & tactics','data-action="lineup"'):''),'v48-condition')}
      ${card('Development',row('Plan',d.plan)+row('Season growth',d.growth===null?'Unknown':`${d.growth>=0?'+':''}${d.growth} OVR`)+button('View development →','data-tab="development"'),'v48-development')}
      ${card('Contract & value',row('Market value',d.value)+row('Weekly wage',d.wage)+row('Contract',d.contract)+actionsHTML(d),'v48-contract')}
      ${statsHTML(d)}<div class="v48-overview-traits">${traitHTML(d.traits,true,{hints:d.traitHints,origins:d.traitOrigins})}${button('Explore playing traits →','data-tab="traits"')}</div>
    </div>`;
  }
  function detailHTML(d){
    if(tab==='attributes')return card('Player attributes',attributeHTML(d)+`<p class="v48-muted">${d.known?'Base ratings. Playing traits add situational advantages during matches.':'Scouting estimates are provisional. Complete a report for a reliable assessment.'}</p>`)+traitHTML(d.traits,false,{hints:d.traitHints,origins:d.traitOrigins});
    if(tab==='traits')return `<div class="v48-section-intro"><span>PLAYER IDENTITY</span><h2>A style of their own.</h2><p>${d.known?'A player’s distinctive tendencies. Their attributes remain the foundation of their ability.':'Your scouts need to study this player before identifying their distinctive strengths.'}</p></div>`+traitHTML(d.traits,false,{hints:d.traitHints,origins:d.traitOrigins})+(d.personality?card('Personality',`<p>${esc(String(d.personality).replace(/_/g,' '))}</p>`):'');
    if(tab==='development')return d.details.development||card('Development outlook',row('Ability',d.ovr)+row('Age',d.age)+`<p class="v48-muted">${d.retired?'This player has retired.':d.academy?'Academy training and promotion are managed in the Youth Academy.':'Individual development plans are managed by the player’s club.'}</p>`);
    if(tab==='contract')return d.details.contract||card('Contract & recruitment',row('Club',d.club)+row('Value',d.value)+row('Weekly wage',d.wage)+row('Contract',d.contract)+actionsHTML(d)+(d.canRecruit?button('Open transfer talks','data-action="recruit"',true):''));
    return (d.details.career||card('Career history','<p>Career records will appear as this player’s journey develops.</p>'))+(d.traitHistory?.length?card('Playing identity milestones',d.traitHistory.map(h=>`<div class="v49-trait-milestone"><strong>${esc(root.VelmoraTraits.traits([h.id])[0]?.name||h.id)}</strong><small>${esc(h.date||h.seasonId||'')}</small><p>${esc(h.reason)}</p></div>`).join('')):'');
  }
  function render(){
    const d=bridge.data(playerId);if(!d){close();return;}
    dialog.innerHTML=`<header class="v48-topbar"><div class="v48-wordmark">VELMORA<span>MANAGER</span></div><nav aria-label="Career navigation">${['Central','Squad','Transfers','Matchday','Season','Office'].map(n=>`<button type="button" data-nav="${n.toLowerCase()}" ${d.liveMatch?'disabled':''}>${n}</button>`).join('')}</nav></header>
      <div class="v48-toolbar">${button('← Back to '+source,'data-close')}<span>PLAYER PROFILE</span><button type="button" data-close class="v48-close" aria-label="Close player profile">×</button></div>
      <div class="v48-profile-scroll"><div class="v48-profile-shell"><nav class="v48-profile-nav" aria-label="Player profile sections">${sections.map(([id,label,icon])=>`<button type="button" data-tab="${id}" ${tab===id?'aria-current="page"':''}><span aria-hidden="true">${icon}</span>${label}</button>`).join('')}<div class="v48-knowledge"><span>RECRUITMENT INTEL</span><strong>${esc(d.stage)}</strong></div></nav>
      <main class="v48-profile-main" tabindex="-1" aria-label="${esc(d.name)} · ${tab}">${tab==='overview'?overviewHTML(d):`<div class="v48-detail-head"><img src="${esc(d.sprite)}" alt=""/><div><span>${esc(d.club)} · ${esc(d.role)}</span><h1>${esc(d.name)}</h1><p>${esc(d.stage)}</p></div><b>${esc(d.ovr)}<small>OVR</small></b></div><div class="v48-detail-body">${detailHTML(d)}</div>`}</main></div></div>`;
    dialog.querySelectorAll('img').forEach(img=>img.addEventListener('error',()=>{img.hidden=true;},{once:true}));
  }
  function open(id){
    if(!bridge||!bridge.canOpen())return false;
    const d=bridge.data(id);if(!d)return false;
    if(!dialog){
      returnFocus=document.activeElement;source=bridge.source();matchPause=bridge.pause?.()||null;
      dialog=document.createElement('section');dialog.id='v48PlayerProfile';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label','Player profile');
      inertRecords=Array.from(document.body.children).filter(n=>!['SCRIPT','STYLE','LINK'].includes(n.tagName)).map(n=>[n,n.inert]);
      for(const [n]of inertRecords)n.inert=true;
      document.body.appendChild(dialog);document.body.classList.add('v48-profile-open');
      dialog.addEventListener('click',handleDialogClick);
    }
    playerId=String(id);tab='overview';render();dialog?.querySelector('[data-close]')?.focus();bridge.save();return true;
  }
  function close(){if(!dialog)return;dialog.remove();dialog=null;playerId=null;for(const [n,was]of inertRecords)if(n.isConnected)n.inert=was;inertRecords=[];document.body.classList.remove('v48-profile-open');bridge.resume?.(matchPause);matchPause=null;if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});}
  function handleDialogClick(e){
    const b=e.target.closest('button');if(!b||b.disabled)return;
    if(b.hasAttribute('data-close')){close();return;}
    if(b.dataset.nav){const target=b.dataset.nav;close();bridge.navigate(target);return;}
    if(b.dataset.tab){tab=b.dataset.tab;render();dialog.querySelector(`[data-tab="${tab}"]`)?.focus();return;}
    const attributes=[['data-action',null],['data-dev-plan','plan'],['data-role-conversion','conversion'],['data-role-conversion-cancel','cancel-conversion'],['data-role-deployment','deployment'],['data-player-market-status','market'],['data-open-renewal','renew'],['data-set-asking-price','asking'],['data-release-player','release']];
    for(const [attr,action]of attributes)if(b.hasAttribute(attr)){const y=dialog.querySelector('.v48-profile-scroll')?.scrollTop||0;const a=action||b.getAttribute(attr),v=a==='asking'?dialog.querySelector('#livingAskingPrice')?.value:b.getAttribute(attr);bridge.action(playerId,a,v);if(dialog){render();dialog.querySelector('.v48-profile-scroll').scrollTop=y;dialog.querySelector('.v48-profile-main')?.focus({preventScroll:true});}return;}
  }
  function refreshIndex(){
    index=bridge.players().filter(p=>p.name&&p.name.trim().length>3);
    const all=[...new Set(index.map(p=>p.name))].sort((a,b)=>b.length-a.length);
    nameRegex=all.length?new RegExp(all.map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),'gi'):null;
  }
  function resolveName(name,scope){
    const rows=index.filter(p=>p.name.toLowerCase()===name.toLowerCase());
    const owner=scope?.closest('[data-player-id],[data-season-player],[data-transfer-id],[data-youth-id],[data-squad-player]');
    const id=owner&&(owner.dataset.playerId||owner.dataset.seasonPlayer||owner.dataset.transferId||owner.dataset.youthId||owner.dataset.squadPlayer);
    if(id&&rows.some(p=>p.id===String(id)))return [String(id)];
    return rows.map(p=>p.id);
  }
  function enhance(){
    if(!document.createTreeWalker||dialog)return;
    refreshIndex();if(!nameRegex)return;
    observer?.disconnect();
    const walker=document.createTreeWalker(document.body,4),nodes=[];
    while(walker.nextNode()){
      const text=walker.currentNode,el=text.parentElement;
      if(!el||el.closest('script,style,textarea,input,select,option,svg,canvas,a,[contenteditable],.v48-name,.v48-traits,#v48PlayerProfile,#wcgOverlay,#pressConferenceOverlay,[aria-hidden="true"],[hidden]'))continue;
      if(!text.nodeValue?.trim()||text.nodeValue.length>15000)continue;
      nameRegex.lastIndex=0;if(nameRegex.test(text.nodeValue))nodes.push(text);
    }
    for(const node of nodes){
      const text=node.nodeValue,frag=document.createDocumentFragment();let last=0,match;nameRegex.lastIndex=0;
      while((match=nameRegex.exec(text))){
        const before=text[match.index-1],after=text[match.index+match[0].length];if((before&&/[\p{L}\p{N}]/u.test(before))||(after&&/[\p{L}\p{N}]/u.test(after)))continue;
        const ids=resolveName(match[0],node.parentElement);if(!ids.length)continue;
        frag.appendChild(document.createTextNode(text.slice(last,match.index)));
        const link=document.createElement('span');link.className='v48-name';link.setAttribute('role','link');link.tabIndex=0;link.dataset.v48Candidates=JSON.stringify(ids);link.textContent=match[0];link.setAttribute('aria-label',`Open ${match[0]}’s profile`);frag.appendChild(link);last=match.index+match[0].length;
      }
      if(last){frag.appendChild(document.createTextNode(text.slice(last)));node.replaceWith(frag);}
    }
    observer?.observe(document.body,{childList:true,subtree:true,characterData:true});
  }
  function followName(link){
    let ids=[];try{ids=JSON.parse(link.dataset.v48Candidates||'[]');}catch(_){}
    if(ids.length===1){open(ids[0]);return;}
    if(ids.length>1){
      // Duplicate names need explicit identity selection, never a guess.
      if(!open(ids[0]))return;
      dialog.querySelector('.v48-profile-main').innerHTML=card('Choose a player',`<p>These players share this name.</p>${ids.map(id=>{const p=index.find(r=>r.id===id);return p?button(`${p.name} · ${p.club}`,`data-choose-player="${esc(id)}"`):'';}).join('')}`);
    }
  }
  function install(api){
    bridge=api;if(!document.createTreeWalker)return;
    document.addEventListener('click',e=>{
      if(e.target.closest('#v48PlayerProfile')){const choose=e.target.closest('[data-choose-player]');if(choose)open(choose.dataset.choosePlayer);return;}
      if(e.target.closest('#pressConferenceOverlay'))return;
      if(!bridge.canOpen())return;
      const direct=e.target.closest('[data-v48-player],[data-season-player]');
      const link=e.target.closest('.v48-name');
      if(direct||link){e.preventDefault();e.stopImmediatePropagation();direct?open(direct.dataset.v48Player||direct.dataset.seasonPlayer):followName(link);}
    },true);
    document.addEventListener('keydown',e=>{
      if(dialog){
        if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();return;}
        if(e.key==='Tab'){e.stopImmediatePropagation();const focusable=Array.from(dialog.querySelectorAll('button:not([disabled]),a[href],input,select,textarea,[tabindex="0"]')).filter(n=>!n.hidden&&n.getClientRects().length);const first=focusable[0],last=focusable[focusable.length-1];if(e.shiftKey&&(document.activeElement===first||!dialog.contains(document.activeElement))){e.preventDefault();last?.focus();}else if(!e.shiftKey&&(document.activeElement===last||!dialog.contains(document.activeElement))){e.preventDefault();first?.focus();}}
      }else if((e.key==='Enter'||e.key===' ')&&e.target.closest('.v48-name')&&bridge.canOpen()){e.preventDefault();e.stopImmediatePropagation();followName(e.target.closest('.v48-name'));}
    },true);
    observer=new MutationObserver(records=>{
      if(records.every(r=>r.target.closest?.('#v48PlayerProfile')))return;
      clearTimeout(timer);timer=setTimeout(enhance,180);
    });observer.observe(document.body,{childList:true,subtree:true,characterData:true});timer=setTimeout(enhance,0);
  }
  root.VelmoraPlayerProfiles={install,open,close,traitHTML,enhance};
})(window);
