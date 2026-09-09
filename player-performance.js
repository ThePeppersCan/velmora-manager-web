/* V71: one deterministic player-performance model shared by quick sim and watched matches. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.VelmoraPerformance=api;})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  const ATTRIBUTES=Object.freeze(['PAC','SHO','PAS','HAN','DEF','STA']);
  const ROLE_WEIGHTS=Object.freeze({
    ATTACKER:Object.freeze({PAC:.18,SHO:.36,PAS:.10,HAN:.18,DEF:.05,STA:.13}),
    PLAYMAKER:Object.freeze({PAC:.10,SHO:.08,PAS:.34,HAN:.22,DEF:.09,STA:.17}),
    DEFENDER:Object.freeze({PAC:.10,SHO:.04,PAS:.11,HAN:.18,DEF:.39,STA:.18}),
    'ALL-ROUNDER':Object.freeze({PAC:.15,SHO:.15,PAS:.18,HAN:.18,DEF:.18,STA:.16})
  });
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const number=(v,fallback=0)=>v!==null&&v!==''&&Number.isFinite(Number(v))?Number(v):fallback;
  const roleKey=role=>Object.prototype.hasOwnProperty.call(ROLE_WEIGHTS,String(role||'').toUpperCase())?String(role).toUpperCase():'ALL-ROUNDER';
  const stat=(player,key,resolver)=>clamp(number(resolver?resolver(player,key):player?.stats?.[key],number(player?.ovr,60)),0,99);

  function roleRating(player,role=player?.role,resolver){
    const weights=ROLE_WEIGHTS[roleKey(role)];
    return ATTRIBUTES.reduce((sum,key)=>sum+stat(player,key,resolver)*weights[key],0);
  }
  function roleSuitability(familiarity=100,primary=false){
    if(primary||number(familiarity,0)>=100)return 1;
    const f=clamp(number(familiarity,0),0,99),points=[[0,.78],[20,.81],[35,.84],[50,.89],[65,.93],[75,.96],[85,.985],[90,.995],[99,.999]];
    for(let i=1;i<points.length;i++)if(f<=points[i][0]){const [x0,y0]=points[i-1],[x1,y1]=points[i],t=(f-x0)/(x1-x0);return Number((y0+(y1-y0)*t).toFixed(3));}
    return .999;
  }
  function effectiveRating(rating,modifier=1){
    const n=clamp(number(rating,60),0,99),fit=clamp(number(modifier,1),.72,1);
    return clamp(n-Math.max(10,n-50)*(1-fit),0,99);
  }
  function performanceOverall(player,role=player?.role,modifier=1,resolver){
    const displayed=clamp(number(player?.ovr,roleRating(player,role,resolver)),0,99),specialist=roleRating(player,role,resolver);
    return effectiveRating(displayed*.72+specialist*.28,modifier);
  }
  function calibrateStats(stats,overall,role){
    const source={stats:{...stats},ovr:overall},offset=roleRating(source,role)-number(overall,60),out={};
    for(const key of ATTRIBUTES)out[key]=clamp(Math.round(number(stats?.[key],overall)-offset),30,94);
    return out;
  }

  function engineStat(value,base=60){return clamp(.70+((clamp(number(value,base),30,99)-40)/59)*.285,.65,.985);}
  function formModifier(form){return number(({Excellent:.018,Good:.009,Average:0,'New Signing':.004,Poor:-.012,Terrible:-.022})[form],0);}
  function moraleModifier(morale){
    // A positive but smaller boost at the top prevents permanently maxed morale from
    // outperforming the focused "Happy" sweet spot.
    return number(({'Very Happy':.005,Happy:.009,Content:0,Unhappy:-.010,'Very Unhappy':-.020,Excellent:.005,Good:.009,Okay:0,Poor:-.010,Bad:-.020})[morale],0);
  }
  function sharpnessModifier(sharpness=70){return clamp((number(sharpness,70)-70)*.0006,-.035,.018);}
  function applyRoleSuitability(attributes,modifier=1){
    const out={...attributes},fit=clamp(number(modifier,1),.72,1),technical=.90+fit*.10;
    for(const key of ['passing','catching','shooting','interception','turn'])if(Number.isFinite(out[key]))out[key]=clamp(.65+(out[key]-.65)*technical,.60,.99);
    for(const key of ['awareness','positioning','anticipation','decision','composure','reaction'])if(Number.isFinite(out[key]))out[key]=clamp(.65+(out[key]-.65)*fit,.60,.99);
    return out;
  }
  function engineAttributes(player={},options={}){
    const st=player.stats||{},ov=engineStat(player.ovr,65),form=formModifier(player.form),morale=moraleModifier(player.morale),fitness=clamp(number(player.fitness,82),45,100),sharpness=number(options.sharpness,number(player.sharpness,70));
    const tune=(value,extra=0)=>clamp(value+form+morale+extra,.60,.99),ready=value=>tune(value,sharpnessModifier(sharpness));
    const base={
      speed:tune(engineStat(st.PAC,player.ovr)),accel:tune(engineStat(st.PAC,player.ovr),.006),turn:tune((engineStat(st.PAS,player.ovr)+engineStat(st.HAN,player.ovr)+ov)/3),
      passing:ready(engineStat(st.PAS,player.ovr)),catching:ready(engineStat(st.HAN,player.ovr)),shooting:ready(engineStat(st.SHO,player.ovr)),interception:ready(engineStat(st.DEF,player.ovr)),
      awareness:ready((engineStat(st.DEF,player.ovr)+engineStat(st.PAS,player.ovr)+ov)/3),positioning:ready((engineStat(st.DEF,player.ovr)+ov)/2),reaction:ready((engineStat(st.PAC,player.ovr)+engineStat(st.HAN,player.ovr)+ov)/3),
      anticipation:ready((engineStat(st.DEF,player.ovr)+engineStat(st.PAS,player.ovr))/2),decision:ready((engineStat(st.PAS,player.ovr)+ov)/2),composure:ready((engineStat(st.HAN,player.ovr)+ov)/2),aggression:tune(.82),
      stamina:tune(engineStat(st.STA,player.ovr),(fitness-82)/900),recovery:tune(engineStat(st.STA,player.ovr),(fitness-82)/950)
    };
    return applyRoleSuitability(base,options.roleModifier??1);
  }

  function teamProfile(players=[],options={}){
    if(!players.length)return{attackDelta:0,defenceDelta:0,creationDelta:0,coverage:{attack:0,playmaking:0,defence:0},overall:60};
    const getRole=options.role||((p)=>p.role),getModifier=options.modifier||(()=>1),resolver=options.stat;
    let attack=0,defence=0,creation=0,overall=0;const coverage={attack:0,playmaking:0,defence:0};
    for(const p of players){const role=roleKey(getRole(p)),fit=clamp(number(getModifier(p,role),1),.72,1),s=key=>effectiveRating(stat(p,key,resolver),fit),ovr=performanceOverall(p,role,fit,resolver);
      attack+=s('SHO')*.38+s('PAS')*.20+s('HAN')*.18+s('PAC')*.13+s('STA')*.08+s('DEF')*.03;
      defence+=s('DEF')*.43+s('HAN')*.18+s('STA')*.16+s('PAC')*.10+s('PAS')*.10+s('SHO')*.03;
      creation+=s('PAS')*.40+s('HAN')*.22+s('PAC')*.12+s('STA')*.12+s('DEF')*.08+s('SHO')*.06;overall+=ovr;
      if(role==='ATTACKER')coverage.attack+=fit;else if(role==='PLAYMAKER')coverage.playmaking+=fit;else if(role==='DEFENDER')coverage.defence+=fit;else{coverage.attack+=.55*fit;coverage.playmaking+=.55*fit;coverage.defence+=.55*fit;}
    }
    const n=players.length,avgOverall=overall/n,attackSkill=attack/n,defenceSkill=defence/n,creationSkill=creation/n;
    const missing=(key)=>Math.max(0,1-Math.min(1,coverage[key]));
    return{
      attackDelta:(attackSkill-avgOverall)*.52+(creationSkill-avgOverall)*.16-missing('attack')*2.8-missing('playmaking')*2.1,
      defenceDelta:(defenceSkill-avgOverall)*.60-missing('defence')*5.0-missing('playmaking')*.7,
      creationDelta:(creationSkill-avgOverall)*.55-missing('playmaking')*3.2,
      coverage,overall:avgOverall,attack:attackSkill,defence:defenceSkill,creation:creationSkill
    };
  }
  return Object.freeze({ATTRIBUTES,ROLE_WEIGHTS,roleKey,roleRating,roleSuitability,effectiveRating,performanceOverall,calibrateStats,engineStat,formModifier,moraleModifier,sharpnessModifier,applyRoleSuitability,engineAttributes,teamProfile});
});
