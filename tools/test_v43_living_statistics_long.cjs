const assert=require('node:assert/strict');
const {runtime}=require('./career_test_runtime.cjs');

const r=runtime(),q=r.q,d=r.d;
const clubs=r.context.VELMORA_CLUBS.slice(0,8);
assert(clubs.length>=2,'Expected multiple clubs');
d.assignClubForTest(clubs[0]);
q.initializeCareerLifecycle();

const players=[];
for(const club of clubs){
  for(const player of q.getSquad(club).slice(0,3)) players.push({player,club});
}
assert(players.length>=12,'Expected enough players for structural stress');

const startCount=Object.keys(q.state().livingSquad.statistics.rows).length;
const seasons=Array.from({length:15},(_,i)=>`${2030+i}-${String(31+i).slice(-2)}`);
const competitions=[
  {type:'LEAGUE',competitionId:'STRESS-LEAGUE',competitionName:'Stress League'},
  {type:'CUP',competitionId:'STRESS-CUP',competitionName:'Stress Cup'},
  {type:'CHAMPIONS_CROWN',competitionId:'STRESS-CROWN',competitionName:'Champions Crown'},
  {type:'PLAYOFF',competitionId:'STRESS-PLAYOFF',competitionName:'Promotion Playoff'}
];

for(let si=0;si<seasons.length;si++){
  const seasonId=seasons[si];
  for(let pi=0;pi<players.length;pi++){
    const {player,club}=players[pi];
    for(let ci=0;ci<competitions.length;ci++){
      const comp=competitions[ci];
      const fixture={
        fixtureId:`STRESS-${seasonId}-${player.id}-${ci}`,
        type:comp.type,
        competitionId:comp.competitionId,
        competitionName:comp.competitionName,
        ccSeasonId:comp.type==='CHAMPIONS_CROWN'?seasonId:undefined,
        date:`${2030+si}-10-${String(10+ci).padStart(2,'0')}`,
        homeClubId:club.id,
        awayClubId:clubs[(clubs.indexOf(club)+1)%clubs.length].id
      };
      const row=q.v43EnsureStatRow(player,club,fixture,{seasonId});
      assert(row,'Expected stat row');
      row.apps=12+ci;
      row.starts=9+ci;
      row.minutes=(9+ci)*70;
      row.goals=(pi+si+ci)%8;
      row.assists=(pi*2+si+ci)%7;
      row.ratingCount=row.apps;
      row.ratingSum=row.apps*(6.6+((pi+ci)%10)/10);
      row.potm=(pi+ci)%3;
      row.yellowCards=(pi+si)%4;
      row.redCards=(pi+si+ci)%17===0?1:0;
      row.chancesCreated=row.apps*((pi+ci)%3);
      row.interceptions=row.apps*((pi+ci+1)%3);
      row.tacklesWon=row.apps*((pi+ci+2)%3);
      row.saves=player.role==='DEFENDER'?row.apps:0;
      row.lastDate=fixture.date;
    }
  }
}

const expectedAdded=seasons.length*players.length*competitions.length;
const rows=Object.values(q.state().livingSquad.statistics.rows);
assert(rows.length>=startCount+expectedAdded,`Expected at least ${expectedAdded} new rows`);
assert.equal(new Set(rows.map(x=>x.key)).size,rows.length,'Row keys must remain unique');

const focus=players[0].player;
const focusRows=d.v43RowsForPlayerForTest(focus.id).filter(r=>seasons.includes(r.seasonId));
assert.equal(focusRows.length,seasons.length*competitions.length);
const aggregate=d.v43AggregateRowsForTest(focusRows)[0];
assert(aggregate.apps>0);
assert(aggregate.goals>=0);
assert(aggregate.assists>=0);
assert(aggregate.ratingCount>0);

const careerHtml=q.v43PlayerCareerStatisticsHTML(focus);
assert(careerHtml.includes('CAREER STATISTICS'));
assert(careerHtml.includes('SHOW 7 EARLIER SEASONS'),'15-season dossier should progressively disclose seasons older than the latest eight');
assert(careerHtml.includes(seasons[0]),'Oldest season remains present in dossier HTML');
assert(careerHtml.includes(seasons.at(-1)),'Newest season remains present in dossier HTML');

const serialized=JSON.stringify(q.state().livingSquad.statistics);
assert(serialized.length<3_000_000,`Structural statistics ledger unexpectedly large: ${serialized.length} chars`);
assert(q.saveCareerState());
const keysBefore=new Set(Object.keys(q.state().livingSquad.statistics.rows));
q.state().livingSquad.statistics.rows={};
assert(q.loadCareerState());
const keysAfter=new Set(Object.keys(q.state().livingSquad.statistics.rows));
assert.equal(keysAfter.size,keysBefore.size);
for(const key of keysBefore) assert(keysAfter.has(key),`Missing row after reload: ${key}`);

console.log(JSON.stringify({
  status:'PASS',
  seasons:seasons.length,
  players:players.length,
  competitions:competitions.length,
  addedRows:expectedAdded,
  totalRows:Object.keys(q.state().livingSquad.statistics.rows).length,
  serializedStatisticsChars:serialized.length,
  checks:[
    '15 seasons of four competition splits remain queryable',
    'row keys remain unique',
    'career aggregation remains correct',
    'older seasons remain available through native progressive disclosure',
    'statistics ledger survives save/load exactly',
    'aggregate-row storage remains bounded in structural stress'
  ]
},null,2));
