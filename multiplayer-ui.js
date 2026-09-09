// Velmora Manager · Online Career · interface
//
// Two surfaces: the lobby (main menu) and a restrained status component that
// sits inside an ordinary career. No browser alerts, no developer wording, no
// repeated modals -- a compact chip that expands into a panel, and one clear
// sentence whenever progression is waiting on somebody.
(function(root){
  'use strict';
  if(!root||!root.document)return;

  const doc=root.document;
  const core=()=>root.VelmoraMultiplayerCore;
  const game=()=>root.VelmoraMultiplayerGame;

  let client=null;
  let view='HUB';                 // HUB | CREATE | JOIN | LOBBY
  let overlay=null;
  let chip=null;
  let lastStatus=null;
  let careers=[];
  let lobby=null;                 // {careerId, joinCode, preview, members, claims}
  let draft={name:'',privacy:'INVITE',password:'',code:'',clubId:null,clubName:'',managerName:''};
  let clubFilter={search:'',division:'all'};
  let busy=false;
  let notice=null;
  let lobbyTimer=0;
  const LOBBY_POLL_MS=6000;
  let installed=false;

  // ---------------------------------------------------------------
  // Small helpers
  // ---------------------------------------------------------------
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  function toast(message){game()?.showToast?.(message);}
  function click(){game()?.playClickSfx?.();}
  function say(kind,message){notice={kind,message};render();}
  function clearNotice(){if(notice){notice=null;render();}}

  async function guard(fn,{label}={}){
    if(busy)return null;
    busy=true;render();
    // A step that reports its own failure without throwing -- entering a
    // career, for one -- must keep that message. Only a notice that was
    // already on screen before this run is cleared on success.
    const noticeBefore=notice;
    try{
      const value=await fn();
      busy=false;
      if(notice===noticeBefore)clearNotice();
      render();
      return value;
    }catch(error){
      busy=false;
      say('error',core().friendlyError(error));
      return null;
    }
  }

  function relative(value){
    if(!value)return'never';
    const delta=Date.now()-Date.parse(value);
    if(!Number.isFinite(delta))return'never';
    if(delta<60000)return'just now';
    if(delta<3600000)return`${Math.round(delta/60000)} min ago`;
    if(delta<86400000)return`${Math.round(delta/3600000)} h ago`;
    return`${Math.round(delta/86400000)} d ago`;
  }
  function dateLabel(value){
    if(!value)return'—';
    try{
      return new Date(`${String(value).slice(0,10)}T00:00:00Z`)
        .toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}).toUpperCase();
    }catch(_){return String(value);}
  }

  // ---------------------------------------------------------------
  // Overlay shell
  // ---------------------------------------------------------------
  function ensureOverlay(){
    if(overlay)return overlay;
    overlay=doc.createElement('div');
    overlay.id='velmoraOnlineOverlay';
    overlay.className='modal-backdrop mp-overlay';
    overlay.setAttribute('aria-hidden','true');
    overlay.innerHTML=
      '<section class="mp-dialog" role="dialog" aria-modal="true" aria-labelledby="mpTitle">'+
        '<header class="mp-dialog-head">'+
          '<div><span>VELMORA ONLINE</span><h2 id="mpTitle" data-mp-title>ONLINE CAREER</h2>'+
          '<p data-mp-subtitle></p></div>'+
          '<button type="button" class="mp-close" data-mp-close aria-label="Close online career">&times;</button>'+
        '</header>'+
        '<div class="mp-notice" data-mp-notice role="status" hidden></div>'+
        '<main class="mp-body" data-mp-body></main>'+
        '<footer class="mp-foot" data-mp-foot></footer>'+
      '</section>';
    doc.body.appendChild(overlay);
    overlay.querySelector('[data-mp-close]').addEventListener('click',close);
    overlay.addEventListener('click',event=>{if(event.target===overlay)close();});
    overlay.addEventListener('keydown',event=>{
      if(event.key==='Escape'){event.preventDefault();close();return;}
      if(event.key!=='Tab')return;
      // Keep focus inside the dialog while it is open.
      const focusable=[...overlay.querySelectorAll(
        'button:not([disabled]),input:not([disabled]),select:not([disabled]),[href],[tabindex]:not([tabindex="-1"])')]
        .filter(node=>node.offsetParent!==null);
      if(!focusable.length)return;
      const first=focusable[0],last=focusable[focusable.length-1];
      if(event.shiftKey&&doc.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&doc.activeElement===last){event.preventDefault();first.focus();}
    });
    return overlay;
  }

  function open(next='HUB'){
    ensureOverlay();
    view=next;notice=null;
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden','false');
    game()?.syncOverlays?.();
    render();
    root.requestAnimationFrame(()=>{
      overlay.querySelector('.mp-body button, .mp-body input, .mp-foot button')?.focus?.({preventScroll:true});
    });
  }
  function close(){
    stopLobbyPoll();
    if(!overlay)return;
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden','true');
    game()?.syncOverlays?.();
    doc.getElementById('btnOnlineCareer')?.focus?.({preventScroll:true});
  }

  // ---------------------------------------------------------------
  // Views
  // ---------------------------------------------------------------
  function renderHub(){
    if(!client||!client.signedIn())return{
      title:'ONLINE CAREER',
      subtitle:'Manage alongside a friend in one shared world.',
      body:'<div class="mp-empty"><h3>SIGN IN TO PLAY ONLINE</h3>'+
        '<p>Online careers are tied to your Repo Company account so both managers share one protected save. '+
        'Launch Velmora Manager while signed in at Repo Company and this menu will open straight into your careers.</p>'+
        '<a class="mp-link" href="https://repocompany.uk/" target="_top">SIGN IN AT REPO COMPANY</a></div>',
      foot:'<button type="button" data-mp-close-foot>BACK TO MENU</button>'
    };

    const rows=careers.length?careers.map(row=>{
      const badge=game()?.badgeHTML?.(row.club_id)||'';
      const status=row.status==='LOBBY'?'IN LOBBY':row.status==='ARCHIVED'?'ARCHIVED':'IN PROGRESS';
      const seat=row.member_status==='AI_CONTROLLED'?'<b class="mp-tag is-warn">CLUB HANDED TO AI</b>':'';
      return'<article class="mp-career-row">'+
        `<div class="mp-career-crest">${badge||'<span class="mp-crest-fallback">VM</span>'}</div>`+
        '<div class="mp-career-copy">'+
          `<span>${esc(status)} · ${row.is_host?'HOST':'GUEST'} · ${esc(row.members)}/${esc(row.max_members)} MANAGERS</span>`+
          `<h3>${esc(row.name)}</h3>`+
          `<p>${esc(row.club_name||'No club chosen yet')} · ${esc(row.manager_name||'Manager')} · ${esc(dateLabel(row.career_date))}</p>`+
          `<small>LAST PLAYED ${esc(relative(row.last_played_at))}</small>${seat}`+
        '</div>'+
        '<div class="mp-career-actions">'+
          `<button type="button" class="is-primary" data-mp-resume="${esc(row.career_id)}">`+
          `${row.status==='LOBBY'?'OPEN LOBBY':'RESUME'}</button>`+
          (row.is_host?`<button type="button" data-mp-manage="${esc(row.career_id)}">MANAGE</button>`:'')+
        '</div>'+
      '</article>';
    }).join(''):
      '<div class="mp-empty"><h3>NO ONLINE CAREERS YET</h3>'+
      '<p>Create a shared world and invite one friend, or join a career with the code they send you. '+
      'Your single-player careers are untouched and stay exactly where they are.</p></div>';

    return{
      title:'ONLINE CAREERS',
      subtitle:'Two managers, separate clubs, one synchronised world.',
      body:`<div class="mp-career-list">${rows}</div>`,
      foot:'<button type="button" class="is-primary" data-mp-view="CREATE">CREATE ONLINE CAREER</button>'+
           '<button type="button" data-mp-view="JOIN">JOIN WITH A CODE</button>'+
           '<button type="button" data-mp-close-foot>BACK TO MENU</button>'
    };
  }

  function renderCreate(){
    return{
      title:'CREATE ONLINE CAREER',
      subtitle:'You will pick your club and confirm your manager in the lobby.',
      body:
        '<form class="mp-form" data-mp-form="create">'+
          '<label class="mp-field"><span>CAREER NAME</span>'+
            `<input type="text" name="name" maxlength="60" required autocomplete="off" value="${esc(draft.name)}" placeholder="Sunday League Rivals">`+
          '</label>'+
          '<fieldset class="mp-field mp-choice"><legend>WHO CAN JOIN</legend>'+
            `<label><input type="radio" name="privacy" value="INVITE"${draft.privacy!=='PRIVATE'?' checked':''}><span><b>INVITE ONLY</b><small>Anyone with the code can take the second seat.</small></span></label>`+
            `<label><input type="radio" name="privacy" value="PRIVATE"${draft.privacy==='PRIVATE'?' checked':''}><span><b>PRIVATE</b><small>The code plus a password you choose.</small></span></label>`+
          '</fieldset>'+
          '<label class="mp-field"><span>CAREER PASSWORD <i>OPTIONAL</i></span>'+
            `<input type="password" name="password" maxlength="60" autocomplete="new-password" value="${esc(draft.password)}" placeholder="Leave blank for none">`+
          '</label>'+
          '<p class="mp-note">This first release supports two human managers in a career. '+
          'Every other club in the world continues to be run by the AI.</p>'+
        '</form>',
      foot:`<button type="button" class="is-primary" data-mp-submit="create"${busy?' disabled':''}>${busy?'CREATING…':'CREATE AND OPEN LOBBY'}</button>`+
           '<button type="button" data-mp-view="HUB">BACK</button>'
    };
  }

  function renderJoin(){
    const preview=draft.preview;
    return{
      title:'JOIN ONLINE CAREER',
      subtitle:'Enter the code your friend sent you.',
      body:
        '<form class="mp-form" data-mp-form="join">'+
          '<label class="mp-field"><span>INVITATION CODE</span>'+
            `<input type="text" name="code" class="mp-code-input" maxlength="6" required autocomplete="off" spellcheck="false" value="${esc(draft.code)}" placeholder="ABC234">`+
          '</label>'+
          (preview?.requires_password?
            '<label class="mp-field"><span>CAREER PASSWORD</span>'+
            '<input type="password" name="password" maxlength="60" autocomplete="off"></label>':'')+
        '</form>'+
        (preview?
          '<article class="mp-preview">'+
            '<span>YOU ARE ABOUT TO JOIN</span>'+
            `<h3>${esc(preview.name)}</h3>`+
            `<p>Hosted by ${esc(preview.host_name)} · ${esc(preview.members)}/${esc(preview.max_members)} managers · `+
            `${preview.status==='LOBBY'?'waiting in the lobby':'career in progress'}</p>`+
            (preview.career_date?`<small>SHARED DATE ${esc(dateLabel(preview.career_date))}</small>`:'')+
          '</article>':
          '<p class="mp-note">Codes are six characters and are not case sensitive.</p>'),
      foot:(preview
        ?`<button type="button" class="is-primary" data-mp-submit="join"${busy?' disabled':''}>${busy?'JOINING…':'JOIN THIS CAREER'}</button>`
        :`<button type="button" class="is-primary" data-mp-submit="preview"${busy?' disabled':''}>${busy?'CHECKING…':'FIND CAREER'}</button>`)+
        '<button type="button" data-mp-view="HUB">BACK</button>'
    };
  }

  // Lobby rows come straight from the sync payload, so connectedness is
  // computed here from the same presence rule the status chip uses.
  function isConnected(member){
    if(member.online===true)return true;
    if(member.presence_status&&member.presence_status!=='ONLINE')return false;
    const seen=Date.parse(member.presence_at||member.last_seen_at||'')||0;
    return seen>0&&(Date.now()-seen)<90000;
  }
  function memberCard(member,{isSelf,hostId}={}){
    const connected=isConnected(member);
    const online=member.status==='AI_CONTROLLED'?'AI':connected?'ONLINE':'OFFLINE';
    const tone=member.status==='AI_CONTROLLED'?'is-warn':connected?'is-good':'is-idle';
    const badge=game()?.badgeHTML?.(member.club_id)||'';
    return'<article class="mp-seat">'+
      `<div class="mp-seat-crest">${badge||'<span class="mp-crest-fallback">?</span>'}</div>`+
      '<div class="mp-seat-copy">'+
        `<span>${member.user_id===hostId?'HOST':'MANAGER'}${isSelf?' · YOU':''}</span>`+
        `<h4>${esc(member.manager_name||member.display_name)}</h4>`+
        `<p>${esc(member.club_name||'Choosing a club…')}</p>`+
        `<small>BUILD ${esc(member.client_version||'unknown')}</small>`+
      '</div>'+
      '<div class="mp-seat-state">'+
        `<b class="mp-dot ${tone}">${online}</b>`+
        `<b class="mp-tag ${member.ready?'is-good':''}">${member.ready?'READY':'NOT READY'}</b>`+
      '</div>'+
    '</article>';
  }

  function renderLobby(){
    if(!lobby)return renderHub();
    const status=lastStatus||{};
    const members=lobby.members||[];
    const me=members.find(row=>row.user_id===lobby.userId)||{};
    const isHost=lobby.isHost;
    const claimed=new Set(members.map(row=>row.club_id).filter(Boolean));
    const compatibility=core().versionCompatibility(
      lobby.clientVersion,members.find(row=>row.user_id!==lobby.userId)?.client_version||lobby.clientVersion);

    const seats=members.map(row=>memberCard(row,{isSelf:row.user_id===lobby.userId,hostId:lobby.hostId})).join('')+
      (members.length<2?'<article class="mp-seat is-empty"><div class="mp-seat-crest">'+
        '<span class="mp-crest-fallback">2</span></div><div class="mp-seat-copy">'+
        '<span>SECOND MANAGER</span><h4>WAITING FOR A FRIEND</h4>'+
        '<p>Share the invitation below to fill this seat.</p></div></article>':'');

    const everyoneReady=members.length>=1&&members.every(row=>row.ready&&row.club_id);
    const canStart=isHost&&everyoneReady&&lobby.status==='LOBBY';

    return{
      title:esc(lobby.name||'ONLINE CAREER'),
      subtitle:lobby.status==='LOBBY'
        ?'Choose your club, confirm your manager, then the host starts the career.'
        :'This career is already under way.',
      body:
        `<div class="mp-seats">${seats}</div>`+
        (compatibility.level!=='OK'?
          `<p class="mp-note ${compatibility.level==='BLOCKED'?'is-error':'is-warn'}">${esc(compatibility.message)}</p>`:'')+
        '<section class="mp-lobby-actions">'+
          `<button type="button" data-mp-choose-club>${me.club_id?'CHANGE CLUB':'CHOOSE YOUR CLUB'}</button>`+
          '<button type="button" data-mp-create-manager>CUSTOMISE MANAGER</button>'+
          `<button type="button" class="${me.ready?'':'is-primary'}" data-mp-ready="${me.ready?'0':'1'}"${me.club_id?'':' disabled'}>`+
          `${me.ready?'NOT READY':'I AM READY'}</button>`+
        '</section>'+
        (lobby.joinCode?
          '<section class="mp-invite">'+
            '<div><span>INVITATION CODE</span>'+
            `<strong class="mp-code">${esc(lobby.joinCode)}</strong>`+
            '<small>Send this to the manager you want to play with.</small></div>'+
            '<button type="button" data-mp-copy>COPY INVITATION</button>'+
          '</section>':'')+
        (lobby.clubPicker?renderClubPicker(claimed,me):''),
      foot:
        (canStart?`<button type="button" class="is-primary" data-mp-start${busy?' disabled':''}>${busy?'STARTING…':'START CAREER'}</button>`:'')+
        (lobby.status!=='LOBBY'?'<button type="button" class="is-primary" data-mp-enter>ENTER CAREER</button>':'')+
        (isHost&&lobby.status!=='LOBBY'?'<button type="button" data-mp-archive>ARCHIVE CAREER</button>':'')+
        '<button type="button" data-mp-leave>LEAVE CAREER</button>'+
        '<button type="button" data-mp-view="HUB">ONLINE CAREERS</button>'
    };
  }

  function renderClubPicker(claimed,me){
    const clubs=(game()?.clubDirectory?.()||[]);
    const divisions=[...new Map(clubs.map(club=>[club.divisionKey,club.division])).entries()];
    const search=clubFilter.search.toLowerCase();
    const shown=clubs.filter(club=>{
      if(clubFilter.division!=='all'&&club.divisionKey!==clubFilter.division)return false;
      if(search&&!`${club.name} ${club.division} ${club.country}`.toLowerCase().includes(search))return false;
      return true;
    }).slice(0,120);

    return'<section class="mp-club-picker" aria-label="Choose your club">'+
      '<div class="mp-picker-head">'+
        '<label class="mp-field mp-field-inline"><span class="sr-only">Search clubs</span>'+
        `<input type="search" data-mp-club-search value="${esc(clubFilter.search)}" placeholder="Search clubs" autocomplete="off"></label>`+
        '<label class="mp-field mp-field-inline"><span class="sr-only">Filter by division</span>'+
        '<select data-mp-club-division><option value="all">All divisions</option>'+
        divisions.map(([key,name])=>
          `<option value="${esc(key)}"${clubFilter.division===key?' selected':''}>${esc(name)}</option>`).join('')+
        '</select></label>'+
      '</div>'+
      '<ul class="mp-club-grid" role="list">'+
        shown.map(club=>{
          const taken=claimed.has(club.id)&&club.id!==me.club_id;
          return`<li><button type="button" class="mp-club${club.id===me.club_id?' is-mine':''}"`+
            ` data-mp-pick-club="${esc(club.id)}"${taken?' disabled aria-disabled="true"':''}`+
            ` style="--mp-club-accent:${esc(club.accent)}">`+
            `<b>${esc(club.name)}</b><small>${esc(club.division)}</small>`+
            `${taken?'<i class="mp-tag is-warn">TAKEN</i>':''}`+
            `${club.id===me.club_id?'<i class="mp-tag is-good">YOUR CLUB</i>':''}</button></li>`;
        }).join('')+
      '</ul>'+
      (shown.length?'':'<p class="mp-note">No clubs match that search.</p>')+
    '</section>';
  }

  function render(){
    if(!overlay||!overlay.classList.contains('is-open'))return;
    const model=view==='CREATE'?renderCreate():view==='JOIN'?renderJoin():view==='LOBBY'?renderLobby():renderHub();
    overlay.querySelector('[data-mp-title]').textContent=model.title;
    overlay.querySelector('[data-mp-subtitle]').textContent=model.subtitle||'';
    const noticeNode=overlay.querySelector('[data-mp-notice]');
    noticeNode.hidden=!notice;
    noticeNode.className=`mp-notice${notice?` is-${notice.kind}`:''}`;
    noticeNode.textContent=notice?notice.message:'';
    overlay.querySelector('[data-mp-body]').innerHTML=model.body;
    overlay.querySelector('[data-mp-foot]').innerHTML=model.foot||'';
    bind();
  }

  function formValues(name){
    const form=overlay.querySelector(`[data-mp-form="${name}"]`);
    if(!form)return{};
    return Object.fromEntries(new FormData(form).entries());
  }

  function bind(){
    const on=(selector,event,handler)=>overlay.querySelectorAll(selector)
      .forEach(node=>node.addEventListener(event,handler));

    on('[data-mp-view]','click',event=>{click();view=event.currentTarget.dataset.mpView;notice=null;
      if(view==='HUB')refreshCareers();else render();});
    on('[data-mp-close-foot]','click',()=>{click();close();});

    on('[data-mp-submit="create"]','click',()=>{
      const values=formValues('create');
      draft={...draft,name:values.name||'',privacy:values.privacy||'INVITE',password:values.password||''};
      if(!draft.name.trim())return say('error','Give the career a name so you both recognise it.');
      guard(async()=>{
        const created=await client.createCareer({
          name:draft.name.trim(),privacy:draft.privacy,
          password:draft.password||null,displayName:game()?.managerDisplayName?.()||'Manager'});
        await enterLobby(created.career_id);
      });
    });

    on('[data-mp-submit="preview"]','click',()=>{
      const values=formValues('join');
      draft.code=String(values.code||'').toUpperCase().trim();
      if(draft.code.length!==6)return say('error','An invitation code is six characters long.');
      guard(async()=>{
        draft.preview=await client.previewCareer(draft.code);
        render();
      });
    });

    on('[data-mp-submit="join"]','click',()=>{
      const values=formValues('join');
      guard(async()=>{
        const joined=await client.joinCareer({
          code:draft.code,password:values.password||null,
          displayName:game()?.managerDisplayName?.()||'Manager'});
        draft.preview=null;
        await enterLobby(joined.career_id);
      });
    });

    on('[data-mp-resume]','click',event=>{click();
      guard(()=>enterLobby(event.currentTarget.dataset.mpResume));});
    on('[data-mp-manage]','click',event=>{click();
      guard(()=>enterLobby(event.currentTarget.dataset.mpManage));});

    on('[data-mp-choose-club]','click',()=>{click();lobby.clubPicker=!lobby.clubPicker;render();});
    on('[data-mp-club-search]','input',event=>{clubFilter.search=event.target.value;render();
      overlay.querySelector('[data-mp-club-search]')?.focus();});
    on('[data-mp-club-division]','change',event=>{clubFilter.division=event.target.value;render();});

    on('[data-mp-pick-club]','click',event=>{
      const clubId=event.currentTarget.dataset.mpPickClub;
      const club=(game()?.clubDirectory?.()||[]).find(row=>row.id===clubId);
      guard(async()=>{
        await client.claimClub(lobby.careerId,{
          clubId,clubName:club?.name||clubId,
          managerName:game()?.managerDisplayName?.()||'Career Manager',
          managerProfile:game()?.managerProfile?.()||{}});
        lobby.clubPicker=false;
        toast(`${club?.name||'Club'} claimed`);
        await refreshLobby();
      });
    });

    on('[data-mp-create-manager]','click',()=>{
      click();close();
      game()?.openManagerCreator?.(async(profile,name)=>{
        open('LOBBY');
        if(lobby?.careerId&&lobby.clubId){
          await guard(()=>client.claimClub(lobby.careerId,{
            clubId:lobby.clubId,clubName:lobby.clubName||'',
            managerName:name,managerProfile:profile}));
        }
        toast(`${name} will manage in this career`);
        refreshLobby();
      });
    });

    on('[data-mp-ready]','click',event=>{
      const next=event.currentTarget.dataset.mpReady==='1';
      guard(async()=>{await client.setReady(lobby.careerId,next);await refreshLobby();});
    });

    on('[data-mp-copy]','click',()=>{
      const link=`${root.location.origin}${root.location.pathname}?online=${encodeURIComponent(lobby.joinCode)}`;
      const text=`Join my Velmora Manager career "${lobby.name}" — code ${lobby.joinCode}\n${link}`;
      const done=()=>toast('Invitation copied');
      if(root.navigator?.clipboard?.writeText)root.navigator.clipboard.writeText(text).then(done,()=>fallbackCopy(text,done));
      else fallbackCopy(text,done);
    });

    on('[data-mp-start]','click',()=>{
      guard(async()=>{
        // Start from what the career actually looks like now, not from what
        // this screen was showing. Starting on a stale seat list would hand
        // the other manager's club to the AI on this device.
        await loadLobby(lobby.careerId);
        const seats=lobby.members||[];
        if(seats.length<2||!seats.every(row=>row.ready&&row.club_id))
          return say('error','Both managers need a club and a ready seat before the career can start.');
        const me=seats.find(row=>row.user_id===lobby.userId);
        if(!me?.club_id)return say('error','Choose your club before starting the career.');
        // The shared world is generated by the ordinary career path.
        game()?.prepareWorld?.(me.club_id);
        await client.startCareer(lobby.careerId);
        await enterCareer();
      });
    });

    on('[data-mp-enter]','click',()=>{guard(()=>enterCareer());});

    on('[data-mp-leave]','click',event=>confirmAction(event.currentTarget,{
      title:'Leave this online career?',
      copy:lobby.status==='LOBBY'
        ?'Your seat opens up for someone else. Nothing else is affected.'
        :'Your club is handed to the AI so the other manager can keep playing. This is recorded in the career history.',
      confirm:'LEAVE CAREER',
      run:async()=>{await client.leaveCareer(lobby.careerId);toast('You have left the career.');
        view='HUB';lobby=null;await refreshCareers();}
    }));

    on('[data-mp-archive]','click',event=>confirmAction(event.currentTarget,{
      title:'Archive this career?',
      copy:'Both managers keep their history, but nobody can play it again until you restore it.',
      confirm:'ARCHIVE',
      run:async()=>{await client.archiveCareer(lobby.careerId,false);toast('Career archived.');
        view='HUB';lobby=null;await refreshCareers();}
    }));
  }

  function fallbackCopy(text,done){
    const field=doc.createElement('textarea');
    field.value=text;field.setAttribute('readonly','');
    field.style.cssText='position:fixed;opacity:0;pointer-events:none';
    doc.body.appendChild(field);field.select();
    try{doc.execCommand('copy');done();}catch(_){toast('Copy the code shown above.');}
    field.remove();
  }

  // A confirmation in place, never a browser dialog.
  function confirmAction(button,{title,copy,confirm,run}){
    click();
    const holder=button.closest('.mp-foot')||button.parentElement;
    if(holder.querySelector('.mp-confirm'))return;
    const box=doc.createElement('div');
    box.className='mp-confirm';
    box.setAttribute('role','group');
    box.innerHTML=`<div><strong>${esc(title)}</strong><small>${esc(copy)}</small></div>`+
      '<button type="button" data-mp-cancel>CANCEL</button>'+
      `<button type="button" class="is-danger" data-mp-confirm>${esc(confirm)}</button>`;
    holder.appendChild(box);
    box.querySelector('[data-mp-cancel]').addEventListener('click',()=>{box.remove();button.focus();});
    box.querySelector('[data-mp-confirm]').addEventListener('click',()=>{box.remove();guard(run);});
    box.querySelector('[data-mp-confirm]').focus();
  }

  // ---------------------------------------------------------------
  // Lobby / career transitions
  // ---------------------------------------------------------------
  async function refreshCareers(){
    careers=await client.listCareers().catch(()=>[]);
    render();
  }

  // Reading the lobby and showing it are separate: the poll below re-reads it
  // several times a minute, and re-opening the overlay each time would pull
  // keyboard focus back to the first button while someone is using it.
  async function loadLobby(careerId){
    const status=await client.syncFor(careerId);
    const pickerOpen=!!(lobby&&lobby.careerId===careerId&&lobby.clubPicker);
    lobby={
      careerId,
      name:status.career.name,
      status:status.career.status,
      joinCode:status.career.join_code,
      hostId:status.career.host_user_id,
      userId:client.currentUser()?.id,
      isHost:status.career.host_user_id===client.currentUser()?.id,
      members:status.members,
      clientVersion:root.VELMORA_RELEASE?.version||'0.0.0',
      clubPicker:pickerOpen
    };
    const me=status.members.find(row=>row.user_id===lobby.userId);
    lobby.clubId=me?.club_id||null;
    lobby.clubName=me?.club_name||'';
    return lobby;
  }

  async function enterLobby(careerId){
    await loadLobby(careerId);
    view='LOBBY';
    open('LOBBY');
    startLobbyPoll();
  }

  // Until a career is entered there is no realtime subscription and no client
  // poll -- both begin at attach -- so the lobby would never notice the second
  // manager arriving. This is that missing heartbeat, and it stops on close.
  function startLobbyPoll(){
    stopLobbyPoll();
    lobbyTimer=root.setInterval(async()=>{
      if(!lobby||view!=='LOBBY'||!overlay?.classList.contains('is-open')){stopLobbyPoll();return;}
      if(busy)return;
      try{
        const before=lobbySignature();
        await loadLobby(lobby.careerId);
        if(lobbySignature()!==before)render();
      }catch(_){ /* the next tick tries again; the lobby stays usable */ }
    },LOBBY_POLL_MS);
  }
  function stopLobbyPoll(){
    if(lobbyTimer){root.clearInterval(lobbyTimer);lobbyTimer=0;}
  }
  function lobbySignature(){
    if(!lobby)return '';
    return [lobby.status,...(lobby.members||[])
      .map(row=>`${row.user_id}:${row.club_id||''}:${row.ready?1:0}:${row.online?1:0}`)
      .sort()].join('|');
  }

  async function refreshLobby(){
    if(!lobby)return;
    await loadLobby(lobby.careerId);
    render();
  }

  async function enterCareer(){
    // Attaching downloads the shared world and applies it, and applying it
    // needs the session to exist first: the snapshot carries no identity, so
    // the manager, the club and the list of human clubs all come from the
    // session. Begin before attach, or the world cannot be applied at all.
    // The membership is re-read here too, because a lobby that has been open
    // for a while may not yet know the second manager has taken their seat.
    await loadLobby(lobby.careerId);
    const me=(lobby.members||[]).find(row=>row.user_id===lobby.userId);
    const localIdentity=game()?.captureIdentity?.()||{};
    const savedIdentity=await client.loadPrivateState(lobby.careerId).catch(()=>null);
    const identity=savedIdentity&&typeof savedIdentity==='object'?savedIdentity:localIdentity;
    // Club-bound private state from an unrelated local career must never
    // override the seat claimed in this online career.
    if(me?.club_id&&String(identity.currentClubId||'')!==String(me.club_id)){
      delete identity.currentClubId;
      delete identity.careerRuntime;
      delete identity.firstWeekState;
      delete identity.jobSearchState;
    }
    game()?.begin({
      careerId:lobby.careerId,
      clubId:me?.club_id||null,
      userId:lobby.userId,
      humanClubIds:(lobby.members||[]).map(row=>row.club_id).filter(Boolean),
      claims:(lobby.members||[]).filter(row=>row.club_id)
        .map(row=>({user_id:row.user_id,club_id:row.club_id,club_name:row.club_name,
          manager_name:row.manager_name,manager_profile:row.manager_profile||null,status:row.status})),
      members:lobby.members||[],
      identity,
      client,
      status:client.status()
    });
    const attached=await client.attach(lobby.careerId);
    if(!attached.ok){
      // Leave nothing half-connected behind: a session without a world would
      // otherwise reserve clubs the local career knows nothing about.
      game()?.end?.();
      say('error',attached.message||'This career could not be opened on this device.');
      return;
    }
    game()?.update?.({status:client.status()});
    if(me?.club_id)game()?.adoptClub?.(me.club_id);
    close();
    mountChip();
    game()?.goToCareer?.();
    toast('Online career connected');
  }

  // ---------------------------------------------------------------
  // In-career status component
  // ---------------------------------------------------------------
  function mountChip(){
    if(chip)return chip;
    chip=doc.createElement('aside');
    chip.id='velmoraOnlineStatus';
    chip.className='mp-status';
    chip.innerHTML=
      '<button type="button" class="mp-status-chip" aria-expanded="false" aria-controls="velmoraOnlinePanel">'+
        '<span class="mp-status-dot"></span><b data-mp-status-label>ONLINE CAREER</b>'+
        '<i data-mp-status-count hidden></i>'+
      '</button>'+
      '<section class="mp-status-panel" id="velmoraOnlinePanel" hidden>'+
        '<header><div><small>SHARED CAREER</small><strong data-mp-panel-title>ONLINE</strong></div>'+
        '<button type="button" data-mp-panel-close aria-label="Close online career details">&times;</button></header>'+
        '<div data-mp-panel-body></div>'+
      '</section>';
    doc.body.appendChild(chip);
    const button=chip.querySelector('.mp-status-chip');
    const panel=chip.querySelector('.mp-status-panel');
    button.addEventListener('click',()=>{
      const opening=panel.hidden;
      panel.hidden=!opening;
      button.setAttribute('aria-expanded',String(opening));
      if(opening)panel.querySelector('button,a')?.focus?.({preventScroll:true});
    });
    chip.querySelector('[data-mp-panel-close]').addEventListener('click',()=>{
      panel.hidden=true;button.setAttribute('aria-expanded','false');button.focus();
    });
    chip.addEventListener('keydown',event=>{
      if(event.key==='Escape'&&!panel.hidden){panel.hidden=true;
        button.setAttribute('aria-expanded','false');button.focus();}
    });
    return chip;
  }

  function renderChip(status){
    if(!chip||!status)return;
    const locked=status.locked;
    const mode=status.readOnly?'readonly':locked?'locked':status.online?'online':'offline';
    chip.dataset.mode=mode;
    chip.querySelector('[data-mp-status-label]').textContent=
      status.readOnly?'READ ONLY':locked?'WAITING':status.pending?'SAVING':'ONLINE CAREER';
    const count=chip.querySelector('[data-mp-status-count]');
    const others=(status.others||[]).length;
    count.hidden=!others;
    count.textContent=others?String(others+1):'';

    chip.querySelector('[data-mp-panel-title]').textContent=status.careerName||'ONLINE CAREER';
    const others2=(status.others||[]);
    const barrier=status.barrier||{};
    const body=
      (status.waitingMessage
        ?`<p class="mp-wait" role="status">${esc(status.waitingMessage)}</p>`
        :status.readOnly
          ?`<p class="mp-wait is-warn" role="status">${esc(status.detail||'Reconnecting to the shared career.')}</p>`
          :'<p class="mp-wait is-good" role="status">The shared career is up to date. Nothing is waiting on anyone.</p>')+
      '<dl class="mp-facts">'+
        `<div><dt>SHARED DATE</dt><dd>${esc(dateLabel(status.careerDate))}</dd></div>`+
        `<div><dt>PROGRESSION</dt><dd>${locked?'LOCKED':'OPEN'}</dd></div>`+
      '</dl>'+
      (others2.length?'<ul class="mp-people" role="list">'+others2.map(person=>{
        const seat=(barrier.participants||[]).find(row=>row.user_id===person.user_id);
        const state=seat?seat.state:null;
        const label=person.status==='AI_CONTROLLED'?'AI CONTROLLED'
          :state==='COMPLETED'?'MATCH COMPLETE'
          :state==='PLAYING'?'PLAYING MATCH'
          :state==='READY'?'READY TO PLAY'
          :state==='DISCONNECTED'?'DISCONNECTED'
          :person.online?esc(person.activity):'OFFLINE';
        return'<li>'+
          `<span class="mp-dot ${person.online?'is-good':'is-idle'}"></span>`+
          `<div><b>${esc(person.manager_name)}</b><small>${esc(person.club_name||'No club')}</small></div>`+
          `<i>${label}</i>`+
        '</li>';
      }).join('')+'</ul>':'')+
      (barrier.outstanding&&barrier.outstanding.some(row=>row.state==='DISCONNECTED')
        ?'<div class="mp-recovery"><p>If they cannot get back to this matchday, their club can be handed to the AI '+
         'so the career can continue. It is recorded in the career history.</p>'+
         `<button type="button" data-mp-recover="${esc(barrier.outstanding.find(row=>row.state==='DISCONNECTED').user_id)}">`+
         'HAND THEIR CLUB TO THE AI</button></div>':'')+
      (status.resolvable?'<button type="button" class="is-primary mp-resolve">CONTINUE THE SHARED CALENDAR</button>':'');

    const panelBody=chip.querySelector('[data-mp-panel-body]');
    panelBody.innerHTML=body;
    panelBody.querySelector('.mp-resolve')?.addEventListener('click',()=>{
      click();game()?.resolveBarrier?.();
    });
    panelBody.querySelector('[data-mp-recover]')?.addEventListener('click',event=>{
      const userId=event.currentTarget.dataset.mpRecover;
      confirmAction(event.currentTarget,{
        title:'Hand their club to the AI?',
        copy:'Their club is run by the AI from now on and the shared calendar can move again. '+
             'This is written into the career history and cannot be undone from here.',
        confirm:'HAND TO AI',
        run:async()=>{await client.convertToAi(status.careerId,userId,'ABSENT');
          toast('Their club is now run by the AI.');}
      });
    });
  }

  // ---------------------------------------------------------------
  // Install
  // ---------------------------------------------------------------
  // Passing an explicit client re-installs against it. That is how the
  // interface tests drive the lobby without a network, and it is inert in
  // ordinary play, where install() is called once with no arguments.
  function install(options={}){
    if(installed&&!options.client)return client;
    const reinstalling=installed;
    installed=true;
    client=options.client||root.VelmoraMultiplayerClient.create({
      bridge:root.VelmoraMultiplayerBridge,
      codec:root.VelmoraSaveCodec,
      window:root
    });

    const button=doc.getElementById('btnOnlineCareer');
    if(button&&!reinstalling)button.addEventListener('click',async()=>{
      click();
      await client.ready;
      open('HUB');
      if(client.signedIn())refreshCareers();
    });

    client.subscribe(status=>{
      lastStatus=status;
      if(status.careerId)mountChip();
      renderChip(status);
      syncMenuLine(status);
      if(view==='LOBBY'&&overlay?.classList.contains('is-open')&&status.careerId===lobby?.careerId)render();
    });

    // An invitation link opens straight into the join step.
    try{
      const invite=new URLSearchParams(root.location.search).get('online');
      if(invite){
        draft.code=String(invite).toUpperCase().slice(0,6);
        client.ready.then(()=>{if(client.signedIn())open('JOIN');});
      }
    }catch(_){}

    return client;
  }

  function syncMenuLine(status){
    const small=doc.getElementById('menuOnlineStatus');
    const detail=doc.getElementById('menuOnlineDetail');
    if(!small||!detail)return;
    if(!client?.signedIn()){
      small.textContent='SIGN IN AT REPO COMPANY';
      detail.textContent='ONLINE CAREERS NEED YOUR ACCOUNT';
      return;
    }
    if(status?.careerId){
      small.textContent=status.locked?'WAITING FOR THE OTHER MANAGER':'CAREER CONNECTED';
      detail.textContent=`${status.careerName||'ONLINE CAREER'} · ${dateLabel(status.careerDate)}`;
      return;
    }
    small.textContent='MANAGE ALONGSIDE A FRIEND';
    detail.textContent='TWO MANAGERS · ONE SHARED WORLD';
  }

  root.VelmoraMultiplayerUI={
    install,open,close,
    render(status){
      lastStatus=status;
      if(status&&status.careerId)mountChip();
      renderChip(status);
      syncMenuLine(status);
    },
    _state:()=>({view,lobby,careers,lastStatus})
  };

  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',()=>queue(),{once:true});
  else queue();
  function queue(){
    // app.js publishes the bridge; wait for it rather than racing it.
    let attempts=0;
    const tick=()=>{
      if(root.VelmoraMultiplayerBridge&&root.VelmoraMultiplayerClient&&root.VelmoraMultiplayerCore){
        try{install();}catch(error){console.error?.('[Velmora] online career interface failed to start',error);}
        return;
      }
      if(attempts++>200)return;
      root.setTimeout(tick,50);
    };
    tick();
  }
})(typeof window==='object'?window:null);
