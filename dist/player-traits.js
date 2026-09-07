/* Velmora playing traits. Shared by career simulation, recruitment and the live engine.
 * Stored once on each player; presentation never changes base ratings or personality. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.VelmoraTraits=api;})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const icons={
    link:'M5 9h8m-3-3 3 3-3 3M19 15h-8m3-3-3 3 3 3',
    turn:'M5 17V9a5 5 0 0 1 10 0v5m-3-3 3 3 3-3',
    burst:'m13 3-8 11h6l-1 7 9-12h-6z',
    wing:'M4 18 20 5l-5 14-5-4-6 3Zm6-3 10-10',
    grip:'M6 11V8a2 2 0 0 1 4 0v3-5a2 2 0 0 1 4 0v5-3a2 2 0 0 1 4 0v7c0 4-3 6-6 6s-6-2-6-5l-2-3a2 2 0 0 1 2-2Z',
    shield:'M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Zm-4 9 3 3 5-6',
    eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
    arc:'M4 19C4 4 16 2 20 9m-5-1 5 1-1-5M15 18h6m-3-3v6',
    star:'m12 3 3 6 6 1-4 5 1 6-6-3-6 3 1-6-4-5 6-1Z',
    captain:'m12 3 2 4 4 1-3 3 1 4-4-2-4 2 1-4-3-3 4-1ZM5 17l7 4 7-4',
    rally:'M4 10v5h4l9 5V5l-9 5H4Zm4 5 2 6m10-12 2-2m-2 9 2 2',
    clock:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v5l4 2',
    wind:'M3 8h12a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h7',
    anchor:'M12 3v16M8 7h8M4 12c0 5 4 9 8 9s8-4 8-9M4 12l-2 3m18-3 2 3',
    diamond:'m12 3 8 9-8 9-8-9 8-9Zm-8 9h16M12 3l3 9-3 9-3-9 3-9'
  };
  const defs=[
    ['quick_link','Quick Link','Combination','link','Crisper short passes and a preference for quick combinations.',{PAS:3},{passing:.015},'short'],
    ['give_go','Give-and-Go','Combination','link','Releases the ball, then accelerates into a new passing lane.',{PAS:2,PAC:2},{anticipation:.012},'return'],
    ['threader','Thread the Gap','Combination','eye','Finds passing lanes through pressure.',{PAS:3},{passing:.018,decision:.015}],
    ['switcher','Crosswind Passer','Combination','arc','Executes ambitious long passes with greater control.',{PAS:3},{passing:.012},'longpass'],
    ['close_control','Close Control','Carrying','diamond','Protects possession while carrying through close pressure.',{HAN:3},{catching:.015,composure:.012},'carry'],
    ['tight_turner','Tight Turner','Carrying','turn','Changes direction sharply while carrying the ball.',{HAN:2,PAC:1},{turn:.032},'carry'],
    ['glider','Silk Glider','Carrying','wing','Carries into open space with fluid, controlled movement.',{HAN:2,PAC:2},{turn:.016,catching:.010},'carry'],
    ['burst','Burst Flyer','Movement','burst','Explosive acceleration from a slow start.',{PAC:3},{accel:.032},'burst'],
    ['slipstream','Slipstream Runner','Movement','wing','Faster supporting runs when a teammate has possession.',{PAC:3},{anticipation:.012},'run'],
    ['relentless','Relentless Mover','Movement','wind','Sustains movement with improved stamina and recovery.',{STA:4},{stamina:.024,recovery:.020}],
    ['power','Power Carrier','Strength','shield','Holds possession more securely when challenged.',{HAN:3},{catching:.017,composure:.010},'carry'],
    ['safe_hands','Safe Hands','Handling','grip','More reliable receiving and collecting loose balls.',{HAN:4},{catching:.028,reaction:.010}],
    ['quick_release','Quick Release','Combination','burst','Releases passes sooner under pressure.',{PAS:2,HAN:1},{decision:.018},'release'],
    ['lane_reader','Lane Reader','Defending','eye','Anticipates passing lanes and moves into interception positions.',{DEF:3},{anticipation:.024,positioning:.012}],
    ['interceptor','Interceptor','Defending','shield','Greater precision when contesting a pass.',{DEF:4},{interception:.026}],
    ['anchor','Defensive Anchor','Defending','anchor','Holds a disciplined position and reacts to nearby threats.',{DEF:3},{positioning:.022,awareness:.016}],
    ['long_arc','Long Arc','Finishing','arc','More precise hoop attempts from longer range.',{SHO:3},{shooting:.008},'range'],
    ['hoop_artist','Hoop Artist','Finishing','star','Greater accuracy when an opening appears near the hoops.',{SHO:3},{shooting:.012},'finish'],
    ['cool_head','Cool Head','Composure','diamond','Calmer decisions and execution under pressure.',{PAS:1,SHO:1},{composure:.027,decision:.010}],
    ['second_wind','Second Wind','Endurance','wind','Conserves energy and recovers better late in the match.',{STA:3},{},'late'],
    ['captain_voice',"Captain’s Voice",'Leadership','captain','A small composure lift for teammates while this player is on the field.',{PAS:1,DEF:1},{composure:.010},'leader'],
    ['rally','Rallying Presence','Leadership','rally','Helps teammates keep their composure when the team is behind.',{STA:1,PAS:1},{decision:.010},'rally'],
    ['veteran','Veteran Instinct','Experience','clock','Experienced anticipation and decision-making in tight situations.',{PAS:2,DEF:2},{anticipation:.018,decision:.020},'experienced'],
    ['game_reader','Game Reader','Experience','eye','Reads developing threats with an experienced, measured approach.',{DEF:2,PAS:2},{awareness:.020,positioning:.014},'experienced']
  ].map(([id,name,category,icon,description,stats,attributes,condition])=>Object.freeze({id,name,category,icon,description,stats,attributes,condition}));
  // Rules use actual gameplay data. Appearance/species are deliberately never inputs.
  const rules={
    quick_link:{group:'passing',rarity:'UNCOMMON',needs:{PAS:53,HAN:46},skills:{PAS:.7,HAN:.3},roles:['PLAYMAKER'],temperament:'professionalism'},
    give_go:{group:'passing',rarity:'COMMON',needs:{PAS:48,PAC:47},skills:{PAS:.55,PAC:.45},roles:['PLAYMAKER','ATTACKER']},
    threader:{group:'passing',rarity:'UNCOMMON',needs:{PAS:56},skills:{PAS:.85,HAN:.15},roles:['PLAYMAKER']},
    switcher:{group:'passing',rarity:'UNCOMMON',needs:{PAS:56},skills:{PAS:.85,DEF:.15},roles:['PLAYMAKER','DEFENDER']},
    close_control:{group:'carrying',rarity:'UNCOMMON',needs:{HAN:55,PAS:46},skills:{HAN:.7,PAS:.3},roles:['PLAYMAKER','ATTACKER'],physical:'agility'},
    tight_turner:{group:'carrying',rarity:'UNCOMMON',needs:{HAN:53,PAS:48},skills:{HAN:.6,PAS:.4},roles:['PLAYMAKER','ATTACKER'],physical:'agility'},
    glider:{group:'carrying',rarity:'RARE',needs:{HAN:60,PAC:53,PAS:50},skills:{HAN:.6,PAS:.25,PAC:.15},roles:['PLAYMAKER','ATTACKER'],physical:'agility'},
    burst:{group:'movement',rarity:'COMMON',needs:{PAC:56},skills:{PAC:1},roles:['ATTACKER'],physical:'acceleration'},
    slipstream:{group:'movement',rarity:'COMMON',needs:{PAC:53},skills:{PAC:.8,PAS:.2},roles:['ATTACKER','PLAYMAKER']},
    relentless:{group:'endurance',rarity:'COMMON',needs:{STA:53},skills:{STA:1},roles:['DEFENDER','ALL-ROUNDER'],temperament:'professionalism'},
    power:{group:'handling',rarity:'COMMON',needs:{HAN:51},skills:{HAN:.8,STA:.2},roles:['ATTACKER','DEFENDER'],physical:'strength'},
    safe_hands:{group:'handling',rarity:'COMMON',needs:{HAN:53},skills:{HAN:1},roles:['DEFENDER','PLAYMAKER']},
    quick_release:{group:'passing',rarity:'UNCOMMON',needs:{PAS:51,HAN:48},skills:{PAS:.65,HAN:.35},roles:['PLAYMAKER']},
    lane_reader:{group:'defending',rarity:'UNCOMMON',needs:{DEF:54,PAS:44},skills:{DEF:.65,PAS:.35},roles:['DEFENDER']},
    interceptor:{group:'defending',rarity:'COMMON',needs:{DEF:53},skills:{DEF:1},roles:['DEFENDER']},
    anchor:{group:'defending',rarity:'COMMON',needs:{DEF:55,STA:47},skills:{DEF:.8,STA:.2},roles:['DEFENDER'],temperament:'temperament'},
    long_arc:{group:'finishing',rarity:'UNCOMMON',needs:{SHO:55},skills:{SHO:.85,HAN:.15},roles:['ATTACKER']},
    hoop_artist:{group:'finishing',rarity:'RARE',needs:{SHO:60,HAN:50},skills:{SHO:.8,HAN:.2},roles:['ATTACKER']},
    cool_head:{group:'composure',rarity:'UNCOMMON',needs:{},skills:{PAS:.5,HAN:.5},roles:[],temperament:'temperament',minTemperament:65},
    second_wind:{group:'endurance',rarity:'UNCOMMON',needs:{STA:52},skills:{STA:1},roles:[],temperament:'professionalism'},
    captain_voice:{group:'leadership',rarity:'RARE',needs:{},skills:{PAS:.5,DEF:.5},roles:[],minAge:23,minLeadership:68,temperament:'leadership'},
    rally:{group:'leadership',rarity:'UNCOMMON',needs:{},skills:{STA:.5,PAS:.5},roles:[],minAge:23,minLeadership:62,temperament:'leadership'},
    veteran:{group:'experience',rarity:'UNCOMMON',needs:{},skills:{PAS:.5,DEF:.5},roles:[],minAge:28,experience:true,temperament:'professionalism'},
    game_reader:{group:'experience',rarity:'RARE',needs:{PAS:50,DEF:50},skills:{DEF:.6,PAS:.4},roles:['DEFENDER','PLAYMAKER'],minAge:28,experience:true,temperament:'temperament'}
  };
  const catalog=Object.freeze(defs.map(t=>Object.freeze({...t,...rules[t.id]}))),byId=new Map(catalog.map(d=>[d.id,d]));
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function hash(s){let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}h^=h>>>16;h=Math.imul(h,0x85ebca6b);h^=h>>>13;h=Math.imul(h,0xc2b2ae35);return (h^(h>>>16))>>>0;}
  function rngFor(token){let n=hash(token);return()=>{n+=0x6d2b79f5;let t=n;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
  function rating(p,key){return clamp(Number(p.stats?.[key]??p.ovr??p.lastOvr??50)||0,0,99);}
  function historyRows(p,context={}){return context.history||p.careerHistory?.seasons||[];}
  function experience(p,context={}){const rows=historyRows(p,context);return Math.max(Number(p.careerApps||p.careerAppearances||0),rows.reduce((n,r)=>n+Number(r.apps||0),0)+(rows.some(r=>r.seasonId===context.seasonId)?0:Number(p.seasonStats?.apps||0)));}
  function personality(p,key){return clamp(Number(p.storyTraits?.[key]??50),0,100);}
  function eligible(p,t,context={}){
    const age=Number(p.age||p.retiredAge||18);
    if(age<(t.minAge||0)||Object.entries(t.needs).some(([k,min])=>rating(p,k)<min))return false;
    if(t.minLeadership&&personality(p,'leadership')<t.minLeadership)return false;
    if(t.minTemperament&&personality(p,'temperament')<t.minTemperament)return false;
    // Mature generated players can have prior experience; earned traits require tracked achievements.
    if(t.experience&&experience(p,context)<80&&age<30)return false;
    const physical=p.physicalProfile||p.physical||{};
    if(t.physical&&Number.isFinite(Number(physical[t.physical]))&&Number(physical[t.physical])<42)return false;
    return true;
  }
  function weight(p,id,context={},chosen=[]){
    const t=byId.get(id);if(!t||!eligible(p,t,context))return 0;
    const selected=chosen.map(id=>byId.get(id)).filter(Boolean),same=selected.filter(x=>x.group===t.group).length;
    if(same>=2||t.rarity==='RARE'&&selected.some(x=>x.rarity==='RARE'))return 0;
    const score=Object.entries(t.skills).reduce((n,[k,w])=>n+rating(p,k)*w,0),avg=['PAC','SHO','PAS','HAN','DEF','STA'].reduce((n,k)=>n+rating(p,k),0)/6;
    let w=({COMMON:1,UNCOMMON:.58,RARE:.14}[t.rarity])*clamp(.65+(score-avg)/9+(score-50)/65,.08,3.5);
    if(t.roles.includes(p.role))w*=2.1;
    else if(t.roles.length){const secondary=(Array.isArray(p.secondaryRoles)?p.secondaryRoles:[]).map(r=>typeof r==='string'?r:r.role);w*=secondary.some(r=>t.roles.includes(r))?1.25:.65;}
    if(t.group==='defending'&&p.role==='ATTACKER'&&rating(p,'DEF')<rating(p,'SHO')-6)w*=.18;
    if(t.group==='finishing'&&p.role==='DEFENDER'&&rating(p,'SHO')<rating(p,'DEF')-6)w*=.18;
    if(t.temperament)w*=clamp(.5+personality(p,t.temperament)/100,.55,1.5);
    if(['leadership','experience','composure'].includes(t.group))w*=clamp(.65+(Number(p.age||p.retiredAge||18)-20)/12,.35,1.8);
    if(t.group==='leadership'&&p.captain)w*=1.35;
    if(context.tactics?.attacking==='Possession'&&t.group==='passing')w*=1.12;
    if(context.tactics?.attacking==='Fast Break'&&t.group==='movement')w*=1.12;
    const physical=p.physicalProfile||p.physical||{};
    if(t.physical&&Number.isFinite(Number(physical[t.physical])))w*=clamp(Number(physical[t.physical])/65,.5,1.5);
    // Broad compatibility groups favor complementary identities without fixed archetype bundles.
    if(selected.some(x=>x.group==='finishing')&&t.group==='defending'||selected.some(x=>x.group==='defending')&&t.group==='finishing')w*=.35;
    if(same)w*=.65;
    if(selected.some(x=>['passing','carrying'].includes(x.group))&&['passing','carrying','movement'].includes(t.group))w*=1.15;
    return w;
  }
  function distribution(p){
    const high=clamp((Number(p.potential||p.ovr||p.lastOvr||50)-84)/8,0,1);
    const normal=[.35,.40,.20,.05,0],talented=[.15,.40,.30,.12,.03],weights=normal.map((n,i)=>n+(talented[i]-n)*high);
    if(Number(p.age||p.retiredAge||25)<21){weights[0]+=.03;weights[2]-=.02;weights[3]-=.01;}
    const vals=['PAC','SHO','PAS','HAN','DEF','STA'].map(k=>rating(p,k));
    if(Math.max(...vals)-Math.min(...vals)>=20){weights[0]-=.015;weights[1]+=.015;}
    return weights;
  }
  function pick(p,pool,random,context,chosen){
    const rows=pool.filter(id=>!chosen.includes(id)).map(id=>({id,w:weight(p,id,context,chosen)})).filter(r=>r.w>0),total=rows.reduce((n,r)=>n+r.w,0);if(!total)return null;
    let roll=random()*total;for(const row of rows){roll-=row.w;if(roll<0)return row.id;}return rows.at(-1).id;
  }
  function ensure(p,seed=0,context={}){
    if(!p)return [];
    if(p.playingTraitsVersion>=2&&Array.isArray(p.playingTraits))return p.playingTraits;
    const previous=Array.isArray(p.playingTraits)?[...p.playingTraits]:null,random=rngFor(`${seed}:traits-v2:${p.id||p.name}`),weights=distribution(p);
    let roll=random(),count=weights.length-1;for(let i=0;i<weights.length;i++){roll-=weights[i];if(roll<0){count=i;break;}}
    const proven=(previous||[]).filter(id=>byId.has(id)&&['DEVELOPED','CAREER_EARNED'].includes(p.playingTraitOrigins?.[id]?.source)).slice(0,4),chosen=[...proven];
    for(let i=chosen.length;i<count;i++){const id=pick(p,catalog.map(t=>t.id),random,context,chosen);if(!id)break;chosen.push(id);}
    const origins={};for(const id of chosen)origins[id]=p.playingTraitOrigins?.[id]||{source:'NATURAL',seasonId:context.seasonId||null,date:context.date||null,reason:'Natural playing tendency'};
    p.playingTraits=chosen;p.playingTraitOrigins=origins;p.playingTraitsVersion=2;
    p.playingTraitProgress=p.playingTraitProgress||{firstSeason:Number(context.seasonNumber||1),lastReview:0,lastAward:0,earned:0,observed:{},captainSeasons:0,trackedApps:0};
    if(previous)p.playingTraitMigration={version:2,previous,assigned:[...chosen],seasonId:context.seasonId||null};
    return p.playingTraits;
  }
  function observeMatch(p,seed,context){
    ensure(p,seed,context);if(!context.competitive||Number(context.minutes||0)<=0)return;
    const state=p.playingTraitProgress,season=String(context.seasonId),row=state.observed[season]||(state.observed[season]={apps:0,captainApps:0,importantApps:0,fixtures:[]});
    if(row.fixtures.includes(context.fixtureId))return;
    row.fixtures.push(context.fixtureId);row.apps++;if(context.captain)row.captainApps++;if(context.important)row.importantApps++;
  }
  function observeRating(p,seed,context){
    ensure(p,seed,context);if(!context.competitive||!context.important||!Number.isFinite(Number(context.rating)))return;
    const state=p.playingTraitProgress,season=String(context.seasonId),row=state.observed[season]||(state.observed[season]={apps:0,captainApps:0,importantApps:0,fixtures:[]});
    row.importantRatings=row.importantRatings||{};row.importantRatings[context.fixtureId]=Number(context.rating);
  }
  function review(p,seed,context={}){
    ensure(p,seed,context);const state=p.playingTraitProgress,season=Number(context.seasonNumber||0);
    if(!season||state.lastReview>=season)return null;
    state.lastReview=season;
    const observed=state.observed[context.seasonId]||{apps:0,captainApps:0,importantApps:0},apps=Number(p.seasonStats?.apps||0);
    if(observed.captainApps>=16)state.captainSeasons++;
    state.trackedApps+=observed.apps;
    state.observed={}; // Summaries persist; per-fixture deduplication is needed only this season.
    if(p.academy||p.retiringAtEnd||p.status==='RETIRED'||p.playingTraits.length>=4||state.earned>=2||season-state.firstSeason<1||state.lastAward&&season-state.lastAward<3)return null;
    const age=Number(p.age||0),xp=experience(p,context),pool=[];
    const add=(id,source,reason,chance)=>{if(!p.playingTraits.includes(id)&&weight(p,id,context,p.playingTraits)>0)pool.push({id,source,reason,chance});};
    if(state.captainSeasons>=3&&xp>=80&&age>=24)add('captain_voice','CAREER_EARNED','At least three substantial seasons of captaincy',.20);
    if(state.captainSeasons>=2&&xp>=70&&observed.captainApps>=16)add('rally','CAREER_EARNED','Sustained captaincy and an influential squad presence',.10);
    if(age>=30&&xp>=160&&state.trackedApps>=45&&personality(p,'professionalism')>=75)add('veteran','CAREER_EARNED','An experienced career backed by sustained professional appearances',.10);
    if(age>=28&&xp>=120&&state.trackedApps>=45&&personality(p,'temperament')>=70)add('game_reader','CAREER_EARNED','Several seasons of experienced, measured play',.06);
    const importantRatings=Object.values(observed.importantRatings||{}),strongImportant=importantRatings.filter(r=>r>=7.3).length;
    if(observed.importantApps>=4&&strongImportant>=4&&apps>=18&&personality(p,'temperament')>=70)add('cool_head','CAREER_EARNED','Repeated strong performances in high-pressure competitive matches',.06);
    const growth=Number(p.careerGrowthThisSeason||0),plan=p.developmentPlan||'Balanced';
    if(growth>=3&&apps>=18&&personality(p,'professionalism')>=70){
      const ids={Playmaking:['quick_link','quick_release','close_control'],Attacking:['slipstream','long_arc'],Defensive:['lane_reader','safe_hands'],Physical:['relentless','tight_turner'],Balanced:['safe_hands','give_go']}[plan]||[];
      for(const id of ids)add(id,'DEVELOPED','A sustained development breakthrough backed by competitive appearances',.045);
    }
    if(!pool.length)return null;
    const random=rngFor(`${seed}:trait-review:${p.id}:${context.seasonId}`),roll=random(),available=pool.filter(x=>roll<x.chance);
    if(!available.length)return null;
    const id=pick(p,available.map(x=>x.id),random,context,p.playingTraits);if(!id)return null;
    const chosen=pool.find(x=>x.id===id),record={id,source:chosen.source,reason:chosen.reason,seasonId:context.seasonId,date:context.date||null};
    p.playingTraits.push(id);p.playingTraitOrigins[id]=record;p.playingTraitHistory=[...(p.playingTraitHistory||[]),record];state.earned++;state.lastAward=season;
    return record;
  }
  const hints={passing:'Shows a preference for quick, considered distribution.',carrying:'Appears comfortable carrying the quaffle through pressure.',movement:'Scout notes purposeful movement into open space.',handling:'Shows signs of reliable control when receiving the quaffle.',defending:'Appears alert to developing defensive threats.',finishing:'Shows a distinctive approach when attacking the hoops.',endurance:'Appears able to sustain a demanding work rate.',composure:'Has shown a measured response to pressure.',leadership:'Shows signs of an influential presence among teammates.',experience:'Seems to read developing situations with experience.'};
  function scoutHints(p,knowledge){
    if(Number(knowledge)<35||Number(knowledge)>=100)return [];
    const groups=[...new Set(traits(p).map(t=>t.group))];
    if(!groups.length)return ['The report has not yet established a distinctive playing tendency.'];
    return groups.slice(0,Number(knowledge)>=70?2:1).map(g=>hints[g]+' Provisional observation.');
  }
  function traits(p){return (Array.isArray(p)?p:p?.playingTraits||[]).map(id=>byId.get(id)).filter(Boolean);}
  function effects(p,context={}){
    const mods={},add=(k,n)=>mods[k]=(mods[k]||0)+n;
    for(const t of traits(p)){
      for(const [k,v]of Object.entries(t.attributes))add(k,v);
      switch(t.condition){
        case 'short':if(context.passDistance!=null&&context.passDistance<.27)add('passing',.026);add('passBias',.065);break;
        case 'return':if(context.returnRun){add('accel',.025);add('speed',.017);}add('passBias',.035);break;
        case 'longpass':if(context.passDistance>.27)add('passing',.027);break;
        case 'carry':if(context.carrying){add('turn',.018);add('catching',.012);add('driveBias',.055);}break;
        case 'burst':if(context.speed<.09)add('accel',.030);break;
        case 'run':if(context.supporting)add('speed',.026);break;
        case 'release':add('passBias',.030);if(context.pressure<.14){add('passing',.020);add('decision',.018);}break;
        case 'range':if(context.progress<.65)add('shooting',.026);break;
        case 'finish':if(context.progress>=.65)add('shooting',.023);break;
        case 'late':if(context.minute>=60){add('stamina',.060);add('recovery',.050);add('energySaving',.12);}break;
      }
    }
    for(const k of Object.keys(mods))mods[k]=Math.min(mods[k],k==='passBias'||k==='driveBias'?.12:k==='energySaving'?.15:.065);
    return mods;
  }
  function attributes(base,p,context={}){const out={...base},mods=effects(p,context);for(const k of Object.keys(base))if(typeof base[k]==='number')out[k]=clamp(base[k]+(mods[k]||0),0,.995);return out;}
  // Quick/normal simulations average the very same situational model used by the live engine.
  // Situations represent a match mix, not additional flat bonuses or changes to saved ratings.
  function expectedEffects(p){
    const out={},situations=[
      [.4,{passDistance:.18,pressure:.1,returnRun:true,speed:.07,progress:.7,minute:20}],
      [.25,{passDistance:.4,pressure:.3,supporting:true,speed:.16,progress:.5,minute:45}],
      [.35,{carrying:true,speed:.12,pressure:.12,progress:.7,minute:75}]
    ];
    for(const [share,context] of situations)for(const [key,value] of Object.entries(effects(p,context)))out[key]=(out[key]||0)+share*value;
    return out;
  }
  function stat(p,key){
    const mods=expectedEffects(p),weights={PAC:{speed:.5,accel:.35,turn:.15},SHO:{shooting:.9,composure:.1},PAS:{passing:.7,decision:.2,anticipation:.1,passBias:.1},HAN:{catching:.7,turn:.2,composure:.1,driveBias:.07},DEF:{interception:.4,anticipation:.2,awareness:.2,positioning:.2},STA:{stamina:.8,recovery:.2}};
    return Math.min(6,100*Object.entries(weights[key]||{}).reduce((sum,[attr,w])=>sum+(mods[attr]||0)*w,0));
  }
  function energyMultiplier(p){const mods=expectedEffects(p);return 1-Math.min(.15,(mods.energySaving||0)+(mods.stamina||0)*.35+(mods.recovery||0)*.15);}
  function aura(players,behind=false){let lift=0;for(const p of players){const ids=Array.isArray(p)?p:p?.playingTraits||[];if(ids.includes('captain_voice'))lift=Math.max(lift,.012);if(behind&&ids.includes('rally'))lift=Math.max(lift,.018);}return lift;}
  function icon(id){const d=byId.get(id);return `<svg viewBox="0 0 32 36" aria-hidden="true"><path class="trait-hex" d="M16 1 31 9v18l-15 8-15-8V9Z"/><g transform="translate(4 6)" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="${icons[d?.icon]||icons.star}"/></g></svg>`;}
  return Object.freeze({catalog,ensure,traits,effects,attributes,stat,aura,icon,distribution,weight,eligible,observeMatch,observeRating,review,scoutHints,expectedEffects,energyMultiplier});
});
