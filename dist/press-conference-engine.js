(function(){
  'use strict';

  const DEFAULT_ARCHETYPES=[
    {id:'supportive',label:'BACK THE GROUP',stance:'SUPPORTIVE',expression:'expression_04'},
    {id:'accountable',label:'TAKE RESPONSIBILITY',stance:'ACCOUNTABLE',expression:'expression_01'},
    {id:'demanding',label:'RAISE THE STANDARD',stance:'DEMANDING',expression:'expression_06'},
    {id:'guarded',label:'SHUT IT DOWN',stance:'GUARDED',expression:'expression_08'},
    {id:'bold',label:'MAKE A STATEMENT',stance:'BOLD',expression:'expression_09'},
    {id:'human',label:'SPEAK FROM THE HEART',stance:'PERSONAL',expression:'expression_03'}
  ];
  const esc=value=>String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));
  const hash=value=>{let h=2166136261;for(const c of String(value)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
  const rngFrom=seed=>{let x=hash(seed)||1;return()=>{x+=0x6D2B79F5;let t=x;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};};
  const pick=(items,rng,fallback='')=>items?.length?items[Math.floor(rng()*items.length)]:fallback;
  const replaceTokens=(text,tokens)=>String(text||'').replace(/\{([a-zA-Z]+)\}/g,(_m,key)=>tokens[key]??'');

  function create(adapter={}){
    const library=window.VELMORA_PRESS_CONFERENCE_LIBRARY||{categories:[],questionsPerConference:4};
    let root=null;
    let active=null;
    let continueAction=null;
    let continueLabel='CONTINUE';
    let flashTimer=0;

    function ensureRoot(){
      if(root?.isConnected)return root;
      root=document.createElement('div');
      root.id='pressConferenceOverlay';
      root.className='press-conference-overlay';
      root.setAttribute('aria-hidden','true');
      root.innerHTML='<div data-pc-root></div>';
      document.body.appendChild(root);
      root.addEventListener('click',handleClick);
      return root;
    }

    function sessionKey(stage,fixtureId){return `${fixtureId||'fixture'}::${stage}`;}
    function categoryAvailable(category,stage,context){
      if(!category?.stages?.includes(stage))return false;
      const req=category.requires;
      if(!req)return true;
      if(req==='young')return !!context.players?.young;
      if(req==='rival')return !!context.rivalManager;
      if(req==='contract')return !!context.players?.contract;
      if(req==='unavailable')return !!context.players?.unavailable;
      if(req==='result')return stage==='post'&&!!context.score;
      if(req==='potm')return stage==='post'&&!!context.players?.potm;
      if(req==='scorer')return stage==='post'&&!!context.players?.scorer;
      if(req==='discipline')return stage==='post'&&Number(context.cards||0)>0;
      if(req==='position')return Number(context.tablePosition||0)>0;
      if(req==='transfer')return !!context.players?.transfer;
      if(req==='story')return !!context.recentStory;
      if(req==='selection')return !!context.players?.featured;
      if(req==='defeat')return stage==='post'&&context.resultCode==='L';
      if(req==='victory')return stage==='post'&&context.resultCode==='W';
      return !!context[req];
    }
    function weightedCategory(pool,rng){
      const total=pool.reduce((sum,item)=>sum+Math.max(1,Number(item.weight||1)),0);
      let roll=rng()*total;
      for(const item of pool){roll-=Math.max(1,Number(item.weight||1));if(roll<=0)return item;}
      return pool[0];
    }
    function questionTarget(category,context,rng){
      const players=context.players||{};
      if(category.target==='captain')return players.captain||players.featured;
      if(category.target==='young')return players.young||players.featured;
      if(category.target==='unavailable')return players.unavailable||players.featured;
      if(category.target==='contract')return players.contract||players.featured;
      if(category.target==='potm')return players.potm||players.featured;
      if(category.target==='scorer')return players.scorer||players.potm||players.featured;
      if(category.target==='opponentPlayer')return players.opponentStar||null;
      if(category.target==='player')return pick([players.featured,players.captain,players.young,players.potm,players.scorer].filter(Boolean),rng,players.featured);
      return null;
    }
    function questionTokens(context,target){
      return{
        club:context.club?.name||'the club',opponent:context.opponent?.name||'the opposition',competition:context.competition||'this competition',
        player:target?.name||context.players?.featured?.name||'the player',captain:context.players?.captain?.name||'your captain',
        rivalManager:context.rivalManager?.name||'the opposing manager',opponentPlayer:context.players?.opponentStar?.name||'their key player',
        form:context.form||'mixed',result:context.resultLabel||'result',score:context.score||'full-time',tactic:context.tactic||'balanced',
        board:context.boardLabel||'stable',world:context.world||'Velmora',position:context.tablePosition?`${context.tablePosition}${context.tableSuffix||''}`:'your current position',
        venue:context.venue||'the stadium',manager:context.managerName||'the manager',story:context.recentStory||'the latest story'
      };
    }
    function reporterFor(index,context,rng,preferred=null){
      const reporters=context.reporters||[];
      if(preferred)return preferred;
      return reporters.length?reporters[(index+Math.floor(rng()*reporters.length))%reporters.length]:{id:`REPORTER-${index}`,name:'PRESS ROOM REPORTER',role:'Match correspondent',outlet:'VELMORA SPORT',tone:'Direct',relationship:50,avatar:''};
    }
    function frameQuestion(base,stage,reporter,context,rng){
      const frames=library.framings?.[stage]||[];
      const toneFrames=library.reporterFramings?.[String(reporter?.tone||'').toLowerCase()]||[];
      const frame=pick([...toneFrames,...frames,''],rng,'');
      if(!frame||rng()<.38)return base;
      return `${replaceTokens(frame,questionTokens(context,null))} ${base}`.trim();
    }
    function conferenceQuestionCount(context){
      if(context.marquee)return 5;
      if(context.stage==='post'&&['W','L'].includes(context.resultCode))return 4;
      return 3+(hash(`${context.fixtureId}-${context.stage}-${context.date}-LENGTH`)%2);
    }
    function priorityCategoryIds(context){
      if(context.stage==='post')return[
        'MATCH_RESULT',context.resultCode==='W'?'VICTORY_MOMENT':context.resultCode==='L'?'DEFEAT_RESPONSE':'TACTICAL_CHANGE',
        context.players?.potm?'PLAYER_OF_MATCH':context.players?.scorer?'GOAL_SCORER':null,
        Number(context.cards||0)>0?'DISCIPLINE':null,context.rivalManager?'RIVAL_MANAGER':null
      ].filter(Boolean);
      return[
        context.players?.unavailable?'AVAILABILITY':null,context.players?.transfer?'TRANSFER_RUMOUR':null,
        context.players?.contract?'CONTRACTS':null,context.rivalManager?'RIVAL_MANAGER':'OPPONENT',
        context.players?.featured?'SELECTION':null,'TACTICS',Number(context.tablePosition||0)>0?'TABLE_POSITION':null
      ].filter(Boolean);
    }
    function questionEvidence(category,context,target){
      const stats=target?.seasonStats||{},appearances=Number(stats.apps||0),starts=Number(stats.starts||0),goals=Number(stats.goals||0),role=target?.squadRole||target?.role||'SQUAD';
      if(target&&category.id==='CONTRACTS')return`${target.name} · ${role} · ${Number(target.contractYears||0)} YEAR${Number(target.contractYears||0)===1?'':'S'} REMAINING`;
      if(target&&['TRANSFER_RUMOUR','TRANSFERS'].includes(category.id))return`${target.name} · ${role} · ${String(target.transferStatus||'FUTURE UNDER DISCUSSION').replace(/_/g,' ')}`;
      if(target&&category.id==='AVAILABILITY')return`${target.name} · ${role} · UNAVAILABLE FOR ${context.opponent.name}`;
      const playerLine=target?`${target.name} · ${role}${target.form?` · ${target.form} form`:''}${appearances?` · ${appearances} apps${starts?` / ${starts} starts`:''}`:''}${goals?` · ${goals} goals`:''}`:'';
      if(playerLine)return playerLine;
      if(category.id==='MATCH_RESULT'||category.id==='DEFEAT_RESPONSE'||category.id==='VICTORY_MOMENT')return`${context.club.name} ${context.score||'FT'} ${context.opponent.name} · ${String(context.resultLabel||'result').toUpperCase()}`;
      if(['RECENT_FORM','TABLE_POSITION','CLUB_AMBITION'].includes(category.id))return`${context.tablePosition?`${context.tablePosition}${context.tableSuffix||''} IN THE TABLE · `:''}LAST FIVE ${context.form||'—'}`;
      if(['RIVAL_MANAGER','RIVALRY_FIXTURE'].includes(category.id)&&context.rivalManager)return`${context.rivalManager.name} · ${context.opponent.name} · ${context.rivalManager.style||'MEASURED'}`;
      if(category.id==='CURRENT_STORY'&&context.recentStory)return`LATEST STORY · ${context.recentStory}`;
      return`${context.competition||'MATCHDAY'} · ${context.club.name} v ${context.opponent.name}`;
    }
    function buildQuestions(context){
      const stage=context.stage,rng=rngFrom(`${context.fixtureId}-${stage}-${context.date}-${library.version||1}`),all=(library.categories||[]).filter(c=>categoryAvailable(c,stage,context)),desired=conferenceQuestionCount(context),usedCategories=new Set(),usedKeys=new Set(adapter.recentQuestionKeys?.()||[]),questions=[];
      const addCategory=category=>{
        if(!category||usedCategories.has(category.id))return false;const target=questionTarget(category,context,rng),templates=category.templates||[];if(!templates.length){usedCategories.add(category.id);return false;}
        let templateIndex=Math.floor(rng()*templates.length),attempts=0,key='';do{key=`${category.id}:${templateIndex}:${target?.id||'GENERAL'}`;if(!usedKeys.has(key))break;templateIndex=(templateIndex+1)%templates.length;}while(++attempts<templates.length);
        const reporter=reporterFor(questions.length,context,rng),tokens=questionTokens(context,target),base=replaceTokens(templates[templateIndex],tokens);
        questions.push({id:`Q${questions.length+1}-${hash(key).toString(36)}`,key,categoryId:category.id,categoryLabel:category.label,targetId:target?.id||null,targetName:target?.name||null,target:target||null,reporter,text:frameQuestion(base,stage,reporter,context,rng),evidence:questionEvidence(category,context,target),isFollowUp:false});usedCategories.add(category.id);usedKeys.add(key);return true;
      };
      for(const id of priorityCategoryIds(context)){if(questions.length>=desired)break;addCategory(all.find(category=>category.id===id));}
      let guard=0;while(questions.length<desired&&guard++<180&&all.length){const candidates=all.filter(c=>!usedCategories.has(c.id)),category=weightedCategory(candidates.length?candidates:all,rng);if(!category)break;addCategory(category);}
      return questions;
    }
    function responseSubject(question,context){
      if(question.targetName)return question.targetName;
      if(['OPPONENT','RIVAL_MANAGER','OPPONENT_PLAYER','DERBY','RIVALRY_FIXTURE'].includes(question.categoryId))return context.opponent?.name||'the opposition';
      return context.club?.name||'this group';
    }
    const cap=s=>{s=String(s||'');return s?s.charAt(0).toUpperCase()+s.slice(1):s;};
    // Legacy category lines remain as a fallback for pre-V95 saves. New sessions use fully
    // authored answer banks and never funnel every question through the same six tone buttons.
    const TOPIC_LINES={
      PLAYER_FORM:t=>`${t.subject}'s recent performances are exactly what we assess honestly, not emotionally`,
      SELECTION:t=>`the team sheet reflects what ${t.subject} has shown me, not reputation`,
      CAPTAINCY:t=>`the armband on ${t.subject} is about standards, not decoration`,
      BREAKTHROUGH:t=>`${t.subject} is still developing, and we are managing that process carefully`,
      SQUAD_MOOD:t=>`the mood inside ${t.club} right now is honest, competitive and together`,
      RECENT_FORM:t=>`our run of ${t.form} tells part of the story, but not the whole of it`,
      MATCH_RESULT:t=>`the ${t.score} scoreline against ${t.opponent} is the headline, but the performance is what I actually judge`,
      TACTICS:t=>`our ${t.tactic} approach against ${t.opponent} came from exactly what we saw in preparation`,
      OPPONENT:t=>`${t.opponent} will test us in specific ways, and we have prepared for exactly that`,
      RIVAL_MANAGER:t=>`my relationship with ${t.rivalManager} is about respect for the contest, nothing more`,
      BOARD:t=>`the board's expectations, and a relationship I would call ${t.board}, shape plenty of what I do, but not everything`,
      TRANSFERS:t=>`our transfer business reflects what ${t.club} actually needs, not headlines`,
      CONTRACTS:t=>`${t.subject}'s contract situation is a conversation for inside this building, not outside it`,
      AVAILABILITY:t=>`${t.subject}'s absence changes some of our planning, but never our standards`,
      YOUTH_PATHWAY:t=>`a visible pathway at ${t.club} matters to me as much as the first team does`,
      SUPPORTERS:t=>`what the ${t.club} supporters see from this group matters to me directly`,
      PRESSURE:t=>`pressure comes with managing ${t.club}; how I carry it is my responsibility alone`,
      PERSONAL_LIFE:t=>`life away from ${t.club} is what keeps me sharp enough for the demands of this job`,
      CLUB_CULTURE:t=>`the culture we are building at ${t.club} has to survive more than one difficult week`,
      COMPETITION:t=>`the standard of ${t.competition} this season shapes how I judge our progress`,
      CURRENT_STORY:t=>`the story around ${t.club} this week is noise compared to what happens on the pitch`,
      PLAYER_OF_MATCH:t=>`${t.subject}'s performance today was exactly what we planned for`,
      GOAL_SCORER:t=>`${t.subject}'s contribution today came from work done all week, not luck`,
      OPPONENT_PLAYER:t=>`${t.opponentPlayer} is a real threat, and we prepared specifically to deal with it`,
      TABLE_POSITION:t=>`our position at ${t.position} is a fact right now, not the full picture`,
      DISCIPLINE:t=>`the discipline in this ${t.score} result is something I will address directly`,
      OFFICIATING:t=>`the officiating tonight is not something I intend to dwell on publicly`,
      ROTATION:t=>`the changes to the team, ${t.subject} included, come from what I see, not habit`,
      FATIGUE:t=>`managing fatigue across this squad is now part of every selection I make`,
      TRAINING_WEEK:t=>`what ${t.subject} showed this week in training mattered more than people realise`,
      TACTICAL_CHANGE:t=>`the change in shape during the match came from what I saw, not panic`,
      RIVALRY_FIXTURE:t=>`a fixture like this against ${t.opponent} carries weight beyond three points`,
      SOCIAL_MEDIA:t=>`what gets said about ${t.club} online is not something that dictates my decisions`,
      MANAGER_PHILOSOPHY:t=>`my principles at ${t.club} do not bend because one week has been difficult`,
      CLUB_AMBITION:t=>`whether ${t.club} is matching its ambition is a fair question, and I take it seriously`,
      TRANSFER_RUMOUR:t=>`the speculation about ${t.subject} is not coming from inside this club`,
      STAFF_ROLE:t=>`my staff's work on ${t.opponent} this week shaped everything you saw out there`,
      DEFEAT_RESPONSE:t=>`a result like this at ${t.club} hurts, and I am not going to pretend otherwise`,
      VICTORY_MOMENT:t=>`a win like this against ${t.opponent} says something, but it remains one result`
    };
    const TONE_FRAMES={
      supportive:{openers:['I trust this group completely.','My backing here is not in question.','I stand fully behind this.'],closers:['They know they have my support.','That will not change because of one moment.','Nobody in this building doubts it.']},
      accountable:{openers:['That responsibility starts with me.',"I will not hide behind a player.",'Whatever happens, I own it first.'],closers:['I make the decisions, and I will answer for them.','I will review it honestly before I look anywhere else.','That is the job, and I accept it.']},
      demanding:{openers:["Let's be honest about the standard here.",'Nobody gets comfort just for trying.','We can respect the effort and still demand more.'],closers:['I expect a response.','There is another level, and I want to see it.','The standard does not move because the week was hard.']},
      guarded:{openers:['That belongs inside this building.',"I'm not going to hand out details here.",'With respect, that stays private.'],closers:["I won't turn it into a public trial.",'The team will hear it from me first.','We deal in facts internally, not headlines.']},
      bold:{openers:['Let me be very clear.',"Here's a real headline for you.","I'll say this plainly."],closers:['We are not here to make up the numbers.','We believe we can compete with anyone at our level.','I would rather aim high and be judged for it than think small.']},
      human:{openers:['People forget there are human beings behind this.','I felt this one, honestly.',"Management isn't a script for me."],closers:['We care deeply, and we come back together.','That emotion is real, as long as we use it well.','I can be proud and frustrated at the same time, and today I am both.']}
    };
    function responseText(choice,question,context,index){
      const subject=responseSubject(question,context),tokens={...questionTokens(context,{name:subject,id:question.targetId}),subject},rng=rngFrom(`${question.id}-${choice.id}-${context.fixtureId}-${index}`),authored=Array.isArray(choice.text)?pick(choice.text,rng,choice.text[0]):choice.text;
      if(authored)return replaceTokens(authored,tokens).replace(/\s+/g,' ').trim();
      const baseCategoryId=String(question.categoryId||'').replace(/^FOLLOW-UP · /,''),topicFn=TOPIC_LINES[baseCategoryId]||TOPIC_LINES[question.categoryId]||(t=>`${question.categoryLabel||'this question'} matters at ${t.club}`);
      return`${cap(topicFn(tokens))}.`;
    }
    function answersFor(question,context){
      const bankId=question.answerBankId||question.categoryId,source=library.answerBanks?.[bankId]||library.answerBanks?.DEFAULT||library.responseArchetypes||DEFAULT_ARCHETYPES,rng=rngFrom(`${question.id}-${context.fixtureId}-${bankId}-ANSWERS`),maximum=Math.min(5,source.length),minimum=Math.min(3,maximum),count=minimum+(maximum>minimum?hash(`${question.id}-${bankId}-COUNT`)%(maximum-minimum+1):0),pool=[...source],selected=[];
      while(selected.length<count&&pool.length){const index=Math.floor(rng()*pool.length);selected.push(pool.splice(index,1)[0]);}
      return selected.map((choice,index)=>({...choice,label:replaceTokens(choice.label,questionTokens(context,{name:question.targetName||responseSubject(question,context)})),effects:{...(choice.effects||{})},text:responseText(choice,question,context,index)}));
    }
    function createSession(context){
      const questions=buildQuestions(context),id=`PC-${context.fixtureId}-${context.stage}-${Date.now().toString(36)}`;
      return{id,key:sessionKey(context.stage,context.fixtureId),fixtureId:context.fixtureId,stage:context.stage,date:context.date,status:'INVITED',questionIndex:0,questions,answers:[],startedAt:null,completedAt:null,skipped:false,followUpCount:0,impactTotals:{positive:0,negative:0},version:library.version||'1'};
    }
    function save(){if(active)adapter.saveSession?.(active.key,active);}
    function sceneIsLight(context){return hash(`${context.fixtureId}-${context.stage}-SCENE`)%2===1;}
    function sceneAssets(context){const light=sceneIsLight(context);return{light,room:`assets/press-conference/press-room-${light?'light':'night'}.png`,desk:`assets/press-conference/press-desk-${light?'light':'night'}.png`};}
    function badgeHtml(club){return club?.badge?`<img src="${esc(club.badge)}" alt="${esc(club.name||'Club')} badge">`:`<strong>${esc((club?.abbr||club?.name||'?').slice(0,3))}</strong>`;}
    function baseScene(context,inner=''){
      const assets=sceneAssets(context),progress=active?.questions||[];
      root.classList.toggle('is-light',assets.light);
      return `<div class="pc-room" style="background-image:url('${assets.room}')"></div><div class="pc-room-shade"></div><div class="pc-manager-stage"><div class="pc-manager-figure is-listening" data-pc-manager>${adapter.managerHTML?.('expression_00')||''}</div></div><div class="pc-foreground" style="background-image:url('${assets.desk}')"></div><div class="pc-room-vignette"></div><div class="pc-room-grain"></div><div class="pc-camera-flash" data-pc-flash></div><div class="pc-chrome"><div class="pc-live-chip"><i></i> LIVE · MEDIA ROOM</div><div class="pc-stage-chip">${context.stage==='pre'?'PRE-MATCH':'POST-MATCH'} · ${esc(context.competition||'FIXTURE')}</div>${active?.status==='ACTIVE'?'<button class="pc-exit" type="button" data-pc-leave>LEAVE CONFERENCE</button>':''}${active?.status==='ACTIVE'?`<div class="pc-progress">${progress.map((_q,i)=>`<i class="${i<active.questionIndex?'is-done':i===active.questionIndex?'is-current':''}"></i>`).join('')}</div>`:''}</div>${inner}`;
    }
    function introMarkup(context){
      const stage=context.stage==='pre'?'PRE-MATCH MEDIA DUTY':'POST-MATCH MEDIA DUTY',copy=context.stage==='pre'?`The press are waiting before ${context.club.name} face ${context.opponent.name}. Every answer can shape confidence, relationships and the story around the fixture.`:`The cameras are live after ${context.club.name} ${context.score||'at full-time'} ${context.opponent.name}. Face the questions now, or leave the result to speak for itself.`;
      return baseScene(context,`<section class="pc-intro"><div class="pc-intro-card"><main class="pc-intro-main"><span>OPTIONAL · ${stage}</span><h1>${context.stage==='pre'?'FACE THE PRESS':'THE PRESS ARE WAITING'}</h1><p>${esc(copy)}</p><div class="pc-fixture-lockup"><div class="pc-badge">${badgeHtml(context.club)}</div><div class="pc-fixture-copy"><small>${esc(context.competition||'MATCHDAY')}</small><strong>${esc(context.club.name)} ${context.stage==='post'?esc(context.score||'v'):'v'} ${esc(context.opponent.name)}</strong><span>${esc(context.occasion||context.venue||'Official media room')}</span></div><div class="pc-badge">${badgeHtml(context.opponent)}</div></div></main><aside class="pc-intro-side"><div class="pc-duty-list"><div><b>01</b><span><strong>THE FIXTURE SETS THE ROOM</strong><small>The result, selection, form and live career stories decide what gets asked first.</small></span></div><div><b>02</b><span><strong>NO STOCK ANSWER WHEEL</strong><small>Each topic has its own believable statements. The number of options changes with the question.</small></span></div><div><b>03</b><span><strong>REPORTERS CAN PRESS YOU</strong><small>Promises, criticism and evasive answers can produce a real follow-up and return later.</small></span></div></div><div class="pc-intro-actions"><button type="button" class="is-primary" data-pc-attend>ATTEND PRESS CONFERENCE</button><button type="button" data-pc-skip>SKIP · ${esc(continueLabel)}</button></div></aside></div></section>`);
    }
    function relationshipLabel(value){value=Number(value||50);return value>=72?'WARM ACCESS':value>=58?'GOOD ACCESS':value>=42?'PROFESSIONAL':value>=28?'COOL':'FROSTY';}
    function questionMarkup(context){
      const question=active.questions[active.questionIndex];if(!question)return completeMarkup(context);
      const answers=answersFor(question,context),reporter=question.reporter||{},avatar=reporter.avatar?`<img src="${esc(reporter.avatar)}" alt="">`:`<span>${esc(String(reporter.name||'P').slice(0,1))}</span>`;
      return baseScene(context,`<section class="pc-question-card ${question.isFollowUp?'is-follow-up':''}"><div class="pc-reporter"><div class="pc-reporter-avatar">${avatar}</div><div class="pc-reporter-copy"><small>${esc(reporter.outlet||'VELMORA SPORT')}</small><strong>${esc(reporter.name||'PRESS ROOM REPORTER')} · ${esc(reporter.role||'MATCH CORRESPONDENT')}</strong></div><div class="pc-reporter-access"><span>MEDIA RELATIONSHIP</span><b>${relationshipLabel(reporter.relationship)}</b></div></div><div class="pc-topic">${esc(question.categoryLabel||'MATCHDAY')}</div><h2>${esc(question.text)}</h2><div class="pc-evidence"><span>WHY IT IS BEING ASKED</span><strong>${esc(question.evidence||`${context.club.name} v ${context.opponent.name}`)}</strong></div></section><section class="pc-answer-panel"><div class="pc-answer-label"><span>WHAT DO YOU ACTUALLY SAY?</span><small>Choose the words you are prepared to own</small></div><div class="pc-answer-grid" data-answer-count="${answers.length}">${answers.map((answer,i)=>`<button type="button" class="pc-answer" data-pc-answer="${esc(answer.id)}"><b class="pc-answer-key">${i+1}</b><strong>${esc(answer.label)}</strong><small>“${esc(answer.text)}”</small></button>`).join('')}</div></section>`);
    }
    function responseMarkup(context,question,choice,text,impact){
      const chips=(impact?.chips||[]).map(x=>`<span class="pc-impact ${x.tone==='positive'?'is-positive':x.tone==='negative'?'is-negative':''}">${esc(x.label)}</span>`).join('');
      return baseScene(context,`<section class="pc-question-card ${question.isFollowUp?'is-follow-up':''}"><div class="pc-reporter"><div class="pc-reporter-avatar">${question.reporter?.avatar?`<img src="${esc(question.reporter.avatar)}" alt="">`:''}</div><div class="pc-reporter-copy"><small>${esc(question.reporter?.outlet||'VELMORA SPORT')}</small><strong>${esc(question.reporter?.name||'PRESS ROOM REPORTER')}</strong></div><div class="pc-reporter-access"><span>REACTION</span><b>${esc(impact?.reaction||'NOTED')}</b></div></div><div class="pc-topic">${esc(question.categoryLabel)}</div><h2>${esc(question.text)}</h2></section><section class="pc-response-panel"><span>ON THE RECORD · ${esc(context.managerName||'MANAGER')}</span><strong class="pc-chosen-line">${esc(choice.label)}</strong><blockquote>“${esc(text)}”</blockquote><div class="pc-impact-row">${chips}</div><div class="pc-response-actions"><button type="button" class="pc-next" data-pc-next>${active.questionIndex>=active.questions.length-1?'FINISH CONFERENCE':'NEXT QUESTION'}</button></div></section><div class="pc-quote-ticker is-visible">${esc(impact?.ticker||`${question.reporter?.outlet||'The press room'} are already shaping the headline.`)}</div>`);
    }
    function completeMarkup(context){
      const answered=active.answers.length,headline=active.answers.find(answer=>answer.impact?.headline)||active.answers.at(-1),coolAccess=active.answers.some(answer=>(answer.impact?.chips||[]).some(chip=>/access cooler/i.test(chip.label))),mood=headline?.impact?.headline?'HEADLINES ALREADY MOVING':Number(active.followUpCount||0)>0?'THE ROOM PUSHED BACK':coolAccess?'QUESTIONS STILL HANGING':'NO EASY HEADLINE',people=[...new Set(active.answers.flatMap(answer=>(answer.impact?.chips||[]).map(chip=>chip.label)).filter(Boolean))].slice(0,3);
      return baseScene(context,`<section class="pc-complete"><div class="pc-complete-card"><main class="pc-complete-main"><span>MEDIA DUTY COMPLETE</span><h1>${mood}</h1><p>${answered} question${answered===1?'':'s'} answered. What you said is saved against this fixture, the people named and the reporters who asked.</p><div class="pc-summary-grid"><div><span>LEAD LINE</span><strong>${esc(headline?.choiceLabel||headline?.stance||'NO SINGLE LINE')}</strong></div><div><span>QUESTIONS</span><strong>${answered}/${active.questions.length}</strong></div><div><span>FOLLOW-UPS</span><strong>${Number(active.followUpCount||0)}</strong></div><div><span>PUBLIC RECORD</span><strong>SAVED</strong></div></div></main><aside class="pc-complete-side"><div class="pc-duty-list">${people.length?people.map((line,index)=>`<div><b>${String(index+1).padStart(2,'0')}</b><span><strong>${esc(line)}</strong><small>This reaction now belongs to the career context.</small></span></div>`).join(''):`<div><b>01</b><span><strong>NO IMMEDIATE FALLOUT</strong><small>The answers stay on record and can still return later.</small></span></div>`}</div><div class="pc-intro-actions"><button type="button" class="is-primary" data-pc-finish>${esc(continueLabel)}</button></div></aside></div></section>`);
    }
    function render(mode='question',payload=null){
      if(!root||!active)return;
      const context=active.context;
      const host=root.querySelector('[data-pc-root]');
      if(mode==='intro')host.innerHTML=introMarkup(context);
      else if(mode==='response')host.innerHTML=responseMarkup(context,payload.question,payload.choice,payload.text,payload.impact);
      else if(mode==='complete')host.innerHTML=completeMarkup(context);
      else host.innerHTML=questionMarkup(context);
      adapter.hydrate?.(root);adapter.overlayChanged?.(true,root);
    }
    function maybeCreateFollowUp(question,choice,context,impact){
      if(question.isFollowUp||Number(active.followUpCount||0)>=2||active.questions.length>=6)return;
      const effects=choice.effects||{},reporterTone=String(question.reporter?.tone||'').toLowerCase(),rng=rngFrom(`${active.id}-${question.id}-${choice.id}-FOLLOW`),chance=clamp(.12+(effects.headline?.24:0)+(Number(effects.reporter||0)<=-2?.28:0)+(effects.callback?.2:0)+((effects.targetTest||effects.squadTest)?0.14:0)+(['direct','sceptical','punchy'].includes(reporterTone)?.12:0),.08,.78);
      if(rng()>=chance)return;
      const subject=responseSubject(question,context),lines=Number(effects.reporter||0)<=-2?[
        `You have avoided the point about {subject}. What are you unwilling to say in public?`,
        `Supporters heard a refusal there. What can you tell them about {subject}?`
      ]:effects.targetTest||effects.squadTest?[
        `You have challenged {subject} in public. Have you used those exact words in the dressing room?`,
        `What happens if {subject} does not give you the response you have demanded?`
      ]:effects.callback?[
        `That sounds like a promise about {subject}. What should people hold you to after the next match?`,
        `If the evidence goes the other way, will you accept that this answer was wrong?`
      ]:[
        `You have given us a strong line on {subject}. Why are you so certain?`,
        `What do you say to people who will hear that answer very differently?`
      ],text=replaceTokens(pick(lines,rng,lines[0]),{subject,club:context.club.name,opponent:context.opponent.name,player:question.targetName||'the player',manager:context.managerName}),follow={id:`${question.id}-F${Number(active.followUpCount||0)+1}`,key:`FOLLOW:${question.key}:${choice.id}`,categoryId:question.categoryId,categoryLabel:`FOLLOW-UP · ${question.categoryLabel}`,answerBankId:'FOLLOW_UP',targetId:question.targetId,targetName:question.targetName,target:question.target||null,reporter:{...question.reporter,relationship:impact?.relationship??question.reporter.relationship},text,evidence:`PRESSED ON YOUR LAST ANSWER · ${choice.label}`,isFollowUp:true};
      active.questions.splice(active.questionIndex+1,0,follow);active.followUpCount=Number(active.followUpCount||0)+1;
    }
    function answer(choiceId){
      if(active.status!=='ACTIVE'||active.awaitingNext)return;
      const question=active.questions[active.questionIndex],choice=answersFor(question,active.context).find(x=>x.id===choiceId);if(!question||!choice)return;
      const text=responseText(choice,question,active.context,active.questionIndex),impact=adapter.applyImpact?.(choice,question,active.context,text,active)||{chips:[],reaction:'NOTED'};
      active.answers.push({questionId:question.id,questionKey:question.key,categoryId:question.categoryId,reporterId:question.reporter?.id||null,choiceId:choice.id,choiceLabel:choice.label,stance:choice.stance||choice.label,text,targetId:question.targetId||null,impact,date:active.context.date});
      active.impactTotals.positive+=Number(impact?.positive||0);active.impactTotals.negative+=Number(impact?.negative||0);active.awaitingNext=true;
      maybeCreateFollowUp(question,choice,active.context,impact);save();render('response',{question,choice,text,impact});
      const figure=root.querySelector('[data-pc-manager]');if(figure){figure.classList.remove('is-listening');figure.classList.add('is-speaking');figure.innerHTML=adapter.managerHTML?.(choice.expression||'expression_03')||'';adapter.hydrate?.(figure);}
      clearTimeout(flashTimer);flashTimer=setTimeout(()=>root?.querySelector('[data-pc-flash]')?.classList.add('fire'),170);
    }
    function next(){
      if(!active.awaitingNext)return;
      active.awaitingNext=false;active.questionIndex++;
      if(active.questionIndex>=active.questions.length){active.status='COMPLETED';active.completedAt=Date.now();adapter.complete?.(active,active.context);save();render('complete');}
      else{save();render('question');}
    }
    function finish(skipped=false){
      if(!active)return;
      if(skipped){active.skipped=true;active.status=active.answers.length?'LEFT_EARLY':'SKIPPED';active.completedAt=Date.now();adapter.skipped?.(active,active.context);save();}
      const callback=continueAction;continueAction=null;active.context=null;root.classList.remove('is-open');root.setAttribute('aria-hidden','true');adapter.overlayChanged?.(false,root);active=null;
      if(typeof callback==='function')setTimeout(callback,80);
    }
    function handleClick(event){
      const attend=event.target.closest('[data-pc-attend]');if(attend){active.status='ACTIVE';active.startedAt=Date.now();save();render('question');return;}
      if(event.target.closest('[data-pc-skip]')){finish(true);return;}
      if(event.target.closest('[data-pc-leave]')){finish(true);return;}
      const answerButton=event.target.closest('[data-pc-answer]');if(answerButton){root.querySelectorAll('[data-pc-answer]').forEach(b=>{b.disabled=true;b.classList.toggle('is-selected',b===answerButton);});answer(answerButton.dataset.pcAnswer);return;}
      if(event.target.closest('[data-pc-next]')){next();return;}
      if(event.target.closest('[data-pc-finish]')){finish(false);}
    }
    function open(stage,fixture,onContinue,label='CONTINUE'){
      const context=adapter.context?.(stage,fixture);if(!context){onContinue?.();return false;}
      context.stage=stage;context.fixtureId=context.fixtureId||fixture?.fixtureId||'fixture';
      const key=sessionKey(stage,context.fixtureId),stored=adapter.getSession?.(key);
      if(stored&&['COMPLETED','SKIPPED','LEFT_EARLY'].includes(stored.status)){onContinue?.();return false;}
      active=stored&&Array.isArray(stored.questions)?stored:createSession(context);active.context=context;active.key=key;active.awaitingNext=false;
      continueAction=onContinue;continueLabel=label||'CONTINUE';ensureRoot();root.classList.add('is-open');root.setAttribute('aria-hidden','false');save();render(active.status==='INVITED'?'intro':'question');
      return true;
    }
    function close(){finish(true);}
    return{open,close,isOpen:()=>!!active,activeSession:()=>active};
  }

  window.VelmoraPressConferences={create};
})();
