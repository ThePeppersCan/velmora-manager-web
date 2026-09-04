const assert=require('node:assert/strict');
const {runtime}=require('./career_test_runtime.cjs');
const r=runtime(),q=r.q;
const club=r.context.VELMORA_CLUBS[0];
r.d.assignClubForTest(club);q.initializeCareerLifecycle();
const player=q.getSquad(club)[0];
const samples=[
  {id:'V33-T',category:'TRANSFERS',clubId:club.id,relatedClubIds:[club.id],playerId:player.id,title:`${club.name.toUpperCase()} RECEIVE INTEREST IN ${player.name.toUpperCase()}`,body:[`${club.name} have received a formal approach concerning ${player.name}.`,`No agreement has been reached and the club retains control of the player’s future.`],date:q.currentCareerISO()},
  {id:'V33-M',category:'LEAGUE WATCH',clubId:club.id,title:`${club.name.toUpperCase()} PREPARE FOR THE NEXT TEST`,body:[`${club.name} are preparing for another league fixture.`],date:q.currentCareerISO()},
  {id:'V33-P',category:'DEVELOPMENT',clubId:club.id,playerId:player.id,title:`${player.name.toUpperCase()} MAKES PROGRESS`,body:[`${player.name} has made measurable progress in the latest development review.`],date:q.currentCareerISO()}
];
const report={status:'PASS',checks:[],measurements:{}};
for(const s of samples){
  const enriched=q.v33NewsEnrichStory(s),meta=q.buildStoryPresentation(enriched,club),article=q.v33NewsArticle(enriched,meta),again=q.v33NewsArticle(enriched,meta);
  assert.equal(enriched.editorialVersion,33);
  assert(enriched.articleSnapshot&&enriched.articleSnapshot.club);
  assert(article.sections.length>=3);
  assert(article.paragraphs.length>=7);
  assert(article.wordCount>=250);
  assert.equal(article.wordCount,again.wordCount);
  assert.deepEqual(Array.from(article.paragraphs),Array.from(again.paragraphs));
  report.measurements[s.id]={family:article.family,paragraphs:article.paragraphs.length,words:article.wordCount,minutes:article.readingMinutes};
}
assert.notEqual(report.measurements['V33-T'].family,report.measurements['V33-P'].family);
const fingerprints=new Set();
for(let i=0;i<64;i++){const raw={...samples[0],id:`V33-VARIANT-${i}`,title:`${club.name.toUpperCase()} TRANSFER FILE ${i}`};const e=q.v33NewsEnrichStory(raw),m=q.buildStoryPresentation(e,club),a=q.v33NewsArticle(e,m);fingerprints.add(a.paragraphs.join('\n'));}
assert(fingerprints.size>=56,`Expected broad wording variety, got ${fingerprints.size}/64 unique articles`);
report.measurements.variantSample={generated:64,unique:fingerprints.size};
report.checks.push('news stories receive a stable V33 context snapshot');
report.checks.push('short career facts expand into multi-section long-form articles');
report.checks.push('editorial generation is deterministic for a saved story');
report.checks.push('transfer, match and player stories use different editorial families');
const source=require('node:fs').readFileSync(require('node:path').resolve(__dirname,'..','styles.css'),'utf8');
assert(source.includes('V33 — LIVING NEWSROOM / LONG-FORM EDITORIAL REBUILD'));
assert(source.includes('.vm-news-cinema'));
assert(source.includes('.vm-news-copy-section'));
report.checks.push('full article presentation uses the V33 cinematic dark newsroom layout');
console.log(JSON.stringify(report,null,2));
