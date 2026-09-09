'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {runtime}=require('./career_test_runtime.cjs');
// The release cache key is read from release-meta.js so a version bump
// never has to be chased through the test suite by hand.
const RELEASE_CACHE_KEY=require('../release-meta.js').cacheKey;

const root=path.resolve(__dirname,'..');
const r=runtime(),q=r.q,d=r.d;
const playerClub=r.context.VELMORA_CLUBS[0];
d.assignClubForTest(playerClub);
q.initializeCareerLifecycle();

const integrity=d.v91ManagerCareerIntegrityForTest();
assert.equal(integrity.version,'V91');
assert.equal(integrity.signals,4,'four clear career signals explain the current assessment');
assert(integrity.targetClubs>=3,'career trajectory identifies several credible next steps');
assert.equal(integrity.noVacancyIntelligence,true,'an empty market still supplies useful intelligence');
assert.equal(integrity.jobOfferNegotiation,true);
assert.equal(integrity.contractDiscussion,true);
assert.equal(integrity.careerTimeline,true);
assert.equal(integrity.managerArtworkReused,true);
assert.equal(integrity.newSpriteDependency,false);

const html=d.v91ManagerCareerHtmlForTest();
for(const marker of ['mc-command-hero','mc-metric-ribbon','mc-overview-lead','mc-signals','mc-reputation-path','manager-world-pulse','mc-trajectory','manager-spell-card'])assert(html.includes(marker),`manager career screen contains ${marker}`);
assert(html.includes('WHY YOUR POSITION IS CHANGING'),'job security explanation is visible');
assert(html.includes('These are suitability projections, not invented interest'),'trajectory language does not fabricate club interest');

const aiClub=r.context.VELMORA_CLUBS.find(club=>club.id!==playerClub.id);
d.v44OpenVacancyForTest(aiClub.id);
const vacancy=q.managerVacancyForClub(aiClub.id);
const offer=q.createManagerJobOffer(vacancy,null,'V91_QA');
const startingSalary=offer.weeklySalary;
const negotiation=d.v91NegotiateJobOfferForTest(offer.id,'salary');
assert.equal(negotiation.used,true,'job-offer counter is stored');
assert(['THE BOARD AGREE','THE BOARD HOLD THEIR POSITION'].includes(negotiation.title));
const repeated=d.v91NegotiateJobOfferForTest(offer.id,'resources');
assert.equal(repeated.request,'resources','distinct contractual concessions can be discussed once each');
assert.equal(offer.negotiations.length,2,'the full negotiation history is retained');
if(negotiation.accepted)assert(offer.weeklySalary>startingSalary,'accepted salary request improves the offer');

const contractOffer={id:'V91-CONTRACT-QA',type:'CONTRACT',clubId:playerClub.id,receivedDate:q.currentCareerISO(),expiresDate:q.addDaysISO(q.currentCareerISO(),14),contractYears:2,weeklySalary:2600,status:'OPEN'};
q.state().managerMarket.offers.push(contractOffer);
const contractReply=d.v91NegotiateContractForTest(contractOffer.id);
assert.equal(contractReply.used,true,'contract counter is stored');
assert.equal(contractReply.request,'term');
if(contractReply.accepted)assert.equal(contractOffer.contractYears,3,'accepted contract counter extends the term');

const css=fs.readFileSync(path.join(root,'manager-career.css'),'utf8');
const page=fs.readFileSync(path.join(root,'index.html'),'utf8');
const manifest=fs.readFileSync(path.join(root,'tools','release_manifest.cjs'),'utf8');
const prompt=fs.readFileSync(path.join(root,'MANAGER_CAREER_JOB_MARKET_AAA_MASTER_PROMPT.md'),'utf8');
for(const marker of ['.mc-command-hero','.mc-signal-grid','.mc-market-intelligence','.mc-boardroom-scene','.manager-offer-actions'])assert(css.includes(marker),`presentation marker ${marker}`);
assert(page.includes(`manager-career.css?v=${RELEASE_CACHE_KEY}`),'manager career stylesheet uses the unified release cache key');
assert(manifest.includes("'manager-career.css'"),'manager career stylesheet ships in release builds');
assert(prompt.includes('MANAGER CAREER & LIVE JOB MARKET'),'implementation brief is retained with the project');

console.log(JSON.stringify({status:'PASS',integrity,negotiation:negotiation.title,contractReply:contractReply.title,checks:['full-width manager identity dashboard','explainable security and reputation','live market feed and trajectory','useful zero-vacancy intelligence','interactive interviews and offer counters','interactive contract discussion','persistent career timeline','existing artwork reused']},null,2));
