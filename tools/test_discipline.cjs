const assert=require('node:assert/strict');
const {runtime}=require('./career_test_runtime.cjs');
const r=runtime(),q=r.q,d=r.d;
const clubs=r.context.VELMORA_CLUBS;
const home=clubs.find(c=>c.id==='redwick')||clubs[0],away=clubs.find(c=>c.id!==home.id);
d.assignClubForTest(home);q.initializeCareerLifecycle();
const player=q.getSquad(home)[0];q.ensurePlayerCareerMeta(player);
const mk=(id,type='LEAGUE',competitionId=home.divisionKey)=>({fixtureId:id,date:'2026-09-01',type,competitionId,homeClubId:home.id,awayClubId:away.id,played:false});
const card=(fixture,card='YELLOW',reason=card==='RED'?'SERIOUS_FOUL_PLAY':'CAUTION')=>q.disciplineApplyEvent(fixture,{team:'home',playerId:player.id,playerName:player.name,minute:30,card,reason,source:'QA'},home,away);
const checks=[];const check=(name,fn)=>{fn();checks.push(name)};

check('league yellow accumulation triggers a one-match league ban at five cautions',()=>{
  const d0=q.ensurePlayerDiscipline(player);d0.byCompetition={};d0.suspensions=[];d0.seasonYellow=0;d0.seasonRed=0;player.suspended=false;player.suspensionMatches=0;player.seasonStats.yellowCards=0;player.seasonStats.redCards=0;
  for(let i=1;i<=5;i++)card(mk('Y'+i));
  const ban=q.disciplineActiveSuspensions(player)[0];assert(ban);assert.equal(ban.reason,'YELLOW_ACCUMULATION');assert.equal(ban.matchesRemaining,1);assert.equal(player.seasonStats.yellowCards,5);assert(q.matchdayUnavailable(player,mk('NEXT-L')));assert(!q.matchdayUnavailable(player,mk('NEXT-C','CUP','cup-a')));
});

check('serving a matching fixture decrements and completes the ban',()=>{
  const f=mk('SERVE-L');const snap=q.disciplineServingSnapshot(home,f);q.moveLineupPlayerToSlot(home,player.id,'bench',0);q.disciplineServeFixtureForClub(home,f,snap);assert.equal(q.disciplineActiveSuspensions(player,f).length,0);assert.equal(player.suspensionMatches,0);
});

check('straight red produces all-competitive ban and an appeal decision',()=>{
  const f=mk('RED-1');const before=d.getLivingCareerState().careerDecisionEvents.length;const out=card(f,'RED','SERIOUS_FOUL_PLAY');assert(out.suspension);assert.equal(out.suspension.matchesRemaining,2);assert(q.matchdayUnavailable(player,mk('LEAGUE-A')));assert(q.matchdayUnavailable(player,mk('CUP-A','CUP','cup-a')));assert(d.getLivingCareerState().careerDecisionEvents.length>=before+1);
});

check('second yellow creates a one-match all-competitive suspension',()=>{
  const p=q.getSquad(home)[1];q.ensurePlayerCareerMeta(p);const f=mk('SECOND-Y');const out=q.disciplineApplyEvent(f,{team:'home',playerId:p.id,playerName:p.name,minute:72,card:'SECOND_YELLOW',reason:'SECOND_YELLOW'},home,away);assert.equal(out.suspension.matchesRemaining,1);assert(q.matchdayUnavailable(p,mk('NEXT-CUP','CUP','cup-a')));
});

check('friendlies retain the event ledger but do not create competitive card totals or bans',()=>{
  const p=q.getSquad(home)[2];q.ensurePlayerCareerMeta(p);const y=Number(p.seasonStats.yellowCards||0),r0=Number(p.seasonStats.redCards||0),f=mk('FR-1','FRIENDLY','preseason');q.disciplineApplyEvents(f,[{team:'home',playerId:p.id,playerName:p.name,minute:20,card:'RED',reason:'SERIOUS_FOUL_PLAY'}],home,away);assert.equal(p.seasonStats.yellowCards,y);assert.equal(p.seasonStats.redCards,r0);assert.equal(q.disciplineActiveSuspensions(p).length,0);assert.equal(f.discipline.events.length,1);
});

check('simulation discipline is deterministic and a dismissal affects expected scoring strength',()=>{
  const f=mk('DETERMINISTIC');const a=q.disciplineSimulatedEvents(f,home,away),b=q.disciplineSimulatedEvents(f,home,away);assert.deepEqual(a,b);assert(q.disciplineRedImpact([{team:'home',card:'RED',minute:10}],'home')>q.disciplineRedImpact([{team:'home',card:'RED',minute:85}],'home'));
});

check('season rollover clears accumulation but preserves an unserved straight-red ban',()=>{
  const active=q.disciplineActiveSuspensions(player).find(b=>b.reason==='SERIOUS_FOUL_PLAY');assert(active);const remaining=active.matchesRemaining;q.disciplineStartNewSeason(player);assert.equal(q.ensurePlayerDiscipline(player).seasonYellow,0);assert.equal(Object.keys(q.ensurePlayerDiscipline(player).byCompetition).length,0);assert.equal(q.disciplineActiveSuspensions(player).find(b=>b.id===active.id).matchesRemaining,remaining);
});

check('discipline data survives the real compressed career save/load path',()=>{
  assert(q.saveCareerState());const before=JSON.stringify(q.ensurePlayerDiscipline(player));assert(q.loadCareerState());const restored=q.careerPlayerById(player.id);assert(restored);assert.equal(JSON.stringify(q.ensurePlayerDiscipline(restored)),before);
});

const integrity=d.v26DisciplineIntegrityForTest();assert.equal(integrity.version,'V26.0');assert.equal(integrity.saveSchema,75);
console.log(JSON.stringify({status:'PASS',checks,integrity},null,2));
