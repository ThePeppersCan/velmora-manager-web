'use strict';
// A deliberately tiny world that implements the same bridge contract as
// app.js, so the transport and the database rules can be exercised without
// booting the whole game. The real bridge is verified separately by
// test_v104_multiplayer_career.cjs against the actual career engine.

function hash(text){
  let value=2166136261;
  for(let i=0;i<text.length;i++){value^=text.charCodeAt(i);value=Math.imul(value,16777619);}
  return value>>>0;
}

const AI='ai-';

function makeWorld(){
  return{
    worldSeed:'SEED-ONLINE-TEST',
    date:'2026-08-01',
    fixtures:[
      {fixtureId:'F1',date:'2026-08-08',homeClubId:'aurelia',awayClubId:AI+'a',played:false},
      {fixtureId:'F2',date:'2026-08-08',homeClubId:'blackglass',awayClubId:AI+'b',played:false},
      {fixtureId:'F3',date:'2026-08-08',homeClubId:AI+'c',awayClubId:AI+'d',played:false},
      {fixtureId:'F4',date:'2026-08-15',homeClubId:'aurelia',awayClubId:'blackglass',played:false},
      // A human club with no fixture on the barrier date must never block it.
      {fixtureId:'F5',date:'2026-08-22',homeClubId:'aurelia',awayClubId:AI+'e',played:false},
      // A postponed human fixture must not block either.
      {fixtureId:'F6',date:'2026-08-08',homeClubId:'blackglass',awayClubId:AI+'f',played:false,postponed:true}
    ],
    clubState:{},
    counters:{applyResult:{},aiResolved:{},advance:0}
  };
}

// The whole point of a seeded engine: same inputs, same score, every device.
function deterministicScore(worldSeed,fixtureId){
  const seed=hash(`${worldSeed}|MATCH|${fixtureId}`);
  return{home:seed%4,away:(seed>>>3)%4};
}

function createBridge({clubId=null,identity={}}={}){
  let world=makeWorld();
  let session={clubId,identity};
  const log=[];
  // Every world action this device actually received. A routing bug in the
  // transport shows up here as an absence, which a stub returning true cannot
  // detect.
  const worldActions=[];

  const bridge={
    _world:()=>world,
    _log:()=>log,
    _worldActions:()=>worldActions,
    _reset(next){world=next||makeWorld();},
    _setClub(id){session.clubId=id;},
    // Mirrors what the real game does: the manager's own device resolves the
    // fixture locally first, and only then submits it as authoritative.
    _playLocally(fixtureId,homeScore,awayScore){
      const fixture=world.fixtures.find(row=>row.fixtureId===fixtureId);
      if(!fixture||fixture.played)return false;
      fixture.played=true;fixture.homeScore=homeScore;fixture.awayScore=awayScore;
      fixture.resultMode='LOCAL';
      return true;
    },

    buildSnapshot(){
      const{counters,...rest}=world;
      return{
        payload:JSON.stringify(rest),
        checksum:String(hash(JSON.stringify(rest.date))),
        saveSchema:86,
        careerDate:world.date,
        seasonId:'2026-27',
        worldSeed:world.worldSeed
      };
    },
    applySnapshot(payload){
      try{
        const incoming=JSON.parse(payload);
        if(!incoming||!incoming.worldSeed)return false;
        world={...incoming,counters:world.counters};
        world.clubState=world.clubState||{};
        return true;
      }catch(_){return false;}
    },

    buildClubState(id){return world.clubState[id]||{squads:[],marker:null};},
    applyClubState(id,payload){world.clubState[id]={...payload};log.push(['clubState',id]);return true;},

    applyMatchResult(fixtureId,result,meta){
      const fixture=world.fixtures.find(row=>row.fixtureId===fixtureId);
      if(!fixture||fixture.played)return false;
      fixture.played=true;
      fixture.homeScore=Number(meta.homeScore||0);
      fixture.awayScore=Number(meta.awayScore||0);
      fixture.resultMode=meta.mode||'ONLINE';
      world.counters.applyResult[fixtureId]=(world.counters.applyResult[fixtureId]||0)+1;
      log.push(['result',fixtureId]);
      return true;
    },

    advanceSharedDay(from,to){
      if(!to||world.date>=to)return false;
      world.date=to;
      world.counters.advance++;
      // Remaining AI fixtures resolve here and only here.
      world.fixtures.filter(row=>!row.played&&row.date<=to&&!row.postponed
          &&!isHuman(row.homeClubId)&&!isHuman(row.awayClubId))
        .forEach(row=>{
          const score=deterministicScore(world.worldSeed,row.fixtureId);
          row.played=true;row.homeScore=score.home;row.awayScore=score.away;row.resultMode='WORLD_SIM';
          world.counters.aiResolved[row.fixtureId]=(world.counters.aiResolved[row.fixtureId]||0)+1;
        });
      log.push(['advance',from,to]);
      return true;
    },

    activityRoute(){return'central';},
    currentDate(){return world.date;},
    captureIdentity(){return session.identity;},
    onRemoteChange(){},
    onManagerConvertedToAi(){},
    applyWorldAction(kind,payload,subjectKey,event){
      worldActions.push({kind,payload,subjectKey,actorUserId:event&&event.actor_user_id});
      return true;
    }
  };
  function isHuman(id){return id==='aurelia'||id==='blackglass';}
  return bridge;
}

module.exports={createBridge,makeWorld,deterministicScore,hash};
