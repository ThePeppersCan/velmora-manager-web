(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.VelmoraClubPulse=api;
})(typeof window==='object'?window:globalThis,function(){
  'use strict';

  const VERSION=1;
  const AUDIENCES=Object.freeze({
    board:{key:'board',label:'BOARD',singular:'the board',priority:'Delivery, control and the owner’s mandate'},
    dressing:{key:'dressing',label:'DRESSING ROOM',singular:'the dressing room',priority:'Trust, fairness and promises kept'},
    supporters:{key:'supporters',label:'SUPPORTERS',singular:'supporters',priority:'Identity, ambition and matchday belief'},
    press:{key:'press',label:'PRESS',singular:'the press',priority:'Access, credibility and stories that hold up'}
  });
  const clamp=(value,min=0,max=100)=>Math.max(min,Math.min(max,Number(value)||0));
  const daysBetween=(a,b)=>Math.round((new Date(`${b}T12:00:00Z`)-new Date(`${a}T12:00:00Z`))/86400000);
  const addDays=(iso,days)=>{const d=new Date(`${iso}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+Number(days||0));return d.toISOString().slice(0,10);};
  const serial=value=>String(value||'').replace(/[^A-Za-z0-9_-]+/g,'-').replace(/^-|-$/g,'').toUpperCase();

  function normalizeMemory(memory={}){
    return{
      id:String(memory.id||''),date:String(memory.date||''),audience:String(memory.audience||''),source:String(memory.source||'CAREER'),
      title:String(memory.title||'A moment remembered'),summary:String(memory.summary||''),valence:clamp(memory.valence,-1,1),
      strength:clamp(memory.strength,1,5),decayDays:Math.max(30,Number(memory.decayDays||240)),tags:Array.isArray(memory.tags)?memory.tags.slice(0,5):[],
      subjectId:memory.subjectId||null,choiceId:memory.choiceId||null,visible:memory.visible!==false,resolvedOutcomeId:memory.resolvedOutcomeId||null
    };
  }
  function seedMemory(clubId,audience,date){
    const copy={
      board:['Opening mandate','The board will judge delivery against the club plan, resources and the owner’s priorities.'],
      dressing:['First impressions','Players are forming a view through selection, honesty and how pressure is handled.'],
      supporters:['A new tenure','Supporters are waiting to see whether the team reflects the ambition and identity of the club.'],
      press:['Opening scrutiny','The media relationship begins professionally. Access and credibility will shape what follows.']
    }[audience];
    return normalizeMemory({id:`PULSE-SEED-${serial(clubId)}-${audience.toUpperCase()}`,date,audience,source:'TENURE',title:copy[0],summary:copy[1],valence:0,strength:1,decayDays:9999,tags:['TENURE BEGINS']});
  }
  function normalizeAudience(value={},key,clubId,date){
    const memories=(Array.isArray(value.memories)?value.memories:[]).map(normalizeMemory).filter(row=>row.id&&row.audience===key).slice(-48);
    if(!memories.length)memories.push(seedMemory(clubId,key,date));
    return{key,memories,lastScore:Number.isFinite(Number(value.lastScore))?clamp(value.lastScore):null,lastUpdated:value.lastUpdated||date};
  }
  function normalizeState(value={}){
    const src=value&&typeof value==='object'?value:{};
    const state={version:VERSION,sequence:Math.max(0,Number(src.sequence||0)),clubs:{},pendingOutcomes:Array.isArray(src.pendingOutcomes)?src.pendingOutcomes.filter(Boolean).slice(-120):[],resolvedOutcomes:Array.isArray(src.resolvedOutcomes)?src.resolvedOutcomes.filter(Boolean).slice(-180):[],lastProcessDate:src.lastProcessDate||null};
    Object.entries(src.clubs&&typeof src.clubs==='object'?src.clubs:{}).forEach(([clubId,club])=>{
      state.clubs[clubId]={clubId,audiences:{}};
      Object.keys(AUDIENCES).forEach(key=>state.clubs[clubId].audiences[key]=normalizeAudience(club?.audiences?.[key],key,clubId,club?.createdDate||'2026-08-01'));
    });
    return state;
  }
  function ensureClub(state,clubId,date='2026-08-01'){
    if(!state.clubs[clubId])state.clubs[clubId]={clubId,createdDate:date,audiences:{}};
    const club=state.clubs[clubId];
    Object.keys(AUDIENCES).forEach(key=>club.audiences[key]=normalizeAudience(club.audiences[key],key,clubId,date));
    return club;
  }
  function nextId(state,prefix='PULSE'){
    state.sequence=Math.max(0,Number(state.sequence||0))+1;
    return `${prefix}-${String(state.sequence).padStart(5,'0')}`;
  }
  function remember(state,payload={}){
    const club=ensureClub(state,payload.clubId,payload.date),audience=club.audiences[payload.audience];
    if(!audience)throw new Error(`Unknown Club Pulse audience: ${payload.audience}`);
    const id=payload.id||nextId(state,'MEMORY'),existing=audience.memories.find(row=>row.id===id);
    if(existing)return existing;
    const row=normalizeMemory({...payload,id,audience:payload.audience});
    audience.memories.push(row);audience.memories=audience.memories.slice(-48);audience.lastUpdated=row.date;return row;
  }
  function schedule(state,payload={}){
    const existing=state.pendingOutcomes.find(row=>row.sourceId===payload.sourceId&&row.clubId===payload.clubId&&row.status==='PENDING');
    if(existing)return existing;
    const row={id:payload.id||nextId(state,'THREAD'),clubId:payload.clubId,sourceId:payload.sourceId||null,sourceKind:payload.sourceKind||'DECISION',createdDate:payload.createdDate,dueDate:payload.dueDate,title:payload.title||'A decision remains live',choiceId:payload.choiceId||null,choiceLabel:payload.choiceLabel||null,subjectId:payload.subjectId||null,evaluation:payload.evaluation||'CONTEXT',impacts:payload.impacts&&typeof payload.impacts==='object'?payload.impacts:{},status:'PENDING',hint:payload.hint||'People are waiting to see what follows.'};
    state.pendingOutcomes.push(row);state.pendingOutcomes=state.pendingOutcomes.slice(-120);return row;
  }
  function due(state,date,clubId=null){return state.pendingOutcomes.filter(row=>row.status==='PENDING'&&row.dueDate<=date&&(!clubId||row.clubId===clubId));}
  function settle(state,id,{date,verdict='MIXED',title='',copy='',impacts={}}={}){
    const row=state.pendingOutcomes.find(item=>item.id===id);if(!row||row.status!=='PENDING')return null;
    row.status='RESOLVED';row.resolvedDate=date;row.verdict=verdict;row.resolutionTitle=title;row.resolutionCopy=copy;row.resolvedImpacts=impacts;
    state.resolvedOutcomes.push({...row});state.resolvedOutcomes=state.resolvedOutcomes.slice(-180);return row;
  }
  function contribution(memory,date){
    if(!memory.date)return 0;const age=Math.max(0,daysBetween(memory.date,date)),life=Math.max(30,Number(memory.decayDays||240)),weight=Math.max(.12,1-age/life);
    return Number(memory.valence||0)*Number(memory.strength||1)*2.8*weight;
  }
  function trend(current,previous){const delta=Number(current)-Number(previous);return delta>=3?{key:'up',label:'Improving',glyph:'↗'}:delta<=-3?{key:'down',label:'Declining',glyph:'↘'}:{key:'steady',label:'Stable',glyph:'→'};}
  function snapshot(state,{clubId,date,baselines={},statuses={}}={}){
    const club=ensureClub(state,clubId,date),pending=state.pendingOutcomes.filter(row=>row.clubId===clubId&&row.status==='PENDING');
    return Object.keys(AUDIENCES).map(key=>{
      const audience=club.audiences[key],base=clamp(baselines[key]??55),memoryEffect=clamp(audience.memories.reduce((total,row)=>total+contribution(row,date),0),-22,22),score=clamp(Math.round(base+memoryEffect)),previous=audience.lastScore==null?score:audience.lastScore;
      const result={...AUDIENCES[key],score,base,memoryEffect,status:statuses[key]?.(score)||String(score),trend:trend(score,previous),memories:[...audience.memories].filter(row=>row.visible).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,6),pending:pending.filter(row=>row.impacts&&Object.prototype.hasOwnProperty.call(row.impacts,key)).length};
      audience.lastScore=score;audience.lastUpdated=date;return result;
    });
  }
  function audit(state){
    const clubs=Object.values(state.clubs||{}),audiences=clubs.flatMap(club=>Object.values(club.audiences||{})),memories=audiences.flatMap(audience=>audience.memories||[]);
    return{version:VERSION,clubs:clubs.length,audiences:audiences.length,memories:memories.length,independentStores:clubs.every(club=>Object.keys(AUDIENCES).every(key=>Array.isArray(club.audiences?.[key]?.memories))),boundedMemories:audiences.every(audience=>audience.memories.length<=48),pending:state.pendingOutcomes.filter(row=>row.status==='PENDING').length,resolved:state.resolvedOutcomes.length};
  }
  return Object.freeze({VERSION,AUDIENCES,normalizeState,ensureClub,remember,schedule,due,settle,snapshot,audit,addDays});
});
