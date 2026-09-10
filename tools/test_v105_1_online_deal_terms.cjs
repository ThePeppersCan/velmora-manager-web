'use strict';
// V105.1 · Online deal terms, against the real career engine
//
// Drives app.js's actual world-action handlers, not a stand-in: a full
// manager-to-manager negotiation that is countered before it is agreed, and
// a sell-on clause that has to survive the registration.

const assert=require('node:assert/strict');
const {runtime}=require('./career_test_runtime.cjs');

const r=runtime(),q=r.q,win=r.context.window;
const bridge=win.VelmoraMultiplayerBridge,online=win.VelmoraMultiplayerGame;
const clubs=r.context.VELMORA_CLUBS;

const myClub=clubs.find(c=>c.id==='redwick');
r.d.assignClubForTest(myClub);
q.initializeCareerLifecycle();

const buyerClub=clubs.find(c=>c.divisionKey===myClub.divisionKey&&c.id!==myClub.id);
online.begin({careerId:'test-career',clubId:myClub.id,userId:'u1',
  humanClubIds:[myClub.id,buyerClub.id],
  claims:[{user_id:'u1',club_id:myClub.id},{user_id:'u2',club_id:buyerClub.id}],
  identity:online.captureIdentity(),client:null,status:null});

// I am the selling manager. The player is one of mine.
const target=q.getSquad(myClub).find(p=>!p.captain);
assert.ok(target,'the selling club has a player it can be asked about');

const OFFER='HTO-TEST-1';
const base={offerId:OFFER,playerId:target.id,playerName:target.name,
  buyerClubId:buyerClub.id,sellerClubId:myClub.id,
  buyerUserId:'u2',sellerUserId:'u1'};
const seller={actor_user_id:'u1'},buyer={actor_user_id:'u2'};
const offerNow=()=>q.state().livingSquad.incomingOffers.find(o=>o.id===OFFER);

// ---- the opening package ------------------------------------------------
assert.equal(bridge.applyWorldAction('HUMAN_TRANSFER_OFFER',
  {...base,fee:400000,terms:{fee:400000,sellOn:0,years:3,role:'Rotation',wage:9000}},
  `HUMAN_TRANSFER_OFFER:${OFFER}`,buyer),true,'the buying manager can open a negotiation');
assert.equal(offerNow().status,'OPEN','the offer is live');
assert.equal(offerNow().awaiting,'SELLER','and it is the selling manager who must answer');
assert.equal(q.v104OfferIsMyTurn(offerNow()),true,'this device is the one being asked');

// ---- the buyer cannot answer their own offer ----------------------------
assert.equal(bridge.applyWorldAction('HUMAN_TRANSFER_RESPONSE',
  {...base,fee:400000,actorSide:'BUYER',status:'ACCEPTED'},
  `HUMAN_TRANSFER_RESPONSE:${OFFER}`,buyer),false,
  'the buying manager cannot accept on the selling manager\'s behalf');
assert.equal(offerNow().status,'OPEN','so the offer is untouched');

// ---- the seller counters, asking for more and for a sell-on -------------
assert.equal(bridge.applyWorldAction('HUMAN_TRANSFER_COUNTER',
  {...base,fee:650000,terms:{fee:650000,sellOn:20,years:3,role:'Rotation',wage:9000},
   actorSide:'SELLER',round:1},
  `HUMAN_TRANSFER_COUNTER:${OFFER}:R1`,seller),true,'the selling manager can counter');
assert.equal(offerNow().currentFee,650000,'the package on the table is the counter');
assert.equal(offerNow().terms.sellOn,20,'including the sell-on being asked for');
assert.equal(offerNow().awaiting,'BUYER','and now the buyer has to answer');
assert.equal(q.v104OfferIsMyTurn(offerNow()),false,'this device is no longer the one being asked');

// ---- a stale or replayed round cannot rewrite the package ---------------
assert.equal(bridge.applyWorldAction('HUMAN_TRANSFER_COUNTER',
  {...base,fee:50000,terms:{fee:50000,sellOn:0,years:3,role:'Rotation'},actorSide:'SELLER',round:1},
  `HUMAN_TRANSFER_COUNTER:${OFFER}:R1`,seller),true,'a replayed round is absorbed');
assert.equal(offerNow().currentFee,650000,'without rewriting the agreed package');

// ---- and the seller cannot counter their own counter -------------------
assert.equal(bridge.applyWorldAction('HUMAN_TRANSFER_COUNTER',
  {...base,fee:900000,terms:{fee:900000,sellOn:25,years:3,role:'Rotation'},actorSide:'SELLER',round:2},
  `HUMAN_TRANSFER_COUNTER:${OFFER}:R2`,seller),false,
  'the side already waiting on an answer cannot move again');
assert.equal(offerNow().currentFee,650000,'the package still stands');

// ---- the buyer accepts --------------------------------------------------
assert.equal(bridge.applyWorldAction('HUMAN_TRANSFER_RESPONSE',
  {...base,fee:650000,terms:offerNow().terms,actorSide:'BUYER',status:'ACCEPTED'},
  `HUMAN_TRANSFER_RESPONSE:${OFFER}`,buyer),true,'the buyer can accept the counter');
assert.equal(offerNow().status,'FEE_AGREED','the package is agreed');

// ---- the sell-on cannot be dropped between approval and registration ----
assert.equal(bridge.applyWorldAction('HUMAN_TRANSFER_COMPLETE',
  {transferId:'ONLINE-TEST-BAD',offerId:OFFER,playerId:target.id,playerName:target.name,
   buyerClubId:buyerClub.id,sellerClubId:myClub.id,fee:650000,wage:9000,bonus:0,
   role:'Rotation',years:3,releaseClause:0,terms:{...offerNow().terms,sellOn:0},
   date:q.currentCareerISO(),freeAgent:false},
  `PLAYER:${target.id}:bad`,buyer),false,
  'a registration that quietly drops the agreed sell-on is refused');

// ---- an honest registration completes and records the clause -----------
const agreed=offerNow().terms;
assert.equal(bridge.applyWorldAction('HUMAN_TRANSFER_COMPLETE',
  {transferId:'ONLINE-TEST-1',offerId:OFFER,playerId:target.id,playerName:target.name,
   buyerClubId:buyerClub.id,sellerClubId:myClub.id,fee:650000,wage:9000,bonus:0,
   role:'Rotation',years:3,releaseClause:0,terms:agreed,
   date:q.currentCareerISO(),freeAgent:false},
  `PLAYER:${target.id}:window`,buyer),true,'the agreed package registers');

const moved=q.getSquad(buyerClub).find(p=>p.id===target.id);
assert.ok(moved,'the player is now registered to the buying club');
assert.ok(!q.getSquad(myClub).some(p=>p.id===target.id),'and gone from the selling club');
assert.ok(moved.v34SellOn,'the sell-on clause is recorded on the player');
assert.equal(moved.v34SellOn.percent,20,'at the percentage that was agreed');
assert.equal(moved.v34SellOn.beneficiary,myClub.id,'owed to the club that sold him');
assert.equal(moved.v34SellOn.owedBy,buyerClub.id,'by the club that bought him');

// ---- and it is actually paid when he is sold on ------------------------
// The clause is worthless if the settlement never runs. Before this release
// an online registration moved the player without ever calling onTransfer,
// so a clause agreed anywhere was silently lost at the next sale.
const thirdClub=clubs.find(c=>c.id!==myClub.id&&c.id!==buyerClub.id&&c.divisionKey===myClub.divisionKey);
const sellerBefore=q.moneyNumber(myClub.budget);
const resale=2000000;
q.recordLivingTransfer(moved,buyerClub,thirdClub,resale);
const sellerAfter=q.moneyNumber(myClub.budget);
assert.equal(sellerAfter-sellerBefore,Math.floor(resale*20/100),
  'the selling club receives its 20% when the player is sold on');
assert.ok(!moved.v34SellOn,'and the clause is spent, not charged twice');

// ---- a clause carried INTO an online registration is honoured ----------
// This is the case that used to fail. v104ApplyTransferComplete moved the
// player itself and never ran the settlement, so a clause agreed offline or
// in an earlier career was dropped the moment that player changed hands in a
// shared world.
const owedTo=clubs.find(c=>c.id!==myClub.id&&c.id!==buyerClub.id&&c.divisionKey===myClub.divisionKey);
const second=q.getSquad(myClub).find(p=>!p.captain&&p.id!==target.id);
second.v34SellOn={beneficiary:owedTo.id,owedBy:myClub.id,percent:10};
const owedBefore=q.moneyNumber(owedTo.budget);

const OFFER2='HTO-TEST-2',base2={offerId:OFFER2,playerId:second.id,playerName:second.name,
  buyerClubId:buyerClub.id,sellerClubId:myClub.id,buyerUserId:'u2',sellerUserId:'u1'};
const plainTerms={fee:1000000,sellOn:0,years:3,role:'Rotation',wage:9000};
bridge.applyWorldAction('HUMAN_TRANSFER_OFFER',{...base2,fee:1000000,terms:plainTerms},
  `HUMAN_TRANSFER_OFFER:${OFFER2}`,buyer);
bridge.applyWorldAction('HUMAN_TRANSFER_RESPONSE',
  {...base2,fee:1000000,terms:plainTerms,actorSide:'SELLER',status:'ACCEPTED'},
  `HUMAN_TRANSFER_RESPONSE:${OFFER2}`,seller);
assert.equal(bridge.applyWorldAction('HUMAN_TRANSFER_COMPLETE',
  {transferId:'ONLINE-TEST-2',offerId:OFFER2,playerId:second.id,playerName:second.name,
   buyerClubId:buyerClub.id,sellerClubId:myClub.id,fee:1000000,wage:9000,bonus:0,
   role:'Rotation',years:3,releaseClause:0,terms:q.v104NormaliseDealTerms(plainTerms),
   date:q.currentCareerISO(),freeAgent:false},
  `PLAYER:${second.id}:window`,buyer),true,'the second registration completes');

assert.equal(q.moneyNumber(owedTo.budget)-owedBefore,Math.floor(1000000*10/100),
  'a club owed a sell-on is paid when the player moves through an online registration');
const movedSecond=q.getSquad(buyerClub).find(p=>p.id===second.id);
assert.ok(!movedSecond.v34SellOn,'and the spent clause does not follow him to the new club');

console.log(JSON.stringify({status:'PASS',version:'V105.1',
  checks:[
    'a manager-to-manager package can be countered before it is agreed',
    'only the side being asked can answer or counter',
    'a replayed or stale round cannot rewrite the package',
    'a registration cannot quietly drop the agreed sell-on',
    'an agreed sell-on is recorded against the selling club',
    'and is actually paid out when that player is later sold',
    'a clause carried into an online registration is honoured, not dropped'
  ]},null,2));
