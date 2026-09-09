/* ============================================================
   VELMORA MANAGER — LIVE QUIDDITCH ENGINE V22.1 AUDIO
   Adapted from the proven Repo Sports V2 broadcast/simulation engine.
   Career squads, player attributes, manager tactics and fixture state are
   injected at runtime. Quick Sim / Sim Match remain separate and untouched.
   ============================================================ */
(() => {
  if (window.__velmoraQuidditchEngineV21Installed) return;
  window.__velmoraQuidditchEngineV21Installed = true;

  const BASE = 'assets/world-cup-game-v1/';
  const VELMORA_QUAFFLE_ASSET='assets/quidditch-engine/ball/velmora-quaffle.png?v=quaffle-1';
  // Visible alpha bounds of the original supplied PNG; the source artwork is unchanged.
  const VELMORA_QUAFFLE_FRAME={x:105,y:73,width:1055,height:1074};
  const W = 1672, H = 941;
  const INTRO_SECONDS = 30;
  const POST_MATCH_SECONDS = 30;
  const LIVE_TEMPO = 1.18;
  const BROADCAST_DEBUG = false;
  const PREMATCH_ANTHEM = 'assets/repo-sports-v2/prematch-dark-drums-test43.mp3';
  const KICKOFF_RELEASE_SFX = 'assets/repo-sports-v2/kickoff-ball-release-test43.mp3';
  const MATCH_MUSIC = BASE+'match-music.mp3';
  const MATCH_MUSIC_ALT = BASE+'loop.mp3';
  const MATCH_MUSIC_THIRD = BASE+'eternal-throne.mp3';
  const MATCH_MUSIC_FOURTH = BASE+'music-3.mp3';
  const PLAYER_RIDE_HEIGHT = 113.4, PLAYER_STAND_HEIGHT = 90.3;
  // V38.6 — standing artwork is not uniformly trimmed/oriented.
  // visible-bottom ratios are generated from each supplied PNG's alpha bounds.
  const STANDING_VISIBLE_BOTTOM = Object.freeze({besquelcher:1,jenny:1,nimbler2000:1,pipsqueak:1,rocky:1,soup:1});
  const STANDING_PLAYER_SOURCE_FACING = Object.freeze({besquelcher:-1,jenny:-1,nimbler2000:-1,pipsqueak:-1,rocky:-1,soup:-1});
  const REF_FLY_HEIGHT = 100.0, REF_STAND_HEIGHT = 90.3;
  const PLAYER_SCALE = {besquelcher:1.06,jenny:0.97,nimbler2000:0.68,pipsqueak:0.92,rocky:0.76,soup:0.75};
  const HALF_SECONDS = 90;
  const MATCH_SECONDS = 4 * 60 + 30;
  let MATCH_CHANNEL = 'repo-world-cup-belros-zafran-v1';
  const REFEREE_FULL_NAME = 'William Whistleworth';
  const REFEREE_LABEL = 'Whistleworth';
  const $ = id => document.getElementById(id);
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  const lerp = (a,b,t) => a + (b-a)*t;
  const ease = t => 1 - Math.pow(1-clamp(t,0,1),3);
  const other = team => team === 'belros' ? 'zafran' : 'belros';

  // Flight envelope. HARD bounds are emergency containment only; AI targets live
  // inside SOFT bounds so riders turn before they ever grind along a screen edge.
  const FLIGHT = {hardX0:.065,hardX1:.935,softX0:.105,softX1:.895,hardY0:.205,hardY1:.820,softY0:.235,softY1:.790,wallLook:.112,bottomLook:.072};
  // Continuous-flow tuning: riders should almost never look parked in open play.
  const FLOW = {minCruise:.054,arrivalRadius:.044,hoverTrigger:.30,escapeImpulse:.090,driftX:.006,driftY:.010,clusterRadius:.088,ringRadius:.118,ringHoverTrigger:.10};
  // Both teams use identical rules. Career quality is preserved; teams are not
  // normalised to equal strength and no winner is selected in advance.
  const FAIRNESS = Object.freeze({
    teamWinBias:0,            // never choose or weight a winner before play
    rubberBand:false,         // scoreline may change tactics, never execution odds
    scriptedGoals:false,      // every goal must emerge from the live ball/shot path
    attributeCompression:.55, // legacy exhibition tuning; career mode uses full attributes
    closeContestVariance:.055, // small symmetric uncertainty for genuinely close races
    spatialSideBias:false       // raw left/right screen position never boosts finishing
  });

  const FLOW_DEBUG = false;
  const FLOW_PHASES = Object.freeze({
    RESTART:'restart',BUILDUP:'buildUp',CIRCULATION:'circulation',PROBING:'probing',ATTACKING:'attacking',FINAL_THIRD:'finalThird',
    SHOT_SEQUENCE:'shotSequence',DEFENSIVE_PRESSURE:'defensivePressure',TURNOVER:'turnover',COUNTER:'counterAttack',SCRAMBLE:'scramble',RECOVERY:'recovery',STOPPAGE:'stoppage'
  });
  const FLOW_TEMPLATES = [
    {id:'patient-build',label:'Patient buildup',phases:['buildUp','circulation','probing','attacking'],tempo:'slow',weight:1.25},
    {id:'switch-play',label:'Switch play',phases:['buildUp','circulation','probing','attacking'],tempo:'normal',weight:1.05},
    {id:'quick-combination',label:'Quick combination',phases:['probing','attacking','finalThird'],tempo:'fast',weight:.95},
    {id:'solo-progression',label:'Solo progression',phases:['buildUp','probing','attacking'],tempo:'normal',weight:.80},
    {id:'counter-attack',label:'Counterattack',phases:['turnover','counterAttack','attacking'],tempo:'fast',weight:.88},
    {id:'scrappy-attack',label:'Scrappy attack',phases:['scramble','recovery','attacking'],tempo:'normal',weight:.52},
    {id:'quiet-spell',label:'Quiet spell',phases:['buildUp','circulation','circulation','probing'],tempo:'slow',weight:.60}
  ];
  function executionSkill(attributes,key,baseline=.86){
    const raw=Number(attributes?.[key]??baseline);
    return clamp(baseline+(raw-baseline)*(state.careerMode?1:FAIRNESS.attributeCompression),state.careerMode?.60:.68,state.careerMode?.99:.97);
  }
  function fairNoise(amount=FAIRNESS.closeContestVariance){return ((state.simRand?.()||Math.random())-.5)*amount}
  const TEAM_STYLE = {
    belros:{name:'STRUCTURED',width:1.00,depth:1.00,tempo:1.00,press:1.00,directness:.50},
    zafran:{name:'FLUID',width:1.00,depth:1.00,tempo:1.00,press:1.00,directness:.50}
  };

  // V2 club tactical identities. These alter movement shape, support runs and
  // decision flavour only. They never modify shot conversion, tackle success,
  // pass execution, player attributes, RNG strength, or any team win bias.
  const CLUB_TACTICAL_PROFILES = Object.freeze([
    Object.freeze({id:'PATIENT',name:'PATIENT POSSESSION',short:'patient possession',width:1.08,runnerDepth:.94,supportDepth:.88,supportWidth:1.06,passBias:.020,directness:-.22,fluid:false,defCompact:1.00,comment:'are slowing the game down and building with patient support around the Quaffle.'}),
    Object.freeze({id:'PRESS',name:'HIGH PRESS',short:'an aggressive press',width:.96,runnerDepth:1.02,supportDepth:.96,supportWidth:.92,passBias:0,directness:.02,fluid:false,defCompact:.91,comment:'are squeezing the pitch when they lose it, then resetting quickly into shape.'}),
    Object.freeze({id:'COUNTER',name:'QUICK COUNTER',short:'quick transitions',width:1.04,runnerDepth:1.13,supportDepth:1.01,supportWidth:1.02,passBias:-.012,directness:.20,fluid:false,defCompact:1.02,comment:'want to spring forward quickly after turnovers, with the runner attacking space.'}),
    Object.freeze({id:'WIDE',name:'WIDE OVERLOADS',short:'wide overloads',width:1.17,runnerDepth:1.00,supportDepth:.96,supportWidth:1.20,passBias:.012,directness:-.02,fluid:false,defCompact:1.04,comment:'are stretching the pitch and trying to create lanes with wide support.'}),
    Object.freeze({id:'DIRECT',name:'VERTICAL ATTACK',short:'vertical attacking',width:.95,runnerDepth:1.14,supportDepth:1.02,supportWidth:.94,passBias:-.020,directness:.26,fluid:false,defCompact:.99,comment:'are looking forward early, carrying into space before the defence can settle.'}),
    Object.freeze({id:'FLUID',name:'FLUID ROTATION',short:'fluid rotations',width:1.07,runnerDepth:1.04,supportDepth:.96,supportWidth:1.08,passBias:.004,directness:.03,fluid:true,defCompact:1.00,comment:'are rotating positions around the carrier instead of holding fixed lanes.'}),
    Object.freeze({id:'COMPACT',name:'COMPACT CONTROL',short:'compact control',width:.91,runnerDepth:.98,supportDepth:.90,supportWidth:.86,passBias:.018,directness:-.14,fluid:false,defCompact:.88,comment:'are keeping the three-player unit compact and offering short passing options.'})
  ]);
  function clubTacticalProfile(name){
    const key=String(name||'REPO SPORTS').trim().toUpperCase().replace(/\s+/g,' ');
    const idx=hashSeed(`REPO_SPORTS_CLUB_TACTIC|${key}`)%CLUB_TACTICAL_PROFILES.length;
    return CLUB_TACTICAL_PROFILES[idx];
  }
  function tacticalProfileForTeam(team){return state.teamTactics?.[team]?.profile||clubTacticalProfile(teamMeta?.[team]?.name||team)}
  function tacticalAdjustmentForTeam(team){return state.teamTactics?.[team]?.adjustment||{id:'BASE',width:1,runner:1,support:1,press:1,passBias:0,label:'same approach'}}
  function tacticalDescriptor(team){const p=tacticalProfileForTeam(team),a=tacticalAdjustmentForTeam(team);return a.id&&a.id!=='BASE'?`${p.name} · ${a.label.toUpperCase()}`:p.name}
  const TACTIC_STATES = ['BUILDUP','ATTACK','FINAL_ATTACK','DEFENSIVE','PRESSING','COUNTERATTACK','RECOVERY','RESTART','GOAL_CELEBRATION','HALFTIME'];
  // Player animation/physicality sits on top of the simulation. Higher-priority
  // actions temporarily own the pose, then hand control back to locomotion.
  const ANIM_PRIORITY = {IDLE:0,MOVING:1,MICRO_REACTION:1,ACCELERATING:2,DECELERATING:2,TURNING:3,RETURNING_TO_POSITION:4,RECOVERING:4,ENCOURAGING:5,RECEIVING:5,PASSING:6,INTERCEPTING:7,REACTING_TO_SAVE:7,REACTING_TO_MISS:7,REACTING_TO_GOAL:7,SHOOTING:8,SAVING:8,KEEPER_CELEBRATING:8,KEEPER_FRUSTRATED:8,FOUL_REACTION:8,ARGUING:8,VAR_REACTION:8,DISAPPOINTED:8,HALFTIME:9,FULLTIME:9,CELEBRATING:10};
  const REACTION_DEBUG = false;
  const signatureCelebrations = Object.freeze({Pipsqueak:null,Bijou:null,ROCKY:null,JUD:null});
  const PERSONALITY_DEBUG = false;
  const DEFAULT_PERSONALITY = Object.freeze({
    archetype:'calm',celebrationStyle:'controlled',reactionStyle:'balanced',idleStyle:'calm',teammateStyle:'supportive',movementFlavour:'smooth',
    confidenceStyle:'steady',signatureCelebration:null,signatureIdle:null,signatureReaction:null,quirk:null
  });
  const PLAYER_PERSONALITIES = Object.freeze({
    'pipsqueak':{archetype:'energetic',celebrationStyle:'expressive',reactionStyle:'expressive',idleStyle:'restless',teammateStyle:'social',movementFlavour:'light',confidenceStyle:'bold',signatureCelebration:'broom-spin',signatureIdle:'doubleBounce',quirk:'crowdTurn'},
    'veyri':{archetype:'calm',celebrationStyle:'controlled',reactionStyle:'stoic',idleStyle:'calm',teammateStyle:'supportive',movementFlavour:'graceful',confidenceStyle:'steady'},
    'miska':{archetype:'proud',celebrationStyle:'confident',reactionStyle:'serious',idleStyle:'alert',teammateStyle:'independent',movementFlavour:'sharp',confidenceStyle:'bold',signatureCelebration:'point-sky'},
    'bijou':{archetype:'playful',celebrationStyle:'playful',reactionStyle:'cheerful',idleStyle:'playful',teammateStyle:'social',movementFlavour:'floaty',confidenceStyle:'bright',signatureCelebration:'shoulder-bump'},
    'mimi':{archetype:'dramatic',celebrationStyle:'dramatic',reactionStyle:'expressive',idleStyle:'alert',teammateStyle:'social',movementFlavour:'graceful',confidenceStyle:'bold',signatureCelebration:'arms-wide-glide'},
    'loulou':{archetype:'laid-back',celebrationStyle:'controlled',reactionStyle:'calm',idleStyle:'calm',teammateStyle:'supportive',movementFlavour:'relaxed',confidenceStyle:'steady'},
    'brakka':{archetype:'serious',celebrationStyle:'powerful',reactionStyle:'stoic',idleStyle:'alert',teammateStyle:'serious',movementFlavour:'heavy',confidenceStyle:'steady'},
    'kovo':{archetype:'mischievous',celebrationStyle:'playful',reactionStyle:'quick',idleStyle:'restless',teammateStyle:'playful',movementFlavour:'sharp',confidenceStyle:'bold',signatureCelebration:'finger-wag'},
    'daska':{archetype:'calm',celebrationStyle:'controlled',reactionStyle:'stoic',idleStyle:'calm',teammateStyle:'supportive',movementFlavour:'smooth',confidenceStyle:'steady'},
    'mad rager':{archetype:'dramatic',celebrationStyle:'powerful',reactionStyle:'expressive',idleStyle:'restless',teammateStyle:'independent',movementFlavour:'heavy',confidenceStyle:'bold',signatureCelebration:'air-punch-combo'},
    'zuzu':{archetype:'cheerful',celebrationStyle:'energetic',reactionStyle:'cheerful',idleStyle:'playful',teammateStyle:'social',movementFlavour:'light',confidenceStyle:'bright'},
    'kemba':{archetype:'serious',celebrationStyle:'controlled',reactionStyle:'serious',idleStyle:'alert',teammateStyle:'supportive',movementFlavour:'sharp',confidenceStyle:'steady'},
    'rocky':{archetype:'confident',celebrationStyle:'powerful',reactionStyle:'bold',idleStyle:'alert',teammateStyle:'social',movementFlavour:'heavy',confidenceStyle:'bold',signatureCelebration:'chest-thump'},
    'frey':{archetype:'stoic',celebrationStyle:'controlled',reactionStyle:'stoic',idleStyle:'calm',teammateStyle:'serious',movementFlavour:'smooth',confidenceStyle:'steady'},
    'noki':{archetype:'eccentric',celebrationStyle:'playful',reactionStyle:'unusual',idleStyle:'playful',teammateStyle:'playful',movementFlavour:'twitchy',confidenceStyle:'bright',signatureCelebration:'barrel-roll'},
    'zizi':{archetype:'mischievous',celebrationStyle:'playful',reactionStyle:'quick',idleStyle:'restless',teammateStyle:'social',movementFlavour:'light',confidenceStyle:'bold',signatureCelebration:'sharp-uturn'},
    'rafi':{archetype:'calm',celebrationStyle:'controlled',reactionStyle:'stoic',idleStyle:'calm',teammateStyle:'supportive',movementFlavour:'smooth',confidenceStyle:'steady'},
    'saffi':{archetype:'proud',celebrationStyle:'graceful',reactionStyle:'serious',idleStyle:'alert',teammateStyle:'social',movementFlavour:'graceful',confidenceStyle:'steady',signatureCelebration:'bow-crowd'},
    'fenn':{archetype:'laid-back',celebrationStyle:'controlled',reactionStyle:'calm',idleStyle:'calm',teammateStyle:'supportive',movementFlavour:'floaty',confidenceStyle:'steady'},
    'elvi':{archetype:'energetic',celebrationStyle:'energetic',reactionStyle:'expressive',idleStyle:'restless',teammateStyle:'social',movementFlavour:'light',confidenceStyle:'bright'},
    'mori':{archetype:'serious',celebrationStyle:'controlled',reactionStyle:'stoic',idleStyle:'alert',teammateStyle:'independent',movementFlavour:'sharp',confidenceStyle:'steady'},
    'qimi':{archetype:'eccentric',celebrationStyle:'playful',reactionStyle:'unusual',idleStyle:'playful',teammateStyle:'social',movementFlavour:'floaty',confidenceStyle:'bright',signatureCelebration:'hands-off-glide'},
    'nuri':{archetype:'calm',celebrationStyle:'controlled',reactionStyle:'calm',idleStyle:'calm',teammateStyle:'supportive',movementFlavour:'smooth',confidenceStyle:'steady'},
    'zara':{archetype:'confident',celebrationStyle:'confident',reactionStyle:'bold',idleStyle:'alert',teammateStyle:'independent',movementFlavour:'graceful',confidenceStyle:'bold',signatureCelebration:'salute'},
    'luca':{archetype:'cheerful',celebrationStyle:'energetic',reactionStyle:'cheerful',idleStyle:'restless',teammateStyle:'social',movementFlavour:'light',confidenceStyle:'bright'},
    'pico':{archetype:'mischievous',celebrationStyle:'playful',reactionStyle:'quick',idleStyle:'playful',teammateStyle:'playful',movementFlavour:'twitchy',confidenceStyle:'bold'},
    'vivi':{archetype:'calm',celebrationStyle:'graceful',reactionStyle:'calm',idleStyle:'calm',teammateStyle:'supportive',movementFlavour:'graceful',confidenceStyle:'steady'},
    'volki':{archetype:'serious',celebrationStyle:'powerful',reactionStyle:'stoic',idleStyle:'alert',teammateStyle:'serious',movementFlavour:'heavy',confidenceStyle:'steady'},
    'varko':{archetype:'confident',celebrationStyle:'confident',reactionStyle:'bold',idleStyle:'alert',teammateStyle:'independent',movementFlavour:'sharp',confidenceStyle:'bold',signatureCelebration:'opponent-staredown'},
    'rovo':{archetype:'laid-back',celebrationStyle:'controlled',reactionStyle:'calm',idleStyle:'calm',teammateStyle:'supportive',movementFlavour:'relaxed',confidenceStyle:'steady'},
    'soup':{archetype:'eccentric',celebrationStyle:'playful',reactionStyle:'cheerful',idleStyle:'playful',teammateStyle:'social',movementFlavour:'floaty',confidenceStyle:'bright',signatureCelebration:'small-broom-lift'},
    'tuli':{archetype:'calm',celebrationStyle:'controlled',reactionStyle:'stoic',idleStyle:'calm',teammateStyle:'supportive',movementFlavour:'smooth',confidenceStyle:'steady'},
    'lumi':{archetype:'energetic',celebrationStyle:'energetic',reactionStyle:'expressive',idleStyle:'restless',teammateStyle:'social',movementFlavour:'light',confidenceStyle:'bright'},
    'dopey dom':{archetype:'playful',celebrationStyle:'playful',reactionStyle:'unusual',idleStyle:'playful',teammateStyle:'social',movementFlavour:'floaty',confidenceStyle:'bright',signatureCelebration:'celebration-chase'},
    'zippy':{archetype:'energetic',celebrationStyle:'energetic',reactionStyle:'quick',idleStyle:'restless',teammateStyle:'independent',movementFlavour:'sharp',confidenceStyle:'bold',signatureCelebration:'broom-spin'},
    'drazzi':{archetype:'dramatic',celebrationStyle:'dramatic',reactionStyle:'expressive',idleStyle:'alert',teammateStyle:'social',movementFlavour:'graceful',confidenceStyle:'bold'},
    'jud':{archetype:'stoic',celebrationStyle:'controlled',reactionStyle:'stoic',idleStyle:'calm',teammateStyle:'serious',movementFlavour:'heavy',confidenceStyle:'steady',signatureCelebration:'salute'},
    'nimbler 2000':{archetype:'mischievous',celebrationStyle:'energetic',reactionStyle:'expressive',idleStyle:'restless',teammateStyle:'playful',movementFlavour:'twitchy',confidenceStyle:'bold',signatureCelebration:'barrel-roll'},
    'bramble':{archetype:'cheerful',celebrationStyle:'controlled',reactionStyle:'supportive',idleStyle:'calm',teammateStyle:'social',movementFlavour:'heavy',confidenceStyle:'steady'},
    'maro':{archetype:'proud',celebrationStyle:'confident',reactionStyle:'serious',idleStyle:'alert',teammateStyle:'independent',movementFlavour:'graceful',confidenceStyle:'bold'},
    'navi':{archetype:'playful',celebrationStyle:'playful',reactionStyle:'cheerful',idleStyle:'playful',teammateStyle:'social',movementFlavour:'light',confidenceStyle:'bright'},
    'rumi':{archetype:'calm',celebrationStyle:'controlled',reactionStyle:'calm',idleStyle:'calm',teammateStyle:'supportive',movementFlavour:'smooth',confidenceStyle:'steady'},
    'debbie':{archetype:'confident',celebrationStyle:'confident',reactionStyle:'bold',idleStyle:'alert',teammateStyle:'social',movementFlavour:'sharp',confidenceStyle:'bold'},
    'jenny':{archetype:'cheerful',celebrationStyle:'energetic',reactionStyle:'cheerful',idleStyle:'restless',teammateStyle:'social',movementFlavour:'light',confidenceStyle:'bright'},
    'rosie':{archetype:'laid-back',celebrationStyle:'controlled',reactionStyle:'calm',idleStyle:'calm',teammateStyle:'supportive',movementFlavour:'relaxed',confidenceStyle:'steady'},
    'besquelcher':{archetype:'eccentric',celebrationStyle:'dramatic',reactionStyle:'unusual',idleStyle:'playful',teammateStyle:'independent',movementFlavour:'heavy',confidenceStyle:'bold',signatureCelebration:'stand-on-broom'},
    'kassi':{archetype:'serious',celebrationStyle:'controlled',reactionStyle:'stoic',idleStyle:'alert',teammateStyle:'supportive',movementFlavour:'sharp',confidenceStyle:'steady'},
    'arko':{archetype:'energetic',celebrationStyle:'energetic',reactionStyle:'expressive',idleStyle:'restless',teammateStyle:'social',movementFlavour:'light',confidenceStyle:'bright'}
  });
  function personalityKey(name){return String(name||'').trim().toLowerCase()}
  function getPlayerPersonality(playerOrName){
    const name=typeof playerOrName==='string'?playerOrName:playerOrName?.player?.name||playerOrName?.name;
    return {...DEFAULT_PERSONALITY,...(PLAYER_PERSONALITIES[personalityKey(name)]||{})};
  }
  window.RepoSportsPlayerPersonalities=PLAYER_PERSONALITIES;
  window.getRepoSportsPlayerPersonality=name=>getPlayerPersonality(name);
    function personalityRecent(e,event){e.personalityHistory||(e.personalityHistory={});return e.personalityHistory[event]||(e.personalityHistory[event]=[])}
  function personalityChoice(e,event,pool,preferred=[]){
    if(!pool?.length)return null;const recent=personalityRecent(e,event),fresh=pool.filter(x=>!recent.includes(x)),base=fresh.length?fresh:pool;
    const weighted=[];for(const x of base){weighted.push(x);if(preferred.includes(x)){weighted.push(x,x)}}
    const choice=weighted[Math.floor(visualRandom()*weighted.length)]||base[0];recent.push(choice);while(recent.length>2)recent.shift();
    if(PERSONALITY_DEBUG)console.log('[PERSONALITY]',e?.player?.name||'Unknown',event,getPlayerPersonality(e).archetype,choice);
    return choice;
  }
  function personalityReaction(e,event,pool){
    const p=getPlayerPersonality(e);let preferred=[];
    if(event==='miss')preferred=p.reactionStyle==='stoic'?['headShake','lookAtHoop']:p.reactionStyle==='expressive'?['dropShoulders','smallSpin','lookUp']:p.reactionStyle==='quick'?['headShake','lookAtHoop']:[];
    else if(event==='keeperSave')preferred=p.archetype==='confident'||p.archetype==='energetic'?['fistRaise','smallBounce']:p.archetype==='calm'||p.archetype==='stoic'?['secureBall','pointDefenders']:[];
    else if(event==='interceptWin')preferred=p.archetype==='confident'||p.archetype==='energetic'?['smallPump','turnUpfield']:p.archetype==='stoic'||p.archetype==='calm'?['quickNod','turnUpfield']:[];
    else if(event==='concede')preferred=p.reactionStyle==='stoic'?['lookKeeper','turnHome']:p.reactionStyle==='expressive'?['headShake','dropShoulders']:[];
    else if(event==='foulOffender')preferred=p.archetype==='dramatic'||p.archetype==='confident'?['protest','raiseArm']:['turnOpponent'];
    else if(event==='foulVictim')preferred=p.reactionStyle==='expressive'?['wobble','lookOpponent']:['recoverBalance','lookOpponent'];
    return personalityChoice(e,event,pool,preferred);
  }
  function personalityCelebrationPreferences(e){
    const p=getPlayerPersonality(e),map={
      energetic:['air-punch-combo','broom-spin','celebration-chase','quick-bounce','arms-wide-glide'],expressive:['arms-wide-glide','air-punch-combo','point-crowd','celebration-chase'],
      playful:['broom-spin','barrel-roll','shoulder-bump','circle-scorer','finger-wag'],dramatic:['arms-wide-glide','bow-crowd','point-crowd','opponent-staredown'],
      confident:['salute','point-sky','opponent-staredown','hands-off-glide'],powerful:['air-punch-combo','shoulder-bump','arms-wide-glide'],
      graceful:['bow-crowd','hands-off-glide','side-by-side'],controlled:['salute','point-sky','side-by-side','mini-huddle']
    };return map[p.celebrationStyle]||map[p.archetype]||[];
  }
  function personalityPoseFlavour(e,pose,t,standing=false){
    if(!e?.player||!pose)return pose;const p=getPlayerPersonality(e),active=['PASSING','SHOOTING','INTERCEPTING','SAVING','RECEIVING'].includes(e.animState);
    // Sprite-only flavour. Never changes x/y targets, velocity, collision, tackle, shot or save mechanics.
    const scale=active?.35:1,ph=e.idlePhase||0;
    if(p.movementFlavour==='floaty'){pose.bob+=Math.sin(t*2.2+ph)*.55*scale;pose.rot+=Math.sin(t*1.7+ph)*.006*scale}
    else if(p.movementFlavour==='light'){pose.bob+=Math.sin(t*3.1+ph)*.40*scale;pose.rot+=Math.sin(t*2.6+ph)*.008*scale}
    else if(p.movementFlavour==='heavy'){pose.bob+=Math.sin(t*1.7+ph)*.18*scale;pose.rot*=.88}
    else if(p.movementFlavour==='twitchy'&&!active){pose.rot+=Math.sin(t*5.2+ph)*.009;pose.oy+=Math.sin(t*4.4+ph)*.25}
    else if(p.movementFlavour==='graceful'){pose.rot+=Math.sin(t*1.9+ph)*.005*scale;pose.bob+=Math.sin(t*2.0+ph)*.24*scale}
    else if(p.movementFlavour==='relaxed'){pose.bob+=Math.sin(t*1.55+ph)*.20*scale}
    return pose;
  }
  const safeX = x => clamp(x,FLIGHT.softX0,FLIGHT.softX1);
  const safeY = y => clamp(y,FLIGHT.softY0,FLIGHT.softY1);
  const dist2 = (a,b) => Math.hypot((a?.x||0)-(b?.x||0),(a?.y||0)-(b?.y||0));
  const currentName = () => { try { return String(window.character?.username || character?.username || 'Guest'); } catch (_) { return 'Guest'; } };
  const isHost = () => true;

  function hashSeed(text){
    let h=2166136261>>>0;
    for(let i=0;i<String(text).length;i++){h^=String(text).charCodeAt(i);h=Math.imul(h,16777619)}
    return h>>>0;
  }
  function mulberry32(seed){return function(){let t=seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}

  const V2_PLAYERS = {
    besquelcher:{id:'besquelcher',name:'BESQUELCHER',role:'attacker',risk:1,standing:'assets/repo-sports-v2/players/besquelcher-standing.png',riding:'assets/repo-sports-v2/players/besquelcher-riding.png',short:'Repo Sports V2 test player',lore:[]},
    jenny:{id:'jenny',name:'JENNY',role:'defender',risk:1,standing:'assets/repo-sports-v2/players/jenny-standing.png',riding:'assets/repo-sports-v2/players/jenny-riding.png',short:'Repo Sports V2 test player',lore:[]},
    nimbler2000:{id:'nimbler2000',name:'NIMBLER 2000',role:'support',risk:1,standing:'assets/repo-sports-v2/players/nimbler2000-standing.png',riding:'assets/repo-sports-v2/players/nimbler2000-riding.png',short:'Repo Sports V2 test player',lore:[]},
    pipsqueak:{id:'pipsqueak',name:'PIPSQUEAK',role:'attacker',risk:1,standing:'assets/repo-sports-v2/players/pipsqueak-standing.png',riding:'assets/repo-sports-v2/players/pipsqueak-riding.png',short:'Repo Sports V2 test player',lore:[]},
    rocky:{id:'rocky',name:'ROCKY',role:'defender',risk:1,standing:'assets/repo-sports-v2/players/rocky-standing.png',riding:'assets/repo-sports-v2/players/rocky-riding.png',short:'Repo Sports V2 test player',lore:[]},
    soup:{id:'soup',name:'SOUP',role:'support',risk:1,standing:'assets/repo-sports-v2/players/soup-standing.png',riding:'assets/repo-sports-v2/players/soup-riding.png',short:'Repo Sports V2 test player',lore:[]}
  };
  const V2_PLAYER_OWNERS=Object.freeze({
    besquelcher:'CatAsthma',
    jenny:'Proco',
    nimbler2000:'CovidPanda',
    pipsqueak:'kat',
    rocky:'SmokedRope1028',
    soup:'Emlux'
  });
  const TEST_LINEUPS = [
    {home:['besquelcher','jenny','nimbler2000'],away:['pipsqueak','rocky','soup']},
    {home:['pipsqueak','jenny','nimbler2000'],away:['besquelcher','rocky','soup']},
    {home:['besquelcher','rocky','nimbler2000'],away:['pipsqueak','jenny','soup']},
    {home:['besquelcher','jenny','soup'],away:['pipsqueak','rocky','nimbler2000']},
    {home:['pipsqueak','rocky','nimbler2000'],away:['besquelcher','jenny','soup']},
    {home:['pipsqueak','jenny','soup'],away:['besquelcher','rocky','nimbler2000']}
  ];
  let roster = {belros:TEST_LINEUPS[0].home.map(id=>V2_PLAYERS[id]),zafran:TEST_LINEUPS[0].away.map(id=>V2_PLAYERS[id])};
  let allPlayers=[...roster.belros,...roster.zafran];let byId=Object.fromEntries(allPlayers.map(p=>[p.id,p]));
  const V2_LEAGUE_TEAMS=['Hrafnvik','Blackglass','Saint Ciro','Marenza','Grand Khor','Aurelia','Drazh Hollow','Rova End','Zafir Row','Talun Cross','Ossa Mere','Varka Fell','Iskara','Naskor','Ashwick','Skarholt','Orsanne','Cinderbank'];
  const CLUB_FLAG_ROOT='assets/repo-sports-v2/club-flags/';
  const CLUB_FLAG_FILES={
    'HRAFNVIK':'hrafnvik.png',
    'BLACKGLASS':'blackglass.png',
    'SAINT CIRO':'saint-ciro.png',
    'MARENZA':'marenza.png',
    'GRAND KHOR':'grand-khor.png',
    'AURELIA':'aurelia.png',
    'DRAZH HOLLOW':'drazh-hollow.png',
    'ROVA END':'rova-end.png',
    'ZAFIR ROW':'zafir-row.png',
    'TALUN CROSS':'talun-cross.png',
    'OSSA MERE':'ossa-mere.png',
    'VARKA FELL':'varka-fell.png',
    'ISKARA':'iskara.png',
    'NASKOR':'naskor.png',
    'ASHWICK':'ashwick.png',
    'SKARHOLT':'skarholt.png',
    'ORSANNE':'orsanne.png',
    'CINDERBANK':'cinderbank.png'
  };
  function normaliseClubName(name){return String(name||'').trim().replace(/\s+/g,' ').toUpperCase()}
  function flagForTeamName(name){const key=normaliseClubName(name);return CLUB_FLAG_FILES[key]?`${CLUB_FLAG_ROOT}${CLUB_FLAG_FILES[key]}`:'assets/repo-sports-logo.png'}
  function abbrForTeamName(name){const parts=normaliseClubName(name).split(/[^A-Z0-9]+/).filter(Boolean);if(!parts.length)return 'CLB';if(parts.length===1)return parts[0].slice(0,3);if(parts.length===2)return `${parts[0][0]}${parts[1].slice(0,2)}`.slice(0,3);return parts.slice(0,3).map(p=>p[0]).join('').slice(0,3)}
  // Must be created after the flag table above; otherwise flagForTeamName()
  // reads CLUB_FLAG_FILES while that const is still in its temporal dead zone.
  const TEAM_INFO={home:{name:'HRAFNVIK',abbr:'HRA',flag:flagForTeamName('Hrafnvik')},away:{name:'BLACKGLASS',abbr:'BLK',flag:flagForTeamName('Blackglass')}};
  const FIXTURE_CONFIGS={
    'torre-piccola':{id:'torre-piccola',home:'home',away:'away',venue:'TORRE PICCOLA POPOLARE ARENA',arena:'assets/quidditch-engine/arenas/torre-piccola-popolare-arena.webp',groundY:.805,floorY:.904,hoops:{left:[{x:.082,y:.752},{x:.105,y:.686},{x:.132,y:.752}],right:[{x:.868,y:.752},{x:.895,y:.686},{x:.922,y:.752}]}},
    'arena-01':{id:'arena-01',home:'home',away:'away',venue:'SUNSPIRE AMPHITHEATRE',arena:'assets/repo-sports-v2/arenas/01-lumerre-sunspire-amphitheatre.png',groundY:.758,floorY:.858,hoops:{left:[{x:.075,y:.650},{x:.101,y:.580},{x:.128,y:.650}],right:[{x:.872,y:.650},{x:.899,y:.580},{x:.925,y:.650}]}},
    'arena-02':{id:'arena-02',home:'home',away:'away',venue:'IRONROOT FORGE BOWL',arena:'assets/repo-sports-v2/arenas/02-kordesh-ironroot-forge-bowl.png',groundY:.758,floorY:.858,hoops:{left:[{x:.075,y:.650},{x:.101,y:.580},{x:.128,y:.650}],right:[{x:.872,y:.650},{x:.899,y:.580},{x:.925,y:.650}]}},
    'arena-03':{id:'arena-03',home:'home',away:'away',venue:'CANOPY THUNDERBOWL',arena:'assets/repo-sports-v2/arenas/03-nambara-canopy-thunderbowl.png',groundY:.758,floorY:.858,hoops:{left:[{x:.075,y:.650},{x:.101,y:.580},{x:.128,y:.650}],right:[{x:.872,y:.650},{x:.899,y:.580},{x:.925,y:.650}]}},
    'arena-04':{id:'arena-04',home:'home',away:'away',venue:'EMBERKEEP COLISEUM',arena:'assets/repo-sports-v2/arenas/04-norveth-emberkeep-coliseum.png',groundY:.758,floorY:.858,hoops:{left:[{x:.075,y:.650},{x:.101,y:.580},{x:.128,y:.650}],right:[{x:.872,y:.650},{x:.899,y:.580},{x:.925,y:.650}]}},
    'arena-05':{id:'arena-05',home:'home',away:'away',venue:'MIRAGE CROWN STADIUM',arena:'assets/repo-sports-v2/arenas/05-zafran-mirage-crown-stadium.png',groundY:.758,floorY:.858,hoops:{left:[{x:.075,y:.650},{x:.101,y:.580},{x:.128,y:.650}],right:[{x:.872,y:.650},{x:.899,y:.580},{x:.925,y:.650}]}},
    'arena-06':{id:'arena-06',home:'home',away:'away',venue:'MOONBLOOM GLADE',arena:'assets/repo-sports-v2/arenas/06-elvane-moonbloom-glade.png',groundY:.758,floorY:.858,hoops:{left:[{x:.075,y:.650},{x:.101,y:.580},{x:.128,y:.650}],right:[{x:.872,y:.650},{x:.899,y:.580},{x:.925,y:.650}]}},
    'arena-07':{id:'arena-07',home:'home',away:'away',venue:'OBSERVATORY ARENA',arena:'assets/repo-sports-v2/arenas/07-qasmir-observatory-arena.png',groundY:.758,floorY:.858,hoops:{left:[{x:.075,y:.650},{x:.101,y:.580},{x:.128,y:.650}],right:[{x:.872,y:.650},{x:.899,y:.580},{x:.925,y:.650}]}},
    'arena-08':{id:'arena-08',home:'home',away:'away',venue:'CORALCREST HARBOUR ARENA',arena:'assets/repo-sports-v2/arenas/08-calvora-coralcrest-harbour-arena.png',groundY:.758,floorY:.858,hoops:{left:[{x:.075,y:.650},{x:.101,y:.580},{x:.128,y:.650}],right:[{x:.872,y:.650},{x:.899,y:.580},{x:.925,y:.650}]}},
    'arena-09':{id:'arena-09',home:'home',away:'away',venue:'SKYHOLD AERODROME',arena:'assets/repo-sports-v2/arenas/09-rovarn-skyhold-aerodrome.png',groundY:.758,floorY:.858,hoops:{left:[{x:.075,y:.650},{x:.101,y:.580},{x:.128,y:.650}],right:[{x:.872,y:.650},{x:.899,y:.580},{x:.925,y:.650}]}},
    'arena-10':{id:'arena-10',home:'home',away:'away',venue:'LOTUSWATER PAVILION',arena:'assets/repo-sports-v2/arenas/10-talune-lotuswater-pavilion.png',groundY:.758,floorY:.858,hoops:{left:[{x:.075,y:.650},{x:.101,y:.580},{x:.128,y:.650}],right:[{x:.872,y:.650},{x:.899,y:.580},{x:.925,y:.650}]}},
    'arena-11':{id:'arena-11',home:'home',away:'away',venue:'GLOAM CARNIVAL GROUND',arena:'assets/repo-sports-v2/arenas/11-drazhen-gloam-carnival-ground.png',groundY:.758,floorY:.858,hoops:{left:[{x:.075,y:.650},{x:.101,y:.580},{x:.128,y:.650}],right:[{x:.872,y:.650},{x:.899,y:.580},{x:.925,y:.650}]}},
    'arena-12':{id:'arena-12',home:'home',away:'away',venue:'THORNVAULT STADIUM',arena:'assets/repo-sports-v2/arenas/12-belros-thornvault-stadium.png',groundY:.758,floorY:.858,hoops:{left:[{x:.075,y:.650},{x:.101,y:.580},{x:.128,y:.650}],right:[{x:.872,y:.650},{x:.899,y:.580},{x:.925,y:.650}]}}
  };

  // ==========================================================
  // REPO SPORTS V2 — ARENA-SPECIFIC AMBIENT WEATHER
  // Presentation-only; this never consumes gameplay randomness.
  // ==========================================================
  // REPO SPORTS CLUB MODE — MAP LINES PRE-MATCH COMMENTATOR INTRO
  // Uses only the supplied MP3 clips. This is presentation-only: it never reads
  // or advances simRand, and therefore cannot affect fixture/order/gameplay RNG.
  const RECORDED_INTRO_AUDIO_ROOT='assets/repo-sports-v2/commentator-map-lines/';
  const RECORDED_INTRO_VOLUME=.25;
  const RECORDED_INTRO_CUE_SECONDS=5;
  const RECORDED_INTRO_GAP_MIN_MS=0;
  const RECORDED_INTRO_GAP_RANGE_MS=1;
  const RECORDED_INTRO_FILES=Object.freeze([
    'A packed.mp3','And here we have.mp3','and.mp3','Ashwick.mp3','AT THE.mp3','Aurelia.mp3','awaits.mp3','Blackglass.mp3',
    'Canopy Thunderbowl.mp3','Cinderbank.mp3','Coralcrest Harbour arena.mp3','Drazh hollow.mp3','Emberkeep colleseum.mp3','face.mp3','For.mp3',
    'From the heart of Velmora.mp3','Gloam Carnival Ground.mp3','Grand Khor.mp3','Hrafnvik.mp3','Ironroot forge bowl.mp3','Iskara.mp3',
    'Lotuswater Pavilion.mp3','Marenza.mp3','Mirage Crown Stadium.mp3','Moonbloom glade.mp3','Naskor.mp3','Observatory Arena.mp3','Orsanne.mp3',
    'Ossa Mere.mp3','Rova End.mp3','Saint Ciro.mp3','Skarholt.mp3','Skyhold aerodrome.mp3','Sunspire Amphitheatre.mp3','Talun Cross.mp3',
    'Thornvault stadium.mp3','Tonight, the brooms take flight.mp3','Tonight#U2019s Repo Sports League fixture.mp3','Varka Fell.mp3','VS.mp3',
    'Welcome To.mp3','Zafir Row.mp3'
  ]);
  const RECORDED_INTRO_VENUES=Object.freeze([
    'Sunspire Amphitheatre','Ironroot Forge Bowl','Canopy Thunderbowl','Emberkeep Coliseum','Mirage Crown Stadium','Moonbloom Glade',
    'Observatory Arena','Coralcrest Harbour Arena','Skyhold Aerodrome','Lotuswater Pavilion','Gloam Carnival Ground','Thornvault Stadium'
  ]);
  function recordedIntroKey(value){
    return String(value||'')
      .replace(/#u2019/gi,"'")
      .replace(/[\u2018\u2019']/g,'')
      .replace(/colleseum/gi,'coliseum')
      .replace(/\.mp3$/i,'')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g,'');
  }
  const RECORDED_INTRO_FILE_BY_KEY=(()=>{
    const map=new Map();
    for(const file of RECORDED_INTRO_FILES){const key=recordedIntroKey(file);if(key&&!map.has(key))map.set(key,file)}
    return map;
  })();
  function resolveRecordedIntroClip(label){
    const file=RECORDED_INTRO_FILE_BY_KEY.get(recordedIntroKey(label));
    return file?`${RECORDED_INTRO_AUDIO_ROOT}${encodeURIComponent(file)}?v=20260812-tight-venue-join`:null;
  }
  function canonicalRecordedIntroTeam(value){
    const key=normaliseClubName(value);
    return V2_LEAGUE_TEAMS.find(name=>normaliseClubName(name)===key)||null;
  }
  function canonicalRecordedIntroVenue(value){
    const key=recordedIntroKey(value);
    return RECORDED_INTRO_VENUES.find(name=>recordedIntroKey(name)===key)||null;
  }
  const RECORDED_INTRO_TEMPLATES=Object.freeze([
    ({home,away,arena})=>({text:`Tonight’s Repo Sports League fixture: ${home} VS ${away} at the ${arena}.`,clips:["Tonight’s Repo Sports League fixture",home,'VS',away,'AT THE',arena]}),
    ({home,away,arena})=>({text:`And here we have ${home} VS ${away} at the ${arena}.`,clips:['And here we have',home,'VS',away,'AT THE',arena]}),
    ({home,away,arena})=>({text:`From the heart of Velmora, ${home} face ${away} at the ${arena}.`,clips:['From the heart of Velmora',home,'face',away,'AT THE',arena]}),
    ({home,away,arena})=>({text:`A packed ${arena} awaits ${home} VS ${away}.`,clips:['A packed',arena,'awaits',home,'VS',away]}),
    ({home,away,arena})=>({text:`Tonight, the brooms take flight: ${home} VS ${away} at the ${arena}.`,clips:['Tonight, the brooms take flight',home,'VS',away,'AT THE',arena]}),
    ({home,away,arena})=>({text:`Welcome to ${arena} for ${home} VS ${away}.`,clips:['Welcome To',arena,'For',home,'VS',away]})
  ]);
  let recordedPrematchAudio=null,recordedPrematchRunToken=0;
  function buildRecordedPrematchIntroPlan(){
    const home=canonicalRecordedIntroTeam(teamMeta.belros?.name),away=canonicalRecordedIntroTeam(teamMeta.zafran?.name),arena=canonicalRecordedIntroVenue(fixtureVenue());
    if(!home||!away||!arena){console.warn('[REPO SPORTS V2] Recorded intro skipped: fixture data did not match current club/venue lists',{home:teamMeta.belros?.name,away:teamMeta.zafran?.name,arena:fixtureVenue()});return null}
    const templateSeed=hashSeed(`${state.liveSerial||state.startedAt||0}|${activeFixture?.id||''}|${home}|${away}|${arena}|RECORDED_PREMATCH_INTRO`);
    const templateIndex=templateSeed%RECORDED_INTRO_TEMPLATES.length;
    const built=RECORDED_INTRO_TEMPLATES[templateIndex]({home,away,arena});
    const urls=built.clips.map(resolveRecordedIntroClip),missing=built.clips.filter((_,i)=>!urls[i]);
    if(missing.length){console.warn('[REPO SPORTS V2] Recorded intro skipped: missing supplied clips',missing);return null}
    const pauses=urls.slice(0,-1).map((_,i)=>RECORDED_INTRO_GAP_MIN_MS+(hashSeed(`${templateSeed}|gap|${i}`)%RECORDED_INTRO_GAP_RANGE_MS));
    return {home,away,arena,templateIndex,text:built.text,clipLabels:built.clips.slice(),urls,pauses,played:false,playing:false,expired:false};
  }
  function preloadRecordedPrematchIntro(plan){
    if(!plan||state.headless)return;
    plan.preloadedAudio=plan.urls.map(src=>{
      try{const a=new Audio(src);a.preload='auto';a.volume=RECORDED_INTRO_VOLUME;a.load();return a}catch(_){return null}
    });
  }
  function stopBarryRecordedIntro(){
    const b=state.broadcast,wrap=$('wcgCommentator');if(!b?.recordedIntroSpeaking)return;
    clearInterval(b.talkTimer);b.talkTimer=0;clearTimeout(b.barryTimer);b.barryTimer=0;
    b.recordedIntroSpeaking=false;b.speaking=false;b.barryPriority=0;b.barryUntil=0;b.barryState='NEUTRAL';
    if(wrap){wrap.dataset.barryState='NEUTRAL';wrap.classList.remove('is-speaking','is-excited','is-shocked','is-goal','is-var')}
    barryAsset(BARRY.neutral);
  }
  function startBarryRecordedIntro(text){
    const b=state.broadcast,wrap=$('wcgCommentator'),box=$('wcgCommentary');if(!b||!box)return;
    clearBarryTimers();b.queue=null;b.speaking=true;b.recordedIntroSpeaking=true;b.barryState='SPEAKING';b.barryPriority=10;b.barryUntil=Number.POSITIVE_INFINITY;
    box.textContent=text;b.lastSpokenAt=performance.now();b.lastText=text;b.debugEvent='RECORDED_PREMATCH_INTRO';
    const skeleton=commentarySkeleton(text);b.recent=[text,...(b.recent||[]).filter(x=>x!==text)].slice(0,60);b.recentSkeletons=[skeleton,...(b.recentSkeletons||[]).filter(x=>x!==skeleton)].slice(0,32);
    if(wrap){wrap.dataset.barryState='SPEAKING';wrap.classList.remove('is-excited','is-shocked','is-goal','is-var');wrap.classList.add('is-speaking')}
    let frame=0;barryAsset(BARRY.talk[0]);
    b.talkTimer=setInterval(()=>{if(!state.open||!state.broadcast?.recordedIntroSpeaking)return;frame=(frame+1)%BARRY.talk.length;barryAsset(BARRY.talk[frame])},155);
  }
  function cancelRecordedPrematchIntro(){
    recordedPrematchRunToken++;
    if(recordedPrematchAudio){try{recordedPrematchAudio.pause();recordedPrematchAudio.currentTime=0;recordedPrematchAudio.onended=null;recordedPrematchAudio.onerror=null}catch(_){}}
    recordedPrematchAudio=null;
    if(state.recordedPrematchIntro)state.recordedPrematchIntro.playing=false;
    stopBarryRecordedIntro();
  }
  function waitRecordedIntroGap(ms,token){return new Promise(resolve=>{const end=performance.now()+Math.max(0,ms||0);const tick=()=>{if(token!==recordedPrematchRunToken||!state.open||performance.now()>=end)return resolve();setTimeout(tick,Math.min(30,Math.max(1,end-performance.now())))};tick()})}
  function playRecordedIntroClip(src,token,preparedAudio=null){
    return new Promise(resolve=>{
      if(token!==recordedPrematchRunToken||!state.open)return resolve(false);
      const a=preparedAudio||new Audio(src);
      let done=false;const finish=ok=>{if(done)return;done=true;if(recordedPrematchAudio===a)recordedPrematchAudio=null;try{a.onended=null;a.onerror=null}catch(_){}resolve(ok)};
      recordedPrematchAudio=a;a.preload='auto';a.volume=RECORDED_INTRO_VOLUME;a.currentTime=0;a.onended=()=>finish(true);a.onerror=()=>finish(false);
      try{const p=a.play();p?.catch?.(()=>finish(false))}catch(_){finish(false)}
    });
  }
  async function playRecordedPrematchIntro(plan){
    if(!plan||plan.playing||!plan.urls.length||state.headless)return;
    const token=++recordedPrematchRunToken;plan.playing=true;startBarryRecordedIntro(plan.text);
    try{
      for(let i=0;i<plan.urls.length;i++){
        if(token!==recordedPrematchRunToken||!state.open)break;
        await playRecordedIntroClip(plan.urls[i],token,plan.preloadedAudio?.[i]||null);
        if(i<plan.urls.length-1&&token===recordedPrematchRunToken&&state.open)await waitRecordedIntroGap(plan.pauses[i],token);
      }
    }finally{
      if(token===recordedPrematchRunToken){plan.playing=false;recordedPrematchAudio=null;stopBarryRecordedIntro()}
    }
  }
  function maybeTriggerRecordedPrematchIntro(){
    const plan=state.recordedPrematchIntro;if(!plan||plan.played||plan.expired||state.phase!=='intro')return;
    const elapsed=Math.max(0,state.introElapsed);
    // The cue is five seconds AFTER the 30-second pre-match countdown starts.
    // Viewers who join after that shared cue do not get a late/replayed intro.
    if(state.headless){if(elapsed>=RECORDED_INTRO_CUE_SECONDS)plan.played=true;return}
    if(state.fastForwarding){
      if(elapsed>RECORDED_INTRO_CUE_SECONDS+.45){plan.expired=true;plan.played=true}
      return;
    }
    if(elapsed>=RECORDED_INTRO_CUE_SECONDS){plan.played=true;void playRecordedPrematchIntro(plan)}
  }

  const ARENA_AMBIENCE={
    'arena-01':{effects:[
      {kind:'petal',count:20,colour:'#f3b5c7',colour2:'#fff0c6',alpha:.34,speed:.020,size:2.4,drift:.028},
      {kind:'mote',count:18,colour:'#ffe2a0',alpha:.20,speed:.007,size:1.8,drift:.012}
    ]},
    'arena-02':{effects:[
      {kind:'ember',count:30,colour:'#ff9d35',colour2:'#ffd36d',alpha:.48,speed:.040,size:2.2,drift:.018},
      {kind:'ash',count:16,colour:'#b8aca1',alpha:.16,speed:.014,size:1.5,drift:.021}
    ]},
    'arena-03':{effects:[
      {kind:'rain',count:28,colour:'#b9dfe8',alpha:.16,speed:.150,size:1.0,drift:.045},
      {kind:'leaf',count:11,colour:'#74a35d',colour2:'#b7b05b',alpha:.27,speed:.020,size:2.5,drift:.035}
    ],flash:{period:24.0,duration:.16,alpha:.055,colour:'#d5ecff',phase:7.4}},
    'arena-04':{effects:[
      {kind:'ember',count:38,colour:'#ff7138',colour2:'#ffc052',alpha:.52,speed:.034,size:2.2,drift:.021},
      {kind:'ash',count:15,colour:'#d0b8aa',alpha:.14,speed:.012,size:1.7,drift:.025}
    ]},
    'arena-05':{effects:[
      {kind:'dust',count:34,colour:'#ffd17d',colour2:'#e9a95c',alpha:.22,speed:.022,size:1.8,drift:.060},
      {kind:'mote',count:12,colour:'#fff0b5',alpha:.15,speed:.006,size:1.5,drift:.018}
    ]},
    'arena-06':{effects:[
      {kind:'spore',count:30,colour:'#b8f5ff',colour2:'#d9d1ff',alpha:.31,speed:.012,size:2.0,drift:.022},
      {kind:'mote',count:16,colour:'#f1ffff',alpha:.18,speed:.005,size:1.6,drift:.010}
    ]},
    'arena-07':{effects:[
      {kind:'star',count:34,colour:'#e7e6ff',colour2:'#ffd78f',alpha:.30,speed:.002,size:1.7,drift:.004}
    ],streak:{period:27.0,duration:.55,alpha:.24,colour:'#dbe8ff',phase:11.8}},
    'arena-08':{effects:[
      {kind:'spray',count:26,colour:'#bcecff',colour2:'#dcffff',alpha:.24,speed:.025,size:1.8,drift:.032},
      {kind:'mote',count:12,colour:'#a7e8ee',alpha:.13,speed:.006,size:1.5,drift:.014}
    ]},
    'arena-09':{effects:[
      {kind:'sleet',count:34,colour:'#eef6ff',alpha:.23,speed:.085,size:1.3,drift:.070},
      {kind:'ash',count:10,colour:'#d7dbe0',alpha:.11,speed:.012,size:1.4,drift:.030}
    ]},
    'arena-10':{effects:[
      {kind:'petal',count:23,colour:'#f1a8bf',colour2:'#ffe0e8',alpha:.31,speed:.018,size:2.6,drift:.030},
      {kind:'spray',count:12,colour:'#d7f5ee',alpha:.13,speed:.014,size:1.5,drift:.018}
    ]},
    'arena-11':{effects:[
      {kind:'ember',count:21,colour:'#ff9252',colour2:'#ffd565',alpha:.34,speed:.026,size:1.9,drift:.019},
      {kind:'confetti',count:16,colour:'#d978ff',colour2:'#ffca62',alpha:.25,speed:.018,size:2.2,drift:.035}
    ]},
    'arena-12':{effects:[
      {kind:'spore',count:28,colour:'#91d98c',colour2:'#b8f0a3',alpha:.27,speed:.011,size:2.0,drift:.023},
      {kind:'leaf',count:13,colour:'#466d4e',colour2:'#7d9257',alpha:.22,speed:.016,size:2.5,drift:.033}
    ]}
  };

  const ARENA_AMBIENT_CACHE=new Map();
  function ambientHash(seed){
    const x=Math.sin(seed*12.9898+78.233)*43758.5453123;
    return x-Math.floor(x);
  }
  function ambientSeedFor(id,effectIndex,index,lane=0){
    let h=0,key=String(id||'arena');
    for(let i=0;i<key.length;i++)h=(h*31+key.charCodeAt(i))|0;
    return ambientHash(Math.abs(h)+effectIndex*7919+index*104729+lane*3571+.137);
  }
  function ambientParticlesFor(id,effectIndex,effect){
    const cacheKey=`${id}:${effectIndex}:${effect.kind}:${effect.count}`;
    if(ARENA_AMBIENT_CACHE.has(cacheKey))return ARENA_AMBIENT_CACHE.get(cacheKey);
    const particles=[];
    for(let i=0;i<effect.count;i++)particles.push({
      x:ambientSeedFor(id,effectIndex,i,0),y:ambientSeedFor(id,effectIndex,i,1),
      phase:ambientSeedFor(id,effectIndex,i,2)*Math.PI*2,
      speed:.72+ambientSeedFor(id,effectIndex,i,3)*.62,
      size:.65+ambientSeedFor(id,effectIndex,i,4)*.90,
      depth:ambientSeedFor(id,effectIndex,i,5),
      spin:(ambientSeedFor(id,effectIndex,i,6)-.5)*2
    });
    ARENA_AMBIENT_CACHE.set(cacheKey,particles);
    return particles;
  }
  function ambientWrap(v,min=0,max=1){const span=max-min;return ((v-min)%span+span)%span+min}
  function ambientColour(effect,p){return p.depth>.48?(effect.colour2||effect.colour):effect.colour}

  function drawAmbientParticle(ctx,effect,p,t,layer){
    const kind=effect.kind,front=p.depth>.64;
    if((layer==='front')!==front)return;
    // Test 26 visibility pass: particles were technically present in Test 23,
    // but at the scaled TV size many became sub-pixel / too transparent.
    const depthScale=front?1.32:(.82+p.depth*.34);
    const alpha=Math.min(.82,(effect.alpha||.2)*(front?.88:1.02)*1.34*(0.76+Math.sin(t*.8+p.phase)*.16));
    let x=p.x,y=p.y,rot=p.phase+t*p.spin*.18;

    if(kind==='ember'){
      y=ambientWrap(p.y-t*(effect.speed||.03)*p.speed,-.06,1.08);
      x=ambientWrap(p.x+Math.sin(t*.72+p.phase)*(effect.drift||.02)+t*.002*p.spin,-.04,1.04);
    }else if(kind==='ash'){
      y=ambientWrap(p.y+t*(effect.speed||.012)*p.speed,-.05,1.06);
      x=ambientWrap(p.x+Math.sin(t*.38+p.phase)*(effect.drift||.02)+t*.003*p.spin,-.05,1.05);
    }else if(kind==='petal'||kind==='leaf'||kind==='confetti'){
      y=ambientWrap(p.y+t*(effect.speed||.02)*p.speed,-.06,1.08);
      x=ambientWrap(p.x+Math.sin(t*.52+p.phase)*(effect.drift||.03)+t*.0025*p.spin,-.06,1.06);
    }else if(kind==='rain'||kind==='sleet'){
      y=ambientWrap(p.y+t*(effect.speed||.10)*p.speed,-.10,1.12);
      x=ambientWrap(p.x-t*(effect.drift||.05)*p.speed,-.10,1.10);
    }else if(kind==='dust'){
      x=ambientWrap(p.x+t*(effect.speed||.02)*p.speed,-.08,1.08);
      y=ambientWrap(p.y+Math.sin(t*.45+p.phase)*(effect.drift||.03)*.24,-.04,1.04);
    }else if(kind==='spore'){
      y=ambientWrap(p.y-t*(effect.speed||.012)*p.speed,-.06,1.08);
      x=ambientWrap(p.x+Math.sin(t*.50+p.phase)*(effect.drift||.02),-.05,1.05);
    }else if(kind==='spray'){
      y=ambientWrap(.58+p.y*.48-t*(effect.speed||.02)*p.speed,.52,1.08);
      x=ambientWrap(p.x+Math.sin(t*.65+p.phase)*(effect.drift||.025),-.04,1.04);
    }else if(kind==='mote'||kind==='star'){
      x=ambientWrap(p.x+Math.sin(t*.16+p.phase)*(effect.drift||.01),-.02,1.02);
      y=ambientWrap(p.y+Math.cos(t*.13+p.phase)*(effect.speed||.005),-.02,1.02);
    }

    const px=Math.round(x*W),py=Math.round(y*H);
    const size=Math.max(1.35,(effect.size||2)*p.size*depthScale*1.38);
    ctx.save();
    ctx.globalAlpha=Math.max(.02,alpha);
    ctx.fillStyle=ambientColour(effect,p);ctx.strokeStyle=ambientColour(effect,p);

    if(kind==='rain'||kind==='sleet'){
      ctx.lineWidth=Math.max(.6,size*.50);
      const len=(kind==='rain'?12:8)*depthScale;
      ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px-(effect.drift||.05)*55*depthScale,py+len);ctx.stroke();
    }else if(kind==='ember'){
      ctx.globalCompositeOperation='screen';
      ctx.fillRect(Math.round(px-size*.50),Math.round(py-size*.50),Math.max(1,Math.round(size)),Math.max(1,Math.round(size)));
      ctx.globalAlpha*=.33;
      ctx.fillRect(Math.round(px-size*.30),Math.round(py+size*.65),Math.max(1,Math.round(size*.55)),Math.max(2,Math.round(size*2.4)));
    }else if(kind==='mote'||kind==='spore'||kind==='spray'||kind==='star'||kind==='dust'){
      if(kind==='star')ctx.globalAlpha*=.55+.45*Math.abs(Math.sin(t*1.8+p.phase));
      ctx.globalCompositeOperation=(kind==='star'||kind==='spore')?'screen':'source-over';
      ctx.beginPath();ctx.arc(px,py,Math.max(.65,size*.55),0,Math.PI*2);ctx.fill();
    }else{
      ctx.translate(px,py);ctx.rotate(rot);
      const w=Math.max(1,size*1.8),h=Math.max(1,size*.90);
      ctx.fillRect(Math.round(-w/2),Math.round(-h/2),Math.round(w),Math.round(h));
    }
    ctx.restore();
  }

  function drawArenaAmbience(ctx,layer='back'){
    const id=activeFixture?.id,ambience=ARENA_AMBIENCE[id];
    if(!ambience)return;
    const t=performance.now()/1000;
    ctx.save();
    for(let effectIndex=0;effectIndex<(ambience.effects||[]).length;effectIndex++){
      const effect=ambience.effects[effectIndex];
      for(const p of ambientParticlesFor(id,effectIndex,effect))drawAmbientParticle(ctx,effect,p,t,layer);
    }
    if(layer==='front'&&ambience.flash){
      const f=ambience.flash,cycle=ambientWrap(t+(f.phase||0),0,f.period||24);
      if(cycle<(f.duration||.16)){
        const mid=(f.duration||.16)*.42;
        const a=cycle<=mid?cycle/Math.max(.001,mid):(f.duration-cycle)/Math.max(.001,f.duration-mid);
        ctx.globalAlpha=Math.max(0,a)*(f.alpha||.05);ctx.fillStyle=f.colour||'#dbeeff';ctx.fillRect(0,0,W,H);
      }
    }
    if(layer==='front'&&ambience.streak){
      const s=ambience.streak,cycle=ambientWrap(t+(s.phase||0),0,s.period||27);
      if(cycle<(s.duration||.55)){
        const u=cycle/Math.max(.001,s.duration||.55),x=(.18+u*.47)*W,y=(.12+u*.12)*H;
        ctx.globalAlpha=(s.alpha||.2)*Math.sin(Math.PI*u);ctx.strokeStyle=s.colour||'#e7efff';ctx.lineWidth=1.2;
        ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-55,y-20);ctx.stroke();
      }
    }
    ctx.restore();
  }


  function refreshArenaAtmosphereDom(){
    const layer=$('wcgArenaAtmosphere');
    if(!layer)return;
    layer.innerHTML='';
    const id=activeFixture?.id||'arena-01';
    const ambience=ARENA_AMBIENCE[id];
    layer.dataset.arena=id;
    if(!ambience)return;

    for(let effectIndex=0;effectIndex<(ambience.effects||[]).length;effectIndex++){
      const effect=ambience.effects[effectIndex];

      // Strong enough to survive the TV's responsive scaling, still deliberately
      // restrained compared with celebration particles.
      const count=Math.max(8,Math.round((effect.count||12)*.92));
      for(let i=0;i<count;i++){
        const node=document.createElement('span');
        node.className=`wcg-arena-particle wcg-arena-${effect.kind}`;

        const left=ambientSeedFor(id,effectIndex,i,20)*100;
        const top=ambientSeedFor(id,effectIndex,i,27)*100;
        const size=Math.max(2.6,(effect.size||2)*(1.25+ambientSeedFor(id,effectIndex,i,21)*.95));
        const durationBase=
          effect.kind==='rain'||effect.kind==='sleet'?3.8:
          effect.kind==='ember'||effect.kind==='spore'||effect.kind==='spray'?7.2:
          effect.kind==='dust'?10.8:
          effect.kind==='star'?4.5:9.4;
        const duration=durationBase*(.72+ambientSeedFor(id,effectIndex,i,22)*.72);
        const delay=-duration*ambientSeedFor(id,effectIndex,i,23);
        const drift=(-88+ambientSeedFor(id,effectIndex,i,24)*176);
        const alpha=Math.min(.78,(effect.alpha||.2)*1.52*(.78+ambientSeedFor(id,effectIndex,i,25)*.42));

        node.style.setProperty('--ambient-left',`${left.toFixed(2)}%`);
        node.style.setProperty('--ambient-top',`${top.toFixed(2)}%`);
        node.style.setProperty('--ambient-size',`${size.toFixed(2)}px`);
        node.style.setProperty('--ambient-duration',`${duration.toFixed(2)}s`);
        node.style.setProperty('--ambient-delay',`${delay.toFixed(2)}s`);
        node.style.setProperty('--ambient-drift',`${drift.toFixed(1)}px`);
        node.style.setProperty('--ambient-alpha',alpha.toFixed(3));
        node.style.setProperty('--ambient-colour',effect.colour||'#dff5ff');
        node.style.setProperty('--ambient-colour-2',effect.colour2||effect.colour||'#ffffff');
        node.style.setProperty('--ambient-spin',`${(-170+ambientSeedFor(id,effectIndex,i,26)*340).toFixed(0)}deg`);
        layer.appendChild(node);
      }
    }
  }

  let matchdaySquads={belros:[],zafran:[]};
  let activeFixture=FIXTURE_CONFIGS['arena-01'];
  function fixtureGroundY(){return Number(activeFixture?.groundY??.758)}
  function groundedY(offset=0){return clamp(fixtureGroundY()+offset,.64,.92)}
  function fixtureVisualFloorY(){return Number.isFinite(Number(activeFixture?.floorY))?Number(activeFixture.floorY):null}
  function standingDirectionForPlayer(player,slotTeam){const sourceFacing=STANDING_PLAYER_SOURCE_FACING[player?.id]||-1;const desiredFacing=slotTeam==='belros'?1:-1;return desiredFacing*sourceFacing}
  function standingRenderDir(e){return standingDirectionForPlayer(e?.player,e?.team)}
  const teamMeta={belros:{name:'HRAFNVIK',abbr:'HRA',colour:'#b63a2c',attack:1,flag:flagForTeamName('Hrafnvik'),sourceTeam:'home'},zafran:{name:'BLACKGLASS',abbr:'BLK',colour:'#4a84c6',attack:-1,flag:flagForTeamName('Blackglass'),sourceTeam:'away'}};

  function resolveFixtureConfig(opts={}){
    if(opts.arenaUrl){
      return {
        id:String(opts.fixtureId||opts.id||'torre-piccola'),
        home:'home',away:'away',
        venue:String(opts.venue||'TORRE PICCOLA POPOLARE ARENA').toUpperCase(),
        arena:String(opts.arenaUrl),
        fallbackArena:opts.arenaFallbackUrl?String(opts.arenaFallbackUrl):null,
        stadiumClubId:opts.stadiumClubId?String(opts.stadiumClubId):null,artworkPending:!!opts.stadiumArtworkPending,
        groundY:Number(opts.groundY??.805),floorY:Number(opts.floorY??.904),
        hoops:opts.hoops||{left:[{x:.082,y:.752},{x:.105,y:.686},{x:.132,y:.752}],right:[{x:.868,y:.752},{x:.895,y:.686},{x:.922,y:.752}]}
      };
    }
    const direct=String(opts.fixtureId||opts.id||'').toLowerCase();
    if(direct&&FIXTURE_CONFIGS[direct])return FIXTURE_CONFIGS[direct];
    const raw=String(opts.fixture||'').toLowerCase().replace(/[^a-z]+/g,'-').replace(/^-|-$/g,'');
    return FIXTURE_CONFIGS[raw]||FIXTURE_CONFIGS['torre-piccola'];
  }
  function normaliseCareerRole(role){
    const r=String(role||'ALL-ROUNDER').toUpperCase();
    if(r==='ATTACKER')return'attacker';
    if(r==='DEFENDER')return'defender';
    return'support';
  }
  function careerStat(value,base=60){if(window.VelmoraPerformance)return window.VelmoraPerformance.engineStat(value,base);const candidate=Number(value??base),n=Number.isFinite(candidate)?candidate:60;return clamp(.70+((clamp(n,30,99)-40)/59)*.285,.65,.985);}
  function careerAttributesFromStats(player){
    if(window.VelmoraPerformance)return window.VelmoraPerformance.engineAttributes(player,{sharpness:player?.sharpness??player?.careerMeta?.sharpness,roleModifier:player?.careerMeta?.roleModifier??1});
    const st=player?.stats||{},form=({Excellent:.018,Good:.009,Average:0,'New Signing':.004,Poor:-.012,Terrible:-.022}[player?.form]||0),morale=({'Very Happy':.005,Happy:.009,Content:0,Unhappy:-.010,'Very Unhappy':-.020,Excellent:.005,Good:.009,Okay:0,Poor:-.010,Bad:-.020}[player?.morale]||0),ov=careerStat(player?.ovr,65),fitness=clamp(Number(player?.fitness??82),45,100);const tune=(value,extra=0)=>clamp(value+form+morale+extra,.60,.99);const readiness=clamp(((Number.isFinite(Number(player?.sharpness))?Number(player.sharpness):70)-70)*.0006,-.035,.018),ready=(value)=>tune(value,readiness);return{speed:tune(careerStat(st.PAC,player?.ovr)),accel:tune(careerStat(st.PAC,player?.ovr),.006),turn:tune((careerStat(st.PAS,player?.ovr)+careerStat(st.HAN,player?.ovr)+ov)/3),passing:ready(careerStat(st.PAS,player?.ovr)),catching:ready(careerStat(st.HAN,player?.ovr)),shooting:ready(careerStat(st.SHO,player?.ovr)),interception:ready(careerStat(st.DEF,player?.ovr)),awareness:ready((careerStat(st.DEF,player?.ovr)+careerStat(st.PAS,player?.ovr)+ov)/3),positioning:ready((careerStat(st.DEF,player?.ovr)+ov)/2),reaction:ready((careerStat(st.PAC,player?.ovr)+careerStat(st.HAN,player?.ovr)+ov)/3),anticipation:ready((careerStat(st.DEF,player?.ovr)+careerStat(st.PAS,player?.ovr))/2),decision:ready((careerStat(st.PAS,player?.ovr)+ov)/2),composure:ready((careerStat(st.HAN,player?.ovr)+ov)/2),aggression:tune(.82),stamina:tune(careerStat(st.STA,player?.ovr),(fitness-82)/900),recovery:tune(careerStat(st.STA,player?.ovr),(fitness-82)/950)};
  }
  function careerQuality(raw,requireQuality=false){
    const meta={ovr:raw.ovr,fitness:raw.fitness,sharpness:raw.sharpness,form:raw.form,morale:raw.morale,...(raw.careerMeta||{})};
    const valid=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
    // Reject unit mistakes and malformed ratings at the integration boundary.
    for(const [key,value] of Object.entries({ovr:meta.ovr,fitness:meta.fitness,sharpness:meta.sharpness,...Object.fromEntries(['PAC','PAS','SHO','HAN','DEF','STA'].map(key=>[key,raw.stats?.[key]]))})){
      if(value==null)continue;
      const max=['fitness','sharpness'].includes(key)?100:99;
      if(!valid(value)||Number(value)<0||Number(value)>max)throw new Error(`Invalid ${key} for ${raw.name||raw.id||'player'}: career ratings must be between 0 and ${max}.`);
    }
    const hasStats=['PAC','PAS','SHO','HAN','DEF','STA'].some(key=>valid(raw.stats?.[key]));
    const hasOverall=valid(meta.ovr),base=careerAttributesFromStats({...raw,...meta,ovr:hasOverall?Number(meta.ovr):70});
    const keys=Object.keys(base).filter(key=>Object.prototype.hasOwnProperty.call(raw.attributes||{},key));
    if(requireQuality&&!hasStats&&!hasOverall&&!keys.length)throw new Error(`Missing player ratings for ${raw.name||raw.id||'player'}: supply career stats/OVR or normalized attributes.`);
    for(const key of keys){const value=raw.attributes[key];if(!valid(value)||Number(value)<0||Number(value)>1)throw new Error(`Invalid ${key} for ${raw.name||raw.id||'player'}: engine attributes must be between 0 and 1.`);base[key]=Number(value);}
    return {attributes:!requireQuality&&!hasStats&&!hasOverall&&!keys.length?null:base,meta,source:keys.length?'normalized-attributes':hasStats?'career-stats':hasOverall?'overall-fallback':'exhibition-default'};
  }
  function normaliseCareerPlayer(raw={},index=0,team='home',requireQuality=false){
    const id=String(raw.id||`${team}-player-${index+1}`),quality=careerQuality(raw,requireQuality);
    return {
      id,name:String(raw.name||`PLAYER ${index+1}`).toUpperCase(),role:normaliseCareerRole(raw.role),careerRole:String(raw.role||'ALL-ROUNDER'),unavailable:!!raw.unavailable,risk:1,
      standing:String(raw.standing||raw.avatar||''),riding:String(raw.riding||''),short:String(raw.short||'Velmora career player'),lore:[],
      spriteMetrics:raw.spriteMetrics&&typeof raw.spriteMetrics==='object'?{...raw.spriteMetrics}:null,
      engineAttributes:quality.attributes,qualitySource:quality.source,playingTraits:Array.isArray(raw.playingTraits)?[...raw.playingTraits]:[],
      careerMeta:quality.meta
    };
  }
  function careerTacticalProfile(raw={}){
    const defensive=String(raw.defensive||'Balanced'),attacking=String(raw.attacking||'Balanced'),mentality=String(raw.mentality||'Balanced'),width=String(raw.width||'Balanced'),tempo=String(raw.tempo||'Balanced'),freedom=String(raw.freedom||'Balanced');
    let id=attacking==='Possession'?'PATIENT':attacking==='Fast Break'?'COUNTER':attacking==='Direct'?'DIRECT':defensive==='Press'?'PRESS':defensive==='Drop Back'?'COMPACT':'FLUID';
    const base=CLUB_TACTICAL_PROFILES.find(p=>p.id===id)||CLUB_TACTICAL_PROFILES[0],p={...base};
    if(defensive==='Press'){p.defCompact=Math.min(p.defCompact,.91);p.supportDepth*=1.03;p.passBias-=.003;}
    if(defensive==='Drop Back'){p.defCompact=Math.min(p.defCompact,.87);p.width*=.96;p.runnerDepth*=.98;}
    if(mentality==='Attacking'){p.runnerDepth*=1.07;p.supportDepth*=1.035;p.directness+=.055;p.passBias-=.004;}
    if(mentality==='Defensive'){p.runnerDepth*=.95;p.supportDepth*=.955;p.directness-=.035;p.passBias+=.006;}
    if(width==='Compact'){p.width*=.88;p.supportWidth*=.86;p.defCompact=Math.min(p.defCompact,.88);p.passBias+=.006;}
    if(width==='Wide'){p.width*=1.13;p.supportWidth*=1.16;p.defCompact*=1.04;p.passBias-=.003;}
    if(tempo==='Patient'){p.runnerDepth*=.94;p.supportDepth*=.91;p.directness-=.085;p.passBias+=.01;}
    if(tempo==='Urgent'){p.runnerDepth*=1.08;p.supportDepth*=1.035;p.directness+=.09;p.passBias-=.009;}
    if(freedom==='Structured'){p.fluid=false;p.supportWidth*=.94;p.defCompact=Math.min(p.defCompact,.94);}
    if(freedom==='Fluid'){p.fluid=true;p.supportWidth*=1.08;p.runnerDepth*=1.035;p.defCompact*=1.035;}
    p.name=`${defensive} · ${attacking} · ${mentality} · ${width} · ${tempo} · ${freedom}`.toUpperCase();p.short=`${defensive.toLowerCase()} / ${attacking.toLowerCase()} / ${tempo.toLowerCase()}`;
    p.comment=`are playing ${attacking.toLowerCase()} Quidditch at a ${tempo.toLowerCase()} tempo, using ${width.toLowerCase()} spacing and ${freedom.toLowerCase()} rotations.`;
    return p;
  }
  function applyFixtureConfig(opts={}){
    activeFixture=resolveFixtureConfig(opts);
    const fallback=TEST_LINEUPS[Math.abs(Number(opts.lineupIndex)||0)%TEST_LINEUPS.length];
    const directHome=Array.isArray(opts.homePlayerData)&&opts.homePlayerData.length===3?opts.homePlayerData.map((p,i)=>normaliseCareerPlayer(p,i,'home',!!opts.careerMode)):null;
    const directAway=Array.isArray(opts.awayPlayerData)&&opts.awayPlayerData.length===3?opts.awayPlayerData.map((p,i)=>normaliseCareerPlayer(p,i,'away',!!opts.careerMode)):null;
    if(opts.careerMode&&(!directHome||!directAway||[...directHome,...directAway].some(p=>p.unavailable)))throw new Error('Each club needs three available career starters.');
    if(directHome&&directAway){
      roster={belros:directHome,zafran:directAway};
    }else{
      const requestedHome=Array.isArray(opts.homePlayers)&&opts.homePlayers.length===3?opts.homePlayers:fallback.home;
      const requestedAway=Array.isArray(opts.awayPlayers)&&opts.awayPlayers.length===3?opts.awayPlayers:fallback.away;
      const valid=id=>!!V2_PLAYERS[id],homeIds=requestedHome.filter(valid),awayIds=requestedAway.filter(valid);
      const split=(homeIds.length===3&&awayIds.length===3&&new Set([...homeIds,...awayIds]).size===6)?{home:homeIds,away:awayIds}:fallback;
      roster={belros:split.home.map(id=>V2_PLAYERS[id]),zafran:split.away.map(id=>V2_PLAYERS[id])};
    }
    matchdaySquads={belros:roster.belros.slice(),zafran:roster.zafran.slice()};
    if(opts.careerMode&&directHome&&directAway){
      const seen=new Set([...directHome,...directAway].map(p=>p.id));
      if(seen.size!==6)throw new Error('Starting player IDs must be unique across both clubs.');
      for(const [team,key] of [['belros','homeBenchData'],['zafran','awayBenchData']]){
        for(const raw of (Array.isArray(opts[key])?opts[key]:[]).slice(0,3)){
          const p=normaliseCareerPlayer(raw,matchdaySquads[team].length,team,true);
          if(seen.has(p.id))continue;seen.add(p.id);matchdaySquads[team].push(p);
        }
      }
    }
    allPlayers=[...matchdaySquads.belros,...matchdaySquads.zafran];byId=Object.fromEntries(allPlayers.map(p=>[p.id,p]));
    const homeNameRaw=String(opts.homeName||'HOME');
    const awayNameRaw=String(opts.awayName||'AWAY');
    const home={...TEAM_INFO.home,name:homeNameRaw.toUpperCase(),abbr:String(opts.homeAbbr||abbrForTeamName(homeNameRaw)).toUpperCase(),flag:String(opts.homeBadge||flagForTeamName(homeNameRaw))};
    const away={...TEAM_INFO.away,name:awayNameRaw.toUpperCase(),abbr:String(opts.awayAbbr||abbrForTeamName(awayNameRaw)).toUpperCase(),flag:String(opts.awayBadge||flagForTeamName(awayNameRaw))};
    Object.assign(teamMeta.belros,home,{attack:1,sourceTeam:'home'});Object.assign(teamMeta.zafran,away,{attack:-1,sourceTeam:'away'});
    hoops.belros=activeFixture.hoops.right.map(h=>({...h}));hoops.zafran=activeFixture.hoops.left.map(h=>({...h}));
    state.fixture={...(opts||{}),id:activeFixture.id,venue:activeFixture.venue,home:home.name,away:away.name,stage:String(opts.stage||'VELMORA MANAGER · WATCH MATCH')};state.assets={};state.assetsKey='';
    commentary.intro=[`Good evening from ${activeFixture.venue}. ${home.name} face ${away.name}.`,`${home.name} against ${away.name} — the teams are taking flight.`,`The Quaffle is ready and the referee has the whistle.`,`Three players per side. No Snitch. Goals, movement, defending and decision-making will settle it.`,`Welcome to ${activeFixture.venue} for ${home.name} vs ${away.name}.`];
    commentary.kickoff=[`The whistle goes — ${home.name} and ${away.name} are airborne!`,`We are under way at ${activeFixture.venue}!`,`The Quaffle is live. ${home.name} face ${away.name}.`,`Quidditch is live from ${activeFixture.venue}!`];
    refreshArenaAtmosphereDom();
  }


  const commentary = {
    intro:[
      'Good evening from the standard Repo Sports arena. Six players, one Quidditch stage, and absolutely nowhere to hide.',
      'The aurora is out, the stands are full, and I have been told the tea is technically still drinkable. Repo Sports Quidditch is nearly here.',
      'Two fresh sides enter the rotation. This should be a fascinating collision of styles.',
      'No Golden Snitch tonight. This match will be decided by goals, defending, discipline and whatever the referee decides VAR was invented for.',
      'The temperature is brutal. The atmosphere is not. Welcome to the Repo Sports Quidditch.'
    ],
    kickoff:[
      'The whistle goes — Belros and Zafran are airborne!',
      'We are under way at the standard Repo Sports arena!',
      'Brooms lift together and the first Repo Sports test is live!',
      'The Quaffle is live. Belros face Zafran, and my tea is already in danger.'
    ],
    pass:[
      ({from,to})=>`${from} moves it cleanly to ${to}.`,
      ({from,to})=>`A measured pass from ${from}; ${to} keeps the move alive.`,
      ({from,to})=>`${from} draws pressure and releases ${to}.`,
      ({from,to})=>`Quick circulation — ${from} finds ${to}.`,
      ({from,to})=>`${to} gives ${from} an angle and the ball arrives exactly on cue.`,
      ({from,to})=>`No wasted motion from ${from}; the Quaffle is already with ${to}.`,
      ({from,to})=>`${from} sends it through the lane to ${to}.`,
      ({from,to})=>`Good spacing. ${from} waits, then feeds ${to}.`,
      ({from,to})=>`The defence shifts and ${from} immediately finds ${to}.`,
      ({from,to})=>`${from} keeps possession moving — ${to} is the next link.`
    ],
    drive:[
      ({pet})=>`${pet} carries directly into the space ahead.`,
      ({pet})=>`${pet} accelerates and forces the defence backwards.`,
      ({pet})=>`A change of pace from ${pet}; the hoops are getting closer.`,
      ({pet})=>`${pet} keeps the Quaffle and attacks the gap.`,
      ({pet})=>`No pass this time — ${pet} drives straight through the middle.`
    ],
    intercept:[
      ({pet,from})=>`Brilliant anticipation from ${pet}! The pass from ${from} is gone.`,
      ({pet})=>`${pet} steps into the lane and steals the Quaffle cleanly!`,
      ({pet})=>`That is a proper interception from ${pet} — read before it was thrown.`,
      ({pet})=>`${pet} has seen the picture early and shut the passing lane.`,
      ({pet})=>`Possession changes hands! ${pet} gets there first.`,
      ({pet})=>`Outstanding defensive timing by ${pet}.`,
      ({pet})=>`${pet} turns defence into attack in one movement.`,
      ({pet})=>`The Quaffle was never arriving — ${pet} had already solved the pass.`
    ],
    shot:[
      ({pet})=>`${pet} sees the hoops and lets it fly!`,
      ({pet})=>`A shooting lane opens for ${pet}!`,
      ({pet})=>`${pet} goes for goal — watch the accuracy here.`,
      ({pet})=>`The release is quick from ${pet}; the Quaffle is travelling!`,
      ({pet})=>`${pet} commits to the shot!`,
      ({pet})=>`No second thought from ${pet}. This is heading for the hoops.`,
      ({pet})=>`${pet} takes the angle before the defence can close it.`
    ],
    goal:[
      ({pet,team,score})=>`GOAL! ${pet} for ${team}! ${score}.`,
      ({pet})=>`${pet} threads it through the hoop! That is beautifully placed.`,
      ({pet})=>`That is clinical from ${pet}! The netless target does not matter when the accuracy is that good.`,
      ({pet})=>`${pet} scores! The arena erupts!`,
      ({pet})=>`Right through the centre — ${pet} makes absolutely certain.`,
      ({pet})=>`A Repo Sports finish from ${pet}! No chance of keeping that out.`,
      ({pet})=>`The pressure becomes a goal and ${pet} is the name on it.`,
      ({pet})=>`Superb finish! ${pet} has picked the hoop and hit it.`,
      ({pet})=>`${pet} converts the opening — that attack deserved an ending.`,
      ({pet})=>`The Quaffle flies home! ${pet} wheels away to celebrate.`
    ],
    miss:[
      ({pet})=>`${pet} pulls it wide! The opening was there, the finish was not.`,
      ({pet})=>`Too high from ${pet}. The crowd could feel that chance building.`,
      ({pet})=>`${pet} misses the target — the angle narrowed faster than expected.`,
      ({pet})=>`That one drifts beyond the hoop. ${pet} knows it was available.`,
      ({pet})=>`A rare waste from ${pet}; both sides know those chances matter.`,
      ({pet})=>`${pet} had the right idea and the wrong final few inches.`
    ],
    save:[
      ({pet,defender})=>`${defender} gets across and denies ${pet}!`,
      ({defender})=>`Strong goal-line defending from ${defender}.`,
      ({defender})=>`${defender} reads the shot and gets something in the way.`,
      ({defender})=>`Saved! ${defender} has covered the hoop beautifully.`,
      ({defender})=>`That is excellent recovery from ${defender}.`
    ],
    post:[
      ({pet})=>`OFF THE RING! ${pet} was inches away.`,
      ({pet})=>`The metal says no to ${pet}! Rebound is live.`,
      ({pet})=>`${pet} clips the hoop and the Quaffle spins back into danger.`,
      ({pet})=>`A brutal sound for ${pet} — straight off the ring!`,
      ({pet})=>`So close! ${pet} finds metal rather than daylight.`
    ],
    rebound:[
      ({pet})=>`${pet} reacts first to the rebound.`,
      ({pet})=>`Loose Quaffle claimed by ${pet}.`,
      ({pet})=>`${pet} gathers the ricochet and this phase is not over yet.`,
      ({pet})=>`The ring sends it back and ${pet} is quickest to the second ball.`,
      ({pet})=>`${pet} wins the scramble beneath the hoops.`
    ],
    foul:[
      ({offender,victim})=>`WHISTLE! ${offender} catches ${victim} late.`,
      ({offender})=>`The referee has seen enough — foul against ${offender}.`,
      ({offender,victim})=>`${victim} is knocked off the line and ${offender} is immediately called for it.`,
      ({offender})=>`Too much broom, not enough Quaffle from ${offender}.`,
      ({offender})=>`${offender} mistimes the challenge. The referee is straight onto it.`,
      ({offender})=>`That is a dangerous angle from ${offender}; play stops.`
    ],
    penalty:[
      ({team})=>`Penalty to ${team}. Everyone clears away — this is one player, three hoops, one decision.`,
      ({pet})=>`${pet} has the penalty. The arena has suddenly become very quiet.`,
      ({pet})=>`A long look at the referee, a longer look at the hoops. ${pet} is ready.`,
      ({pet})=>`${pet} against the goal area. Nothing complicated now — just execution.`
    ],
    var:[
      'Hold on. They are checking this upstairs.',
      'VAR wants another look. Nobody move; apparently we have discovered paperwork on broomsticks.',
      'The referee has been called into the review. The stadium does not enjoy waiting.',
      'We are going frame by frame. Somewhere, somebody is drawing a very serious line.',
      'VAR check in progress. Every replay makes half the stadium more certain and the other half more furious.'
    ],
    halftime:[
      ()=>`Half-time at ${fixtureVenue()}. Nine minutes gone and nobody gets to hide from the numbers now.`,
      'That is the first half. Brooms down, breath visible, and plenty for both sides to discuss.',
      'The whistle ends the first nine minutes. We wait for CatAsthma to send them back out.'
    ],
    fulltime:[
      'FULL TIME! Eighteen minutes of Repo Sports Quidditch are complete.',
      ()=>`That is it at ${fixtureVenue()}. The referee checks the clock and brings the broadcast to full time.`,
      'The final whistle goes. No Snitch, no shortcut — this result was built one possession at a time.'
    ]
  };


  // Barry's live commentary is built combinatorially so matches have thousands of
  // short, event-specific calls without shipping a giant wall of duplicated text.
  function addCommentaryVariants(kind,prefixes,verbs,tails,builder){
    const bank=commentary[kind]||(commentary[kind]=[]);
    prefixes.forEach(prefix=>verbs.forEach(verb=>tails.forEach(tail=>{
      bank.push(data=>builder(prefix,verb,tail,data||{}));
    })));
  }
  function buildBarryCommentaryLibrary(){
    const passPrefixes=['','Quickly, ','Smartly, ','First time, ','Under pressure, ','With one look, ','On the move, ','Nice and simple: ','As the lane opens, ','Before the press arrives, ','With the defence shifting, ','Without breaking stride, ','Patiently, ','Good awareness: '];
    const passVerbs=['finds','feeds','releases','picks out','spots','serves','connects with','slides it to','moves it to','fizzes it to','loops it toward','nudges it to'];
    const passTails=['{to}.','{to} in stride.','{to} early.','{to} through the lane.','{to} with room.','{to} on the move.','{to} across the pitch.','{to} before pressure arrives.'];
    addCommentaryVariants('pass',passPrefixes,passVerbs,passTails,(a,b,c,d)=>`${a}${d.from} ${b} ${c.replace('{to}',d.to)}`);

    const drivePrefixes=['','Now ','Suddenly, ','With room, ','Directly, ','Through the middle, ','On the outside, ','With a burst, ','Head up, ','No pass here: '];
    const driveVerbs=['drives','surges','accelerates','pushes','carries','bursts','glides','cuts','powers','presses'];
    const driveTails=['forward.','into space.','at the defence.','toward the hoops.','through the gap.','past the first line.','into the final third.','with purpose.'];
    addCommentaryVariants('drive',drivePrefixes,driveVerbs,driveTails,(a,b,c,d)=>`${a}${d.pet} ${b} ${c}`);

    const interceptPrefixes=['','Excellent read: ','Sharp defending: ','Right on cue, ','Across the lane, ','With perfect timing, ','Out of nowhere, ','Tracking it all the way, ','Danger spotted, ','No hesitation, ','Goal-side and alert, ','That lane closes: '];
    const interceptVerbs=['reads it','cuts it out','steps in','wins it','takes it','gets there','claims it','snuffs it out','breaks it up','beats the pass','closes the lane','steals possession'];
    const interceptTails=['cleanly.','and turns play.','before it arrives.','at full stretch.','with room to break.','and the attack is over.','before the receiver can react.','then looks forward.'];
    addCommentaryVariants('intercept',interceptPrefixes,interceptVerbs,interceptTails,(a,b,c,d)=>`${a}${d.pet} ${b} ${c}`);

    const shotPrefixes=['','Here comes ','Space for ','A sight of goal for ','No hesitation from ','Opening there for ','The angle appears for ','One look from ','Pressure coming, but ','From range, '];
    const shotVerbs=['shoots','lets it go','takes it on','fires','releases','goes for goal','strikes','attacks the hoop','tries the angle','commits'];
    const shotTails=['now!','early!','through traffic!','with power!','across goal!','under pressure!','from distance!','before the gap closes!'];
    addCommentaryVariants('shot',shotPrefixes,shotVerbs,shotTails,(a,b,c,d)=>`${a}${d.pet} ${b} ${c}`);

    const goalPrefixes=['GOAL! ','It is in! ','Brilliant! ','Clinical! ','What a finish! ','That is superb! ','The arena erupts! ','Right through! ','No stopping that! ','They have their reward! ','Big moment! ','Beautifully done! '];
    const goalVerbs=['scores','converts','finds the hoop','finishes it','buries it','makes it count','puts it away','beats the defence','threads it home','ends the move'];
    const goalTails=['for {team}!','and it is {score}!','with real authority!','after a lovely move!','when it matters!','and wheels away!','from a tight angle!','to finish the attack!'];
    addCommentaryVariants('goal',goalPrefixes,goalVerbs,goalTails,(a,b,c,d)=>`${a}${d.pet} ${b} ${c.replace('{team}',d.team||'').replace('{score}',d.score||'')}`.replace(/\s+!/g,'!'));

    const missPrefixes=['','Just wide! ','Not quite! ','So close! ','That was there! ','A fraction off! ','The chance goes! ','The crowd gasps! ','Nearly! ','Agonisingly, '];
    const missVerbs=['pulls it wide','sends it high','misses the hoop','drags it across','cannot find the ring','flashes it past','gets the angle wrong','overhits it','sends it beyond','cannot convert'];
    const missTails=['this time.','under pressure.','by inches.','from there.','after good work.','at the last moment.','with the hoop defender beaten.'];
    addCommentaryVariants('miss',missPrefixes,missVerbs,missTails,(a,b,c,d)=>`${a}${d.pet} ${b} ${c}`);

    const savePrefixes=['SAVE! ','Excellent stop! ','Denied! ','Huge hands! ','Strong defending! ','Across in time! ','What a stop! ','Read perfectly! ','Goal protected! ','That is brave! '];
    const saveVerbs=['gets there','blocks it','turns it away','covers the hoop','shuts it down','makes the stop','meets the shot','gets across','denies the chance','holds firm'];
    const saveTails=['cleanly.','under pressure.','at full stretch.','just in time.','and keeps it out.','with a strong read.','before the rebound.','from close range.'];
    addCommentaryVariants('save',savePrefixes,saveVerbs,saveTails,(a,b,c,d)=>`${a}${d.defender} ${b} ${c}`);

    const postPrefixes=['OFF THE RING! ','Metal! ','So close! ','The ring saves them! ','What a sound! ','Inches away! ','Almost perfect! ','That rattles the hoop! '];
    const postVerbs=['clips it','strikes it','catches it','rattles it','finds metal','hits the frame','glances the ring','smashes the ring'];
    const postTails=['and it stays live.','with the rebound loose.','by inches.','after a fierce shot.','and everyone reacts.','before spinning clear.','with no luck at all.'];
    addCommentaryVariants('post',postPrefixes,postVerbs,postTails,(a,b,c,d)=>`${a}${d.pet} ${b} ${c}`);

    const reboundPrefixes=['','Loose ball: ','Rebound live: ','Second chance: ','Quick reaction: ','In the scramble, ','Off the ricochet, ','First to it: '];
    const reboundVerbs=['gathers it','claims it','gets there','wins it','collects it','takes control','reacts first','comes away with it'];
    const reboundTails=['cleanly.','under pressure.','and turns away.','before the defence.','to keep it alive.','with bodies around.','and resets the move.'];
    addCommentaryVariants('rebound',reboundPrefixes,reboundVerbs,reboundTails,(a,b,c,d)=>`${a}${d.pet} ${b} ${c}`);

    const foulPrefixes=['WHISTLE! ','Late one! ','The referee steps in! ','Too much contact! ','That is careless! ','Play stops! ','No advantage there! ','Immediate whistle! '];
    const foulVerbs=['catches {victim}','clips {victim}','arrives late on {victim}','blocks {victim}','leans into {victim}','takes out {victim}','overcommits on {victim}','mistimes it on {victim}'];
    const foulTails=['and is penalised.','too late.','with the ball gone.','and knows it.','right in front of the referee.','at a bad angle.','during the challenge.'];
    addCommentaryVariants('foul',foulPrefixes,foulVerbs,foulTails,(a,b,c,d)=>`${a}${d.offender} ${b.replace('{victim}',d.victim)} ${c}`);

    const penaltyPrefixes=['Penalty. ','Big chance now. ','The arena quietens. ','One player, three hoops. ','Everything stops here. ','Pressure moment. ','The referee clears the lane. ','This is isolated now. '];
    const penaltyVerbs=['steps up','takes responsibility','has the ball','faces the hoops','waits for the whistle','sets the angle','looks composed','has the chance'];
    const penaltyTails=['for {team}.','under real pressure.','with everyone watching.','and the crowd holds its breath.','for a huge opportunity.','before the attempt.'];
    addCommentaryVariants('penalty',penaltyPrefixes,penaltyVerbs,penaltyTails,(a,b,c,d)=>`${a}${d.pet} ${b} ${c.replace('{team}',d.team||'')}`);

    // Short phase calls add variety between events without Barry narrating every touch.
    commentary.counterattack=[]; commentary.chance=[]; commentary.pressure=[];
    const counterOpen=['Break on','Space ahead for','Turnover — now','They can run here:','This is opening for','Quick transition from','Numbers forward for','Suddenly there is room for'];
    const counterTail=['on the break.','with space.','into open ice.','before the shape resets.','and the defence is retreating.','with support arriving.','at real speed.','through the middle.'];
    counterOpen.forEach(a=>counterTail.forEach(c=>commentary.counterattack.push(d=>`${a} ${d.pet} ${c}`)));
    const chanceOpen=['Danger now:','This is promising:','Hoops in sight for','A real opening for','The defence is stretched:','They are close now:','Pressure building around','This could develop for'];
    const chanceTail=['has options.','is in range.','can attack this.','has the defence moving.','is asking the question.','has a shooting lane.','is getting closer.','has support nearby.'];
    chanceOpen.forEach(a=>chanceTail.forEach(c=>commentary.chance.push(d=>`${a} ${d.pet} ${c}`)));

    return Object.values(commentary).reduce((n,bank)=>n+(Array.isArray(bank)?bank.length:0),0);
  }
  const BARRY_COMMENTARY_VARIANTS=buildBarryCommentaryLibrary();
  const HAT_TRICK_BANNER_SRC='assets/repo-sports-v2/moment-popups/hat-trick.png?v=20260812b';
  const PENALTY_BANNER_SRC='assets/repo-sports-v2/moment-popups/penalty.png?v=20260812b';

  const state = {
    open:false, startedAt:0, seed:0, simRand:null, disciplineRand:null, visualRand:null, assets:{}, entities:[], ref:null,
    phase:'closed', introElapsed:0, matchTime:0, speed:1, half:1, firstKickoff:'belros',
    possession:'belros', carrier:null, lastPasser:null, zone:.18, passesSinceShot:0,
    actionTimer:2.4, delay:null, special:null, ball:{x:.5,y:.5,flight:null,visible:true},
    score:{belros:0,zafran:0}, shootout:null,
    teamStats:{}, playerStats:{}, camera:{x:.5,y:.5,zoom:1,tx:.5,ty:.5,tz:1,shake:0,vx:0,vy:0,vz:0,mode:'LIVE_BROADCAST'},
    eventBannerTimer:0, bigMomentTimer:0, celebration:null, reactionHistory:{},reactionSerial:0,refReaction:null,varContext:null, channel:null, subscribed:false,
    lastTs:0, raf:0, loreUsed:new Set(), introCue:-1, audioUnlocked:false, crowdBase:.18, crowdBoost:0,
    shootoutPending:false, opening:false, movementPulse:0, tacticalPulse:0, adminPreviewTimer:0, pendingPass:null, possessionChangedAt:0,
    broadcastState:'CLOSED', presentationKey:'', halftimeElapsed:0, halftimeReady:false, secondCountdown:0,
    fulltimeElapsed:0, fulltimeData:null, events:[], disciplineEvents:[], kickoffToss:null, kickoffReceiver:null, kickoffWatchdog:0, prematchAudioFailed:false,
    prediction:{pick:null,locked:false,resolved:false,correct:false,rewardPaid:false,rewardAttempted:false,rewardMessage:'',matchKey:'',counts:{belros:0,zafran:0,total:0},lastPoll:0,polling:false},
    replay:null,replayIntro:null,replayOutro:null,replayBuffer:[],replayCaptureAccum:0,replaySerial:0,lastReplayAt:-999,
    chanceBuild:null,matchFlow:null,storyGraphicTimer:34,storyGraphicUntil:0,storyGraphicIndex:0,
    fixture:null,broadcastSequence:{state:'complete',elapsed:0,serial:0,frozen:false,skipped:false},
    cameraDirector:{shot:'MAIN',timer:0,lastShot:'',cutSerial:0},
    broadcast:{lastSpokenAt:0,lastText:'',recent:[],recentSkeletons:[],queue:null,barryState:'NEUTRAL',barryPriority:0,barryUntil:0,barryTimer:0,talkTimer:0,phaseSeen:'',crowdLevel:.12,crowdTarget:.12,speaking:false,debugEvent:'IDLE',voiceName:'TEXT ONLY',variantCount:BARRY_COMMENTARY_VARIANTS},
    teamTactics:{belros:null,zafran:null},
    careerMode:false,onCareerComplete:null,onCareerClose:null,careerDelivered:false,audioDisabled:false,
    syncMode:false,headless:false,liveSerial:0,engineElapsed:0,simClockMs:0,syncAnchorElapsed:0,syncAnchorPerf:0,syncRunning:false,syncAwaitingFreshSample:false,syncLastSampleAt:0,fastForwarding:false,rotationQueued:false,rotationAnnounceAt:0,audioRand:null,commentaryRand:null,renderLead:0,
    localClockAnchorPerf:0,localClockAnchorElapsed:0,careerHeartbeat:0,lastRenderAt:0
  };

  const FIXED_SIM_DT=1/30;
  const LIVE_PLAYOUT_DELAY=.12; // tiny shared broadcast buffer; animation remains local/smooth
  function simNow(){return state.syncMode?state.simClockMs:performance.now()}
  function syncTargetElapsed(){
    // Never free-run from a stale sample while a tab is hidden or has just returned.
    // Once a fresh parent/server sample arrives, every visible client projects that
    // shared clock locally at full RAF speed — network packets do NOT drive frames.
    if(state.syncMode&&(document.hidden||state.syncAwaitingFreshSample))return Math.max(0,state.engineElapsed);
    return Math.max(0,state.syncAnchorElapsed+(state.syncRunning?(performance.now()-state.syncAnchorPerf)/1000:0));
  }

  function localTargetElapsed(){
    if(matchdayPaused())return Math.max(0,state.engineElapsed);
    if(!state.localClockAnchorPerf)return Math.max(0,state.engineElapsed);
    return Math.max(0,state.localClockAnchorElapsed+(performance.now()-state.localClockAnchorPerf)/1000);
  }
  function stopCareerHeartbeat(){
    if(state.careerHeartbeat){clearInterval(state.careerHeartbeat);state.careerHeartbeat=0}
  }
  function startCareerHeartbeat(){
    stopCareerHeartbeat();
    if(!state.careerMode||state.syncMode||state.headless)return;
    state.careerHeartbeat=setInterval(()=>{
      if(!state.open||!state.careerMode||state.syncMode||state.headless)return;
      try{
        const target=localTargetElapsed();
        catchUpTo(target,90,7);
        const now=performance.now();
        if(now-(state.lastRenderAt||0)>140){updateScoreUi();render();state.lastRenderAt=now}
      }catch(err){
        console.error('[VELMORA QUIDDITCH] career heartbeat recovered',err);
      }
    },100);
  }

  function blankTeamStats(){return {shots:0,onTarget:0,missedChances:0,passes:0,completed:0,interceptions:0,rebounds:0,fouls:0,yellowCards:0,redCards:0,penalties:0,var:0,possession:0,turnovers:0,counterattacks:0,presses:0,tacklesAttempted:0,tacklesWon:0}}
  function resetStats(){
    state.teamStats={belros:blankTeamStats(),zafran:blankTeamStats()};
    state.playerStats=Object.fromEntries(allPlayers.map(p=>[p.id,{goals:0,assists:0,shots:0,onTarget:0,missedChances:0,possession:0,tacklesAttempted:0,tacklesWon:0,interceptions:0,fouls:0,yellowCards:0,redCards:0,passes:0,completed:0,saves:0,rebounds:0}]));
  }


  function ensureV2StandingsStyles(){
    if(document.getElementById('wcgV2StandingsStyles'))return;
    const style=document.createElement('style');
    style.id='wcgV2StandingsStyles';
    style.textContent=`
      .wcg-v2-standings-board{position:relative;width:100%;min-width:0;height:780px;align-self:flex-start;margin:0}
      .wcg-v2-standings-frame{display:block;width:100%;height:780px;object-fit:fill;image-rendering:auto;filter:drop-shadow(0 10px 18px rgba(0,0,0,.42))}
      .wcg-v2-standings-surface{position:absolute;left:3.4%;right:3.4%;top:72px;bottom:28px;display:flex;flex-direction:column;overflow:hidden;color:#f3dfab}
      .wcg-v2-standings-kicker{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;width:100%;margin-bottom:7px;font-size:8px;letter-spacing:.12em;text-transform:uppercase;color:#8dbbe0}
      .wcg-v2-standings-kicker b{grid-column:2;justify-self:center;font-size:13px;line-height:1;letter-spacing:.065em;color:#f2ddb0;text-align:center;white-space:nowrap}
      .wcg-v2-standings-kicker span{grid-column:3;justify-self:end;text-align:right;white-space:nowrap}
      .wcg-v2-standings-head,.wcg-v2-standings-row{display:grid;grid-template-columns:18px minmax(72px,1fr) 22px 19px 19px 22px 22px 25px 37px;gap:2px;align-items:center;width:100%;box-sizing:border-box}
      .wcg-v2-standings-head{padding:6px 4px;margin-bottom:4px;border:1px solid rgba(207,167,76,.34);background:linear-gradient(180deg,rgba(18,49,75,.96),rgba(8,24,40,.96));box-shadow:inset 0 0 0 1px rgba(255,240,187,.05);font-size:7.5px;font-weight:800;letter-spacing:.035em;text-transform:uppercase;color:#9fd0f5}
      .wcg-v2-standings-head>span{text-align:center;white-space:nowrap}
      .wcg-v2-standings-head>span:nth-child(2){text-align:left;padding-left:1px}
      .wcg-v2-standings-body{display:flex;flex-direction:column;gap:2px;overflow:hidden;width:100%}
      .wcg-v2-standings-row{min-height:29px;padding:5px 4px;border:1px solid rgba(167,134,55,.25);background:linear-gradient(180deg,rgba(8,25,40,.96),rgba(7,20,33,.94));box-shadow:inset 0 0 0 1px rgba(255,236,180,.03);font-size:9px;line-height:1.05}
      .wcg-v2-standings-row.is-top{background:linear-gradient(180deg,rgba(72,54,18,.98),rgba(32,24,8,.95));border-color:rgba(224,182,77,.48)}
      .wcg-v2-standings-row:nth-child(even):not(.is-top){background:linear-gradient(180deg,rgba(10,31,49,.96),rgba(8,23,37,.94))}
      .wcg-v2-standings-row span{min-width:0}
      .wcg-v2-standings-pos{font-weight:800;color:#f6d98c;text-align:center}
      .wcg-v2-standings-team{display:flex;align-items:center;gap:4px;min-width:0;font-weight:700;color:#f6e8c6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-right:1px;font-size:8.5px}
      .wcg-v2-standings-team i{font-style:normal;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .wcg-v2-standings-flag{width:13px;height:9px;flex:0 0 13px;object-fit:cover;border:1px solid rgba(201,162,74,.55);box-shadow:0 1px 2px rgba(0,0,0,.35)}
      .wcg-v2-standings-num{font-weight:800;color:#f6d98c;text-align:center;font-size:8.5px;font-variant-numeric:tabular-nums}
      .wcg-v2-standings-rate{font-weight:800;color:#9fd6ff;text-align:center;font-size:8.25px;font-variant-numeric:tabular-nums}
      .wcg-v2-standings-empty{padding:14px 10px;text-align:center;font-size:12px;color:#9fb8ca;border:1px solid rgba(207,167,76,.18);background:rgba(5,18,28,.82)}
      /* Right rail: standings + Players are one stacked column, never separate grid rows. */
      #wcWorldCupBroadcast .wcg-v2-right-rail{
        grid-column:3!important;grid-row:1!important;display:flex!important;flex-direction:column!important;
        width:100%!important;min-width:0!important;align-self:start!important;justify-self:stretch!important;gap:6px!important;
        height:var(--wcg-v2-side-height,760px)!important;max-height:var(--wcg-v2-side-height,760px)!important;overflow:hidden!important;
      }
      #wcWorldCupBroadcast .wcg-v2-right-rail>.wcg-v2-standings-board{
        position:relative!important;inset:auto!important;width:100%!important;min-width:0!important;max-width:none!important;
        height:auto!important;min-height:0!important;flex:1 1 auto!important;margin:0!important;align-self:stretch!important;justify-self:stretch!important;overflow:visible!important;
      }
      #wcWorldCupBroadcast .wcg-v2-right-rail>.wcg-v2-standings-board .wcg-v2-standings-frame{height:100%!important}
      #wcWorldCupBroadcast .wcg-v2-right-rail>.wcg-v2-standings-board .wcg-v2-standings-body{
        flex:1 1 auto!important;display:grid!important;grid-template-rows:repeat(18,minmax(0,1fr))!important;gap:2px!important;min-height:0!important;overflow:hidden!important;
      }
      #wcWorldCupBroadcast .wcg-v2-right-rail>.wcg-v2-standings-board .wcg-v2-standings-row{
        min-height:0!important;height:auto!important;padding:3px 4px!important;
      }
      /* Legacy Mode launcher: visually sits between Standings and Players but contributes zero height,
         so the established side-panel geometry and shared bottom line never move. */
      #wcWorldCupBroadcast .wcg-v2-legacy-slot{
        position:relative!important;flex:0 0 0!important;height:0!important;min-height:0!important;
        margin:-3px 0!important;overflow:visible!important;z-index:40!important;pointer-events:none!important;
      }
      #wcWorldCupBroadcast .wcg-v2-legacy-launch{
        position:absolute!important;left:50%!important;top:0!important;transform:translate(-50%,-50%)!important;
        width:112px!important;height:50px!important;min-width:112px!important;min-height:50px!important;
        padding:2px 5px!important;border:0!important;border-radius:4px!important;background:rgba(2,8,14,.88)!important;
        box-shadow:0 4px 13px rgba(0,0,0,.78),0 0 0 1px rgba(199,149,45,.22)!important;
        cursor:pointer!important;pointer-events:auto!important;overflow:visible!important;z-index:41!important;
        transition:transform .14s ease,filter .14s ease,box-shadow .14s ease!important;
      }
      #wcWorldCupBroadcast .wcg-v2-legacy-launch img{
        display:block!important;width:102px!important;height:46px!important;max-width:none!important;margin:0 auto!important;
        object-fit:contain!important;image-rendering:auto!important;pointer-events:none!important;
        filter:drop-shadow(0 2px 2px rgba(0,0,0,.72))!important;
      }
      #wcWorldCupBroadcast .wcg-v2-legacy-launch:hover{
        transform:translate(-50%,-52%) scale(1.035)!important;filter:brightness(1.08) saturate(1.05)!important;
        box-shadow:0 5px 16px rgba(0,0,0,.82),0 0 9px rgba(241,190,61,.22)!important;
      }
      #wcWorldCupBroadcast .wcg-v2-legacy-launch:active{transform:translate(-50%,-48%) scale(.985)!important}
      #wcWorldCupBroadcast .wcg-v2-legacy-launch:focus-visible{outline:2px solid #ffe591!important;outline-offset:2px!important}
      @media(max-height:760px){
        #wcWorldCupBroadcast .wcg-v2-legacy-launch{width:102px!important;height:44px!important;padding:1px 4px!important}
        #wcWorldCupBroadcast .wcg-v2-legacy-launch img{width:94px!important;height:42px!important}
      }
      #wcWorldCupBroadcast .wcg-v2-players-board{
        position:relative!important;inset:auto!important;width:100%!important;min-width:0!important;max-width:none!important;
        height:auto!important;min-height:0!important;flex:0 0 clamp(318px,34%,342px)!important;margin:0!important;align-self:stretch!important;justify-self:stretch!important;overflow:visible!important;
      }
      #wcWorldCupBroadcast .wcg-v2-players-frame{display:block;width:100%!important;height:100%!important;object-fit:fill;image-rendering:auto;filter:drop-shadow(0 10px 18px rgba(0,0,0,.42));pointer-events:none;user-select:none}
      #wcWorldCupBroadcast .wcg-v2-players-surface{
        position:absolute;left:9.0%;right:8.2%;top:14.8%;bottom:8.0%;
        display:grid;grid-template-rows:1fr 1fr;gap:0;overflow:hidden;pointer-events:auto;
        color:#f4e4bc;font-family:Georgia,'Times New Roman',serif;
      }
      #wcWorldCupBroadcast .wcg-v2-players-panel-team{
        min-height:0;box-sizing:border-box;display:grid;grid-template-rows:15px minmax(0,1fr);gap:1px;padding:1px 0 4px;
        border-bottom:1px solid rgba(203,163,70,.42);
      }
      #wcWorldCupBroadcast .wcg-v2-players-panel-team:last-child{border-bottom:0;padding-top:2px;padding-bottom:5px}
      #wcWorldCupBroadcast .wcg-v2-players-panel-team-head{
        min-width:0;position:relative!important;display:block!important;padding:0 4px;box-sizing:border-box;
        color:#f3dda2;text-shadow:0 1px 2px #000;font:900 8px/1 monospace;letter-spacing:.055em;text-transform:uppercase;
      }
      #wcWorldCupBroadcast .wcg-v2-players-panel-team-head b{
        position:absolute!important;left:50%!important;top:50%!important;transform:translate(-50%,-50%)!important;
        width:64%!important;max-width:64%!important;min-width:0!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;
        font:900 8px/1 Georgia,serif;letter-spacing:.04em;text-align:center!important;
      }
      #wcWorldCupBroadcast .wcg-v2-players-panel-team-head small{position:absolute!important;right:4px!important;top:50%!important;transform:translateY(-50%)!important;flex:0 0 auto;color:#7fb8d8;font:800 5.5px/1 monospace;letter-spacing:.08em}
      #wcWorldCupBroadcast .wcg-v2-players-panel-team-flag{
        position:absolute!important;left:5px!important;top:50%!important;transform:translateY(-50%)!important;
        width:17px;height:11px;object-fit:cover;border:1px solid rgba(212,174,82,.58);image-rendering:pixelated
      }
      #wcWorldCupBroadcast .wcg-v2-player-tag-grid{
        min-height:0;display:grid;grid-template-columns:1fr;grid-template-rows:repeat(3,minmax(0,1fr));gap:2px;align-items:stretch;
      }
      #wcWorldCupBroadcast .wcg-v2-player-tag-slot{
        min-width:0;min-height:0;height:100%;display:flex;align-items:center;justify-content:center;
        padding:0 6px;overflow:visible;position:relative;
        background:linear-gradient(90deg,rgba(10,26,38,.16),rgba(10,26,38,.05) 50%,rgba(10,26,38,.16));
        border-bottom:1px solid rgba(193,154,67,.10);
      }
      #wcWorldCupBroadcast .wcg-v2-player-tag-grid .wcg-v2-player-tag-slot:last-child{border-bottom:0}
      #wcWorldCupBroadcast .wcg-v2-player-tag-slot>.pet-label{
        position:relative!important;inset:auto!important;left:auto!important;right:auto!important;bottom:auto!important;
        transform:none!important;margin:0!important;animation:none!important;transition:none!important;box-sizing:border-box!important;
      }
      /* Default and paid tags occupy the same clean 150:42 design box. */
      #wcWorldCupBroadcast .wcg-v2-player-tag-slot>.pet-label:not(.has-custom-nametag){
        width:150px!important;height:42px!important;min-width:0!important;max-width:88%!important;min-height:0!important;
        display:flex!important;align-items:center!important;justify-content:center!important;padding:0 12px!important;
        border:1px solid rgba(188,145,58,.58)!important;background:linear-gradient(180deg,rgba(12,34,50,.97),rgba(3,12,19,.97))!important;
        box-shadow:inset 0 0 10px rgba(72,132,164,.14),0 2px 5px #0009!important;color:#f5e1a5!important;
        aspect-ratio:150/42!important;
      }
      #wcWorldCupBroadcast .wcg-v2-player-tag-slot>.pet-label:not(.has-custom-nametag)>b{
        max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
        color:#f5e1a5!important;font:900 8px/1 Georgia,serif!important;letter-spacing:.025em;text-align:center;text-shadow:0 1px 1px #000;
      }
      #wcWorldCupBroadcast .wcg-v2-player-tag-slot .pet-label>small{display:none!important}
      #wcWorldCupBroadcast .wcg-v2-player-tag-slot>.pet-label.has-custom-nametag{
        width:auto!important;min-width:0!important;max-width:100%!important;height:auto!important;padding:0!important;border:0!important;
        display:flex!important;align-items:center!important;justify-content:center!important;
        background:transparent!important;box-shadow:none!important;filter:drop-shadow(0 2px 2px #000b)!important;overflow:visible!important;
      }
      #wcWorldCupBroadcast .wcg-v2-player-tag-slot .qm-custom-nametag{
        position:relative!important;display:block!important;
        width:150px!important;height:42px!important;max-width:88%!important;aspect-ratio:150/42!important;
        margin:0!important;overflow:visible!important;animation:none!important;transition:none!important;
        flex:0 0 auto!important;
      }
      #wcWorldCupBroadcast .wcg-v2-player-tag-slot .qm-custom-nametag>img{
        position:absolute!important;left:50%!important;top:50%!important;right:auto!important;bottom:auto!important;
        width:100%!important;height:100%!important;object-fit:contain!important;
        image-rendering:pixelated!important;pointer-events:none!important;filter:none!important;
        transform:translate(-50%,-50%) scale(var(--v2-tag-art-scale,1)) translate(var(--v2-tag-art-shift-x,0px),var(--v2-tag-art-shift-y,0px))!important;
        transform-origin:center center!important;animation:none!important;transition:none!important;
      }
      /* Rocky + CovidPanda/Nimbler plaques contain much more dead canvas than the other paid tags.
         Key these corrections to the V2 player slot, not the cosmetic id, so the visual sizing cannot miss. */
      #wcWorldCupBroadcast .wcg-v2-player-tag-slot[data-player-id="rocky"] .qm-custom-nametag>img:not(.wcg-v2-score-effect){--v2-tag-art-scale:1.68!important}
      #wcWorldCupBroadcast .wcg-v2-player-tag-slot[data-player-id="nimbler2000"] .qm-custom-nametag>img:not(.wcg-v2-score-effect){--v2-tag-art-scale:1.80!important}
      #wcWorldCupBroadcast .wcg-v2-player-tag-slot[data-player-id="rocky"] .qm-custom-nametag>b{font-size:8.7px!important}
      #wcWorldCupBroadcast .wcg-v2-player-tag-slot[data-player-id="nimbler2000"] .qm-custom-nametag>b{font-size:7.6px!important;top:5px!important;bottom:-5px!important}
      #wcWorldCupBroadcast .wcg-v2-player-tag-slot .qm-custom-nametag>b{
        position:absolute!important;z-index:3!important;left:var(--qm-tag-left,14%)!important;right:var(--qm-tag-right,10%)!important;
        top:0!important;bottom:0!important;transform:none!important;
        display:flex!important;align-items:center!important;justify-content:center!important;width:auto!important;max-width:none!important;
        margin:0!important;padding:0!important;border:0!important;background:transparent!important;
        overflow:hidden!important;text-overflow:clip!important;white-space:nowrap!important;text-align:center!important;
        color:var(--qm-tag-text,#fff)!important;font-family:var(--qm-tag-font,Georgia,serif)!important;
        font-size:clamp(6.4px,calc(var(--qm-tag-size,8px) * .94),8.8px)!important;font-weight:var(--qm-tag-weight,900)!important;line-height:1!important;
        text-shadow:-1px -1px 0 var(--qm-tag-outline,#000),1px -1px 0 var(--qm-tag-outline,#000),-1px 1px 0 var(--qm-tag-outline,#000),1px 1px 0 var(--qm-tag-outline,#000),0 1px 2px #000!important;
        animation:none!important;transition:none!important;
      }
      /* Paid nametag score specials inside the Players rail. Base plaque stays above the effect. */
      #wcWorldCupBroadcast .wcg-v2-player-tag-slot .qm-custom-nametag{isolation:isolate!important}
      #wcWorldCupBroadcast .wcg-v2-player-tag-slot .qm-custom-nametag>img:not(.wcg-v2-score-effect){z-index:2!important}
      #wcWorldCupBroadcast .wcg-v2-player-tag-slot .qm-custom-nametag>.wcg-v2-score-effect{
        position:absolute!important;pointer-events:none!important;image-rendering:pixelated!important;max-width:none!important;max-height:none!important;
        animation:none!important;transition:none!important;filter:drop-shadow(0 2px 3px rgba(0,0,0,.55))!important;z-index:4!important;
      }
      #wcWorldCupBroadcast .wcg-v2-player-tag-slot .qm-custom-nametag>.wcg-v2-wyrmfire-score-fire{left:50%!important;right:auto!important;top:auto!important;bottom:15px!important;width:76px!important;height:102px!important;object-fit:contain!important;object-position:center bottom!important;transform:translateX(-50%)!important;z-index:1!important}
      #wcWorldCupBroadcast .wcg-v2-player-tag-slot .qm-custom-nametag>.wcg-v2-tea-score-dunk{left:50%!important;right:auto!important;top:auto!important;bottom:-13px!important;width:64px!important;height:154px!important;object-fit:fill!important;object-position:center bottom!important;transform:translateX(-50%)!important;z-index:1!important}
      #wcWorldCupBroadcast .wcg-v2-player-tag-slot .qm-custom-nametag>.wcg-v2-verdant-score-growth{left:50%!important;right:auto!important;top:auto!important;bottom:12px!important;width:84px!important;height:84px!important;object-fit:contain!important;object-position:center bottom!important;transform:translateX(-50%)!important;z-index:1!important}
      #wcWorldCupBroadcast .wcg-v2-player-tag-slot .qm-custom-nametag>.wcg-v2-panda-score-swipe{left:50%!important;right:auto!important;top:auto!important;bottom:var(--v2-panda-bottom,-10px)!important;width:var(--v2-panda-width,118px)!important;height:auto!important;object-fit:contain!important;transform:translateX(-50%)!important;z-index:5!important}
      #wcWorldCupBroadcast .wcg-v2-player-tag-slot .qm-custom-nametag>.wcg-v2-starry-layer{position:absolute!important;left:var(--v2-starry-left,50%)!important;top:var(--v2-starry-top,50%)!important;width:var(--v2-starry-width,88%)!important;height:var(--v2-starry-height,72%)!important;transform:translate(-50%,-50%)!important;pointer-events:none!important;overflow:visible!important;z-index:1!important}
      #wcWorldCupBroadcast .wcg-v2-player-tag-slot .qm-custom-nametag>.wcg-v2-starry-layer>.wcg-v2-starry-glow{position:absolute;left:50%;top:54%;width:100%;height:100%;transform:translate(-50%,-50%);border-radius:999px;background:radial-gradient(circle at 50% 50%,rgba(234,244,255,.55) 0 12%,rgba(109,161,255,.34) 22%,rgba(34,72,168,.28) 45%,rgba(11,18,44,0) 78%);filter:blur(.35px) drop-shadow(0 0 7px rgba(122,174,255,.58));opacity:0;animation:wcgV2StarryGlow 1.8s ease-out forwards}
      #wcWorldCupBroadcast .wcg-v2-player-tag-slot .qm-custom-nametag>.wcg-v2-starry-layer>.wcg-v2-starry-star{position:absolute;left:var(--x,50%);top:var(--y,50%);width:var(--size,6px);height:var(--size,6px);margin-left:calc(var(--size,6px) * -.5);margin-top:calc(var(--size,6px) * -.5);border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.98) 0 24%,rgba(230,241,255,.98) 26%,rgba(160,202,255,.84) 48%,rgba(65,112,255,.28) 70%,rgba(17,31,80,0) 82%);box-shadow:0 0 0.5px rgba(255,255,255,.95),0 0 4px rgba(134,178,255,.72);opacity:0;transform:translate3d(0,0,0) scale(.45);animation:wcgV2StarryTwinkle var(--dur,980ms) ease-in-out var(--delay,0ms) forwards}
      #wcWorldCupBroadcast .wcg-v2-player-tag-slot .qm-custom-nametag>.wcg-v2-starry-layer>.wcg-v2-starry-star::before,#wcWorldCupBroadcast .wcg-v2-player-tag-slot .qm-custom-nametag>.wcg-v2-starry-layer>.wcg-v2-starry-star::after{content:'';position:absolute;left:50%;top:50%;background:linear-gradient(180deg,rgba(255,255,255,.92),rgba(186,218,255,.15));transform:translate(-50%,-50%);border-radius:999px;opacity:.88}
      #wcWorldCupBroadcast .wcg-v2-player-tag-slot .qm-custom-nametag>.wcg-v2-starry-layer>.wcg-v2-starry-star::before{width:1px;height:calc(var(--size,6px) * 1.9)}
      #wcWorldCupBroadcast .wcg-v2-player-tag-slot .qm-custom-nametag>.wcg-v2-starry-layer>.wcg-v2-starry-star::after{width:calc(var(--size,6px) * 1.9);height:1px}
      @keyframes wcgV2StarryGlow{0%{opacity:0;transform:translate(-50%,-50%) scale(.82)}20%{opacity:.98}100%{opacity:0;transform:translate(-50%,-50%) scale(1.18)}}
      @keyframes wcgV2StarryTwinkle{0%{opacity:0;transform:translate3d(0,0,0) scale(.3)}18%{opacity:1;transform:translate3d(calc(var(--drift-x,0px)*.18),calc(var(--drift-y,0px)*.18),0) scale(1.05)}52%{opacity:.92;transform:translate3d(calc(var(--drift-x,0px)*.62),calc(var(--drift-y,0px)*.62),0) scale(.92)}100%{opacity:0;transform:translate3d(var(--drift-x,0px),var(--drift-y,0px),0) scale(.4)}}
      #wcWorldCupBroadcast .wcg-v2-player-tag-slot .pet-label.wcg-v2-dreamies-score-pop>.qm-custom-nametag{animation:wcgV2DreamiesTagNudge .50s ease-out both!important}
      #wcWorldCupBroadcast .wcg-v2-player-tag-slot .pet-label.wcg-v2-any-score-pop>.qm-custom-nametag{animation:wcgV2AnyScoreCardPop .72s cubic-bezier(.18,.8,.24,1) both!important}
      @keyframes wcgV2DreamiesTagNudge{0%,100%{filter:none;transform:scale(1)}38%{filter:brightness(1.18) drop-shadow(0 0 7px rgba(255,224,112,.82));transform:scale(1.07)}}
      @keyframes wcgV2AnyScoreCardPop{0%,100%{filter:drop-shadow(0 2px 2px #000b);transform:scale(1)}24%{filter:brightness(1.28) saturate(1.12) drop-shadow(0 0 8px rgba(255,213,91,.95));transform:scale(1.075)}55%{filter:brightness(1.10) drop-shadow(0 0 4px rgba(255,224,132,.7));transform:scale(1.015)}}
      #wcWorldCupBroadcast .wcg-v2-player-tag-slot.wcg-v2-score-slot-pop::after{content:'';position:absolute;left:50%;top:50%;width:82%;height:72%;transform:translate(-50%,-50%);border:1px solid rgba(255,218,112,.9);box-shadow:0 0 10px rgba(255,191,54,.65),inset 0 0 8px rgba(255,230,155,.25);opacity:0;pointer-events:none;z-index:20;animation:wcgV2ScoreSlotFlash .76s ease-out both}
      @keyframes wcgV2ScoreSlotFlash{0%{opacity:0;transform:translate(-50%,-50%) scale(.86)}22%{opacity:1}100%{opacity:0;transform:translate(-50%,-50%) scale(1.12)}}
      #wcWorldCupBroadcast .wcg-v2-dreamies-treat{position:absolute;z-index:18;width:23px;height:23px;object-fit:fill;image-rendering:pixelated;pointer-events:none;filter:drop-shadow(0 1px 2px rgba(0,0,0,.55));will-change:transform,opacity}
      #wcWorldCupBroadcast .wcg-v2-cherry-layer{position:absolute!important;left:var(--v2-cherry-left,50%)!important;top:var(--v2-cherry-top,100%)!important;width:var(--v2-cherry-width,92%)!important;height:80px!important;transform:translateX(-50%)!important;pointer-events:none!important;overflow:visible!important;z-index:5!important}
      #wcWorldCupBroadcast .wcg-v2-cherry-petal{position:absolute;left:var(--x);top:-2px;width:var(--size);height:calc(var(--size)*.68);opacity:0;border-radius:70% 25% 70% 30%;background:radial-gradient(circle at 28% 28%,#fff 0 18%,#ffddea 24%,#f7a9c5 58%,#d95f91 100%);box-shadow:0 0 1px rgba(255,230,240,.9),0 1px 2px rgba(98,30,62,.25);transform-origin:50% 50%;animation:wcgV2CherryPetalFall var(--duration) cubic-bezier(.18,.65,.38,1) var(--delay) forwards;will-change:transform,opacity}
      #wcWorldCupBroadcast .wcg-v2-cherry-petal::after{content:'';position:absolute;inset:14% 37% 10% 42%;border-radius:50%;background:rgba(255,255,255,.42);transform:rotate(20deg)}
      @keyframes wcgV2CherryPetalFall{0%{opacity:0;transform:translate3d(0,-3px,0) rotate(var(--r0)) scale(.8)}10%{opacity:.98}35%{transform:translate3d(var(--sway1),18px,0) rotate(var(--r1)) scale(1)}68%{transform:translate3d(var(--sway2),39px,0) rotate(var(--r2)) scale(.96)}100%{opacity:0;transform:translate3d(var(--sway3),64px,0) rotate(var(--r3)) scale(.82)}}
      #wcWorldCupBroadcast .wcg-v2-player-tag-loading{grid-column:1/-1;align-self:center;text-align:center;color:#789bb0;font:800 6px/1.3 monospace;letter-spacing:.08em}
      @media(max-height:920px){
        #wcWorldCupBroadcast .wcg-v2-players-board{flex-basis:300px!important}
        #wcWorldCupBroadcast .wcg-v2-players-surface{left:9.0%!important;right:8.2%!important;top:14.6%!important;bottom:8.0%!important}
        #wcWorldCupBroadcast .wcg-v2-players-panel-team{grid-template-rows:14px minmax(0,1fr)!important;gap:1px!important;padding-top:1px!important;padding-bottom:3px!important}
        #wcWorldCupBroadcast .wcg-v2-players-panel-team-head b{font-size:7px!important}
        #wcWorldCupBroadcast .wcg-v2-players-panel-team-head small{font-size:5px!important}
        #wcWorldCupBroadcast .wcg-v2-players-panel-team-flag{width:14px!important;height:9px!important;flex-basis:14px!important}
        #wcWorldCupBroadcast .wcg-v2-player-tag-grid{gap:1px!important}
        #wcWorldCupBroadcast .wcg-v2-player-tag-slot{padding-left:5px!important;padding-right:5px!important}
        #wcWorldCupBroadcast .wcg-v2-player-tag-slot .qm-custom-nametag{width:136px!important;height:38px!important;max-width:88%!important}
        #wcWorldCupBroadcast .wcg-v2-player-tag-slot .qm-custom-nametag>b{font-size:clamp(6.8px,calc(var(--qm-tag-size,8px) * .98),9px)!important}
        #wcWorldCupBroadcast .wcg-v2-player-tag-slot>.pet-label:not(.has-custom-nametag){width:136px!important;height:38px!important;max-width:88%!important}
        #wcWorldCupBroadcast .wcg-v2-player-tag-slot>.pet-label:not(.has-custom-nametag)>b{font-size:8.5px!important}
        #wcWorldCupBroadcast .wcg-v2-standings-surface{top:58px!important;bottom:22px!important}
      }
      @media(max-height:760px){
        #wcWorldCupBroadcast .wcg-v2-players-board{flex-basis:270px!important}
        #wcWorldCupBroadcast .wcg-v2-player-tag-slot .qm-custom-nametag{width:120px!important;height:34px!important;max-width:88%!important}
        #wcWorldCupBroadcast .wcg-v2-player-tag-slot>.pet-label:not(.has-custom-nametag){width:120px!important;height:34px!important;max-width:88%!important}
      }
      /* SIDE HEIGHT MASTER — left records defines the shared bottom line; right rail can never pass it. */
      #wcWorldCupBroadcast.is-open .wcg-v2-broadcast-layout{
        align-items:start!important;min-height:0!important;height:auto!important;
      }
      #wcWorldCupBroadcast .wcg-v2-tv-column{align-self:start!important;min-height:0!important}
      #wcWorldCupBroadcast .wcg-v2-career-board{
        align-self:start!important;height:var(--wcg-v2-side-height,760px)!important;
        min-height:0!important;max-height:var(--wcg-v2-side-height,760px)!important;overflow:hidden!important;
      }
      #wcWorldCupBroadcast #wcgCareerBoard.wcg-v2-career-stack{
        min-height:0!important;overflow:hidden!important;
      }
      #wcWorldCupBroadcast #wcgCareerBoard .wcg-v2-career-section,
      #wcWorldCupBroadcast #wcgCareerBoard .wcg-v2-career-rows{min-height:0!important}
      #wcWorldCupBroadcast .wcg-v2-right-rail{
        align-self:start!important;height:var(--wcg-v2-side-height,760px)!important;
        min-height:0!important;max-height:var(--wcg-v2-side-height,760px)!important;overflow:hidden!important;
      }
      #wcWorldCupBroadcast .wcg-v2-right-rail>.wcg-v2-standings-board{min-height:0!important;overflow:hidden!important}
      #wcWorldCupBroadcast .wcg-v2-right-rail>.wcg-v2-players-board{overflow:hidden!important}

      /* LIVE STORY / TREND CARDS — use the whole broadcast rectangle instead of a tiny left text column. */
      #wcWorldCupBroadcast .wcg-story-card{
        display:grid!important;grid-template-columns:auto minmax(0,1fr) auto!important;align-items:center!important;
        column-gap:10px!important;box-sizing:border-box!important;padding:9px 12px!important;overflow:hidden!important;
      }
      #wcWorldCupBroadcast .wcg-story-flag{
        position:relative!important;inset:auto!important;float:none!important;width:34px!important;height:34px!important;
        min-width:34px!important;place-items:center!important;margin:0!important;align-self:center!important;
      }
      #wcWorldCupBroadcast .wcg-story-flag img{width:100%!important;height:100%!important;object-fit:contain!important;display:block!important}
      #wcWorldCupBroadcast .wcg-story-copy{
        position:relative!important;inset:auto!important;left:auto!important;right:auto!important;top:auto!important;bottom:auto!important;
        width:100%!important;max-width:none!important;min-width:0!important;height:auto!important;max-height:none!important;
        margin:0!important;padding:0!important;overflow:visible!important;box-sizing:border-box!important;align-self:center!important;
      }
      #wcWorldCupBroadcast .wcg-story-copy small,
      #wcWorldCupBroadcast .wcg-story-copy b,
      #wcWorldCupBroadcast .wcg-story-copy span{
        display:block!important;width:100%!important;max-width:none!important;margin:0!important;padding:0!important;
        overflow:visible!important;text-overflow:clip!important;box-sizing:border-box!important;
      }
      #wcWorldCupBroadcast .wcg-story-copy small{white-space:nowrap!important;font-size:8px!important;line-height:1.05!important;letter-spacing:.12em!important}
      #wcWorldCupBroadcast .wcg-story-copy b{white-space:normal!important;font-size:clamp(17px,1.35vw,24px)!important;line-height:.98!important;margin-top:2px!important}
      #wcWorldCupBroadcast .wcg-story-copy span{white-space:normal!important;font-size:10px!important;line-height:1.18!important;margin-top:3px!important}
      #wcWorldCupBroadcast .wcg-story-player{
        position:relative!important;inset:auto!important;left:auto!important;right:auto!important;top:auto!important;bottom:auto!important;
        width:68px!important;height:72px!important;max-width:68px!important;max-height:72px!important;object-fit:contain!important;
        margin:-7px 0 -9px 4px!important;align-self:end!important;justify-self:end!important;transform:none!important;
      }
    `;
    document.head.appendChild(style);
  }


function ensureBigMomentStyles(){
  if(document.getElementById('wcgBigMomentStyles'))return;
  const style=document.createElement('style');style.id='wcgBigMomentStyles';
  style.textContent=`
    #wcWorldCupBroadcast .wcg-big-moment{position:absolute!important;inset:0!important;display:flex!important;align-items:center!important;justify-content:center!important;pointer-events:none!important;z-index:58!important;opacity:0;visibility:hidden;overflow:hidden!important}
    #wcWorldCupBroadcast .wcg-big-moment.is-visible{opacity:1;visibility:visible}
    #wcWorldCupBroadcast .wcg-big-moment-flash{position:absolute;inset:0;background:radial-gradient(circle at 50% 48%,rgba(255,238,183,.34),rgba(255,111,43,.17) 22%,rgba(6,16,28,0) 60%);opacity:0;mix-blend-mode:screen}
    #wcWorldCupBroadcast .wcg-big-moment-img{position:relative;display:block;max-width:min(78%,980px);max-height:34%;width:auto;height:auto;object-fit:contain;transform:translateY(20px) scale(.88);opacity:0;filter:drop-shadow(0 10px 0 rgba(4,12,21,.52)) drop-shadow(0 0 24px rgba(255,218,101,.30));image-rendering:auto}
    #wcWorldCupBroadcast .wcg-big-moment[data-kind="penalty"] .wcg-big-moment-img{max-width:min(70%,860px);max-height:31%;filter:drop-shadow(0 10px 0 rgba(4,12,21,.58)) drop-shadow(0 0 24px rgba(255,122,63,.28))}
    #wcWorldCupBroadcast .wcg-big-moment-particles{position:absolute;inset:0;overflow:hidden;pointer-events:none}
    #wcWorldCupBroadcast .wcg-big-moment-particle{position:absolute;left:50%;top:50%;width:7px;height:7px;border-radius:50%;background:radial-gradient(circle,#fff9df 0,#ffd35d 32%,rgba(255,139,31,.8) 64%,rgba(255,139,31,0) 100%);box-shadow:0 0 9px rgba(255,219,103,.9),0 0 18px rgba(255,123,29,.5);opacity:0;transform:translate(-50%,-50%) scale(.2)}
    #wcWorldCupBroadcast .wcg-big-moment[data-kind="penalty"] .wcg-big-moment-particle{background:radial-gradient(circle,#fff7df 0,#ffc65c 34%,rgba(233,67,35,.82) 66%,rgba(233,67,35,0) 100%)}
    #wcWorldCupBroadcast .wcg-big-moment.is-animate .wcg-big-moment-flash{animation:wcgBigMomentFlash 2.15s ease forwards}
    #wcWorldCupBroadcast .wcg-big-moment.is-animate .wcg-big-moment-img{animation:wcgBigMomentPop 2.15s cubic-bezier(.18,.88,.2,1) forwards}
    #wcWorldCupBroadcast .wcg-big-moment.is-animate .wcg-big-moment-particle{animation:wcgBigMomentParticle var(--dur,1.5s) cubic-bezier(.13,.85,.2,1) forwards;animation-delay:var(--delay,0s)}
    @keyframes wcgBigMomentFlash{0%{opacity:0}7%{opacity:1}24%{opacity:.9}72%{opacity:.24}100%{opacity:0}}
    @keyframes wcgBigMomentPop{0%{opacity:0;transform:translateY(20px) scale(.88)}9%{opacity:1;transform:translateY(-8px) scale(1.075)}21%{opacity:1;transform:translateY(0) scale(1)}76%{opacity:1;transform:translateY(0) scale(1)}100%{opacity:0;transform:translateY(-7px) scale(.98)}}
    @keyframes wcgBigMomentParticle{0%{opacity:0;transform:translate(-50%,-50%) rotate(var(--rot)) translateX(0) scale(.15)}10%{opacity:1}72%{opacity:.9}100%{opacity:0;transform:translate(-50%,-50%) rotate(var(--rot)) translateX(var(--dist)) translateY(var(--rise)) scale(.9)}}
  `;document.head.appendChild(style);
}

  function v2StandingsData(){
    const byName=new Map();
    const list=Array.isArray(v2CareerState.data?.team_leaders)?v2CareerState.data.team_leaders:[];
    list.forEach((item,idx)=>{
      const key=String(item?.team_name||'').trim().toLowerCase();
      if(key)byName.set(key,{...item,_sourceIndex:idx});
    });
    return V2_LEAGUE_TEAMS.map((team_name,index)=>{
      const item=byName.get(team_name.toLowerCase())||{};
      const wins=Math.max(0,Number(item.wins||0));
      const matches=Math.max(wins,Number(item.matches||0));
      const losses=Math.max(0,Number(item.losses ?? (matches-wins) ?? 0));
      const gf=Math.max(0,Number(item.goals_for||0));
      const ga=Math.max(0,Number(item.goals_against||0));
      const gd=gf-ga;
      const wr=matches>0?(wins/matches)*100:Number(item.win_rate||0)||0;
      return {rankSeed:index,team_name,wins,losses,gf,ga,gd,wr,matches};
    }).sort((a,b)=>{
      if(b.wins!==a.wins)return b.wins-a.wins;
      if(b.gd!==a.gd)return b.gd-a.gd;
      if(b.gf!==a.gf)return b.gf-a.gf;
      if(a.losses!==b.losses)return a.losses-b.losses;
      return a.rankSeed-b.rankSeed;
    }).map((row,idx)=>({...row,pos:idx+1}));
  }

  function renderV2StandingsBoard(){
    const body=$('wcgStandingsRows');
    if(!body)return;
    const rows=v2StandingsData();
    if(!rows.length){
      body.innerHTML='<div class="wcg-v2-standings-empty">No standings available yet.</div>';
      return;
    }
    body.innerHTML=rows.map((row,index)=>`<div class="wcg-v2-standings-row${index===0?' is-top':''}"><span class="wcg-v2-standings-pos">${row.pos}</span><span class="wcg-v2-standings-team" title="${v2CareerEscape(row.team_name)}"><img class="wcg-v2-standings-flag" src="${flagForTeamName(row.team_name)}" alt=""><i>${v2CareerEscape(row.team_name)}</i></span><span class="wcg-v2-standings-num">${row.matches}</span><span class="wcg-v2-standings-num">${row.wins}</span><span class="wcg-v2-standings-num">${row.losses}</span><span class="wcg-v2-standings-num">${row.gf}</span><span class="wcg-v2-standings-num">${row.ga}</span><span class="wcg-v2-standings-num">${row.gd>0?`+${row.gd}`:row.gd}</span><span class="wcg-v2-standings-rate">${row.wr.toFixed(1)}%</span></div>`).join('');
  }

  const v2PlayerTagsState={rows:new Map(),lastRefresh:0,pending:false,seq:0,requestId:'',timeout:0,signature:''};

  function v2PlayerTagEscape(value){
    return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }

  function v2PlayerTagRequestRows(){
    return ['belros','zafran'].flatMap(team=>roster[team].map(player=>({
      id:player.id,
      name:player.name,
      owner:V2_PLAYER_OWNERS[player.id]||'',
      team,
      teamName:teamMeta[team].name
    })));
  }


  const v2NametagArtBoundsCache=new Map();
  function normalizeV2PlayerTagArtwork(root=$('wcgPlayersSlots')){
    if(!root)return;
    root.querySelectorAll('.wcg-v2-player-tag-slot .qm-custom-nametag>img:not(.wcg-v2-score-effect)').forEach(img=>{
      const apply=()=>{
        const box=img.closest('.qm-custom-nametag');if(!box||!img.naturalWidth||!img.naturalHeight)return;
        const key=String(img.currentSrc||img.src||'');
        const finish=bounds=>{
          if(!bounds)return;
          const bw=Math.max(1,bounds.x1-bounds.x0+1),bh=Math.max(1,bounds.y1-bounds.y0+1);
          const iw=img.naturalWidth,ih=img.naturalHeight;
          const boxW=Math.max(1,box.clientWidth||150),boxH=Math.max(1,box.clientHeight||42);
          // Account for object-fit:contain FIRST. Narrower source images (Rocky's
          // parchment and the PANDA plaque) used to occupy only ~half the common box.
          const fit=Math.min(boxW/iw,boxH/ih);
          const visibleW=Math.max(1,bw*fit),visibleH=Math.max(1,bh*fit);
          const targetVisibleW=boxW*.84;
          const maxVisibleH=boxH*1.58;
          let scale=Math.min(targetVisibleW/visibleW,maxVisibleH/visibleH,2.65);
          // Preserve already-good standard 150:42 tags while guaranteeing the two
          // naturally narrow premium plaques are no longer visually undersized.
          const tagId=String(box.closest('.pet-label')?.dataset?.nametag||'');
          if(tagId==='nametag_panda_rare')scale=Math.max(scale,1.46);
          if(tagId==='nametag_ancient_parchment')scale=Math.max(scale,1.28);
          scale=Math.max(.72,scale);
          const cx=(bounds.x0+bounds.x1+1)/2,cy=(bounds.y0+bounds.y1+1)/2;
          const shiftX=((iw/2-cx)*fit)/Math.max(.01,scale);
          const shiftY=((ih/2-cy)*fit)/Math.max(.01,scale);
          img.style.setProperty('--v2-tag-art-scale',String(scale));
          img.style.setProperty('--v2-tag-art-shift-x',`${shiftX.toFixed(2)}px`);
          img.style.setProperty('--v2-tag-art-shift-y',`${shiftY.toFixed(2)}px`);
        };
        if(v2NametagArtBoundsCache.has(key)){finish(v2NametagArtBoundsCache.get(key));return;}
        try{
          const max=256,ratio=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));
          const w=Math.max(1,Math.round(img.naturalWidth*ratio)),h=Math.max(1,Math.round(img.naturalHeight*ratio));
          const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
          const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)return;
          ctx.clearRect(0,0,w,h);ctx.drawImage(img,0,0,w,h);
          const data=ctx.getImageData(0,0,w,h).data;let x0=w,y0=h,x1=-1,y1=-1;
          for(let y=0;y<h;y++)for(let x=0;x<w;x++){
            if(data[(y*w+x)*4+3]<18)continue;
            if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;
          }
          const b=x1>=x0&&y1>=y0?{x0:x0/ratio,y0:y0/ratio,x1:(x1+1)/ratio-1,y1:(y1+1)/ratio-1}:null;
          v2NametagArtBoundsCache.set(key,b);finish(b);
        }catch(_){v2NametagArtBoundsCache.set(key,null);}
      };
      if(img.complete&&img.naturalWidth)requestAnimationFrame(apply);
      else img.addEventListener('load',()=>requestAnimationFrame(apply),{once:true});
    });
  }

  function renderV2PlayerTags(){
    const surface=$('wcgPlayersSlots');if(!surface)return;
    const sides=['belros','zafran'];
    surface.innerHTML=sides.map((team,index)=>{
      const sideLabel=index===0?'LEFT TEAM':'RIGHT TEAM';
      const tags=roster[team].map(player=>{
        const row=v2PlayerTagsState.rows.get(player.id);
        const fallbackName=row?.petName||player.name;
        const markup=row?.markup||`<div class="pet-label"><b>${v2PlayerTagEscape(fallbackName)}</b><small></small></div>`;
        const owner=V2_PLAYER_OWNERS[player.id]||'';
        return `<div class="wcg-v2-player-tag-slot" data-player-id="${v2PlayerTagEscape(player.id)}" title="${v2PlayerTagEscape(fallbackName)}${owner?` · ${v2PlayerTagEscape(owner)}`:''}">${markup}</div>`;
      }).join('');
      return `<section class="wcg-v2-players-panel-team is-${team}">
        <div class="wcg-v2-players-panel-team-head"><img class="wcg-v2-players-panel-team-flag" src="${v2PlayerTagEscape(teamMeta[team].flag)}" alt=""><b>${v2PlayerTagEscape(teamMeta[team].name)}</b><small>${sideLabel}</small></div>
        <div class="wcg-v2-player-tag-grid">${tags}</div>
      </section>`;
    }).join('');
    requestAnimationFrame(()=>normalizeV2PlayerTagArtwork(surface));
  }


  function v2PlayerTagSlotFor(playerId){
    return Array.from(document.querySelectorAll('#wcgPlayersSlots .wcg-v2-player-tag-slot')).find(el=>String(el.dataset.playerId||'')===String(playerId||''))||null;
  }
  function v2ScoreEffectImage(tag,className,src){
    const img=document.createElement('img');img.className=`wcg-v2-score-effect ${className}`;img.dataset.v2ScoreEffect='1';img.alt='';img.draggable=false;img.src=src;tag.prepend(img);return img;
  }
  function playV2FrameEffect(tag,className,frames,interval=150,loops=1,hold=0){
    tag.querySelector(`.${className}`)?.remove();
    let frame=0,cycle=0;const img=v2ScoreEffectImage(tag,className,frames[0]);
    const timer=setInterval(()=>{
      frame++;
      if(frame>=frames.length){frame=0;cycle++;if(cycle>=loops){clearInterval(timer);setTimeout(()=>img.remove(),hold);return;}}
      img.src=frames[frame];
    },interval);
    return img;
  }
  function playV2DreamiesEffect(slot,label,tag){
    label.classList.remove('wcg-v2-dreamies-score-pop');void label.offsetWidth;label.classList.add('wcg-v2-dreamies-score-pop');
    setTimeout(()=>label.classList.remove('wcg-v2-dreamies-score-pop'),380);
    const sources=['assets/nametags/dreamies-treat-1.png','assets/nametags/dreamies-treat-2.png','assets/nametags/dreamies-treat-3.png','assets/nametags/dreamies-treat-4.png'];
    const slotBox=slot.getBoundingClientRect(),tagBox=tag.getBoundingClientRect();
    const originX=tagBox.left-slotBox.left+tagBox.width/2,originY=tagBox.top-slotBox.top+tagBox.height/2;
    const count=5,particles=[];
    for(let i=0;i<count;i++){
      const img=document.createElement('img');img.className='wcg-v2-dreamies-treat';img.src=sources[i%sources.length];img.alt='';img.draggable=false;slot.appendChild(img);
      const angle=(-2.55+(5.10*(i/Math.max(1,count-1))))+((Math.random()-.5)*.28),speed=64+Math.random()*38;
      particles.push({el:img,x:originX,y:originY,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed-26,gravity:145+Math.random()*35,rotation:Math.random()*360,spin:(Math.random()<.5?-1:1)*(360+Math.random()*280),scale:.72+Math.random()*.18,delay:i*18,life:760+Math.random()*120});
    }
    const started=performance.now();
    const frame=now=>{let active=false;for(const p of particles){const elapsed=now-started-p.delay;if(elapsed<0){active=true;continue;}const t=Math.min(elapsed,p.life)/1000,progress=Math.min(1,elapsed/p.life);const x=p.x+p.vx*t,y=p.y+p.vy*t+.5*p.gravity*t*t,rot=p.rotation+p.spin*t,fade=progress<.76?1:Math.max(0,(1-progress)/.24);p.el.style.left=`${x}px`;p.el.style.top=`${y}px`;p.el.style.opacity=String(fade);p.el.style.transform=`translate(-50%,-50%) rotate(${rot}deg) scale(${p.scale})`;if(progress<1)active=true;else p.el.remove();}if(active)requestAnimationFrame(frame);};
    requestAnimationFrame(frame);
  }
  function playV2CherryEffect(tag){
    tag.querySelector('.wcg-v2-cherry-layer')?.remove();
    const layer=document.createElement('span');layer.className='wcg-v2-cherry-layer';layer.setAttribute('aria-hidden','true');tag.prepend(layer);
    for(let i=0;i<24;i++){
      const petal=document.createElement('i');petal.className='wcg-v2-cherry-petal';const dir=Math.random()<.5?-1:1,r0=-90+Math.random()*180,r1=r0+dir*(80+Math.random()*120),r2=r1-dir*(70+Math.random()*140),r3=r2+dir*(120+Math.random()*220);
      petal.style.setProperty('--x',`${-3+Math.random()*106}%`);petal.style.setProperty('--size',`${3.4+Math.random()*3.7}px`);petal.style.setProperty('--duration',`${1050+Math.random()*720}ms`);petal.style.setProperty('--delay',`${Math.random()*420}ms`);petal.style.setProperty('--sway1',`${dir*(2+Math.random()*5)}px`);petal.style.setProperty('--sway2',`${-dir*(1+Math.random()*7)}px`);petal.style.setProperty('--sway3',`${dir*(3+Math.random()*10)}px`);petal.style.setProperty('--r0',`${r0}deg`);petal.style.setProperty('--r1',`${r1}deg`);petal.style.setProperty('--r2',`${r2}deg`);petal.style.setProperty('--r3',`${r3}deg`);layer.appendChild(petal);
    }
    const plaque=Array.from(tag.children).find(node=>node.tagName==='IMG'&&!node.classList.contains('wcg-v2-score-effect'));
    const align=()=>{if(!plaque?.isConnected||!layer.isConnected)return;const tb=tag.getBoundingClientRect(),pb=plaque.getBoundingClientRect();layer.style.setProperty('--v2-cherry-left',`${pb.left-tb.left+pb.width/2}px`);layer.style.setProperty('--v2-cherry-top',`${pb.bottom-tb.top-1}px`);layer.style.setProperty('--v2-cherry-width',`${pb.width*.92}px`);};
    requestAnimationFrame(align);setTimeout(()=>layer.remove(),2400);
  }
  function playV2PandaEffect(slot,tag){
    const frames=Array.from({length:6},(_,i)=>`assets/nametags/panda-nametag-swipe-${String(i+1).padStart(2,'0')}.png`);
    const effect=playV2FrameEffect(tag,'wcg-v2-panda-score-swipe',frames,170,1,160);
    const plaque=Array.from(tag.children).find(node=>node.tagName==='IMG'&&!node.classList.contains('wcg-v2-score-effect'));
    requestAnimationFrame(()=>{const w=plaque?.getBoundingClientRect().width||tag.getBoundingClientRect().width;effect.style.setProperty('--v2-panda-width',`${Math.max(108,w*.84)}px`);effect.style.setProperty('--v2-panda-bottom','-10px');});
    try{const a=new Audio('assets/nametags/panda-swipe-sound.mp3');a.volume=.28;a.play().catch(()=>{});}catch(_){ }
  }

  function playV2StarryNightEffect(tag){
    tag.querySelector('.wcg-v2-starry-layer')?.remove();
    const layer=document.createElement('span');layer.className='wcg-v2-score-effect wcg-v2-starry-layer';layer.setAttribute('aria-hidden','true');
    const glow=document.createElement('span');glow.className='wcg-v2-starry-glow';layer.appendChild(glow);
    const starCount=12;
    for(let i=0;i<starCount;i++){
      const star=document.createElement('span');star.className='wcg-v2-starry-star';
      const left=12+Math.random()*76,top=18+Math.random()*48,size=3.5+Math.random()*3.6,duration=740+Math.random()*520,delay=i*42+Math.random()*120;
      const driftX=(-7+Math.random()*14).toFixed(2),driftY=(-10-Math.random()*16).toFixed(2);
      star.style.setProperty('--x',`${left}%`);
      star.style.setProperty('--y',`${top}%`);
      star.style.setProperty('--size',`${size.toFixed(2)}px`);
      star.style.setProperty('--dur',`${duration.toFixed(0)}ms`);
      star.style.setProperty('--delay',`${delay.toFixed(0)}ms`);
      star.style.setProperty('--drift-x',`${driftX}px`);
      star.style.setProperty('--drift-y',`${driftY}px`);
      layer.appendChild(star);
    }
    const plaque=Array.from(tag.children).find(node=>node.tagName==='IMG'&&!node.classList.contains('wcg-v2-score-effect'));
    const align=()=>{
      if(!plaque?.isConnected||!layer.isConnected)return;
      const tb=tag.getBoundingClientRect(),pb=plaque.getBoundingClientRect();
      layer.style.setProperty('--v2-starry-left',`${pb.left-tb.left+pb.width/2}px`);
      layer.style.setProperty('--v2-starry-top',`${pb.top-tb.top+pb.height/2}px`);
      layer.style.setProperty('--v2-starry-width',`${Math.max(86,pb.width*.9)}px`);
      layer.style.setProperty('--v2-starry-height',`${Math.max(18,pb.height*.72)}px`);
    };
    tag.prepend(layer);
    requestAnimationFrame(align);
    setTimeout(()=>layer.remove(),2200);
  }
  function playV2UniversalNametagScoreFlash(slot,label){
    if(!slot||!label)return;
    label.classList.remove('wcg-v2-any-score-pop');slot.classList.remove('wcg-v2-score-slot-pop');
    void label.offsetWidth;
    label.classList.add('wcg-v2-any-score-pop');slot.classList.add('wcg-v2-score-slot-pop');
    setTimeout(()=>{label.classList.remove('wcg-v2-any-score-pop');slot.classList.remove('wcg-v2-score-slot-pop');},820);
  }
  function playV2NametagGoalEffect(playerId,attempt=0){
    if(state.headless)return;
    const slot=v2PlayerTagSlotFor(playerId);const label=slot?.querySelector('.pet-label.has-custom-nametag[data-nametag]');const tag=label?.querySelector('.qm-custom-nametag');
    if(!slot||!label||!tag){
      if(attempt<2){requestV2PlayerTags(true);setTimeout(()=>playV2NametagGoalEffect(playerId,attempt+1),260);}
      return;
    }
    const id=String(label.dataset.nametag||'');
    const now=Date.now(),last=Number(slot.dataset.v2ScoreEffectAt||0);if(now-last<900)return;slot.dataset.v2ScoreEffectAt=String(now);
    // Every equipped paid tag gets a visible broadcast-card flash first. The
    // cosmetic-specific animation then layers on top, so scoring feedback can
    // never silently disappear because a special frame asset loads late.
    playV2UniversalNametagScoreFlash(slot,label);
    if(id==='nametag_dreamies'){playV2DreamiesEffect(slot,label,tag);return;}
    if(id==='nametag_wyrmfire_royal'){playV2FrameEffect(tag,'wcg-v2-wyrmfire-score-fire',Array.from({length:8},(_,i)=>`assets/nametags/wyrmfire-score-fire-${String(i+1).padStart(2,'0')}.png`),130,2,120);return;}
    if(id==='nametag_tea_biscuits'){playV2FrameEffect(tag,'wcg-v2-tea-score-dunk',Array.from({length:8},(_,i)=>`assets/nametags/tea-biscuits-dunk-${String(i+1).padStart(2,'0')}.png`),130,2,100);return;}
    if(id==='nametag_verdant_grove'){playV2FrameEffect(tag,'wcg-v2-verdant-score-growth',Array.from({length:8},(_,i)=>`assets/nametags/verdant-grove-growth-${String(i+1).padStart(2,'0')}.png`),140,1,1050);return;}
    if(id==='nametag_cherrybloom_charm'){playV2CherryEffect(tag);return;}
    if(id==='nametag_panda_rare'){playV2PandaEffect(slot,tag);return;}
    if(String(playerId||'')==='pipsqueak'){playV2StarryNightEffect(tag);return;}
  }

  function requestV2PlayerTags(force=false){
    if(state.headless)return;
    const now=performance.now();
    if(v2PlayerTagsState.pending)return;
    if(!force&&now-v2PlayerTagsState.lastRefresh<12000)return;
    v2PlayerTagsState.lastRefresh=now;
    const requestId=`v2-tags-${Date.now()}-${++v2PlayerTagsState.seq}`;
    v2PlayerTagsState.requestId=requestId;
    v2PlayerTagsState.pending=true;
    clearTimeout(v2PlayerTagsState.timeout);
    v2PlayerTagsState.timeout=setTimeout(()=>{
      if(v2PlayerTagsState.requestId!==requestId)return;
      v2PlayerTagsState.pending=false;
      v2PlayerTagsState.requestId='';
    },3500);
    try{
      if(window.parent&&window.parent!==window){
        window.parent.postMessage({type:'repo-sports-v2-player-tags-request',requestId,players:v2PlayerTagRequestRows()},'*');
      }else{
        clearTimeout(v2PlayerTagsState.timeout);
        v2PlayerTagsState.pending=false;
        v2PlayerTagsState.requestId='';
      }
    }catch(_){
      clearTimeout(v2PlayerTagsState.timeout);
      v2PlayerTagsState.pending=false;
      v2PlayerTagsState.requestId='';
    }
  }

  function updateV2PlayerTagPolling(now=performance.now()){
    if(state.open&&!state.headless&&now-v2PlayerTagsState.lastRefresh>=20000)requestV2PlayerTags(false);
  }

  window.addEventListener('message',event=>{
    const data=event?.data;
    if(!data||data.type!=='repo-sports-v2-player-tags-response')return;
    const requestId=String(data.requestId||'');
    if(requestId!==v2PlayerTagsState.requestId)return;
    clearTimeout(v2PlayerTagsState.timeout);
    v2PlayerTagsState.pending=false;
    v2PlayerTagsState.requestId='';
    if(!data.ok){
      console.warn('[REPO SPORTS V2] Player nametags:',data.error||'load failed');
      return;
    }
    const payload=Array.isArray(data.payload)?data.payload:[];
    const signature=JSON.stringify(payload.map(row=>[row?.id||'',row?.petName||'',row?.nametag||'',row?.markup||'']));
    if(signature===v2PlayerTagsState.signature)return;
    v2PlayerTagsState.signature=signature;
    const next=new Map();
    payload.forEach(row=>{
      const id=String(row?.id||'');
      if(id)next.set(id,row);
    });
    v2PlayerTagsState.rows=next;
    const apply=()=>{if(state.open)renderV2PlayerTags()};
    if('requestIdleCallback' in window)requestIdleCallback(apply,{timeout:900});else setTimeout(apply,0);
  });

  function syncV2SidePanelsToTv(){
    const root=$('wcWorldCupBroadcast');
    const tv=root?.querySelector('.wcg-v2-tv-column');
    if(!root||!tv||!root.classList.contains('is-open'))return;
    const measured=Math.ceil(tv.getBoundingClientRect().height||0);
    if(measured<300)return;
    const viewportCap=Math.max(560,Math.floor(window.innerHeight-18));
    const target=Math.max(560,Math.min(measured,viewportCap));
    root.style.setProperty('--wcg-v2-side-height',`${target}px`);
  }
  function installV2SidePanelHeightSync(){
    const root=$('wcWorldCupBroadcast');
    const tv=root?.querySelector('.wcg-v2-tv-column');
    if(!root||!tv||root.dataset.sideHeightSync==='1')return;
    root.dataset.sideHeightSync='1';
    const sync=()=>requestAnimationFrame(()=>requestAnimationFrame(syncV2SidePanelsToTv));
    try{new ResizeObserver(sync).observe(tv)}catch(_){}
    window.addEventListener('resize',sync,{passive:true});
    sync();setTimeout(sync,120);setTimeout(sync,500);
  }

  // V22 — Career match management. Active entities and the full match squad are separate.
  const MATCHDAY_TACTICS = {defensive:['Balanced','Press','Drop Back'],attacking:['Balanced','Fast Break','Possession','Direct'],mentality:['Defensive','Balanced','Attacking'],width:['Compact','Balanced','Wide'],tempo:['Patient','Balanced','Urgent'],freedom:['Structured','Balanced','Fluid']};
  function matchdayTactics(raw={}){return Object.fromEntries(Object.entries(MATCHDAY_TACTICS).map(([k,values])=>[k,values.includes(raw[k])?raw[k]:'Balanced']))}
  function matchdayMinute(){return Math.min(90,state.matchTime/MATCH_SECONDS*90)}
  function matchdayTeamPlayers(team,playedOnly=false){return state.management?allPlayers.filter(p=>{const r=state.management.players[p.id];return r?.team===team&&(!playedOnly||r.seconds>0)}):roster[team]}
  function initMatchday(){
    if(!state.careerMode){state.management=null;return}
    const players={};
    for(const team of ['belros','zafran'])for(const p of matchdaySquads[team]){
      const started=roster[team].some(a=>a.id===p.id),fitness=clamp(Number(p.careerMeta.fitness??100),0,100);
      players[p.id]={team,started,active:started,used:started,seconds:0,energy:fitness,initialEnergy:fitness,load:0,entered:started?0:null,left:null};
    }
    state.management={players,team:state.fixture.managerSide==='away'?'zafran':'belros',paused:false,panel:false,selectedOut:null,selectedIn:null,pending:[],events:[],goals:[],tacticEvents:[],autoFinish:false,halftimeRecovered:false,aiChecks:[],message:'',tactics:{belros:matchdayTactics(state.fixture.homeTactics),zafran:matchdayTactics(state.fixture.awayTactics)}};
  }
  function matchdayPaused(){return !!(state.management?.paused&&!state.management.autoFinish)}
  function matchdayRebaseClock(){state.localClockAnchorElapsed=state.engineElapsed;state.localClockAnchorPerf=performance.now();state.lastTs=0}
  function matchdayEnergyStep(dt){
    const m=state.management;if(!m)return;
    const minutes=dt/MATCH_SECONDS*90;
    for(const e of state.entities){const r=m.players[e.player.id];if(!r)continue;
      const t=m.tactics[e.team],work=(t.defensive==='Press'?1.3:t.defensive==='Drop Back'?.91:1)*(t.mentality==='Attacking'?1.08:1)*(t.attacking==='Fast Break'?1.08:1)*(t.tempo==='Urgent'?1.13:t.tempo==='Patient'?.94:1)*(t.freedom==='Fluid'?1.05:1);
      v48RefreshTraits(e);const saving=window.VelmoraTraits?.effects(e.player.playingTraits,v48TraitContext(e)).energySaving||0;
      const load=minutes*(.28+(1-(e.attributes.stamina||.8))*.38)*work*(1-saving);r.seconds+=dt;r.load+=load;r.energy=clamp(r.energy-load,0,100);
    }
  }
  function matchdaySafeChange(outId){
    if(state.phase==='halftime')return true;
    return ['first','second'].includes(state.phase)&&!state.ball.flight&&!state.pendingPass&&!state.special&&!state.delay&&!state.celebration&&!state.replay&&!state.replayIntro&&!state.replayOutro&&!state.kickoffReceiver&&state.carrier?.player.id!==outId;
  }
  function matchdayApplySub(change){
    const m=state.management,out=m?.players[change.outId],incoming=m?.players[change.inId],old=entityById(change.outId),p=byId[change.inId];
    if(!m||!old||!p||!out?.active||incoming?.used||incoming?.team!==out.team)return false;
    const replacement=state.makeMatchEntity(p,out.team,old.x,teamEntities(out.team).indexOf(old));
    Object.assign(replacement,{x:old.x,y:old.y,tx:old.tx,ty:old.ty,desiredTx:old.tx,desiredTy:old.ty});
    state.entities[state.entities.indexOf(old)]=replacement;roster[out.team][roster[out.team].findIndex(a=>a.id===change.outId)]=p;
    out.active=false;out.left=matchdayMinute();incoming.active=true;incoming.used=true;incoming.entered=matchdayMinute();
    state.entitiesByTeam={belros:state.entities.filter(e=>e.team==='belros'),zafran:state.entities.filter(e=>e.team==='zafran')};state.entityByIdMap=new Map(state.entities.map(e=>[e.player.id,e]));
    if(state.lastPasser===old)state.lastPasser=null;
    state.chanceBuild=null;state.tacticalPulse=0;state.replayBuffer=[];
    const ev={team:out.team==='belros'?'home':'away',outId:change.outId,inId:change.inId,outName:old.player.name,inName:p.name,minute:Math.round(matchdayMinute()),reason:change.reason||'Manager decision'};m.events.push(ev);
    recordEvent('substitution',{team:out.team,player:p.name,out:old.player.name},1.5);
    if(!state.headless&&!m.autoFinish){showBanner(`${p.name} ON · ${old.player.name} OFF`,'',3);renderV2PlayerTags();refreshFixtureUi()}
    m.message=`${p.name} has replaced ${old.player.name}.`;return true;
  }
  function matchdayRequestSub(outId,inId,team=state.management?.team,reason='Manager decision'){
    const m=state.management,fail=message=>({ok:false,message});
    if(!m||!['first','second','halftime'].includes(state.phase))return fail('Substitutions are available during play and at halftime.');
    const out=m.players[outId],incoming=m.players[inId];
    if(!out?.active||out.team!==team||!incoming||incoming.team!==team||incoming.used||byId[inId]?.unavailable)return fail('Choose an active player and an available unused substitute.');
    if(m.pending.some(c=>c.outId===outId||c.inId===inId))return fail('One of these players already has a pending substitution.');
    if(m.events.filter(e=>e.team===(team==='belros'?'home':'away')).length+m.pending.filter(c=>c.team===team).length>=3)return fail('All three substitutions have been used or queued.');
    const change={team,outId,inId,reason};
    if(matchdaySafeChange(outId)){matchdayApplySub(change);return {ok:true,queued:false}}
    m.pending.push(change);m.message='Substitution queued for the next safe break in play.';return {ok:true,queued:true};
  }
  function matchdayProcessPending(){
    const m=state.management;if(!m)return;
    m.pending=m.pending.filter(c=>!matchdaySafeChange(c.outId)||!matchdayApplySub(c));
  }
  function matchdayApplyTactics(raw,team=state.management?.team){
    const m=state.management;if(!m||!['intro','first','second','halftime'].includes(state.phase))return false;
    const next=matchdayTactics(raw);if(JSON.stringify(next)===JSON.stringify(m.tactics[team]))return true;
    m.tactics[team]=next;if(team===m.team)m.draft={...next};const tt=state.teamTactics[team];tt.profile=careerTacticalProfile(next);tt.identity=tt.profile.id;tt.adjustment={id:'BASE',width:1,runner:1,support:1,press:1,passBias:0,label:'manager instructions'};state.tacticalPulse=0;
    m.tacticEvents.push({team:team==='belros'?'home':'away',minute:Math.round(matchdayMinute()),...next});m.message='Tactical instructions applied.';return true;
  }
  function matchdayAiChanges(halftime=false){
    const m=state.management;if(!m)return;const team=other(m.team),minute=matchdayMinute();
    if(halftime){const diff=state.score[team]-state.score[other(team)];if(diff<0)matchdayApplyTactics({...m.tactics[team],attacking:'Direct',mentality:'Attacking'},team);else if(diff>0)matchdayApplyTactics({...m.tactics[team],attacking:'Possession',mentality:'Defensive'},team);}
    if(!halftime){const checkpoint=[60,75,83].find(n=>minute>=n&&!m.aiChecks.includes(n));if(!checkpoint)return;m.aiChecks.push(checkpoint)}
    const candidates=teamEntities(team).slice().sort((a,b)=>m.players[a.player.id].energy-m.players[b.player.id].energy);
    const out=candidates[0];if(!out||m.pending.some(c=>c.team===team))return;
    if(halftime&&m.players[out.player.id].energy>65)return;
    const losing=state.score[team]<state.score[other(team)],role=losing?'attacker':out.player.role;
    const bench=matchdayTeamPlayers(team).filter(p=>!m.players[p.id].used&&!p.unavailable).sort((a,b)=>{
      const score=p=>Number(p.careerMeta.ovr||60)+m.players[p.id].energy*.18+(p.role===role?8:0);return score(b)-score(a)||a.id.localeCompare(b.id);
    });
    if(bench[0])matchdayRequestSub(out.player.id,bench[0].id,team,losing?'Chasing the match':'Fresh legs');
  }
  function matchdayReport(){
    const m=state.management;if(!m)return null;
    return {version:2,participation:Object.fromEntries(Object.entries(m.players).map(([id,r])=>[id,{team:r.team==='belros'?'home':'away',started:r.started,minutes:Number((r.seconds/MATCH_SECONDS*90).toFixed(4)),energy:Number(r.energy.toFixed(2)),fitnessCost:Number((r.load/4).toFixed(2)),entered:r.entered,left:r.left,sentOff:!!r.sentOff}])),substitutions:m.events.map(e=>({...e})),tacticalChanges:m.tacticEvents.map(e=>({...e})),finalTactics:{home:{...m.tactics.belros},away:{...m.tactics.zafran}}};
  }
  function matchdayShow(){
    const m=state.management;if(!m||!state.open||!['intro','first','second','halftime'].includes(state.phase))return;
    $('wcgMatchdayPanel')?.parentElement?.querySelector('.wcg-v2-broadcast-layout')?.setAttribute('inert','');m.paused=true;m.panel=true;m.selectedIn=null;m.selectedOut=null;m.draft={...m.tactics[m.team]};matchdayRebaseClock();renderMatchdayPanel();$('wcgMatchdayPanel')?.querySelector('button,select')?.focus();
  }
  function matchdayHide(){const m=state.management;if(!m)return;$('wcgMatchdayPanel')?.parentElement?.querySelector('.wcg-v2-broadcast-layout')?.removeAttribute('inert');m.paused=false;m.panel=false;$('wcgMatchdayPanel')?.setAttribute('hidden','');matchdayRebaseClock();$('wcgManage')?.focus()}
  function matchdayHandleEscape(e){if(e.key!=='Escape'||!state.open||!state.management?.panel)return false;e.preventDefault();e.stopPropagation();matchdayResume();return true}
  function matchdayResume(){const halftime=state.phase==='halftime';if(state.management?.draft)matchdayApplyTactics(state.management.draft);matchdayHide();if(halftime){matchdayProcessPending();handleSecondHalf()}}
  function matchdayPlayerCard(p){
    const m=state.management,r=m.players[p.id],selected=p.id===m.selectedOut||p.id===m.selectedIn,disabled=(!r.active&&r.used)||p.unavailable;
    const label=p.unavailable?'UNAVAILABLE':r.sentOff?'SENT OFF':r.active?'ON PITCH':r.used?`OFF ${Math.round(r.left)}′`:'AVAILABLE';
    return `<button type="button" class="vm-md-player ${selected?'is-selected':''} ${disabled?'is-unavailable':''}" data-md-player="${v2CareerEscape(p.id)}" aria-pressed="${selected}" ${disabled?'disabled':''} aria-label="${v2CareerEscape(p.name)} · ${label}"><img src="${v2CareerEscape(p.standing)}" alt=""><span class="vm-md-player-copy"><strong>${v2CareerEscape(p.name)}</strong><small>${v2CareerEscape(p.careerRole||p.role)} · ${Number(p.careerMeta.ovr||0)} OVR</small><span class="vm-md-energy"><i style="width:${r.energy.toFixed(1)}%"></i></span><small>${Math.round(r.energy)}% ENERGY · ${Math.round(Number(p.careerMeta.sharpness??70))}% SHARP · ${v2CareerEscape(p.careerMeta.form||'Average')}</small></span><span class="vm-md-status">${label}</span></button>`;
  }
  function renderMatchdayPanel(){
    const m=state.management,el=$('wcgMatchdayPanel');if(!m||!el||!m.panel)return;
    const previousFocus=document.activeElement?.dataset||{};
    const team=m.team,own=state.teamStats[team],opp=state.teamStats[other(team)],used=m.events.filter(e=>e.team===(team==='belros'?'home':'away')).length;
    const active=matchdayTeamPlayers(team).filter(p=>m.players[p.id].active),bench=matchdayTeamPlayers(team).filter(p=>!m.players[p.id].active);
    const select=(key,title,copy)=>`<label>${title}<select data-md-tactic="${key}" aria-label="${title}">${MATCHDAY_TACTICS[key].map(v=>`<option ${m.draft[key]===v?'selected':''}>${v}</option>`).join('')}</select><small>${copy}</small></label>`;
    const selected=m.selectedOut&&m.selectedIn;
    el.removeAttribute('hidden');el.innerHTML=`<section class="vm-md-dialog" role="dialog" aria-modal="true" aria-labelledby="vmMdTitle"><header class="vm-md-header"><div><span class="vm-md-eyebrow">VELMORA MANAGER / MATCHDAY</span><h2 id="vmMdTitle">${state.phase==='halftime'?'The halftime team talk.':'Your next decision.'}</h2><p>${v2CareerEscape(teamMeta[team].name)} · ${state.phase==='intro'?'PRE-MATCH':`${Math.floor(matchdayMinute())}′`} · MATCH PAUSED</p></div><div class="vm-md-score"><span>${v2CareerEscape(teamMeta.belros.abbr)}</span><strong>${state.score.belros} <i>–</i> ${state.score.zafran}</strong><span>${v2CareerEscape(teamMeta.zafran.abbr)}</span></div></header><div class="vm-md-body"><section class="vm-md-squad"><div class="vm-md-section-head"><h3>${used?'On the pitch':'Starting Three'}</h3><span>${3-used} SUBSTITUTIONS LEFT</span></div>${active.map(matchdayPlayerCard).join('')}<div class="vm-md-section-head"><h3>Substitutes Three</h3><span>${bench.filter(p=>!m.players[p.id].used&&!p.unavailable).length} AVAILABLE</span></div>${bench.map(matchdayPlayerCard).join('')||'<p class="vm-md-empty">No substitutes selected. Manage your starting three’s energy.</p>'}<p class="vm-md-rules">Three substitutions · no re-entry. Select an active player, then an available substitute.</p></section><aside class="vm-md-plan"><section><span class="vm-md-eyebrow">THE MATCH SO FAR</span><div class="vm-md-numbers"><b>${own.shots}<small>OUR SHOTS</small></b><b>${opp.shots}<small>THEIR SHOTS</small></b><b>${own.passes?Math.round(own.completed/own.passes*100):0}%<small>PASS COMPLETION</small></b></div><p>${own.shots<opp.shots?'The opposition are creating more shots. Consider your shape or a fresh attacking option.':'Check energy before committing to a more demanding approach.'}</p></section><section><h3>Tactical instructions</h3>${select('defensive','Defensive style','Press closes space faster and uses more energy. Drop Back keeps a compact shape.')}${select('attacking','Attacking style','Possession offers support. Direct advances play. Fast Break commits runners at a higher energy cost.')}${select('mentality','Mentality','Attacking pushes support forward. Defensive keeps more cover.')}${select('width','Team width','Compact protects central lanes. Wide spacing stretches the opposition.')}${select('tempo','Tempo','Urgent acts earlier at a higher energy cost. Patient waits for cleaner openings.')}${select('freedom','Creative freedom','Structured holds lanes. Fluid allows positional rotations.')}<button type="button" class="vm-md-secondary" data-md-action="tactics">Apply tactical changes</button><small class="vm-md-note">Applies to this match. Your saved squad plan stays available for the next fixture.</small></section></aside></div><footer class="vm-md-footer"><div class="vm-md-action-copy" role="status" aria-live="polite">${selected?`<strong>${v2CareerEscape(byId[m.selectedOut].name)} OFF → ${v2CareerEscape(byId[m.selectedIn].name)} ON</strong>`:''}<span>${v2CareerEscape(m.message||'Choose your changes, then return to the match.')}</span>${m.pending.filter(c=>c.team===team).map(c=>`<span>${v2CareerEscape(byId[c.inId].name)} queued <button type="button" data-md-cancel="${v2CareerEscape(c.inId)}">Cancel</button></span>`).join('')}</div><div class="vm-md-actions"><button type="button" class="vm-md-secondary" data-md-action="sub" ${selected?'':'disabled'}>Confirm substitution</button><button type="button" class="vm-md-primary" data-md-action="resume">${state.phase==='halftime'?'Start second half':'Return to match'} →</button></div></footer></section>`;
    const focus=[...el.querySelectorAll('button,select')].find(n=>['mdPlayer','mdAction','mdTactic'].some(k=>previousFocus[k]&&n.dataset[k]===previousFocus[k]));focus?.focus();
  }
  function installMatchdayUi(){
    const root=$('wcWorldCupBroadcast');if(!root||$('wcgManage'))return;
    const button=document.createElement('button');button.id='wcgManage';button.type='button';button.className='wcg-control wcg-career-control';button.textContent='MANAGE TEAM';root.querySelector('.wcg-controls').prepend(button);button.addEventListener('click',matchdayShow);
    const panel=document.createElement('div');panel.id='wcgMatchdayPanel';panel.hidden=true;root.appendChild(panel);
    panel.addEventListener('change',e=>{const k=e.target.dataset.mdTactic;if(k&&state.management)state.management.draft[k]=e.target.value});
    panel.addEventListener('click',e=>{
      const button=e.target.closest('button'),m=state.management;if(!button||!m)return;
      if(button.dataset.mdPlayer){const id=button.dataset.mdPlayer,r=m.players[id];if(r.active)m.selectedOut=id;else if(!r.used)m.selectedIn=id;renderMatchdayPanel()}
      else if(button.dataset.mdCancel){m.pending=m.pending.filter(c=>c.inId!==button.dataset.mdCancel||c.team!==m.team);m.message='Queued substitution cancelled.';renderMatchdayPanel()}
      else if(button.dataset.mdAction==='resume')matchdayResume();
      else if(button.dataset.mdAction==='tactics'){matchdayApplyTactics(m.draft);renderMatchdayPanel()}
      else if(button.dataset.mdAction==='sub'){const result=matchdayRequestSub(m.selectedOut,m.selectedIn);if(!result.ok)m.message=result.message;else{m.selectedOut=null;m.selectedIn=null}renderMatchdayPanel()}
    });
    panel.addEventListener('keydown',e=>{
      if(e.key==='Escape'){e.preventDefault();matchdayResume();return}
      if(e.key==='Tab'){const nodes=[...panel.querySelectorAll('button:not(:disabled),select')];if(!nodes.length)return;const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}
    });
  }

  function finalCareerGoalEvents(){
    const result=[];
    for(const team of ['belros','zafran'])for(const p of matchdayTeamPlayers(team,true)){
      const count=Math.max(0,Number(state.playerStats?.[p.id]?.goals)||0);if(!count)continue;
      const candidates=(state.management?.goals||state.events).filter(e=>e.type==='goal'&&(e.data?.playerId?e.data.playerId===p.id:e.data?.player===p.name)&&e.data?.team===team).sort((a,b)=>a.time-b.time);
      for(let i=0;i<count;i++){const ev=candidates[i],minute=ev?Math.max(1,Math.min(90,Math.round((Number(ev.time)||0)/MATCH_SECONDS*90))):Math.max(1,Math.min(90,Math.round((i+1)/(count+1)*90)));result.push({team:team==='belros'?'home':'away',playerId:p.id,playerName:p.name,minute});}
    }
    return result.sort((a,b)=>a.minute-b.minute);
  }
  function careerResultSnapshot(){
    const mvp=playerOfPeriod(null),so=state.fulltimeData?.so||state.shootout||null;
    return {
      engine:'REPO_SPORTS_V2_CAREER_V26',fixtureId:String(state.fixture?.careerFixtureId||state.fixture?.id||''),venue:activeFixture?.venue||'',
      homeScore:Number(state.score.belros)||0,awayScore:Number(state.score.zafran)||0,
      penaltiesHome:so?Number(so.score?.belros)||0:null,penaltiesAway:so?Number(so.score?.zafran)||0:null,
      shootoutWinner:state.fulltimeData?.fromShootout?(state.fulltimeData?.winner==='belros'?'home':'away'):null,
      mvpId:mvp?.id||null,goalEvents:finalCareerGoalEvents(),disciplineEvents:(state.disciplineEvents||[]).map(e=>({...e})),
      playerStats:Object.fromEntries(allPlayers.map(p=>[p.id,{...(state.playerStats?.[p.id]||{})}])),matchday:matchdayReport(),
      teamStats:{home:{...(state.teamStats?.belros||{})},away:{...(state.teamStats?.zafran||{})}},seed:state.seed
    };
  }
  function deliverCareerResult(){
    if(!state.careerMode||state.phase!=='fulltime'||state.careerDelivered)return;
    state.careerDelivered=true;const payload=careerResultSnapshot(),cb=state.onCareerComplete;
    Promise.resolve(closeBroadcast(false)).finally(()=>{try{if(typeof cb==='function')cb(payload)}catch(error){console.error('[VELMORA QUIDDITCH] Career completion callback failed',error)}});
  }
  function skipCareerToFulltime(){
    if(!state.careerMode||!state.open||state.phase==='fulltime')return;
    const oldFast=state.fastForwarding,oldSpeed=state.speed;matchdayHide();if(state.management)state.management.autoFinish=true;state.fastForwarding=true;state.speed=1;
    try{
      if(state.phase==='intro')completePrematch();
      let guard=0;while(state.open&&state.phase!=='fulltime'&&guard<70000){if(state.phase==='halftime'){matchdayProcessPending();handleSecondHalf()}simulateFixedStep(FIXED_SIM_DT);guard++;}
      if(state.phase!=='fulltime')console.warn('[VELMORA QUIDDITCH] Full-time skip guard reached',state.phase,guard);
    }finally{state.fastForwarding=oldFast;state.speed=oldSpeed;if(state.management)state.management.autoFinish=false;matchdayRebaseClock();}
    if(state.phase==='fulltime'){populateFulltimePanel(state.fulltimeData);$('wcgFulltime')?.classList.add('is-open');render();}
  }

  function createUi(){
    if ($('wcWorldCupBroadcast')) return;
    ensureV2StandingsStyles();
    ensureBigMomentStyles();
    const root=document.createElement('div');root.id='wcWorldCupBroadcast';root.setAttribute('aria-hidden','true');
    root.innerHTML=`<div class="wcg-shell" role="dialog" aria-modal="true" aria-label="Repo Sports Quidditch live match">
      <canvas id="wcgCanvas" class="wcg-canvas" width="${W}" height="${H}"></canvas>
      <div id="wcgArenaAtmosphere" class="wcg-arena-atmosphere" aria-hidden="true"></div>
      <div id="wcgSnow" class="wcg-snow" aria-hidden="true"></div>
      <div class="wcg-scorebar">
        <div class="wcg-team-score"><div class="wcg-team-copy"><b class="wcg-team-name-row" style="display:flex;align-items:center;gap:8px"><img class="wcg-team-flag wcg-team-flag-inline" src="assets/world-cup-flags/belros-flag.png" alt="Belros flag" style="width:26px;height:18px;object-fit:cover;border:1px solid rgba(231,210,150,.55);box-shadow:0 1px 4px rgba(0,0,0,.35);border-radius:2px;flex:0 0 auto"><span class="wcg-team-name-text">BELROS</span></b><small class="wcg-team-lineup">JUD · NIMBLER 2000 · BRAMBLE</small><small id="wcgScorersBelros" class="wcg-team-scorers">SCORERS: —</small></div><strong id="wcgScoreBelros" class="wcg-team-goals">0</strong></div>
        <div class="wcg-clock"><img class="wcg-score-logo" src="assets/repo-sports-logo.png" alt="Repo Sports"><b id="wcgClock">PRE</b><span id="wcgPhase">REPO SPORTS</span><em id="wcgArena">STANDARD ROTATION</em></div>
        <div class="wcg-team-score"><strong id="wcgScoreZafran" class="wcg-team-goals">0</strong><div class="wcg-team-copy"><b class="wcg-team-name-row" style="display:flex;align-items:center;gap:8px;justify-content:flex-end"><img class="wcg-team-flag wcg-team-flag-inline" src="assets/world-cup-flags/zafran-flag.png" alt="Zafran flag" style="width:26px;height:18px;object-fit:cover;border:1px solid rgba(231,210,150,.55);box-shadow:0 1px 4px rgba(0,0,0,.35);border-radius:2px;flex:0 0 auto"><span class="wcg-team-name-text">ZAFRAN</span></b><small class="wcg-team-lineup">ZIZI · RAFI · SAFFI</small><small id="wcgScorersZafran" class="wcg-team-scorers">SCORERS: —</small></div></div>
      </div>
      <div class="wcg-live-chip"><img src="assets/repo-sports-logo.png" alt="">LIVE</div>
      <div id="wcgPresentation" class="wcg-presentation" aria-hidden="true"><div id="wcgPresentationPanel" class="wcg-presentation-panel"><div class="wcg-presentation-brand"><img src="assets/repo-sports-logo.png" alt="Repo Sports"><span>REPO SPORTS LIVE</span></div><small id="wcgPresentationKicker"></small><h1 id="wcgPresentationTitle"></h1><div id="wcgPresentationBody" class="wcg-presentation-body"></div><footer id="wcgPresentationFooter"></footer></div></div>
      <div id="wcgEventBanner" class="wcg-event-banner"></div>
      <div id="wcgBigMoment" class="wcg-big-moment" aria-hidden="true"><div class="wcg-big-moment-flash"></div><div id="wcgBigMomentParticles" class="wcg-big-moment-particles"></div><img id="wcgBigMomentImg" class="wcg-big-moment-img" alt=""></div>
      <div id="wcgReplaySponsor" class="wcg-replay-sponsor" aria-hidden="true"><img src="assets/repo-sports-logo.png" alt="Repo Sports replay"></div>
      <div id="wcgReplayBug" class="wcg-replay-bug" aria-hidden="true"><img src="assets/repo-sports-logo.png" alt=""><span>REPLAY</span><i id="wcgReplayLabel">MATCH REPLAY</i></div>
      <div id="wcgStoryCard" class="wcg-story-card" aria-hidden="true"><div class="wcg-story-flag"><img id="wcgStoryFlag" alt=""></div><div class="wcg-story-copy"><small id="wcgStoryKicker">REPO SPORTS</small><b id="wcgStoryTitle"></b><span id="wcgStoryBody"></span></div><img id="wcgStoryPlayer" class="wcg-story-player" alt=""></div>
      <aside id="wcgCareerBoard" class="wcg-v2-career-board wcg-v2-career-stack" aria-label="Repo Sports all-time Quidditch records">
        <header class="wcg-v2-career-head">
          <img src="assets/repo-sports-logo.png" alt="">
          <div><small>REPO SPORTS</small><b>ALL-TIME RECORDS</b></div>
          <span>CAREER</span>
        </header>
        <section class="wcg-v2-career-section" data-career-section="goals">
          <div class="wcg-v2-career-section-head"><div><small>PLAYER RECORDS</small><b>TOP GOALSCORERS</b></div><span>TOP 5</span></div>
          <div id="wcgCareerGoals" class="wcg-v2-career-rows"><p>Loading records…</p></div>
        </section>
        <section class="wcg-v2-career-section" data-career-section="winrate">
          <div class="wcg-v2-career-section-head"><div><small>40 MATCH MINIMUM</small><b>BEST PET WIN RATE</b></div><span>TOP 5</span></div>
          <div id="wcgCareerWinrate" class="wcg-v2-career-rows"><p>Loading records…</p></div>
        </section>
        <section class="wcg-v2-career-section" data-career-section="teams">
          <div class="wcg-v2-career-section-head"><div><small>REPO SPORTS LEAGUE</small><b>MOST TEAM WINS</b></div><span>TOP 5</span></div>
          <div id="wcgCareerTeams" class="wcg-v2-career-rows"><p>Loading records…</p></div>
        </section>
        <footer><span>PLAYER CAREER + LIVE LEAGUE RECORDS</span><i>READ ONLY</i></footer>
      </aside>
      <aside id="wcgStandingsBoard" class="wcg-v2-standings-board" aria-label="Repo Sports league table"><img class="wcg-v2-standings-frame" src="assets/repo-sports-v2/repo-sports-v2-standings-board.png" alt=""><div class="wcg-v2-standings-surface"><div class="wcg-v2-standings-kicker"><b>LEAGUE STANDINGS</b><span>18 CLUBS</span></div><div class="wcg-v2-standings-head"><span>#</span><span>TEAM</span><span>MP</span><span>W</span><span>L</span><span>GF</span><span>GA</span><span>GD</span><span>WR</span></div><div id="wcgStandingsRows" class="wcg-v2-standings-body"></div></div></aside>
      <div id="wcgLegacyModeSlot" class="wcg-v2-legacy-slot"><button id="wcgLegacyModeLaunch" class="wcg-v2-legacy-launch" type="button" aria-label="Open Repo Sports Legacy Mode" title="Open Repo Sports Legacy Mode"><img src="assets/repo-sports-legacy-mode-tab.png" alt="Repo Sports Legacy Mode" width="102" height="46"></button></div>
      <aside id="wcgPlayersBoard" class="wcg-v2-players-board" aria-label="Repo Sports players"><img class="wcg-v2-players-frame" src="players-box.png?v=repo-sports-harmony-performance-20260812" alt="Players"><div id="wcgPlayersSlots" class="wcg-v2-players-surface" aria-live="polite"></div></aside>
      <div id="wcgCommentator" class="wcg-commentator" data-barry-state="NEUTRAL"><div class="wcg-barry-studio wcg-barry-portrait-only" aria-label="Barry Bramble"><div class="wcg-studio-window"><img id="wcgBarrySprite" class="wcg-barry" src="assets/commentator-22.png" alt="Barry Bramble"></div></div><div class="wcg-comment-stack"><div class="wcg-comment-box"><div class="wcg-comment-head"><img src="assets/repo-sports-logo.png" alt=""><div><b>BARRY BRAMBLE</b><span>LIVE COMMENTARY · REPO SPORTS</span></div><i>ON AIR</i></div><p id="wcgCommentary">Welcome to Repo Sports Quidditch.</p></div><div id="wcgBarryTipPanel" class="wcg-barry-tip-panel wcg-barry-tip-mini wcg-barry-tip-rail"><button id="wcgBarryTipButton" type="button" title="Tip Barry 200 GP toward Barry's Boater"><img src="assets/commentator-coin.png" alt=""><span><b>TIP BARRY</b><small>200 GP</small></span></button><div class="wcg-barry-tip-mini-progress" title="Barry's Boater community unlock progress"><div><i id="wcgBarryTipFill"></i></div><strong id="wcgBarryTipPercent">0%</strong><span>BOATER</span></div><em id="wcgBarryTipStatus" aria-live="polite"></em></div></div></div>
      <section id="wcgWatchParty" class="wcg-v2-watch-party" aria-label="Repo Sports Watch Party">
        <header>
          <img src="assets/repo-sports-watch-party.png" alt="Repo Sports Watch Party">
          <div><b>REPO SPORTS WATCH PARTY</b><span><i></i><strong id="wcgWatchPartyTotal">1</strong> WATCHING LIVE</span></div>
        </header>
        <div id="wcgWatchPartyCards" class="wcg-v2-watch-party-cards"><span class="wcg-v2-watch-party-loading">Loading watch party…</span></div>
      </section>
      <div class="wcg-mini-stats"><header><span>BELROS</span><span>LIVE MATCH STATS</span><span>ZAFRAN</span></header><div id="wcgMiniStats"></div></div>
      <div id="wcgVar" class="wcg-var-box"><div class="wcg-var-card"><b id="wcgVarTitle">VAR CHECK</b><span id="wcgVarText">Reviewing the incident…</span></div></div>
      <div id="wcgHalftime" class="wcg-overlay-card"><div class="wcg-panel wcg-half-wait-panel"><div class="wcg-half-brand"><img src="assets/repo-sports-logo.png" alt="Repo Sports"><span>HALF-TIME LIVE</span></div><h2 id="wcgHalfTitle">SECOND HALF READY</h2><h3>STANDARD REPO SPORTS ARENA · REPO SPORTS LIVE</h3><div class="wcg-halftime-stats"><div class="wcg-half-team"><img src="assets/world-cup-flags/belros-flag.png" alt="Belros flag"><b>BELROS</b><strong id="wcgHalfBelros">0</strong></div><div class="wcg-half-centre">9 MINUTES<br>COMPLETE<br><span id="wcgHalfShots"></span></div><div class="wcg-half-team"><img src="assets/world-cup-flags/zafran-flag.png" alt="Zafran flag"><b>ZAFRAN</b><strong id="wcgHalfZafran">0</strong></div></div><div id="wcgHalfRotation" class="wcg-half-rotation"></div><p id="wcgHalfCopy">Waiting for CatAsthma to continue the broadcast.</p><button id="wcgContinueHalf" type="button">CONTINUE SECOND HALF</button></div></div>
      <div id="wcgPredictionBar" class="wcg-v2-prediction" aria-hidden="true"><div class="wcg-v2-prediction-copy"><small>REPO SPORTS PREDICT</small><b>WHO WINS?</b><span>Correct pick · +1,000 GP</span></div><div class="wcg-v2-prediction-buttons"><button id="wcgPredictHome" type="button" data-v2-predict="belros"><b>HOME</b><span id="wcgPredictHomeShare">0% · 0</span></button><i>OR</i><button id="wcgPredictAway" type="button" data-v2-predict="zafran"><b>AWAY</b><span id="wcgPredictAwayShare">0% · 0</span></button></div><div id="wcgFanVote" class="wcg-v2-fan-vote"><b>FAN VOTE</b><span>WAITING FOR PICKS</span></div><em id="wcgPredictionStatus">PICK ANY TIME BEFORE KICKOFF</em></div>
      <div id="wcgFulltime" class="wcg-overlay-card"><div class="wcg-panel wcg-v2-fulltime-panel wcg-v2-fulltime-clean wcg-v30-fulltime-panel">
        <div class="wcg-v30-report-scroll" role="region" aria-label="Full-time match report" tabindex="0">
          <header class="wcg-v30-report-topbar">
            <div class="wcg-v30-report-brand"><span class="wcg-v30-live-dot"></span><div><b>VELMORA MATCH CENTRE</b><small>FINAL WHISTLE · MATCH REPORT</small></div></div>
            <div class="wcg-v30-report-meta"><span id="wcgFullCompetition">CAREER FIXTURE</span><strong>FULL TIME</strong></div>
          </header>
          <section class="wcg-v30-score-hero" aria-label="Full-time score">
            <article class="wcg-v30-team wcg-v30-home-team">
              <div class="wcg-v30-team-badge"><img id="wcgFullHomeBadge" alt=""></div>
              <small>HOME</small><h2 id="wcgFullHomeTeam">HOME</h2>
            </article>
            <div class="wcg-v30-score-centre">
              <span class="wcg-v30-ft-chip">FULL TIME</span>
              <div id="wcgFullScore" class="wcg-v30-score">0–0</div>
              <h1 id="wcgFullTitle">FULL TIME</h1>
              <p id="wcgFullSubtitle">MATCH COMPLETE</p>
              <em id="wcgFullDecision"></em>
            </div>
            <article class="wcg-v30-team wcg-v30-away-team">
              <div class="wcg-v30-team-badge"><img id="wcgFullAwayBadge" alt=""></div>
              <small>AWAY</small><h2 id="wcgFullAwayTeam">AWAY</h2>
            </article>
          </section>
          <section class="wcg-v30-highlight-row">
            <article id="wcgMvp" class="wcg-v30-mvp-card"></article>
            <article class="wcg-v30-match-note"><span>MATCH COMPLETE</span><strong id="wcgFullMatchNote">REPORT READY</strong><small>Final statistics from the live match engine.</small></article>
          </section>
          <section class="wcg-v30-report-section wcg-v30-stats-section">
            <header class="wcg-v30-section-title"><div><small>MATCH DATA</small><h3>MATCH STATISTICS</h3></div><span>HOME <i></i> AWAY</span></header>
            <div id="wcgFullStats" class="wcg-fulltime-grid wcg-v2-clean-team-stats wcg-v30-stat-grid"></div>
          </section>
          <section class="wcg-v30-report-section wcg-v30-player-section">
            <header class="wcg-v30-section-title"><div><small>ON THE PITCH</small><h3>PLAYER STATISTICS</h3></div><span>GOALS · SHOTS · TACKLES · POSSESSION</span></header>
            <div id="wcgFullPlayers" class="wcg-v2-player-report wcg-v2-clean-player-report wcg-v30-player-report"></div>
          </section>
          <div id="wcgFullPrediction" class="wcg-v2-full-prediction wcg-v30-prediction"></div>
        </div>
        <footer class="wcg-v2-fulltime-footer wcg-v30-fulltime-footer">
          <div class="wcg-v30-footer-status"><span>POST-MATCH</span><strong id="wcgNextMatchCountdown" class="wcg-v2-next-match">MATCH REPORT READY</strong></div>
          <button id="wcgReturnLobby" type="button"><span>CONTINUE</span><strong>TO CAREER</strong><i>→</i></button>
        </footer>
      </div></div>
      <div class="wcg-controls"><button id="wcgSkipBroadcast" class="wcg-control wcg-skip-broadcast" type="button" hidden>SKIP INTRO</button><button id="wcgCareerSkip" class="wcg-control wcg-career-control" type="button">SKIP TO FULL TIME</button><button id="wcgSkipHalf" class="wcg-control wcg-admin-only" type="button" hidden>SKIP TO HALF TIME</button><button id="wcgSpeed" class="wcg-control wcg-admin-only" type="button" hidden>TEST SPEED ×4</button><button id="wcgAdminEvents" class="wcg-control wcg-admin-only" type="button" hidden>ADMIN EVENT TESTS</button><button id="wcgExit" class="wcg-control" type="button">RETURN TO MATCHDAY</button></div><div id="wcgAdminPanel" class="wcg-admin-panel" hidden><div class="wcg-admin-title">REPO SPORTS V2 · ADMIN TEST DECK</div><div class="wcg-admin-grid"><button data-test-event="goal">GOAL</button><button data-test-event="save">SAVE</button><button data-test-event="miss">MISS</button><button data-test-event="post">POST / REBOUND</button><button data-test-event="foul">FOUL</button><button data-test-event="penalty">PENALTY</button><button data-test-event="hattrick">HAT TRICK POPUP</button><button data-test-event="penaltypopup">PENALTY POPUP</button><button data-test-event="var">VAR CHECK</button><button data-test-event="intercept">INTERCEPTION</button></div></div>
      <div class="wcg-screen-effects"></div><img class="wcg-tv-frame" src="${BASE}broadcast-tv-frame.webp" alt="" aria-hidden="true">
    </div>`;
    // Test 18: the TV picture is reserved for the match itself. Career records
    // stay outside on the left, while Barry, Watch Party and Live Match Stats
    // become a dedicated broadcast deck directly UNDER the television.
    const shellNode=root.querySelector('.wcg-shell');
    const careerNode=root.querySelector('#wcgCareerBoard');
    const commentatorNode=root.querySelector('#wcgCommentator');
    const watchPartyNode=root.querySelector('#wcgWatchParty');
    const statsNode=root.querySelector('.wcg-mini-stats');
    const standingsNode=root.querySelector('#wcgStandingsBoard');
    const playersNode=root.querySelector('#wcgPlayersBoard');
    const legacyModeNode=root.querySelector('#wcgLegacyModeSlot');
    if(shellNode&&careerNode&&commentatorNode&&watchPartyNode&&statsNode&&standingsNode&&playersNode&&legacyModeNode){
      const layout=document.createElement('div');
      layout.className='wcg-v2-broadcast-layout';
      const tvColumn=document.createElement('div');
      tvColumn.className='wcg-v2-tv-column';
      const lowerDeck=document.createElement('div');
      lowerDeck.className='wcg-v2-under-tv-deck';
      const rightRail=document.createElement('div');
      rightRail.className='wcg-v2-right-rail';
      root.appendChild(layout);
      layout.appendChild(careerNode);
      layout.appendChild(tvColumn);
      layout.appendChild(rightRail);
      rightRail.appendChild(standingsNode);
      rightRail.appendChild(legacyModeNode);
      rightRail.appendChild(playersNode);
      tvColumn.appendChild(shellNode);
      lowerDeck.appendChild(commentatorNode);
      lowerDeck.appendChild(watchPartyNode);
      lowerDeck.appendChild(statsNode);
      tvColumn.appendChild(lowerDeck);
    }
    document.body.appendChild(root);
    installMatchdayUi();
    installV2SidePanelHeightSync();
    renderV2StandingsBoard();
    renderV2PlayerTags();
    const snow=$('wcgSnow');
    if(snow){snow.innerHTML='';snow.setAttribute('hidden','hidden')}
    $('wcgContinueHalf').addEventListener('click',continueSecondHalf);
    $('wcgSkipBroadcast')?.addEventListener('click',skipBroadcastPresentation);
    $('wcgCareerSkip')?.addEventListener('click',skipCareerToFulltime);
    $('wcgReturnLobby')?.addEventListener('click',deliverCareerResult);
    const fulltimeOverlay=$('wcgFulltime'),fulltimeReport=fulltimeOverlay?.querySelector('.wcg-v30-report-scroll');
    fulltimeOverlay?.addEventListener('wheel',event=>{
      if(!fulltimeOverlay.classList.contains('is-open')||event.ctrlKey||!fulltimeReport)return;
      const max=Math.max(0,fulltimeReport.scrollHeight-fulltimeReport.clientHeight);
      if(max<=0)return;
      const before=fulltimeReport.scrollTop;
      fulltimeReport.scrollTop=Math.max(0,Math.min(max,before+event.deltaY));
      if(fulltimeReport.scrollTop!==before)event.preventDefault();
    },{passive:false});
    document.querySelectorAll('[data-v2-predict]').forEach(btn=>btn.addEventListener('click',()=>setPredictionPick(btn.dataset.v2Predict)));
    $('wcgBarryTipButton')?.addEventListener('click',tipBarryFromV2);
    $('wcgLegacyModeLaunch')?.addEventListener('click',()=>{
      try{
        if(window.parent&&window.parent!==window)window.parent.postMessage({type:'repo-sports-v2-open-legacy-mode'},'*');
      }catch(_){ }
    });

    $('wcgExit').addEventListener('click',()=>closeBroadcast(false));
    $('wcgSpeed').addEventListener('click',toggleSpeed);
    $('wcgSkipHalf').addEventListener('click',skipToHalftime);
    $('wcgAdminEvents').addEventListener('click',()=>{const panel=$('wcgAdminPanel');panel.hidden=!panel.hidden});
    document.querySelectorAll('[data-test-event]').forEach(btn=>btn.addEventListener('click',()=>previewAdminEvent(btn.dataset.testEvent)));
    document.addEventListener('keydown',e=>{if(matchdayHandleEscape(e))return;if(state.open&&e.key==='Escape'&&state.phase!=='halftime'){e.preventDefault();e.stopPropagation();closeBroadcast(true)}},true);
  }

  function refreshFixtureUi(){
    const root=$('wcWorldCupBroadcast');if(!root)return;
    const scoreTeams=root.querySelectorAll('.wcg-scorebar .wcg-team-score');
    if(scoreTeams[0]){const img=scoreTeams[0].querySelector('.wcg-team-flag'),name=scoreTeams[0].querySelector('.wcg-team-name-text'),line=scoreTeams[0].querySelector('.wcg-team-lineup');if(img){img.src=teamMeta.belros.flag;img.alt=`${teamMeta.belros.name} flag`}if(name)name.textContent=teamMeta.belros.name;if(line)line.textContent=roster.belros.map(p=>p.name).join(' · ')}
    if(scoreTeams[1]){const img=scoreTeams[1].querySelector('.wcg-team-flag'),name=scoreTeams[1].querySelector('.wcg-team-name-text'),line=scoreTeams[1].querySelector('.wcg-team-lineup');if(img){img.src=teamMeta.zafran.flag;img.alt=`${teamMeta.zafran.name} flag`}if(name)name.textContent=teamMeta.zafran.name;if(line)line.textContent=roster.zafran.map(p=>p.name).join(' · ')}
    const mini=root.querySelectorAll('.wcg-mini-stats header span');if(mini[0])mini[0].textContent=teamMeta.belros.name;if(mini[2])mini[2].textContent=teamMeta.zafran.name;
    const arenaLabel=$('wcgArena');if(arenaLabel)arenaLabel.textContent=fixtureVenue();
    const halfTitle=root.querySelector('#wcgHalftime h3');if(halfTitle)halfTitle.textContent=`${fixtureVenue()} · REPO SPORTS LIVE`;
    const halfTeams=root.querySelectorAll('.wcg-halftime-stats .wcg-half-team');
    if(halfTeams[0]){const im=halfTeams[0].querySelector('img'),b=halfTeams[0].querySelector('b');if(im){im.src=teamMeta.belros.flag;im.alt=`${teamMeta.belros.name} flag`}if(b)b.textContent=teamMeta.belros.name}
    if(halfTeams[1]){const im=halfTeams[1].querySelector('img'),b=halfTeams[1].querySelector('b');if(im){im.src=teamMeta.zafran.flag;im.alt=`${teamMeta.zafran.name} flag`}if(b)b.textContent=teamMeta.zafran.name}
    const fullSub=$('wcgFullSubtitle');if(fullSub)fullSub.textContent=`${teamMeta.belros.name} · ${teamMeta.zafran.name}`;
  }


  // ==========================================================
  // REPO SPORTS V2 — BARRY BRAMBLE COMMUNITY TIPPING
  // Uses the original site's V3 tipping service/community goal.
  // ==========================================================
  const BARRY_TIP_COST=200;
  const BARRY_TIP_TARGET=250000;
  const BARRY_TIP_FRAMES=[
    'assets/commentator-tip-1.png','assets/commentator-tip-2.png','assets/commentator-tip-3.png','assets/commentator-tip-4.png',
    'assets/commentator-tip-5.png','assets/commentator-tip-6.png','assets/commentator-tip-7.png','assets/commentator-tip-8.png'
  ];
  const barryTipState={busy:false,tipped:false,total:0,matchId:null,lastRefresh:0,polling:false,animating:false};
  let barryTipSound=null;

  function barryTipBridge(){
    try{return window.parent&&window.parent!==window?window.parent.RepoSportsV2TestBridge:window.RepoSportsV2TestBridge}
    catch(_){return null}
  }

  let barryTipMessageSeq=0;
  const barryTipPending=new Map();
  window.addEventListener('message',event=>{
    const data=event?.data;
    if(!data||data.type!=='repo-sports-v2-barry-tip-response')return;
    const pending=barryTipPending.get(String(data.requestId||''));
    if(!pending)return;
    barryTipPending.delete(String(data.requestId||''));
    clearTimeout(pending.timer);
    if(data.ok)pending.resolve(data.payload||{});
    else pending.reject(new Error(String(data.error||'Barry tip request failed')));
  });
  function barryTipMessage(action){
    return new Promise((resolve,reject)=>{
      const requestId=`barry-${Date.now()}-${++barryTipMessageSeq}`;
      const timer=setTimeout(()=>{
        barryTipPending.delete(requestId);
        reject(new Error('Barry tip service timed out'));
      },5000);
      barryTipPending.set(requestId,{resolve,reject,timer});
      try{
        if(window.parent&&window.parent!==window){
          window.parent.postMessage({type:'repo-sports-v2-barry-tip-request',requestId,action},'*');
        }else{
          const bridge=barryTipBridge();
          const work=action==='tip'?bridge?.tipBarry?.():bridge?.getBarryTipState?.();
          if(!work)throw new Error('Barry tipping service is not connected');
          Promise.resolve(work).then(payload=>{
            const pending=barryTipPending.get(requestId);if(!pending)return;
            barryTipPending.delete(requestId);clearTimeout(pending.timer);pending.resolve(payload||{});
          }).catch(error=>{
            const pending=barryTipPending.get(requestId);if(!pending)return;
            barryTipPending.delete(requestId);clearTimeout(pending.timer);pending.reject(error);
          });
        }
      }catch(error){
        barryTipPending.delete(requestId);clearTimeout(timer);reject(error);
      }
    });
  }
  function renderBarryTipState(message=''){
    const total=Math.max(0,Number(barryTipState.total)||0);
    const progress=Math.min(1,total/BARRY_TIP_TARGET),pct=Math.floor(progress*100);
    const totalEl=$('wcgBarryTipTotal'),fill=$('wcgBarryTipFill'),percent=$('wcgBarryTipPercent'),button=$('wcgBarryTipButton'),status=$('wcgBarryTipStatus'),panel=$('wcgBarryTipPanel');
    if(totalEl)totalEl.textContent=progress>=1?'250,000 / 250,000 GP · COMMUNITY GOAL COMPLETE':`${total.toLocaleString('en-GB')} / 250,000 GP`;
    if(fill)fill.style.width=`${Math.max(0,Math.min(100,pct))}%`;
    if(percent)percent.textContent=progress>=1?'UNLOCKED':`${pct}%`;
    panel?.classList.toggle('is-unlocked',progress>=1);
    panel?.classList.toggle('is-tipped',barryTipState.tipped);
    panel?.classList.toggle('is-busy',barryTipState.busy);
    if(button){
      button.disabled=barryTipState.busy||barryTipState.tipped;
      button.setAttribute('aria-disabled',button.disabled?'true':'false');
      const b=button.querySelector('b'),s=button.querySelector('small');
      if(b)b.textContent=barryTipState.busy?'TIPPING…':barryTipState.tipped?'TIP SENT':'TIP BARRY';
      if(s)s.textContent=barryTipState.tipped?'THIS ROTATION':'200 GP';
    }
    if(status)status.textContent=message||(progress>=1?"BOATER UNLOCKED":barryTipState.tipped?'TIP SENT':'BOATER PROGRESS');
  }
  async function refreshBarryTipState(force=false){
    if(barryTipState.polling)return;
    const now=performance.now();
    if(!force&&now-barryTipState.lastRefresh<15000)return;
    barryTipState.lastRefresh=now;barryTipState.polling=true;
    try{
      // Uses the parent bridge over postMessage, so local-file iframe origin
      // rules cannot break the button/progress lookup.
      const info=await barryTipMessage('state');
      barryTipState.total=Math.max(0,Number(info?.total_gp)||0);
      barryTipState.tipped=!!info?.tipped;
      barryTipState.matchId=Number(info?.match_id)||null;
      renderBarryTipState();
    }catch(error){
      renderBarryTipState('TIP STATUS OFFLINE');
      console.warn('[REPO SPORTS V2] Barry tip status failed',error);
    }finally{barryTipState.polling=false}
  }
  function playBarryTipSound(){
    try{
      if(!barryTipSound){barryTipSound=new Audio('assets/commentator-tip-sound.mp3');barryTipSound.preload='auto';barryTipSound.volume=.3}
      barryTipSound.currentTime=0;void barryTipSound.play().catch(()=>{});
    }catch(_){}
  }
  async function animateBarryTip(){
    if(barryTipState.animating)return;
    barryTipState.animating=true;
    const sprite=barryEl(),wrap=$('wcgCommentator');
    if(!sprite){barryTipState.animating=false;return}
    clearBarryTimers();state.broadcast.speaking=false;
    wrap?.classList.remove('is-speaking','is-excited','is-shocked','is-goal','is-var');wrap?.classList.add('is-tipped');
    const holds=[270,270,300,300,285,285,330,330];
    try{
      for(let i=0;i<BARRY_TIP_FRAMES.length;i++){
        if(!state.open||!sprite.isConnected)break;
        sprite.src=BARRY_TIP_FRAMES[i];
        await new Promise(resolve=>setTimeout(resolve,holds[i]));
      }
    }finally{
      wrap?.classList.remove('is-tipped');
      if(sprite.isConnected)sprite.src=BARRY.neutral;
      barryTipState.animating=false;state.broadcast.barryPriority=0;state.broadcast.barryUntil=0;state.broadcast.barryState='NEUTRAL';
    }
  }
  async function tipBarryFromV2(){
    if(barryTipState.busy||barryTipState.tipped)return;
    barryTipState.busy=true;renderBarryTipState('TIPPING…');
    try{
      // This calls the SAME parent-side V3 RPC as the original Quidditch mode.
      const result=await barryTipMessage('tip');
      barryTipState.total=Math.max(0,Number(result?.total_gp??result?.lifetime_tip_gp??barryTipState.total)||0);
      barryTipState.tipped=true;barryTipState.matchId=Number(result?.match_id)||barryTipState.matchId;
      playBarryTipSound();void animateBarryTip();
      renderBarryTipState('TIP SENT');
      setTimeout(()=>{void refreshBarryTipState(true)},900);
    }catch(error){
      const message=String(error?.message||error||'Tip failed');
      if(/already tipped/i.test(message)){barryTipState.tipped=true;renderBarryTipState('ALREADY TIPPED')}
      else if(/need 200|insufficient|not enough/i.test(message))renderBarryTipState('NEED 200 GP');
      else if(/sign in|logged/i.test(message))renderBarryTipState('SIGN IN TO TIP');
      else renderBarryTipState('TIP FAILED');
      console.warn('[REPO SPORTS V2] Barry tip failed',error);
    }finally{barryTipState.busy=false;renderBarryTipState()}
  }
  function updateBarryTipPolling(now=performance.now()){
    if(state.open&&now-barryTipState.lastRefresh>=15000)void refreshBarryTipState(false);
  }



  // ==========================================================
  // REPO SPORTS V2 — LIVE WATCH PARTY
  // Reuses the original RepoSports live viewer/watchcard source.
  // ==========================================================
  const v2WatchPartyState={lastRefresh:0,polling:false,signature:'',recentCards:new Map()};

  function v2WatchPartyBridge(){
    try{return window.parent&&window.parent!==window?window.parent.RepoSportsV2TestBridge:window.RepoSportsV2TestBridge}
    catch(_){return null}
  }
  function requestV2WatchPartyMessage(){
    try{
      if(window.parent&&window.parent!==window)window.parent.postMessage({type:'repo-sports-v2-watch-party-request'},'*');
    }catch(_){}
  }
  function v2WatchPartyEscape(value){
    return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }
  window.addEventListener('message',event=>{
    const data=event?.data;
    if(!data||data.type!=='repo-sports-v2-watch-party-data')return;
    v2WatchPartyState.polling=false;
    const payload=data.payload||{};
    const apply=()=>{if(state.open)renderV2WatchParty(payload)};
    if('requestIdleCallback' in window)requestIdleCallback(apply,{timeout:700});else setTimeout(apply,0);
  });
  function renderV2WatchParty(payload={}){
    const box=$('wcgWatchPartyCards'),total=$('wcgWatchPartyTotal');
    if(!box)return;

    const incoming=Array.isArray(payload.cards)?payload.cards:[];
    const now=performance.now();
    const keyOf=card=>String(card?.name||'').trim().toLowerCase();

    // Keep a viewer visible through brief heartbeat/profile misses. A single
    // incomplete poll should never make a Watchcard blink out and back in.
    incoming.forEach(card=>{
      const key=keyOf(card);if(!key)return;
      const previous=v2WatchPartyState.recentCards.get(key)?.card||{};
      v2WatchPartyState.recentCards.set(key,{
        card:{...previous,...card},
        seenAt:now
      });
    });
    for(const [key,entry] of v2WatchPartyState.recentCards){
      if(now-(entry?.seenAt||0)>12000)v2WatchPartyState.recentCards.delete(key);
    }

    const cards=[...v2WatchPartyState.recentCards.values()].map(entry=>entry.card);
    const count=Math.max(Number(payload.viewer_count)||0,cards.length,1);
    if(total)total.textContent=String(count);

    const signature=JSON.stringify(cards.map(card=>[card.name,card.avatar,card.background]));
    if(signature===v2WatchPartyState.signature)return;
    v2WatchPartyState.signature=signature;

    box.innerHTML=cards.length?cards.map(card=>{
      const name=v2WatchPartyEscape(card.name||'Viewer');
      const avatar=v2WatchPartyEscape(card.avatar||'assets/player-avatar-default.png');
      // IMPORTANT: use single quotes inside url() because the style attribute
      // itself uses double quotes. Test 14/15 used url("...") here, which could
      // terminate the style attribute and leave the visible tile without its
      // purchased Watchcard backdrop.
      const background=card.background?`url('${v2WatchPartyEscape(card.background)}')`:'linear-gradient(145deg,#26394a,#101924)';
      const cat=String(card.name||'').toLowerCase()==='catasthma'?' is-catasthma':'';
      const hasBg=card.background?' has-watchcard-background':'';
      return `<article class="wcg-v2-watchcard${cat}${hasBg}" tabindex="0" data-viewer-name="${name}" title="${name} — Watch Party profile">
        <div class="wcg-v2-watchcard-art" style="--v2-watchcard-bg:${background}"><img src="${avatar}" alt="${name} avatar"><i aria-hidden="true"></i></div>
        <b>${name}</b>
      </article>`;
    }).join(''):'<span class="wcg-v2-watch-party-loading">No named viewers online</span>';

    const sendProfile=(type,card,event)=>{
      try{
        if(!window.parent||window.parent===window)return;
        const rect=card.getBoundingClientRect();
        window.parent.postMessage({
          type,
          name:card.dataset.viewerName||'',
          x:Number(event?.clientX??rect.right),
          y:Number(event?.clientY??rect.top)
        },'*');
      }catch(_){}
    };
    box.querySelectorAll('.wcg-v2-watchcard[data-viewer-name]').forEach(card=>{
      card.addEventListener('pointerenter',event=>sendProfile('repo-sports-v2-watch-profile-hover',card,event));
      card.addEventListener('pointermove',event=>sendProfile('repo-sports-v2-watch-profile-move',card,event));
      card.addEventListener('pointerleave',()=>sendProfile('repo-sports-v2-watch-profile-hide',card));
      card.addEventListener('focus',event=>sendProfile('repo-sports-v2-watch-profile-hover',card,event));
      card.addEventListener('blur',()=>sendProfile('repo-sports-v2-watch-profile-hide',card));
    });
  }
  async function refreshV2WatchParty(force=false){
    if(v2WatchPartyState.polling)return;
    const now=performance.now();
    if(!force&&now-v2WatchPartyState.lastRefresh<5000)return;
    v2WatchPartyState.lastRefresh=now;
    // One transport only. Previous builds requested the parent payload AND then
    // called the same parent bridge directly, doubling Supabase/profile work on
    // the browser main thread every 2.5 seconds.
    v2WatchPartyState.polling=true;
    requestV2WatchPartyMessage();
    // The postMessage response clears this guard. A short timeout prevents a
    // missing parent reply from blocking future refreshes forever.
    setTimeout(()=>{v2WatchPartyState.polling=false},900);
  }
  function updateV2WatchPartyPolling(now=performance.now()){
    if(state.open&&now-v2WatchPartyState.lastRefresh>=5000)void refreshV2WatchParty(false);
  }



  // ==========================================================
  // REPO SPORTS V2 — WATCH XP PARITY WITH ORIGINAL MODE
  // ==========================================================
  const v2WatchXp={timer:null,minuteTimer:null,pending:false,seq:0,requests:new Map(),sessionGained:0,minuteGained:0};

  function ensureV2MinuteXpToast(){
    let toast=document.getElementById('repoV2MinuteXpToast');
    if(toast)return toast;
    if(!document.getElementById('repoV2MinuteXpToastStyles')){
      const style=document.createElement('style');
      style.id='repoV2MinuteXpToastStyles';
      style.textContent=`
        #repoV2MinuteXpToast{
          position:fixed;right:18px;bottom:18px;z-index:2147483600;
          display:flex;align-items:center;gap:6px;padding:5px 8px;
          border:1px solid rgba(196,151,48,.72);background:rgba(7,14,20,.88);
          color:#e8d69a;font:800 9px/1.1 Georgia,'Times New Roman',serif;
          letter-spacing:.45px;box-shadow:0 2px 10px rgba(0,0,0,.34);
          opacity:0;transform:translateY(4px);pointer-events:none;
          transition:opacity .18s ease,transform .18s ease;
          white-space:nowrap;
        }
        #repoV2MinuteXpToast.is-visible{opacity:.92;transform:translateY(0)}
        #repoV2MinuteXpToast small{font:700 7px/1 sans-serif;color:#91a6b6;letter-spacing:.55px}
      `;
      document.head.appendChild(style);
    }
    toast=document.createElement('div');
    toast.id='repoV2MinuteXpToast';
    toast.setAttribute('aria-live','polite');
    document.body.appendChild(toast);
    return toast;
  }

  function showV2MinuteXp(){
    const gained=Math.max(0,Math.floor(Number(v2WatchXp.minuteGained)||0));
    v2WatchXp.minuteGained=0;
    if(!gained||!state.open||document.hidden)return;
    const toast=ensureV2MinuteXpToast();
    toast.innerHTML=`+${gained.toLocaleString('en-GB')} AGILITY XP <small>1 MIN WATCHED</small>`;
    toast.classList.remove('is-visible');
    void toast.offsetWidth;
    toast.classList.add('is-visible');
    clearTimeout(toast.__repoV2MinuteHide);
    toast.__repoV2MinuteHide=setTimeout(()=>toast.classList.remove('is-visible'),1800);
  }

  function requestV2WatchXp(){
    if(v2WatchXp.pending||!state.open||document.hidden)return;
    const requestId=`v2-xp-${Date.now()}-${++v2WatchXp.seq}`;
    v2WatchXp.pending=true;
    const timer=setTimeout(()=>{
      v2WatchXp.requests.delete(requestId);
      v2WatchXp.pending=false;
    },5000);
    v2WatchXp.requests.set(requestId,{timer});
    try{
      if(window.parent&&window.parent!==window){
        window.parent.postMessage({type:'repo-sports-v2-watch-xp-request',requestId},'*');
      }else{
        clearTimeout(timer);v2WatchXp.requests.delete(requestId);v2WatchXp.pending=false;
      }
    }catch(_){
      clearTimeout(timer);v2WatchXp.requests.delete(requestId);v2WatchXp.pending=false;
    }
  }

  window.addEventListener('message',event=>{
    const data=event?.data;
    if(!data||data.type!=='repo-sports-v2-watch-xp-response')return;
    const requestId=String(data.requestId||''),req=v2WatchXp.requests.get(requestId);
    if(!req)return;
    clearTimeout(req.timer);v2WatchXp.requests.delete(requestId);v2WatchXp.pending=false;
    if(!data.ok){console.warn('[REPO SPORTS V2] Watch XP:',data.error||'claim failed');return}
    const gained=Math.max(0,Number(data.payload?.gained)||0);
    if(gained>0){
      // Keep frequent server claims for accurate accounting, but never show the
      // old per-claim centre banner. Accumulate silently and surface one tiny
      // combined notification for the previous minute of actual earned XP.
      v2WatchXp.sessionGained+=gained;
      v2WatchXp.minuteGained+=gained;
    }
  });

  function startV2WatchXpHeartbeat(){
    stopV2WatchXpHeartbeat();
    v2WatchXp.minuteGained=0;
    requestV2WatchXp();
    v2WatchXp.timer=setInterval(requestV2WatchXp,2000);
    // Presentation cadence is deliberately independent from the server claim
    // cadence: exactly one subtle combined notice per minute while watching.
    v2WatchXp.minuteTimer=setInterval(showV2MinuteXp,60000);
  }

  function stopV2WatchXpHeartbeat(){
    if(v2WatchXp.timer){clearInterval(v2WatchXp.timer);v2WatchXp.timer=null}
    if(v2WatchXp.minuteTimer){clearInterval(v2WatchXp.minuteTimer);v2WatchXp.minuteTimer=null}
    for(const req of v2WatchXp.requests.values())clearTimeout(req.timer);
    v2WatchXp.requests.clear();v2WatchXp.pending=false;v2WatchXp.minuteGained=0;
    document.getElementById('repoV2MinuteXpToast')?.classList.remove('is-visible');
  }

  document.addEventListener('visibilitychange',()=>{
    if(state.open&&!document.hidden)requestV2WatchXp();
  });

  // ==========================================================
  // REPO SPORTS V2 — ORIGINAL CAREER LEADERBOARDS (READ-ONLY)
  // ==========================================================
  const v2CareerState={data:null,lastRefresh:0,polling:false,signature:''};

  function requestV2CareerMessage(){
    try{
      if(window.parent&&window.parent!==window)window.parent.postMessage({type:'repo-sports-v2-career-request'},'*');
    }catch(_){}
  }
  function v2CareerEscape(value){return v2WatchPartyEscape(value)}
  function v2CareerEntries(type){
    const data=v2CareerState.data||{};
    if(type==='winrate')return (Array.isArray(data.winrate_leaders)?data.winrate_leaders:[]).filter(item=>Number(item?.matches||0)>=40).slice(0,5);
    if(type==='teams')return (Array.isArray(data.team_leaders)?data.team_leaders:[]).slice(0,5);
    return (Array.isArray(data.goal_leaders)?data.goal_leaders:[]).slice(0,5);
  }
  function v2CareerRow(item,index,type){
    const team=type==='teams';
    const name=v2CareerEscape(team?(item.team_name||'Unknown Team'):(item.pet_name||'Unknown'));
    const sub=team
      ?(Number(item.matches||0)===0
        ?'NO MATCHES PLAYED YET'
        :`${Number(item.matches||0).toLocaleString('en-GB')} matches · ${Number(item.goals_for||0).toLocaleString('en-GB')} GF · ${Number(item.goals_against||0).toLocaleString('en-GB')} GA`)
      :`${v2CareerEscape(item.owner_name||'Unknown owner')} · ${Number(item.matches||0).toLocaleString('en-GB')} matches`;
    const value=type==='goals'
      ?`<strong>${Number(item.goals||0).toLocaleString('en-GB')}</strong><small>GOALS</small>`
      :type==='winrate'
        ?`<strong>${Number(item.win_rate||0).toFixed(1)}%</strong><small>${Number(item.wins||0).toLocaleString('en-GB')} WINS</small>`
        :`<strong>${Number(item.wins||0).toLocaleString('en-GB')}</strong><small>WINS</small>`;
    return `<article class="wcg-v2-career-row${index===0?' is-first':''}">
      <span class="wcg-v2-career-rank">${index+1}</span>
      <div class="wcg-v2-career-person"><b>${name}</b><small>${sub}</small></div>
      <div class="wcg-v2-career-value">${value}</div>
    </article>`;
  }
  function renderV2CareerSection(type,id){
    const target=$(id);if(!target)return;
    const items=v2CareerEntries(type);
    if(!items.length){
      target.innerHTML=type==='winrate'?'<p>40 matches needed to qualify</p>':'<p>No career records yet</p>';
      return;
    }
    target.innerHTML=items.map((item,index)=>v2CareerRow(item,index,type)).join('');
  }
  function renderV2CareerBoard(){
    renderV2CareerSection('goals','wcgCareerGoals');
    renderV2CareerSection('winrate','wcgCareerWinrate');
    renderV2CareerSection('teams','wcgCareerTeams');
    renderV2StandingsBoard();
  }
  window.addEventListener('message',event=>{
    const data=event?.data;
    if(!data||data.type!=='repo-sports-v2-career-data')return;
    const payload=data.payload||{};
    const signature=JSON.stringify(payload);
    v2CareerState.data=payload;
    v2CareerState.lastRefresh=performance.now();
    v2CareerState.polling=false;
    if(signature!==v2CareerState.signature){
      v2CareerState.signature=signature;
      const apply=()=>{if(state.open)renderV2CareerBoard()};
      if('requestIdleCallback' in window)requestIdleCallback(apply,{timeout:1000});else setTimeout(apply,0);
    }
  });
  async function refreshV2CareerBoard(force=false){
    if(v2CareerState.polling)return;
    const now=performance.now();
    if(!force&&now-v2CareerState.lastRefresh<30000)return;
    v2CareerState.lastRefresh=now;
    v2CareerState.polling=true;
    // Parent/postMessage is the sole source. The old direct fallback duplicated
    // the same leaderboard RPC and rename lookup while the broadcast was live.
    requestV2CareerMessage();
    setTimeout(()=>{v2CareerState.polling=false},1400);
  }
  function updateV2CareerPolling(now=performance.now()){
    if(state.open&&now-v2CareerState.lastRefresh>=30000)void refreshV2CareerBoard(false);
  }

  const img = src => new Promise((resolve,reject)=>{const i=new Image();i.decoding='async';i.onload=()=>resolve(i);i.onerror=()=>reject(new Error(`Image failed to load: ${src}`));i.src=src});
  async function loadStadiumArtwork(){
    // Missing club artwork changes the backdrop only; the fixture still belongs to its home club.
    const requested=activeFixture.arena,fallback=activeFixture.fallbackArena;
    state.stadiumFallbackUsed=!!activeFixture.artworkPending;
    state.stadiumArtworkUrl=requested;
    try{return await img(requested)}catch(error){
      if(!fallback||fallback===requested)throw error;
      const image=await img(fallback);
      state.stadiumFallbackUsed=true;state.stadiumArtworkUrl=fallback;
      console.warn('[VELMORA QUIDDITCH] Club stadium artwork unavailable; using fallback for',activeFixture.stadiumClubId||activeFixture.id);
      return image;
    }
  }
  async function preload(){
    const ballAsset=state.fixture?.ballAsset||VELMORA_QUAFFLE_ASSET;
    const key=`${activeFixture.id}|${allPlayers.map(p=>p.id).join('|')}|${ballAsset}`;
    if(state.assets?.arena&&state.assetsKey===key)return true;
    const entries=[['arena',activeFixture.arena],['flagBelros',teamMeta.belros.flag],['flagZafran',teamMeta.zafran.flag]];
    entries.push(['ball',ballAsset]);
    if(state.fixture?.refStandingAsset)entries.push(['refStanding',state.fixture.refStandingAsset]);
    if(state.fixture?.refFlyingAsset)entries.push(['refFlying',state.fixture.refFlyingAsset]);
    for(const p of allPlayers){if(p.standing)entries.push([p.id+'Standing',p.standing]);if(p.riding)entries.push([p.id+'Riding',p.riding])}
    const settled=await Promise.all(entries.map(async ([k,src])=>{
      try{return [k,k==='arena'?await loadStadiumArtwork():await img(src),null]}catch(error){return [k,null,error]}
    }));
    const loaded={},failures=[];
    for(const [k,image,error] of settled){if(image)loaded[k]=image;else failures.push({key:k,error})}
    if(failures.length)console.warn('[VELMORA QUIDDITCH] Optional fixture assets failed to preload',failures);
    const required=['arena',...allPlayers.map(p=>p.id+'Riding')],missing=required.filter(k=>!loaded[k]);
    if(missing.length)throw new Error(`Required Velmora Quidditch assets missing: ${missing.join(', ')}`);
    for(const p of allPlayers){if(!loaded[p.id+'Standing'])loaded[p.id+'Standing']=loaded[p.id+'Riding']}
    state.assets=loaded;state.assetsKey=key;
    state.ballSpriteFrame=ballAsset.split('?')[0]===VELMORA_QUAFFLE_ASSET.split('?')[0]?{...VELMORA_QUAFFLE_FRAME}:null;return true;
  }

  const audio = {
    crowd:null,whistle:null,goal:null,goalCheer:null,prematch:null,kickoffRelease:null,matchMusic:null,matchMusicAlt:null,matchMusicThird:null,matchMusicFourth:null,matchMusicTracks:[],currentMatchMusic:null,currentMatchMusicIndex:-1,matchMusicFading:false,matchMusicShuffleBag:[],lastMatchMusicIndex:-1,intercepts:[],shots:[],throwSfx:null,catchSfx:null,passMissSfx:[],missImpactSfx:[],hoopHitSfx:[],reboundSfx:[],stealSfx:[],foulSfx:null,tackleSfx:null,collisionSfx:null,lastChallengeAt:0,crowdAccentSfx:[],crowdLong:null,crowdAccentTimer:18,crowdAccentActive:null,crowdAccentStopTimer:0,lastCrowdAccent:-1,goalCheerGuardUntil:0,activeTransientSfx:new Set(),windCtx:null,windSource:null,mix:{ambience:.018,crowd:.18,commentary:.58,sfx:.55,music:.20,matchMusic:.05},
    ensure(){
      if(state.headless||state.fastForwarding||state.audioDisabled)return;
      if(this.crowd)return;
      this.crowd=new Audio('assets/quidditch-crowd.mp3');this.crowd.loop=true;this.crowd.preload='auto';
      this.whistle=new Audio('assets/quidditch-kickoff-whistle.mp3');
      this.goal=new Audio('assets/quidditch-sfx/goal.mp3');
      this.goalCheer=new Audio(`${BASE}crowd-sfx/goal-cheer.mp3`);this.goalCheer.preload='auto';
      this.prematch=new Audio(PREMATCH_ANTHEM);this.prematch.preload='auto';this.prematch.loop=false;
      this.kickoffRelease=new Audio(KICKOFF_RELEASE_SFX);this.kickoffRelease.preload='auto';
      this.matchMusic=new Audio(MATCH_MUSIC);this.matchMusic.preload='auto';this.matchMusic.loop=false;
      this.matchMusicAlt=new Audio(MATCH_MUSIC_ALT);this.matchMusicAlt.preload='auto';this.matchMusicAlt.loop=false;
      this.matchMusicThird=new Audio(MATCH_MUSIC_THIRD);this.matchMusicThird.preload='auto';this.matchMusicThird.loop=false;
      this.matchMusicFourth=new Audio(MATCH_MUSIC_FOURTH);this.matchMusicFourth.preload='auto';this.matchMusicFourth.loop=false;
      this.matchMusicTracks=[this.matchMusic,this.matchMusicAlt,this.matchMusicThird,this.matchMusicFourth].filter(Boolean);
      this.intercepts=[1,2].map(n=>new Audio(`assets/quidditch-intercept-${n}.mp3`));
      this.shots=[1,2,3,4,5].map(n=>new Audio(`assets/quidditch-sfx/shot-${n}.mp3`));
      this.throwSfx=new Audio('assets/quidditch-sfx/throw.wav');
      this.catchSfx=new Audio('assets/quidditch-sfx/catch.mp3');
      this.passMissSfx=[1,2,3].map(n=>new Audio(`${BASE}match-sfx/pass-miss-${n}.mp3`));
      this.missImpactSfx=[1,2,3].map(n=>new Audio(`${BASE}match-sfx/miss-impact-${n}.mp3`));
      this.hoopHitSfx=[1,2,3,4].map(n=>new Audio(`${BASE}match-sfx/hoop-hit-${n}.mp3`));
      this.reboundSfx=[1,2,3,4].map(n=>new Audio(`${BASE}match-sfx/rebound-${n}.mp3`));
      this.stealSfx=[1,2,3].map(n=>new Audio(`${BASE}match-sfx/steal-${n}.mp3`));
      this.foulSfx=new Audio('assets/quidditch-sfx/foul.mp3');
      this.tackleSfx=new Audio('assets/quidditch-sfx/tackle.mp3');
      this.collisionSfx=new Audio('assets/quidditch-sfx/collision-challenge.mp3');
      // Broom flyby clips are deliberately not loaded. They were attached to the
      // routine drive action and could fire every second, overpowering the match mix.
      // Random stadium accent clips removed: these included the occasional loud
      // shouted/screamed vocal heard during open play. Keep the continuous crowd
      // ambience and normal event SFX, but never load or play these vocal accents.
      this.crowdAccentSfx=[];
      this.crowdLong=null;
      [this.throwSfx,this.catchSfx,this.foulSfx,this.tackleSfx,this.collisionSfx,...this.intercepts,...this.shots,...this.passMissSfx,...this.missImpactSfx,...this.hoopHitSfx,...this.reboundSfx,...this.stealSfx].forEach(a=>{if(a)a.preload='auto'});
    },
    buildMatchMusicShuffleBag(exclude=-1){
      this.ensure();
      const tracks=this.matchMusicTracks||[],ids=tracks.map((_,i)=>i);
      // Fisher-Yates shuffle using presentation RNG where available.
      for(let i=ids.length-1;i>0;i--){
        const rnd=(state.audioRand?.()||Math.random()),j=Math.floor(rnd*(i+1));
        [ids[i],ids[j]]=[ids[j],ids[i]];
      }
      if(ids.length>1&&ids[0]===exclude){
        const swap=1+Math.floor((state.audioRand?.()||Math.random())*(ids.length-1));
        [ids[0],ids[swap]]=[ids[swap],ids[0]];
      }
      this.matchMusicShuffleBag=ids;
      return ids;
    },
    nextRandomMatchTrack(){
      this.ensure();
      const tracks=this.matchMusicTracks||[];if(!tracks.length)return -1;
      const current=this.currentMatchMusicIndex;
      if(!Array.isArray(this.matchMusicShuffleBag)||!this.matchMusicShuffleBag.length)this.buildMatchMusicShuffleBag(current);
      let next=this.matchMusicShuffleBag.shift();
      if(tracks.length>1&&next===current){
        if(!this.matchMusicShuffleBag.length)this.buildMatchMusicShuffleBag(current);
        next=this.matchMusicShuffleBag.shift();
      }
      return Number.isFinite(next)?next:0;
    },
    chooseMatchMusicStart(){
      this.ensure();
      const tracks=this.matchMusicTracks||[];if(!tracks.length)return 0;
      let last=-1;
      try{last=Number(sessionStorage.getItem('repoSportsV2LastMusicTrack'));if(!Number.isFinite(last))last=-1}catch(_){}
      this.lastMatchMusicIndex=last;
      this.buildMatchMusicShuffleBag(last);
      const next=this.matchMusicShuffleBag.shift();
      return Number.isFinite(next)?next:0;
    },
    playMatchTrack(index=null,seek=0){
      this.ensure();
      const tracks=this.matchMusicTracks||[];if(!tracks.length)return;
      const wanted=Number.isFinite(index)?index:this.nextRandomMatchTrack();
      const safe=((wanted%tracks.length)+tracks.length)%tracks.length;
      const a=tracks[safe];if(!a)return;
      this.currentMatchMusicIndex=safe;this.lastMatchMusicIndex=safe;this.currentMatchMusic=a;this.matchMusicFading=false;
      try{sessionStorage.setItem('repoSportsV2LastMusicTrack',String(safe))}catch(_){}
      tracks.forEach(track=>{if(track&&track!==a){try{track.pause();track.currentTime=0;track.volume=0;track.onended=null}catch(_){}}});
      try{
        a.pause();
        if(Number.isFinite(seek)&&seek>0)a.currentTime=Math.max(0,seek);else a.currentTime=0;
        a.volume=0;
        // Ended tracks pull from a shuffled bag, never index+1.
        a.onended=()=>{if(!state.open)return;this.playMatchTrack(this.nextRandomMatchTrack(),0)};
        const pr=a.play();
        pr?.then?.(()=>this.fadeVolume(a,0,this.mix.matchMusic,900))?.catch?.(()=>{});
      }catch(_){}
    },
    fadeVolume(a,from,to,ms,onDone=null){
      if(!a)return;const start=performance.now(),token=(a.__wcFadeToken||0)+1;a.__wcFadeToken=token;a.volume=clamp(from,0,1);
      const step=now=>{if(a.__wcFadeToken!==token)return;const t=clamp((now-start)/Math.max(1,ms),0,1);a.volume=lerp(from,to,t);if(t<1&&!a.paused)requestAnimationFrame(step);else onDone?.()};
      requestAnimationFrame(step);
    },
    play(a,vol=.55,opts={}){
      if(state.headless||state.fastForwarding||state.audioDisabled)return null;
      try{
        if(!a)return null;
        // Clone the source so overlapping match events never hard-cut one another.
        // Existing SFX retain the old soft envelope; the new short impacts can opt into
        // a faster attack/release so contact remains crisp rather than mushy.
        const inst=a.cloneNode(true),target=clamp(vol*.50,0,1);
        const fadeIn=Number.isFinite(Number(opts.fadeIn))?Math.max(0,Number(opts.fadeIn)):180;
        const fadeOut=Number.isFinite(Number(opts.fadeOut))?Math.max(0,Number(opts.fadeOut)):320;
        const rate=Number.isFinite(Number(opts.rate))?clamp(Number(opts.rate),.75,1.35):1;
        inst.preload='auto';inst.volume=0;inst.playbackRate=rate;this.activeTransientSfx.add(inst);
        const cleanup=()=>{this.activeTransientSfx.delete(inst);inst.onended=null;inst.ontimeupdate=null;try{inst.pause()}catch(_){}};
        const armFade=()=>{
          const d=Number(inst.duration)||0;if(d>0&&fadeOut>0){
            const fadeStart=Math.max(.06,d-fadeOut/1000);
            inst.ontimeupdate=()=>{if(inst.currentTime>=fadeStart&&!inst.__wcFadingOut){inst.__wcFadingOut=true;this.fadeVolume(inst,inst.volume,0,fadeOut,cleanup)}};
          }
        };
        inst.onloadedmetadata=armFade;inst.onended=cleanup;
        const pr=inst.play();pr?.then?.(()=>{if(fadeIn>0)this.fadeVolume(inst,0,target,fadeIn);else inst.volume=target;armFade()})?.catch?.(()=>cleanup());
        return inst;
      }catch(_){return null}
    },
    start(){this.ensure();this.stopCrowdAccent();this.crowdAccentTimer=14+(state.audioRand?.()||Math.random())*14;try{this.crowd.volume=state.phase==='intro'?.09:state.crowdBase;this.crowd.currentTime=0;this.crowd.play()?.catch?.(()=>{})}catch(_){};this.startWind()},
    startPrematch(offset=0){
      this.ensure();state.prematchAudioFailed=false;
      if(state.headless||state.fastForwarding||state.phase!=='intro'||!this.prematch)return;
      const a=this.prematch;
      try{
        a.pause();
        const start=clamp(Number(offset)||0,0,Math.max(0,(Number(a.duration)||35.616)-.08));
        if(Number.isFinite(start)&&start>0)a.currentTime=start;else a.currentTime=0;
        a.volume=this.mix.music; // 30%
        const pr=a.play();
        pr?.catch?.(()=>{state.prematchAudioFailed=true});
      }catch(_){state.prematchAudioFailed=true}
    },
    playKickoffRelease(){
      // audio.play() intentionally halves discrete SFX; .40 => final 20%.
      this.ensure();
      if(state.headless||state.fastForwarding)return;
      this.play(this.kickoffRelease,.40);
    },
    startMatchMusic(){this.ensure();if(this.currentMatchMusic&&!this.currentMatchMusic.paused)return;if(this.currentMatchMusicIndex<0)this.currentMatchMusicIndex=this.chooseMatchMusicStart();this.playMatchTrack(this.currentMatchMusicIndex,0)},
    pauseMatchMusic(){this.ensure();const a=this.currentMatchMusic;if(!a||a.paused||this.matchMusicFading)return;this.matchMusicFading=true;try{this.fadeVolume(a,a.volume,0,700,()=>{try{a.pause()}catch(_){}this.matchMusicFading=false})}catch(_){try{a.pause()}catch(__){}this.matchMusicFading=false}},
    startWind(){if(state.headless||state.fastForwarding||state.audioDisabled)return;try{const AC=window.AudioContext||window.webkitAudioContext;if(!AC||this.windCtx)return;const ctx=new AC(),buffer=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*.42;const src=ctx.createBufferSource(),low=ctx.createBiquadFilter(),high=ctx.createBiquadFilter(),gain=ctx.createGain();src.buffer=buffer;src.loop=true;low.type='lowpass';low.frequency.value=780;high.type='highpass';high.frequency.value=90;gain.gain.value=this.mix.ambience;src.connect(low);low.connect(high);high.connect(gain);gain.connect(ctx.destination);src.start();this.windCtx=ctx;this.windSource=src}catch(_){}} ,
    stop(){this.ensure();this.stopCrowdAccent();for(const a of this.activeTransientSfx){try{a.__wcFadeToken=(a.__wcFadeToken||0)+1;a.pause();a.currentTime=0}catch(_){}}this.activeTransientSfx.clear();[this.crowd,this.whistle,this.goal,this.goalCheer,this.prematch,this.kickoffRelease,this.throwSfx,this.catchSfx,this.foulSfx,this.tackleSfx,this.collisionSfx,...(this.matchMusicTracks||[]),...this.intercepts,...this.shots,...this.passMissSfx,...this.missImpactSfx,...this.hoopHitSfx,...this.reboundSfx,...this.stealSfx,...this.crowdAccentSfx,this.crowdLong].forEach(a=>{try{a?.pause();if(a){a.currentTime=0;a.volume=0;a.onended=null}}catch(_){}});this.currentMatchMusic=null;this.currentMatchMusicIndex=-1;this.matchMusicShuffleBag=[];this.lastChallengeAt=0;try{this.windSource?.stop()}catch(_){};try{this.windCtx?.close()}catch(_){};this.windSource=null;this.windCtx=null},
    crowdHit(amount=.22){state.crowdBoost=Math.max(state.crowdBoost,amount)},
    shot(){this.ensure();if(!this.shots.length)return;this.play(this.shots[Math.floor((state.audioRand?.()||Math.random())*this.shots.length)],.48,{fadeIn:18,fadeOut:110})},
    throwPass(distance=.10){this.ensure();const r=state.audioRand?.()||Math.random(),vol=clamp(.31+Math.min(.15,Math.max(0,Number(distance)||0)*.55),.31,.46);this.play(this.throwSfx,vol,{rate:.94+r*.12,fadeIn:12,fadeOut:95})},
    catchBall(kind='pass'){this.ensure();const r=state.audioRand?.()||Math.random(),vol=kind==='save'?.78:kind==='kickoff'?.60:.66;this.play(this.catchSfx,vol,{rate:.97+r*.06,fadeIn:10,fadeOut:100})},
    intercept(){this.ensure();if(!this.intercepts.length)return;this.play(this.intercepts[Math.floor((state.audioRand?.()||Math.random())*this.intercepts.length)],.46,{fadeIn:8,fadeOut:85})},
    passMiss(){this.ensure();if(!this.passMissSfx.length)return;this.play(this.passMissSfx[Math.floor((state.audioRand?.()||Math.random())*this.passMissSfx.length)],.30,{fadeIn:12,fadeOut:90})},
    missImpact(){this.ensure();if(!this.missImpactSfx.length)return;this.play(this.missImpactSfx[Math.floor((state.audioRand?.()||Math.random())*this.missImpactSfx.length)],.60,{fadeIn:8,fadeOut:110})},
    hoopHit(){this.ensure();if(!this.hoopHitSfx.length)return;this.play(this.hoopHitSfx[Math.floor((state.audioRand?.()||Math.random())*this.hoopHitSfx.length)],.50,{fadeIn:6,fadeOut:120})},
    rebound(){this.ensure();if(!this.reboundSfx.length)return;this.play(this.reboundSfx[Math.floor((state.audioRand?.()||Math.random())*this.reboundSfx.length)],.48,{fadeIn:8,fadeOut:120})},
    steal(){this.ensure();if(!this.stealSfx.length)return;this.play(this.stealSfx[Math.floor((state.audioRand?.()||Math.random())*this.stealSfx.length)],.50,{fadeIn:8,fadeOut:100})},
    foul(){this.ensure();this.play(this.foulSfx,.54,{fadeIn:8,fadeOut:110})},
    challenge(won=false){
      this.ensure();const now=(typeof performance!=='undefined'&&performance.now)?performance.now():Date.now();if(now-this.lastChallengeAt<240)return;this.lastChallengeAt=now;
      this.play(won?this.collisionSfx:this.tackleSfx,won?.52:.40,{rate:.96+(state.audioRand?.()||Math.random())*.08,fadeIn:6,fadeOut:95});
    },
    goalCelebration(){this.ensure();const now=performance.now();if(now<this.goalCheerGuardUntil)return;this.goalCheerGuardUntil=now+2800;this.stopCrowdAccent();this.play(this.goalCheer,.15);this.crowdAccentTimer=Math.max(this.crowdAccentTimer,16)},
    stopCrowdAccent(){
      clearTimeout(this.crowdAccentStopTimer);this.crowdAccentStopTimer=0;
      if(this.crowdAccentActive){
        const a=this.crowdAccentActive;this.crowdAccentActive=null;
        try{this.fadeVolume(a,a.volume,0,420,()=>{try{a.pause()}catch(_){}})}catch(_){try{a.pause()}catch(__){}}
      }
    },
    playCrowdShort(){
      this.ensure();if(this.crowdAccentActive)return;let idx=Math.floor((state.audioRand?.()||Math.random())*this.crowdAccentSfx.length);
      if(idx===this.lastCrowdAccent&&this.crowdAccentSfx.length>1)idx=(idx+1)%this.crowdAccentSfx.length;this.lastCrowdAccent=idx;
      const a=this.crowdAccentSfx[idx];if(!a)return;this.crowdAccentActive=a;try{a.pause();a.currentTime=0;a.volume=0;a.__wcAccentFadeOut=false;a.onended=()=>{if(this.crowdAccentActive===a)this.crowdAccentActive=null};a.ontimeupdate=()=>{const d=Number(a.duration)||0;if(d>0&&a.currentTime>=Math.max(.3,d-.65)&&!a.__wcAccentFadeOut){a.__wcAccentFadeOut=true;this.fadeVolume(a,a.volume,0,620,()=>{try{a.pause()}catch(_){}if(this.crowdAccentActive===a)this.crowdAccentActive=null})}};const pr=a.play();pr?.then?.(()=>this.fadeVolume(a,0,.075,420))?.catch?.(()=>{if(this.crowdAccentActive===a)this.crowdAccentActive=null})}catch(_){this.crowdAccentActive=null}
    },
    playCrowdLongSegment(){
      this.ensure();if(this.crowdAccentActive||!this.crowdLong)return;const a=this.crowdLong;this.crowdAccentActive=a;
      const begin=()=>{if(!state.open){this.crowdAccentActive=null;return}try{const r=state.audioRand?.()||Math.random(),r2=state.audioRand?.()||Math.random(),segment=3.8+r2*2.4,maxStart=Math.max(0,(a.duration||123)-segment-1),start=r*maxStart;a.pause();a.currentTime=start;a.volume=0;const pr=a.play();pr?.then?.(()=>this.fadeVolume(a,0,.075,520))?.catch?.(()=>{if(this.crowdAccentActive===a)this.crowdAccentActive=null});clearTimeout(this.crowdAccentStopTimer);this.crowdAccentStopTimer=setTimeout(()=>{this.fadeVolume(a,a.volume,0,700,()=>{try{a.pause()}catch(_){}if(this.crowdAccentActive===a)this.crowdAccentActive=null})},Math.max(900,segment*1000-700))}catch(_){this.crowdAccentActive=null}};
      if(Number.isFinite(a.duration)&&a.duration>0)begin();else a.addEventListener('loadedmetadata',begin,{once:true});
    },
    updateCrowdAccents(dt){
      // Deliberately disabled. The old random accent system fired roughly every
      // 21-44 seconds and could select a loud shouted stadium-vocal clip.
      // Base crowd ambience, goal cheer, whistles and match SFX remain enabled.
      return;
    },
    varTone(){
      if(state.headless||state.fastForwarding)return;
      try{const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;const ctx=new AC();const o=ctx.createOscillator(),g=ctx.createGain();o.type='square';o.frequency.setValueAtTime(620,ctx.currentTime);o.frequency.setValueAtTime(440,ctx.currentTime+.16);g.gain.setValueAtTime(.0001,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.0225,ctx.currentTime+.06);g.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+.42);o.connect(g);g.connect(ctx.destination);o.start();o.stop(ctx.currentTime+.45)}catch(_){}
    },
    specialMoment(kind='hattrick'){
      if(state.headless||state.fastForwarding)return;
      try{
        const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;const ctx=new AC(),now=ctx.currentTime,master=ctx.createGain();master.gain.value=.12;master.connect(ctx.destination);
        const tone=(type,freq,start,dur,vol,endFreq=null)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.setValueAtTime(freq,start);if(endFreq)o.frequency.exponentialRampToValueAtTime(endFreq,start+dur);g.gain.setValueAtTime(.0001,start);g.gain.exponentialRampToValueAtTime(vol,start+.018);g.gain.exponentialRampToValueAtTime(.0001,start+dur);o.connect(g);g.connect(master);o.start(start);o.stop(start+dur+.02)};
        if(kind==='penalty'){tone('square',820,now,.13,.14,640);tone('triangle',300,now+.035,.34,.11,220);tone('sine',150,now+.055,.42,.07,95)}
        else{tone('triangle',523.25,now,.18,.12);tone('triangle',659.25,now+.075,.18,.12);tone('triangle',783.99,now+.15,.30,.14);tone('sine',1046.5,now+.18,.44,.065,784)}
        setTimeout(()=>{try{ctx.close()}catch(_){}},850);
      }catch(_){}
    }
  };

  const BARRY = {
    neutral:'assets/commentator-22.png',
    talk:['assets/commentator-22.png','assets/commentator-23.png','assets/commentator-24.png','assets/commentator-23.png','assets/commentator-28.png','assets/commentator-24.png'],
    excited:'assets/commentator-28.png', shocked:'assets/barry-events/barry-04.png', goal:'assets/commentator-29.png',
    var:'assets/barry-events/barry-06.png', halftime:'assets/commentator-25.png', fulltime:'assets/commentator-27.png'
  };
  function barryEl(){return $('wcgBarrySprite')}
  function clearBarryTimers(){const b=state.broadcast;if(!b)return;clearInterval(b.talkTimer);clearTimeout(b.barryTimer);b.talkTimer=0;b.barryTimer=0}
  function barryAsset(src){const el=barryEl();if(el&&src&&el.getAttribute('src')!==src)el.src=src}
  function barryReaction(name='NEUTRAL',priority=1,duration=900){
    const b=state.broadcast,now=performance.now();if(!b)return false;
    if(now<b.barryUntil && priority<b.barryPriority)return false;
    clearBarryTimers();b.barryState=name;b.barryPriority=priority;b.barryUntil=now+duration;b.speaking=false;
    const wrap=$('wcgCommentator');if(wrap){wrap.dataset.barryState=name;wrap.classList.remove('is-speaking','is-excited','is-shocked','is-goal','is-var');}
    if(name==='GOAL_REACTION'){barryAsset(BARRY.goal);wrap?.classList.add('is-goal')}
    else if(name==='SHOCKED'){barryAsset(BARRY.shocked);wrap?.classList.add('is-shocked')}
    else if(name==='EXCITED'){barryAsset(BARRY.excited);wrap?.classList.add('is-excited')}
    else if(name==='VAR_REACTION'){barryAsset(BARRY.var);wrap?.classList.add('is-var')}
    else if(name==='HALFTIME'){barryAsset(BARRY.halftime)}
    else if(name==='FULLTIME'){barryAsset(BARRY.fulltime)}
    else barryAsset(BARRY.neutral);
    b.barryTimer=setTimeout(()=>{if(!state.open||state.broadcast.speaking)return;state.broadcast.barryPriority=0;state.broadcast.barryUntil=0;state.broadcast.barryState='NEUTRAL';const w=$('wcgCommentator');if(w){w.dataset.barryState='NEUTRAL';w.classList.remove('is-excited','is-shocked','is-goal','is-var')}barryAsset(BARRY.neutral)},duration);
    return true;
  }
  function commentaryDuration(text){return clamp(String(text||'').length*27,850,2850)}
  // Barry is deliberately text-only in spectator mode. Commentary still drives his
  // mouth/reaction sprites and the lower broadcast caption, but no TTS request,
  // speechSynthesis fallback or spoken audio is created.
  function primeBarryVoice(){
    if(state.broadcast)state.broadcast.voiceName='TEXT ONLY';
  }
  function cancelBarryAudio(){
    // Kept as a compatibility hook for the reaction/priority system. There is no
    // voice audio to cancel; Barry's visual speaking timer is managed separately.
  }
  function startBarrySpeaking(text,priority=2,intensity='calm'){
    const b=state.broadcast,wrap=$('wcgCommentator');if(!b)return;
    const duration=commentaryDuration(text);
    clearBarryTimers();
    b.speaking=true;b.barryState='SPEAKING';b.barryPriority=priority;b.barryUntil=performance.now()+duration;
    if(wrap){
      wrap.dataset.barryState='SPEAKING';
      wrap.classList.remove('is-excited','is-shocked','is-goal','is-var');
      wrap.classList.add('is-speaking');
    }
    let i=0,finished=false;
    barryAsset(BARRY.talk[0]);
    b.talkTimer=setInterval(()=>{
      if(!state.open||!state.broadcast.speaking)return;
      i=(i+1)%BARRY.talk.length;barryAsset(BARRY.talk[i]);
    },150+(intensity==='explosive'?-25:intensity==='excited'?-10:10));
    const finish=()=>{
      if(finished)return;finished=true;
      clearInterval(b.talkTimer);b.talkTimer=0;clearTimeout(b.barryTimer);b.barryTimer=0;
      b.speaking=false;if(wrap)wrap.classList.remove('is-speaking');
      b.barryPriority=0;b.barryUntil=0;b.barryState='NEUTRAL';if(wrap)wrap.dataset.barryState='NEUTRAL';
      barryAsset(BARRY.neutral);
    };
    b.barryTimer=setTimeout(finish,duration);
  }

  function commentaryOpts(kind){
    const map={goal:[10,'explosive',true],var:[8,'excited',true],save:[7,'excited',true],post:[7,'excited',true],foul:[6,'interested',true],penalty:[7,'excited',true],intercept:[6,'excited',true],shot:[4,'interested',false],rebound:[5,'excited',false],kickoff:[8,'excited',true],halftime:[7,'calm',true],fulltime:[9,'excited',true],pass:[2,'calm',false],drive:[3,'interested',false],miss:[4,'interested',false]};
    const [priority,intensity,force]=map[kind]||[2,'calm',false];return {priority,intensity,force,kind};
  }
  function updateBroadcastDirector(dt){
    const b=state.broadcast;if(!b)return;
    const phase=state.director?.phase||'BUILD-UP';const targetByPhase={"BUILD-UP":.12,ATTACK:.17,COUNTERATTACK:.23,"DEFENSIVE PRESSURE":.22,"GOAL CHANCE":.29,RESET:.15,"SET PIECE":.22};
    b.crowdTarget=clamp((targetByPhase[phase]||.14)+state.crowdBoost,0,.62);b.crowdLevel=lerp(b.crowdLevel,b.crowdTarget,1-Math.exp(-dt*1.9));
    if(audio.crowd)audio.crowd.volume=clamp(b.crowdLevel,0,.68);
    if(audio.prematch&&state.phase==='intro'&&!audio.prematch.paused)audio.prematch.volume=audio.mix.music;
    if(b.queue&&!b.speaking&&performance.now()-b.lastSpokenAt>900){const q=b.queue;b.queue=null;say(q.text,{...q.opts,force:true})}
    if((state.phase==='first'||state.phase==='second')&&phase!==b.phaseSeen){
      b.phaseSeen=phase;
      if(phase==='COUNTERATTACK'&&state.carrier) say(formatLine('counterattack',{pet:state.carrier.player.name}),{priority:4,intensity:'interested',kind:'sequence'});
      else if(phase==='GOAL CHANCE'&&state.carrier){barryReaction('EXCITED',4,650);say(formatLine('chance',{pet:state.carrier.player.name}),{priority:4,intensity:'excited',kind:'sequence'});}
    }
    if(adminEnabled()){const root=$('wcWorldCupBroadcast');if(root){root.dataset.barryDebug=b.barryState;root.dataset.audioDebug=Math.round(b.crowdLevel*100)}}
  }

  function stopWorldCupMenuAudio(){
    ['worldCupEventMusic','worldCupMeetTeamsMusic','worldCupTvAudio'].forEach(id=>{const a=$(id);if(a){try{a.pause()}catch(_){}}});
  }
  function restoreWorldCupMenuAudio(){
    const a=$('worldCupEventMusic');if(a){try{a.volume=.30;a.play()?.catch?.(()=>{})}catch(_){}}
  }

  function commentaryRandom(){return state.commentaryRand?.()||Math.random()}
  function pick(arr){return arr[Math.floor(commentaryRandom()*arr.length)]}
  function commentarySkeleton(text){
    let s=String(text||'').toLowerCase();
    allPlayers.forEach(p=>{s=s.replaceAll(p.name.toLowerCase(),'<player>')});
    s=s.replace(/\b\d+[–-]\d+\b/g,'<score>').replace(/\b\d+\b/g,'<n>').replace(/[^a-z<> ]+/g,' ').replace(/\s+/g,' ').trim();
    return s;
  }
  function formatLine(kind,data={}){
    const bank=commentary[kind]||commentary.pass,b=state.broadcast||{};let fallback='';
    for(let tries=0;tries<36;tries++){
      const entry=pick(bank),line=String(typeof entry==='function'?entry(data):entry||'').replace(/\s+/g,' ').trim();if(!line)continue;fallback=line;
      const skeleton=commentarySkeleton(line);
      if(!(b.recent||[]).includes(line)&&!(b.recentSkeletons||[]).includes(skeleton))return line;
    }
    return fallback||'Play continues.';
  }
  function queueBarry(text,opts){
    const b=state.broadcast;if(!b)return;
    const incoming=Number(opts?.priority||2),existing=Number(b.queue?.opts?.priority||0);
    if(!b.queue||incoming>=existing)b.queue={text,opts:{...opts,force:false}};
  }
  function say(text,opts={}){
    text=String(text||'').replace(/\s+/g,' ').trim();if(!text)return false;const b=state.broadcast||{},now=performance.now();
    const priority=Number(opts.priority||2),intensity=opts.intensity||'calm',force=!!opts.force;
    const minGap=priority>=8?320:priority>=6?800:priority>=4?1250:2200;
    if(priority>=8)b.queue=null; // do not let stale routine commentary survive a major moment
    if(b.speaking){
      // A goal may break in immediately. Everything else waits rather than chopping a sentence in half.
      if(priority>=10&&priority>b.barryPriority){b.queue=null;cancelBarryAudio();clearBarryTimers();b.speaking=false;}
      else{if(priority>=4)queueBarry(text,{priority,intensity,kind:opts.kind||''});return false;}
    }
    if(!force&&now-(b.lastSpokenAt||0)<minGap){if(priority>=4)queueBarry(text,{priority,intensity,kind:opts.kind||''});return false;}
    const skeleton=commentarySkeleton(text);
    if(!force&&((b.recent||[]).includes(text)||(b.recentSkeletons||[]).includes(skeleton)))return false;
    const box=$('wcgCommentary');if(!box)return false;box.textContent=text;b.lastSpokenAt=now;b.lastText=text;b.recent=[text,...(b.recent||[]).filter(x=>x!==text)].slice(0,60);b.recentSkeletons=[skeleton,...(b.recentSkeletons||[]).filter(x=>x!==skeleton)].slice(0,32);b.debugEvent=opts.kind||'COMMENTARY';
    let reactionDelay=0;if(priority>=10){cancelBarryAudio();barryReaction('GOAL_REACTION',10,610);reactionDelay=520}
    else if(opts.kind==='fulltime'){cancelBarryAudio();barryReaction('FULLTIME',9,500);reactionDelay=360}
    else if(opts.kind==='halftime'){barryReaction('HALFTIME',7,360);reactionDelay=220}
    else if(opts.kind==='var'){cancelBarryAudio();barryReaction('VAR_REACTION',8,460);reactionDelay=360}
    else if(priority>=7){cancelBarryAudio();barryReaction('SHOCKED',priority,350);reactionDelay=260}
    else if(priority>=4){barryReaction('EXCITED',priority,230);reactionDelay=130}
    if(reactionDelay){const expected=text;setTimeout(()=>{if(state.open&&state.broadcast.lastText===expected)startBarrySpeaking(text,priority,intensity)},reactionDelay)}else startBarrySpeaking(text,priority,intensity);return true;
  }
  function maybeLore(player, chance=.12){
    chance=Math.min(chance,.025);if(!player||commentaryRandom()>chance)return false;
    const available=player.lore.map((line,i)=>({line,key:player.id+':'+i})).filter(x=>!state.loreUsed.has(x.key));
    if(!available.length)return false;const item=available[Math.floor(commentaryRandom()*available.length)];const spoken=say(item.line,{priority:2,intensity:'calm',kind:'lore'});if(spoken)state.loreUsed.add(item.key);return spoken;
  }
  function eventLine(kind,data={},player=null,loreChance=.08){
    if(maybeLore(player,loreChance))return;
    const ps=player?state.playerStats[player.id]:null,opts=commentaryOpts(kind);
    if(kind==='intercept'&&ps?.interceptions>=2&&ps.interceptions%2===0){say(`${player.name} again. Interception number ${ps.interceptions}.`,{...opts,priority:7});return}
    if(kind==='goal'&&ps?.goals>=2){say(`${player.name} again! Goal number ${ps.goals}.`,{...opts});return}
    if(kind==='save'&&ps?.saves>=2){say(`${player.name} again. Save number ${ps.saves}.`,{...opts,priority:7});return}
    say(formatLine(kind,data),opts);
  }

  function showBanner(text,type='',seconds=1.8){const el=$('wcgEventBanner');if(!el)return;el.textContent=text;el.className='wcg-event-banner is-visible'+(type?` is-${type}`:'');state.eventBannerTimer=seconds}

function hideBigMoment(){
  const root=$('wcgBigMoment');if(!root)return;
  root.classList.remove('is-visible','is-animate');root.removeAttribute('data-kind');
  const host=$('wcgBigMomentParticles');if(host)host.innerHTML='';
  state.bigMomentTimer=0;
}
function spawnBigMomentParticles(kind='hattrick',count=28){
  const host=$('wcgBigMomentParticles');if(!host)return;host.innerHTML='';
  const rand=state.visualRand||Math.random;
  for(let i=0;i<count;i++){
    const p=document.createElement('span');p.className='wcg-big-moment-particle';
    const angle=-96+(192*(i/Math.max(1,count-1)))+(rand()-.5)*16;
    const dist=(kind==='penalty'?108:134)+rand()*(kind==='penalty'?110:150);
    p.style.setProperty('--rot',angle.toFixed(2)+'deg');p.style.setProperty('--dist',dist.toFixed(1)+'px');p.style.setProperty('--rise',(-8-rand()*38).toFixed(1)+'px');
    p.style.setProperty('--delay',(rand()*.13).toFixed(3)+'s');p.style.setProperty('--dur',((kind==='penalty'?1.02:1.14)+rand()*.56).toFixed(3)+'s');
    const sz=(4+rand()*8.5).toFixed(1)+'px';p.style.width=sz;p.style.height=sz;host.appendChild(p);
  }
}
function triggerBigMoment(kind='hattrick'){
  if(state.headless||state.fastForwarding)return;
  const root=$('wcgBigMoment'),img=$('wcgBigMomentImg');if(!root||!img)return;
  const k=String(kind).toLowerCase()==='penalty'?'penalty':'hattrick';
  root.classList.remove('is-visible','is-animate');void root.offsetWidth;root.dataset.kind=k;
  img.src=k==='penalty'?PENALTY_BANNER_SRC:HAT_TRICK_BANNER_SRC;img.alt=k==='penalty'?'Penalty':'Hat trick';
  spawnBigMomentParticles(k,k==='penalty'?24:30);root.classList.add('is-visible','is-animate');
  state.bigMomentTimer=k==='penalty'?1.95:2.30;audio.specialMoment?.(k);
}
  function setBroadcastState(name){state.broadcastState=name;const root=$('wcWorldCupBroadcast');if(root)root.dataset.broadcastState=name}
  function setBroadcastSequence(name,{frozen=true,reset=true}={}){
    const b=state.broadcastSequence||(state.broadcastSequence={state:'complete',elapsed:0,serial:0,frozen:false,skipped:false});
    if(b.state===name&&!reset)return;
    b.state=name;b.frozen=!!frozen;if(reset)b.elapsed=0;b.serial=(b.serial||0)+1;
    if(BROADCAST_DEBUG)console.log('[BROADCAST]',{State:name,Frozen:b.frozen,Match:`${teamMeta.belros.name} vs ${teamMeta.zafran.name}`,Duration:b.elapsed});
  }
  function tickBroadcastSequence(dt){if(state.broadcastSequence)state.broadcastSequence.elapsed=(state.broadcastSequence.elapsed||0)+Math.max(0,dt||0)}
  function fixtureStage(){
    const raw=String(state.fixture?.stage||state.fixture?.round||state.fixture?.competitionStage||'REPO SPORTS · LIVE LEAGUE').trim();
    return raw?raw.toUpperCase():'REPO SPORTS · LIVE LEAGUE';
  }
  function fixtureVenue(){
    return String(state.fixture?.venue?.name||state.fixture?.venue||state.fixture?.stadium||activeFixture?.venue||'STANDARD REPO SPORTS ARENA').trim()||'STANDARD REPO SPORTS ARENA';
  }
  function nextFixtureMarkup(){
    const n=state.fixture?.nextFixture||state.fixture?.next||null;if(!n)return '';
    const a=String(n.teamA?.name||n.home?.name||n.home||n.teamA||'').trim(),b=String(n.teamB?.name||n.away?.name||n.away||n.teamB||'').trim();
    if(!a||!b)return '';
    const venue=String(n.venue?.name||n.venue||'').trim();
    return `<div class="wcg-next-fixture"><small>NEXT ON REPO SPORTS</small><b>${a} <span>vs</span> ${b}</b>${venue?`<em>${venue}</em>`:''}</div>`;
  }
  function skipBroadcastPresentation(){
    if(!state.open||state.syncMode)return;
    if(state.phase==='intro'){state.broadcastSequence.skipped=true;completePrematch();return}
    if(state.phase==='halftime'&&state.halftimeReady&&isHost()){continueSecondHalf();return}
    if(state.phase==='fulltime'){state.broadcastSequence.skipped=true;state.fulltimeElapsed=999;hidePresentation();populateFulltimePanel(state.fulltimeData);$('wcgFulltime')?.classList.add('is-open');setBroadcastState('POST_MATCH');setBroadcastSequence('complete',{frozen:true});}
  }
  function careerBroadcastLabel(value=''){
    const text=String(value||'');
    return state.careerMode?text.replace(/^REPO SPORTS(?:\s*·)?/i,'VELMORA MANAGER ·').replace(/VELMORA MANAGER ·\s*$/,'VELMORA MANAGER'):text;
  }
  function showStoryCard(kicker,title,body,team='',player=null,seconds=4.4){
    const card=$('wcgStoryCard');if(!card)return;
    $('wcgStoryKicker').textContent=careerBroadcastLabel(kicker||'REPO SPORTS');$('wcgStoryTitle').textContent=title||'';$('wcgStoryBody').textContent=body||'';
    const flag=$('wcgStoryFlag'),portrait=$('wcgStoryPlayer');
    if(team&&teamMeta[team]){flag.src=teamMeta[team].flag;flag.alt=`${teamMeta[team].name} flag`;flag.parentElement.style.display='grid'}else flag.parentElement.style.display='none';
    if(player?.standing){portrait.src=player.standing;portrait.alt=player.name;portrait.style.display='block'}else portrait.style.display='none';
    card.classList.add('is-visible');card.setAttribute('aria-hidden','false');state.storyGraphicUntil=performance.now()+seconds*1000;
  }
  function hideStoryCard(){const card=$('wcgStoryCard');if(card){card.classList.remove('is-visible');card.setAttribute('aria-hidden','true')}state.storyGraphicUntil=0}
  function updateStoryGraphics(dt){
    if(state.storyGraphicUntil&&performance.now()>=state.storyGraphicUntil)hideStoryCard();
    if(state.phase!=='first'&&state.phase!=='second')return;if(state.celebration||state.special||state.replay||state.replayIntro||state.replayOutro)return;
    state.storyGraphicTimer-=dt;if(state.storyGraphicTimer>0)return;
    const idx=(state.storyGraphicIndex++%5),a=state.teamStats.belros,b=state.teamStats.zafran;
    if(idx===0){const p=playerOfPeriod(null),ps=state.playerStats[p.id];showStoryCard('REPO SPORTS · MATCH LEADER',p.name,`${ps.goals} goals · ${ps.interceptions} interceptions · ${ps.completed} completed passes`,entityById(p.id)?.team||'',p,4.5)}
    else if(idx===1){const total=Math.max(.001,a.possession+b.possession),pa=Math.round(a.possession/total*100),team=pa>=50?'belros':'zafran';showStoryCard('LIVE MATCH TREND','POSSESSION',`${teamMeta[team].name} ${team==='belros'?pa:100-pa}% · ${teamMeta[other(team)].name} ${team==='belros'?100-pa:pa}%`,team,null,4.2)}
    else if(idx===2){const team=a.interceptions>=b.interceptions?'belros':'zafran',n=state.teamStats[team].interceptions;showStoryCard('REPO SPORTS · DEFENSIVE READ',teamMeta[team].name,`${n} interceptions so far`,team,null,4.1)}
    else if(idx===3){const team=a.shots>=b.shots?'belros':'zafran',st=state.teamStats[team];showStoryCard('ATTACKING PRESSURE',teamMeta[team].name,`${st.shots} shots · ${st.onTarget} on target`,team,null,4.1)}
    else {const team=a.completed>=b.completed?'belros':'zafran',st=state.teamStats[team];showStoryCard('PASSING RHYTHM',teamMeta[team].name,`${st.completed}/${st.passes||0} passes completed`,team,null,4.1)}
    state.storyGraphicTimer=48+(state.visualRand?.()||Math.random())*34;
  }
  function replaySnapshot(){
    const hold=state.carrier?ballHoldPoint(state.carrier):null;return {t:performance.now(),matchTime:state.matchTime,entities:state.entities.map(e=>({id:e.player.id,x:e.x,y:e.y,dir:e.dir||1,animState:e.animState||'MOVING'})),ref:{x:state.ref.x,y:state.ref.y,dir:state.ref.dir||1},ball:{x:hold?.x??state.ball.x,y:hold?.y??state.ball.y,visible:state.ball.visible!==false,flight:!!state.ball.flight},camera:{x:state.camera.x,y:state.camera.y,zoom:state.camera.zoom}};
  }
  function captureReplayFrame(dt){
    if(state.phase!=='first'&&state.phase!=='second')return;if(state.replay||state.celebration||state.special)return;
    state.replayCaptureAccum+=dt;if(state.replayCaptureAccum<.04)return;state.replayCaptureAccum=0;state.replayBuffer.push(replaySnapshot());
    if(state.replayBuffer.length>140)state.replayBuffer.splice(0,state.replayBuffer.length-140);
  }
  function beginReplay(label='MATCH REPLAY',frames=null,opts={}){
    if(state.replay||state.replayIntro||state.replayOutro)return false;frames=(frames||state.replayBuffer).slice(-(opts.frames||46));if(frames.length<10)return false;
    const payload={frames,elapsed:0,duration:opts.duration||2.85,label,slow:opts.slow||.66,onDone:opts.onDone||null};
    const introDuration=opts.introDuration==null?.50:opts.introDuration;
    if(introDuration>0){
      state.replayIntro={elapsed:0,duration:introDuration,payload};
      const sponsor=$('wcgReplaySponsor');if(sponsor){sponsor.classList.add('is-visible');sponsor.setAttribute('aria-hidden','false')}
      hideStoryCard();setBroadcastState('REPLAY');
      return true;
    }
    startReplayNow(payload);return true;
  }
  function finishReplay(){
    const r=state.replay;if(!r)return;
    state.replay=null;
    const bug=$('wcgReplayBug');if(bug){bug.classList.remove('is-visible');bug.setAttribute('aria-hidden','true')}
    // Bookend every replay with the same Repo Sports Quidditch sting used on entry.
    // The simulation remains paused until this short outro finishes.
    state.replayOutro={elapsed:0,duration:.48,onDone:r.onDone||null};
    const sponsor=$('wcgReplaySponsor');
    if(sponsor){
      sponsor.classList.remove('is-visible');
      void sponsor.offsetWidth;
      sponsor.classList.add('is-visible');
      sponsor.setAttribute('aria-hidden','false');
    }
    hideStoryCard();setBroadcastState('REPLAY');
  }
  function updateReplay(dt){if(!state.replay)return;state.replay.elapsed+=dt;if(state.replay.elapsed>=state.replay.duration)finishReplay()}
  function currentReplayFrame(){
    const r=state.replay;if(!r?.frames?.length)return null;const u=clamp(r.elapsed/Math.max(.01,r.duration),0,1),slowU=Math.pow(u,.88),pos=slowU*(r.frames.length-1),i0=Math.floor(pos),i1=Math.min(r.frames.length-1,i0+1),mix=pos-i0;return interpolateReplayFrame(r.frames[i0],r.frames[i1],mix);
  }
  function showPresentation(key,kicker,title,body='',footer='',mode=''){
    const wrap=$('wcgPresentation');if(!wrap)return;if(state.presentationKey===key)return;state.presentationKey=key;
    const brand=wrap.querySelector('.wcg-presentation-brand span');if(brand)brand.textContent=state.careerMode?'VELMORA MANAGER · LIVE QUIDDITCH':'REPO SPORTS LIVE';
    $('wcgPresentationKicker').textContent=careerBroadcastLabel(kicker||'');$('wcgPresentationTitle').textContent=title||'';$('wcgPresentationBody').innerHTML=body||'';$('wcgPresentationFooter').textContent=careerBroadcastLabel(footer||'');
    $('wcgPresentationPanel').className='wcg-presentation-panel'+(mode?` is-${mode}`:'');wrap.classList.add('is-open');wrap.setAttribute('aria-hidden','false');
    if(state.phase==='intro')requestAnimationFrame(positionPredictionDesk);
  }
  function hidePresentation(){const wrap=$('wcgPresentation');if(wrap){wrap.classList.remove('is-open');wrap.setAttribute('aria-hidden','true')}state.presentationKey=''}
  function playerSpriteHeight(e,standing=false){
    const base=standing?PLAYER_STAND_HEIGHT:PLAYER_RIDE_HEIGHT;
    if(!state.careerMode)return base*(PLAYER_SCALE[e?.player?.id]||1);
    const image=state.assets[e?.player?.id+(standing?'Standing':'Riding')];
    const maxHeight=standing?90:82,maxWidth=standing?124:154;
    return image?Math.min(maxHeight,maxWidth/(image.width/image.height)):maxHeight;
  }
  function setPlayerAnim(e,name,duration=.35,priority=null,meta={}){
    if(!e||!e.player)return false;
    const pr=priority==null?(ANIM_PRIORITY[name]??2):priority,now=simNow();
    if((e.animUntil||0)>now && (e.animPriority||0)>pr)return false;
    e.animState=name;e.animPriority=pr;e.animUntil=now+Math.max(.05,duration)*1000;e.animElapsed=0;e.animMeta=meta||{};return true;
  }
  const REACTION_STATE_BY_ANIM=Object.freeze({
    CELEBRATING:'celebrating',ENCOURAGING:'encouraging',ARGUING:'arguing',RECOVERING:'recovering',
    KEEPER_CELEBRATING:'keeperCelebrating',KEEPER_FRUSTRATED:'keeperFrustrated',
    REACTING_TO_SAVE:'reactingToSave',REACTING_TO_MISS:'reactingToMiss',REACTING_TO_GOAL:'reactingToGoal',
    DISAPPOINTED:'disappointed',FOUL_REACTION:'frustrated',RETURNING_TO_POSITION:'returningToPosition',MICRO_REACTION:'playing'
  });
  function visualRandom(){return state.visualRand?.()||Math.random()}
  function chooseReaction(category,pool){
    if(!pool?.length)return null;
    const recent=state.reactionHistory?.[category]||[];
    const fresh=pool.filter(x=>!recent.includes(x));
    const use=fresh.length?fresh:pool;
    const choice=use[Math.floor(visualRandom()*use.length)]||use[0];
    state.reactionHistory||(state.reactionHistory={});state.reactionHistory[category]=[...recent,choice].slice(-2);
    return choice;
  }
  function enterReaction(e,reactionState,animState,duration=.8,meta={},priority=null){
    if(!e?.player)return false;
    const ok=setPlayerAnim(e,animState,duration,priority??ANIM_PRIORITY[animState]??5,{...meta,reactionState});
    if(!ok)return false;
    e.reactionState=reactionState;e.reactionUntil=simNow()+duration*1000;e.reactionMeta={...meta};e.reactionSerial=(state.reactionSerial=(state.reactionSerial||0)+1);
    if(meta.faceX!=null){e.facing=meta.faceX>=e.x?1:-1;e.dir=-e.facing}
    if(REACTION_DEBUG)console.log('[REACTION]',e.player.name,reactionState,meta.type||animState,`${Math.round(duration*1000)}ms`);
    return true;
  }
  function reactKeeperSave(keeper,shooter){
    if(!keeper)return;
    const type=personalityReaction(keeper,'keeperSave',['fistRaise','pointDefenders','secureBall','smallBounce']);
    enterReaction(keeper,'keeperCelebrating','KEEPER_CELEBRATING',.8+visualRandom()*.75,{type,faceX:shooter?.x});
    const mate=teamEntities(keeper.team).filter(e=>e!==keeper).sort((a,b)=>dist2(a,keeper)-dist2(b,keeper))[0];
    if(mate&&visualRandom()<.68){mate.tx=safeX(lerp(mate.x,keeper.x,.32));mate.ty=safeY(lerp(mate.y,keeper.y,.32));enterReaction(mate,'encouraging','ENCOURAGING',.55+visualRandom()*.65,{type:'acknowledgeKeeper',faceX:keeper.x},ANIM_PRIORITY.ENCOURAGING)}
  }
  function reactToMiss(shooter){
    if(!shooter)return;
    const type=personalityReaction(shooter,'miss',['headShake','lookAtHoop','dropShoulders','smallSpin','lookUp']);
    enterReaction(shooter,'reactingToMiss','REACTING_TO_MISS',.55+visualRandom()*.75,{type,faceX:shooter.team==='belros'?.91:.09});
    const mate=teamEntities(shooter.team).filter(e=>e!==shooter).sort((a,b)=>dist2(a,shooter)-dist2(b,shooter))[0];
    if(mate&&visualRandom()<.46)enterReaction(mate,'encouraging','ENCOURAGING',.45+visualRandom()*.55,{type:'encourageShooter',faceX:shooter.x},ANIM_PRIORITY.ENCOURAGING);
    const defender=teamEntities(other(shooter.team)).slice().sort((a,b)=>dist2(a,shooter)-dist2(b,shooter))[0];
    if(defender&&visualRandom()<.24)enterReaction(defender,'reactingToMiss','REACTING_TO_MISS',.35+visualRandom()*.45,{type:'relief',faceX:shooter.x},ANIM_PRIORITY.REACTING_TO_MISS);
  }
  function reactToInterception(winner,loser){
    if(!winner)return;
    enterReaction(winner,'reactingToGoal','REACTING_TO_GOAL',.38+visualRandom()*.35,{type:personalityReaction(winner,'interceptWin',['quickNod','turnUpfield','smallPump']),faceX:winner.team==='belros'?.86:.14},ANIM_PRIORITY.REACTING_TO_GOAL);
    if(loser){loser.intent='recover';loser.tx=safeX(lerp(loser.x,winner.x,.20));loser.ty=safeY(lerp(loser.y,winner.y,.20));enterReaction(loser,'recovering','RETURNING_TO_POSITION',.48+visualRandom()*.35,{type:'turnAndChase',faceX:winner.x},ANIM_PRIORITY.RETURNING_TO_POSITION)}
  }
  function updateReactionExpiry(e){
    if(!e?.player)return;const now=simNow();
    if(e.reactionState&&e.reactionState!=='playing'&&(e.reactionUntil||0)<=now){
      e.reactionState='returningToPosition';e.reactionMeta={};e.reactionUntil=now+280;
      if((e.animUntil||0)<=now)setPlayerAnim(e,'RETURNING_TO_POSITION',.28,ANIM_PRIORITY.RETURNING_TO_POSITION,{});
    }else if(e.reactionState==='returningToPosition'&&(e.reactionUntil||0)<=now)e.reactionState='playing';
  }
  function normaliseAngle(a){while(a>Math.PI)a-=Math.PI*2;while(a<-Math.PI)a+=Math.PI*2;return a}
  function updateLocomotionAnim(e,dt,prevVx,prevVy){
    if(!e?.player)return;const now=simNow();e.animElapsed=(e.animElapsed||0)+dt;
    if((e.animUntil||0)>now)return;
    e.animPriority=0;e.animMeta={};
    const speed=Math.hypot(e.vx,e.vy),prevSpeed=Math.hypot(prevVx||0,prevVy||0),accel=(speed-prevSpeed)/Math.max(.016,dt);
    const heading=speed>.008?Math.atan2(e.vy,e.vx):(e.motionHeading||0),prevHeading=prevSpeed>.008?Math.atan2(prevVy,prevVx):(e.motionHeading||heading),turnDelta=normaliseAngle(heading-prevHeading),turn=Math.abs(turnDelta);
    e.motionHeading=heading;e.motionAccel=accel;e.turnMagnitude=turn;e.turnDelta=turnDelta;
    let next='MOVING';
    if(state.phase==='halftime')next='HALFTIME';
    else if(state.phase==='fulltime')next='FULLTIME';
    else if(speed<.018)next='IDLE';
    else if(turn>.50&&speed>.060)next='TURNING';
    else if(accel>.075)next='ACCELERATING';
    else if(accel<-.075)next='DECELERATING';
    else next=e.intent==='recover'?'RECOVERING':'MOVING';
    // Locomotion-state hysteresis prevents ACCELERATING/MOVING/TURNING from
    // flickering frame-to-frame and making a static pixel sprite look like it vibrates.
    const current=e.animState||'IDLE',major=next==='HALFTIME'||next==='FULLTIME';
    if(next!==current){
      const held=now-(e.locomotionChangedAt||0),minHold=major?0:(current==='TURNING'||next==='TURNING'?145:115);
      if(held>=minHold){e.animState=next;e.locomotionChangedAt=now;e.animElapsed=0}
    }else if(!e.locomotionChangedAt)e.locomotionChangedAt=now;
  }

  function actionPose(e,standing=false){
    const st=e?.animState||'IDLE',t=(e?.animElapsed||0),phase=(e?.animMeta?.phase||0);let rot=0,sx=1,sy=1,ox=0,oy=0,bob=0;
    if(standing){
      bob=0;sy=1;
      const c=state.celebration;if(c&&e?.team===c.team){
        // Test 41: celebration presentation uses the standing/floor pose from
        // the very start of the celebration, not the old aerial riding pose.
        const id=e?.player?.id||'',isScorer=e===c.scorer,moving=clamp((e?.celebrationMotion||0)*8,0,1),beat=Math.abs(Math.sin(t*(isScorer?4.8:3.8)+(e?.flowPhase||0)));
        oy=-(isScorer?2.2:1.1)*beat*(1-moving*.55);sx=1+(isScorer?.040:.025)*beat;sy=1+(isScorer?.026:.016)*beat;
        rot=Math.sin(t*(moving?5.2:3.0)+(e?.flowPhase||0))*(isScorer?.050:.030)+(e?.facing||1)*moving*.025;
      }
      return {rot,sx,sy,ox,oy,bob}
    }
    if(st==='ACCELERATING'){rot+=(e?.facing||1)*-.035;ox=(e?.facing||1)*2.0;sy=.995}
    else if(st==='DECELERATING'){rot+=(e?.facing||1)*.025;ox=(e?.facing||1)*-1.0}
    else if(st==='TURNING'){rot+=clamp((e?.turnDelta||0)*.16,-.095,.095);oy=-.35}
    else if(st==='RECEIVING'){oy=-2.2;sx=1.025;sy=.985;rot+=(e?.facing||1)*-.035}
    else if(st==='PASSING'){const q=Math.sin(clamp(t/.34,0,1)*Math.PI);rot+=(e?.facing||1)*-.12*q;ox=(e?.facing||1)*3*q;sy=1-.025*q}
    else if(st==='SHOOTING'){const q=Math.sin(clamp(t/.55,0,1)*Math.PI);rot+=(e?.facing||1)*-.17*q;ox=(e?.facing||1)*4*q;oy=-2*q;sx=1+.035*q;sy=1-.025*q}
    else if(st==='INTERCEPTING'){const q=Math.sin(clamp(t/.48,0,1)*Math.PI);rot+=(e?.facing||1)*-.10*q;ox=(e?.facing||1)*3*q;oy=-2.4*q;sx=1+.035*q}
    else if(st==='SAVING'){const q=Math.sin(clamp(t/.62,0,1)*Math.PI),style=e?.animMeta?.saveStyle||'centre';rot+=(e?.facing||1)*(style==='high'?-.22:style==='low'?-.13:-.18)*q;ox=(e?.facing||1)*(style==='close'?3.2:4.5)*q;oy=(style==='high'?-5.2:style==='low'?.6:-3)*q;sx=1+(style==='close'?.055:.09)*q;sy=1-.035*q}
    else if(st==='RECOVERING'){rot=0;oy=-.15}
    else if(st==='CELEBRATING'&&state.celebration&&!state.celebration.grounded){const cp=aerialCelebrationPose(e,t);if(cp){rot+=cp.rot||0;sx*=cp.sx||1;sy*=cp.sy||1;ox+=cp.ox||0;oy+=cp.oy||0}}
    else if(st==='CELEBRATING'){const id=e?.player?.id||'',pulse=Math.abs(Math.sin(t*(id==='nimbler'?9.5:id==='jud'?5.2:7.5)));if(id==='jud'){oy=-2.1-pulse*1.4;rot+=Math.sin(t*4.2)*.035;sx=1+pulse*.018}else if(id==='nimbler'){oy=-4.5-pulse*6.5;rot+=Math.sin(t*10.2)*.13;sx=1+pulse*.055}else if(id==='zizi'){oy=-3.2-pulse*3.5;rot+=Math.sin(t*9.3)*.15;sx=1+pulse*.035}else if(id==='rafi'){oy=-2.4-pulse*2.0;rot+=Math.sin(t*5.4)*.04;sx=1+pulse*.022}else if(id==='saffi'){oy=-3.2-pulse*3.2;rot+=Math.sin(t*7.2)*.085;sx=1+pulse*.034}else{oy=-3.4-pulse*3.8;rot+=Math.sin(t*7.6)*.075;sx=1+pulse*.038}sy=1+pulse*.022}
    else if(st==='KEEPER_CELEBRATING'){const q=Math.abs(Math.sin(t*7));oy=-2.8*q;rot-=(e?.facing||1)*.055*q;sx=1+.035*q}
    else if(st==='KEEPER_FRUSTRATED'){oy=2.2;rot+=(e?.facing||1)*.045;sy=.975}
    else if(st==='REACTING_TO_SAVE'){const q=Math.abs(Math.sin(t*5));oy=1.5+1.3*q;rot+=(e?.facing||1)*.055;sy=.97}
    else if(st==='REACTING_TO_MISS'){const kind=e?.animMeta?.type||'';const q=Math.sin(t*6);oy=kind==='relief'?-1.1*Math.abs(q):1.6;rot+=(e?.facing||1)*(kind==='smallSpin'?.16*q:.045*q);sy=kind==='dropShoulders'?.96:.985}
    else if(st==='REACTING_TO_GOAL'){const q=Math.abs(Math.sin(t*8));oy=-1.6*q;rot-=(e?.facing||1)*.04*q}
    else if(st==='ENCOURAGING'){const q=Math.abs(Math.sin(t*6));oy=-1.2*q;rot-=(e?.facing||1)*.03*q;sx=1+.018*q}
    else if(st==='ARGUING'){rot+=(e?.facing||1)*.045*Math.sin(t*8);ox=(e?.facing||1)*1.2*Math.abs(Math.sin(t*5))}
    else if(st==='RETURNING_TO_POSITION'){rot=0;oy=-.2}
    else if(st==='MICRO_REACTION'){rot+=(e?.facing||1)*.018*Math.sin(t*5);oy=-.6*Math.abs(Math.sin(t*4))}
    else if(st==='DISAPPOINTED'){oy=2.5;rot+=(e?.facing||1)*.055;sy=.975}
    else if(st==='FOUL_REACTION'){rot+=Math.sin(t*6)*.035;oy=1.5}
    else if(st==='VAR_REACTION'){bob=0;rot=Math.sin(t*1.8)*.012}
    else if(st==='FULLTIME'){bob=0}
    return personalityPoseFlavour(e,{rot,sx,sy,ox,oy,bob},t,standing);
  }
  function recordEvent(type,data={},weight=1){if(type==='goal'&&state.management)state.management.goals.push({type,data:{...data},time:state.matchTime});state.events.push({type,data,weight,time:state.matchTime,half:state.half,score:{...state.score}});if(state.events.length>80)state.events.shift()}
  function impactFor(p){const s=state.playerStats[p.id]||{};return (s.goals||0)*5+(s.assists||0)*2.6+(s.tacklesWon||0)*1.35+(s.interceptions||0)*2.25+(s.saves||0)*2.1+(s.completed||0)*.08+(s.rebounds||0)*.65-(s.fouls||0)*.75-(s.yellowCards||0)*.45-(s.redCards||0)*1.8}
  function playerOfPeriod(half=null){return allPlayers.filter(p=>!state.management||state.management.players[p.id]?.seconds>0).map(p=>({p,score:impactFor(p)})).sort((a,b)=>b.score-a.score || a.p.name.localeCompare(b.p.name))[0]?.p||allPlayers[0]}
  function eventDescription(ev){if(!ev)return 'A tense tactical half with neither side producing one single defining moment.';const d=ev.data||{};if(ev.type==='goal')return `${d.player} finishes for ${teamMeta[d.team]?.name||d.team}.`;if(ev.type==='save')return `${d.player} produces a major save under pressure.`;if(ev.type==='post')return `${d.player} rattles the ring and starts a scramble.`;if(ev.type==='intercept')return `${d.player} reads the lane and wins possession.`;if(ev.type==='var')return `VAR interrupts the match after a major incident.`;if(ev.type==='foul')return `${d.player} is penalised for a late challenge.`;if(ev.type==='card')return `${d.player} is shown ${d.card==='RED'?'a red card':d.card==='SECOND_YELLOW'?'a second yellow and is sent off':'a yellow card'}.`;return d.text||'A major passage of play swings the momentum.'}
  function bestEvent(half=null){const pool=state.events.filter(e=>half==null||e.half===half);return pool.sort((a,b)=>b.weight-a.weight || b.time-a.time)[0]||null}
  function scoreLine(){return `${teamMeta.belros.name} ${state.score.belros}–${state.score.zafran} ${teamMeta.zafran.name}`}
  function flagMarkup(team,cls='wcg-broadcast-flag'){return `<img class="${cls}" src="${teamMeta[team].flag}" alt="${teamMeta[team].name} flag">`}
  function matchupMarkup(withScore=false){return `<div class="wcg-flag-matchup"><div>${flagMarkup('belros')}<b>${teamMeta.belros.name}</b>${withScore?`<strong>${state.score.belros}</strong>`:''}</div><span>${withScore?'HALF TIME':'VS'}</span><div>${withScore?`<strong>${state.score.zafran}</strong>`:''}<b>${teamMeta.zafran.name}</b>${flagMarkup('zafran')}</div></div>`}
  function introSpriteStyle(p,team){const face=standingDirectionForPlayer(p,team),scale=PLAYER_SCALE[p.id]||1;return `--wcg-intro-face:${face};--wcg-intro-scale:${scale}`}
  function lineupMarkup(team){return `<div class="wcg-lineup-side is-${team}"><h3>${flagMarkup(team,'wcg-lineup-flag')}${teamMeta[team].name}</h3><div class="wcg-lineup-players">${roster[team].map(p=>`<article class="is-${p.id}"><img src="${p.standing}" alt="${p.name}" style="${introSpriteStyle(p,team)}"><b>${p.name}</b><span>${p.role.toUpperCase()}</span></article>`).join('')}</div></div>`}
  function profileStrength(p){const a=entityById(p.id)?.attributes||{};const labels=p.role==='defender'?[['POSITIONING',a.positioning],['INTERCEPTION',a.interception],['ANTICIPATION',a.anticipation]]:p.role==='attacker'?[['SHOOTING',a.shooting],['ACCELERATION',a.accel],['ANTICIPATION',a.anticipation]]:[['PASSING',a.passing],['POSITIONING',a.positioning],['COMPOSURE',a.composure]];return labels.sort((x,y)=>(y[1]||0)-(x[1]||0))[0]?.[0]||p.role.toUpperCase()}
  function updatePrematchPresentation(){
    const remaining=Math.max(0,INTRO_SECONDS-state.introElapsed),elapsed=INTRO_SECONDS-remaining,skip=$('wcgSkipBroadcast');
    if(skip)skip.hidden=state.syncMode;
    if(!state.careerMode)updatePredictionUi();
    const homePlayers=roster.belros.map(p=>p.name).join(' · '),awayPlayers=roster.zafran.map(p=>p.name).join(' · '),stage=String(state.fixture?.stage||'WATCH MATCH').toUpperCase();
    if(state.careerMode){
      if(elapsed<5.0){
        setBroadcastState('INTRO');
        showPresentation('career-ident','VELMORA MANAGER','LIVE QUIDDITCH',`<div class="wcg-career-ident"><strong>${fixtureVenue()}</strong><span>${stage}</span></div><div class="wcg-v2-format-strip"><span>4:30 MATCH</span><span>3 vs 3</span><span>LIVE ENGINE</span><span>CAREER FIXTURE</span></div>`,'WATCH MATCH · LIVE CAREER ENGINE','ident');
      }else if(elapsed<11.0){
        setBroadcastState('PRE_MATCH');
        showPresentation('career-stadium','LIVE FROM',fixtureVenue(),`${matchupMarkup(false)}<div class="wcg-arena-details"><p class="wcg-arena-copy">${teamMeta.belros.name} face ${teamMeta.zafran.name} in ${stage.toLowerCase()}.</p></div>`,'CALDRIAN CAMPIONATO POPOLARE · TORRE PICCOLA','arena');
      }else if(elapsed<20.0){
        showPresentation('career-lineups','STARTING SIX','TEAM SHEETS',`<div class="wcg-lineups">${lineupMarkup('belros')}${lineupMarkup('zafran')}</div>`,'ACTUAL CAREER STARTERS · PLAYER ATTRIBUTES LIVE','lineups');
      }else if(elapsed<26.5){
        const ht=tacticalDescriptor('belros'),at=tacticalDescriptor('zafran');
        showPresentation('career-tactics','TACTICAL READ','MATCH APPROACH',`<div class="wcg-career-tactics"><article><small>${teamMeta.belros.name}</small><b>${ht}</b></article><span>VS</span><article><small>${teamMeta.zafran.name}</small><b>${at}</b></article></div>`,'FORM · FITNESS · MORALE · TACTICS ACTIVE','stats');
      }else{
        const n=Math.max(1,Math.ceil(remaining));
        setBroadcastState('KICKOFF_COUNTDOWN');
        showPresentation(`career-ready-${n}`,'KICKOFF IN',String(n),`<div class="wcg-count-copy">${teamMeta.belros.name} · ${homePlayers}<br>${teamMeta.zafran.name} · ${awayPlayers}</div>`,'LIVE RESULT WRITES BACK TO CAREER','countdown');
      }
      return;
    }
    if(elapsed<4.5){
      setBroadcastState('INTRO');
      showPresentation('v2-ident','REPO SPORTS','QUIDDITCH LIVE',`<div class="wcg-ident-lockup"><img src="assets/repo-sports-logo.png" alt="Repo Sports"><span>STANDARD 4:30 ROTATION</span></div><div class="wcg-v2-format-strip"><span>4:30 MATCH</span><span>3 vs 3</span><span>NO HALF-TIME</span><span>LIVE LEAGUE</span></div>`,'NEXT MATCH · PREDICTIONS OPEN','ident')
    }else if(elapsed<10.5){
      setBroadcastState('PRE_MATCH');
      showPresentation('v2-stadium','LIVE FROM',fixtureVenue(),`${matchupMarkup(false)}<div class="wcg-arena-details"><p class="wcg-arena-copy">${teamMeta.belros.name} face ${teamMeta.zafran.name} in the next standard Repo Sports rotation.</p></div>`,'REPO SPORTS · ARENA FEED','arena')
    }else if(elapsed<18.5){
      showPresentation('v2-lineups','STARTING SIX','TEAM SHEETS',`<div class="wcg-lineups">${lineupMarkup('belros')}${lineupMarkup('zafran')}</div>`,'ONE ATTACKER · ONE DEFENDER · ONE SUPPORT PER SIDE','lineups')
    }else if(elapsed<26.5){
      showPresentation('v2-predict','REPO SPORTS PREDICT','MAKE YOUR PICK',`<div class="wcg-v2-predict-card"><b>${teamMeta.belros.name}</b><span>VS</span><b>${teamMeta.zafran.name}</b><p>Choose either side before kickoff. Correct prediction pays <strong>1,000 GP</strong>.</p><div class="wcg-v2-even-note">NO FAVOURITES · MATCH ENGINE REMAINS 50/50</div></div>`,'CHANGE YOUR PICK UNTIL THE WHISTLE','stats')
    }else{
      const n=Math.max(1,Math.ceil(remaining));
      setBroadcastState('KICKOFF_COUNTDOWN');
      showPresentation(`v2-ready-${n}`,'KICKOFF IN',String(n),`<div class="wcg-count-copy">${teamMeta.belros.name} · ${homePlayers}<br>${teamMeta.zafran.name} · ${awayPlayers}</div>`,'4:30 · NO HALF-TIME','countdown')
    }
  }
  function predictionTeamName(team){return team==='belros'?teamMeta.belros.name:teamMeta.zafran.name}
  function playPredictionSound(){
    try{
      const AudioCtx=window.AudioContext||window.webkitAudioContext;if(!AudioCtx)return;
      const ctx=playPredictionSound.ctx||(playPredictionSound.ctx=new AudioCtx());
      if(ctx.state==='suspended')void ctx.resume();
      const now=ctx.currentTime,g=ctx.createGain(),o1=ctx.createOscillator(),o2=ctx.createOscillator();
      o1.type='triangle';o2.type='sine';o1.frequency.setValueAtTime(465,now);o1.frequency.exponentialRampToValueAtTime(690,now+.12);
      o2.frequency.setValueAtTime(930,now+.035);o2.frequency.exponentialRampToValueAtTime(760,now+.16);
      g.gain.setValueAtTime(.0001,now);g.gain.exponentialRampToValueAtTime(.075,now+.018);g.gain.exponentialRampToValueAtTime(.0001,now+.19);
      o1.connect(g);o2.connect(g);g.connect(ctx.destination);o1.start(now);o2.start(now+.035);o1.stop(now+.20);o2.stop(now+.20);
    }catch(_){}
  }
  function applyPredictionCounts(data){
    const row=Array.isArray(data)?data[0]:data||{};
    const h=Math.max(0,Number(row.home_votes??row.belros??0)||0),a=Math.max(0,Number(row.away_votes??row.zafran??0)||0),total=Math.max(0,Number(row.total_votes??(h+a))||0);
    state.prediction.counts={belros:h,zafran:a,total};
    updatePredictionUi();
  }
  async function refreshPredictionCounts(force=false){
    if(state.prediction.polling||!state.prediction.matchKey)return;
    const now=performance.now();if(!force&&now-(state.prediction.lastPoll||0)<1200)return;
    state.prediction.lastPoll=now;state.prediction.polling=true;
    try{
      const bridge=window.parent&&window.parent!==window?window.parent.RepoSportsV2TestBridge:window.RepoSportsV2TestBridge;
      if(bridge?.getPredictionCounts)applyPredictionCounts(await bridge.getPredictionCounts(state.prediction.matchKey));
    }catch(_){}
    finally{state.prediction.polling=false}
  }
  async function submitPredictionVote(team){
    try{
      const bridge=window.parent&&window.parent!==window?window.parent.RepoSportsV2TestBridge:window.RepoSportsV2TestBridge;
      if(bridge?.submitPrediction)applyPredictionCounts(await bridge.submitPrediction(state.prediction.matchKey,team));
      else await refreshPredictionCounts(true);
    }catch(error){
      console.warn('[REPO SPORTS V2] Fan vote submit failed',error);
    }
  }
  function positionPredictionDesk(){
    const box=$('wcgPredictionBar');
    const panel=$('wcgPresentationPanel');
    const presentation=$('wcgPresentation');
    const shell=document.querySelector('#wcWorldCupBroadcast .wcg-shell');
    if(!box||!panel||!presentation||!shell)return;

    const shellRect=shell.getBoundingClientRect();
    const panelRect=panel.getBoundingClientRect();
    const scaleY=shellRect.height/Math.max(1,shell.offsetHeight||shellRect.height);

    // User-requested layout: prediction desk sits directly beneath the
    // large central build-up/presentation box, never over the top scorebar.
    const panelBottom=(panelRect.bottom-shellRect.top)/Math.max(.001,scaleY);
    const gap=10;
    const wantedTop=panelBottom+gap;

    // Keep it inside the broadcast canvas if a particularly tall card appears.
    const shellH=shell.offsetHeight||941;
    const boxH=box.offsetHeight||64;
    const maxTop=shellH-boxH-72;
    const finalTop=Math.min(wantedTop,maxTop);

    // Important is intentional: older V2 CSS revisions used top:...!important.
    // This guarantees the runtime placement actually wins the cascade.
    box.style.setProperty('top',`${Math.round(finalTop)}px`,'important');
    box.style.setProperty('bottom','auto','important');
    box.style.setProperty('left','50%','important');
    box.style.setProperty('transform','translateX(-50%)','important');
  }
  function updatePredictionUi(){
    const box=$('wcgPredictionBar'),home=$('wcgPredictHome'),away=$('wcgPredictAway'),status=$('wcgPredictionStatus'),fan=$('wcgFanVote');
    if(!box||!home||!away||!status)return;
    const open=state.phase==='intro'&&!state.prediction.locked,c=state.prediction.counts||{belros:0,zafran:0,total:0};
    const hp=c.total?Math.round(c.belros/c.total*100):0,ap=c.total?100-hp:0;
    box.classList.toggle('is-open',open);box.setAttribute('aria-hidden',open?'false':'true');
    const hb=home.querySelector('b'),ab=away.querySelector('b'),hs=$('wcgPredictHomeShare'),as=$('wcgPredictAwayShare');
    if(hb)hb.textContent=teamMeta.belros.name;if(ab)ab.textContent=teamMeta.zafran.name;
    if(hs)hs.textContent=`${hp}% · ${c.belros}`;if(as)as.textContent=`${ap}% · ${c.zafran}`;
    if(fan){const span=fan.querySelector('span');if(span)span.textContent=c.total?`${teamMeta.belros.name} ${hp}% · ${teamMeta.zafran.name} ${ap}% · ${c.total} VOTE${c.total===1?'':'S'}`:'WAITING FOR PICKS'}
    home.classList.toggle('is-selected',state.prediction.pick==='belros');away.classList.toggle('is-selected',state.prediction.pick==='zafran');
    home.disabled=!open;away.disabled=!open;
    status.textContent=state.prediction.pick?(open?`YOUR PICK: ${predictionTeamName(state.prediction.pick)} · CHANGE UNTIL KICKOFF`:`LOCKED: ${predictionTeamName(state.prediction.pick)}`):(open?'PICK ANY TIME BEFORE KICKOFF':'NO PREDICTION PLACED');
    if(open)requestAnimationFrame(positionPredictionDesk);
  }
  function setPredictionPick(team){
    if(state.phase!=='intro'||state.prediction.locked||!['belros','zafran'].includes(team))return;
    state.prediction.pick=team;playPredictionSound();updatePredictionUi();void submitPredictionVote(team);
  }
  async function resolvePredictionReward(){
    if(state.prediction.resolved)return;
    state.prediction.resolved=true;
    const data=state.fulltimeData;
    if(!state.prediction.pick){state.prediction.rewardMessage='NO PREDICTION PLACED';return}
    if(!data||data.draw||!data.winner){state.prediction.rewardMessage=`PICK: ${predictionTeamName(state.prediction.pick)} · MATCH DRAWN · NO PAYOUT`;return}
    state.prediction.correct=state.prediction.pick===data.winner;
    if(!state.prediction.correct){state.prediction.rewardMessage=`PICK: ${predictionTeamName(state.prediction.pick)} · INCORRECT`;return}
    state.prediction.rewardMessage=`CORRECT · ${predictionTeamName(state.prediction.pick)} · CLAIMING 1,000 GP…`;
    state.prediction.rewardAttempted=true;
    try{
      const bridge=window.parent&&window.parent!==window?window.parent.RepoSportsV2TestBridge:window.RepoSportsV2TestBridge;
      if(!bridge?.awardPrediction)throw new Error('V2 reward bridge unavailable');
      const result=await bridge.awardPrediction(state.prediction.matchKey||`v2-${state.startedAt}`);
      state.prediction.rewardPaid=!!result?.awarded;
      state.prediction.rewardMessage=result?.awarded===false
        ?'CORRECT · 1,000 GP ALREADY CLAIMED FOR THIS MATCH'
        :`CORRECT · +1,000 GP · NEW BALANCE ${Number(result?.new_gp||0).toLocaleString('en-GB')} GP`;
    }catch(error){
      state.prediction.rewardPaid=false;
      state.prediction.rewardMessage=`CORRECT · +1,000 GP PENDING · ${String(error?.message||error)}`;
    }
  }

  function refStandingBallPoint(){const image=state.assets.refStanding,h=REF_STAND_HEIGHT,w=image?h*(image.width/image.height):h*.56;return {x:state.ref.x+(w*.34)/W,y:state.ref.y+(h*.08)/H}}
  function beginPrematchMount(){
    if(state.kickoffMount)return;
    const starts={},ready={};
    state.entities.forEach((e,i)=>{starts[e.player.id]={x:e.x,y:e.y};const lane=(i%3)-1,side=e.team==='belros'?-1:1;ready[e.player.id]={x:e.x+(-side)*.012,y:.615+lane*.026};e.animState='ACCELERATING';e.animPriority=ANIM_PRIORITY.ACCELERATING;e.animElapsed=0;e.intent='kickoff-ready'});
    state.kickoffMount={elapsed:0,starts,ready};
  }
  function updatePrematchMountedEntities(dt){
    const m=state.kickoffMount;if(!m)return;m.elapsed+=dt;const tossing=!!state.kickoffToss;
    for(const e of state.entities){
      e.animElapsed=(e.animElapsed||0)+dt;
      const r=m.ready[e.player.id]||{x:e.x,y:e.y};
      let tx=r.x,ty=r.y;
      if(tossing){
        const k=state.kickoffToss,t=clamp(k.elapsed/Math.max(.01,k.duration),0,1),side=e.team==='belros'?-1:1,slot=teamEntities(e.team).indexOf(e)-1;
        const anticipateX=lerp(r.x,state.ball.x+side*(.050+Math.abs(slot)*.016),.36+.50*t);
        const anticipateY=lerp(r.y,state.ball.y+.045+slot*.048,.30+.58*t);
        tx=safeX(anticipateX);ty=safeY(anticipateY);e.intent='contest-toss';
      }
      const dx=tx-e.x,dy=ty-e.y,d=Math.hypot(dx,dy)||1,max=tossing?.255:.145,desired=Math.min(max,.035+d*2.1),rvx=dx/d*desired,rvy=dy/d*desired,k=1-Math.exp(-dt*(tossing?5.8:4.6));
      e.vx=lerp(e.vx,rvx,k);e.vy=lerp(e.vy,rvy,k);e.x+=e.vx*dt;e.y+=e.vy*dt;
      if(Math.abs(e.vx)>.009){e.facing=e.vx>0?1:-1;e.dir=-e.facing}
    }
    state.ref.vx=state.ref.vy=0;
  }
  function updateKickoffToss(dt){
    const remain=INTRO_SECONDS-state.introElapsed;
    if(remain<=2.30)beginPrematchMount();
    if(remain>1.45){const h=refStandingBallPoint();state.ball.x=h.x;state.ball.y=h.y;state.ball.visible=true;state.ball.state='HELD';state.ball.owner='referee';return}
    if(!state.kickoffToss){
      const h=refStandingBallPoint();
      state.kickoffToss={elapsed:0,duration:1.42,sx:h.x,sy:h.y,tx:.5,ty:.525};
      // Test 43: user's start SFX fires at the exact frame William throws the
      // Quaffle into the air. Presentation-only; never runs during catch-up.
      audio.playKickoffRelease();
      showBanner('REFEREE RELEASES THE QUAFFLE','',1.1);
      for(const e of state.entities){e.animState='ACCELERATING';e.animElapsed=0;e.intent='contest-toss'}
    }
    const k=state.kickoffToss;k.elapsed=Math.min(k.duration,k.elapsed+dt);const t=clamp(k.elapsed/k.duration,0,1),q=ease(t);const px=state.ball.x,py=state.ball.y;state.ball.x=lerp(k.sx,k.tx,q);state.ball.y=lerp(k.sy,k.ty,q)-Math.sin(Math.PI*t)*.022;state.ball.visible=true;state.ball.state='IN_FLIGHT';state.ball.owner=null;updateBallTelemetry(px,py,Math.max(dt,.016));
  }
  function snapCareerKickoffFormation(){
    if(!state.careerMode)return;
    const ys=[.455,.590,.715],homeX=[.365,.325,.385],awayX=[.635,.675,.615];
    teamEntities('belros').forEach((e,i)=>{e.x=homeX[i]??.36;e.y=ys[i]??.59;e.tx=e.x;e.ty=e.y;e.vx=e.vy=0;e.intent='kickoff-ready'});
    teamEntities('zafran').forEach((e,i)=>{e.x=awayX[i]??.64;e.y=ys[i]??.59;e.tx=e.x;e.ty=e.y;e.vx=e.vy=0;e.intent='kickoff-ready'});
    state.ref.x=.5;state.ref.y=.555;state.ref.tx=.5;state.ref.ty=.555;state.ref.vx=state.ref.vy=0;
    state.ball.x=.5;state.ball.y=.535;state.ball.visible=true;state.ball.state='HELD';state.ball.owner='referee';state.ball.flight=null;
    state.kickoffMount=null;state.kickoffToss=null;
  }
  function completePrematch(){if(state.phase!=='intro')return;state.introElapsed=INTRO_SECONDS;state.prediction.locked=true;updatePredictionUi();hidePresentation();const skip=$('wcgSkipBroadcast');if(skip)skip.hidden=true;if(state.careerMode)snapCareerKickoffFormation();setBroadcastSequence('firstHalf',{frozen:false});state.firstKickoff=state.simRand()<.5?'belros':'zafran';beginKickoff(state.firstKickoff,false)}
  function halftimeSummary(){const a=state.teamStats.belros,b=state.teamStats.zafran;const tactical=halftimeTacticalLine();if(state.score.belros!==state.score.zafran){const lead=state.score.belros>state.score.zafran?teamMeta.belros.name:teamMeta.zafran.name;return `${lead} take the advantage into the interval. The first half produced ${a.shots+b.shots} shots and ${a.interceptions+b.interceptions} interceptions. ${tactical}`}return `Level at the interval. ${a.shots+b.shots} shots and ${a.interceptions+b.interceptions} interceptions tell the story of a closely fought first half. ${tactical}`}
  function halftimeStatsMarkup(){const a=state.teamStats.belros,b=state.teamStats.zafran,tot=Math.max(.001,a.possession+b.possession),pa=Math.round(a.possession/tot*100),pb=100-pa;return `<div class="wcg-broadcast-stats"><div><b>${a.shots}</b><span>SHOTS</span><b>${b.shots}</b></div><div><b>${pa}%</b><span>POSSESSION</span><b>${pb}%</b></div><div><b>${a.onTarget}</b><span>ON TARGET</span><b>${b.onTarget}</b></div><div><b>${a.interceptions}</b><span>INTERCEPTIONS</span><b>${b.interceptions}</b></div><div><b>${a.completed}</b><span>SUCCESSFUL PASSES</span><b>${b.completed}</b></div><div><b>${a.fouls}</b><span>FOULS</span><b>${b.fouls}</b></div></div>`}
  function halftimeWaitingSlide(index){
    const p=playerOfPeriod(1),ps=state.playerStats[p.id],ev=bestEvent(1);
    if(index===0)return `<div class="wcg-half-slide"><small>REPO SPORTS · FIRST-HALF DATA</small><h4>MATCH STATISTICS</h4>${halftimeStatsMarkup()}</div>`;
    if(index===1)return `<div class="wcg-half-slide wcg-half-player-slide"><small>REPO SPORTS · PLAYER OF THE HALF</small><h4>${p.name}</h4><div class="wcg-half-player-card"><img src="${p.standing}" alt="${p.name}"><p><b>${ps.goals}</b> GOALS · <b>${ps.interceptions}</b> INTERCEPTIONS · <b>${ps.completed}</b> COMPLETED PASSES</p></div></div>`;
    if(index===2)return `<div class="wcg-half-slide"><small>REPO SPORTS · MOMENT OF THE HALF</small><h4>${ev?ev.type.toUpperCase():'TACTICAL BATTLE'}</h4><p>${eventDescription(ev)}</p></div>`;
    return `<div class="wcg-half-slide"><small>BARRY BRAMBLE · HALF-TIME VIEW</small><h4>${state.score.belros===state.score.zafran?'ALL SQUARE':'ADVANTAGE AT THE BREAK'}</h4><p>${halftimeSummary()}</p></div>`;
  }
  function updateHalftimeWaitingPanel(){
    const el=$('wcgHalfRotation');if(!el)return;
    const waitingElapsed=Math.max(0,state.halftimeElapsed-28),idx=Math.floor(waitingElapsed/8)%4;
    if(state.halftimeWaitSlide===idx)return;state.halftimeWaitSlide=idx;
    el.classList.remove('is-visible');
    setTimeout(()=>{if(!state.open||state.phase!=='halftime'||!state.halftimeReady)return;el.innerHTML=halftimeWaitingSlide(idx);requestAnimationFrame(()=>el.classList.add('is-visible'))},180);
  }
  function openHalftimeWaitingScreen(){
    state.halftimeReady=true;state.halftimeWaitSlide=-1;hidePresentation();setBroadcastState('HALFTIME_READY');setBroadcastSequence('secondHalfIntro',{frozen:true});
    $('wcgHalfTitle').textContent='SECOND HALF READY';$('wcgHalfBelros').textContent=state.score.belros;$('wcgHalfZafran').textContent=state.score.zafran;$('wcgHalfShots').textContent=`SHOTS ${state.teamStats.belros.shots}-${state.teamStats.zafran.shots}`;
    $('wcgContinueHalf').hidden=!isHost();$('wcgHalfCopy').textContent=isHost()?'Repo Sports is live at half-time · CatAsthma controls when the second half begins.':'Repo Sports half-time coverage · waiting for host CatAsthma to continue.';
    $('wcgHalftime').classList.add('is-open');updateHalftimeWaitingPanel();
  }
  function updateHalftimePresentation(dt){
    state.halftimeElapsed+=dt;tickBroadcastSequence(dt);const t=state.halftimeElapsed,card=2.15;
    if(state.halftimeReady){updateHalftimeWaitingPanel();return}
    if(t<card){setBroadcastState('HALFTIME');setBroadcastSequence('halftime',{frozen:true,reset:false});showPresentation('v36-half-score','REPO SPORTS · HALF-TIME',scoreLine(),`${matchupMarkup(true)}<div class="wcg-half-big">9 MINUTES COMPLETE</div>`,fixtureVenue(),'halftime')}
    else if(t<card*2){setBroadcastState('HALFTIME_STATS');setBroadcastSequence('halftimeStats',{frozen:true,reset:false});showPresentation('v36-half-stats','FIRST-HALF DATA','MATCH STATISTICS',`${matchupMarkup(true)}${halftimeStatsMarkup()}`,'ACTUAL TRACKED MATCH DATA','stats')}
    else if(t<card*3){const p=playerOfPeriod(1),s=state.playerStats[p.id];setBroadcastSequence('halftimeSpotlight',{frozen:true,reset:false});showPresentation('v36-half-player','FIRST-HALF STANDOUT',p.name,`<div class="wcg-player-half"><img src="${p.standing}" alt="${p.name}"><p>${s.goals} GOALS · ${s.shots} SHOTS · ${s.interceptions} INTERCEPTIONS · ${s.saves} SAVES</p></div>`,'RETROSPECTIVE MATCH IMPACT ONLY','player')}
    else if(t<card*4){setBroadcastSequence('secondHalfIntro',{frozen:true,reset:false});showPresentation('v36-half-summary','BARRY BRAMBLE · HALF-TIME',state.score.belros===state.score.zafran?'NOTHING BETWEEN THEM':'ADVANTAGE AT THE BREAK',`<p class="wcg-moment-copy">${halftimeSummary()}</p>`,'SECOND HALF NEXT','summary')}
    else openHalftimeWaitingScreen();
  }
  function updateSecondHalfCountdown(dt){tickBroadcastSequence(dt);state.secondCountdown=Math.max(0,state.secondCountdown-dt);const n=Math.max(1,Math.ceil(state.secondCountdown));showPresentation(`second-${n}`,'SECOND HALF',String(n),'<div class="wcg-count-copy">PLAYERS SET · REFEREE READY</div>','PLAY!','countdown');if(state.secondCountdown<=0){hidePresentation();setBroadcastSequence('secondHalf',{frozen:false});beginKickoff(other(state.firstKickoff),true)}}
  function fulltimeMomentMarkup(){const ev=bestEvent(null);return `<p class="wcg-moment-copy">${eventDescription(ev)}</p>`}
  function updateFulltimePresentation(dt){
    state.fulltimeElapsed+=dt;
    const data=state.fulltimeData;if(!data)return;
    hidePresentation();setBroadcastState('POST_MATCH');setBroadcastSequence('complete',{frozen:true,reset:false});
    $('wcgFulltime')?.classList.add('is-open');populateFulltimePanel(data);
    const remain=Math.max(0,Math.ceil(POST_MATCH_SECONDS-state.fulltimeElapsed)),count=$('wcgNextMatchCountdown');
    if(count)count.innerHTML=state.careerMode?'MATCH REPORT READY · CONTINUE WHEN READY':(remain>0?`NEXT LIVE MATCH IN <b>${remain}</b>S`:'FINALISING LIVE RESULT…');
    if(!state.careerMode&&state.fulltimeElapsed>=POST_MATCH_SECONDS){
      const shouldAnnounce=!state.rotationQueued||state.fulltimeElapsed>=state.rotationAnnounceAt;
      if(shouldAnnounce&&state.syncMode&&window.parent&&window.parent!==window){
        state.rotationQueued=true;
        state.rotationAnnounceAt=state.fulltimeElapsed+2.0;

        const so=state.fulltimeData?.so||null;
        const careerPlayers=['belros','zafran'].flatMap(side=>
          roster[side].map(p=>({
            player_id:p.id,
            player_name:p.name,
            owner_name:V2_PLAYER_OWNERS[p.id]||'',
            side,
            goals:Math.max(0,Number(state.playerStats?.[p.id]?.goals)||0)
          }))
        );

        // Re-announce every ~2s until the shared match serial changes.
        // Server-side match_serial/recorded-match guards make duplicates safe.
        window.parent.postMessage({type:'repo-sports-v2-rotation-complete',matchSerial:state.liveSerial,result:{
          home_team:teamMeta.belros.name,
          away_team:teamMeta.zafran.name,
          regulation:{belros:state.score.belros,zafran:state.score.zafran},
          penalties:so?{belros:Number(so.score?.belros)||0,zafran:Number(so.score?.zafran)||0}:null,
          winner:state.fulltimeData?.winner||null,
          fixture:activeFixture?.id||null,
          players:careerPlayers
        }},'*');
      }
    }
  }

  function scorerSummary(team){
    const teamRoster=matchdayTeamPlayers(team,true);
    const scorers=teamRoster
      .map(p=>({name:p.name,goals:Number(state.playerStats?.[p.id]?.goals)||0}))
      .filter(s=>s.goals>0);
    if(!scorers.length)return 'SCORERS: —';
    return 'SCORERS: '+scorers.map(s=>`${s.name}${s.goals>1?' x'+s.goals:''}`).join(' · ');
  }
  function updateScorerUi(){
    const a=$('wcgScorersBelros'),b=$('wcgScorersZafran');
    if(a)a.textContent=scorerSummary('belros');
    if(b)b.textContent=scorerSummary('zafran');
  }
  function startReplayNow(payload){
    state.replay={frames:payload.frames,elapsed:0,duration:payload.duration,label:payload.label,slow:payload.slow,onDone:payload.onDone||null};
    state.lastReplayAt=state.matchTime;
    const bug=$('wcgReplayBug');if(bug){bug.classList.add('is-visible');bug.setAttribute('aria-hidden','false')}
    $('wcgReplayLabel').textContent=payload.label;
    hideStoryCard();setBroadcastState('REPLAY');
  }
  function hideReplaySponsor(){const el=$('wcgReplaySponsor');if(el){el.classList.remove('is-visible');el.setAttribute('aria-hidden','true')}}
  function updateReplayIntro(dt){
    const intro=state.replayIntro;if(!intro)return;
    intro.elapsed+=dt;
    if(intro.elapsed>=intro.duration){
      hideReplaySponsor();
      const payload=intro.payload;state.replayIntro=null;startReplayNow(payload);
    }
  }
  function updateReplayOutro(dt){
    const outro=state.replayOutro;if(!outro)return;
    outro.elapsed+=dt;
    if(outro.elapsed>=outro.duration){
      hideReplaySponsor();
      state.replayOutro=null;
      if(typeof outro.onDone==='function')outro.onDone();
      setBroadcastState(state.phase==='fulltime'?'FULL_TIME':state.phase==='shootout'?'PENALTIES':'LIVE');
    }
  }
  function interpolateReplayFrame(a,b,t){
    if(!a)return b||null;if(!b||t<=0)return a;if(t>=1)return b;
    const lerpNum=(x,y)=>Number.isFinite(x)&&Number.isFinite(y)?x+(y-x)*t:(Number.isFinite(x)?x:y);
    const lerpBool=(x,y)=>t<0.5?x:y;
    return {
      entities:(a.entities||[]).map((ea,i)=>{const eb=(b.entities||[])[i]||ea;return {...ea,x:lerpNum(ea.x,eb.x),y:lerpNum(ea.y,eb.y),dir:lerpBool(ea.dir,eb.dir),animState:t<0.5?ea.animState:eb.animState};}),
      ref:{...a.ref,x:lerpNum(a.ref?.x,b.ref?.x),y:lerpNum(a.ref?.y,b.ref?.y),dir:lerpBool(a.ref?.dir,b.ref?.dir)},
      ball:a.ball&&b.ball?{...a.ball,x:lerpNum(a.ball.x,b.ball.x),y:lerpNum(a.ball.y,b.ball.y),visible:lerpBool(a.ball.visible,b.ball.visible),flight:lerpBool(a.ball.flight,b.ball.flight)}:(a.ball||b.ball),
      camera:a.camera&&b.camera?{...a.camera,x:lerpNum(a.camera.x,b.camera.x),y:lerpNum(a.camera.y,b.camera.y),zoom:lerpNum(a.camera.zoom,b.camera.zoom)}:(a.camera||b.camera)
    };
  }
  function updateScoreUi(){
    if($('wcgManage'))$('wcgManage').hidden=!state.careerMode||['fulltime','shootout','closed','secondcountdown'].includes(state.phase);
    $('wcgScoreBelros').textContent=state.score.belros;$('wcgScoreZafran').textContent=state.score.zafran;
    let t=state.matchTime,phase='1ST HALF';
    if(state.phase==='intro'){ const remain=Math.max(0,Math.ceil(INTRO_SECONDS-state.introElapsed));$('wcgClock').textContent=state.careerMode?`00:${String(remain).padStart(2,'0')}`:`-${remain}`;phase='PRE-MATCH'; }
    else { if(state.celebration)phase='GOAL CELEBRATION';else if(state.phase==='second')phase='2ND HALF';else if(state.phase==='halftime')phase='HALF TIME';else if(state.phase==='secondcountdown')phase='2ND HALF SOON';else if(state.phase==='shootout'){const so=state.shootout;phase=so?`PENS ${so.score.belros}-${so.score.zafran}`:'PENALTIES';}else if(state.phase==='fulltime')phase='FULL TIME'; const m=Math.floor(t/60),s=Math.floor(t%60);$('wcgClock').textContent=state.phase==='shootout'?'PENS':`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; }
    $('wcgPhase').textContent=phase;
    updateScorerUi();
    const a=state.teamStats.belros,b=state.teamStats.zafran;
    const possTotal=Math.max(.001,a.possession+b.possession),pa=Math.round(a.possession/possTotal*100),pb=100-pa;
    $('wcgMiniStats').innerHTML=`<div class="wcg-stat-row"><span>${a.shots}</span><b>SHOTS</b><span>${b.shots}</span></div><div class="wcg-stat-row"><span>${a.onTarget}</span><b>ON TARGET</b><span>${b.onTarget}</span></div><div class="wcg-stat-row"><span>${pa}%</span><b>POSSESSION</b><span>${pb}%</span></div><div class="wcg-stat-row"><span>${a.completed}/${a.passes}</span><b>PASSES</b><span>${b.completed}/${b.passes}</span></div><div class="wcg-stat-row"><span>${a.interceptions}</span><b>INTERCEPTS</b><span>${b.interceptions}</span></div><div class="wcg-stat-row"><span>${a.tacklesWon}</span><b>TACKLES WON</b><span>${b.tacklesWon}</span></div><div class="wcg-stat-row"><span>${a.fouls}</span><b>FOULS</b><span>${b.fouls}</span></div><div class="wcg-stat-row"><span>${a.var}</span><b>VAR</b><span>${b.var}</span></div>`;
  }

  // Shared playing traits modify execution, never the stored career ratings.
  function v48TraitContext(e,extra={}){
    return {minute:(state.matchTime||0)/MATCH_SECONDS*90,carrying:state.carrier===e,
      supporting:state.possession===e.team&&state.carrier!==e,returnRun:state.lastPasser===e&&state.carrier!==e,
      speed:Math.hypot(e.vx||0,e.vy||0),progress:state.zone||.15,...extra};
  }
  function v48LiveAttributes(e,extra={},fresh=false){
    if(!fresh&&!e.player.playingTraits?.length)return {...(e.attributes||{})};
    const base=e.baseAttributes||e.attributes||{},api=window.VelmoraTraits;
    if(!state.careerMode||!api)return {...base};
    const a=api.attributes(base,e.player.playingTraits,v48TraitContext(e,extra));
    const aura=api.aura(teamEntities(e.team).map(x=>x.player),state.score[e.team]<state.score[other(e.team)]);
    a.composure=clamp((a.composure||.8)+aura,0,.995);return a;
  }
  function v48RefreshTraits(e){
    if(!state.careerMode||!window.VelmoraTraits)return;
    e.attributes=v48LiveAttributes(e,{},true);const a=e.attributes;
    e.maxSpeed=.198*(.34+a.speed*.78);e.accel=.70*(.86+a.accel*.20);e.turnRate=5.2*(.85+a.turn*.22);
  }
  function createEntities(){
    state.entities=[];
    const groundY=fixtureGroundY();
    // Career player `avatar` artwork is a portrait/torso asset, not a full standing body.
    // Keep career players airborne from frame one so they can never be planted through the floor.
    const spawnY=state.careerMode ? .635 : groundY;
    const belrosX=[.27,.34,.41], zafranX=[.73,.66,.59];
    const roleProfile=role=>{
      const base={personality:'tactical',speed:.93,accel:.93,turn:.93,passing:.90,catching:.90,shooting:.88,interception:.88,awareness:.91,positioning:.91,reaction:.91,anticipation:.91,decision:.91,composure:.91,aggression:.82,stamina:.94,recovery:.92};
      if(role==='attacker')Object.assign(base,{personality:'aggressive',shooting:.88,interception:.78,positioning:.87,aggression:.90});
      else if(role==='defender')Object.assign(base,{personality:'tactical',shooting:.88,interception:.97,awareness:.97,positioning:.98,anticipation:.97,composure:.95});
      else Object.assign(base,{personality:'creative',passing:.97,catching:.94,shooting:.88,interception:.84,awareness:.94,decision:.96});
      return base;
    };
    const profiles={};
    for(const team of ['belros','zafran'])for(const p of matchdaySquads[team])profiles[p.id]={...roleProfile(p.role),...(p.engineAttributes||{})};
    // Team-wide scripting remains disabled. Career player quality now influences
    // execution through their individual attributes.
    state.fairness={belros:1,zafran:1,target:1,teamWinBias:0,rubberBand:false,scriptedGoals:false,principle:'CAREER ATTRIBUTES · NO SCRIPTED WINNER',spatialSideBias:false};
    const makeEntity=(p,team,x,i)=>{
      const a={...profiles[p.id]};
      return {player:p,team,x,y:spawnY,vx:0,vy:0,ax:0,ay:0,tx:x,ty:spawnY,
        facing:teamMeta[team].attack,dir:-teamMeta[team].attack,bank:0,celebrate:0,intent:'shape',mark:null,currentThreat:null,
        baseAttributes:{...a},personality:a.personality,presentationPersonality:getPlayerPersonality(p),personalityHistory:{},attributes:a,form:0,fatigue:0,mistakes:0,recentSuccess:0,
        // Career pace sets movement speed; roles receive no hidden speed bonus.
        maxSpeed:state.careerMode?.198*(.34+a.speed*.78):.198*(.88+a.speed*.16),
        accel:.70*(0.86+a.accel*.20),turnRate:5.2*(0.85+a.turn*.22),
        wander:(i-1)*.37,decisionNoise:(state.simRand?.()||.5)-.5,decisionClock:.05+(state.simRand?.()||.5)*.12,
        recoveryTarget:null,lastIntent:'shape',lastDecisionAt:0,edgeStall:0,hoverTime:0,flowSign:i%2?1:-1,flowPhase:(state.simRand?.()||.5)*Math.PI*2,desiredTx:x,desiredTy:groundY,tacticalRole:'SHAPE',responsibility:'SHAPE',supportTarget:null,pressing:false,smoothedTurn:0,locomotionChangedAt:0,packCrowdTime:0,packDisperseTime:0,packDisperseTarget:null,
        reactionState:'idle',reactionUntil:0,reactionMeta:{},microReactionClock:2+visualRandom()*5,animState:'IDLE',animPriority:0,animUntil:0,animElapsed:0,animMeta:{},idlePhase:(state.simRand?.()||.5)*Math.PI*2,motionHeading:teamMeta[team].attack>0?0:Math.PI,motionAccel:0,turnMagnitude:0,faceCandidate:0,faceCandidateTime:0};
    };
    state.makeMatchEntity=makeEntity;
    roster.belros.forEach((p,i)=>state.entities.push(makeEntity(p,'belros',belrosX[i],i)));
    roster.zafran.forEach((p,i)=>state.entities.push(makeEntity(p,'zafran',zafranX[i],i)));
    state.ref={x:.5,y:groundY,vx:0,vy:0,tx:.5,ty:groundY,dir:1,maxSpeed:.175,accel:.58,edgeStall:0,reactionState:'idle',reactionUntil:0,reactionMeta:{}};
    // Tactical V2 asks for team/player lookups constantly. Cache the six fixed
    // entities once per fixture instead of allocating new filter arrays hundreds
    // of times per second; this also removes the small periodic GC hitch.
    state.entitiesByTeam={belros:state.entities.filter(e=>e.team==='belros'),zafran:state.entities.filter(e=>e.team==='zafran')};
    state.entityByIdMap=new Map(state.entities.map(e=>[e.player.id,e]));
    initTeamTactics();
    state.entities.forEach(v48RefreshTraits);
  }
  function entityById(id){return state.entityByIdMap?.get(id)||state.entities.find(e=>e.player.id===id)}
  function teamEntities(team){return state.entitiesByTeam?.[team]||state.entities.filter(e=>e.team===team)}
  function rolePlayer(team,role){return teamEntities(team).find(e=>e.player.role===role)||teamEntities(team)[0]}

  function initTeamTactics(){
    state.teamTactics={};
    for(const team of ['belros','zafran']){
      const supplied=team==='belros'?state.fixture?.homeTactics:state.fixture?.awayTactics;
      const profile=supplied?careerTacticalProfile(supplied):clubTacticalProfile(teamMeta[team].name);
      state.teamTactics[team]={team,identity:profile.id,profile,state:'BUILDUP',previousState:'BUILDUP',risk:.50,pressing:.50,width:profile.width,depth:1,tempo:1,lastChange:simNow(),responsibilities:{},memory:{lanePressure:{},hotPlayer:null,lastTurnoverAt:0},debugReason:'opening shape',identityAnnounced:false,lastTacticalCommentAt:-99,adjustment:{id:'BASE',width:1,runner:1,support:1,press:1,passBias:0,label:'same approach'}};
    }
  }
  function tacticalScoreContext(team){
    const diff=(state.score?.[team]||0)-(state.score?.[other(team)]||0),remaining=Math.max(0,MATCH_SECONDS-(state.matchTime||0)),late=remaining<162,veryLate=remaining<68;
    let urgency=.50;if(diff<0)urgency+=late?.16:.06;if(diff<0&&veryLate)urgency+=.12;if(diff>0)urgency-=late?.13:.04;if(diff>1&&late)urgency-=.07;if(diff===0&&veryLate)urgency+=.06;
    return {diff,remaining,late,veryLate,urgency:clamp(urgency,.25,.78)};
  }
  function tacticalStateFor(team){
    if(state.phase==='halftime'||state.phase==='secondcountdown')return 'HALFTIME';
    if(state.celebration)return state.celebration.team===team?'GOAL_CELEBRATION':'RESTART';
    if(state.special?.type==='penalty')return 'RESTART';
    if(!state.possession)return 'RECOVERY';
    const owns=state.possession===team,recent=simNow()-(state.possessionChangedAt||0)<1650,zone=state.zone||.15;
    if(owns){if(recent&&zone<.72)return 'COUNTERATTACK';if(zone>.68)return 'FINAL_ATTACK';if(zone>.37)return 'ATTACK';return 'BUILDUP'}
    const carrier=state.carrier,nearest=carrier?Math.min(...teamEntities(team).map(e=>dist2(e,carrier))):1;
    if(recent)return 'RECOVERY';if(carrier&&nearest<.18)return 'PRESSING';return 'DEFENSIVE';
  }
  function assignTacticalResponsibilities(team){
    const tt=state.teamTactics?.[team];if(!tt)return;const players=teamEntities(team),carrier=state.carrier;tt.responsibilities={};
    if(state.possession===team&&carrier){
      tt.responsibilities[carrier.player.id]='BALL_CARRIER';carrier.tacticalRole='BALL_CARRIER';carrier.responsibility='BALL_CARRIER';
      const off=players.filter(e=>e!==carrier);
      // Goal opportunity must not be attached permanently to the ATTACKER label.
      // The seeded match RNG gives either off-ball teammate the same runner chance.
      const runner=off.length?off[Math.floor((state.simRand?.()||Math.random())*off.length)]:off[0];
      const support=off.find(e=>e!==runner)||off[0];
      if(runner){const profile=tt.profile||tacticalProfileForTeam(team);const role=(profile.id==='WIDE'||(profile.id==='PATIENT'&&tt.state==='BUILDUP'))?'WIDTH':'RUNNER';tt.responsibilities[runner.player.id]=role;runner.tacticalRole=role;runner.responsibility=role}
      if(support){const role='SUPPORT';tt.responsibilities[support.player.id]=role;support.tacticalRole=role;support.responsibility=role}
    }else if(carrier){
      const scored=players.map(e=>({e,score:dist2(e,carrier)-(.025*(e.attributes?.aggression||.7))+.018*(e.personality==='cautious'?1:0)})).sort((a,b)=>a.score-b.score);
      const presser=scored[0]?.e,rest=players.filter(e=>e!==presser),cover=rest.slice().sort((a,b)=>(b.attributes?.positioning||0)-(a.attributes?.positioning||0))[0],support=rest.find(e=>e!==cover)||rest[0];
      for(const [e,role] of [[presser,'BALL_PRESSER'],[support,'SUPPORT_COVER'],[cover,'COVER']])if(e){tt.responsibilities[e.player.id]=role;e.tacticalRole=role;e.responsibility=role;e.pressing=role==='BALL_PRESSER'}
    }else{
      const bx=state.ball.x,by=state.ball.y;const ordered=players.slice().sort((a,b)=>Math.hypot(a.x-bx,a.y-by)-Math.hypot(b.x-bx,b.y-by));
      const roles=['SECOND_BALL','SUPPORT_COVER','COVER'];ordered.forEach((e,i)=>{const role=roles[i]||'COVER';tt.responsibilities[e.player.id]=role;e.tacticalRole=role;e.responsibility=role});
    }
  }

  function maybeAnnounceTacticalIdentity(team){
    const tt=state.teamTactics?.[team];if(!tt||tt.identityAnnounced||state.headless||state.phase!=='first')return;
    const stagger=team==='belros'?7.5:18.5;if((state.matchTime||0)<stagger||state.broadcast?.speaking)return;
    tt.identityAnnounced=true;tt.lastTacticalCommentAt=state.matchTime||0;
    const p=tt.profile||tacticalProfileForTeam(team);
    say(`${teamMeta[team].name} ${p.comment}`,{priority:2,intensity:'calm',kind:'tactic'});
    showStoryCard('REPO SPORTS · TACTICAL READ',p.name,`${teamMeta[team].name} · ${p.short}`,team,null,3.7);
  }
  function tacticalStateComment(team,next,ctx){
    const tt=state.teamTactics?.[team];if(!tt||state.headless||state.broadcast?.speaking)return;
    const now=state.matchTime||0;if(now-(tt.lastTacticalCommentAt||-99)<16)return;
    const p=tt.profile||tacticalProfileForTeam(team);let line='';
    if(next==='PRESSING')line=p.id==='PRESS'?`${teamMeta[team].name} trigger that high press — the support line has squeezed right up.`:`${teamMeta[team].name} step up and squeeze the space.`;
    else if(next==='COUNTERATTACK')line=p.id==='COUNTER'?`${teamMeta[team].name} are into their preferred transition — support is breaking immediately.`:`${teamMeta[team].name} can break here.`;
    else if(next==='FINAL_ATTACK')line=p.id==='WIDE'?`${teamMeta[team].name} stretch the final third and try to pull a defender away from the hoops.`:p.id==='DIRECT'?`${teamMeta[team].name} go vertical now — much less interest in recycling this close to goal.`:`${teamMeta[team].name} push their support higher around the hoops.`;
    else if(next==='DEFENSIVE'&&ctx.late&&ctx.diff>0)line=`${teamMeta[team].name} settle back into their ${p.short} shape and protect the lead.`;
    if(line){tt.lastTacticalCommentAt=now;say(line,{priority:2,intensity:'calm',kind:'tactic'})}
  }
  function applyHalftimeTacticalAdjustments(){
    if(!state.teamTactics)return;
    for(const team of ['belros','zafran']){
      if(state.management&&team===state.management.team)continue;
      const tt=state.teamTactics[team],opp=other(team),diff=(state.score[team]||0)-(state.score[opp]||0),own=state.teamStats[team]||{},against=state.teamStats[opp]||{};
      let a={id:'BASE',width:1,runner:1,support:1,press:1,passBias:0,label:'same approach'};
      if(diff<0)a={id:'CHASE',width:1.035,runner:1.055,support:1.025,press:.96,passBias:-.008,label:'higher support'};
      else if(diff>0)a={id:'CONTROL',width:.985,runner:.965,support:.955,press:1.025,passBias:.008,label:'more controlled'};
      else if((own.shots||0)+1<(against.shots||0))a={id:'WIDTH',width:1.045,runner:1.025,support:1.035,press:1,passBias:0,label:'more width'};
      else if((own.turnovers||0)>(against.turnovers||0)+1)a={id:'SECURE',width:.98,runner:.98,support:.945,press:1.02,passBias:.010,label:'safer circulation'};
      tt.adjustment=a;
    }
  }
  function halftimeTacticalLine(){
    if(!state.teamTactics)return '';
    const parts=['belros','zafran'].map(team=>{const tt=state.teamTactics[team],a=tt?.adjustment;if(!a||a.id==='BASE')return `${teamMeta[team].name} keep their ${tt?.profile?.short||'original'} plan`;return `${teamMeta[team].name} switch to ${a.label}`;});
    return `${parts[0]}; ${parts[1]}.`;
  }

  function updateTeamTacticalDirector(dt,force=false){
    if(!state.teamTactics?.belros)initTeamTactics();state.tacticalPulse=(state.tacticalPulse||0)-dt;if(!force&&state.tacticalPulse>0)return;state.tacticalPulse=.58;
    for(const team of ['belros','zafran']){
      const tt=state.teamTactics[team],next=tacticalStateFor(team),ctx=tacticalScoreContext(team),mom=state.director?.momentum?.[team]||0;
      tt.risk=clamp(ctx.urgency+mom*.06,.28,.74); // decision risk only; never feeds execution probabilities
      const p=tt.profile||tacticalProfileForTeam(team),adj=tt.adjustment||tacticalAdjustmentForTeam(team);
      // Profile pressure is spatial/positional only; actual tackle/interception success formulas remain untouched.
      tt.pressing=clamp(.42+(next==='PRESSING'?.18:0)+(ctx.diff<0&&ctx.late?.10:0)+(state.management?.tactics[team]?.defensive==='Press'?.12:state.management?.tactics[team]?.defensive==='Drop Back'?-.1:0),.25,.84);
      tt.width=clamp(p.width*(adj.width||1),.84,1.22);tt.depth=1;tt.tempo=1;
      maybeAnnounceTacticalIdentity(team);
      if(next!==tt.state){
        tt.previousState=tt.state;tt.state=next;tt.lastChange=simNow();tt.debugReason=`${state.possession||'loose'} · zone ${Number(state.zone||0).toFixed(2)}`;recordEvent('tactic',{team,state:next},.65);
        if(next==='PRESSING')state.teamStats[team].presses++;if(next==='COUNTERATTACK')recordEvent('counterattack',{team},1.8);
        if((state.phase==='first'||state.phase==='second')&&commentaryRandom()<.22)tacticalStateComment(team,next,ctx);
      }
      for(const key of Object.keys(tt.memory.lanePressure||{}))tt.memory.lanePressure[key]*=.985;
      assignTacticalResponsibilities(team);
    }
  }

  function setNormalFormation(){
    if(!state.carrier)return;
    refreshMovementTargets(true);
  }
  function setPossession(team,carrier,zone=.15){const previous=state.possession,changed=previous!==team;state.possession=team;state.carrier=carrier;state.zone=zone;state.passesSinceShot=0;state.lastPasser=null;state.ball.visible=true;state.pendingPass=null;setBallPossession(carrier);if(changed){state.possessionChangedAt=simNow();if(previous&&state.teamStats[previous])state.teamStats[previous].turnovers++;if(team&&previous&&state.teamStats[team])state.teamStats[team].counterattacks++;flowPossessionChanged(team,previous);updateTeamTacticalDirector(0,true)}setNormalFormation()}

  // All riding sprites face left in their source art.  Keep a separate attack/facing
  // direction so the visual orientation never gets accidentally tied to movement.
  // The Quaffle is anchored to the forward hand rather than the sprite centre.
  const ballHandOffsets = {
    jud:[.235,.105], nimbler:[.255,.095], bramble:[.275,.105],
    zizi:[.245,.115], rafi:[.255,.115], saffi:[.255,.115]
  };
  function spriteMetrics(e,height=null){
    height=height||playerSpriteHeight(e,false);
    const image=state.assets[e.player.id+'Riding'];
    if(!image)return {w:height,h:height};
    return {w:height*(image.width/image.height),h:height};
  }
  function ballHoldPoint(e,height=null){
    height=height||playerSpriteHeight(e,false);
    const m=spriteMetrics(e,height);
    // Bespoke offsets remain for the original reference players; newer
    // sprites use a tighter generic carry point so the Quaffle visibly
    // overlaps the forward hand/upper-body area rather than floating clear.
    const off=ballHandOffsets[e.player.id]||[.16,.06];
    // Riding source art faces left when dir=+1, so visual forward is -dir.
    // Use the player's current rendered facing rather than the team's attack
    // direction; this keeps the ball in the correct hand when a carrier turns.
    const visualForward=-(e.dir||1);
    return {
      x:clamp(e.x+visualForward*(off[0]*m.w/W),.04,.96),
      y:clamp(e.y+off[1]*m.h/H,.08,.92)
    };
  }

  function syncHeldBallToCarrier(){
    if(!state.carrier||state.ball.flight)return;
    const hold=ballHoldPoint(state.carrier);
    const prevX=state.ball.x,prevY=state.ball.y;
    state.ball.x=hold.x;
    state.ball.y=hold.y;
    state.ball.owner=state.carrier.player?.id||null;
    state.ball.currentOwner=state.carrier;
    state.ball.state='HELD';
    state.ball.visible=true;
    state.ball.vx=state.carrier.vx||0;
    state.ball.vy=state.carrier.vy||0;
    state.ball.speed=Math.hypot(state.ball.vx,state.ball.vy);
    state.ball.direction=Math.atan2(state.ball.vy||0,state.ball.vx||1);
  }

  function ballStateForMeta(meta){
    if(!meta)return 'LOOSE';
    if(meta.kind==='pass')return 'PASSING';
    if(meta.kind==='shot')return meta.outcome==='goal'?'GOALBOUND':'SHOT';
    if(meta.kind==='rebound'||meta.kind==='loose')return 'LOOSE';
    if(meta.kind==='kickoff')return 'IN_FLIGHT';
    return 'IN_FLIGHT';
  }
  function updateBallTelemetry(prevX,prevY,dt){
    const vx=(state.ball.x-prevX)/Math.max(dt,.0001),vy=(state.ball.y-prevY)/Math.max(dt,.0001);
    state.ball.vx=vx;state.ball.vy=vy;state.ball.speed=Math.hypot(vx,vy);state.ball.direction=Math.atan2(vy,vx);
  }
  function setBallPossession(carrier){
    const prev=state.ball.owner||null;
    state.ball.previousOwner=prev;
    state.ball.owner=carrier?.player?.id||null;
    state.ball.currentOwner=carrier||null;
    state.ball.intendedReceiver=null;
    state.ball.state=carrier?'HELD':'LOOSE';
    state.ball.lastTouchedBy=carrier?.player?.id||state.ball.lastTouchedBy||null;
    if(carrier){const hold=ballHoldPoint(carrier);state.ball.x=hold.x;state.ball.y=hold.y;state.ball.vx=carrier.vx||0;state.ball.vy=carrier.vy||0;state.ball.speed=Math.hypot(state.ball.vx,state.ball.vy);state.ball.direction=Math.atan2(state.ball.vy||0,state.ball.vx||1);}
  }
  function nearestEntityToPoint(x,y,pred=null){
    const pool=state.entities.filter(e=>!pred||pred(e));
    return pool.slice().sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0]||null;
  }
  function startLooseBall(from,to,duration=.36,opts={}){
    const meta={kind:'loose',team:opts.team||null,fromEntity:opts.fromEntity||null,context:opts.context||'loose'};
    state.pendingPass=null;
    state.carrier=null;
    state.possession=null;
    startFlight(from,to,duration,opts.arc??.018,()=>{
      const candidates=state.entities.map(e=>{
        const d=Math.hypot(e.x-state.ball.x,e.y-state.ball.y),speed=Math.max(.045,Math.hypot(e.vx,e.vy)+(e.maxSpeed||.18)*.45);
        const reaction=executionSkill(e.attributes,'reaction'),control=executionSkill(e.attributes,'catching');
        const eta=d/speed-(reaction-.86)*.18-(control-.86)*.08+fairNoise();
        return {e,d,eta};
      }).sort((a,b)=>a.eta-b.eta);
      // Position remains the dominant factor. Small symmetric variance only matters
      // when arrival times are genuinely close, so higher-rated players never auto-win.
      const first=candidates[0],second=candidates[1];let winner=first?.e||null;
      if(first&&second&&Math.abs(first.eta-second.eta)<.075){
        const aScore=-first.eta+fairNoise(.045),bScore=-second.eta+fairNoise(.045);winner=aScore>=bScore?first.e:second.e;
      }
      if(winner){
        winner.intent='receive';winner.tx=safeX(state.ball.x);winner.ty=safeY(state.ball.y);
        setPlayerAnim(winner,'RECEIVING',.36,ANIM_PRIORITY.RECEIVING,{loose:true});
        recordEvent('loose',{player:winner.player.name,team:winner.team},1.6);
        eventLine('rebound',{pet:winner.player.name},winner.player,.05);
        setPossession(winner.team,winner,winner.team===(opts.team||winner.team)?clamp(state.zone,.12,.88):.14);
      }
    },meta);
    teamEntities('belros').concat(teamEntities('zafran')).forEach(e=>{
      const d=Math.hypot(e.x-to.x,e.y-to.y);
      if(d<.30){e.intent='recover';e.tx=safeX(to.x+(e.x-to.x)*.05);e.ty=safeY(to.y+(e.y-to.y)*.05);setPlayerAnim(e,'RECOVERING',.42,ANIM_PRIORITY.RECOVERING,{looseBall:true})}
    });
  }

  function startFlight(from,to,duration=.72,arc=.06,onDone=null,meta=null){
    state.ball.flight={sx:from.x,sy:from.y,tx:to.x,ty:to.y,elapsed:0,duration,arc,onDone,meta};state.ball.x=from.x;state.ball.y=from.y;state.ball.currentOwner=state.carrier||null;state.ball.previousOwner=state.ball.owner||null;state.ball.owner=null;state.ball.intendedReceiver=meta?.receiver?.player?.id||null;state.ball.state=ballStateForMeta(meta);state.ball.predictedDestination={x:to.x,y:to.y};state.carrier=null;
  }
  function updateFlight(dt){
    const f=state.ball.flight;if(!f)return;
    const prevX=state.ball.x,prevY=state.ball.y;
    f.elapsed+=dt;const t=clamp(f.elapsed/f.duration,0,1),e=ease(t);
    // Pass targets keep moving, so the ball leads the receiver rather than flying to a stale coordinate.
    if(f.meta?.kind==='kickoff'&&f.meta.receiver){f.tx=f.meta.receiver.x;f.ty=f.meta.receiver.y-.015}
    if(f.meta?.kind==='pass'&&f.meta.receiver){
      const lead=.10;f.tx=safeX(f.meta.receiver.x+f.meta.receiver.vx*lead);f.ty=safeY(f.meta.receiver.y+f.meta.receiver.vy*lead);
    }
    state.ball.predictedDestination={x:f.tx,y:f.ty};
    state.ball.x=lerp(f.sx,f.tx,e);state.ball.y=lerp(f.sy,f.ty,e)-Math.sin(Math.PI*t)*f.arc;
    updateBallTelemetry(prevX,prevY,dt);
    if(f.meta?.kind==='pass'){
      const m=f.meta, ball=state.ball;
      m.receiver.intent='receive';m.receiver.tx=safeX(ball.x+m.receiver.vx*.12);m.receiver.ty=safeY(ball.y+m.receiver.vy*.12);
      for(const d of m.defenders){
        const remaining=Math.max(.08,f.duration-f.elapsed),predictX=safeX(ball.x+(f.tx-ball.x)*Math.min(.55,remaining/f.duration)),predictY=safeY(ball.y+(f.ty-ball.y)*Math.min(.55,remaining/f.duration));
        d.intent=d===m.challenger?'intercept':'cover';
        if(d===m.challenger){d.tx=predictX;d.ty=predictY;}
      }
      for(const d of m.defenders){
        if(d===m.challenger||m.resolved)continue;
        const dd=Math.hypot(d.x-ball.x,d.y-ball.y);
        if(dd<.023 && state.simRand()<.28){
          m.resolved=true;state.ball.flight=null;audio.intercept();audio.crowdHit(.08);
          recordEvent('deflection',{player:d.player.name,team:d.team},2.2);
          setPlayerAnim(d,'INTERCEPTING',.34,ANIM_PRIORITY.INTERCEPTING,{deflection:true});
          const ox=safeX(ball.x+teamMeta[d.team].attack*(.06+state.simRand()*.04)), oy=safeY(ball.y+(state.simRand()-.5)*.10);
          startLooseBall({x:ball.x,y:ball.y},{x:ox,y:oy},.34,{team:d.team,fromEntity:d,context:'deflection'});
          return;
        }
      }
      const d=m.challenger;
      if(d&&!m.resolved){
        const dx=d.x-ball.x,dy=d.y-ball.y,dist=Math.hypot(dx,dy),speed=Math.hypot(d.vx,d.vy);
        const closing=(d.vx*(-dx)+d.vy*(-dy))/(Math.max(.001,speed)*Math.max(.001,dist));
        const ia=d.attributes||{},interceptExec=executionSkill(ia,'interception'),reactionExec=executionSkill(ia,'reaction'),challengeRadius=.024+.010*interceptExec,reactionGate=.095+.07*(1-reactionExec);
        if(dist<challengeRadius && speed>.035 && closing>.15 && f.elapsed>reactionGate && !m.challengeAttempted){
          m.challengeAttempted=true;
          const timing=clamp((challengeRadius-dist)/Math.max(.001,challengeRadius),0,1),angleQuality=clamp((closing-.15)/.85,0,1);
          const contestP=clamp(.46+timing*.24+angleQuality*.10+(interceptExec-.86)*.32+(reactionExec-.86)*.18+fairNoise(.07),.26,.84);
          if(state.simRand()<contestP){
            m.resolved=true;state.ball.flight=null;state.pendingPass=null;d.x=clamp(d.x,FLIGHT.hardX0,FLIGHT.hardX1);d.y=clamp(d.y,FLIGHT.hardY0,FLIGHT.hardY1);d.form=clamp((d.form||0)+.018,-.10,.10);m.from.form=clamp((m.from.form||0)-.008,-.10,.10);
            state.teamStats[d.team].interceptions++;state.playerStats[d.player.id].interceptions++;if(state.teamTactics?.[m.from.team]){const mem=state.teamTactics[m.from.team].memory.lanePressure,key=m.receiver?.player?.id||'unknown';mem[key]=(mem[key]||0)+1}recordEvent('intercept',{player:d.player.name,team:d.team,from:m.from.player.name},3.2);audio.intercept();audio.crowdHit(.10);
            showBanner(`INTERCEPTION · ${d.player.name}`,'',1.4);eventLine('intercept',{pet:d.player.name,from:m.from.player.name},d.player,.18);if(state.playerStats[d.player.id].interceptions===3||state.playerStats[d.player.id].interceptions===5)showStoryCard('REPO SPORTS · READING THE GAME',d.player.name,`${state.playerStats[d.player.id].interceptions} interceptions tonight`,d.team,d.player,3.8);setPlayerAnim(d,'INTERCEPTING',.52,ANIM_PRIORITY.INTERCEPTING,{won:true});reactToInterception(d,m.from);
            setPossession(d.team,d,.16);scheduleNext(.7,1.35);return;
          }
          // A well-positioned defender can still mistime the touch. The ball continues.
          d.intent='recover';d.tx=safeX(d.x+teamMeta[d.team].attack*.035);d.ty=safeY(d.y+(d.flowSign||1)*.045);
          setPlayerAnim(d,'RECOVERING',.48,ANIM_PRIORITY.RECOVERING,{missedInterception:true});
        }
      }
    }
    if(t>=1){state.ball.flight=null;const cb=f.onDone;if(cb)cb()}
  }

  function weightedPlayer(team,exclude=null){
    const pool=teamEntities(team).filter(e=>e!==exclude);return pool[Math.floor(state.simRand()*pool.length)]||teamEntities(team)[0];
  }
  function scheduleNext(min=1.0,max=1.9){state.actionTimer=min+state.simRand()*(max-min)}


  function initMatchFlowDirector(){
    state.matchFlow={
      currentPhase:FLOW_PHASES.RESTART,possessionTeam:state.possession||null,phaseStartTime:state.matchTime||0,phaseElapsed:0,
      phaseIntensity:.35,sequenceId:0,sequenceStartTime:state.matchTime||0,lastMajorEvent:'restart',lastSequenceType:'',transitionDirection:0,
      attackTarget:null,supportPlayers:[],template:null,tempo:'normal',recentSequences:[],possessionElapsed:0,actionIndex:0,
      quietUntil:0,lastMajorAt:-99,lastTurnoverAt:-99,lastSwitchAt:-99,lastAction:'restart',forcedPhaseUntil:0
    };
  }
  function flowRand(){return state.simRand?.()||Math.random()}
  function flowTempoScale(){const t=state.matchFlow?.tempo;return t==='fast'?.82:t==='slow'?1.22:1}
  function flowScheduleNext(min=.95,max=1.85){const k=flowTempoScale();scheduleNext(min*k,max*k)}
  function chooseFlowTemplate(preferCounter=false){
    if(!state.matchFlow)initMatchFlowDirector();
    const f=state.matchFlow,recent=f.recentSequences||[];
    let pool=FLOW_TEMPLATES.filter(t=>preferCounter?t.id==='counter-attack':t.id!=='counter-attack');
    const weighted=[];
    for(const t of pool){let w=t.weight;if(recent.includes(t.id))w*=.28;if(t.id==='quiet-spell'&&f.sequenceId<2)w*=1.35;for(let i=0;i<Math.max(1,Math.round(w*10));i++)weighted.push(t)}
    const chosen=weighted[Math.floor(flowRand()*weighted.length)]||pool[0];
    f.template=chosen;f.lastSequenceType=chosen.id;f.tempo=chosen.tempo;f.actionIndex=0;f.sequenceId++;f.sequenceStartTime=state.matchTime||0;
    f.recentSequences=[...recent,chosen.id].slice(-3);
    if(chosen.id==='quiet-spell')f.quietUntil=(state.matchTime||0)+(10+flowRand()*10);
    if(FLOW_DEBUG)console.log('[FLOW]',{sequence:f.sequenceId,possession:state.possession,phase:f.currentPhase,template:chosen.id,tempo:f.tempo});
    return chosen;
  }
  function setFlowPhase(phase,reason=''){
    if(!state.matchFlow)initMatchFlowDirector();const f=state.matchFlow;if(f.currentPhase===phase)return;
    f.currentPhase=phase;f.phaseStartTime=state.matchTime||0;f.phaseElapsed=0;f.actionIndex=0;
    f.phaseIntensity=phase===FLOW_PHASES.COUNTER?.9:phase===FLOW_PHASES.FINAL_THIRD?.78:phase===FLOW_PHASES.ATTACKING?.62:phase===FLOW_PHASES.CIRCULATION?.28:.4;
    if(FLOW_DEBUG)console.log('[FLOW]',`#${f.sequenceId}`,state.possession,phase,reason||'');
  }
  function noteFlowMajor(event){if(!state.matchFlow)initMatchFlowDirector();state.matchFlow.lastMajorEvent=event;state.matchFlow.lastMajorAt=state.matchTime||0;state.matchFlow.lastAction=event}
  function flowPossessionChanged(team,previous){
    if(!state.matchFlow)initMatchFlowDirector();const f=state.matchFlow;f.possessionTeam=team;f.possessionElapsed=0;f.lastTurnoverAt=state.matchTime||0;f.transitionDirection=teamMeta[team]?.attack||0;
    setFlowPhase(previous?FLOW_PHASES.TURNOVER:FLOW_PHASES.RESTART,'possession changed');chooseFlowTemplate(!!previous);
    if(previous){f.forcedPhaseUntil=(state.matchTime||0)+(.8+flowRand()*.8);}
  }
  function updateMatchFlowDirector(dt){
    if(!state.matchFlow)initMatchFlowDirector();const f=state.matchFlow;if(state.phase!=='first'&&state.phase!=='second')return;
    f.phaseElapsed+=dt;if(state.possession)f.possessionElapsed+=dt;
    if(state.celebration||state.replay||state.replayIntro||state.replayOutro){setFlowPhase(FLOW_PHASES.STOPPAGE,'cinematic');return}
    if(state.special){setFlowPhase(FLOW_PHASES.STOPPAGE,'special');return}
    if(!state.possession){setFlowPhase(FLOW_PHASES.SCRAMBLE,'loose ball');return}
    if(f.possessionTeam!==state.possession)flowPossessionChanged(state.possession,f.possessionTeam);
    const now=state.matchTime||0,zone=state.zone||.15,recentTurn=now-(f.lastTurnoverAt||-99)<2.4;
    if(recentTurn&&zone<.70){setFlowPhase(FLOW_PHASES.COUNTER,'turnover transition');return}
    if(now<(f.forcedPhaseUntil||0))return;
    if(state.chanceBuild){setFlowPhase(FLOW_PHASES.SHOT_SEQUENCE,'shot preparation');return}
    if(zone>.68){setFlowPhase(FLOW_PHASES.FINAL_THIRD,'advanced possession');return}
    const quiet=now<(f.quietUntil||0);
    const p=f.possessionElapsed;
    if(quiet){setFlowPhase(p<3?FLOW_PHASES.BUILDUP:FLOW_PHASES.CIRCULATION,'quiet spell');return}
    if(p<2.4)setFlowPhase(FLOW_PHASES.BUILDUP,'new possession');
    else if(p<5.5)setFlowPhase(FLOW_PHASES.CIRCULATION,'settled possession');
    else if(zone<.38)setFlowPhase(FLOW_PHASES.PROBING,'searching for route');
    else setFlowPhase(FLOW_PHASES.ATTACKING,'progressing');
    if(!f.template||p>20)chooseFlowTemplate(false);
  }
  function flowPassMode(){
    const f=state.matchFlow||{};const phase=f.currentPhase,template=f.template?.id,team=state.possession,p=team?tacticalProfileForTeam(team):null,r=flowRand();
    if(phase===FLOW_PHASES.COUNTER)return 'forward';
    if(p?.id==='WIDE'&&(phase===FLOW_PHASES.CIRCULATION||phase===FLOW_PHASES.PROBING)&&((f.actionIndex||0)%2===1))return 'switch';
    if(p?.id==='DIRECT'&&phase!==FLOW_PHASES.BUILDUP)return r<.82?'forward':'sideways';
    if(p?.id==='PATIENT'&&(phase===FLOW_PHASES.BUILDUP||phase===FLOW_PHASES.CIRCULATION))return r<.58?'recycle':'sideways';
    if(p?.id==='COMPACT'&&(phase===FLOW_PHASES.BUILDUP||phase===FLOW_PHASES.CIRCULATION))return r<.46?'sideways':'recycle';
    if(p?.id==='FLUID'&&phase===FLOW_PHASES.PROBING)return r<.28?'switch':r<.52?'sideways':'forward';
    if(phase===FLOW_PHASES.CIRCULATION||template==='quiet-spell')return r<.48?'sideways':'recycle';
    if(template==='switch-play'&&((f.actionIndex||0)%3===1))return 'switch';
    if(phase===FLOW_PHASES.BUILDUP)return r<.55?'sideways':'recycle';
    if(phase===FLOW_PHASES.PROBING)return r<.30?'sideways':'forward';
    return 'forward';
  }
  function flowActionWeights(){
    const f=state.matchFlow||{},phase=f.currentPhase,quiet=(state.matchTime||0)<(f.quietUntil||0);
    // Test 19: varied four-and-a-half-minute possessions. Still fast, but attacks are no
    // longer expected to become "two passes then shoot" every time.
    if(quiet)return {shot:.024,drive:.315,pass:.661};
    if(phase===FLOW_PHASES.BUILDUP)return {shot:.038,drive:.365,pass:.597};
    if(phase===FLOW_PHASES.CIRCULATION)return {shot:.052,drive:.368,pass:.580};
    if(phase===FLOW_PHASES.PROBING)return {shot:.108,drive:.425,pass:.467};
    if(phase===FLOW_PHASES.COUNTER)return {shot:.178,drive:.492,pass:.330};
    if(phase===FLOW_PHASES.FINAL_THIRD)return {shot:.355,drive:.355,pass:.290};
    return {shot:.185,drive:.425,pass:.390};
  }

  function performPass(){
    const from=state.carrier;if(!from){scheduleNext();return}
    const team=from.team,opp=other(team),dir=teamMeta[team].attack,choices=teamEntities(team).filter(e=>e!==from),passMode=flowPassMode();
    const tt=state.teamTactics?.[team],ranked=choices.map(to=>{const defenders=teamEntities(opp),space=Math.min(...defenders.map(d=>dist2(to,d))),forward=(to.x-from.x)*dir,lateral=Math.abs(to.y-from.y),lane=passingLaneRisk(from,to,opp),a=from.attributes||{},laneMemory=tt?.memory?.lanePressure?.[to.player.id]||0,hot=tt?.memory?.hotPlayer===to.player.id?.018:0,risk=tt?.risk||.5;let flowFit=0;if(passMode==='forward')flowFit=forward*.34;else if(passMode==='recycle')flowFit=-forward*.36+lateral*.08;else if(passMode==='sideways')flowFit=lateral*.24-Math.abs(forward)*.20;else if(passMode==='switch')flowFit=lateral*.38-Math.abs(forward)*.08;return {to,score:forward*(.20+.10*risk)+flowFit+space*.54-lane*(.70-.12*risk)-laneMemory*.035+(a.passing||.85)*.08+hot+(state.simRand()-.5)*.025}}).sort((a,b)=>b.score-a.score);
    const to=ranked[0]?.to||weightedPlayer(team,from);from.facing=to.x>=from.x?1:-1;from.dir=-from.facing;state.teamStats[team].passes++;state.playerStats[from.player.id].passes++;state.passesSinceShot++;
    const defenders=teamEntities(opp),passDistance=dist2(from,to),passerA=v48LiveAttributes(from,{passDistance,pressure:Math.min(...defenders.map(d=>dist2(d,from)))}),receiverA=v48LiveAttributes(to);
    // Pass into space: weight the target by receiver movement, anticipation and passer quality.
    const lead=.055+.055*(receiverA.anticipation||.85)+.018*(passerA.passing||.85);
    to.tx=safeX(to.x+dir*lead+to.vx*.20);to.ty=safeY(to.y+to.vy*.24+(state.simRand()-.5)*(.09-.035*(passerA.decision||.85)));
    const start=ballHoldPoint(from),target={x:to.tx,y:to.ty};
    const laneScore=d=>{
      const vx=target.x-start.x,vy=target.y-start.y,len2=vx*vx+vy*vy||.001;
      const q=clamp(((d.x-start.x)*vx+(d.y-start.y)*vy)/len2,0,1),px=start.x+vx*q,py=start.y+vy*q;
      const laneDist=Math.hypot(d.x-px,d.y-py),goalSide=(opp==='belros'?d.x<from.x:d.x>from.x)?-.015:0;
      return laneDist+Math.abs(q-.58)*.045+goalSide+(state.simRand()-.5)*.018;
    };
    const challenger=[...defenders].sort((a,b)=>laneScore(a)-laneScore(b))[0];
    const risk=(from.player.risk-1)*.07,distToLane=Math.min(...defenders.map(laneScore)),ca=challenger?.attributes||{};
    // Test 19: restore a believable amount of lane-reading without returning
    // to the old constant-interception loop.
    const readWindow=.155+.045*(ca.anticipation||.85),attemptChance=.205+.165*(ca.interception||.85)+.105*(ca.anticipation||.85)-distToLane*1.25+risk*.68;
    const attempt=distToLane<readWindow && state.simRand()<clamp(attemptChance,.08,.57);
    const passDist=Math.hypot(target.x-start.x,target.y-start.y),duration=clamp(.48+passDist*1.05,.54,.92);
    state.pendingPass={from,to,challenger:attempt?challenger:null};audio.throwPass(passDist);setPlayerAnim(from,'PASSING',.38,ANIM_PRIORITY.PASSING,{target:to.player.id});setPlayerAnim(to,'RECEIVING',duration+.24,ANIM_PRIORITY.RECEIVING,{from:from.player.id});
    if(attempt&&challenger)setPlayerAnim(challenger,'INTERCEPTING',duration+.18,ANIM_PRIORITY.INTERCEPTING,{from:from.player.id,to:to.player.id});
    startFlight(start,target,duration,.032,()=>{
      if(attempt&&challenger){challenger.intent='recover';challenger.tx=safeX(lerp(challenger.x,opp==='belros'?.11:.89,.20));challenger.ty=safeY(challenger.y+(state.simRand()-.5)*.055);challenger.form=clamp((challenger.form||0)-.008,-.12,.12);setPlayerAnim(challenger,'RECOVERING',.72,ANIM_PRIORITY.RECOVERING,{missedInterception:true})}
      const receiverGap=Math.hypot(to.x-state.ball.x,to.y-state.ball.y),nearestPress=Math.min(...teamEntities(opp).map(d=>dist2(d,to)));
      const catchSkill=executionSkill(receiverA,'catching')*.55+executionSkill(receiverA,'anticipation')*.22+executionSkill(passerA,'passing')*.15-(receiverGap*.75)-clamp((.11-nearestPress)*.7,0,.12)+fairNoise(.018);
      const mishandle=receiverGap>.045||state.simRand()>clamp(catchSkill,.62,.97);
      if(mishandle){
        audio.passMiss();audio.crowdHit(.07);showBanner(`LOOSE BALL · ${to.player.name}`,'',1.2);setPlayerAnim(to,'RECOVERING',.52,ANIM_PRIORITY.RECOVERING,{mishandled:true});
        const looseTarget={x:safeX(state.ball.x+to.vx*.18+(state.simRand()-.5)*.055),y:safeY(state.ball.y+to.vy*.18+(state.simRand()-.5)*.085)};
        startLooseBall({x:state.ball.x,y:state.ball.y},looseTarget,.30,{team,fromEntity:to,context:'mishandle'});
        if(state.matchFlow){setFlowPhase(FLOW_PHASES.SCRAMBLE,'mishandled pass');state.matchFlow.lastAction='loose-ball'}flowScheduleNext(.55,1.0);
        return;
      }
      setPlayerAnim(to,'RECEIVING',.28,ANIM_PRIORITY.RECEIVING,{caught:true});audio.catchBall('pass');state.pendingPass=null;state.teamStats[team].completed++;state.playerStats[from.player.id].completed++;from.form=clamp((from.form||0)+.006,-.12,.12);if(state.teamTactics?.[team])state.teamTactics[team].memory.hotPlayer=to.player.id;
      const passChain=state.passesSinceShot,assistCandidate=from;
      const flowDelta=passMode==='forward'?(.055+.040*state.simRand()):passMode==='recycle'?-(.025+.025*state.simRand()):passMode==='switch'?.012:(state.simRand()-.5)*.018;
      setPossession(team,to,clamp(state.zone+flowDelta,.1,.94));
      // setPossession() correctly clears chain state on a real turnover/restart,
      // but a successful pass is the SAME possession. Restore the chain here.
      state.passesSinceShot=passChain;
      state.lastPasser=assistCandidate;
      if(state.matchFlow){state.matchFlow.actionIndex++;state.matchFlow.lastAction=`pass:${passMode}`;if(passMode==='switch')state.matchFlow.lastSwitchAt=state.matchTime||0;}eventLine('pass',{from:from.player.name,to:to.player.name},to.player,.05);
      const quick=from.player.playingTraits?.some(id=>['quick_link','quick_release','give_go'].includes(id));
      flowScheduleNext(quick?.39:.48,quick?.75:.88);
    },{kind:'pass',from,receiver:to,defenders,challenger:attempt?challenger:null,resolved:false,challengeAttempted:false});
  }

  function performDrive(){
    const e=state.carrier;if(!e){flowScheduleNext();return}const phase=state.matchFlow?.currentPhase,p=tacticalProfileForTeam(e.team),step=phase===FLOW_PHASES.COUNTER?.18:phase===FLOW_PHASES.ATTACKING?.12:phase===FLOW_PHASES.PROBING?.085:.055;state.zone=clamp(state.zone+step+step*.35*state.simRand(),.08,.97);e.tx=clamp(e.tx+teamMeta[e.team].attack*(.055+step*.28),.18,.82);const laneSpread=p.id==='WIDE'?.145:p.id==='COMPACT'?.095:.12;e.ty=clamp(e.ty+(state.simRand()-.5)*(phase===FLOW_PHASES.COUNTER?.08:laneSpread),.33,.63);if(state.matchFlow){state.matchFlow.actionIndex++;state.matchFlow.lastAction='carry'}setPlayerAnim(e,'ACCELERATING',.44,ANIM_PRIORITY.ACCELERATING,{drive:true});eventLine('drive',{pet:e.player.name},e.player,.08);setNormalFormation();flowScheduleNext(.46,.84);
  }

  const hoops={belros:[{x:.882,y:.529},{x:.902,y:.467},{x:.923,y:.529}],zafran:[{x:.077,y:.529},{x:.098,y:.467},{x:.118,y:.529}]};

  function likelyShotHoop(shooter){
    if(!shooter)return null;
    const targets=hoops[shooter.team]||[];
    return targets.slice().sort((a,b)=>Math.abs(a.y-shooter.y)-Math.abs(b.y-shooter.y))[0]||targets[1]||targets[0]||null;
  }
  function goalSideScreenPoint(shooter){
    const h=likelyShotHoop(shooter);
    if(!h)return {x:shooter?.x||.5,y:shooter?.y||.5};
    const dx=h.x-shooter.x,dy=h.y-shooter.y,d=Math.hypot(dx,dy)||.001;
    // Keep the defender physically BETWEEN attacker and ring. From distance they
    // sit ~0.06 pitch units ahead; very close to goal they split the remaining lane.
    const step=Math.min(d*.56,.060),u=step/d;
    return {x:safeX(shooter.x+dx*u),y:safeY(shooter.y+dy*u)};
  }

  function openPlayShotAllowed(shooter){
    if(!shooter)return false;
    const tacticalProgress=clamp(Number(state.zone)||.15,.08,.97);
    // Mirror physical pitch progress so left/right use the exact same geometry.
    // belros attacks right, zafran attacks left; 0 = own goal, 1 = opponent goal.
    const fieldProgress=clamp(shooter.team==='belros'?Number(shooter.x||0):(1-Number(shooter.x||0)),0,1);
    const phase=state.matchFlow?.currentPhase;
    const chain=Math.max(0,Number(state.passesSinceShot)||0);
    const defenders=teamEntities(other(shooter.team));
    const pressure=defenders.length?Math.min(...defenders.map(d=>dist2(shooter,d))):1;
    const fastCounter=phase===FLOW_PHASES.COUNTER&&(state.matchFlow?.possessionElapsed||0)<3.2;
    const deepChance=tacticalProgress>=.78&&fieldProgress>=.66;

    // Never casually shoot from your own half / centre circle. Normal attacks must
    // actually progress into the attacking half and reach a meaningful final-third
    // state before a shot can be considered.
    if(tacticalProgress<.60||fieldProgress<.53)return false;
    if(!deepChance&&tacticalProgress<.70&&fieldProgress<.59)return false;

    // Encourage combinations around defenders instead of receive -> shoot. A very
    // advanced chance can be taken immediately; otherwise the move needs some build-up.
    if(!deepChance){
      const minimumChain=fastCounter?1:2;
      if(chain<minimumChain)return false;
    }

    // From medium range, a defender right on top of the carrier should force another
    // pass/drive. Deep chances can still be hit under pressure like real goalmouth play.
    if(!deepChance&&pressure<.070)return false;
    return true;
  }

  function chooseShotOutcome(shooter,penalty=false){
    const a=v48LiveAttributes(shooter,{progress:state.zone||.15}),speed=Math.hypot(shooter.vx,shooter.vy),defenders=teamEntities(other(shooter.team)),pressure=Math.min(...defenders.map(d=>dist2(shooter,d)));
    const shooting=state.careerMode?executionSkill(a,'shooting'):.90,composure=state.careerMode?executionSkill(a,'composure'):.91;
    // SPATIAL NEUTRALITY: finishing quality must never depend on raw screen X.
    // Both sides use the same attack-progress value, so a visual tendency for the
    // pack to sit on the right or left cannot secretly improve one team's odds.
    const attackProgress=clamp(Number(state.zone)||.15,.08,.97);
    const pressurePenalty=clamp((.16-pressure)*.72,0,.10),distancePenalty=clamp((.82-attackProgress)*.125,0,.045),motionPenalty=clamp(speed-.13,0,.08)*.22;
    if(penalty){
      // Same formula for both teams: skill creates probability, never certainty.
      const quality=(state.careerMode?.77+.70*(shooting-.86)+.22*(composure-.86):.58+.16*shooting+.08*composure)+(shooter.form||0)*.55+fairNoise(.018),r=state.simRand();
      return r<clamp(quality,state.careerMode?.50:.61,state.careerMode?.87:.82)?'goal':r<(state.careerMode?.90:.88)?'save':r<(state.careerMode?.96:.95)?'post':'miss';
    }
    const roleBoost=0; // Player parity: no hidden role multiplier on goal conversion.
    const nearest=defenders.slice().sort((x,y)=>dist2(x,shooter)-dist2(y,shooter))[0],coverage=clamp((.32-pressure)/.22,0,1);
    const defence=nearest?(executionSkill(nearest.attributes,'interception')+executionSkill(nearest.attributes,'positioning'))/2:.86;
    const quality=(state.careerMode?.095+.50*(shooting-.86)+.18*(composure-.86)-.30*(defence-.86)*coverage:.065*shooting+.040*composure)+(shooter.form||0)*.10+fairNoise(.014);
    // V2 four-and-a-half-minute format: a very small symmetric finishing bump so the longer
    // standard rotation produces a little more scoring without becoming goal-heavy.
    const goalP=clamp(.155+state.zone*.14+roleBoost+quality-pressurePenalty-distancePenalty-motionPenalty,state.careerMode?.09:.145,state.careerMode?.50:.415),saveP=clamp(.267+pressurePenalty*.55,.230,.345),postP=.13,r=state.simRand();
    // Same formula and RNG for both teams: no favourites, rubber-banding or scripted goals.
    return r<goalP?'goal':r<goalP+saveP?'save':r<goalP+saveP+postP?'post':'miss';
  }

  function beginBigChance(shooter){
    if(!shooter||state.chanceBuild||state.delay){performShot({shooter});return}
    const opp=other(shooter.team),specialist=rolePlayer(opp,'defender'),allDef=teamEntities(opp);
    const defPool=specialist?[specialist,...allDef.filter(e=>e!==specialist)]:allDef;
    const duration=.72+(state.simRand?.()||Math.random())*.42,def=defPool.slice().sort((a,b)=>dist2(a,shooter)-dist2(b,shooter))[0];
    state.chanceBuild={shooter,defender:def,elapsed:0,duration};setFlowPhase(FLOW_PHASES.SHOT_SEQUENCE,'chance created');noteFlowMajor('shot-sequence');state.director.phase='GOAL CHANCE';
    shooter.intent='prepare-shot';setPlayerAnim(shooter,'DECELERATING',Math.min(.55,duration),ANIM_PRIORITY.DECELERATING,{bigChance:true});
    if(def){
      const screen=goalSideScreenPoint(shooter);
      def.intent='close-shot';
      def.tx=screen.x;def.ty=screen.y;
      setPlayerAnim(def,'ACCELERATING',Math.min(.64,duration),ANIM_PRIORITY.ACCELERATING,{closeDown:true,goalSide:true});
    }
    audio.crowdHit(.055);barryReaction('EXCITED',4,520);say(`${shooter.player.name} has a sight of the hoops...`,{priority:4,intensity:'interested',kind:'sequence'});
    state.cameraDirector.shot='CLOSE_ATTACK';state.cameraDirector.timer=duration+.8;
    state.delay={t:duration,cb:()=>{const live=state.carrier===shooter&&state.possession===shooter.team;state.chanceBuild=null;if(live)performShot({shooter});else scheduleNext(.45,.8)}};
  }

  function performShot(opts={}){
    const shooter=opts.shooter||state.carrier;if(!shooter)return;
    const penalty=!!opts.penalty,shootout=!!opts.shootout;
    // OPEN-PLAY SHOT DISCIPLINE: a normal shot only happens after the move has
    // progressed into the attacking half/final third. The gate is mirrored by team,
    // so it changes shot selection without creating any left/right advantage.
    if(!penalty&&!openPlayShotAllowed(shooter)){
      const nearest=teamEntities(other(shooter.team)).slice().sort((a,b)=>dist2(a,shooter)-dist2(b,shooter))[0];
      const pressured=nearest&&dist2(nearest,shooter)<.10;
      if(pressured||state.passesSinceShot<2)performPass();else performDrive();
      return;
    }
    const team=opts.team||shooter.team,opp=other(team);if(!penalty){setFlowPhase(FLOW_PHASES.SHOT_SEQUENCE,'shot');noteFlowMajor('shot')}
    state.teamStats[team].shots++;state.playerStats[shooter.player.id].shots++;
    const hoop=hoops[team][Math.floor(state.simRand()*3)],outcome=chooseShotOutcome(shooter,penalty);
    let target={x:hoop.x,y:hoop.y};
    if(outcome==='goal'||outcome==='save'){target={x:hoop.x+(state.simRand()-.5)*.010,y:hoop.y+(state.simRand()-.5)*.015}}
    else if(outcome==='post'){const side=state.simRand()<.5?-1:1;target={x:hoop.x+side*.013,y:hoop.y+(state.simRand()-.5)*.023}}
    else {target={x:hoop.x+(state.simRand()-.5)*.065,y:hoop.y+(state.simRand()-.5)*.11}}
    state.camera.tx=team==='belros'?.54:.46;state.camera.ty=.52;state.camera.tz=1.065;
    const nominalKeeper=rolePlayer(opp,'defender');
    const goalDefenders=teamEntities(opp).slice().sort((a,b)=>Math.min(dist2(a,target),dist2(a,shooter))-Math.min(dist2(b,target),dist2(b,shooter)));
    // Ordinary shots can be blocked by whichever defender is physically best placed. Penalties
    // retain the designated keeper. This does not alter goal RNG; it only changes who contests a save result.
    const keeper=penalty?nominalKeeper:((goalDefenders[0]&&Math.min(dist2(goalDefenders[0],target),dist2(goalDefenders[0],shooter))<.225)?goalDefenders[0]:nominalKeeper);
    setPlayerAnim(shooter,'SHOOTING',penalty?.70:.58,ANIM_PRIORITY.SHOOTING,{target});
    if((outcome==='goal'||outcome==='save')&&keeper){const saveStyle=target.y<.49?'high':target.y>.555?'low':dist2(keeper,target)<.10?'close':'centre';keeper.intent='save';keeper.tx=safeX(target.x+(team==='belros'?-.018:.018));keeper.ty=safeY(target.y);setPlayerAnim(keeper,'SAVING',penalty?.90:.72,ANIM_PRIORITY.SAVING,{outcome,target,saveStyle,shotBlock:keeper!==nominalKeeper});}
    audio.shot();
    // Pre-roll the scoring cheer on a goal-bound release so the stadium reaction begins
    // roughly a second earlier than the old post-impact trigger. The guard in
    // goalCelebration() prevents it being restarted when the celebration phase begins.
    if(outcome==='goal')audio.goalCelebration();
    audio.crowdHit(.09);eventLine('shot',{pet:shooter.player.name},shooter.player,.12);showBanner(penalty?`PENALTY · ${shooter.player.name}`:`SHOT · ${shooter.player.name}`,'',1.15);
    const from=ballHoldPoint(shooter);
    startFlight(from,target,penalty?.86:.68,penalty?.055:.075,()=>handleShotResult({team,opp,shooter,outcome,hoop,target,penalty,shootout,keeper}),{kind:'shot',shooter,keeper,outcome,target});
  }

  const GOAL_CELEBRATIONS = [
    {id:'fist-pump',name:'Fist Pump',group:'solo'},
    {id:'double-fist-pump',name:'Double Fist Pump',group:'solo'},
    {id:'arms-wide-glide',name:'Arms Wide Glide',group:'solo'},
    {id:'point-crowd',name:'Point to the Crowd',group:'solo'},
    {id:'badge-tap',name:'Badge Tap',group:'solo'},
    {id:'chest-thump',name:'Chest Thump',group:'solo'},
    {id:'broom-raise',name:'Broom Raise',group:'solo'},
    {id:'broom-spin',name:'Broom Spin',group:'solo'},
    {id:'barrel-roll',name:'Victory Barrel Roll',group:'solo'},
    {id:'sharp-uturn',name:'Sharp U-Turn Celebration',group:'solo'},
    {id:'knee-up',name:'Knee-Up Broom Pose',group:'solo'},
    {id:'stand-on-broom',name:'Standing-on-Broom Moment',group:'solo'},
    {id:'hands-off-glide',name:'Hands-Off Glide',group:'solo'},
    {id:'salute',name:'Salute',group:'solo'},
    {id:'bow-crowd',name:'Bow to the Crowd',group:'solo'},
    {id:'finger-wag',name:'Finger Wag',group:'solo'},
    {id:'shush',name:'Shush Celebration',group:'solo'},
    {id:'point-sky',name:'Point to the Sky',group:'solo'},
    {id:'heart-hands',name:'Heart Hands',group:'solo'},
    {id:'air-punch-combo',name:'Air Punch Combo',group:'solo'},
    {id:'high-five',name:'Teammate High Five',group:'pair'},
    {id:'fist-bump',name:'Flying Fist Bump',group:'pair'},
    {id:'shoulder-bump',name:'Shoulder Bump',group:'pair'},
    {id:'side-by-side',name:'Side-by-Side Glide',group:'team'},
    {id:'mini-huddle',name:'Mini Team Huddle',group:'team'},
    {id:'teammate-grab',name:'Teammate Grab',group:'pair'},
    {id:'celebration-chase',name:'Celebration Chase',group:'team'},
    {id:'circle-scorer',name:'Circle the Scorer',group:'team'},
    {id:'opponent-staredown',name:'Opponent Stare-Down',group:'solo'},
    {id:'huge-important',name:'Huge Final / Important Goal Celebration',group:'big',importantOnly:true}
  ];
  function chooseGoalCelebration(team,scorer){
    // Celebration choice affects the length of the frozen goal sequence, so it
    // belongs to the deterministic simulation RNG in globally synced V2.
    const goalRand=()=>state.simRand?.()||Math.random();
    const pp=getPlayerPersonality(scorer),signature=pp.signatureCelebration||signatureCelebrations[scorer?.player?.name]||signatureCelebrations[scorer?.player?.name?.toUpperCase?.()];
    if(signature&&goalRand()<.28){const found=GOAL_CELEBRATIONS.find(c=>c.id===signature);if(found){if(PERSONALITY_DEBUG)console.log('[PERSONALITY]',scorer.player.name,'goal',pp.archetype,found.id,'SIGNATURE');return found}}
    const late=state.matchTime>=MATCH_SECONDS-95,margin=Math.abs(state.score.belros-state.score.zafran),important=late&&margin<=1;
    if(important&&goalRand()<.58)return GOAL_CELEBRATIONS.find(c=>c.id==='huge-important');
    const pool=GOAL_CELEBRATIONS.filter(c=>!c.importantOnly),recent=personalityRecent(scorer,'goalCelebration'),fresh=pool.filter(c=>!recent.includes(c.id)),base=fresh.length?fresh:pool;
    const preferred=personalityCelebrationPreferences(scorer),weighted=[];for(const c of base){weighted.push(c);if(preferred.includes(c.id))weighted.push(c,c)}
    const choice=weighted[Math.floor(goalRand()*weighted.length)]||base[0];recent.push(choice.id);while(recent.length>3)recent.shift();
    if(PERSONALITY_DEBUG)console.log('[PERSONALITY]',scorer.player.name,'goal',pp.archetype,choice.id,'signature false');
    return choice;
  }
  function aerialCelebrationPosition(c,e,elapsed){
    const u=ease(clamp(elapsed/Math.max(.01,c.aerialDuration),0,1)),wave=Math.sin(u*Math.PI),id=c.style.id,isScorer=e===c.scorer,isPartner=e===c.partner,idx=c.order.indexOf(e.player.id),s=c.starts[e.player.id]||{x:e.x,y:e.y},dir=teamMeta[c.team].attack;
    let x=s.x,y=s.y;
    const follow=.035*wave,forward=.075*u;
    if(isScorer){x+=dir*forward;y-=.012*wave}
    else {x=lerp(s.x,c.scorerStart.x-dir*(.045+.022*Math.abs(idx-1)),u*.60);y=lerp(s.y,c.scorerStart.y+(idx-1)*.055,u*.60)-.006*wave}
    if(id==='sharp-uturn'&&isScorer)x=s.x+dir*(u<.48?u/.48:(1-u)/.52)*.10;
    else if(id==='arms-wide-glide'&&isScorer)x=s.x+dir*.115*u;
    else if(id==='broom-spin'&&isScorer)y=s.y-.020*wave;
    else if(id==='barrel-roll'&&isScorer){x=s.x+dir*.09*u;y=s.y-.022*Math.sin(u*Math.PI*2)}
    else if(id==='stand-on-broom'&&isScorer)y=s.y-.035*wave;
    else if(id==='hands-off-glide'&&isScorer)x=s.x+dir*.13*u;
    else if(id==='point-crowd'&&isScorer)y=s.y-.010*wave;
    else if(id==='bow-crowd'&&isScorer)y=s.y+.012*wave;
    else if(id==='point-sky'&&isScorer)y=s.y-.025*wave;
    else if(id==='opponent-staredown'&&isScorer){const foe=c.stareTarget;if(foe){x=lerp(s.x,foe.x-dir*.09,u*.45);y=lerp(s.y,foe.y,u*.45)}}
    else if(['high-five','fist-bump','shoulder-bump','teammate-grab'].includes(id)){
      if(isScorer){x=s.x+dir*.065*u;y=s.y-.010*wave}
      if(isPartner){x=lerp(s.x,(c.scorerStart.x-dir*.045),u*.86);y=lerp(s.y,c.scorerStart.y+.018,u*.86)-.008*wave}
    }else if(id==='side-by-side'){
      const offset=(idx-1)*.060;x=lerp(s.x,c.scorerStart.x+offset,u*.82)+dir*.045*u;y=lerp(s.y,c.scorerStart.y,u*.82)-.006*Math.sin((u+idx*.15)*Math.PI);
    }else if(id==='mini-huddle'){
      x=lerp(s.x,c.scorerStart.x+(idx-1)*.026,u*.88);y=lerp(s.y,c.scorerStart.y+(idx-1)*.010,u*.88)-.008*wave;
    }else if(id==='celebration-chase'){
      if(isScorer)x=s.x+dir*.145*u;else{x=lerp(s.x,c.scorerStart.x-dir*(.07+.035*Math.abs(idx-1)),u*.76)+dir*.09*u;y=lerp(s.y,c.scorerStart.y+(idx-1)*.045,u*.72)}
    }else if(id==='circle-scorer'&&!isScorer){
      const angle=(idx===0?Math.PI:0)+u*Math.PI*2;x=c.scorerStart.x+Math.cos(angle)*(.070-.015*u);y=c.scorerStart.y+Math.sin(angle)*.050;
    }else if(id==='huge-important'){
      if(isScorer){x=s.x+dir*.165*u;y=s.y-.026*wave}else{x=lerp(s.x,c.scorerStart.x-dir*.035+(idx-1)*.035,u*.88)+dir*.105*u;y=lerp(s.y,c.scorerStart.y+(idx-1)*.038,u*.82)-.012*wave}
    }
    return {x:safeX(x),y:safeY(y)};
  }
  function aerialCelebrationPose(e,t){
    const c=state.celebration;if(!c||c.grounded||c.elapsed>=c.aerialDuration||e.team!==c.team)return null;
    const id=c.style.id,isScorer=e===c.scorer,isPartner=e===c.partner,u=clamp(c.elapsed/Math.max(.01,c.aerialDuration),0,1),pulse=Math.abs(Math.sin(c.elapsed*7.5+(e.flowPhase||0)));
    let rot=0,sx=1,sy=1,ox=0,oy=0;
    if(!isScorer&&!isPartner&&!['side-by-side','mini-huddle','celebration-chase','circle-scorer','huge-important'].includes(id))return {rot,sx,sy,ox,oy};
    if(id==='fist-pump'){oy=-3.0*pulse;rot=-(e.facing||1)*.05*pulse}
    else if(id==='double-fist-pump'){oy=-4.5*pulse;sx=1+.045*pulse;sy=1-.025*pulse}
    else if(id==='arms-wide-glide'){sx=1.065;sy=.965;rot=-(e.facing||1)*.025}
    else if(id==='point-crowd'){rot=(e.facing||1)*.055*Math.sin(c.elapsed*3.2);oy=-1.5*pulse}
    else if(id==='badge-tap'){sx=1+.025*pulse;rot=(e.facing||1)*.025*pulse}
    else if(id==='chest-thump'){sx=1+.045*Math.abs(Math.sin(c.elapsed*11));sy=1-.022*Math.abs(Math.sin(c.elapsed*11))}
    else if(id==='broom-raise'){rot=-(e.facing||1)*.20*Math.sin(u*Math.PI);oy=-2*Math.sin(u*Math.PI)}
    else if(id==='broom-spin'){rot=(e.facing||1)*Math.PI*2*ease(u)}
    else if(id==='barrel-roll'){rot=(e.facing||1)*Math.PI*2*ease(u);sx=1+.025*Math.sin(u*Math.PI)}
    else if(id==='sharp-uturn'){rot=(e.facing||1)*.34*Math.sin(u*Math.PI*2);oy=-2.5*pulse}
    else if(id==='knee-up'){rot=-(e.facing||1)*.13;sy=.94;oy=-2.5}
    else if(id==='stand-on-broom'){oy=-8*Math.sin(u*Math.PI);sy=1+.08*Math.sin(u*Math.PI);rot=(e.facing||1)*.035*Math.sin(u*Math.PI*2)}
    else if(id==='hands-off-glide'){sx=1.07;sy=.97;rot=0}
    else if(id==='salute'){rot=-(e.facing||1)*.055;oy=-2*pulse}
    else if(id==='bow-crowd'){rot=(e.facing||1)*.16*Math.sin(u*Math.PI);sy=.96}
    else if(id==='finger-wag'){rot=(e.facing||1)*.045*Math.sin(c.elapsed*10)}
    else if(id==='shush'){rot=(e.facing||1)*.025;sy=.985;oy=-1.2}
    else if(id==='point-sky'){rot=-(e.facing||1)*.12;oy=-3.2*Math.sin(u*Math.PI)}
    else if(id==='heart-hands'){sx=1+.055*pulse;sy=1+.025*pulse;oy=-1.5*pulse}
    else if(id==='air-punch-combo'){oy=-3.2*Math.abs(Math.sin(c.elapsed*13));rot=-(e.facing||1)*.07*Math.sin(c.elapsed*13)}
    else if(id==='high-five'){rot=isScorer?-(e.facing||1)*.055:(e.facing||1)*.055;oy=-2*pulse}
    else if(id==='fist-bump'){ox=(isScorer?1:-1)*2.2*pulse;rot=(isScorer?-1:1)*(e.facing||1)*.035}
    else if(id==='shoulder-bump'){ox=(isScorer?1:-1)*3*Math.sin(u*Math.PI);sx=1+.02*pulse}
    else if(id==='side-by-side'){rot=(idx=>((idx-1)*.025))(c.order.indexOf(e.player.id));oy=-1.5*pulse}
    else if(id==='mini-huddle'){sx=1+.025*pulse;oy=-2.4*pulse}
    else if(id==='teammate-grab'){rot=(isScorer?-1:1)*(e.facing||1)*.055;ox=(isScorer?1:-1)*2.0}
    else if(id==='celebration-chase'){rot=-(e.facing||1)*.045;oy=-2.3*pulse}
    else if(id==='circle-scorer'){rot=(e.facing||1)*.08*Math.sin(c.elapsed*5);oy=-1.7*pulse}
    else if(id==='opponent-staredown'){rot=(e.facing||1)*.04;sy=.98}
    else if(id==='huge-important'){oy=-4.5*pulse;rot=-(e.facing||1)*.07*Math.sin(c.elapsed*5.5);sx=1+.04*pulse}
    return {rot,sx,sy,ox,oy};
  }
  function celebrationPalette(team){
    // V2 broadcast home/away language rather than World Cup flag colours.
    return team==='belros'
      ?['#f2b452','#f7de9a','#9e402b','#fff2ca']
      :['#67c7ee','#b9edff','#27577d','#f0fbff'];
  }
  function makeCelebrationToss(c){
    const vr=()=>state.visualRand?.()||Math.random(),left=vr()<.5;
    const roll=vr(),type=roll<.42?'petal':roll<.78?'confetti':'scarf';
    const palette=celebrationPalette(c.team),colour=palette[Math.floor(vr()*palette.length)]||palette[0];
    const x=left?.035:.965,y=.24+vr()*.25,targetX=c.centerX+(vr()-.5)*.32;
    const flight=1.55+vr()*.95;
    const size=type==='scarf'?1.15+vr()*.38:type==='petal'?.70+vr()*.35:.62+vr()*.42;
    return {
      type,colour,x,y,
      vx:(targetX-x)/flight,
      vy:-.065-vr()*.070,
      g:.165+vr()*.050,
      age:0,
      life:type==='scarf'?4.8+vr()*1.6:3.6+vr()*1.5,
      floorY:groundedY(.006+vr()*.015),
      rot:(vr()-.5)*1.2,
      vr:(vr()-.5)*(type==='scarf'?2.2:5.2),
      phase:vr()*Math.PI*2,
      flutter:.012+vr()*.016,
      size,
      bounces:0,
      onFloor:false,
      floorAge:0
    };
  }
  function makeFirework(c){return {x:clamp(c.centerX+((state.visualRand?.()||Math.random())-.5)*.58,.20,.80),y:.245+(state.visualRand?.()||Math.random())*.17,age:0,life:1.25+(state.visualRand?.()||Math.random())*.55,seed:(state.visualRand?.()||Math.random())*Math.PI*2};}
  function celebrationWaypoints(c,e){
    const idx=c.order.indexOf(e.player.id),side=idx-1,dir=idx===1?1:(idx===0?1:-1),jitter=(e.flowPhase||0)*.004;
    const pts=idx===1?
      [[0,0,0],[.9,.030,-.006],[1.8,-.048,0],[2.9,.040,.005],[4.0,-.018,-.004],[5.1,.052,.004],[6.2,-.038,0],[7.2,.022,-.004],[8.2,0,0]]:
      [[0,side*.067,0],[.9,side*.040,-.004],[1.8,-side*.010,.004],[2.9,side*.090,0],[4.0,side*.025,-.005],[5.1,-side*.025,.004],[6.2,side*.075,0],[7.2,side*.035,-.004],[8.2,side*.058,0]];
    return pts.map(([t,x,y])=>[t,x+jitter*dir,y]);
  }
  function celebrationPathPosition(c,e,g){
    const pts=c.paths[e.player.id]||celebrationWaypoints(c,e);let a=pts[0],b=pts[pts.length-1];
    for(let i=0;i<pts.length-1;i++){if(g>=pts[i][0]&&g<=pts[i+1][0]){a=pts[i];b=pts[i+1];break}}
    const span=Math.max(.001,b[0]-a[0]),u=ease(clamp((g-a[0])/span,0,1)),x=c.centerX+lerp(a[1],b[1],u),baseOffset=lerp(a[2],b[2],u);
    const jumpGate=(g<1.25)||(g>2.15&&g<3.35)||(g>4.45&&g<5.65)||(g>6.25);
    const jump=jumpGate?Math.pow(Math.max(0,Math.sin((g+(e.flowPhase||0))*(e===c.scorer?6.0:5.1))),1.7)*(e===c.scorer?.017:.012):0;
    return {x:safeX(x),y:groundedY(baseOffset-jump),jump};
  }
  function beginGoalCelebration(team,scorer,restartTeam,varContext=null,adminPreview=false){
    const style=chooseGoalCelebration(team,scorer),fullTeam=(state.simRand?.()||Math.random())<.125||style.group==='big';
    const players=teamEntities(team),others=players.filter(e=>e!==scorer).sort((a,b)=>dist2(a,scorer)-dist2(b,scorer));
    const partner=others[0]||null,participants=fullTeam?[scorer,...others]:[scorer,partner].filter(Boolean);
    const aerialDuration=style.id==='huge-important'?1.9:1.25+(state.simRand?.()||Math.random())*.45,descentDuration=.72,groundedAt=aerialDuration+descentDuration;
    // V38.12: keep the grounded celebration on screen long enough to read before
    // the logo/replay sting begins. Same timing rules for both teams.
    const duration=clamp(groundedAt+(fullTeam?2.05:1.68)+(state.simRand?.()||Math.random())*.55,3.55,5.45),centerX=team==='belros'?.67:.33;
    const order=participants.slice().sort((a,b)=>a.y-b.y).map(e=>e.player.id),starts={},targets={},otherStarts={},otherTargets={},paths={};
    participants.forEach((e,i)=>{
      starts[e.player.id]={x:e.x,y:e.y};
      const offset=participants.length===2?(i===0?-.035:.035):(i-(participants.length-1)/2)*.055;
      targets[e.player.id]={x:safeX(centerX+offset),y:groundedY(Math.abs(offset)*.010)};
      e.intent='celebrate-aerial';
      enterReaction(e,e===scorer?'celebrating':'celebratingWithTeammate','CELEBRATING',duration,{scorer:e===scorer,celebrationId:style.id,faceX:scorer.x},ANIM_PRIORITY.CELEBRATING);
      paths[e.player.id]=celebrationWaypoints({centerX,order},e);
    });
    players.filter(e=>!participants.includes(e)).forEach((e,i)=>{
      // Every scoring-team player comes down to the ice. The non-primary
      // celebrator stays slightly wider so the rare full-team celebration
      // still feels distinct from an ordinary goal.
      starts[e.player.id]={x:e.x,y:e.y};
      const side=e.x<centerX?-1:1;
      targets[e.player.id]={x:safeX(centerX+side*(.105+i*.018)),y:groundedY(0)};
      e.tx=targets[e.player.id].x;e.ty=targets[e.player.id].y;
      const pp=getPlayerPersonality(e),joinType=pp.teammateStyle==='playful'?'circleTeammate':pp.teammateStyle==='serious'?'briefAcknowledge':'joinFromDistance';
      enterReaction(e,'encouraging','ENCOURAGING',Math.max(1.0,groundedAt+.45),{type:joinType,faceX:scorer.x,groundAfterGoal:true},ANIM_PRIORITY.ENCOURAGING);
    });
    teamEntities(restartTeam).forEach((e,i)=>{
      otherStarts[e.player.id]={x:e.x,y:e.y};
      // Match restartAfterScore() exactly so the opposition visibly flies
      // back into its restart shape instead of snapping there after replay.
      otherTargets[e.player.id]={x:restartTeam==='belros'?.43:.57,y:.40+i*.12};
      const isKeeper=e.player.role==='defender',type=isKeeper?personalityChoice(e,'concedeKeeper',['lowerHead','pointDefenders','lookBack'],getPlayerPersonality(e).reactionStyle==='expressive'?['lowerHead']:['lookBack','pointDefenders']):personalityReaction(e,'concede',['headShake','lookKeeper','dropShoulders','turnHome']);
      enterReaction(e,isKeeper?'keeperFrustrated':'disappointed',isKeeper?'KEEPER_FRUSTRATED':'DISAPPOINTED',.8+visualRandom()*.8,{conceded:true,type,faceX:isKeeper?centerX:(rolePlayer(restartTeam,'defender')?.x??centerX)},isKeeper?ANIM_PRIORITY.KEEPER_FRUSTRATED:ANIM_PRIORITY.DISAPPOINTED);
    });
    state.ref.tx=safeX(lerp(state.ref.x,centerX,.30));state.ref.ty=safeY(.54);state.ref.reactionState='reactingToGoal';state.ref.reactionUntil=simNow()+1300;
    state.ball.flight=null;state.ball.visible=false;state.carrier=null;state.pendingPass=null;state.delay=null;
    const stareTarget=teamEntities(restartTeam).slice().sort((a,b)=>dist2(a,scorer)-dist2(b,scorer))[0]||null,replayFrames=state.replayBuffer.slice(-52);
    state.celebration={team,scorer,scorerStart:{...starts[scorer.player.id]},partner,participants,fullTeam,style,restartTeam,varContext,adminPreview,elapsed:0,duration,aerialDuration,descentDuration,groundedAt,grounded:false,centerX,starts,targets,otherStarts,otherTargets,order,paths,stareTarget,replayFrames,goalGraphicShown:false,tosses:[],nextTossAt:.12,fireworks:[]};
    const fx=state.celebration;
    const tossCount=fullTeam?8:6,fireworkCount=fullTeam?4:2;
    for(let i=0;i<tossCount;i++)fx.tosses.push(makeCelebrationToss(fx));
    for(let i=0;i<fireworkCount;i++)fx.fireworks.push(makeFirework(fx));
    setBroadcastState('GOAL_CELEBRATION');$('wcWorldCupBroadcast')?.classList.add('is-goal-celebration');
    audio.goalCelebration();audio.crowdAccentTimer=Math.max(audio.crowdAccentTimer,7);barryReaction('GOAL_REACTION',10,2200);
    if(REACTION_DEBUG)console.log('[REACTION]',`Scorer: ${scorer.player.name}`,`Celebration: ${style.id}`,`Joined by: ${participants.filter(e=>e!==scorer).map(e=>e.player.name).join(', ')||'none'}`,`Duration: ${Math.round(duration*1000)}ms`);
  }
  function finishGoalCelebration(){
    const c=state.celebration;if(!c)return;
    // Lock the conceding side onto the exact restart positions they have just
    // flown toward. This guarantees no post-replay snap.
    teamEntities(c.restartTeam).forEach(e=>{
      const target=c.otherTargets?.[e.player.id];
      if(!target)return;
      e.x=target.x;e.y=target.y;e.tx=target.x;e.ty=target.y;
      e.vx=e.vy=0;e.intent='restart-ready';
    });
    state.celebration=null;$('wcWorldCupBroadcast')?.classList.remove('is-goal-celebration');
    // V33.1 camera safety: remove celebration zoom/momentum before any replay sting.
    Object.assign(state.camera,{x:.5,y:.515,zoom:1.022,tx:.5,ty:.515,tz:1.022,vx:0,vy:0,vz:0,mode:'LIVE_BROADCAST'});
    if(state.cameraDirector){state.cameraDirector.shot='MAIN';state.cameraDirector.lastShot='';state.cameraDirector.timer=2.4;}
    const finishSequence=()=>{
      if(c.adminPreview){state.ball.visible=true;setBroadcastState('LIVE');return}
      if(c.varContext){startVar(c.varContext);return}
      restartAfterScore(c.restartTeam);Object.assign(state.camera,{x:.5,y:.515,zoom:1.022,tx:.5,ty:.515,tz:1.022,vx:0,vy:0,vz:0,mode:'LIVE_BROADCAST'});setBroadcastState('LIVE');
    };
    // V33 flow: goal -> reactions/celebration -> logo sting -> replay -> logo sting -> restart.
    // beginReplay and its outro callback keep the simulation frozen for the whole cinematic.
    if(!c.adminPreview&&c.replayFrames?.length>=10){
      const started=beginReplay('GOAL REPLAY',c.replayFrames,{frames:38,duration:2.55,slow:.68,introDuration:.48,onDone:finishSequence});
      if(started)return;
    }
    finishSequence();
  }
  function updateGoalCelebration(dt){
    const c=state.celebration;if(!c)return;c.elapsed+=dt;
    // Celebration VFX are presentation-only and never use gameplay RNG.
    if(!Array.isArray(c.tosses))c.tosses=[];
    if(!Array.isArray(c.fireworks))c.fireworks=[];
    for(const fw of c.fireworks)fw.age=(fw.age||0)+dt;
    c.fireworks=c.fireworks.filter(fw=>(fw.age||0)<(fw.life||1.5));

    // Keep a few new crowd throws arriving during the celebration instead of
    // dumping everything at frame one.
    if(c.elapsed<(c.duration-.70)&&c.elapsed>=(c.nextTossAt||0)){
      const burst=(state.visualRand?.()||Math.random())<.24?2:1;
      for(let i=0;i<burst;i++)c.tosses.push(makeCelebrationToss(c));
      c.nextTossAt=c.elapsed+.34+(state.visualRand?.()||Math.random())*.38;
    }

    for(const f of c.tosses){
      f.age=(f.age||0)+dt;
      f.rot+=(f.vr||0)*dt;

      if(!f.onFloor){
        f.vy=(f.vy||0)+(f.g||.18)*dt;
        // Petals/confetti/scarves flutter independently of their ballistic arc.
        const flutter=Math.sin(f.age*(f.type==='scarf'?5.2:9.0)+(f.phase||0))*(f.flutter||.014);
        f.x+=(f.vx||0)*dt+flutter*dt;
        f.y+=(f.vy||0)*dt;

        if(f.y>=(f.floorY||.72)){
          f.y=f.floorY||.72;
          f.bounces=(f.bounces||0)+1;
          if(f.bounces<=2&&Math.abs(f.vy)>.028){
            f.vy=-Math.abs(f.vy)*(f.type==='scarf'?.26:.34);
            f.vx*=.72;
            f.vr*=.78;
          }else{
            f.onFloor=true;
            f.floorAge=0;
            f.vy=0;
            f.vx*=.55;
            f.vr*=.55;
          }
        }
      }else{
        f.floorAge=(f.floorAge||0)+dt;
        // Never become a frozen decal: slide/turn briefly, then fade away.
        f.x+=(f.vx||0)*dt;
        f.vx*=Math.exp(-dt*1.7);
        f.vr*=Math.exp(-dt*1.4);
        if(f.type==='scarf')f.rot+=Math.sin(f.floorAge*4+(f.phase||0))*.18*dt;
      }
    }
    c.tosses=c.tosses.filter(f=>(f.age||0)<(f.life||5)&&(!f.onFloor||(f.floorAge||0)<1.35));
    if(!c.grounded&&c.elapsed>=c.groundedAt){
      c.grounded=true;
      teamEntities(c.team).forEach(e=>{
        e.vx=e.vy=0;
        e.x=c.targets[e.player.id]?.x??e.x;
        e.y=c.targets[e.player.id]?.y??groundedY(0);
        e.intent='celebrate';
        if(c.participants.includes(e)){
          enterReaction(e,e===c.scorer?'celebrating':'celebratingWithTeammate','CELEBRATING',Math.max(.2,c.duration-c.elapsed),{scorer:e===c.scorer,ground:true,celebrationId:c.style.id,faceX:c.scorer.x},ANIM_PRIORITY.CELEBRATING);
        }else{
          enterReaction(e,'encouraging','ENCOURAGING',Math.max(.2,c.duration-c.elapsed),{type:'joinFromDistance',ground:true,faceX:c.scorer.x},ANIM_PRIORITY.ENCOURAGING);
        }
      });
    }
    if(c.grounded&&!c.goalGraphicShown&&c.elapsed>=c.groundedAt+.20){c.goalGraphicShown=true;const ps=state.playerStats[c.scorer.player.id];showStoryCard('REPO SPORTS · GOAL',c.scorer.player.name,`${teamMeta[c.team].name} · ${ps.goals} goal${ps.goals===1?'':'s'} tonight`,c.team,c.scorer.player,Math.min(2.0,Math.max(.7,c.duration-c.elapsed)))}
    if(c.elapsed>=c.duration)finishGoalCelebration();
  }
  function updateGoalCelebrationEntities(dt){
    const c=state.celebration;if(!c)return;
    const descendU=ease(clamp((c.elapsed-c.aerialDuration)/Math.max(.01,c.descentDuration),0,1));
    for(const e of state.entities){
      e.animElapsed=(e.animElapsed||0)+dt;
      if(e.team===c.team){
        const target=c.targets[e.player.id];
        const activeCelebrator=c.participants.includes(e);
        if(!target){
          e.vx=lerp(e.vx,0,1-Math.exp(-dt*4));e.vy=lerp(e.vy,0,1-Math.exp(-dt*4));e.x+=e.vx*dt;e.y+=e.vy*dt;
          if(Math.abs(c.scorer.x-e.x)>.02){e.facing=c.scorer.x>=e.x?1:-1;e.dir=-e.facing}
          continue;
        }
        const px=e.x,py=e.y;
        if(activeCelebrator){
          if(c.elapsed<c.aerialDuration){const pos=aerialCelebrationPosition(c,e,c.elapsed);e.x=pos.x;e.y=pos.y;e.intent='celebrate-aerial'}
          else if(!c.grounded){const a=aerialCelebrationPosition(c,e,c.aerialDuration);e.x=lerp(a.x,target.x,descendU);e.y=lerp(a.y,target.y,descendU);e.intent='celebration-descent'}
          else {const g=Math.max(0,c.elapsed-c.groundedAt),pos=celebrationPathPosition(c,e,g);e.x=pos.x;e.y=pos.y;e.celebrationJump=pos.jump;e.intent='celebrate'}
        }else{
          // Supporting teammate calmly comes down to the same grounded scene.
          const a=c.starts[e.player.id]||{x:e.x,y:e.y};
          const u=ease(clamp(c.elapsed/Math.max(.01,c.groundedAt),0,1));
          e.x=lerp(a.x,target.x,u);
          e.y=lerp(a.y,target.y,u);
          e.intent=c.grounded?'celebrate-support':'celebration-descent';
          e.celebrationJump=0;
        }
        e.vx=(e.x-px)/Math.max(dt,.001);e.vy=(e.y-py)/Math.max(dt,.001);e.celebrationMotion=Math.hypot(e.vx,e.vy);
        if(Math.abs(e.vx)>.006){e.facing=e.vx>0?1:-1;e.dir=-e.facing}else if(c.grounded){e.facing=c.scorer.x>=e.x?1:-1;e.dir=-e.facing}
        e.animState=activeCelebrator?'CELEBRATING':'ENCOURAGING';
        e.animMeta={...(e.animMeta||{}),celebrationId:c.style.id,scorer:e===c.scorer,groundedSupport:!activeCelebrator};
      }else{
        const a=c.otherStarts[e.player.id],b=c.otherTargets[e.player.id];
        if(a&&b){
          // Conceding team react for a beat, then visibly fly ALL the way back
          // to their restart/kickoff shape over almost the full celebration.
          const retreatDelay=.28,retreatDuration=Math.max(2.75,c.duration-retreatDelay-.22);
          const raw=clamp((c.elapsed-retreatDelay)/retreatDuration,0,1);
          const oq=raw*raw*(3-2*raw),px=e.x,py=e.y;
          e.x=lerp(a.x,b.x,oq);e.y=lerp(a.y,b.y,oq);
          e.vx=(e.x-px)/Math.max(dt,.001);e.vy=(e.y-py)/Math.max(dt,.001);
          e.intent=raw<1?'restart-retreat':'restart-ready';
          if(Math.abs(e.vx)>.003){e.facing=e.vx>=0?1:-1;e.dir=-e.facing}
        }
      }
    }
    const r=state.ref,dx=r.tx-r.x,dy=r.ty-r.y,k=1-Math.exp(-dt*4);r.vx=lerp(r.vx,dx*1.3,k);r.vy=lerp(r.vy,dy*1.3,k);r.x=safeX(r.x+r.vx*dt);r.y=safeY(r.y+r.vy*dt);if(Math.abs(r.vx)>.004)r.dir=r.vx>=0?1:-1;
  }

  function handleShotResult(info){
    const {team,opp,shooter,hoop,penalty,shootout}=info;const keeper=info.keeper||rolePlayer(opp,'defender');let outcome=info.outcome;
    // A selected save is not granted until the defender has physically reached the save zone.
    // If they are late, the simulation resolves from what is actually visible on screen.
    if(outcome==='save'&&keeper&&dist2(keeper,info.target)>.068){const recovery=executionSkill(keeper.attributes,'reaction');outcome=state.simRand()<clamp(.76-(recovery-.86)*.32,.66,.80)?'goal':'post';info.outcome=outcome;}
    const shooterStats=state.playerStats[shooter.player.id];
    if(outcome==='goal'||outcome==='save'){state.teamStats[team].onTarget++;shooterStats.onTarget++}
    if(outcome!=='goal'){state.teamStats[team].missedChances++;shooterStats.missedChances++}
    if(outcome==='goal'){
      if(shootout){resolveShootoutPenalty(team,true,shooter);return}
      state.score[team]++;state.playerStats[shooter.player.id].goals++;recordEvent('goal',{player:shooter.player.name,playerId:shooter.player.id,team},6.0);const assister=(state.lastPasser&&state.lastPasser.team===team)?state.lastPasser:null;if(assister)state.playerStats[assister.player.id].assists++;
      const hatTrickEarned=state.playerStats[shooter.player.id].goals===3;
      playV2NametagGoalEffect(shooter.player.id);
      audio.ensure();audio.play(audio.goal,.70);audio.crowdHit(.50);
      const score=`${state.score.belros}-${state.score.zafran}`,late=state.matchTime>120,equal=state.score.belros===state.score.zafran,goAhead=Math.abs(state.score.belros-state.score.zafran)===1;const flavour=late?(equal?'LATE EQUALISER!':'DRAMA!'):equal?'ALL SQUARE!':goAhead?'GO-AHEAD GOAL!':'GOAL!';showBanner(`${flavour} · ${shooter.player.name} · ${score}`,'',3.0);eventLine('goal',{pet:shooter.player.name,team:teamMeta[team].name,score},shooter.player,.24);
      const varCheck=!penalty&&state.simRand()<.12,varContext=varCheck?{kind:'goal',team,shooter,assister,hatTrick:hatTrickEarned}:null;
      if(hatTrickEarned&&!varCheck)triggerBigMoment('hattrick');
      beginGoalCelebration(team,shooter,opp,varContext,false);
    }else if(outcome==='save'){
      const defender=keeper;state.playerStats[defender.player.id].saves++;recordEvent('save',{player:defender.player.name,team:opp},3.7);defender.tx=info.hoop.x+(team==='belros'?-.025:.025);defender.ty=info.hoop.y;setPlayerAnim(defender,'SAVING',.64,ANIM_PRIORITY.SAVING,{saved:true,saveStyle:info.target.y<.49?'high':info.target.y>.555?'low':dist2(defender,info.target)<.08?'close':'centre'});enterReaction(shooter,'reactingToSave','REACTING_TO_SAVE',.55+visualRandom()*.55,{saved:true,type:personalityChoice(shooter,'savedShot',['handsHead','slowDown','headShake'],getPlayerPersonality(shooter).reactionStyle==='expressive'?['handsHead']:['slowDown','headShake']),faceX:info.hoop.x},ANIM_PRIORITY.REACTING_TO_SAVE);reactKeeperSave(defender,shooter);audio.crowdHit(.13);
      const nominalKeeper=rolePlayer(opp,'defender'),outfieldBlock=defender!==nominalKeeper;
      const keeperControl=executionSkill(defender.attributes,'catching'),cleanChance=clamp(.38+(keeperControl-.86)*.22,.32,.46);const saveType=outfieldBlock?'block':shootout?'clean':(dist2(defender,info.target)<.050&&state.simRand()<cleanChance?'clean':state.simRand()<.50?'parry':'block');
      if(saveType==='clean')audio.catchBall('save');else audio.rebound();
      showBanner(`${saveType==='clean'?'SAVE':saveType==='parry'?'PARRY':'BLOCK'} · ${defender.player.name}`,'',1.6);eventLine('save',{pet:shooter.player.name,defender:defender.player.name},defender.player,.10);if(state.playerStats[defender.player.id].saves%2===0)showStoryCard('REPO SPORTS · HOOP DEFENDER WATCH',defender.player.name,`${state.playerStats[defender.player.id].saves} saves tonight`,defender.team,defender.player,3.8);if(saveType!=='clean'&&state.replayBuffer.length>=24&&state.matchTime-state.lastReplayAt>28&&(state.simRand?.()||Math.random())<.42)beginReplay('SAVE REPLAY',state.replayBuffer.slice(-42),{frames:34,duration:2.30,slow:.69,introDuration:.45});
      if(shootout){resolveShootoutPenalty(team,false,shooter);return}
      if(saveType==='clean'){setPossession(opp,defender,.12);scheduleNext(.75,1.4);}
      else {
        const rx=clamp(info.target.x+(team==='belros'?-1:1)*(.07+.03*state.simRand()),.15,.85),ry=clamp(info.target.y+(state.simRand()-.5)*.16,.30,.74);
        startLooseBall({x:info.target.x,y:info.target.y},{x:rx,y:ry},saveType==='block'?.26:.36,{team:opp,fromEntity:defender,context:saveType});
        scheduleNext(.55,1.0);
      }
    }else if(outcome==='post'){
      audio.hoopHit();audio.crowdHit(.18);state.camera.shake=.007;recordEvent('post',{player:shooter.player.name,team},4.2);showBanner('OFF THE RING!','danger',1.5);eventLine('post',{pet:shooter.player.name},shooter.player,.08);
      if(shootout){resolveShootoutPenalty(team,false,shooter);return}
      setPlayerAnim(shooter,'RECOVERING',.48,ANIM_PRIORITY.RECOVERING,{rebound:true});const reboundTeam=state.simRand()<.5?team:opp,rebounder=weightedPlayer(reboundTeam);state.teamStats[reboundTeam].rebounds++;state.playerStats[rebounder.player.id].rebounds++;recordEvent('rebound',{player:rebounder.player.name,team:reboundTeam},2.1);const rx=clamp(info.hoop.x+(team==='belros'?-.10:.10)+(state.simRand()-.5)*.055,.15,.85),ry=clamp(info.hoop.y+(state.simRand()-.5)*.16,.32,.72);teamEntities(team).concat(teamEntities(opp)).filter(e=>dist2(e,info.hoop)<.23).forEach(e=>{e.intent='recover';setPlayerAnim(e,'RECOVERING',.52,ANIM_PRIORITY.RECOVERING,{looseBall:true})});setPlayerAnim(rebounder,'RECEIVING',.72,ANIM_PRIORITY.RECEIVING,{rebound:true});
      startLooseBall(info.target,{x:rx,y:ry},.52,{team:reboundTeam,fromEntity:rebounder,context:'rebound'});
      scheduleNext(.7,1.35);
    }else{
      reactToMiss(shooter);audio.missImpact();audio.crowdHit(.06);showBanner(`MISS · ${shooter.player.name}`,'',1.25);eventLine('miss',{pet:shooter.player.name},shooter.player,.07);
      if(shootout){resolveShootoutPenalty(team,false,shooter);return}
      const looseX=clamp(info.target.x+(team==='belros'?-1:1)*.035,.12,.88),looseY=clamp(info.target.y+(state.simRand()-.5)*.09,.28,.76);
      startLooseBall(info.target,{x:looseX,y:looseY},.24,{team:opp,fromEntity:keeper||rolePlayer(opp,'defender'),context:'miss'});
      scheduleNext(.65,1.2);
    }
  }

  function restartAfterScore(team){
    // POST-GOAL KICKOFF: `team` is ALWAYS the side that conceded. Never let the
    // scoring side retain the Quaffle after a goal. Reset both teams into a
    // mirrored centre restart shape, then visibly release the ball from centre
    // to one of the conceding team's players before open play resumes.
    const restartTeam=team;
    const receivingTeam=teamEntities(restartTeam);
    const carrier=receivingTeam[Math.floor(state.simRand()*Math.max(1,receivingTeam.length))]||receivingTeam[0];
    if(!carrier){scheduleNext(.65,.95);return;}
    receivingTeam.forEach((e,i)=>{
      e.tx=restartTeam==='belros'?.455:.545;
      e.ty=.405+i*.115;
      e.intent='restart-ready';
      enterReaction(e,'returningToPosition','RETURNING_TO_POSITION',.68,{restart:true,kickoff:true},ANIM_PRIORITY.RETURNING_TO_POSITION);
    });
    teamEntities(other(restartTeam)).forEach((e,i)=>{
      e.tx=restartTeam==='belros'?.60:.40;
      e.ty=.405+i*.115;
      e.intent='restart-shape';
      enterReaction(e,'returningToPosition','RETURNING_TO_POSITION',.68,{restart:true,kickoff:true},ANIM_PRIORITY.RETURNING_TO_POSITION);
    });
    state.possession=restartTeam;
    state.carrier=null;
    state.kickoffReceiver=carrier;
    state.zone=.12;
    state.passesSinceShot=0;
    state.lastPasser=null;
    state.pendingPass=null;
    state.ball.visible=true;
    state.ball.flight=null;
    state.ball.owner=null;
    state.ball.state='IN_FLIGHT';
    state.ball.x=.5;
    state.ball.y=.535;
    carrier.intent='receive';
    carrier.tx=safeX(.5+(restartTeam==='belros'?-.028:.028));
    carrier.ty=.565;
    setPlayerAnim(carrier,'RECEIVING',.82,ANIM_PRIORITY.RECEIVING,{kickoff:true,afterGoal:true});
    state.camera.tx=.5;state.camera.ty=.5;state.camera.tz=1.015;
    audio.ensure();audio.play(audio.whistle,.48);audio.playKickoffRelease();
    showBanner(`${teamMeta[restartTeam].name} RESTART`,'',1.05);
    startFlight({x:.5,y:.535},{x:carrier.tx,y:carrier.ty},.62,-.025,()=>{
      state.kickoffReceiver=null;audio.catchBall('kickoff');
      setPossession(restartTeam,carrier,.12);
      scheduleNext(.72,1.18);
    },{kind:'kickoff',receiver:carrier,afterGoal:true});
  }

  function startFreeKick(team,victim){
    const players=teamEntities(team);
    const taker=(victim&&victim.team===team?victim:null)||players.find(e=>e.player.role==='support')||players[0];
    if(!taker){scheduleNext(.55,.85);return;}
    // The whistle has already stopped the action visually; now set a tidy little
    // free-kick shape before handing the Quaffle back. The match clock continues
    // throughout because this uses the ordinary delay/action system, not a frozen phase.
    const dir=teamMeta[team].attack;
    players.forEach((e,i)=>{
      if(e===taker){e.tx=safeX(e.x-dir*.012);e.ty=safeY(e.y);e.intent='free-kick-taker';}
      else {e.tx=safeX(taker.x-dir*(.055+.025*i));e.ty=safeY(taker.y+(i?-.07:.07));e.intent='set-piece-support';}
      setPlayerAnim(e,'DECELERATING',.42,ANIM_PRIORITY.DECELERATING,{setPiece:true,freeKick:true});
    });
    teamEntities(other(team)).forEach((e,i)=>{
      e.tx=safeX(taker.x+dir*(.10+.018*i));
      e.ty=safeY(taker.y+(i-1)*.075);
      e.intent='set-piece-defend';
      setPlayerAnim(e,'IDLE',.52,ANIM_PRIORITY.IDLE,{setPiece:true,freeKick:true});
    });
    state.ref.tx=safeX(taker.x-dir*.04);state.ref.ty=safeY(taker.y-.075);
    audio.ensure();audio.play(audio.whistle,.42);
    showBanner(`FREE KICK · ${teamMeta[team].name}`,'',1.15);
    setPossession(team,taker,clamp(state.zone-.04,.12,.9));
    scheduleNext(.68,1.05);
  }

  function disciplineCardDecision(offender,possiblePenalty=false){
    if(!offender?.player)return null;
    const ps=state.playerStats[offender.player.id]||{},rng=state.disciplineRand||state.simRand||Math.random;
    const defence=executionSkill(offender.attributes||{},'interception'),foulNo=Math.max(1,Number(ps.fouls||1)),repeat=Math.max(0,foulNo-1);
    const techniqueRisk=clamp((.86-defence)*.38,0,.09);
    const directChance=clamp(.006+techniqueRisk*.12+(possiblePenalty?.006:0)+repeat*.002,.004,.028);
    const yellowChance=clamp(.17+techniqueRisk+repeat*.065+(possiblePenalty?.035:0),.12,.46);
    const roll=rng();
    if(roll<directChance){const severity=rng();return {card:'RED',reason:severity<.12?'VIOLENT_CONDUCT':severity<.58?'SERIOUS_FOUL_PLAY':'DENIAL_GOAL_OPPORTUNITY'}}
    if(roll<directChance+yellowChance)return Number(ps.yellowCards||0)>=1?{card:'SECOND_YELLOW',reason:'SECOND_YELLOW'}:{card:'YELLOW',reason:'CAUTION'};
    return null;
  }
  function disciplineSendOff(entity){
    if(!entity?.player)return false;
    const m=state.management,r=m?.players?.[entity.player.id];
    if(r){r.active=false;r.used=true;r.sentOff=true;r.left=Math.round(matchdayMinute());}
    if(m){m.pending=(m.pending||[]).filter(c=>c.outId!==entity.player.id&&c.inId!==entity.player.id);if(m.selectedOut===entity.player.id)m.selectedOut=null;if(m.selectedIn===entity.player.id)m.selectedIn=null;}
    if(state.carrier===entity){state.carrier=null;state.ball.owner=null;state.ball.currentOwner=null;}
    if(state.lastPasser===entity)state.lastPasser=null;
    if(state.chanceBuild?.carrierId===entity.player.id)state.chanceBuild=null;
    state.entities=state.entities.filter(e=>e!==entity);
    state.entitiesByTeam={belros:state.entities.filter(e=>e.team==='belros'),zafran:state.entities.filter(e=>e.team==='zafran')};
    state.entityByIdMap=new Map(state.entities.map(e=>[e.player.id,e]));
    return true;
  }
  function disciplineApplyCard(offender,decision){
    if(!offender?.player||!decision)return null;
    const ps=state.playerStats[offender.player.id]||(state.playerStats[offender.player.id]={}),ts=state.teamStats[offender.team]||blankTeamStats();
    state.teamStats[offender.team]=ts;
    const minute=Math.max(1,Math.min(90,Math.round(matchdayMinute()))),card=decision.card||'YELLOW';
    if(card==='YELLOW'){ps.yellowCards=(ps.yellowCards||0)+1;ts.yellowCards=(ts.yellowCards||0)+1;}
    else if(card==='SECOND_YELLOW'){ps.yellowCards=(ps.yellowCards||0)+1;ps.redCards=(ps.redCards||0)+1;ts.yellowCards=(ts.yellowCards||0)+1;ts.redCards=(ts.redCards||0)+1;}
    else {ps.redCards=(ps.redCards||0)+1;ts.redCards=(ts.redCards||0)+1;}
    const ev={team:offender.team==='belros'?'home':'away',playerId:offender.player.id,playerName:offender.player.name,minute,card,reason:decision.reason||'',source:'WATCH'};
    state.disciplineEvents.push(ev);recordEvent('card',{player:offender.player.name,playerId:offender.player.id,team:offender.team,card,reason:ev.reason},2.8);
    if(card==='YELLOW'){
      showBanner(`YELLOW CARD · ${offender.player.name}`,'danger',2.0);say(`${offender.player.name} goes into the referee's book.`,{priority:7,intensity:'interested',force:true,kind:'discipline'});
    }else{
      const second=card==='SECOND_YELLOW';showBanner(`${second?'SECOND YELLOW · ':''}RED CARD · ${offender.player.name}`,'danger',2.6);say(`${offender.player.name} is sent off${second?' after a second caution':''}. ${teamMeta[offender.team].name} are down a player.`,{priority:9,intensity:'excited',force:true,kind:'discipline'});disciplineSendOff(offender);
    }
    return ev;
  }

  function performFoul(offender=null){
    const victim=state.carrier;if(!victim){scheduleNext();return}offender=offender||teamEntities(other(victim.team)).slice().sort((a,b)=>dist2(a,victim)-dist2(b,victim))[0];if(!offender||dist2(offender,victim)>.13){scheduleNext(.45,.8);return}state.teamStats[offender.team].fouls++;state.playerStats[offender.player.id].fouls++;recordEvent('foul',{player:offender.player.name,team:offender.team,victim:victim.player.name},2.4);offender.form=clamp((offender.form||0)-.018,-.12,.12);offender.tx=victim.x;offender.ty=victim.y;state.ref.tx=clamp(victim.x+.025,.2,.8);state.ref.ty=clamp(victim.y-.08,.3,.7);audio.ensure();audio.foul();audio.play(audio.whistle,.62);audio.crowdHit(.15);state.camera.shake=.008;showBanner(`FOUL · ${offender.player.name}`,'danger',1.8);eventLine('foul',{offender:offender.player.name,victim:victim.player.name},offender.player,.08);
    enterReaction(offender,'arguing','ARGUING',.85+visualRandom()*.65,{victim:victim.player.id,type:personalityReaction(offender,'foulOffender',['protest','turnOpponent','raiseArm']),faceX:victim.x},ANIM_PRIORITY.ARGUING);enterReaction(victim,'frustrated','FOUL_REACTION',.65+visualRandom()*.55,{fouled:true,type:personalityReaction(victim,'foulVictim',['wobble','recoverBalance','lookOpponent']),faceX:offender.x},ANIM_PRIORITY.FOUL_REACTION);
    state.ref.reactionState='arguing';state.ref.reactionUntil=simNow()+1450;state.ref.reactionMeta={type:'warning',faceX:victim.x};
    for(const e of state.entities){if(e!==offender&&e!==victim)setPlayerAnim(e,'DECELERATING',.52,ANIM_PRIORITY.DECELERATING,{foul:true,stoppage:true})}
    const inDanger=state.zone>.60,possiblePenalty=inDanger&&state.simRand()<.62,cardDecision=disciplineCardDecision(offender,possiblePenalty);if(cardDecision)disciplineApplyCard(offender,cardDecision);
    // Natural stoppage: everybody visibly settles for ~1.5s before VAR, a penalty,
    // or a free kick is taken. `state.delay` does NOT stop the match clock.
    if(possiblePenalty && state.simRand()<.30){state.delay={t:1.55,reason:'foul-stoppage',cb:()=>startVar({kind:'foul',team:victim.team,offender,victim,possiblePenalty:true})};}
    else if(possiblePenalty){state.delay={t:1.50,reason:'foul-stoppage',cb:()=>startPenalty(victim.team,false)};}
    else {state.delay={t:1.45,reason:'foul-stoppage',cb:()=>startFreeKick(victim.team,victim)};}
  }

  function startVar(ctx){
    if(state.special)return;recordEvent('var',{team:ctx.team,kind:ctx.kind},4.0);state.special={type:'var',elapsed:0,duration:4.8,ctx,decisionShown:false};state.varContext=ctx;state.teamStats[ctx.team].var++;state.camera.tx=ctx.kind==='goal'?(ctx.team==='belros'?.54:.46):clamp((ctx.victim?.x||.5)-.5,-.04,.04)+.5;state.camera.ty=ctx.victim?.y||.52;state.camera.tz=1.075;state.ref.tx=ctx.victim?.x||((ctx.team==='belros')?.84:.16);state.ref.ty=ctx.victim?.y||.54;
    for(const e of state.entities){if((ctx.victim&&dist2(e,ctx.victim)<.24)||(ctx.shooter&&dist2(e,ctx.shooter)<.24))setPlayerAnim(e,'VAR_REACTION',Math.min(4.4,state.special.duration),ANIM_PRIORITY.VAR_REACTION,{review:true});}
    if(ctx.kind==='goal')ctx.decision=state.simRand()<.16?'NO GOAL':'GOAL CONFIRMED';else ctx.decision=state.simRand()<.66?'PENALTY':'NO FOUL';
    $('wcgVar').classList.add('is-open');$('wcgVar').classList.remove('is-decision');$('wcgVarTitle').textContent='VAR CHECK';$('wcgVarText').textContent=ctx.kind==='goal'?'Checking the scoring phase…':'Reviewing the contact in the goal area…';audio.varTone();showBanner('VAR CHECK','var',2.2);barryReaction('VAR_REACTION',8,700);say(formatLine('var'),commentaryOpts('var'));
    if(state.replayBuffer.length>=10&&state.matchTime-state.lastReplayAt>4)beginReplay('VAR REVIEW',state.replayBuffer.slice(-54),{frames:46,duration:3.0,slow:.48,introDuration:.72});
  }
  function updateVar(dt){
    const s=state.special;if(!s||s.type!=='var')return;s.elapsed+=dt;
    if(s.elapsed>2.45&&!s.decisionShown){s.decisionShown=true;$('wcgVar').classList.add('is-decision');$('wcgVarTitle').textContent=s.ctx.decision;$('wcgVarText').textContent=s.ctx.decision==='NO GOAL'?'The goal is overturned.':s.ctx.decision==='GOAL CONFIRMED'?'The goal stands.':s.ctx.decision==='PENALTY'?'Contact upgraded to a penalty.':'No punishable foul found.';audio.varTone();showBanner(s.ctx.decision,s.ctx.decision==='NO GOAL'?'danger':'var',2.0)}
    if(s.elapsed>=s.duration){const ctx=s.ctx;$('wcgVar').classList.remove('is-open','is-decision');state.special=null;state.camera.tx=.5;state.camera.ty=.5;state.camera.tz=1.02;
      if(ctx.kind==='goal'){
        if(ctx.decision==='NO GOAL'){state.score[ctx.team]=Math.max(0,state.score[ctx.team]-1);state.playerStats[ctx.shooter.player.id].goals=Math.max(0,state.playerStats[ctx.shooter.player.id].goals-1);if(ctx.assister)state.playerStats[ctx.assister.player.id].assists=Math.max(0,state.playerStats[ctx.assister.player.id].assists-1);showBanner('GOAL OVERTURNED','danger',2.0);say(`VAR overturns it. ${ctx.shooter.player.name}'s finish is wiped away and ${teamMeta[other(ctx.team)].name} restart.`,{priority:9,intensity:'excited',force:true,kind:'var'});restartAfterScore(other(ctx.team));}
        else {if(ctx.hatTrick)triggerBigMoment('hattrick');say(`Decision confirmed. ${ctx.shooter.player.name}'s goal stands.`,{priority:8,intensity:'excited',force:true,kind:'var'});restartAfterScore(other(ctx.team));}
      } else {
        if(ctx.decision==='PENALTY'){say(`The review is complete: penalty to ${teamMeta[ctx.team].name}.`,{priority:8,intensity:'excited',force:true,kind:'var'});startPenalty(ctx.team,false)}
        else {say('No penalty after review. The referee restarts play.',{priority:7,intensity:'interested',force:true,kind:'var'});setPossession(ctx.team,ctx.victim,.38);scheduleNext(.75,1.4)}
      }
    }
  }

  function startPenalty(team,shootout=false){
    if(!shootout)state.teamStats[team].penalties++;
    const players=teamEntities(team);
    const shooter=shootout&&state.shootout
      ?players[(state.shootout.attempts[team]||0)%Math.max(1,players.length)]
      :(players[Math.floor((state.simRand?.()||Math.random())*Math.max(1,players.length))]||players[0]);
    state.special={type:'penalty',elapsed:0,team,shooter,shootout,shot:false};
    if(!shootout)triggerBigMoment('penalty');
    const dir=teamMeta[team].attack;shooter.tx=team==='belros'?.72:.28;shooter.ty=.52;setPlayerAnim(shooter,'DECELERATING',.55,ANIM_PRIORITY.DECELERATING,{setPiece:true});teamEntities(team).filter(e=>e!==shooter).forEach((e,i)=>{e.tx=.5-dir*.08;e.ty=.39+i*.24;setPlayerAnim(e,'IDLE',1.35,ANIM_PRIORITY.IDLE,{setPiece:true})});teamEntities(other(team)).forEach((e,i)=>{e.tx=.5+dir*.08;e.ty=.39+i*.12});state.ref.tx=.5;state.ref.ty=.42;state.camera.tx=team==='belros'?.535:.465;state.camera.ty=.52;state.camera.tz=1.06;showBanner(shootout?'SHOOTOUT PENALTY':`PENALTY · ${teamMeta[team].name}`,'danger',2.0);eventLine('penalty',{team:teamMeta[team].name,pet:shooter.player.name},shooter.player,.06);audio.ensure();audio.play(audio.whistle,.55);
  }
  function updatePenalty(dt){
    const s=state.special;if(!s||s.type!=='penalty')return;s.elapsed+=dt;
    if(s.elapsed>=1.45&&!s.shot){s.shot=true;const shooter=s.shooter,team=s.team,shootout=s.shootout;state.special=null;state.carrier=shooter;state.possession=team;performShot({shooter,team,penalty:true,shootout});}
  }

  function carrierTackleQuality(defender,carrier){
    if(!state.careerMode)return{attempt:0,success:0};
    const defence=executionSkill(defender.attributes,'interception')*.65+executionSkill(defender.attributes,'reaction')*.35;
    const control=executionSkill(carrier.attributes,'catching')*.65+executionSkill(carrier.attributes,'composure')*.35;
    return {attempt:(defence-.86)*.35,success:(defence-control)*.85};
  }
  function attemptCarrierTackle(defender,carrier){
    if(!defender||!carrier||defender.team===carrier.team||state.ball.flight||state.special||state.delay)return false;
    const gap=dist2(defender,carrier);
    if(gap>.103)return false;
    // Symmetric physical window: defensive technique contests ball control.
    // Proximity and closing remain necessary; no role or team gets a fixed bonus.
    const rvx=(defender.vx||0)-(carrier.vx||0),rvy=(defender.vy||0)-(carrier.vy||0),dx=carrier.x-defender.x,dy=carrier.y-defender.y;
    const rel=Math.hypot(rvx,rvy),d=Math.max(.001,Math.hypot(dx,dy));
    const closing=rel>.001?clamp((rvx*dx+rvy*dy)/(rel*d),-1,1):0;
    const skill=carrierTackleQuality(defender,carrier);
    const attemptP=clamp(.235+(.103-gap)*2.95+Math.max(0,closing)*.130+skill.attempt,state.careerMode?.14:.19,state.careerMode?.64:.57);
    if(state.simRand()>=attemptP)return false;
    state.teamStats[defender.team].tacklesAttempted++;state.playerStats[defender.player.id].tacklesAttempted++;
    defender.intent='tackle';defender.tx=safeX(lerp(defender.x,carrier.x,.82));defender.ty=safeY(lerp(defender.y,carrier.y,.82));
    setPlayerAnim(defender,'INTERCEPTING',.42,ANIM_PRIORITY.INTERCEPTING,{tackle:true,target:carrier.player.id});
    setPlayerAnim(carrier,'RECOVERING',.34,ANIM_PRIORITY.RECOVERING,{underTackle:true,from:defender.player.id});
    const successP=clamp(.285+(.075-gap)*3.70+Math.max(0,closing)*.110+skill.success,state.careerMode?.12:.22,state.careerMode?.72:.59);
    const won=gap<.078&&state.simRand()<successP;audio.challenge(won);
    if(won){
      const oldTeam=carrier.team,newTeam=defender.team;
      state.teamStats[newTeam].tacklesWon++;state.playerStats[defender.player.id].tacklesWon++;
      state.teamStats[newTeam].interceptions++;state.playerStats[defender.player.id].interceptions++;
      recordEvent('intercept',{player:defender.player.name,team:newTeam,from:carrier.player.name,tackle:true},3.0);
      audio.steal();audio.crowdHit(.11);showBanner(`TACKLE · ${defender.player.name}`,'',1.35);
      eventLine('intercept',{pet:defender.player.name,from:carrier.player.name},defender.player,.16);
      enterReaction(carrier,'recovering','RECOVERING',.48,{tackled:true,faceX:defender.x},ANIM_PRIORITY.RECOVERING);
      reactToInterception(defender,carrier);
      setFlowPhase(FLOW_PHASES.TURNOVER,'tackle turnover');noteFlowMajor('tackle');
      setPossession(newTeam,defender,.16);scheduleNext(.58,1.05);return true;
    }
    // Failed tackle is still visible and briefly opens the lane; possession is unchanged.
    defender.intent='recover';defender.tx=safeX(defender.x-teamMeta[defender.team].attack*.025);defender.ty=safeY(defender.y+(defender.flowSign||1)*.035);
    setPlayerAnim(defender,'RECOVERING',.46,ANIM_PRIORITY.RECOVERING,{missedTackle:true});
    return false;
  }

  function nextAction(){
    if(state.phase!=='first'&&state.phase!=='second')return;if(state.special||state.delay||state.ball.flight)return;
    if(!state.carrier){if(state.possession)setPossession(state.possession,weightedPlayer(state.possession),.15);else{flowScheduleNext(.35,.65);return}}
    updateMatchFlowDirector(0);updateTeamTacticalDirector(0,true);
    const carrier=state.carrier,team=carrier.team,tt=state.teamTactics?.[team]||{state:'BUILDUP',risk:.5},nearestDef=teamEntities(other(team)).slice().sort((a,b)=>dist2(a,carrier)-dist2(b,carrier))[0],contact=nearestDef?dist2(nearestDef,carrier):1,aggr=nearestDef?.attributes?.aggression||.7;
    // Let close defensive pressure become a visible broom-to-broom tackle/steal before
    // ordinary pass/drive selection. Same rules for both teams.
    if(nearestDef&&attemptCarrierTackle(nearestDef,carrier))return;
    const foulChance=contact<.09?clamp(.012+(aggr-.65)*.09+Math.max(0,.05-contact)*.8,.005,.075):0;
    if(foulChance&&state.simRand()<foulChance){setFlowPhase(FLOW_PHASES.STOPPAGE,'foul');noteFlowMajor('foul');performFoul(nearestDef);return}
    const pressure=clamp((.15-contact)/.15,0,1),flow=flowActionWeights(),phase=state.matchFlow?.currentPhase;
    // Shot selection now obeys the same side-neutral final-third gate as performShot().
    // Outside a genuine shooting position the team must keep carrying/passing instead
    // of repeatedly winding up speculative own-half or halfway-line attempts.
    const traitChoice=state.careerMode?window.VelmoraTraits?.effects(carrier.player.playingTraits,v48TraitContext(carrier,{pressure:contact}))||{}:{};
    const traitBias=(traitChoice.passBias||0)-(traitChoice.driveBias||0);
    let shotW=flow.shot,driveW=Math.max(.05,flow.drive-traitBias),passW=Math.max(.05,flow.pass+traitBias);
    const profile=tt.profile||tacticalProfileForTeam(team),adjustment=tt.adjustment||tacticalAdjustmentForTeam(team);
    // Tactical identities never alter the shot share. A tiny, zero-sum pass/carry
    // reallocation gives them different buildup texture without adding chances.
    const buildBias=clamp((profile.passBias||0)+(adjustment.passBias||0),-.035,.035);
    passW=Math.max(.05,passW+buildBias);driveW=Math.max(.05,driveW-buildBias);
    const shotReady=openPlayShotAllowed(carrier);
    if(!shotReady){
      shotW=0;
      const early=state.zone<.55;
      passW+=early?.10:.075;
      driveW+=early?.075:.055;
    }else if(phase===FLOW_PHASES.FINAL_THIRD){
      shotW+=Math.min(.11,state.passesSinceShot*.026);
    }

    // Test 29: gently favour a little combination play before the first shot.
    // This is deliberately NOT a forced-pass rule: early shots and fast counters
    // can still happen, they are simply less repetitive than "receive -> shoot".
    const chain=state.passesSinceShot||0,fastCounter=phase===FLOW_PHASES.COUNTER&&(state.matchFlow?.possessionElapsed||0)<2.4;
    if(chain===0){
      shotW*=fastCounter?.82:.64;
      passW+=fastCounter?.025:.070;
      driveW+=fastCounter?.015:.020;
    }else if(chain===1){
      shotW*=fastCounter?.92:.82;
      passW+=fastCounter?.012:.034;
      driveW+=.012;
    }

    // The anti-pass-loop still starts after two completed passes, so the extra
    // teamwork does not turn into endless circulation.
    if(state.zone>=.40&&state.passesSinceShot>=2){
      const extra=Math.min(4,state.passesSinceShot-1);
      shotW+=extra*.024;
      driveW+=extra*.022;
      passW*=Math.max(.50,1-extra*.085);
    }
    if(state.passesSinceShot>=4){shotW+=.045;driveW+=.030;passW*=.74}
    if(state.passesSinceShot>=6){shotW+=.040;passW*=.70}

    // Heavy pressure can still prompt a safety pass, but much less strongly.
    if(contact<.07){passW+=.025;driveW=Math.max(.08,driveW-.005)}
    const total=shotW+driveW+passW,r=state.simRand()*total;
    if(state.matchFlow)state.matchFlow.actionIndex++;
    if(r<shotW){beginBigChance(carrier);return}
    if(r<shotW+driveW){performDrive();return}
    performPass();
  }

  function beginKickoff(team,second=false){
    state.phase=second?'second':'first';state.half=second?2:1;const skipBroadcast=$('wcgSkipBroadcast');if(skipBroadcast)skipBroadcast.hidden=true;if(!state.matchFlow)initMatchFlowDirector();setFlowPhase(FLOW_PHASES.RESTART,'kickoff');chooseFlowTemplate(false);setBroadcastState('LIVE');const receiver=teamEntities(team)[second?1:0];state.possession=team;state.carrier=null;state.kickoffReceiver=receiver;state.kickoffWatchdog=1.65;state.zone=.12;state.passesSinceShot=0;state.lastPasser=null;state.camera.tx=.5;state.camera.ty=.5;state.camera.tz=1.015;audio.ensure();try{
      // The pre-match drums end the instant live play begins.
      if(audio.prematch){audio.prematch.pause();audio.prematch.currentTime=0;audio.prematch.volume=0}
      if(audio.crowd)audio.crowd.volume=state.crowdBase
    }catch(_){}audio.play(audio.whistle,.62);audio.startMatchMusic();audio.crowdHit(.16);showBanner(second?'SECOND HALF · PLAY!':'QUILL ON!','',1.8);say(formatLine('kickoff'),commentaryOpts('kickoff'));
    for(const e of state.entities)setPlayerAnim(e,'ACCELERATING',.72,ANIM_PRIORITY.ACCELERATING,{kickoff:true});
    const refPoint=refStandingBallPoint();
    const from=second?{x:refPoint.x,y:refPoint.y}:{x:state.ball.x||.5,y:state.ball.y||.535};
    receiver.intent='receive';receiver.tx=safeX(.5+(team==='belros'?-.025:.025));receiver.ty=.575;setPlayerAnim(receiver,'RECEIVING',1.0,ANIM_PRIORITY.RECEIVING,{kickoff:true});state.ball.visible=true;
    if(second)showBanner('REFEREE RELEASES THE QUAFFLE','',1.1);
    startFlight(from,{x:receiver.tx,y:receiver.ty},second?.88:.78,-.04,()=>{state.kickoffReceiver=null;audio.catchBall('kickoff');setPossession(team,receiver,.12);scheduleNext(.75,1.3)},{kind:'kickoff',receiver});
  }

  function beginHalftime(){
    if(state.phase==='halftime')return;applyHalftimeTacticalAdjustments();state.phase='halftime';state.chanceBuild=null;for(const e of state.entities)setPlayerAnim(e,'HALFTIME',3.0,ANIM_PRIORITY.HALFTIME,{halftime:true});state.special=null;state.delay=null;state.ball.flight=null;state.carrier=null;state.ball.visible=false;state.halftimeElapsed=0;state.halftimeReady=false;setBroadcastSequence('halftimeTransition',{frozen:true});state.halftimeWaitSlide=-1;setBroadcastState('HALFTIME');audio.ensure();audio.pauseMatchMusic();audio.play(audio.whistle,.55);barryReaction('HALFTIME',7,1500);say(formatLine('halftime'),commentaryOpts('halftime'));showBanner('HALF TIME','',2.2);$('wcgHalftime').classList.remove('is-open');const bx=[.29,.36,.43],zx=[.71,.64,.57];teamEntities('belros').forEach((e,i)=>{e.tx=bx[i];e.ty=fixtureGroundY()});teamEntities('zafran').forEach((e,i)=>{e.tx=zx[i];e.ty=fixtureGroundY()});state.ref.tx=.5;state.ref.ty=fixtureGroundY();state.camera.tx=.5;state.camera.ty=.54;state.camera.tz=.985;if(state.management){state.halftimeReady=true;matchdayProcessPending();matchdayAiChanges(true);hidePresentation();if(!state.management.autoFinish)matchdayShow()}else updateHalftimePresentation(0);
  }
  async function continueSecondHalf(){
    if(state.management){matchdayResume();return}
    if(!isHost()||state.phase!=='halftime'||!state.halftimeReady)return;await sendMatch('second-half',{host:'CatAsthma',at:Date.now()});handleSecondHalf();
  }
  function handleSecondHalf(){
    if(state.phase!=='halftime')return;if(state.management&&!state.management.halftimeRecovered){for(const r of Object.values(state.management.players))if(r.active)r.energy=Math.min(r.initialEnergy,r.energy+5);state.management.halftimeRecovered=true}for(const e of state.entities){e.fatigue*=.28;e.form*=.82;e.vx*=.25;e.vy*=.25}$('wcgHalftime').classList.remove('is-open');state.phase='secondcountdown';state.secondCountdown=3.05;setBroadcastState('SECOND_HALF_COUNTDOWN');state.ball.visible=true;const h=refStandingBallPoint();state.ball.x=h.x;state.ball.y=h.y;updateSecondHalfCountdown(0);
  }

  function beginShootout(){
    if(state.phase==='shootout'||state.phase==='fulltime')return;
    const first=state.simRand()<.5?'belros':'zafran',second=other(first);
    state.phase='shootout';
    state.shootout={score:{belros:0,zafran:0},attempts:{belros:0,zafran:0},turn:0,order:[first,second],round:0};
    state.special=null;state.delay={t:2.0,cb:shootoutNext};
    setBroadcastState('PENALTY_SHOOTOUT');
    showBanner('PENALTY SHOOTOUT','var',2.4);
    say(`Four minutes thirty cannot separate them. ${teamMeta[first].name} won the toss and will take the first penalty.`);
    audio.ensure();audio.startMatchMusic();audio.play(audio.whistle,.6);
  }
  function shootoutNext(){
    const so=state.shootout;if(!so)return;const team=so.order[so.turn%2];const attemptsA=so.attempts.belros,attemptsB=so.attempts.zafran;
    if(attemptsA>=3&&attemptsB>=3&&attemptsA===attemptsB&&so.score.belros!==so.score.zafran){finishMatch(true);return}
    if(attemptsA>=3&&attemptsB>=3&&Math.abs(attemptsA-attemptsB)===0&&so.score.belros===so.score.zafran){/* sudden death continues */}
    startPenalty(team,true);
  }
  function resolveShootoutPenalty(team,scored,shooter){
    const so=state.shootout;if(!so)return;so.attempts[team]++;if(scored){so.score[team]++;playV2NametagGoalEffect(shooter.player.id);audio.ensure();/* Shootouts deliberately use a restrained score cue: repeated full stadium goal roars become exhausting across long penalty sequences. */audio.play(audio.goal,.24);audio.crowdHit(.11);showBanner(`PENALTY SCORED · ${shooter.player.name}`,'',1.8);say(`${shooter.player.name} scores in the shootout. ${so.score.belros}-${so.score.zafran} on penalties.`)}else{showBanner(`PENALTY MISSED · ${shooter.player.name}`,'danger',1.8);say(`${shooter.player.name} cannot convert. The shootout remains ${so.score.belros}-${so.score.zafran}.`)}
    so.turn++;
    const a=so.attempts.belros,b=so.attempts.zafran,sa=so.score.belros,sb=so.score.zafran;
    // Early mathematical finish during first three each.
    if(a<=3&&b<=3){const remA=3-a,remB=3-b;if(sa>sb+remB||sb>sa+remA){state.delay={t:2.2,cb:()=>finishMatch(true)};return}}
    if(a>=3&&b>=3&&a===b&&sa!==sb){state.delay={t:2.2,cb:()=>finishMatch(true)};return}
    state.delay={t:2.2,cb:shootoutNext};
  }

  function formatPossessionTime(seconds){
    const s=Math.max(0,Math.round(Number(seconds)||0)),m=Math.floor(s/60),r=s%60;
    return m?`${m}:${String(r).padStart(2,'0')}`:`${s}s`;
  }
  function fulltimePlayerCard(p,team,mvpId=''){
    const s=state.playerStats[p.id]||{},teamPoss=Math.max(.001,state.teamStats[team]?.possession||0);
    const possShare=Math.round((s.possession||0)/teamPoss*100),minutes=state.management?Math.round(state.management.players[p.id].seconds/MATCH_SECONDS*90):90;
    const isMvp=String(p.id)===String(mvpId),portrait=p.standing?`<img src="${p.standing}" alt="" loading="lazy">`:`<span>${String(p.name||'?').slice(0,1)}</span>`;
    return `<article class="wcg-v2-player-card wcg-v30-player-card ${team}${isMvp?' is-mvp':''}">
      <div class="wcg-v30-player-portrait">${portrait}${isMvp?'<b>POTM</b>':''}</div>
      <header><small>${String(p.role||'PLAYER').toUpperCase()} · ${minutes} MIN</small><b>${p.name}</b></header>
      <div class="wcg-v2-player-metrics wcg-v2-clean-player-metrics wcg-v30-player-metrics">
        <div><small>GOALS</small><strong>${s.goals||0}</strong></div>
        <div><small>SHOTS</small><strong>${s.shots||0}</strong></div>
        <div><small>TACKLES</small><strong>${s.tacklesWon||0}</strong></div>
        <div><small>POSSESSION</small><strong>${possShare}%</strong></div>
      </div>
    </article>`;
  }
  function populateFulltimePanel(data){
    const {draw,winner,mvp,fromShootout,so}=data;
    const homeName=teamMeta.belros.name,awayName=teamMeta.zafran.name;
    const title=draw?'HONOURS EVEN':`${teamMeta[winner].name} TAKE THE WIN`;
    $('wcgFullTitle').textContent=title;
    $('wcgFullSubtitle').textContent=fixtureVenue();
    $('wcgFullScore').textContent=`${state.score.belros}–${state.score.zafran}`;
    const decision=$('wcgFullDecision');if(decision)decision.textContent=fromShootout&&so?`PENALTIES · ${so.score.belros}–${so.score.zafran}`:(draw?'POINTS SHARED':'FINAL SCORE');
    const competition=$('wcgFullCompetition');if(competition)competition.textContent=String(state.fixture?.stage||'CAREER FIXTURE').toUpperCase();
    const matchNote=$('wcgFullMatchNote');if(matchNote)matchNote.textContent=fromShootout?'DECIDED ON PENALTIES':draw?'MATCH DRAWN':`${teamMeta[winner].name} WIN`;
    const homeTeam=$('wcgFullHomeTeam'),awayTeam=$('wcgFullAwayTeam');if(homeTeam)homeTeam.textContent=homeName;if(awayTeam)awayTeam.textContent=awayName;
    const homeBadge=$('wcgFullHomeBadge'),awayBadge=$('wcgFullAwayBadge');
    if(homeBadge){homeBadge.src=teamMeta.belros.flag||'';homeBadge.alt=`${homeName} badge`;homeBadge.style.display=teamMeta.belros.flag?'':'none';}
    if(awayBadge){awayBadge.src=teamMeta.zafran.flag||'';awayBadge.alt=`${awayName} badge`;awayBadge.style.display=teamMeta.zafran.flag?'':'none';}

    const a=state.teamStats.belros,b=state.teamStats.zafran;
    const possTotal=Math.max(.001,a.possession+b.possession),pa=Math.round(a.possession/possTotal*100),pb=100-pa;
    const passA=a.passes?Math.round(a.completed/a.passes*100):0,passB=b.passes?Math.round(b.completed/b.passes*100):0;
    const rows=[
      {label:'SHOTS',home:a.shots,away:b.shots,hv:a.shots,av:b.shots},
      {label:'SHOTS ON TARGET',home:a.onTarget,away:b.onTarget,hv:a.onTarget,av:b.onTarget},
      {label:'POSSESSION',home:`${pa}%`,away:`${pb}%`,hv:pa,av:pb},
      {label:'PASS COMPLETION',home:`${passA}%`,away:`${passB}%`,hv:passA,av:passB},
      {label:'TACKLES WON',home:a.tacklesWon,away:b.tacklesWon,hv:a.tacklesWon,av:b.tacklesWon},
      {label:'INTERCEPTIONS',home:a.interceptions,away:b.interceptions,hv:a.interceptions,av:b.interceptions},
      {label:'FOULS',home:a.fouls,away:b.fouls,hv:a.fouls,av:b.fouls},
      {label:'VAR REVIEWS',home:a.var,away:b.var,hv:a.var,av:b.var}
    ];
    $('wcgFullStats').innerHTML=rows.map(row=>{
      const total=Math.max(.001,Number(row.hv||0)+Number(row.av||0)),homeShare=total<=.001?50:Math.round(Number(row.hv||0)/total*100),awayShare=100-homeShare;
      return `<article class="wcg-v30-stat-card"><b>${row.home}</b><div><span>${row.label}</span><div class="wcg-v30-stat-track"><i class="home" style="--stat:${homeShare}%"></i><i class="away" style="--stat:${awayShare}%"></i></div></div><strong>${row.away}</strong></article>`;
    }).join('');

    const players=$('wcgFullPlayers');
    if(players){
      const teamSection=(team,label,badge)=>`<section class="wcg-v2-player-team wcg-v30-player-team ${team}"><header class="wcg-v30-player-team-head"><div class="wcg-v30-mini-badge">${badge?`<img src="${badge}" alt="">`:''}</div><div><small>${label}</small><h4>${teamMeta[team].name}</h4></div></header><div class="wcg-v30-team-player-list">${matchdayTeamPlayers(team,true).map(p=>fulltimePlayerCard(p,team,mvp.id)).join('')}</div></section>`;
      players.innerHTML=teamSection('belros','HOME SQUAD',teamMeta.belros.flag)+teamSection('zafran','AWAY SQUAD',teamMeta.zafran.flag);
    }

    const ms=state.playerStats[mvp.id]||{},mvpTeam=matchdayTeamPlayers('belros').some(p=>p.id===mvp.id)?'belros':'zafran';
    const mvpPoss=Math.round((ms.possession||0)/Math.max(.001,state.teamStats[mvpTeam]?.possession||0)*100),mvpEl=$('wcgMvp');
    if(mvpEl)mvpEl.innerHTML=`<div class="wcg-v30-mvp-portrait">${mvp.standing?`<img src="${mvp.standing}" alt="">`:''}</div><div><span>PLAYER OF THE MATCH</span><strong>${mvp.name}</strong><small>${ms.goals||0} goals · ${ms.shots||0} shots · ${ms.tacklesWon||0} tackles · ${mvpPoss}% possession</small></div>`;
    const pred=$('wcgFullPrediction');
    if(pred){pred.textContent=state.careerMode?'WATCH MATCH · LIVE ENGINE RESULT':(state.prediction.rewardMessage||'PREDICTION RESULT CALCULATING…');pred.hidden=state.careerMode;}
    const reportScroll=$('wcgFulltime')?.querySelector('.wcg-v30-report-scroll'),reportPanel=$('wcgFulltime')?.querySelector('.wcg-v2-fulltime-panel');
    if(reportScroll)reportScroll.scrollTop=0;if(reportPanel)reportPanel.scrollTop=0;
  }

  function finishMatch(fromShootout=false){
    if(state.phase==='fulltime')return;
    const so=state.shootout;
    const regulationDraw=state.score.belros===state.score.zafran;
    const winner=fromShootout&&so
      ?(so.score.belros>so.score.zafran?'belros':'zafran')
      :(regulationDraw?null:(state.score.belros>state.score.zafran?'belros':'zafran'));
    const draw=!fromShootout&&regulationDraw;
    state.phase='fulltime';state.chanceBuild=null;state.special=null;state.delay=null;state.ball.flight=null;state.carrier=null;state.ball.visible=false;state.fulltimeElapsed=0;
    setBroadcastState('FULL_TIME');setBroadcastSequence('fullTimeWhistle',{frozen:true});audio.ensure();audio.pauseMatchMusic();audio.play(audio.whistle,.65);barryReaction('FULLTIME',9,1800);
    if(fromShootout&&so)say(`${teamMeta[winner].name} win the penalty shootout ${so.score.belros}-${so.score.zafran}.`,{priority:10,intensity:'excited',force:true,kind:'fulltime'});
    else say(formatLine('fulltime'),commentaryOpts('fulltime'));
    showBanner(fromShootout?'SHOOTOUT COMPLETE':'FULL TIME','',2.4);
    const mvp=playerOfPeriod(null);state.fulltimeData={fromShootout,draw,winner,so:fromShootout?so:null,mvp};if(state.headless||state.careerMode)populateFulltimePanel(state.fulltimeData);else void resolvePredictionReward().finally(()=>populateFulltimePanel(state.fulltimeData));
    if(draw){
      for(const e of state.entities){e.tx=safeX(e.team==='belros'?.38:.62);e.ty=safeY(.40+teamEntities(e.team).indexOf(e)*.11);setPlayerAnim(e,'FULLTIME',2.4,ANIM_PRIORITY.FULLTIME,{draw:true})}
    }else{
      const losers=other(winner),hero=teamEntities(winner).slice().sort((a,b)=>impactFor(b.player)-impactFor(a.player))[0]||teamEntities(winner)[0];
      teamEntities(winner).forEach((e,i)=>{e.tx=safeX(hero.x-teamMeta[winner].attack*(.025+i*.035));e.ty=safeY(hero.y+(i-1)*.055);e.celebrate=6;setPlayerAnim(e,'CELEBRATING',5.8,ANIM_PRIORITY.CELEBRATING,{fulltime:true,hero:e===hero})});
      teamEntities(losers).forEach((e,i)=>{e.tx=safeX(lerp(e.x,losers==='belros'?.32:.68,.24));e.ty=safeY(.40+i*.12);setPlayerAnim(e,'DISAPPOINTED',2.2,ANIM_PRIORITY.DISAPPOINTED,{fulltime:true})});
    }
    state.camera.tx=.5;state.camera.ty=.53;state.camera.tz=.98;populateFulltimePanel(state.fulltimeData);updateFulltimePresentation(0);
  }

  function adminEnabled(){return true}
  function skipToHalftime(){if(!adminEnabled()||state.phase!=='first')return;state.matchTime=HALF_SECONDS;beginHalftime()}
  function previewAdminEvent(kind){
    if(!adminEnabled())return;
    const scorer=state.carrier||rolePlayer('belros','attacker'), defender=rolePlayer(other(scorer.team),'defender');
    const team=kind==='goal'?'belros':scorer.team, teamName=teamMeta[team].name;
    const messages={goal:[`GOAL · ${scorer.player.name} · TEST`,''],save:[`SAVE · ${defender.player.name} · TEST`,''],miss:[`MISS · ${scorer.player.name} · TEST`,''],post:['OFF THE RING! · TEST','danger'],foul:[`FOUL · ${defender.player.name} · TEST`,'danger'],penalty:[`PENALTY · ${teamName} · TEST`,'danger'],hattrick:[`HAT TRICK · ${scorer.player.name} · TEST`,''],penaltypopup:[`PENALTY POPUP · ${teamName} · TEST`,'danger'],var:['VAR CHECK · TEST','var'],intercept:[`INTERCEPTION · ${defender.player.name} · TEST`,'']};
    const [text,type]=messages[kind]||['EVENT TEST',''];
    if(kind==='goal'){audio.ensure();audio.play(audio.goal,.7);audio.crowdHit(.50);beginGoalCelebration(team,scorer,other(team),null,true)}
    if(kind==='hattrick')triggerBigMoment('hattrick');
    if(kind==='penaltypopup')triggerBigMoment('penalty');
    if(kind==='foul'||kind==='penalty'){audio.ensure();audio.play(audio.whistle,.62);state.camera.shake=.009}
    if(kind==='save'||kind==='miss'||kind==='post'||kind==='intercept'){audio.crowdHit(.18);state.camera.shake=.006}
    showBanner(text,type,2.0);say(kind==='goal'?`TEST EVENT: ${scorer.player.name} scores for ${teamName}.`:kind==='foul'?'TEST EVENT: referee whistles for a foul.':kind==='penalty'?`TEST EVENT: penalty awarded to ${teamName}.`:kind==='var'?'TEST EVENT: VAR review is now on screen.':`TEST EVENT: ${text.toLowerCase()}.`);
    if(kind==='var'){const box=$('wcgVar');box.classList.add('is-open');box.classList.remove('is-decision');$('wcgVarTitle').textContent='VAR CHECK';$('wcgVarText').textContent='ADMIN PREVIEW · Reviewing the incident…';setTimeout(()=>{if(!state.open||!adminEnabled())return;box.classList.add('is-decision');$('wcgVarTitle').textContent='GOAL CONFIRMED';$('wcgVarText').textContent='ADMIN PREVIEW · The decision stands.'},1450);setTimeout(()=>box.classList.remove('is-open','is-decision'),3000)}
  }

  function updateIntro(dt){tickBroadcastSequence(dt);
    const a=audio.prematch;state.introElapsed=clamp(state.introElapsed+dt,0,INTRO_SECONDS);if(!state.headless&&!state.careerMode)void refreshPredictionCounts(false);
    const cue=Math.floor(state.introElapsed/6);if(cue!==state.introCue&&cue<5){state.introCue=cue;say(commentary.intro[Math.min(cue,commentary.intro.length-1)]);if(cue===1){state.camera.tx=.46;state.camera.tz=1.035}else if(cue===2){state.camera.tx=.54;state.camera.tz=1.035}else if(cue===3){state.camera.tx=.5;state.camera.ty=.56;state.camera.tz=1.045}else{state.camera.tx=.5;state.camera.ty=.5;state.camera.tz=1.005}}
    if(!state.careerMode)maybeTriggerRecordedPrematchIntro();updatePrematchPresentation();updateKickoffToss(dt);if(state.introElapsed>=INTRO_SECONDS-.02)completePrematch();
  }

  function updateDelay(dt){if(!state.delay)return;state.delay.t-=dt;if(state.delay.t<=0){const cb=state.delay.cb;state.delay=null;cb?.()}}

  function updateMatchDirector(dt){
    const d=state.director||(state.director={phase:'BUILD-UP',momentum:{belros:0,zafran:0},pressure:{belros:0,zafran:0},recent:[],pulse:0});
    d.pulse-=dt;if(d.pulse>0)return;d.pulse=.32;
    const carrier=state.carrier,flight=state.ball.flight,zone=state.zone||.15;
    if(flight?.meta?.kind==='pass')d.phase='ATTACK';
    else if(state.special?.type==='penalty')d.phase='SET PIECE';
    else if(state.celebration)d.phase='RESET';
    else if(simNow()-(state.possessionChangedAt||0)<1800)d.phase='COUNTERATTACK';
    else if(state.possession&&state.teamTactics?.[other(state.possession)]?.state==='PRESSING'&&zone<.66)d.phase='DEFENSIVE PRESSURE';
    else if(zone>.66)d.phase='GOAL CHANCE';
    else if(zone>.42)d.phase='ATTACK';
    else d.phase='BUILD-UP';
    for(const team of ['belros','zafran']){
      const st=state.teamStats[team],opp=state.teamStats[other(team)];
      const raw=(st.completed-opp.completed)*.012+(st.interceptions-opp.interceptions)*.06+(st.shots-opp.shots)*.045+(state.score[team]-state.score[other(team)])*.08;
      d.momentum[team]=lerp(d.momentum[team],clamp(raw,-.32,.32),.18);
      d.pressure[team]=lerp(d.pressure[team],carrier&&carrier.team!==team?clamp(zone,.1,.95):.12,.22);
    }
    for(const e of state.entities){
      const a=e.attributes||{};const halfProgress=clamp((state.matchTime%(HALF_SECONDS||540))/HALF_SECONDS,0,1);
      e.fatigue=state.management?clamp((100-state.management.players[e.player.id].energy)*.004,0,.38):clamp(halfProgress*(1-(a.stamina||.9))*.34 + (state.half===2?.025:0),0,.10);
      e.form=clamp(e.form*.985,-.12,.12);
    }
  }

  function nearestOpponent(e){return teamEntities(other(e.team)).slice().sort((a,b)=>dist2(e,a)-dist2(e,b))[0]||null}
  function assignMarks(defTeam,attackers,carrier){
    const defenders=teamEntities(defTeam),available=attackers.filter(a=>a!==carrier);
    defenders.forEach(d=>d.mark=null);
    const flowPhase=state.matchFlow?.currentPhase,advanced=!!carrier&&(state.zone>.56||flowPhase===FLOW_PHASES.FINAL_THIRD||flowPhase===FLOW_PHASES.SHOT_SEQUENCE||!!state.chanceBuild);
    const goalProtector=advanced?rolePlayer(defTeam,'defender'):null;
    const pressPool=goalProtector?defenders.filter(d=>d!==goalProtector):defenders;
    const presser=carrier?(pressPool.length?pressPool:defenders).slice().sort((a,b)=>(dist2(a,carrier)-.020*(a.attributes?.aggression||.7))-(dist2(b,carrier)-.020*(b.attributes?.aggression||.7)))[0]:null;
    if(presser)presser.mark=carrier;
    if(goalProtector)goalProtector.mark=carrier;
    const rest=defenders.filter(d=>d!==presser&&d!==goalProtector),danger=available.slice().sort((a,b)=>{const sa=state.playerStats[a.player.id]||{},sb=state.playerStats[b.player.id]||{};const da=(sa.goals||0)*.12+(sa.shots||0)*.025+(a.attributes?.shooting||.8)*.08,db=(sb.goals||0)*.12+(sb.shots||0)*.025+(b.attributes?.shooting||.8)*.08;return db-da}) ;
    rest.forEach(d=>{const candidates=danger.filter(a=>!rest.some(x=>x!==d&&x.mark===a));d.mark=(candidates.length?candidates:danger).slice().sort((a,b)=>dist2(d,a)-dist2(d,b))[0]||carrier||null});
  }

  function passingLaneRisk(from,to,defTeam){
    const vx=to.x-from.x,vy=to.y-from.y,len2=vx*vx+vy*vy||.0001;
    let risk=0;
    for(const d of teamEntities(defTeam)){
      const q=clamp(((d.x-from.x)*vx+(d.y-from.y)*vy)/len2,0,1),px=from.x+vx*q,py=from.y+vy*q;
      const lane=Math.hypot(d.x-px,d.y-py),aw=d.attributes?.awareness||.85;
      risk=Math.max(risk,clamp((.18-lane)*4.2*aw,0,.72));
    }
    return risk;
  }

  function chooseSupportTarget(e,carrier,ballFuture,slot){
    const dir=teamMeta[e.team].attack,a=e.attributes||{},creative=e.personality==='creative';
    const ahead=slot===0 ? (.105+.035*a.anticipation) : (.025+.025*a.positioning);
    const width=(slot===0?-1:1)*(.125+.045*a.positioning);
    let x=ballFuture.x+dir*ahead,y=ballFuture.y+width;
    // Creative/support players occasionally cross or make a decoy run, but only when there is room.
    if(creative&&state.simRand()<.11){y=ballFuture.y-width*.72;x+=dir*.035}
    const nearest=nearestOpponent(e);if(nearest&&dist2({x,y},nearest)<.10)y+=Math.sign(y-nearest.y||1)*.055;
    return {x:safeX(x),y:safeY(y)};
  }

  function tacticalTarget(e,x,y,intent,force=false){
    x=safeX(x);y=safeY(y);e.desiredTx=x;e.desiredTy=y;if(intent)e.intent=intent;
    const blend=force?.78:.42;e.tx=lerp(Number.isFinite(e.tx)?e.tx:e.x,x,blend);e.ty=lerp(Number.isFinite(e.ty)?e.ty:e.y,y,blend);
  }

  function refreshMovementTargets(force=false){
    if(state.phase!=='first'&&state.phase!=='second')return;
    updateTeamTacticalDirector(0,force);
    const ball=state.ball.flight?state.ball:(state.carrier||state.ball||{x:.5,y:.5,vx:0,vy:0});
    const poss=state.possession,carrier=state.carrier;
    if(!poss){
      const predict=.14, bx=safeX(ball.x+(ball.vx||0)*predict),by=safeY(ball.y+(ball.vy||0)*predict);
      for(const team of ['belros','zafran']){
        const tt=state.teamTactics[team],players=teamEntities(team),ordered=players.slice().sort((a,b)=>Math.hypot(a.x-bx,a.y-by)-Math.hypot(b.x-bx,b.y-by));
        ordered.forEach((e,i)=>{
          const role=tt?.responsibilities?.[e.player.id]||(['SECOND_BALL','SUPPORT_COVER','COVER'][i]);
          if(role==='SECOND_BALL')tacticalTarget(e,bx+(e.x<bx?-.010:.010),by,'recover',force);
          else if(role==='SUPPORT_COVER'){const ownGoal=team==='belros'?.10:.90;tacticalTarget(e,lerp(bx,ownGoal,.11),by+(e.flowSign||1)*.085,'cover',force)}
          else {const ownGoal=team==='belros'?.10:.90;tacticalTarget(e,lerp(bx,ownGoal,.25),clamp(.5+(e.flowSign||1)*.12,.32,.68),'cover',force)}
        });
      }
      return;
    }
    const attackDir=teamMeta[poss].attack,defTeam=other(poss),attT=state.teamTactics[poss],defT=state.teamTactics[defTeam];
    const flowPhase=state.matchFlow?.currentPhase,phase=attT?.state||state.director?.phase||'BUILDUP',counter=flowPhase===FLOW_PHASES.COUNTER||phase==='COUNTERATTACK',shotSequence=flowPhase===FLOW_PHASES.SHOT_SEQUENCE||!!state.chanceBuild,finalAttack=flowPhase===FLOW_PHASES.FINAL_THIRD||phase==='FINAL_ATTACK'||shotSequence,circulation=flowPhase===FLOW_PHASES.CIRCULATION||flowPhase===FLOW_PHASES.BUILDUP,probing=flowPhase===FLOW_PHASES.PROBING;
    const flight=state.ball.flight,ballFuture={x:safeX(ball.x+(flight?(flight.tx-ball.x)*.44:(carrier?.vx||0)*.42)),y:safeY(ball.y+(flight?(flight.ty-ball.y)*.44:(carrier?.vy||0)*.42))};
    const attackers=teamEntities(poss),defenders=teamEntities(defTeam);assignMarks(defTeam,attackers,carrier);

    attackers.forEach((e,i)=>{
      if(state.kickoffReceiver===e){tacticalTarget(e,state.ball.x+attackDir*.008,state.ball.y+.025,'receive',true);return}
      if(flight?.meta?.receiver===e||flight?.meta?.challenger===e)return;
      const role=attT?.responsibilities?.[e.player.id]||(e===carrier?'BALL_CARRIER':'SUPPORT');
      if(e===carrier){
        const a=e.attributes||{},goalX=attackDir>0?FLIGHT.softX1:FLIGHT.softX0,nearest=nearestOpponent(e),pressure=nearest?dist2(e,nearest):1;
        const evadeSign=nearest&&pressure<.14?Math.sign(e.y-nearest.y||e.flowSign||1):(e.flowSign||1);
        const stableDrift=Math.sin((state.matchTime||0)*.31+(e.flowPhase||0))*.012;
        const y=e.y+stableDrift+(pressure<.13?evadeSign*(.035+.018*(a.turn||.8)):0);
        const p=attT?.profile||tacticalProfileForTeam(poss),adj=attT?.adjustment||tacticalAdjustmentForTeam(poss);
        // Carrier progression stays in the same neutral envelope for every profile;
        // identity is expressed mostly by support positions around the carrier.
        const advance=counter?.15:finalAttack?.095:.065;
        tacticalTarget(e,lerp(e.x,goalX,advance),y,pressure<.12?'evade':'carry',force);return;
      }
      const profile=attT?.profile||tacticalProfileForTeam(poss),adjustment=attT?.adjustment||tacticalAdjustmentForTeam(poss);
      const fluidFlip=profile.fluid&&Math.floor((state.matchTime||0)/7)%2===1?-1:1;
      const side=(role==='WIDTH'?(e.flowSign||1):role==='RUNNER'?(e.flowSign||1)*.55:(e.flowSign||1)*-.55)*fluidFlip;
      const flowWidth=circulation?1.18:finalAttack?.88:counter?1.08:1;const roleWidth=role==='WIDTH'?.17:role==='RUNNER'?.105:.085;const profileWidth=role==='SUPPORT'?(profile.supportWidth||1):1;const width=roleWidth*(attT?.width||1)*flowWidth*profileWidth;
      const baseAhead=role==='RUNNER'?(counter?.18:circulation?.075:probing?.115:.145):role==='SUPPORT'?(circulation?-.075:-.025):(circulation?.015:.055);
      const ahead=baseAhead*(role==='RUNNER'?(profile.runnerDepth||1)*(adjustment.runner||1):role==='SUPPORT'?(profile.supportDepth||1)*(adjustment.support||1):1);
      let tx=ballFuture.x+attackDir*ahead,ty=ballFuture.y+side*width;
      if(role==='SUPPORT'){const supportGap=(.045+.02*(1-(attT?.risk||.5)))*(profile.supportDepth||1)*(adjustment.support||1);tx=ballFuture.x-attackDir*supportGap;ty=ballFuture.y+side*.075*(profile.supportWidth||1)}
      if(finalAttack&&role==='WIDTH'){tx+=attackDir*.04;ty=clamp(ty,.31,.745)}
      const nearest=nearestOpponent(e);if(nearest&&dist2({x:tx,y:ty},nearest)<.085)ty+=Math.sign(ty-nearest.y||side||1)*.045;
      tacticalTarget(e,tx,ty,counter?'break':role.toLowerCase(),force);
    });

    const goalProtector=rolePlayer(defTeam,'defender');
    defenders.forEach((e,i)=>{
      if(flight?.meta?.challenger===e)return;
      const role=defT?.responsibilities?.[e.player.id]||(['BALL_PRESSER','SUPPORT_COVER','COVER'][i]),a=e.attributes||{},ownGoalX=defTeam==='belros'?.085:.915,marked=e.mark||carrier;

      // In the final third / shot wind-up, the designated defender protects the
      // actual shooting lane. This lets a second defender press while somebody
      // visibly stays goal-side instead of leaving the attacker alone on a ring.
      if(finalAttack&&carrier&&e===goalProtector){
        const screen=goalSideScreenPoint(carrier);
        tacticalTarget(e,screen.x,screen.y,'goal-screen',true);
        e.currentThreat=carrier;
        return;
      }

      if(role==='BALL_PRESSER'&&carrier){
        const compress=finalAttack?.035:circulation?.13:.10;let x=lerp(carrier.x,ownGoalX,compress+.025*(a.positioning||.8)),y=lerp(e.y,carrier.y,finalAttack?.90:.70);
        // In the final third the primary defender is explicitly allowed to get goal-side
        // and into the attacker's shooting lane instead of hovering outside the hoops.
        if(finalAttack){const goalLine=defTeam==='belros'?.105:.895;x=lerp(carrier.x,goalLine,.30);y=lerp(carrier.y,.51,.18)}
        tacticalTarget(e,x,y,'press',force);e.currentThreat=carrier;return;
      }
      const defProfile=defT?.profile||tacticalProfileForTeam(defTeam),defAdj=defT?.adjustment||tacticalAdjustmentForTeam(defTeam),compact=clamp((defProfile.defCompact||1)*(defAdj.press||1),.84,1.10);
      if(role==='SUPPORT_COVER'){
        const markY=marked?.y??ballFuture.y,x=lerp(ballFuture.x,ownGoalX,.24+.05*(a.positioning||.8)),y=lerp(ballFuture.y,markY,.48)+(e.flowSign||1)*.035*compact;
        tacticalTarget(e,x,y,'mark',force);e.currentThreat=marked;return;
      }
      const dangerY=carrier?.y??ballFuture.y,x=lerp(ballFuture.x,ownGoalX,.38+.06*(a.positioning||.8)),y=lerp(.5,dangerY,.38*compact);
      tacticalTarget(e,x,y,'cover',force);e.currentThreat=marked;
    });

    // Hoop-area spacing: defenders involved in the live defensive phase MUST be allowed
    // into the goal mouth. Only irrelevant off-ball riders are fanned away to avoid stacking.
    const activeRing=ringActionParticipants();
    const defensiveRingAllowed=new Set();
    if(finalAttack&&carrier){
      const ordered=defenders.slice().sort((a,b)=>dist2(a,carrier)-dist2(b,carrier));
      const keeper=rolePlayer(defTeam,'defender');if(keeper)defensiveRingAllowed.add(keeper);
      if(ordered[0])defensiveRingAllowed.add(ordered[0]);if(ordered[1])defensiveRingAllowed.add(ordered[1]);
    }
    for(const e of state.entities){
      if(activeRing.has(e)||defensiveRingAllowed.has(e))continue;
      for(const g of [{x:.098,y:.508,away:1},{x:.902,y:.508,away:-1}]){
        const dx=e.tx-g.x,dy=e.ty-g.y,d=Math.hypot(dx,dy);
        if(d<.145){const fan=(e.flowSign||1);e.tx=safeX(g.x+g.away*.155);e.ty=safeY(clamp(g.y+fan*.12,.30,.755));break}
      }
    }

    // Target-space separation only. Do not kick velocity directly here: that old
    // feedback loop made two nearby pixel sprites vibrate against one another.
    for(const team of ['belros','zafran']){
      const players=teamEntities(team);
      for(let i=0;i<players.length;i++)for(let j=i+1;j<players.length;j++){
        const a=players[i],b=players[j],dx=a.tx-b.tx,dy=a.ty-b.ty,d=Math.hypot(dx,dy)||.001;
        if(d<.120){const push=(.120-d)*.36,nx=dx/d,ny=dy/d;a.tx=safeX(a.tx+nx*push);a.ty=safeY(a.ty+ny*push);b.tx=safeX(b.tx-nx*push);b.ty=safeY(b.ty-ny*push)}
      }
    }
  }

  function activeContestEntities(){
    const keep=ringActionParticipants();
    if(state.carrier)keep.add(state.carrier);
    const f=state.ball?.flight;
    if(f?.meta?.receiver)keep.add(f.meta.receiver);
    if(f?.meta?.challenger)keep.add(f.meta.challenger);
    return keep;
  }

  function breakGeneralPackGrouping(dt,live){
    if(!live||state.celebration||state.special)return;
    const entities=state.entities,contest=activeContestEntities();
    const packRadius=.128,triggerSeconds=.26;
    for(let i=0;i<entities.length;i++){
      const e=entities[i];
      const close=entities.filter(o=>o!==e&&Math.hypot(o.x-e.x,o.y-e.y)<packRadius);
      // Three neighbours means at least four riders have formed one visible pack.
      if(close.length>=3)e.packCrowdTime=(e.packCrowdTime||0)+dt;
      else e.packCrowdTime=Math.max(0,(e.packCrowdTime||0)-dt*3.4);

      if((e.packDisperseTime||0)>0&&e.packDisperseTarget){
        e.packDisperseTime=Math.max(0,e.packDisperseTime-dt);
        // Keep the escape target alive between tactical refreshes. This is what
        // prevents the team AI pulling riders straight back into the same pile.
        const strength=contest.has(e)?.38:.76;
        e.tx=lerp(e.tx,e.packDisperseTarget.x,strength);
        e.ty=lerp(e.ty,e.packDisperseTarget.y,strength);
        if(!contest.has(e))e.intent='spread';
        if(e.packDisperseTime<=0)e.packDisperseTarget=null;
      }

      if(e.packCrowdTime<triggerSeconds||close.length<3||e.packDisperseTime>0)continue;
      const group=[e,...close];
      const cx=group.reduce((n,o)=>n+o.x,0)/group.length,cy=group.reduce((n,o)=>n+o.y,0)/group.length;
      let dx=e.x-cx,dy=e.y-cy,d=Math.hypot(dx,dy);
      // If several sprites are almost exactly stacked, give each player a stable
      // deterministic spoke instead of introducing random jitter into gameplay.
      if(d<.012){
        const idx=Math.max(0,entities.indexOf(e));
        const angle=(-Math.PI*.72)+(idx/(Math.max(1,entities.length-1)))*Math.PI*1.44;
        dx=Math.cos(angle);dy=Math.sin(angle);d=1;
      }
      dx/=d;dy/=d;
      // Preserve the real contest: carrier/receiver/challenger can stay closer,
      // everyone else clears decisively into width/depth.
      const essential=contest.has(e),distance=essential?.080:.145;
      const teamBias=e.team==='belros'?-.015:.015;
      const tx=safeX(e.x+dx*distance+teamBias),ty=safeY(clamp(e.y+dy*distance,.285,.765));
      e.packDisperseTarget={x:tx,y:ty};
      e.packDisperseTime=essential?.62:1.45;
      e.packCrowdTime=0;
    }
  }

  function flightSpriteHeight(e){return e?.player?.id?playerSpriteHeight(e,false):REF_FLY_HEIGHT}
  function arenaFlightFloorY(){const visual=fixtureVisualFloorY();return Number.isFinite(Number(visual))?Number(visual):Math.min(.90,fixtureGroundY()+.10)}
  function lowerHardLimit(e){
    // The arena artwork's floorY is the real visible floor. Keep the bottom of each
    // riding sprite a few pixels above it, rather than using one fake horizontal barrier.
    const halfSprite=(flightSpriteHeight(e)*.5)/H,clearance=6/H;
    return Math.min(FLIGHT.hardY1,arenaFlightFloorY()-halfSprite-clearance);
  }
  function lowerSoftLimit(e){return Math.min(FLIGHT.softY1,lowerHardLimit(e)-.018)}
  function enforceInteriorIntent(e,dt){
    const mx=.040,my=.038,softBottom=lowerSoftLimit(e);let threatened=false,bottomThreat=false;
    // Never let a tactical target ask a rider to fly through the arena floor.
    if(Number.isFinite(e.ty))e.ty=Math.min(e.ty,softBottom);
    if(e.x<FLIGHT.softX0+mx){e.tx=Math.max(e.tx,FLIGHT.softX0+.090);if(e.vx<0)e.vx=lerp(e.vx,.070,.30);threatened=true}
    else if(e.x>FLIGHT.softX1-mx){e.tx=Math.min(e.tx,FLIGHT.softX1-.090);if(e.vx>0)e.vx=lerp(e.vx,-.070,.30);threatened=true}
    if(e.y<FLIGHT.softY0+my){e.ty=Math.max(e.ty,FLIGHT.softY0+.085);if(e.vy<0)e.vy=lerp(e.vy,.068,.30);threatened=true}
    // Only begin floor avoidance close to the genuine sprite-safe floor. The old
    // 2.05*my buffer started pushing riders upward around the middle of the arena.
    else if(e.y>softBottom-.040){e.ty=Math.min(e.ty,softBottom-.012);if(e.vy>-.020)e.vy=lerp(e.vy,-.082,.34);threatened=true;bottomThreat=true}
    const slow=Math.hypot(e.vx,e.vy)<.038;e.edgeStall=threatened&&slow?(e.edgeStall||0)+dt:Math.max(0,(e.edgeStall||0)-dt*3);
    if(bottomThreat&&e.y>softBottom-.012){const side=(e.x<.5?1:-1);e.ty=Math.min(e.ty,softBottom-.048);e.tx=safeX(e.tx+side*.045);e.vy=Math.min(e.vy,-.090);e.vx+=side*.018;e.intent='recover'}
    if(e.edgeStall>(bottomThreat?.16:.18)){const recoveryY=bottomThreat?Math.max(.58,softBottom-.10):.455;e.tx=safeX(lerp(e.x,.5,.38));e.ty=safeY(lerp(e.y,recoveryY,.48));const ix=.5-e.x,iy=recoveryY-e.y,d=Math.hypot(ix,iy)||1;e.vx+=ix/d*.072;e.vy+=iy/d*(bottomThreat?.095:.090);e.edgeStall=0;e.intent='recover'}
  }

  function applyBoundarySteering(e,dvx,dvy){
    // Anticipate walls before contact. Bottom steering uses a shorter look-ahead so
    // the newly available lower-middle flight lane stays genuinely usable.
    const px=e.x+e.vx*.42,py=e.y+e.vy*.42;const left=(px-FLIGHT.hardX0)/FLIGHT.wallLook,right=(FLIGHT.hardX1-px)/FLIGHT.wallLook;
    const top=(py-FLIGHT.hardY0)/FLIGHT.wallLook,bottom=(lowerHardLimit(e)-py)/(FLIGHT.bottomLook||.072);
    if(left<1)dvx+=Math.pow(1-clamp(left,0,1),2)*.26;
    if(right<1)dvx-=Math.pow(1-clamp(right,0,1),2)*.26;
    if(top<1)dvy+=Math.pow(1-clamp(top,0,1),2)*.22;
    if(bottom<1)dvy-=Math.pow(1-clamp(bottom,0,1),2)*.34;
    return [dvx,dvy];
  }

  function nearestHoopInfo(e){
    let best=null,bestD=999;
    for(const h of [...hoops.belros,...hoops.zafran]){
      const d=Math.hypot((e?.x||0)-h.x,(e?.y||0)-h.y);
      if(d<bestD){bestD=d;best=h}
    }
    return {hoop:best,dist:bestD};
  }

  function ringActionParticipants(){
    const keep=new Set(),flight=state.ball.flight;
    if(state.carrier){
      keep.add(state.carrier);
      // Let the defending specialist protect the goal area while everyone else
      // is kept in useful support/cover positions outside the hoop cluster.
      const keeper=rolePlayer(other(state.carrier.team),'defender');if(keeper)keep.add(keeper);
    }
    if(flight?.meta?.shooter)keep.add(flight.meta.shooter);
    if(flight?.meta?.keeper)keep.add(flight.meta.keeper);
    if(flight?.meta?.receiver)keep.add(flight.meta.receiver);
    if(flight?.meta?.challenger)keep.add(flight.meta.challenger);
    if(state.special?.type==='penalty'){
      const shooter=state.special.shooter||state.carrier;if(shooter)keep.add(shooter);
      const keeper=shooter?rolePlayer(other(shooter.team),'defender'):null;if(keeper)keep.add(keeper);
    }
    return keep;
  }

  function goalAreaInfo(e){
    const left={x:.098,y:.508},right={x:.902,y:.508};
    const dl=Math.hypot(e.x-left.x,e.y-left.y),dr=Math.hypot(e.x-right.x,e.y-right.y);
    return dl<dr?{goal:left,dist:dl,side:'left'}:{goal:right,dist:dr,side:'right'};
  }

  function breakGoalAreaCongestion(e,dt,live){
    if(!live)return;
    const info=goalAreaInfo(e),participants=ringActionParticipants(),essential=participants.has(e);
    const nearby=state.entities.filter(o=>Math.hypot(o.x-info.goal.x,o.y-info.goal.y)<.205);
    const core=info.dist<.112,busy=nearby.length>=3&&info.dist<.205;
    // Essential goal-action riders (carrier/shooter/keeper/receiver/challenger)
    // are ALLOWED to occupy the hoop core. Test 28 could still fan an essential
    // keeper away once they reached the core, creating visually uncontested shots.
    if(essential)return;
    if(!core&&!busy)return;
    // Everyone irrelevant to the live goal action fans away from the hoop cluster.
    const index=Math.max(0,nearby.filter(o=>!participants.has(o)).indexOf(e));
    const awayX=info.side==='left'?1:-1,fan=(index%2===0?-1:1),spread=.105+(index%3)*.035;
    e.tx=safeX(info.goal.x+awayX*(essential?.125:.185));
    e.ty=safeY(clamp(info.goal.y+fan*spread,.30,.755));
    const dx=e.tx-e.x,dy=e.ty-e.y,d=Math.hypot(dx,dy)||1;
    e.vx=lerp(e.vx,dx/d*Math.max(.105,Math.hypot(e.vx,e.vy)),1-Math.exp(-dt*11));
    e.vy=lerp(e.vy,dy/d*Math.max(.105,Math.hypot(e.vx,e.vy)),1-Math.exp(-dt*11));
    e.intent='recover';e.ringHoverTime=0;
  }

  function applyLoiterBreak(e,dt,live){
    if(!live)return;
    const speed=Math.hypot(e.vx,e.vy),softBottom=lowerSoftLimit(e),hardBottom=lowerHardLimit(e),lowBand=e.y>hardBottom-.034;
    e.floorHoverTime=lowBand&&speed<.050?(e.floorHoverTime||0)+dt:Math.max(0,(e.floorHoverTime||0)-dt*3.4);
    if(e.floorHoverTime>.28){
      const side=(e.x<.5?1:-1);
      e.ty=Math.min(e.ty,softBottom-.045);
      e.tx=safeX(e.x+side*.050);
      e.vy=Math.min(e.vy,-.090);
      e.vx+=side*.020;
      e.floorHoverTime=0;
      e.intent='recover';
    }

    breakGoalAreaCongestion(e,dt,live);
    const info=nearestHoopInfo(e),participants=ringActionParticipants(),activeGoalAction=participants.has(e);
    const ringThreat=info.hoop&&info.dist<FLOW.ringRadius&&!activeGoalAction;
    e.ringHoverTime=ringThreat?(e.ringHoverTime||0)+dt:Math.max(0,(e.ringHoverTime||0)-dt*4.8);
    if(e.ringHoverTime>Math.min(FLOW.ringHoverTrigger,.10)){
      const h=info.hoop,awayX=h.x<.5?1:-1,dy=(e.y-h.y)||((e.flowSign||1)*.05),dd=Math.hypot(1,dy)||1;
      e.tx=safeX(e.x+awayX*.095);
      e.ty=safeY(h.y+dy/dd*.115-(e.y>h.y?.025:0));
      e.vx+=awayX*.096;
      e.vy+=dy/dd*.086-(e.y>h.y?.035:0);
      e.ringHoverTime=0;
      e.intent='recover';
      e.flowSign*=-1;
    }
  }

  function steerEntity(e,dt){
    v48RefreshTraits(e);
    const prevVx=e.vx||0,prevVy=e.vy||0;
    enforceInteriorIntent(e,dt);
    const dx=e.tx-e.x,dy=e.ty-e.y,dist=Math.hypot(dx,dy),a=e.attributes||{},fatigue=1-(e.fatigue||0);
    const live=(state.phase==='first'||state.phase==='second'||state.phase==='shootout')&&!state.special&&!state.celebration;
    let desiredSpeed=Math.min((e.maxSpeed||.19)*fatigue,dist*1.9+.022);
    let dvx=dist>.001?dx/dist*desiredSpeed:0,dvy=dist>.001?dy/dist*desiredSpeed:0;

    // Close to a tactical destination, preserve the rider's current flight vector
    // instead of orbiting the point. Orbit steering was a major source of visible
    // left/right vibration when targets updated several times per second.
    if(live&&dist<FLOW.arrivalRadius&&e.intent!=='intercept'&&e.intent!=='receive'){
      const sp0=Math.hypot(e.vx,e.vy),cruise=FLOW.minCruise*(e.intent==='press'?1.12:e===state.carrier?1.08:.90);
      if(sp0>.018){dvx=e.vx/sp0*Math.max(cruise,Math.min(sp0,(e.maxSpeed||.19)*.72));dvy=e.vy/sp0*Math.max(cruise,Math.min(sp0,(e.maxSpeed||.19)*.72));}
      desiredSpeed=Math.max(desiredSpeed,cruise);
    }

    [dvx,dvy]=applyBoundarySteering(e,dvx,dvy);
    const responsiveness=1-Math.exp(-dt*(e.turnRate||5)*fatigue*(state.careerMode?.65+executionSkill(a,'accel')*.4:1));e.vx=lerp(e.vx,dvx,responsiveness);e.vy=lerp(e.vy,dvy,responsiveness);

    // Only apply a tiny collision correction when riders are genuinely converging.
    // Tactical target separation handles normal spacing, avoiding the old ping-pong
    // velocity impulses that made clustered sprites visibly vibrate.
    if(live){
      for(const o of state.entities){if(o===e)continue;const sx=e.x-o.x,sy=e.y-o.y,sd=Math.hypot(sx,sy);if(sd>0&&sd<.050){const nx=sx/sd,ny=sy/sd,closing=(e.vx-o.vx)*nx+(e.vy-o.vy)*ny;if(closing<0){const push=(.050-sd)*.22;e.vx+=nx*push;e.vy+=ny*push}}}
    }

    let sp=Math.hypot(e.vx,e.vy),max=(e.maxSpeed||.19)*fatigue;if(sp>max){e.vx=e.vx/sp*max;e.vy=e.vy/sp*max;sp=max}
    e.hoverTime=live&&sp<.026?(e.hoverTime||0)+dt:Math.max(0,(e.hoverTime||0)-dt*2.8);
    if(live&&e.hoverTime>FLOW.hoverTrigger){
      const attack=teamMeta[e.team].attack,side=e.flowSign||1;e.tx=safeX(e.x+attack*(e===state.carrier?.095:.050));e.ty=safeY(e.y+side*.078);
      e.vx+=attack*FLOW.escapeImpulse*.84;e.vy+=side*FLOW.escapeImpulse;e.hoverTime=0;e.flowSign*=-1;e.intent=e.intent==='shape'?'rotate':e.intent;
    }

    applyLoiterBreak(e,dt,live);
    let nx=e.x+e.vx*dt,ny=e.y+e.vy*dt;
    // Emergency containment only. Kill/redirect outward velocity immediately so a rider can never 'fly into' the clamp.
    if(nx<FLIGHT.hardX0){nx=FLIGHT.hardX0+.003;e.vx=Math.abs(e.vx)*.28;e.tx=Math.max(e.tx,FLIGHT.softX0+.035)}
    else if(nx>FLIGHT.hardX1){nx=FLIGHT.hardX1-.003;e.vx=-Math.abs(e.vx)*.28;e.tx=Math.min(e.tx,FLIGHT.softX1-.035)}
    const hardBottom=lowerHardLimit(e),softBottom=lowerSoftLimit(e);
    if(ny<FLIGHT.hardY0){ny=FLIGHT.hardY0+.003;e.vy=Math.abs(e.vy)*.28;e.ty=Math.max(e.ty,FLIGHT.softY0+.07)}
    else if(ny>hardBottom){ny=hardBottom-.004;e.vy=-Math.max(.070,Math.abs(e.vy)*.50);e.ty=Math.min(e.ty,softBottom-.040);e.tx=safeX(lerp(e.tx,.5,.07));e.intent='recover'}
    e.x=nx;e.y=ny;
    if(Math.abs(e.vx)>.018){const candidate=e.vx>=0?1:-1;if(candidate!==(e.facing||candidate)){if(e.faceCandidate===candidate)e.faceCandidateTime=(e.faceCandidateTime||0)+dt;else{e.faceCandidate=candidate;e.faceCandidateTime=0}}else e.faceCandidateTime=0;if((e.faceCandidateTime||0)>.085){e.facing=candidate;e.dir=-candidate;e.faceCandidateTime=0}}else e.faceCandidateTime=Math.max(0,(e.faceCandidateTime||0)-dt*2);
    const desiredHeading=Math.atan2(dvy,dvx),currentHeading=Math.atan2(e.vy||0.001,e.vx||0.001),headingError=normaliseAngle(desiredHeading-currentHeading);e.smoothedTurn=lerp(e.smoothedTurn||0,headingError,1-Math.exp(-dt*2.6));e.bank=lerp(e.bank,clamp((e.smoothedTurn||0)*.07,-.055,.055),1-Math.exp(-dt*2.8));if(e.celebrate>0)e.celebrate=Math.max(0,e.celebrate-dt);
    updateReactionExpiry(e);
    if(live&&!state.ball.flight&&!state.delay&&(e.animUntil||0)<=simNow()){
      e.microReactionClock=(e.microReactionClock||4)-dt;
      if(e.microReactionClock<=0){
        const pp=getPlayerPersonality(e),idleRate=pp.idleStyle==='restless'?0.40:pp.idleStyle==='playful'?0.36:pp.idleStyle==='alert'?0.33:0.24;
        e.microReactionClock=(pp.idleStyle==='restless'?3.8:pp.idleStyle==='calm'?6.2:4.8)+visualRandom()*(pp.idleStyle==='calm'?8.5:7.0);
        if(visualRandom()<idleRate){
          const preferred=pp.idleStyle==='restless'?['broomBob','shoulderCheck']:pp.idleStyle==='alert'?['lookBall','shoulderCheck']:pp.idleStyle==='playful'?['tinyPoint','broomBob']:['lookBall','lookTeammate'];
          const type=personalityChoice(e,'micro',['shoulderCheck','broomBob','lookBall','lookTeammate','tinyPoint'],preferred);
          enterReaction(e,'playing','MICRO_REACTION',.28+visualRandom()*.32,{type,faceX:(state.carrier||state.ball)?.x},ANIM_PRIORITY.MICRO_REACTION);
        }
      }
    }
    updateLocomotionAnim(e,dt,prevVx,prevVy);
  }

  function updateEntities(dt){
    if(state.celebration&&(state.phase==='first'||state.phase==='second')){updateGoalCelebrationEntities(dt);return}
    if(state.phase==='intro'){if(state.kickoffMount){updatePrematchMountedEntities(dt);return}for(const e of state.entities){e.vx=e.vy=0;e.animElapsed=(e.animElapsed||0)+dt;e.animState='IDLE';e.animPriority=0}state.ref.vx=state.ref.vy=0;return}
    if(state.phase==='secondcountdown'){for(const e of state.entities){e.vx=lerp(e.vx,0,1-Math.exp(-dt*8));e.vy=lerp(e.vy,0,1-Math.exp(-dt*8))}state.ref.vx=state.ref.vy=0;return}
    if(state.phase==='halftime'){
      for(const e of state.entities){if(state.halftimeElapsed<2.4)steerEntity(e,dt*.68);else{e.vx=lerp(e.vx,0,1-Math.exp(-dt*7));e.vy=lerp(e.vy,0,1-Math.exp(-dt*7))}}
      state.ref.vx=lerp(state.ref.vx,0,1-Math.exp(-dt*7));state.ref.vy=lerp(state.ref.vy,0,1-Math.exp(-dt*7));return;
    }
    updateMatchDirector(dt);updateTeamTacticalDirector(dt);
    state.movementPulse-=dt;if(state.movementPulse<=0){refreshMovementTargets();state.movementPulse=.18}
    breakGeneralPackGrouping(dt,true);
    for(const e of state.entities)steerEntity(e,dt);
    const target=state.ball.flight?state.ball:(state.carrier||{x:.5,y:.5});
    // William observes from a clear trailing diagonal rather than joining the
    // player pack. The offsets mirror perfectly with possession direction.
    const refBehind=state.possession==='belros'?.115:state.possession==='zafran'?-.115:0;
    const refVertical=target.y<.50?.115:-.115;
    if((state.ref.reactionUntil||0)<=simNow()){
      state.ref.reactionState='playing';
      state.ref.tx=safeX(target.x-refBehind);
      state.ref.ty=safeY(target.y+refVertical);
    }
    else if(state.ref.reactionMeta?.faceX!=null)state.ref.dir=state.ref.reactionMeta.faceX>=state.ref.x?1:-1;
    const r=state.ref;enforceInteriorIntent(r,dt);const dx=r.tx-r.x,dy=r.ty-r.y,dist=Math.hypot(dx,dy),ds=Math.min(r.maxSpeed,dist*1.55+.02);let rvx=dist?dx/dist*ds:0,rvy=dist?dy/dist*ds:0;[rvx,rvy]=applyBoundarySteering(r,rvx,rvy);const k=1-Math.exp(-dt*4.2);
    r.vx=lerp(r.vx,rvx,k);r.vy=lerp(r.vy,rvy,k);let rx=r.x+r.vx*dt,ry=r.y+r.vy*dt;
    if(rx<FLIGHT.hardX0){rx=FLIGHT.hardX0+.004;r.vx=Math.abs(r.vx)*.3;r.tx=FLIGHT.softX0+.07}else if(rx>FLIGHT.hardX1){rx=FLIGHT.hardX1-.004;r.vx=-Math.abs(r.vx)*.3;r.tx=FLIGHT.softX1-.07}
    if(ry<FLIGHT.hardY0){ry=FLIGHT.hardY0+.004;r.vy=Math.abs(r.vy)*.3;r.ty=FLIGHT.softY0+.07}else if(ry>lowerHardLimit(r)){ry=lowerHardLimit(r)-.004;r.vy=-Math.max(.07,Math.abs(r.vy)*.52);r.ty=lowerSoftLimit(r)-.11}
    r.x=rx;r.y=ry;if(Math.abs(r.vx)>.003)r.dir=r.vx>=0?1:-1;
  }

  function cameraBoundsForZoom(z){
    const hx=.5/z,hy=.5/z;
    return {x0:hx,x1:1-hx,y0:hy,y1:1-hy};
  }

  function updateVirtualCameraDirector(dt){
    const d=state.cameraDirector||(state.cameraDirector={shot:'MAIN',timer:0,lastShot:'',cutSerial:0});
    if(state.replay||state.celebration||state.special)return;d.timer-=dt;if(d.timer>0)return;
    const phase=state.director?.phase||'BUILD-UP',carrier=state.carrier,flight=state.ball.flight;
    let choices=['MAIN','WIDE'];
    if(flight?.meta?.kind==='shot'||phase==='GOAL CHANCE')choices=['CLOSE_ATTACK','GOAL_END','MAIN'];
    else if(phase==='COUNTERATTACK')choices=['TRACKING','WIDE','MAIN'];
    else if(phase==='ATTACK')choices=['TRACKING','MAIN','WIDE'];
    else if(phase==='DEFENSIVE PRESSURE')choices=['MAIN','CLOSE_ATTACK','WIDE'];
    const filtered=choices.filter(x=>x!==d.lastShot),pool=filtered.length?filtered:choices;d.shot=pool[Math.floor((state.visualRand?.()||Math.random())*pool.length)]||'MAIN';d.lastShot=d.shot;d.cutSerial++;d.timer=(d.shot==='WIDE'?6.5:4.4)+(state.visualRand?.()||Math.random())*3.1;
    if(carrier&&d.shot==='GOAL_END')d.goalTeam=carrier.team;
  }

  function cameraFramePoints(){
    const pts=[],carrier=state.carrier,flight=state.ball.flight,ball=flight?state.ball:(carrier||state.ball);
    if(ball)pts.push({x:ball.x,y:ball.y,w:1.7});
    if(carrier)pts.push({x:carrier.x,y:carrier.y,w:1.6});
    if(flight?.meta?.receiver)pts.push({x:flight.meta.receiver.x,y:flight.meta.receiver.y,w:1.15});
    if(flight?.meta?.challenger)pts.push({x:flight.meta.challenger.x,y:flight.meta.challenger.y,w:1.2});
    if(carrier){
      const near=teamEntities(other(carrier.team)).slice().sort((a,b)=>dist2(a,carrier)-dist2(b,carrier)).slice(0,2);
      near.forEach((e,i)=>pts.push({x:e.x,y:e.y,w:i?0.75:1.05}));
      teamEntities(carrier.team).filter(e=>e!==carrier).forEach(e=>{if(dist2(e,carrier)<.30)pts.push({x:e.x,y:e.y,w:.58})});
    }
    return pts;
  }

  function updateCamera(dt){
    const c=state.camera;updateVirtualCameraDirector(dt);
    if(c.vx==null){c.vx=0;c.vy=0;c.vz=0;c.mode='LIVE_BROADCAST';c.debugTarget={x:.5,y:.5}}
    const live=state.phase==='first'||state.phase==='second'||state.phase==='shootout';
    if(live&&!state.special){
      if(state.celebration){
        const gc=state.celebration,descending=gc.elapsed>=gc.aerialDuration,p=descending?clamp((gc.elapsed-gc.aerialDuration)/gc.descentDuration,0,1):0;c.mode='CELEBRATION_CAMERA';const focus=descending?{x:lerp(.5,gc.centerX,.38),y:lerp(.515,.585,ease(p))}:{x:lerp(.5,gc.centerX,.34),y:.515};c.tx=focus.x;c.ty=focus.y;c.tz=gc.fullTeam?1.012:1.022;c.debugTarget={x:c.tx,y:c.ty};
      }else{
      const flight=state.ball.flight,carrier=state.carrier,dir=carrier?teamMeta[carrier.team].attack:(state.possession?teamMeta[state.possession].attack:0);
      let mode='LIVE_BROADCAST',zoom=1.028;
      if(flight?.meta?.kind==='shot'){mode='SHOT_CAMERA';zoom=1.072}
      else if(state.director?.phase==='COUNTERATTACK'){mode='ATTACK_CAMERA';zoom=1.050}
      else if(state.director?.phase==='GOAL CHANCE'){mode='ATTACK_CAMERA';zoom=1.060}
      else if(flight?.meta?.kind==='pass'){mode='LIVE_BROADCAST';zoom=1.038}
      const virtual=state.cameraDirector?.shot||'MAIN';
      if(virtual==='WIDE'){mode='WIDE_CAMERA';zoom=Math.min(zoom,1.008)}
      else if(virtual==='TRACKING'){mode='TRACKING_CAMERA';zoom=Math.max(zoom,1.040)}
      else if(virtual==='CLOSE_ATTACK'){mode='CLOSE_ATTACK_CAMERA';zoom=Math.max(zoom,1.072)}
      else if(virtual==='GOAL_END'){mode='GOAL_END_CAMERA';zoom=Math.max(zoom,1.058)}
      if((MATCH_SECONDS-state.matchTime)<60&&Math.abs(state.score.belros-state.score.zafran)<=1)zoom+=.010;

      const pts=cameraFramePoints();
      let sx=0,sy=0,sw=0;
      for(const p of pts){sx+=p.x*(p.w||1);sy+=p.y*(p.w||1);sw+=(p.w||1)}
      let fx=sw?sx/sw:.5,fy=sw?sy/sw:.5;
      const focus=flight?state.ball:(carrier||{x:.5,y:.5});
      let lookX=0,lookY=0;
      if(flight){lookX=(flight.tx-focus.x)*.34;lookY=(flight.ty-focus.y)*.25}
      else if(carrier){lookX=(carrier.vx||0)*.70+dir*.018;lookY=(carrier.vy||0)*.48}
      fx=lerp(fx,focus.x,.38)+lookX;fy=lerp(fy,focus.y,.34)+lookY;
      const vshot=state.cameraDirector?.shot||'MAIN';
      if(vshot==='WIDE'){fx=lerp(fx,.5,.24);fy=lerp(fy,.50,.18)}
      else if(vshot==='GOAL_END'&&carrier){const gx=carrier.team==='belros'?.82:.18;fx=lerp(fx,gx,.28);fy=lerp(fy,.515,.18)}
      else if(vshot==='CLOSE_ATTACK'&&carrier){fx=lerp(fx,carrier.x,.36);fy=lerp(fy,carrier.y,.32)}

      const zb=cameraBoundsForZoom(zoom);
      c.tx=clamp(fx,zb.x0+.004,zb.x1-.004);
      c.ty=clamp(fy,zb.y0+.004,zb.y1-.004);
      c.tz=zoom;c.mode=mode;c.debugTarget={x:c.tx,y:c.ty};
      }
    }else if(state.special?.type==='var'){
      c.mode='VAR_CAMERA';
    }else if(state.phase==='halftime'){
      c.mode='HALFTIME_CAMERA';
    }else if(state.phase==='fulltime'){
      c.mode='FULL_TIME_CAMERA';
    }

    const fastCam=['ATTACK_CAMERA','SHOT_CAMERA','TRACKING_CAMERA','CLOSE_ATTACK_CAMERA','GOAL_END_CAMERA'].includes(c.mode);
    const accel=fastCam?5.5:4.1;
    const damping=fastCam?5.1:4.8;
    c.vx=(c.vx||0)+(c.tx-c.x)*accel*dt;c.vy=(c.vy||0)+(c.ty-c.y)*accel*dt;c.vz=(c.vz||0)+(c.tz-c.zoom)*3.9*dt;
    const damp=Math.exp(-damping*dt);c.vx*=damp;c.vy*=damp;c.vz*=Math.exp(-4.8*dt);
    c.x+=c.vx*dt;c.y+=c.vy*dt;c.zoom+=c.vz*dt;
    c.zoom=clamp(c.zoom,.985,1.095);
    const b=cameraBoundsForZoom(Math.max(1,c.zoom));c.x=clamp(c.x,b.x0,b.x1);c.y=clamp(c.y,b.y0,b.y1);
    c.shake=Math.max(0,c.shake-dt*.018);
  }

  function drawTournamentEnvironment(ctx){
    // V2 is not a World Cup broadcast. Do not draw team-flag image objects onto
    // the field. In V2 those assets are Repo Sports logos, which could read as
    // logos being thrown around during goal camera shake/celebrations.
    // Goal celebration debris is procedural flowers, confetti and scarves only.
    return;
  }
  function drawReplayScene(ctx,frame){
    if(!frame)return;drawTournamentEnvironment(ctx);
    for(const snap of frame.entities){const live=state.entities.find(e=>e.player.id===snap.id);if(!live)continue;const fake={...live,x:snap.x,y:snap.y,dir:snap.dir,animState:snap.animState};drawSprite(ctx,state.assets[live.player.id+'Riding'],fake,playerSpriteHeight(live,false),false)}
    const rr={...state.ref,x:frame.ref.x,y:frame.ref.y,dir:frame.ref.dir,player:{name:REFEREE_LABEL}};drawSprite(ctx,state.assets.refFlying,rr,REF_FLY_HEIGHT,false);if(frame.ball?.visible)drawBall(ctx,frame.ball.x,frame.ball.y,frame.ball.flight);
    drawArenaAmbience(ctx,'front');
  }

  function drawSprite(ctx,image,e,height,standing=false){
    if(!image)return;
    const aspect=image.width/image.height,w=height*aspect,pose=actionPose(e,standing),px=Math.round(e.x*W);
    const visualFloor=standing?fixtureVisualFloorY():null;
    const logicalDelta=visualFloor==null?0:(e.y-fixtureGroundY())*H;
    const py=Math.round((visualFloor==null?e.y:visualFloor)*H+logicalDelta);

    // Supplied standing PNGs have very different transparent padding beneath
    // the character. Anchor the *visible* alpha bottom, not the PNG canvas bottom.
    const visibleBottom=standing&&visualFloor!=null
      ? (e.player?.spriteMetrics?.standingBottom||STANDING_VISIBLE_BOTTOM[e.player?.id]||1)
      : 1;
    const drawTop=standing&&visualFloor!=null
      ? -height*visibleBottom
      : -height/2;

    // When grounded, do not let presentation/micro-animation bob move the feet
    // away from the floor. Celebration jumps are already represented by e.y.
    const planted=standing&&visualFloor!=null;
    const poseY=planted?0:((pose.oy||0)+(pose.bob||0));

    ctx.save();
    ctx.translate(px,py);
    ctx.translate(pose.ox||0,poseY);
    if(!standing&&Math.abs(pose.rot||0)>.004)ctx.rotate(pose.rot||0);
    ctx.scale((e.dir||1)*(pose.sx||1),pose.sy||1);
    ctx.imageSmoothingEnabled=false;
    ctx.drawImage(image,Math.round(-w/2),Math.round(drawTop),Math.round(w),Math.round(height));
    ctx.restore();

    const visibleTop=standing&&visualFloor!=null
      ? py-height*visibleBottom
      : py-height/2;
    ctx.save();
    const tagText=e.player?.name||'REF',tagY=Math.round(visibleTop-8);
    ctx.font='900 9px monospace';ctx.textAlign='center';ctx.textBaseline='bottom';
    const tw=Math.ceil(ctx.measureText(tagText).width)+10,th=14;
    const isHome=e.team==='belros',isAway=e.team==='zafran';
    ctx.fillStyle=isHome?'rgba(91,31,20,.90)':isAway?'rgba(15,47,82,.92)':'rgba(20,27,31,.88)';
    ctx.strokeStyle=isHome?'#ffb65e':isAway?'#7fd8ff':'#d8bc73';ctx.lineWidth=1;
    ctx.fillRect(Math.round(px-tw/2),Math.round(tagY-th+2),tw,th);
    ctx.strokeRect(Math.round(px-tw/2)+.5,Math.round(tagY-th+2)+.5,tw-1,th-1);
    ctx.fillStyle=isHome?'#ffe2a0':isAway?'#b8eaff':'#fff1b6';
    ctx.strokeStyle='rgba(0,0,0,.94)';ctx.lineWidth=3;
    ctx.strokeText(tagText,px,tagY);ctx.fillText(tagText,px,tagY);
    ctx.restore();
  }

  function drawBall(ctx,x,y,flight=false){
    ctx.save();ctx.translate(x*W,y*H);
    const size=flight?29:23,image=state.assets.ball;
    if(image){
      const frame=state.ballSpriteFrame||{x:0,y:0,width:image.width,height:image.height};
      const scale=size/Math.max(frame.width,frame.height),width=frame.width*scale,height=frame.height*scale;
      // A single clean sprite for held balls, passes, shots and replays.
      // High-quality downsampling preserves the supplied cream, navy, red and gold design.
      ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
      ctx.shadowColor='rgba(0,0,0,.55)';ctx.shadowBlur=2;ctx.shadowOffsetY=1;
      ctx.drawImage(image,frame.x,frame.y,frame.width,frame.height,-width/2,-height/2,width,height);
    }else{
      // A missing optional image must never stop a saved career fixture from playing.
      ctx.fillStyle='#7b2f22';ctx.strokeStyle='#f0c77b';ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(0,0,size*.34,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.strokeStyle='rgba(255,226,160,.55)';ctx.lineWidth=1;
      ctx.beginPath();ctx.arc(-size*.05,-size*.03,size*.19,-1.4,1.2);ctx.stroke();
    }
    ctx.restore();
  }


  function drawGoalCelebrationEffects(ctx,layer='back'){
    const c=state.celebration;if(!c)return;
    if(layer==='back'){
      const palette=celebrationPalette(c.team);ctx.save();ctx.globalCompositeOperation='screen';
      for(const fw of (Array.isArray(c.fireworks)?c.fireworks:[])){const t=clamp(fw.age/fw.life,0,1),alpha=Math.sin(Math.PI*t)*.94,r=10+t*72;ctx.globalAlpha=alpha;for(let i=0;i<24;i++){const a=fw.seed+i*Math.PI*2/24,rr=r*(.72+(i%4)*.085),x=fw.x*W,y=fw.y*H;ctx.strokeStyle=palette[i%palette.length];ctx.lineWidth=i%4===0?2:1.2;ctx.beginPath();ctx.moveTo(x+Math.cos(a)*rr*.30,y+Math.sin(a)*rr*.30);ctx.lineTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr);ctx.stroke();ctx.fillStyle=palette[(i+1)%palette.length];ctx.fillRect(Math.round(x+Math.cos(a)*rr)-1,Math.round(y+Math.sin(a)*rr)-1,3,3)}}ctx.restore();
    }else{
      ctx.save();
      ctx.imageSmoothingEnabled=false;
      for(const f of (Array.isArray(c.tosses)?c.tosses:[])){
        const life=Math.max(.1,f.life||4),endFade=clamp((life-(f.age||0))/.65,0,1);
        const floorFade=f.onFloor?clamp(1-(f.floorAge||0)/1.35,0,1):1;
        ctx.globalAlpha=.90*endFade*floorFade;
        ctx.save();
        ctx.translate(Math.round(f.x*W),Math.round(f.y*H));
        ctx.rotate(f.rot||0);
        ctx.fillStyle=f.colour||'#f5d982';
        ctx.strokeStyle=f.colour||'#f5d982';

        const s=Math.max(2.2,5.2*(f.size||1));
        if(f.type==='petal'){
          // Small flower/petal cluster: four soft petals and a warm centre.
          for(let i=0;i<4;i++){
            ctx.save();ctx.rotate(i*Math.PI/2);
            ctx.beginPath();ctx.ellipse(0,-s*.42,s*.26,s*.48,0,0,Math.PI*2);ctx.fill();
            ctx.restore();
          }
          ctx.fillStyle='#f6d46e';
          ctx.beginPath();ctx.arc(0,0,Math.max(1,s*.18),0,Math.PI*2);ctx.fill();
        }else if(f.type==='scarf'){
          // A lightweight fabric ribbon that visibly bends/flutter as it falls.
          const wave=Math.sin((f.age||0)*6+(f.phase||0))*s*.28;
          ctx.lineWidth=Math.max(2,s*.34);
          ctx.lineCap='round';
          ctx.beginPath();
          ctx.moveTo(-s*1.15,0);
          ctx.quadraticCurveTo(-s*.25,wave,s*1.12,0);
          ctx.stroke();
          ctx.lineWidth=Math.max(1,s*.12);
          ctx.beginPath();ctx.moveTo(-s*1.20,-s*.16);ctx.lineTo(-s*1.43,-s*.36);ctx.moveTo(-s*1.20,s*.16);ctx.lineTo(-s*1.43,s*.36);ctx.stroke();
        }else{
          // Confetti has a thin rectangular paper profile and keeps rotating.
          ctx.fillRect(Math.round(-s*.48),Math.round(-s*.20),Math.max(2,Math.round(s*.96)),Math.max(2,Math.round(s*.40)));
        }
        ctx.restore();
      }
      ctx.restore();
    }
  }

  const SCORER_BROOM_TRAILS={
    besquelcher:{kind:'wisp',primary:'#9b63ff',secondary:'#e1c7ff'},
    jenny:{kind:'sparkle',primary:'#ff8fbd',secondary:'#ffe0a8'},
    nimbler2000:{kind:'ember',primary:'#ff6a2c',secondary:'#ffd66d'},
    pipsqueak:{kind:'frost',primary:'#57d8ff',secondary:'#eefcff'},
    rocky:{kind:'dust',primary:'#cfd5dc',secondary:'#d7a25c'},
    soup:{kind:'mote',primary:'#79db7d',secondary:'#e8ef9a'}
  };

  function drawScorerBroomTrail(ctx,c,lead=0){
    const scorer=c?.scorer;if(!scorer)return;
    const style=SCORER_BROOM_TRAILS[scorer.player?.id];if(!style)return;

    const e=visualEntity(scorer,lead);
    const t=(Number(c.elapsed)||0)+lead;
    const remaining=Math.max(0,(Number(c.duration)||0)-t);
    const fade=clamp(Math.min(t/.28,remaining/.42),0,1);
    if(fade<=.01)return;

    const vx=Number(e.vx)||0;
    const motionDir=Math.abs(vx)>.003?Math.sign(vx):(Number(e.facing)||1);
    const originX=(e.x-motionDir*.022)*W;
    const originY=groundedY(-.052)*H;
    const motion=clamp(Math.abs(vx)*18,.32,1);
    const length=26+motion*20;

    ctx.save();
    ctx.globalCompositeOperation='lighter';
    ctx.lineCap='round';

    for(let i=0;i<6;i++){
      const q=i/5;
      const phase=t*(style.kind==='ember'?11:style.kind==='frost'?8.5:7.2)+i*1.47;
      const x=originX-motionDir*(6+q*length);
      const y=originY+Math.sin(phase)*(2.2+q*2.7)-q*1.4;
      const alpha=fade*(1-q)*.34;
      const size=1.1+(1-q)*1.8;

      ctx.globalAlpha=alpha;
      ctx.fillStyle=i%2?style.secondary:style.primary;
      ctx.strokeStyle=ctx.fillStyle;

      if(style.kind==='ember'){
        ctx.fillRect(Math.round(x-size),Math.round(y-size*.55),Math.max(2,Math.round(size*2)),Math.max(2,Math.round(size*1.1)));
        if(i<3){ctx.globalAlpha=alpha*.55;ctx.fillStyle=style.secondary;ctx.fillRect(Math.round(x-motionDir*3),Math.round(y-3),2,2)}
      }else if(style.kind==='frost'){
        ctx.lineWidth=1;
        ctx.beginPath();ctx.moveTo(x-size*1.6,y);ctx.lineTo(x+size*1.6,y);ctx.moveTo(x,y-size*1.6);ctx.lineTo(x,y+size*1.6);ctx.stroke();
      }else if(style.kind==='sparkle'){
        ctx.lineWidth=1;
        ctx.beginPath();ctx.moveTo(x-size*1.8,y);ctx.lineTo(x+size*1.8,y);ctx.moveTo(x,y-size*1.8);ctx.lineTo(x,y+size*1.8);ctx.stroke();
        ctx.fillRect(Math.round(x-1),Math.round(y-1),2,2);
      }else if(style.kind==='wisp'){
        ctx.lineWidth=Math.max(1,2.2*(1-q));
        ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x-motionDir*5,y+Math.sin(phase+.8)*4,x-motionDir*10,y+Math.sin(phase+1.3)*2);ctx.stroke();
      }else if(style.kind==='dust'){
        ctx.fillRect(Math.round(x-size*.7),Math.round(y-size*.7),Math.max(2,Math.round(size*1.4)),Math.max(2,Math.round(size*1.4)));
      }else{
        ctx.beginPath();ctx.arc(x,y,size*.75,0,Math.PI*2);ctx.fill();
      }
    }

    ctx.globalAlpha=fade*.34;
    ctx.fillStyle=style.secondary;
    ctx.fillRect(Math.round(originX-1),Math.round(originY-1),3,3);
    ctx.restore();
  }

  function visualLeadSeconds(){
    if(state.headless||state.fastForwarding)return 0;
    return clamp(Number(state.renderLead)||0,0,FIXED_SIM_DT);
  }
  function visualEntity(e,lead=visualLeadSeconds()){
    if(!e||lead<=.0001)return e;
    const vx=Number(e.vx)||0,vy=Number(e.vy)||0;
    if(Math.abs(vx)<.00001&&Math.abs(vy)<.00001)return e;
    return{
      ...e,
      x:safeX(e.x+vx*lead),
      y:safeY(e.y+vy*lead),
      animElapsed:(Number(e.animElapsed)||0)+lead
    };
  }
  function visualBall(lead=visualLeadSeconds()){
    const b=state.ball;if(!b||lead<=.0001||state.carrier)return b;
    return{...b,x:safeX(b.x+(Number(b.vx)||0)*lead),y:safeY(b.y+(Number(b.vy)||0)*lead)};
  }
  function visualCamera(lead=visualLeadSeconds()){
    const c=state.camera;if(!c||lead<=.0001)return c;
    const zoom=clamp(c.zoom+(Number(c.vz)||0)*lead,.985,1.095);
    const bounds=cameraBoundsForZoom(Math.max(1,zoom));
    return{
      ...c,
      x:clamp(c.x+(Number(c.vx)||0)*lead,bounds.x0,bounds.x1),
      y:clamp(c.y+(Number(c.vy)||0)*lead,bounds.y0,bounds.y1),
      zoom
    };
  }

  function render(){
    const canvas=$('wcgCanvas');if(!canvas)return;const ctx=canvas.getContext('2d');if(!ctx||!state.assets.arena)return;ctx.clearRect(0,0,W,H);ctx.save();const replayFrame=currentReplayFrame(),lead=visualLeadSeconds(),gc=state.celebration,shakeAmp=!replayFrame&&gc?(gc.grounded?4.8:2.6):0,shakeX=gc&&!replayFrame?(Math.sin((gc.elapsed+lead)*31)*shakeAmp+Math.sin((gc.elapsed+lead)*53)*shakeAmp*.34):0,shakeY=gc&&!replayFrame?(Math.cos((gc.elapsed+lead)*37)*shakeAmp*.55+Math.sin((gc.elapsed+lead)*67)*shakeAmp*.22):0,rc=replayFrame?.camera||visualCamera(lead),replayZoom=replayFrame?clamp((replayFrame.camera?.zoom||1.03)+.035,1.035,1.105):rc.zoom,renderZoom=Math.round(replayZoom*200)/200,replayBounds=replayFrame?cameraBoundsForZoom(renderZoom):null,rawCamX=replayFrame?lerp(replayFrame.camera?.x||.5,replayFrame.ball?.x||.5,.18):rc.x,rawCamY=replayFrame?lerp(replayFrame.camera?.y||.5,replayFrame.ball?.y||.5,.12):rc.y,viewCamX=replayFrame?clamp(rawCamX,replayBounds.x0+.0015,replayBounds.x1-.0015):rawCamX,viewCamY=replayFrame?clamp(rawCamY,replayBounds.y0+.0015,replayBounds.y1-.0015):rawCamY,camX=Math.round(viewCamX*W),camY=Math.round(viewCamY*H);ctx.translate(Math.round(W/2+shakeX),Math.round(H/2+shakeY));ctx.scale(renderZoom,renderZoom);ctx.translate(-camX,-camY);ctx.imageSmoothingEnabled=false;ctx.drawImage(state.assets.arena,0,0,W,H);drawArenaAmbience(ctx,'back');if(replayFrame){drawReplayScene(ctx,replayFrame);ctx.restore();return}drawTournamentEnvironment(ctx);drawGoalCelebrationEffects(ctx,'back');
    const prematchMounted=state.phase==='intro'&&!!state.kickoffMount;
    const standing=!state.careerMode&&((state.phase==='intro'&&!prematchMounted)||state.phase==='secondcountdown'||(state.phase==='halftime'&&state.halftimeElapsed>2.15));
    if(state.celebration){
      const c=state.celebration;
      // Subtle scorer-only themed broom trail, behind the standing sprites.
      drawScorerBroomTrail(ctx,c,lead);
      for(const e of state.entities){
        const ve=visualEntity(e,lead);
        const celebratingOnFloor=e.team===c.team&&!state.careerMode;
        // Use the SAME arena floor anchoring system as the normal grounded
        // presentation. We preserve horizontal choreography, but deliberately
        // clamp the visual Y to logical ground so feet are planted on every map.
        const ce=celebratingOnFloor
          ?{...ve,y:groundedY(0),dir:standingRenderDir(e)}
          :ve;
        drawSprite(
          ctx,
          state.assets[e.player.id+(celebratingOnFloor?'Standing':'Riding')],
          ce,
          playerSpriteHeight(e,celebratingOnFloor),
          celebratingOnFloor
        );
      }
      const rr={...visualEntity(state.ref,lead),player:{name:REFEREE_LABEL}};drawSprite(ctx,state.assets.refFlying,rr,REF_FLY_HEIGHT,false);drawGoalCelebrationEffects(ctx,'front');
    }else if(prematchMounted){
      for(const e of state.entities)drawSprite(ctx,state.assets[e.player.id+'Riding'],visualEntity(e,lead),playerSpriteHeight(e,false),false);
      const rr={...visualEntity(state.ref,lead),player:{name:REFEREE_LABEL},dir:1};drawSprite(ctx,state.assets.refStanding,rr,REF_STAND_HEIGHT,true);
      if(state.ball.visible){const vb=visualBall(lead);drawBall(ctx,vb.x,vb.y,!!state.kickoffToss)};
    }else if(standing){
      for(const e of state.entities){
        // Grounded broadcast sections use the supplied artwork's actual native
        // facing, then flip only when needed so both teams face into the pitch.
        const groundedEntity={...visualEntity(e,lead),dir:standingRenderDir(e)};
        drawSprite(ctx,state.assets[e.player.id+'Standing'],groundedEntity,playerSpriteHeight(e,true),true);
      }
      const rr={...visualEntity(state.ref,lead),player:{name:REFEREE_LABEL},dir:1};drawSprite(ctx,state.assets.refStanding,rr,REF_STAND_HEIGHT,true);
      if(state.ball.visible){const vb=visualBall(lead);drawBall(ctx,vb.x,vb.y,false)};
    }else{
      for(const e of state.entities)drawSprite(ctx,state.assets[e.player.id+'Riding'],visualEntity(e,lead),playerSpriteHeight(e,false),false);
      const rr={...visualEntity(state.ref,lead),player:{name:REFEREE_LABEL}};drawSprite(ctx,state.assets.refFlying,rr,REF_FLY_HEIGHT,false);
      if(state.ball.visible){
        const vc=state.carrier?visualEntity(state.carrier,lead):null,vb=visualBall(lead);
        const hold=vc?ballHoldPoint(vc):null;
        drawBall(ctx,hold?hold.x:vb.x,hold?hold.y:vb.y,!!state.ball.flight);
      }
    }
    drawArenaAmbience(ctx,'front');
    if(adminEnabled()&&new URLSearchParams(location.search).get('wcDebug')==='1'){
      ctx.save();ctx.font='700 10px monospace';ctx.textAlign='left';
      for(const e of state.entities){const x=e.x*W+18,y=e.y*H-38;ctx.fillStyle='rgba(0,0,0,.72)';ctx.fillRect(x-4,y-11,126,29);ctx.fillStyle='#fff4bf';ctx.fillText(`${e.player.name} · ${e.reactionState||'playing'} / ${e.animState||'IDLE'}`,x,y);ctx.fillStyle='#bfe9ff';ctx.fillText(`${e.responsibility||e.intent} · ${Math.hypot(e.vx,e.vy).toFixed(2)}`,x,y+12);ctx.strokeStyle='rgba(255,244,191,.55)';ctx.beginPath();ctx.moveTo(e.x*W,e.y*H);ctx.lineTo(e.tx*W,e.ty*H);ctx.stroke()}
      ctx.fillStyle='rgba(0,0,0,.78)';ctx.fillRect(10,10,310,124);
      ctx.fillStyle='#fff4bf';ctx.fillText(`BALL · ${state.ball.state||'HELD'} · owner ${state.ball.owner||'none'}`,18,28);
      ctx.fillStyle='#bfe9ff';ctx.fillText(`v ${Number(state.ball.speed||0).toFixed(2)} · target ${state.ball.intendedReceiver||'none'}`,18,42);ctx.fillText(`xy ${Number(state.ball.x||0).toFixed(3)}, ${Number(state.ball.y||0).toFixed(3)}`,18,56);
      ctx.fillStyle='#9fffb0';ctx.fillText(`FAIRNESS · 50/50 baseline · bias 0`,18,72);ctx.fillText(`rubber-band OFF · scripted goals OFF`,18,86);
      ctx.fillStyle='#fff4bf';ctx.fillText(`BEL ${state.teamTactics?.belros?.state||'-'} · risk ${Number(state.teamTactics?.belros?.risk||0).toFixed(2)} | ZAF ${state.teamTactics?.zafran?.state||'-'} · risk ${Number(state.teamTactics?.zafran?.risk||0).toFixed(2)}`,18,102);ctx.fillStyle='#9fffb0';ctx.fillText(`FLOW · ${state.matchFlow?.currentPhase||'-'} · ${state.matchFlow?.template?.id||'-'} · ${state.matchFlow?.tempo||'-'}`,18,116);
      ctx.restore();
    }
    ctx.restore();
  }

  function simulateFixedStep(dt){
    if(!state.open||matchdayPaused())return;
    state.engineElapsed+=dt;state.simClockMs+=dt*1000;
    const rawDt=dt,scaledDt=dt*state.speed;
    if(state.eventBannerTimer>0){state.eventBannerTimer-=scaledDt;if(state.eventBannerTimer<=0)$('wcgEventBanner')?.classList.remove('is-visible')}
    if(state.bigMomentTimer>0){state.bigMomentTimer-=rawDt;if(state.bigMomentTimer<=0)hideBigMoment()}
    if(state.celebration)updateGoalCelebration(rawDt);
    if(state.crowdBoost>0)state.crowdBoost=Math.max(0,state.crowdBoost-rawDt*.16);
    audio.updateCrowdAccents(rawDt);updateStoryGraphics(rawDt);
    if(state.replayIntro){updateReplayIntro(rawDt);updateCamera(rawDt);return}
    if(state.replay){updateReplay(rawDt);updateCamera(rawDt);return}
    if(state.replayOutro){updateReplayOutro(rawDt);updateCamera(rawDt);return}
    if(state.phase==='intro')updateIntro(rawDt);
    else if(state.phase==='first'||state.phase==='second'){
      const liveDt=scaledDt*LIVE_TEMPO;
      // The match clock keeps running through ordinary foul stoppages AND the
      // short penalty setup. Presentation can pause while official time continues.
      const clockRuns=!state.celebration&&(!state.special||state.special.type==='penalty');
      if(clockRuns){
        const remaining=(state.management&&state.phase==='first'?MATCH_SECONDS/2:MATCH_SECONDS)-state.matchTime;
        const playedDt=Math.min(scaledDt,Math.max(0,remaining));matchdayEnergyStep(playedDt);state.matchTime+=playedDt;
        // Do not award possession time while a penalty is being staged.
        if(!state.special&&state.possession&&state.teamStats[state.possession])state.teamStats[state.possession].possession+=scaledDt;
        if(!state.special&&state.carrier?.player?.id&&state.playerStats[state.carrier.player.id])state.playerStats[state.carrier.player.id].possession+=scaledDt;
      }
      if(state.management&&state.phase==='first'&&state.matchTime>=MATCH_SECONDS/2){state.matchTime=MATCH_SECONDS/2;beginHalftime();return}
      if((state.phase==='first'||state.phase==='second')&&state.matchTime>=MATCH_SECONDS){state.matchTime=MATCH_SECONDS;const aggHome=Number(state.score.belros||0)+Number(state.fixture?.aggregateHomeOffset||0),aggAway=Number(state.score.zafran||0)+Number(state.fixture?.aggregateAwayOffset||0),needsDecider=!!state.fixture?.knockoutDecider&&aggHome===aggAway;if(needsDecider)beginShootout();else finishMatch(false)}
      if(state.management&&['first','second'].includes(state.phase)){matchdayAiChanges();matchdayProcessPending()}
      if((state.phase==='first'||state.phase==='second')&&!state.celebration){updateMatchFlowDirector(liveDt);updateFlight(liveDt);
        // Career kickoff safety net: if a moving receiver or browser stall ever prevents
        // the release animation callback, hand over possession instead of freezing at kickoff.
        if(state.kickoffReceiver){state.kickoffWatchdog=Math.max(0,(state.kickoffWatchdog||0)-liveDt);if(state.kickoffWatchdog<=0){const receiver=state.kickoffReceiver;state.ball.flight=null;state.kickoffReceiver=null;setPossession(receiver.team,receiver,.12);scheduleNext(.45,.80)}}
        updateDelay(liveDt);if(state.special?.type==='var')updateVar(liveDt);else if(state.special?.type==='penalty')updatePenalty(liveDt);if(!state.special&&!state.delay&&!state.ball.flight){state.actionTimer-=liveDt;if(state.actionTimer<=0)nextAction()}}
    }else if(state.phase==='halftime'){if(!state.management)updateHalftimePresentation(rawDt)}
    else if(state.phase==='secondcountdown')updateSecondHalfCountdown(rawDt);
    else if(state.phase==='shootout'){updateFlight(scaledDt);updateDelay(scaledDt);if(state.special?.type==='penalty')updatePenalty(scaledDt)}
    else if(state.phase==='fulltime')updateFulltimePresentation(rawDt);
    const entityDt=(state.phase==='first'||state.phase==='second')&&!state.celebration?scaledDt*LIVE_TEMPO:scaledDt;
    updateEntities(entityDt);syncHeldBallToCarrier();captureReplayFrame(rawDt);updateBroadcastDirector(rawDt);updateCamera(rawDt);
  }

  function catchUpTo(targetSeconds,maxSteps=36000,maxWorkMs=Infinity){
    targetSeconds=Math.max(0,Number(targetSeconds)||0);
    let steps=0;const wasFast=state.fastForwarding,lag=Math.max(0,targetSeconds-state.engineElapsed);
    const started=Number.isFinite(maxWorkMs)?performance.now():0;
    state.fastForwarding=state.headless||lag>.35;
    try{
      while(state.open&&!matchdayPaused()&&state.engineElapsed+FIXED_SIM_DT<=targetSeconds+1e-8&&steps<maxSteps){
        // Visible viewers get a strict main-thread budget. If a server sample or
        // browser stall leaves us seconds behind, catch up over several smooth RAFs
        // instead of running 60-120 deterministic ticks in one giant frozen frame.
        if(Number.isFinite(maxWorkMs)&&steps>0&&performance.now()-started>=maxWorkMs)break;
        simulateFixedStep(FIXED_SIM_DT);steps++;
      }
    }finally{state.fastForwarding=wasFast}
    return steps;
  }

  // Headless hosting shares the browser main thread with the homepage. Never let
  // a background Repo Sports catch-up monopolise that thread: advance in tiny
  // deterministic slices and yield between them. This keeps Harmony clicks, menus
  // and ordinary site scrolling responsive while the hidden match still progresses.
  let headlessCatchupTimer=0,headlessCatchupTarget=0;
  function scheduleHeadlessCatchUp(targetSeconds){
    if(!state.open||!state.headless)return;
    headlessCatchupTarget=Math.max(headlessCatchupTarget,Math.max(0,Number(targetSeconds)||0));
    if(headlessCatchupTimer)return;
    const run=()=>{
      headlessCatchupTimer=0;
      if(!state.open||!state.headless)return;
      catchUpTo(headlessCatchupTarget,180,3.25);
      if(state.engineElapsed+FIXED_SIM_DT<=headlessCatchupTarget+1e-8){
        headlessCatchupTimer=setTimeout(run,10);
      }
    };
    headlessCatchupTimer=setTimeout(run,0);
  }

  function update(ts){
    if(!state.open)return;
    if(!state.headless){updateBarryTipPolling(ts);updateV2WatchPartyPolling(ts);updateV2CareerPolling(ts);updateV2PlayerTagPolling(ts)}
    try{
      let target;
      if(state.syncMode)target=syncTargetElapsed();
      else target=localTargetElapsed();
      state.lastTs=ts;
      // Visible viewers must never perform an enormous catch-up burst in one RAF.
      // Normal polling keeps this tiny; after a suspended tab we spread any larger
      // forward catch-up over a few frames instead of freezing the entire broadcast.
      const lag=Math.max(0,target-state.engineElapsed);
      // Keep normal play essentially one-tick exact, but make recovery from an
      // unusual stall time-budgeted. 7 ms is small enough to preserve smooth
      // animation even if the browser was delayed by several seconds.
      const visibleCatchupSteps=lag>2?90:lag>.65?45:18;
      const workBudgetMs=lag>2?7:lag>.65?5.5:4;
      catchUpTo(target,state.headless?36000:visibleCatchupSteps,state.headless?Infinity:workBudgetMs);
      // Presentation-only fractional motion between authoritative 30 Hz ticks.
      // This value never feeds back into simulation/gameplay.
      state.renderLead=clamp(target-state.engineElapsed,0,FIXED_SIM_DT);
      if(!state.headless){updateScoreUi();render();state.lastRenderAt=performance.now()}
    }catch(err){
      console.error('[Repo Sports Quidditch] recovered frame error',err);
      state.lastTs=ts;if(state.ball&&!state.carrier&&!state.ball.flight)state.ball.state='LOOSE';
    }
    if(!state.headless)state.raf=requestAnimationFrame(update);
  }

  // SMOOTH RESUME SYNC: background tabs stop consuming stale local time. On
  // return we ask the parent for a genuinely fresh server sample. Rendering
  // still uses requestAnimationFrame and is never tied to the 500 ms poll rate.
  document.addEventListener('visibilitychange',()=>{
    if(!state.open||!state.syncMode)return;
    state.lastTs=0;
    state.syncAwaitingFreshSample=true;
    if(!document.hidden){
      try{if(window.parent&&window.parent!==window)window.parent.postMessage({type:'repo-sports-v2-live-state-request',headless:state.headless,reason:'visibility-resume',fresh:true},'*')}catch(_){}
    }
  });


  async function joinMatchChannel(){state.channel=null;state.subscribed=false;}
  async function sendMatch(){return false;}
  async function leaveMatchChannel(){state.channel=null;state.subscribed=false;}

  function setSpeed(speed,broadcast=false){
    state.speed=speed===4?4:1;
    const b=$('wcgSpeed');
    if(b)b.textContent=state.speed===1?'TEST SPEED ×4':'RETURN TO ×1';
  }
  function toggleSpeed(){if(state.syncMode||!adminEnabled())return;setSpeed(state.speed===1?4:1,false)}

  async function openBroadcast(opts={}){
    if(state.open){
      const existing=$('wcWorldCupBroadcast');
      if(existing){existing.classList.add('is-open');existing.setAttribute('aria-hidden','false');return true}
      state.open=false;
    }
    stopCareerHeartbeat();
    if(state.opening)return false;
    state.opening=true;state.lastOpenError=null;
    try{
      createUi();applyFixtureConfig(opts);refreshFixtureUi();await preload();
      state.open=true;state.opening=false;state.rotationQueued=false;state.rotationAnnounceAt=0;
      state.careerMode=!!opts.careerMode;state.onCareerComplete=typeof opts.onComplete==='function'?opts.onComplete:null;state.onCareerClose=typeof opts.onClose==='function'?opts.onClose:null;state.careerDelivered=false;state.audioDisabled=!!opts.disableAudio;
      state.syncMode=!!opts.syncMode;state.headless=!!opts.headless;state.liveSerial=Math.max(0,Number(opts.liveSerial)||0);state.engineElapsed=0;state.simClockMs=0;state.renderLead=0;
      state.syncAnchorElapsed=Math.max(0,Number(opts.targetElapsedMs)||0)/1000;state.syncAnchorPerf=performance.now();state.syncRunning=opts.running!==false;state.syncAwaitingFreshSample=!!(state.syncMode&&document.hidden);state.syncLastSampleAt=0;
      state.startedAt=state.liveSerial||Number(opts.startedAt)||Date.now();
      state.seed=Number.isFinite(Number(opts.seed))?Number(opts.seed)>>>0:hashSeed(`${state.liveSerial||state.startedAt}|${activeFixture.id}|VELMORA_MANAGER_V21`);
      state.simRand=mulberry32(state.seed);
      state.disciplineRand=mulberry32(state.seed^0x27d4eb2d);
      state.visualRand=mulberry32(state.seed^0x9e3779b9);
      state.audioRand=mulberry32(state.seed^0x85ebca6b);
      // Barry/UI timing differs between browsers and must never advance simRand.
      state.commentaryRand=mulberry32(state.seed^0xc2b2ae35);
      cancelRecordedPrematchIntro();
      state.phase='intro';state.introElapsed=0;
      state.recordedPrematchIntro=state.careerMode?null:buildRecordedPrematchIntroPlan();
      if(!state.headless&&!state.careerMode)preloadRecordedPrematchIntro(state.recordedPrematchIntro);
      state.matchTime=0;state.speed=1;state.half=1;state.firstKickoff='belros';state.score={belros:0,zafran:0};
      state.shootout=null;state.special=null;state.delay=null;state.celebration=null;state.reactionHistory={};state.reactionSerial=0;state.refReaction=null;state.varContext=null;state.actionTimer=2.5;
      state.ball={x:.5,y:.5,vx:0,vy:0,speed:0,direction:0,flight:null,visible:true,state:'HELD',owner:null,previousOwner:null,currentOwner:null,intendedReceiver:null,predictedDestination:null,lastTouchedBy:null};
      state.pendingPass=null;state.possessionChangedAt=simNow();state.loreUsed=new Set();state.introCue=-1;state.presentationKey='';state.broadcastState='PRE_MATCH';state.broadcastSequence={state:'fixtureIntro',elapsed:0,serial:1,frozen:true,skipped:false};
      state.halftimeElapsed=0;state.halftimeReady=false;state.halftimeWaitSlide=-1;state.secondCountdown=0;state.fulltimeElapsed=0;state.fulltimeData=null;state.events=[];state.disciplineEvents=[];state.kickoffToss=null;state.kickoffMount=null;state.kickoffReceiver=null;state.kickoffWatchdog=0;state.prematchAudioFailed=false;
      state.prediction={pick:null,locked:false,resolved:false,correct:false,rewardPaid:false,rewardAttempted:false,rewardMessage:'',matchKey:String(opts.matchKey||`v2-live-${state.liveSerial||1}`),counts:{belros:0,zafran:0,total:0},lastPoll:0,polling:false};
      barryTipState.busy=false;barryTipState.tipped=false;barryTipState.matchId=null;barryTipState.lastRefresh=0;barryTipState.polling=false;renderBarryTipState('LOADING…');
      v2WatchPartyState.lastRefresh=0;v2WatchPartyState.polling=false;v2WatchPartyState.signature='';v2WatchPartyState.recentCards.clear();v2PlayerTagsState.signature='';
      if(!state.headless&&!state.careerMode)startV2WatchXpHeartbeat();
      v2CareerState.lastRefresh=0;v2CareerState.polling=false;v2CareerState.signature='';v2CareerState.data=null;renderV2CareerBoard();
      state.replay=null;state.replayIntro=null;state.replayOutro=null;state.replayBuffer=[];state.replayCaptureAccum=0;state.lastReplayAt=-999;state.chanceBuild=null;initMatchFlowDirector();
      state.storyGraphicTimer=34;state.storyGraphicUntil=0;state.storyGraphicIndex=0;hideBigMoment();state.cameraDirector={shot:'MAIN',timer:3.5,lastShot:'',cutSerial:0};state.camera={x:.5,y:.5,zoom:1,tx:.5,ty:.5,tz:1,shake:0,vx:0,vy:0,vz:0,mode:'LIVE_BROADCAST'};
      state.lastTs=0;state.crowdBoost=0;state.movementPulse=.12;state.tacticalPulse=0;
      state.broadcast={lastSpokenAt:0,lastText:'',recent:[],recentSkeletons:[],queue:null,barryState:'NEUTRAL',barryPriority:0,barryUntil:0,barryTimer:0,talkTimer:0,phaseSeen:'',crowdLevel:.12,crowdTarget:.12,speaking:false,debugEvent:'IDLE',voiceName:'TEXT ONLY',variantCount:BARRY_COMMENTARY_VARIANTS};
      state.director={phase:'BUILD-UP',momentum:{belros:0,zafran:0},pressure:{belros:0,zafran:0},recent:[],pulse:0};
      initMatchday();resetStats();createEntities();if(!state.headless)primeBarryVoice();
      if(!state.headless&&!state.audioDisabled){audio.currentMatchMusicIndex=audio.chooseMatchMusicStart();audio.start()}if(!state.careerMode)await joinMatchChannel();
      const root=$('wcWorldCupBroadcast');root.dataset.careerMode=state.careerMode?'true':'false';if($('wcgManage'))$('wcgManage').hidden=!state.careerMode;$('wcgMatchdayPanel')?.setAttribute('hidden','');root.classList.add('is-open');root.setAttribute('aria-hidden','false');$('wcgHalftime')?.classList.remove('is-open');$('wcgFulltime')?.classList.remove('is-open');hidePresentation();$('wcgVar')?.classList.remove('is-open','is-decision');
      const admin=adminEnabled()&&!state.syncMode&&!state.careerMode;if($('wcgSpeed'))$('wcgSpeed').hidden=!admin;if($('wcgSkipHalf'))$('wcgSkipHalf').hidden=true;if($('wcgAdminEvents'))$('wcgAdminEvents').hidden=!admin;if($('wcgAdminPanel'))$('wcgAdminPanel').hidden=true;if($('wcgCareerSkip'))$('wcgCareerSkip').hidden=!state.careerMode;if($('wcgReturnLobby'))$('wcgReturnLobby').hidden=!state.careerMode;if($('wcgExit'))$('wcgExit').textContent=state.careerMode?'RETURN TO MATCHDAY':'EXIT BROADCAST';
      setSpeed(1,false);setBroadcastState('PRE_MATCH');if(!state.headless){say(commentary.intro[0]);showBanner('VELMORA MANAGER · QUIDDITCH','',2.0);updatePrematchPresentation();if(!state.careerMode){updatePredictionUi();void refreshPredictionCounts(true);void refreshBarryTipState(true);void refreshV2WatchParty(true);void refreshV2CareerBoard(true);requestV2PlayerTags(true)}}updateKickoffToss(0);
      if(state.headless)scheduleHeadlessCatchUp(state.syncAnchorElapsed);
      else catchUpTo(state.syncAnchorElapsed,36000);
      if(!state.syncMode){state.localClockAnchorElapsed=state.engineElapsed;state.localClockAnchorPerf=performance.now()}
      // Start/seek the supplied drums AFTER deterministic catch-up. A viewer
      // joining 12 seconds into prematch hears the track from ~12s, not from 0.
      if(!state.headless&&!state.audioDisabled&&state.phase==='intro')audio.startPrematch(state.introElapsed);
      if(!state.headless){updateScoreUi();render();state.lastRenderAt=performance.now();state.raf=requestAnimationFrame(update);if(state.careerMode)startCareerHeartbeat()}return true;
    }catch(error){
      state.lastOpenError=String(error?.message||error);console.error(state.careerMode?'[VELMORA QUIDDITCH] Match open failed':'[REPO SPORTS V2] Match open failed',error);cancelRecordedPrematchIntro();stopCareerHeartbeat();stopV2WatchXpHeartbeat();state.open=false;state.opening=false;try{cancelAnimationFrame(state.raf)}catch(_){}const root=$('wcWorldCupBroadcast');root?.classList.remove('is-open');root?.setAttribute('aria-hidden','true');try{audio.stop()}catch(_){}return false;
    }
  }

  async function closeBroadcast(broadcastClose=false){
    if(!state.open)return;matchdayHide();const closeCb=state.careerMode&&!state.careerDelivered?state.onCareerClose:null;cancelRecordedPrematchIntro();stopCareerHeartbeat();clearTimeout(headlessCatchupTimer);headlessCatchupTimer=0;headlessCatchupTarget=0;clearTimeout(v2PlayerTagsState.timeout);v2PlayerTagsState.pending=false;v2PlayerTagsState.requestId='';stopV2WatchXpHeartbeat();if(broadcastClose&&isHost()&&!state.careerMode)await sendMatch('close',{host:'CatAsthma'});state.open=false;cancelAnimationFrame(state.raf);state.phase='closed';setBroadcastState('CLOSED');hidePresentation();clearBarryTimers();cancelBarryAudio();audio.stop();if(!state.careerMode)await leaveMatchChannel();const root=$('wcWorldCupBroadcast');root?.classList.remove('is-open');root?.setAttribute('aria-hidden','true');try{if(typeof closeCb==='function')closeCb()}catch(error){console.error('[VELMORA QUIDDITCH] Career close callback failed',error)}
  }

  async function syncLive(meta={}){
    const serial=Math.max(0,Number(meta.match_serial)||0);if(!serial)return false;
    if(state.open&&state.liveSerial&&serial!==state.liveSerial)return false;

    const now=performance.now();
    const transportMs=clamp(Number(meta.transport_comp_ms)||0,0,250);
    // active_elapsed_ms is authoritative server simulation time. Half the measured
    // RPC round-trip is added by the parent, then every viewer deliberately plays
    // 120 ms behind that estimate. This small common buffer absorbs normal jitter.
    const sampledElapsed=Math.max(0,(Number(meta.active_elapsed_ms)||0)/1000 + transportMs/1000 - LIVE_PLAYOUT_DELAY);
    const running=meta.running!==false;

    state.syncMode=true;
    state.liveSerial=serial;

    const wasWaiting=state.syncAwaitingFreshSample;
    const projected=syncTargetElapsed();
    const error=sampledElapsed-projected;

    if(wasWaiting||!state.syncLastSampleAt||Math.abs(error)>1.25){
      // First sample / tab resume / major correction: snap the CLOCK anchor. The
      // wrapper rebuilds from the deterministic seed when actual simulation drift
      // is large, so this never mutates gameplay backwards in-place.
      state.syncAnchorElapsed=sampledElapsed;
    }else{
      // Normal 500 ms samples only nudge the local projection by up to 45 ms.
      // This keeps two browsers converging without a visible hitch every poll.
      state.syncAnchorElapsed=projected+clamp(error,-.045,.045);
    }
    state.syncAnchorPerf=now;
    state.syncRunning=running;
    state.syncAwaitingFreshSample=false;
    state.syncLastSampleAt=now;

    if(state.headless)scheduleHeadlessCatchUp(syncTargetElapsed());
    return true;
  }

  function pauseForProfile(){if(!state.open||!state.careerMode||!state.management)return null;const token={management:state.management,paused:state.management.paused};state.management.paused=true;matchdayRebaseClock();return token;}
  function resumeFromProfile(token){if(!token||state.management!==token.management)return;state.management.paused=token.paused;matchdayRebaseClock();}
  window.VelmoraQuidditchEngine={pauseForProfile,resumeFromProfile,attributesFromCareerPlayer:player=>careerQuality(player,true).attributes,getPlayerQuality:()=>allPlayers.map(p=>({id:p.id,role:p.careerRole||p.role,source:p.qualitySource||'exhibition',ovr:p.careerMeta?.ovr??null,attributes:{...(entityById(p.id)?.attributes||p.engineAttributes||{})}})),manageTeam:matchdayShow,getMatchday:matchdayReport,open:openBroadcast,close:closeBroadcast,skipToFulltime:skipCareerToFulltime,getStatus:()=>({version:'V24.1 AUDIO',lastOpenError:state.lastOpenError||null,source:'RepoSports V2',open:state.open,opening:state.opening,careerMode:state.careerMode,fixture:activeFixture?.id||null,venue:activeFixture?.venue||'',stadiumClubId:activeFixture?.stadiumClubId||null,stadiumArtworkUrl:state.stadiumArtworkUrl||null,stadiumFallbackUsed:!!state.stadiumFallbackUsed,seed:state.seed,phase:state.phase,matchTime:state.matchTime,score:{...state.score},shootout:state.shootout?{score:{...state.shootout.score},attempts:{...state.shootout.attempts}}:null,tactics:state.teamTactics?{home:{club:teamMeta.belros.name,profile:tacticalDescriptor('belros')},away:{club:teamMeta.zafran.name,profile:tacticalDescriptor('zafran')}}:null,assetsKey:state.assetsKey||'',audioDisabled:state.audioDisabled,playerCount:allPlayers.length,ballState:state.ball?.state||null,hasCarrier:!!state.carrier,kickoffPending:!!state.kickoffReceiver})};
})();
