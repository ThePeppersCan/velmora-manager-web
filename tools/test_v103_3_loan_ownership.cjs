'use strict';

const assert=require('node:assert/strict');
const {runtime}=require('./career_test_runtime.cjs');

const r=runtime(),q=r.q;
const parent=r.context.VELMORA_CLUBS.find(club=>club.id==='redwick');
r.d.assignClubForTest(parent);
q.initializeCareerLifecycle();

const player=q.getSquad(parent).find(candidate=>!candidate.captain&&!candidate.onLoan&&!candidate.v34Precontract);
const borrower=q.state().clubs.find(club=>club.id!==parent.id&&q.getSquad(club).length<q.squadCapForClub(club));
assert(player&&borrower,'A valid parent, borrower and player are available');

const original={wage:player.wage,contractYears:player.contractYears,transferStatus:player.transferStatus,askingPrice:player.askingPrice};
const loanOffer={id:'V1033-LOAN-OFFER',parentClubId:parent.id,loanClubId:borrower.id,expectedRole:'Important',wageContribution:60};
assert.equal(q.completeLivingLoan(loanOffer,player,borrower),true,'The control loan completes');
const loan=q.livingLoanForPlayer(player.id);
assert(loan&&player.onLoan,'The active loan registration is authoritative');

r.d.assignClubForTest(borrower);
const rights=q.playerRegistrationRights(borrower,player);
assert.equal(rights.loanedIn,true);
assert.equal(rights.ownsContract,false);
assert.equal(rights.ownerClubId,parent.id);
assert.equal(rights.registeredClubId,borrower.id);

const contractHtml=q.livingPlayerContractHTML(player,borrower);
assert.match(contractHtml,/LOAN REGISTRATION/);
assert.match(contractHtml,new RegExp(parent.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
for(const forbidden of ['data-open-renewal','data-player-market-status','data-set-asking-price','data-release-player'])assert(!contractHtml.includes(forbidden),`Loan view must not expose ${forbidden}`);
assert.equal(q.v2075RenewalReadiness(player,borrower).canNegotiate,false);

assert.equal(q.setLivingPlayerMarketStatus(player,'TRANSFER_LISTED'),false);
assert.equal(player.transferStatus,'LISTEN');
assert.equal(player.transferListed,false);
assert.equal(player.loanListed,false);
assert.equal(q.setLivingPlayerAskingPrice(player,9999999),false);
assert.equal(player.askingPrice,null);
assert.equal(q.openContractRenewal(player),false);
assert.equal(player.wage,original.wage);
assert.equal(player.contractYears,original.contractYears);

const borrowerRosterBefore=q.getSquad(borrower).length;
assert.equal(q.releaseSeniorPlayer(borrower,player,true),false);
assert.equal(q.getSquad(borrower).length,borrowerRosterBefore);
assert(q.getSquad(borrower).some(candidate=>candidate.id===player.id));
assert(!q.getTransferPool(true).some(candidate=>candidate.id===player.id),'Active loanees are not misrepresented as permanent transfer targets');

const buyer=q.state().clubs.find(club=>club.id!==parent.id&&club.id!==borrower.id);
const staleOffer={id:'V1033-STALE-SALE',playerId:player.id,sellerClubId:borrower.id,buyerClubId:buyer.id,status:'OPEN',currentFee:100000};
q.state().livingSquad.incomingOffers.push(staleOffer);
assert.equal(q.completeLivingUserSale(staleOffer,player,buyer,100000,'TEST'),false);
assert.equal(q.validateLivingSaleOfferOwnership(staleOffer,player,false),false);
assert.equal(staleOffer.status,'CLOSED');
assert.equal(player.clubId,borrower.id);
assert.equal(player.ownerClubId,parent.id);

player.transferListed=true;
player.loanListed=true;
player.transferRequested=true;
player.transferStatus='TRANSFER_LISTED';
player.askingPrice=1000000;
q.repairLivingLoans();
assert.equal(player.transferListed,false);
assert.equal(player.loanListed,false);
assert.equal(player.transferRequested,false);
assert.equal(player.transferStatus,'LISTEN');
assert.equal(player.askingPrice,null);

assert.equal(q.returnLivingLoan(loan,'2027-06-30'),true);
r.d.assignClubForTest(parent);
const returned=q.playerRegistrationRights(parent,player);
assert.equal(returned.isLoan,false);
assert.equal(returned.ownsContract,true);
assert.equal(q.clubCanRenewPlayer(parent,player),true);
assert.equal(q.clubCanMarketPlayer(parent,player),true);

console.log(JSON.stringify({status:'PASS',checks:[
  'loan parent retains permanent ownership',
  'loan profile is read-only for ownership actions',
  'renewal, listing, asking price and release are hard-blocked',
  'active loanee is excluded from permanent recruitment',
  'stale sale cannot transfer a borrowed player',
  'legacy loan flags are repaired',
  'full controls return to the parent after recall'
]},null,2));
