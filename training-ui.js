/* V23 Training view. All progression is owned by training.js and the career clock. */
(() => {
  'use strict';
  const T=window.VelmoraTraining,views=new WeakMap();
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pct=value=>Math.round(Number(value)||0);
  const dateLabel=date=>new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));
  const dayLabel=date=>new Intl.DateTimeFormat('en-GB',{weekday:'short',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));
  const planName=key=>T.plans[key]?.name||({medical:'Medical recovery',matchday:'Match preparation'}[key])||'Balanced';
  const selection=row=>row.starter?'Starting three':row.bench?'Matchday substitute':'Senior depth';
  function meter(label,current,projected,tone){
    const delta=pct(projected)-pct(current);
    return `<div class="tr-meter"><div><span>${label}</span><strong>${pct(current)}<small> / 100</small></strong></div><div class="tr-track"><i class="${tone}" style="width:${pct(current)}%"></i><b style="left:${Math.min(99,pct(projected))}%" title="Projected ${pct(projected)}"></b></div><small>Projected <b>${pct(projected)}</b> <em class="${delta<0?'is-down':''}">${delta===0?'unchanged':`${delta>0?'+':''}${delta}`}</em></small></div>`;
  }
  function options(values,chosen){return values.map(([value,label])=>`<option value="${value}" ${String(value)===String(chosen)?'selected':''}>${escape(label)}</option>`).join('');}
  function control(row,prefs){
    const choice=row.state.mode==='manual'?row.state.plan:'team',id=escape(row.player.id);
    return `<label class="tr-plan-control"><span>Training schedule</span><select data-tr-player="${id}" data-tr-focus="plan-${id}" aria-label="Training schedule for ${escape(row.player.name)}" ${T.medical(row.player)?'disabled':''}>${options([['team',prefs.automatic?'Team setting · Assistant':'Team setting · Balanced'],...Object.entries(T.plans).map(([key,plan])=>[key,plan.name])],choice)}</select><small>${row.state.mode==='manual'?'Individual schedule':'Follows team setting'} · Today: ${escape(planName(row.plan))}</small></label>`;
  }
  function playerCard(row,data,api,selected){
    const p=row.player,state=T.status(row.forecast.player);
    return `<article class="tr-player ${selected?'is-selected':''}" data-tr-card="${escape(p.id)}"><div class="tr-player-top"><div class="tr-avatar">${api.avatar(p.avatar,p.name)}</div><div class="tr-player-name"><span>${selection(row)}</span><h4>${escape(p.name)}</h4><p>${escape(p.role)} · ${pct(p.ovr)} OVR</p></div><span class="tr-state is-${state.tone}">${state.label}</span></div><div class="tr-meters">${meter('Fitness',p.fitness,row.forecast.fitness,'fitness')}${meter('Sharpness',row.state.sharpness,row.forecast.sharpness,'sharpness')}</div>${control(row,data.preferences)}<div class="tr-player-footer"><span>${escape(p.morale||'Content')} morale · ${escape(p.developmentPlan||'Balanced')} development</span><button type="button" data-tr-detail="${escape(p.id)}" data-tr-focus="detail-${escape(p.id)}" aria-pressed="${selected}" aria-controls="trPlayerDetail">${selected?'Viewing plan':'View plan'} <span aria-hidden="true">↗</span></button></div></article>`;
  }
  function detail(row,data){
    if(!row)return '<section class="tr-detail" id="trPlayerDetail"><h3>No senior players</h3><p>Training plans appear when players join your senior squad.</p></section>';
    const next=data.next,days=next?T.daysBetween(data.date,next.date):null,timeline=row.forecast.timeline;
    const schedule=Array.from({length:7},(_,i)=>{
      const date=T.addDays(data.date,i),entry=timeline.find(d=>d.date===date),after=next&&date>next.date;
      const plan=after?'Review after match':i===0?'Remaining today: '+planName(row.plan):planName(entry?.plan||'balanced');
      return `<div class="tr-day ${next&&date===next.date?'is-match':''} ${after?'is-pending':''}"><time datetime="${date}"><b>${dayLabel(date)}</b>${dateLabel(date)}</time><span>${escape(plan)}</span><small>${after?'Depends on minutes played':i===0?'Today’s progression is already accounted for':entry?`${pct(entry.fitness)} fitness · ${pct(entry.sharpness)} sharpness`:'Next review pending'}</small></div>`;
    }).join('');
    const assistant=data.assistant||{name:'Assistant Coach',title:'Assistant Coach',portrait:window.VelmoraPersonnelIdentity?.asset?.('coach')||'assets/career/personnel-v2/assistant-coach-badger.png'};
    return `<section class="tr-detail" id="trPlayerDetail" aria-label="Selected player training plan"><header class="tr-coach-header"><div class="tr-coach-copy"><span class="tr-eyebrow">${escape(assistant.title)} · ${escape(assistant.name)}</span><h3>${escape(row.advice.title)}</h3><p>${escape(row.advice.copy)}</p><button type="button" data-tr-profile="${escape(row.player.id)}" data-tr-focus="profile">Open ${escape(row.player.name)}’s profile ↗</button></div><figure class="tr-assistant-art" aria-label="${escape(assistant.name)}, ${escape(assistant.title)}"><img src="${escape(assistant.portrait)}" alt=""><figcaption>${escape(assistant.name)}<small>${escape(assistant.title)}</small></figcaption></figure></header><div class="tr-detail-body"><div class="tr-section-title"><h4>Preparation schedule</h4><span>${days===0?'Match today':days===null?'Next seven days':`${days} day${days===1?'':'s'} to prepare`}</span></div><div class="tr-schedule">${schedule}</div><div class="tr-note"><strong>${row.player.name?escape(row.player.name)+' · ':''}${escape(planName(row.plan))}</strong><p>${T.plans[row.plan]?.copy||'Medical and matchday preparation take priority over the selected schedule.'} Hard sessions switch to recovery below 60% fitness.</p></div></div></section>`;
  }
  function render(root,state){
    const api=state.api,data=api.data(),rows=data.rows;
    if(!rows.some(row=>String(row.player.id)===String(state.selected)))state.selected=rows[0]?.player.id||null;
    const selected=rows.find(row=>String(row.player.id)===String(state.selected));
    const scroll=root.parentElement?.scrollTop||0,focus=root.contains(document.activeElement)?document.activeElement?.dataset?.trFocus:null;
    const next=data.next,dayCount=next?Math.max(0,T.daysBetween(data.date,next.date)):null;
    const matchday=rows.filter(row=>row.starter||row.bench),ready=matchday.filter(row=>T.status(row.forecast.player).key==='ready').length;
    const avgFit=rows.length?rows.reduce((sum,row)=>sum+row.forecast.fitness,0)/rows.length:0;
    root.innerHTML=`<div class="tr-shell"><header class="tr-hero"><div class="tr-hero-copy"><span class="tr-eyebrow">PERFORMANCE CENTRE / ${escape(data.club.name)}</span><h2>Ready for<br>the next whistle.</h2><p>Prepare the starters. Keep the bench ready.</p><span class="tr-date">${escape(dateLabel(data.date))} · ${escape(data.trainingFocus)} club focus</span><button type="button" class="tr-observe-session" data-tr-observe data-tr-focus="observe-session">OBSERVE SESSION <span aria-hidden="true">↗</span></button></div><div class="tr-fixture"><span>${next?(next.home?'HOME FIXTURE':'AWAY FIXTURE'):'PREPARATION WINDOW'}</span><h3>${next?'vs '+escape(next.opponent):'No upcoming fixture'}</h3><p>${next?escape(dateLabel(next.date))+' · '+escape(next.venue):'Use the seven-day forecast to maintain readiness.'}</p><div class="tr-hero-stats"><div><strong>${ready}<small>/${matchday.length}</small></strong><span>Matchday players ready</span></div><div><strong>${pct(avgFit)}<small>%</small></strong><span>Projected squad fitness</span></div><div><strong>${dayCount===null?'7':dayCount}</strong><span>${dayCount===null?'Day forecast':'Days to prepare'}</span></div></div></div></header><section class="tr-toolbar" aria-label="Automatic training preferences"><label class="tr-auto"><input type="checkbox" data-tr-pref="automatic" data-tr-focus="automatic" ${data.preferences.automatic?'checked':''}><span><strong>Assistant training</strong><small>${data.preferences.automatic?'Adapts daily; individual schedules stay in place.':'Off · team-setting players use Balanced.'}</small></span></label><label><span>Target fitness</span><select data-tr-pref="targetFitness" data-tr-focus="targetFitness" ${data.preferences.automatic?'':'disabled'} aria-label="Assistant target fitness">${options([75,80,85,90,95].map(n=>[n,n+'%']),data.preferences.targetFitness)}</select></label><label><span>Target sharpness</span><select data-tr-pref="targetSharpness" data-tr-focus="targetSharpness" ${data.preferences.automatic?'':'disabled'} aria-label="Assistant target sharpness">${options([60,65,70,75,80,85,90].map(n=>[n,n+'%']),data.preferences.targetSharpness)}</select></label><div class="tr-toolbar-note">Fitness powers the workload.<br>Sharpness supports execution.</div></section><div class="tr-main"><section class="tr-roster" aria-label="Senior squad readiness"><div class="tr-section-title"><h3>Your preparation plan</h3><span>${rows.length} senior players · ${next?'Next-fixture projection':'Seven-day projection'}</span></div><div class="tr-player-grid">${rows.map(row=>playerCard(row,data,api,String(row.player.id)===String(state.selected))).join('')||'<p class="tr-empty">No senior players available for training.</p>'}</div></section><aside>${detail(selected,data)}</aside></div><footer class="tr-disclaimer"><b>Forecasts, not guarantees.</b> Projections include your schedule, normal recovery and current medical absence. New injuries, transfers and career events can change the outcome. Training takes effect when the career date advances. Permanent growth continues through each player’s development plan.</footer><span class="tr-live" role="status" aria-live="polite">${escape(state.message||'')}</span></div>`;
    if(root.parentElement)root.parentElement.scrollTop=scroll;
    if(focus){const target=Array.from(root.querySelectorAll('[data-tr-focus]')).find(el=>el.dataset.trFocus===focus);target?.focus({preventScroll:true});}
  }
  function mount(root,api){
    if(!root)return;
    let state=views.get(root);
    if(!state){
      state={api,selected:null,message:''};views.set(root,state);
      root.addEventListener('change',event=>{
        const input=event.target;if(!input.matches('select,input'))return;
        if(input.dataset.trPlayer){state.api.setPlayer(input.dataset.trPlayer,input.value);state.selected=input.dataset.trPlayer;state.message='Training schedule updated. Forecast recalculated.';}
        else if(input.dataset.trPref){state.api.setPreference(input.dataset.trPref,input.type==='checkbox'?input.checked:Number(input.value));state.message='Assistant preferences updated. Forecast recalculated.';}else return;
        render(root,state);
      });
      root.addEventListener('click',event=>{
        const button=event.target.closest('button');if(!button)return;
        if(button.hasAttribute('data-tr-observe')){const shown=state.api.observeSession?.();state.message=shown===false?'Training observation is already logged for this month.':'Manager observation opened.';return;}
        if(button.dataset.trDetail){state.selected=button.dataset.trDetail;state.message='Selected player preparation plan updated.';render(root,state);}
        if(button.dataset.trProfile)state.api.openPlayer(button.dataset.trProfile);
      });
    }
    state.api=api;render(root,state);
  }
  window.VelmoraTrainingView=Object.freeze({mount});
})();
