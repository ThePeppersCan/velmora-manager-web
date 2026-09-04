/*
  V45 Release-Grade Long Career Audit
  -----------------------------------
  Default mode runs the REAL authoritative 288-club career simulation for 15 seasons.
  It does not replace match resolution with a toy model. Because that is thousands of
  fully resolved fixtures per season, expect this to be deliberately heavy.

  Usage:
    node tools/audit_v45_long_career.cjs
    VELMORA_AUDIT_SEASONS=10 node tools/audit_v45_long_career.cjs
    node tools/audit_v45_long_career.cjs --smoke

  --smoke resolves one complete world fixture date only. It validates the collector and
  report pipeline; it is NOT represented as a 10-15 season balance result.
*/
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {runtime}=require('./career_test_runtime.cjs');
const {context,q,d}=runtime();
// The asset-light developer package intentionally lacks many manager layers; silence only those
// console warnings during the heavy audit so I/O does not distort simulation timings.
if(process.env.VELMORA_AUDIT_VERBOSE!=='1')console.warn=()=>{};
const root=path.resolve(__dirname,'..');
const smoke=process.argv.includes('--smoke');
const seasons=Math.max(1,Math.min(15,Number(process.env.VELMORA_AUDIT_SEASONS||15)));
const club=context.VELMORA_CLUBS.find(c=>c.id==='redwick')||context.VELMORA_CLUBS[0];
d.assignClubForTest(club);q.initializeCareerLifecycle();q.setActiveCareerSlot(1);q.saveCareerState();

function delta(a,b,keyPath){const get=(o,p)=>p.split('.').reduce((x,k)=>x?.[k],o);return Number(get(b,keyPath)||0)-Number(get(a,keyPath)||0);}
function between(v,min,max){return Number.isFinite(v)&&v>=min&&v<=max;}
function evaluate(snapshot,index){
  const hard=[],warnings=[];
  if(snapshot.world.clubs!==288)hard.push(`club count ${snapshot.world.clubs} != 288`);
  if(snapshot.world.divisions!==16||!snapshot.world.allDivisions18)hard.push('division structure is not 16 x 18');
  if(snapshot.integrity.badBudgets)hard.push(`${snapshot.integrity.badBudgets} invalid/negative club budgets`);
  if(snapshot.integrity.badPlayers)hard.push(`${snapshot.integrity.badPlayers} invalid player core records`);
  if(snapshot.integrity.duplicateStatistics)hard.push(`${snapshot.integrity.duplicateStatistics} duplicate V43 statistic rows`);
  if(snapshot.integrity.duplicateActivePlayers)hard.push(`${snapshot.integrity.duplicateActivePlayers} duplicate active player ids`);
  if(snapshot.squads.min<6||snapshot.squads.max>20)hard.push(`squad size range ${snapshot.squads.min}-${snapshot.squads.max}`);
  if(snapshot.matches.league>0&&!between(snapshot.matches.goalsPerLeagueMatch,1.6,5.0))warnings.push(`goals/match ${snapshot.matches.goalsPerLeagueMatch}`);
  if(snapshot.matches.league>0&&!between(snapshot.matches.homeWinShare,.25,.65))warnings.push(`home-win share ${snapshot.matches.homeWinShare}`);
  if(snapshot.population.ovrMax>96)warnings.push(`maximum OVR ${snapshot.population.ovrMax}`);
  if(snapshot.population.freeAgents>Math.max(450,snapshot.world.clubs*1.6))warnings.push(`free-agent pool ${snapshot.population.freeAgents}`);
  if(!between(snapshot.squads.average,7,13))warnings.push(`average squad size ${snapshot.squads.average}`);
  if(index>=10&&snapshot.championsCrown.completedSeasons>=8&&snapshot.championsCrown.uniqueWinners<2)warnings.push('Champions Crown has only one winner across a long sample');
  if(snapshot.statistics.queryMs>250)warnings.push(`statistics query ${snapshot.statistics.queryMs} ms`);
  return{hard,warnings};
}
function markdown(report){
  const lines=[`# V45 Long Career Audit`,``,`Mode: **${report.mode}**  `,`Requested seasons: **${report.requestedSeasons}**  `,`Completed seasons: **${report.completedSeasons}**  `,`Started: ${report.startedAt}  `,`Finished: ${report.finishedAt}`,``,
  `> Soft bands below are diagnostics, not secret rebalance rules. Hard failures identify structural corruption.`,``,
  `| Season | Goals/match | Home W% | OVR P50 / P90 | Free agents | Avg squad | Transfers | Avg fee | Avg wage | Club budget | Sacks | Caretakers | Save chars | Stat ms | Warnings |`,`|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|`];
  report.seasons.forEach(r=>{const s=r.snapshot,w=r.evaluation.warnings;lines.push(`| ${r.index} · ${s.seasonId} | ${s.matches.goalsPerLeagueMatch} | ${(s.matches.homeWinShare*100).toFixed(1)} | ${s.population.ovrMedian} / ${s.population.ovrP90} | ${s.population.freeAgents} | ${s.squads.average} | ${r.deltas.transfers} | ${s.transfers.averageFee} | ${s.economy.averageWage} | ${s.economy.averageClubBudget} | ${r.deltas.dismissals} | ${r.deltas.caretakers} | ${s.save.characters} | ${s.statistics.queryMs} | ${w.join('; ')||'—'} |`);});
  lines.push('',`## Structural result`,``,report.hardFailures.length?report.hardFailures.map(x=>`- FAIL: ${x}`).join('\n'):'- PASS: no structural corruption detected in completed audit work.',``,`## Balance warnings`,``,report.warnings.length?report.warnings.map(x=>`- ${x}`).join('\n'):'- No soft-band warnings in completed audit work.',``,`## Notes`,``,`- This audit calls the existing authoritative season simulation. It does not use a parallel simplified results generator.`,`- A smoke run validates only telemetry/report plumbing and must never be presented as a multi-season balance result.`,`- Rebalancing should follow repeated measured evidence, not one anomalous season.`);return lines.join('\n');
}

(async()=>{
  const startedAt=new Date().toISOString(),seasonRows=[],hardFailures=[],warnings=[];
  let previous=d.v45LongCareerTelemetryForTest();
  if(smoke){
    q.initializeCareerCalendar(false);
    const dates=[...new Set(q.state().fixtures.filter(f=>!f.played&&f.type==='LEAGUE'&&f.date).map(f=>f.date))].sort();
    assert(dates.length,'fixture dates available');
    q.setCareerDate(dates[0]);q.simulateWorldFixturesForDate(dates[0],null);q.saveCareerState();
    const snapshot=d.v45LongCareerTelemetryForTest(),evaluation=evaluate(snapshot,0);
    hardFailures.push(...evaluation.hard.map(x=>`SMOKE: ${x}`));warnings.push(...evaluation.warnings.map(x=>`SMOKE: ${x}`));
    seasonRows.push({index:0,label:'collector-smoke',snapshot,evaluation,deltas:{transfers:snapshot.transfers.currentSeasonCount,dismissals:snapshot.managers.currentSeasonDismissals,caretakers:snapshot.managers.currentSeasonCaretakers}});
  }else{
    for(let i=1;i<=seasons;i++){
      const t0=Date.now();process.stderr.write(`[V45 audit] season ${i}/${seasons} · ${q.currentCareerISO()} · simulating real world...\n`);
      const sim=d.simulateRoadToGlorySeasonForTest();
      if(!sim.ok)throw new Error(`Season ${i} did not reach review: ${JSON.stringify(sim)}`);
      q.saveCareerState();
      const snapshot=d.v45LongCareerTelemetryForTest(),evaluation=evaluate(snapshot,i);
      const row={index:i,seasonId:snapshot.seasonId,durationSeconds:Number(((Date.now()-t0)/1000).toFixed(1)),snapshot,evaluation,deltas:{transfers:snapshot.transfers.currentSeasonCount,dismissals:snapshot.managers.currentSeasonDismissals,caretakers:snapshot.managers.currentSeasonCaretakers,retirements:delta(previous,snapshot,'population.retirements'),promotions:snapshot.movement.currentSeasonPromotions,relegations:snapshot.movement.currentSeasonRelegations,saveCharacters:delta(previous,snapshot,'save.characters')}};
      seasonRows.push(row);hardFailures.push(...evaluation.hard.map(x=>`Season ${i}: ${x}`));warnings.push(...evaluation.warnings.map(x=>`Season ${i}: ${x}`));
      const rollover=d.completeSeasonRolloverForTest();if(!rollover)throw new Error(`Season ${i} rollover failed`);q.saveCareerState();previous=d.v45LongCareerTelemetryForTest();
      process.stderr.write(`[V45 audit] season ${i} complete · ${row.durationSeconds}s · ${evaluation.hard.length} hard / ${evaluation.warnings.length} warnings\n`);
    }
  }
  const report={version:'V45',mode:smoke?'SMOKE / ONE WORLD DATE':'FULL AUTHORITATIVE 288-CLUB',requestedSeasons:smoke?0:seasons,completedSeasons:smoke?0:seasonRows.length,startedAt,finishedAt:new Date().toISOString(),hardFailures,warnings,seasons:seasonRows,final:d.v45LongCareerTelemetryForTest()};
  const outDir=path.join(root,'reports');fs.mkdirSync(outDir,{recursive:true});const stem=smoke?'V45_LONG_CAREER_AUDIT_SMOKE':'V45_LONG_CAREER_AUDIT';
  fs.writeFileSync(path.join(outDir,stem+'.json'),JSON.stringify(report,null,2));fs.writeFileSync(path.join(outDir,stem+'.md'),markdown(report));
  console.log(JSON.stringify({status:hardFailures.length?'FAIL':'PASS',mode:report.mode,completedSeasons:report.completedSeasons,hardFailures:hardFailures.length,warnings:warnings.length,json:`reports/${stem}.json`,markdown:`reports/${stem}.md`},null,2));
  if(hardFailures.length)process.exitCode=1;
})().catch(err=>{console.error(err);process.exitCode=1;});
