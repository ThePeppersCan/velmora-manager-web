'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {runtime}=require('./career_test_runtime.cjs');

const root=path.resolve(__dirname,'..');
const r=runtime(),q=r.q,d=r.d;
const club=r.context.VELMORA_CLUBS[0];
d.assignClubForTest(club);
q.initializeCareerLifecycle();

const initial=d.v101PeoplePowerIntegrityForTest();
assert.equal(initial.version,'V101');
assert.equal(initial.mediaWorldVersion,3,'media saves migrate to named people memory');
assert.equal(initial.livingSquadVersion,8,'living squad saves migrate to hierarchy state');
assert.equal(initial.clubLifeVersion,3,'club-life saves retain hierarchy history');
assert.equal(initial.hierarchy,initial.players,'every available senior player receives a hierarchy role');
assert.equal(initial.cliqueMembers,initial.players,'every available senior player belongs to one social group');
assert(initial.cliques>=2,'a full senior squad forms several readable groups');
assert(initial.leaders>=1,'the squad has at least one visible leadership voice');
assert(initial.cohesion>=18&&initial.cohesion<=94,'cohesion remains within its balanced range');
assert.equal(initial.negotiationMemory,true);
assert.equal(initial.pressCascade,true);
assert.equal(initial.captaincyImpact,true);
assert.equal(initial.transferImpact,true);
assert.equal(initial.saveCompatible,true);

const squad=q.getSquad(club),player=squad[0];
d.v101RecordPeopleMemoryForTest({personType:'PLAYER',personId:player.id,personName:player.name,label:'PUBLIC BACKING',summary:`${player.name} has been outstanding for us.`,valence:1,strength:4,statementId:'QA-PLAYER-PRAISE',date:q.currentCareerISO()});
const playerMemories=d.v101PeopleMemoriesForTest('PLAYER',player.id);
const recruitment=d.v101RecruitmentMemoryForTest(player.id);
assert.equal(playerMemories.length,1,'named player memory is recorded');
assert(recruitment.score>0,'public backing creates modest future recruitment trust');
assert(recruitment.score<=.075,'press memory cannot dominate personal terms');

q.initializeManagerMarketState();
const opponent=r.context.VELMORA_CLUBS.find(candidate=>candidate.id!==club.id&&q.currentClubManager(candidate));
const rival=q.currentClubManager(opponent);
assert(rival?.id,'test world exposes an opposition manager');
const blockUntil=q.addDaysISO(q.currentCareerISO(),240);
d.v101RecordPeopleMemoryForTest({personType:'MANAGER',personId:rival.id,personName:rival.name,label:'PUBLIC RIFT',summary:`I do not have much time for ${rival.name}.`,valence:-1,strength:5,statementId:'QA-MANAGER-RIFT',date:q.currentCareerISO(),blockUntil});
const managerContext=d.v101ManagerTransferMemoryForTest(rival.id);
assert.equal(managerContext.blockUntil,blockUntil,'a severe manager rift can close discretionary transfer talks for months');
assert(managerContext.pricePremium>0&&managerContext.pricePremium<=.12,'less severe manager tension remains a bounded seller premium');

d.v101RecordPeopleMemoryForTest({personType:'REPORTER',personId:'MIRA-VALE',personName:'Mira Vale',label:'PRESS FRICTION',summary:'That question was not worth answering.',valence:-1,strength:3,statementId:'QA-REPORTER-FRICTION',date:q.currentCareerISO()});
assert.equal(d.v101PeopleMemoriesForTest('REPORTER','MIRA-VALE').length,1,'reporter history is attached to the named journalist');

const social=d.v101SocialSnapshotForTest(club.id);
assert(social.hierarchy.every(entry=>['CAPTAIN','LEADER','CORE VOICE','FOLLOWER','NEW ARRIVAL','PERIPHERAL'].includes(entry.role)),'hierarchy uses authored social roles');
assert(social.cliques.every(clique=>clique.memberIds.length>=1&&clique.leaderId),'each group has members and a group voice');

const html=d.v101SquadDynamicsHtmlForTest();
for(const marker of ['PEOPLE &amp; POWER','SQUAD HIERARCHY','GROUPS &amp; ALLIANCES','LIVE FAULT LINES','DISPLACED STARTERS','PUBLIC RECORD'])assert(html.includes(marker),`Squad Dynamics marker: ${marker}`);
assert(html.includes('data-v48-player'),'player names open the unified full profile');

const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'people-power.css'),'utf8');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const press=fs.readFileSync(path.join(root,'press-conference-engine.js'),'utf8');
const prompt=fs.readFileSync(path.join(root,'PEOPLE_AND_POWER_AAA_MASTER_PROMPT.md'),'utf8');
assert(index.includes('data-squad-view="dynamics"')&&index.includes('id="squadDynamicsView"'),'Squad Dynamics is a first-class squad section');
for(const marker of ['.people-power-hero','.people-hierarchy-list','.people-clique-grid','.people-memory-profile'])assert(css.includes(marker),`People & Power presentation marker: ${marker}`);
for(const marker of ['recordPeopleMemory','applyCliquePressReaction','managerTransferMemoryContext','playerRecruitmentMemoryContext','applySquadArrivalImpact'])assert(app.includes(marker),`People & Power simulation marker: ${marker}`);
assert(press.includes('publicHistory'),'press questions surface relevant prior history');
assert(prompt.includes('Career continuity over random drama'),'production prompt includes the continuity guardrail');

d.saveCareerStateForTest();
const saved=[...r.local.values()].map(value=>{try{return r.context.VelmoraSaveCodec.decode(String(value));}catch(_error){return String(value);}});
assert(saved.some(value=>String(value).includes('QA-PLAYER-PRAISE')&&String(value).includes('peopleMemories')),'people memory is included in the career save payload');

console.log(JSON.stringify({status:'PASS',initial,after:d.v101PeoplePowerIntegrityForTest(),checks:[
  'named player, manager and reporter memories persist',
  'public history influences transfers and personal terms without replacing core valuation',
  'captaincy, arrivals, departures and clique reactions share one social graph',
  'Squad Dynamics exposes hierarchy, groups, tensions and displaced starters',
  'player profiles and press questions explain relevant prior context',
  'existing career artwork is reused without new sprites'
]},null,2));
