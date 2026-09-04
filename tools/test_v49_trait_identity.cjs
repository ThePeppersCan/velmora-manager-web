const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const T=require('../player-traits.js'),{runtime}=require('./career_test_runtime.cjs');
const clone=v=>JSON.parse(JSON.stringify(v)),keys=['PAC','SHO','PAS','HAN','DEF','STA'];
const base=(id,extra={})=>({id,age:25,role:'PLAYMAKER',ovr:75,potential:80,stats:Object.fromEntries(keys.map(k=>[k,75])),storyTraits:{leadership:80,professionalism:85,temperament:80},...extra});
function check(p){
  const list=T.traits(p),groups={};assert(list.length<=4);assert.equal(new Set(p.playingTraits).size,list.length);
  assert(list.filter(t=>t.rarity==='RARE').length<=1);
  for(const t of list){assert(T.eligible(p,t));groups[t.group]=(groups[t.group]||0)+1;assert(groups[t.group]<=2);}
}
function measure(list){
  const counts=[0,0,0,0,0],frequency={},byRole={},byAge={},byRating={},byPotential={};
  const add=(obj,key,p)=>{const row=obj[key]||(obj[key]={players:0,counts:[0,0,0,0,0],traits:{}});row.players++;row.counts[p.playingTraits.length]++;for(const id of p.playingTraits)row.traits[id]=(row.traits[id]||0)+1;};
  for(const p of list){counts[p.playingTraits.length]++;for(const id of p.playingTraits)frequency[id]=(frequency[id]||0)+1;add(byRole,p.role,p);add(byAge,p.age<21?'under21':p.age<28?'21–27':'28+',p);add(byRating,p.ovr<65?'under65':p.ovr<80?'65–79':'80+',p);add(byPotential,p.potential>=90?'90+':p.potential>=80?'80–89':'under80',p);}
  return {players:list.length,counts,percent:counts.map(n=>+(100*n/list.length).toFixed(2)),frequency,byRole,byAge,byRating,byPotential};
}
const report={};
for(const [label,potential,target]of [['normal',80,[.35,.4,.2,.05,0]],['highPotential',94,[.15,.4,.3,.12,.03]]]){
  const list=Array.from({length:6000},(_,i)=>{const p=base(label+i,{potential});T.ensure(p,291);check(p);return p;});
  report[label]=measure(list);target.forEach((n,i)=>assert(Math.abs(report[label].counts[i]/list.length-n)<.025,`${label} count ${i} must track intended probability`));
}
const varied=Array.from({length:12000},(_,i)=>{
  const role=['ATTACKER','PLAYMAKER','DEFENDER','ALL-ROUNDER'][i%4],ovr=48+(Math.floor(i/4)%44),age=16+(Math.floor(i/176)%21);
  const stats=Object.fromEntries(keys.map((k,j)=>[k,Math.min(94,Math.max(35,ovr+((i*7+j*11)%13)-6))]));
  if(role==='ATTACKER'){stats.PAC=Math.min(94,ovr+9);stats.SHO=Math.min(94,ovr+12);stats.DEF=Math.max(35,ovr-15);}
  if(role==='PLAYMAKER'){stats.PAS=Math.min(94,ovr+12);stats.HAN=Math.min(94,ovr+9);}
  if(role==='DEFENDER'){stats.DEF=Math.min(94,ovr+12);stats.STA=Math.min(94,ovr+8);stats.SHO=Math.max(35,ovr-15);}
  const p=base('varied-'+i,{role,ovr,age,stats,potential:Math.min(94,ovr+(i%15)),storyTraits:{leadership:32+i%63,professionalism:60+i%36,temperament:35+i%60}});T.ensure(p,792);check(p);return p;
});
report.varied=measure(varied);assert.equal(Object.keys(report.varied.frequency).length,24);
const weakFast=base('fast',{role:'ATTACKER',stats:{PAC:90,SHO:65,PAS:43,HAN:42,DEF:35,STA:64}});
for(const id of ['close_control','tight_turner','glider'])assert.equal(T.weight(weakFast,id),0);
assert(T.weight(weakFast,'burst')>0);
const passer=base('passer',{stats:{PAC:52,SHO:50,PAS:85,HAN:76,DEF:48,STA:60}});
assert(T.weight(passer,'quick_link')>T.weight(passer,'long_arc'));
const defender=base('defender',{role:'DEFENDER',stats:{PAC:60,SHO:48,PAS:58,HAN:60,DEF:85,STA:78}});
assert.equal(T.weight(defender,'hoop_artist'),0);assert(T.weight(defender,'interceptor')>0);
assert.equal(T.weight(base('young',{age:17}),'veteran'),0);
assert.equal(T.weight(base('old-quiet',{age:34,storyTraits:{leadership:32}}),'captain_voice'),0);
assert.equal(T.weight(base('clumsy',{physical:{agility:30}}),'glider'),0);
assert.equal(T.weight(base('combo'),'quick_link',{},['threader','give_go']),0);
assert.equal(T.weight(base('rare'),'glider',{},['hoop_artist']),0);
assert(varied.some(p=>p.ovr<65&&p.playingTraits.some(id=>['close_control','tight_turner','quick_link'].includes(id))));
assert(varied.some(p=>p.ovr>=85&&p.playingTraits.length===0));

// V48 migration is once-only, preserving legitimate earned traits and all unrelated data.
const migrated=varied.slice(0,400).map((p,i)=>{
  const legacy=clone(p);delete legacy.playingTraitProgress;legacy.playingTraitsVersion=1;legacy.playingTraits=['burst','interceptor'];legacy.playingTraitOrigins={};
  const raw=JSON.stringify(legacy.stats);T.ensure(legacy,792,{seasonNumber:4,seasonId:'2029/30'});assert.equal(JSON.stringify(legacy.stats),raw);
  assert.deepEqual(legacy.playingTraitMigration.previous,['burst','interceptor']);
  const saved=clone(legacy),ids=clone(saved.playingTraits);saved.age+=5;saved.role='DEFENDER';saved.clubId='TRANSFERRED';saved.avatar='different-species';T.ensure(saved,999);assert.deepEqual(saved.playingTraits,ids);
  return legacy;
});
assert(migrated.some(p=>p.playingTraits.length===0));
const earnedLegacy=base('already-earned',{playingTraitsVersion:1,playingTraits:['quick_link'],playingTraitOrigins:{quick_link:{source:'DEVELOPED',reason:'Established breakthrough'}}});T.ensure(earnedLegacy,2);assert(earnedLegacy.playingTraits.includes('quick_link'));assert.equal(earnedLegacy.playingTraitOrigins.quick_link.source,'DEVELOPED');
assert.deepEqual(T.scoutHints(['burst'],0),[]);assert.deepEqual(T.scoutHints(['burst'],100),[]);
assert(T.scoutHints(['burst','quick_link'],40).length===1);assert(T.scoutHints(['burst','quick_link'],75).length===2);
assert(!T.scoutHints(['burst'],40).join(' ').includes('Burst Flyer'));

// End-of-season evaluation requires real sustained achievement, is deterministic and sparse.
function careerPlayer(id,extra={}){const p=base(id,extra);T.ensure(p,91,{seasonNumber:1});p.playingTraits=[];p.playingTraitOrigins={};return p;}
function season(p,number,{captain=false,apps=24,important=false,growth=0}={}){
  const seasonId='S'+number;p.age=24+number;p.careerApps=number*apps;p.careerGrowthThisSeason=growth;p.seasonStats={apps,ratingSum:apps*7.5,ratingCount:apps};
  for(let m=0;m<apps;m++){const ctx={seasonId,seasonNumber:number,fixtureId:`S${number}-F${m}`,minutes:90,competitive:true,captain,important};T.observeMatch(p,91,ctx);T.observeMatch(p,91,ctx);T.observeRating(p,91,{...ctx,rating:7.5});T.observeRating(p,91,{...ctx,rating:7.5});}
  assert.equal(p.playingTraitProgress.observed[seasonId].apps,apps,'Fixture observation is idempotent');
  const record=T.review(p,91,{seasonId,seasonNumber:number});assert.equal(T.review(p,91,{seasonId,seasonNumber:number}),null);return record;
}
const five=careerPlayer('five-random');for(let s=1;s<=3;s++)assert.equal(season(five,s,{apps:5,captain:true}),null);
const academy=careerPlayer('academy',{academy:true});for(let s=1;s<=6;s++)assert.equal(season(academy,s,{captain:true,growth:5,important:true}),null);
let leadershipAwards=0,developmentAwards=0,experienceAwards=0,totalAwards=0,maxEarned=0;
for(let i=0;i<800;i++){
  const p=careerPlayer('career-'+i),dates=[];
  for(let s=1;s<=9;s++){
    const earned=season(p,s,{captain:i%2===0,important:i%4===0,growth:i%3===0?3:0});
    if(earned){totalAwards++;dates.push(s);assert.equal(p.playingTraitOrigins[earned.id].source,earned.source);assert(p.playingTraitHistory.some(h=>h.id===earned.id));if(['captain_voice','rally'].includes(earned.id)){leadershipAwards++;assert(s>=3);}if(['veteran','game_reader'].includes(earned.id))experienceAwards++;if(earned.source==='DEVELOPED')developmentAwards++;}
    assert(p.playingTraits.length<=4);assert(p.playingTraitProgress.earned<=2);
    T.ensure(p,9123);assert.equal(p.playingTraits.length,p.playingTraitProgress.earned,'Loading does not add traits');
  }
  maxEarned=Math.max(maxEarned,p.playingTraitProgress.earned);for(let n=1;n<dates.length;n++)assert(dates[n]-dates[n-1]>=3);
}
assert(leadershipAwards>0&&developmentAwards>0&&experienceAwards>0);assert(totalAwards<800);report.progression={players:800,seasons:9,totalAwards,leadershipAwards,developmentAwards,experienceAwards,maxEarned};
for(const t of T.catalog){const mods=T.expectedEffects([t.id]);assert(Object.values(mods).some(v=>v>0)||['captain_voice','rally'].includes(t.id));for(const k of keys)assert(T.stat([t.id],k)>=0&&T.stat([t.id],k)<=6);}
assert.equal(T.energyMultiplier([]),1);assert(T.energyMultiplier(['second_wind'])<1);assert(T.energyMultiplier(['relentless'])<1);
assert(T.stat(['quick_link'],'PAS')>T.stat(['quick_link'],'SHO'));assert(T.stat(['burst'],'PAC')>T.stat(['burst'],'PAS'));

// Actual app generation, scout assignments, existing-save codec, archive hook and profile UI.
const r=runtime(),q=r.q,club=q.state().clubs[0];r.d.assignClubForTest(club);q.initializeCareerLifecycle();
const all=q.v48PlayerIndex().map(row=>row.p);report.actualWorld=measure(all);
assert(all.length>2000);assert(all.some(p=>p.playingTraits.length===0));assert(all.every(p=>p.playingTraitsVersion===2));
const otherClub=q.state().clubs[1],other=q.getSquad(otherClub)[0];other.playingTraits=['quick_link','burst'];other.playingTraitsVersion=2;
let data=q.v48ProfileData(other.id);assert.equal(data.traits,null);assert.deepEqual(clone(data.traitHints),[]);assert.deepEqual(clone(data.traitOrigins),{});
q.v48ProfileAction(other.id,'scout');const assignment=q.scoutAssignment(q.transferPlayerById(other.id));assert(assignment);
assignment.duration=10;assignment.startedDate=q.addDaysISO(q.currentCareerISO(),-5);
data=q.v48ProfileData(other.id);assert.equal(data.traits,null);assert(data.traitHints.length>0);const ui=r.context.VelmoraPlayerProfiles;
const hidden=ui.traitHTML(data.traits,false,{hints:data.traitHints,origins:data.traitOrigins});assert(hidden.includes('Provisional observation'));assert(!hidden.includes('Quick Link'));assert(!hidden.includes('<svg'));
q.completeScoutingAssignment(other.id,q.currentCareerISO());data=q.v48ProfileData(other.id);assert.deepEqual(clone(data.traits),['quick_link','burst']);assert(ui.traitHTML(data.traits).includes('Quick Link'));
assert(ui.traitHTML([]).includes('No distinctive traits.'));assert(!ui.traitHTML([]).includes('UNSCOUTED'));
assert(ui.traitHTML(['quick_link','burst','safe_hands','cool_head'],true).includes('<details'));
const own=q.getSquad(club)[0],archiveMeta=q.v49TraitSnapshot(own);assert.deepEqual(clone(archiveMeta.playingTraitOrigins),clone(own.playingTraitOrigins));
const sample=all.slice(0,160);for(const p of sample){p.playingTraits=['burst'];p.playingTraitsVersion=1;p.playingTraitOrigins={};delete p.playingTraitProgress;}
q.state().careerRuntime.traitDistributionVersion=1;
const id=own.id,stats=JSON.stringify(own.stats);assert(q.saveCareerState());assert(q.loadCareerState());
const loaded=q.v48FindPlayer(id).p;assert.equal(loaded.playingTraitsVersion,2);assert.equal(JSON.stringify(loaded.stats),stats);assert(loaded.playingTraitMigration);
const stable=clone(q.v49TraitSnapshot(loaded));assert(q.saveCareerState());assert(q.loadCareerState());assert.deepEqual(clone(q.v49TraitSnapshot(q.v48FindPlayer(id).p)),stable);
const noTraits=q.v48PlayerIndex().find(row=>row.p.playingTraits.length===0).p;const noId=noTraits.id;q.ensurePlayerCareerMeta(noTraits);q.v210PlayerConfig(noTraits);assert.equal(noTraits.playingTraits.length,0);
assert(q.saveCareerState());assert(q.loadCareerState());assert.equal(q.v48FindPlayer(noId).p.playingTraits.length,0);
q.archiveLivingSquadSeason(q.state().careerTime.seasonId);assert.equal(q.v48FindPlayer(id).p.playingTraitProgress.lastReview,q.state().careerTime.seasonNumber);
const seasonState=JSON.stringify(q.v48FindPlayer(id).p.playingTraitProgress);q.archiveLivingSquadSeason(q.state().careerTime.seasonId);assert.equal(JSON.stringify(q.v48FindPlayer(id).p.playingTraitProgress),seasonState);
// Both watched/simulated participation and rating paths feed the milestone record.
const fixture={fixtureId:'V49-INTEGRATION-CUP',type:'CUP',homeClubId:club.id,awayClubId:otherClub.id,date:q.currentCareerISO()};
q.recordMatchParticipation(club,fixture,'WIN');q.recordMatchParticipation(club,fixture,'WIN');
const starter=q.activeStarters(club)[0];q.v43RecordRatingLine(starter,club,fixture,7.8);q.v43RecordRatingLine(starter,club,fixture,7.8);
const observation=starter.playingTraitProgress.observed[q.state().careerTime.seasonId];assert.equal(observation.apps,1);assert.equal(Object.keys(observation.importantRatings).length,1);
// Existing transfer, loan and retirement routines preserve the complete identity record.
const free=q.getFreeAgents()[0],beforeMove=clone(q.v49TraitSnapshot(free));
const signing=q.completeTransferSigning(free,0,0,0,'Rotation',2);assert(signing.ok,signing.message);
const signed=q.v48FindPlayer(free.id).p;assert.deepEqual(clone(q.v49TraitSnapshot(signed)),beforeMove);
assert(q.completeLivingLoan({parentClubId:club.id,expectedRole:'Rotation',wageContribution:50},signed,otherClub));assert.deepEqual(clone(q.v49TraitSnapshot(q.v48FindPlayer(signed.id).p)),beforeMove);
const loan=q.state().livingSquad.loanHistory.find(l=>l.playerId===signed.id);q.returnLivingLoan(loan,q.currentCareerISO());assert.deepEqual(clone(q.v49TraitSnapshot(q.v48FindPlayer(signed.id).p)),beforeMove);
const retired=q.archiveRetiredPlayer(signed,club);assert.deepEqual(clone(q.v49TraitSnapshot(retired)),beforeMove);
// A real season review also creates the corresponding player history and club memory.
q.state().careerTime.seasonNumber=4;q.state().careerTime.seasonId='2029/30';q.state().careerTime.currentDate='2029-06-15';q.syncLegacyCareerClock();
const seeded=q.v48PlayerIndex().filter(row=>!row.academy&&!row.retired&&row.club).slice(0,100);
for(const {p} of seeded){p.playingTraits=[];p.playingTraitOrigins={};p.age=28;p.retiringAtEnd=false;p.careerApps=110;p.storyTraits.leadership=90;p.stats=Object.fromEntries(keys.map(k=>[k,75]));p.playingTraitProgress={firstSeason:1,lastReview:3,lastAward:0,earned:0,captainSeasons:2,trackedApps:60,observed:{'2029/30':{apps:25,captainApps:25,importantApps:0,fixtures:[]}}};}
const awards=q.v49ReviewTraits('2029/30');assert(awards.length>0);
for(const a of awards){const p=q.v48FindPlayer(a.playerId).p;assert(q.state().livingSquad.playerHistory[p.id].careerEvents.some(e=>e.type==='TRAIT_EARNED'&&e.traitId===a.traitId));assert(p.playingTraitHistory.some(h=>h.id===a.traitId));if(p.clubId===club.id)assert(q.careerMemoryEventsForPlayer(p).some(e=>e.type==='TRAIT_EARNED'));}
assert.equal(q.v49ReviewTraits('2029/30').length,0);
report.validationNotes=['Fixed seeds for reproducibility; real career percentages are approximate.', 'Progression cohort deliberately supplies sustained captaincy, strong ratings and development achievements.', 'Actual-world cohort includes senior, academy and free-agent players.', 'Transfer signing, loans/returns, retirement, competitive participation/ratings, earned memory, and once-only save migration passed.'];
fs.writeFileSync(path.join(__dirname,'..','V49-Trait-Distribution-Audit.json'),JSON.stringify(report,null,2)+'\n');
console.log('PASS: 24,000 generated players; count/role/age/rating/potential audit; all 24 traits; eligibility/compatibility; one-time V48 migration; 7,200 career-season reviews; scouting hints/privacy; actual-world generation; save codec; empty-list persistence; season archive; shared match effects.');
console.log(JSON.stringify({normal:report.normal.percent,highPotential:report.highPotential.percent,actualWorld:report.actualWorld.percent,progression:report.progression}));
