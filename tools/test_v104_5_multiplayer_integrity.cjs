'use strict';
// V104.5 · Human clubs remain human on every device.

const assert=require('node:assert/strict');
const {runtime}=require('./career_test_runtime.cjs');

const CAREER_ID='integrity-career';
const BUYER_ID='ezuraya-4-takezora';
const SELLER_ID='ezuraya-4-sorin-gate';
const BUYER_USER='manager-takezora';
const SELLER_USER='manager-sorin';
const members=[
  {user_id:BUYER_USER,club_id:BUYER_ID,club_name:'Takezora',manager_name:'Isaac',status:'ACTIVE'},
  {user_id:SELLER_USER,club_id:SELLER_ID,club_name:'Sorin Gate',manager_name:'Sam',status:'ACTIVE'}
];

function begin(dev,clubId,userId,identity){
  dev.context.window.VelmoraMultiplayerGame.begin({
    careerId:CAREER_ID,clubId,userId,humanClubIds:[BUYER_ID,SELLER_ID],members,
    claims:members,identity:identity||dev.context.window.VelmoraMultiplayerGame.captureIdentity(),
    client:null,status:{readOnly:false,members,barrier:null}
  });
}

const first=runtime(),q=first.q,win=first.context.window;
const buyer=win.VELMORA_CLUBS.find(club=>club.id===BUYER_ID);
const seller=win.VELMORA_CLUBS.find(club=>club.id===SELLER_ID);
assert.ok(buyer&&seller,'the two reported clubs exist');
first.d.assignClubForTest(buyer);q.initializeCareerLifecycle();q.setCareerDate('2026-08-10');
buyer.budget='£100000000';seller.budget='£8000000';
begin(first,buyer.id,BUYER_USER);

// The public club page must resolve the online seat, not a stale AI manager.
const buyerManager=q.currentClubManager(buyer),sellerManager=q.currentClubManager(seller);
assert.equal(buyerManager.name,'Isaac');
assert.equal(sellerManager.name,'Sam');
assert.equal(buyerManager.humanControlled,true);
assert.equal(sellerManager.humanControlled,true);
assert.notEqual(buyerManager.id,sellerManager.id,'online managers have stable distinct identities');

const buyerChairman=q.chairmanForClub(buyer),sellerChairman=q.chairmanForClub(seller);
assert.ok(buyerChairman&&sellerChairman,'both clubs have chairmen');
assert.notEqual(buyerChairman.id,sellerChairman.id,'chairmen belong to clubs, not the local device');
assert.notEqual(buyerChairman.name,sellerChairman.name,'the two reported clubs have different chairmen');

const source=q.getSquad(seller).find(player=>!player.captain&&!player.onLoan);
const alternate=q.getSquad(seller).find(player=>player.id!==source.id&&!player.captain&&!player.onLoan);
assert.ok(source&&alternate,'the selling club has eligible players');

const alternateDeal=win.VELMORA_EXPANSION.proposeDeal(alternate.id,'TRANSFER',{
  fee:500000,wage:100000,bonus:0,years:3,role:'Rotation',sellOn:0,
  releaseClause:0,optionFee:0,wageShare:100,installments:1,addOnType:'NONE',addOnAmount:0
});
assert.equal(alternateDeal.ok,false,'the alternate AI deal route cannot bypass a human manager');
assert.match(alternateDeal.message,/controlled by another online manager/i);
assert.equal(q.realisticAiTransferCandidate(seller,'2026-08-10'),null,
  'AI recruitment never acts on behalf of a human-controlled buyer');

const base=win.VelmoraMultiplayerBridge.buildSnapshot();
const second=runtime(),sq=second.q,swin=second.context.window;
const staleClub=swin.VELMORA_CLUBS.find(club=>club.id===BUYER_ID);
second.d.assignClubForTest(staleClub);sq.initializeCareerLifecycle();
const staleIdentity=swin.VelmoraMultiplayerGame.captureIdentity();
begin(second,SELLER_ID,SELLER_USER,staleIdentity);
assert.equal(swin.VelmoraMultiplayerBridge.applySnapshot(base.payload),true);
assert.equal(sq.state().currentClub.id,SELLER_ID,
  'the claimed online seat overrides a stale local-save club identity');
assert.equal(sq.currentClubManager(sq.clubById(BUYER_ID)).name,'Isaac');
assert.equal(sq.currentClubManager(sq.clubById(SELLER_ID)).name,'Sam');

const fee=750000,bonus=25000,wage=3000,years=3,offerId='HTO-INTEGRITY-1';
const offerPayload={offerId,playerId:source.id,playerName:source.name,buyerClubId:BUYER_ID,
  sellerClubId:SELLER_ID,buyerUserId:BUYER_USER,sellerUserId:SELLER_USER,fee,
  createdDate:'2026-08-10',expiresDate:'2026-08-17'};
const responsePayload={...offerPayload,status:'ACCEPTED',respondedDate:'2026-08-10'};
const transferPayload={transferId:'ONLINE-INTEGRITY-1',offerId,playerId:source.id,
  playerName:source.name,buyerClubId:BUYER_ID,sellerClubId:SELLER_ID,fee,wage,bonus,
  role:'Rotation',years,releaseClause:0,date:'2026-08-10',freeAgent:false};

function applyFlow(dev){
  const bridge=dev.context.window.VelmoraMultiplayerBridge,state=dev.q.state;
  assert.equal(bridge.applyWorldAction('HUMAN_TRANSFER_OFFER',offerPayload,
    `HUMAN_TRANSFER_OFFER:${offerId}`,{actor_user_id:BUYER_USER}),true);
  const liveOffer=state().livingSquad.incomingOffers.find(row=>row.id===offerId);
  assert.equal(liveOffer.status,'OPEN');

  assert.equal(bridge.applyWorldAction('HUMAN_TRANSFER_RESPONSE',responsePayload,
    `HUMAN_TRANSFER_RESPONSE:${offerId}`,{actor_user_id:BUYER_USER}),false,
    'the buyer cannot approve their own offer');
  assert.equal(liveOffer.status,'OPEN');
  assert.equal(bridge.applyWorldAction('HUMAN_TRANSFER_RESPONSE',responsePayload,
    `HUMAN_TRANSFER_RESPONSE:${offerId}`,{actor_user_id:SELLER_USER}),true);
  assert.equal(liveOffer.status,'FEE_AGREED');

  assert.equal(bridge.applyWorldAction('TRANSFER',transferPayload,
    `PLAYER:${source.id}:2026-SUMMER`,{actor_user_id:BUYER_USER}),false,
    'a generic AI transfer cannot take a human club player');
  assert.equal(bridge.applyWorldAction('HUMAN_TRANSFER_COMPLETE',{...transferPayload,fee:fee+1},
    `PLAYER:${source.id}:2026-SUMMER`,{actor_user_id:BUYER_USER}),false,
    'the buyer cannot alter the fee after the seller accepts');

  const beforeBuyer=dev.q.moneyNumber(dev.q.clubById(BUYER_ID).budget);
  const beforeSeller=dev.q.moneyNumber(dev.q.clubById(SELLER_ID).budget);
  assert.equal(bridge.applyWorldAction('HUMAN_TRANSFER_COMPLETE',transferPayload,
    `PLAYER:${source.id}:2026-SUMMER`,{actor_user_id:BUYER_USER}),true);
  assert.equal(dev.q.getSquad(dev.q.clubById(SELLER_ID)).some(player=>player.id===source.id),false);
  assert.equal(dev.q.getSquad(dev.q.clubById(BUYER_ID)).filter(player=>player.id===source.id).length,1);
  assert.equal(dev.q.moneyNumber(dev.q.clubById(BUYER_ID).budget),beforeBuyer-fee-bonus);
  assert.equal(dev.q.moneyNumber(dev.q.clubById(SELLER_ID).budget),beforeSeller+fee);
  assert.equal(state().livingSquad.transferHistory.filter(row=>row.id===transferPayload.transferId).length,1);
  const after={buyer:dev.q.clubById(BUYER_ID).budget,seller:dev.q.clubById(SELLER_ID).budget};
  assert.equal(bridge.applyWorldAction('HUMAN_TRANSFER_COMPLETE',transferPayload,
    `PLAYER:${source.id}:2026-SUMMER`,{actor_user_id:BUYER_USER}),true,
    'replaying a completed shared event is idempotent');
  assert.deepEqual({buyer:dev.q.clubById(BUYER_ID).budget,seller:dev.q.clubById(SELLER_ID).budget},after);
  return{
    buyerBudget:dev.q.moneyNumber(dev.q.clubById(BUYER_ID).budget),
    sellerBudget:dev.q.moneyNumber(dev.q.clubById(SELLER_ID).budget),
    buyerPlayers:dev.q.getSquad(dev.q.clubById(BUYER_ID)).map(player=>player.id).sort(),
    sellerPlayers:dev.q.getSquad(dev.q.clubById(SELLER_ID)).map(player=>player.id).sort(),
    transfer:state().livingSquad.transferHistory.find(row=>row.id===transferPayload.transferId)
  };
}

const firstWorld=applyFlow(first),secondWorld=applyFlow(second);
assert.equal(JSON.stringify(secondWorld),JSON.stringify(firstWorld),
  'both managers converge on the same squads, budgets and transfer record');

console.log(JSON.stringify({
  status:'PASS',version:'V104.5',clubs:[buyer.name,seller.name],player:source.name,
  checks:[
    'both club pages show the correct human manager',
    'each club keeps its own chairman',
    'stale local identity cannot override an online seat',
    'AI and alternate deal routes skip human clubs',
    'only the seller can accept or reject',
    'an accepted fee cannot be changed by the buyer',
    'generic transfer events cannot take human-owned players',
    'completion is idempotent and both saves converge'
  ]
},null,2));
