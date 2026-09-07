/* V23: deterministic readiness rules shared by the career clock and forecasts. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.VelmoraTraining=api;})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  const plans=Object.freeze({
    recovery:Object.freeze({name:'Recovery',fitness:3,sharpness:-2,copy:'Restore fitness quickly; sharpness eases.'}),
    balanced:Object.freeze({name:'Balanced',fitness:0,sharpness:-.5,copy:'Steady recovery; sharpness drifts down slowly.'}),
    drills:Object.freeze({name:'Match Drills',fitness:-4,sharpness:4,copy:'Build sharpness at the expense of recovery.'}),
    intensive:Object.freeze({name:'Intensive',fitness:-6,sharpness:7,copy:'Fast sharpness gains; fitness will fall.'})
  });
  const isPlan=key=>Object.prototype.hasOwnProperty.call(plans,key);
  const number=(value,fallback)=>value!==null&&value!==''&&Number.isFinite(Number(value))?Number(value):fallback;
  const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));
  const round=v=>Math.round(clamp(v)*10)/10;
  const validDate=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d));
  const addDays=(d,n)=>{const t=new Date(d+'T12:00:00Z');t.setUTCDate(t.getUTCDate()+n);return t.toISOString().slice(0,10)};
  const daysBetween=(a,b)=>Math.round((Date.parse(b+'T12:00:00Z')-Date.parse(a+'T12:00:00Z'))/86400000);
  function preferences(value={}){return {automatic:value?.automatic===true,targetFitness:clamp(Math.round(number(value?.targetFitness,85)/5)*5,75,95),targetSharpness:clamp(Math.round(number(value?.targetSharpness,75)/5)*5,60,90)};}
  function read(player={}){
    const old=player.training&&typeof player.training==='object'?player.training:{};
    return {...old,version:1,mode:old.mode==='manual'?'manual':'team',plan:isPlan(old.plan)?old.plan:'balanced',lastDate:validDate(old.lastDate)?old.lastDate:null,lastMatchId:typeof old.lastMatchId==='string'?old.lastMatchId:null,sharpness:round(number(player.sharpness,70))};
  }
  function ensure(player){const r=read(player);player.sharpness=r.sharpness;delete r.sharpness;player.training=r;return player;}
  const medical=p=>!!p?.injured||number(p?.injuryDaysRemaining,0)>0;
  const suspended=p=>!!p?.suspended||number(p?.suspensionMatches,0)>0;
  function automaticPlan(player,options={}){
    const prefs=preferences(options.preferences),fitness=number(player.fitness,85),sharpness=read(player).sharpness,days=number(options.daysToMatch,99);
    if(medical(player))return 'medical';
    if(days<=0)return 'matchday';
    if(fitness<prefs.targetFitness||fitness<60)return 'recovery';
    if(days<=1)return sharpness<prefs.targetSharpness&&fitness>=prefs.targetFitness+5?'balanced':'recovery';
    if(sharpness<prefs.targetSharpness){
      if(days>=4&&fitness>=Math.max(90,prefs.targetFitness+5)&&sharpness<prefs.targetSharpness-10)return 'intensive';
      return fitness>=prefs.targetFitness+3?'drills':'balanced';
    }
    return 'balanced';
  }
  function effectivePlan(player,options={}){
    if(medical(player))return 'medical';
    if(number(options.daysToMatch,99)<=0)return 'matchday';
    const own=read(player),prefs=preferences(options.preferences);
    const automatic=options.ai===true||(prefs.automatic&&own.mode!=='manual');
    let selected=automatic?automaticPlan(player,options):own.plan;
    if(number(player.fitness,85)<60&&['drills','intensive'].includes(selected))selected='recovery';
    return selected;
  }
  function step(player,date,options={}){
    const state=read(player),fitness=clamp(number(player.fitness,85));
    if(state.lastDate&&state.lastDate>=date)return {applied:false,fitness,sharpness:state.sharpness,plan:state.lastPlan||effectivePlan(player,options)};
    const plan=effectivePlan(player,options),base=clamp(number(options.baseRecovery,3.5),0,12);
    const fitnessGain=plan==='medical'?0:plan==='matchday'?Math.min(base,3):base+plans[plan].fitness;
    const sharpnessGain=plan==='medical'?-2:plan==='matchday'?0:plans[plan].sharpness;
    return {applied:true,date,plan,fitness:round(fitness+fitnessGain),sharpness:round(state.sharpness+sharpnessGain)};
  }
  function applyDay(player,date,options={}){
    const out=step(player,date,options);ensure(player);
    if(out.applied){player.fitness=out.fitness;player.sharpness=out.sharpness;player.training.lastDate=date;player.training.lastPlan=out.plan;}
    return out;
  }
  function applyMatch(player,fixtureId,date,minutes){
    ensure(player);if(player.training.lastMatchId===String(fixtureId))return false;
    const played=clamp(number(minutes,0),0,90);
    player.sharpness=round(player.sharpness+(played>0?3+9*played/90:-1));
    player.training.lastMatchId=String(fixtureId);
    if(played>0){player.training.lastAppearanceDate=date;player.training.lastMinutes=played;}
    return true;
  }
  function project(player,today,targetDate,options={}){
    const copy={...player,training:{...read(player)}};ensure(copy);
    const days=validDate(targetDate)?Math.max(0,daysBetween(today,targetDate)):7;
    const horizon=Math.min(days,365),timeline=[];
    for(let i=1;i<=horizon;i++){
      const date=addDays(today,i),medicalDay=medical(copy),daysToMatch=targetDate?days-i:99;
      const baseRecovery=typeof options.recoveryForDate==='function'?options.recoveryForDate(date):3.5;
      const out=applyDay(copy,date,{...options,daysToMatch,baseRecovery});
      if(medicalDay&&number(copy.injuryDaysRemaining,0)>0){copy.injuryDaysRemaining=Math.max(0,number(copy.injuryDaysRemaining,0)-1);if(copy.injuryDaysRemaining===0)copy.injured=false;}
      timeline.push({...out,date,injured:medical(copy)});
    }
    return {player:copy,fitness:clamp(number(copy.fitness,85)),sharpness:read(copy).sharpness,timeline,days:horizon,limited:days>365,available:!medical(copy)&&!suspended(copy)};
  }
  function matchModifier(player){return clamp((read(player).sharpness-70)/20,-3.5,1.5);}
  function technicalModifier(player){return clamp((read(player).sharpness-70)*.0006,-.035,.018);}
  function status(player){
    if(medical(player))return {key:'medical',label:'Medical recovery',tone:'muted'};
    if(suspended(player))return {key:'suspended',label:'Suspended',tone:'muted'};
    if(number(player.fitness,85)<65)return {key:'tired',label:'Needs recovery',tone:'bad'};
    if(number(player.fitness,85)<80)return {key:'manage',label:'Manage minutes',tone:'warn'};
    if(read(player).sharpness<60)return {key:'rusty',label:'Short of sharpness',tone:'warn'};
    return {key:'ready',label:'Match ready',tone:'good'};
  }
  function recommendation(player,forecast,{starter=false,bench=false,alternative=null}={}){
    const p=forecast.player,fit=forecast.fitness,sharp=forecast.sharpness;
    if(medical(p))return {title:'Continue medical recovery',copy:'Expected to remain unavailable. Review the medical update before selection.'};
    if(suspended(p))return {title:'Train through the suspension',copy:'Training can continue, but this player is unavailable for the next match.'};
    if(fit<65)return {title:'Rest this player',copy:`Projected fitness is ${Math.round(fit)}%.${alternative?' Consider '+alternative.name+' as an alternative.':' Prioritise recovery before selecting them.'}`};
    if(fit<80)return {title:starter?'Consider rotating the starter':'Limit match minutes',copy:`Projected fitness is ${Math.round(fit)}%.${alternative?' '+alternative.name+' is a fitter option in a compatible role.':' Keep a fresh substitute available.'}`};
    if(sharp<60)return {title:'Build sharpness gradually',copy:`Fitness is sufficient, but sharpness is ${Math.round(sharp)}%. Use match drills and consider controlled substitute minutes.`};
    if(starter)return {title:'Ready to start',copy:`Projected ${Math.round(fit)}% fitness and ${Math.round(sharp)}% sharpness support the current selection.`};
    return {title:bench?'Ready for substitute minutes':'Consider for the matchday squad',copy:`Projected ${Math.round(fit)}% fitness and ${Math.round(sharp)}% sharpness offer a rotation option. Review role and ability alongside readiness.`};
  }
  return Object.freeze({plans,preferences,read,ensure,medical,suspended,effectivePlan,automaticPlan,step,applyDay,applyMatch,project,matchModifier,technicalModifier,status,recommendation,addDays,daysBetween});
});
