'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom'),{runtime}=require('./career_test_runtime.cjs');

const r=runtime(),q=r.q,c=r.context.VELMORA_CLUBS.find(club=>club.id==='redwick');
r.d.assignClubForTest(c);q.initializeCareerLifecycle();q.setCareerDate('2026-08-10');
const committed=q.v25ClubWeeklyWages(c),finance=q.v25ClubFinance(c);c.budget='£7,000,000';finance.wageBudget=Math.ceil((committed+20_000)/100)*100;

const dom=new JSDOM(fs.readFileSync(path.resolve(__dirname,'../index.html'),'utf8'),{url:'https://velmora.example/'}),doc=dom.window.document;
for(const node of r.nodes.values())node.isConnected=false;
r.context.document=doc;r.context.FormData=dom.window.FormData;r.context.HTMLElement=dom.window.HTMLElement;r.context.Element=dom.window.Element;
r.context.VELMORA_EXPANSION.initUI();q.renderTransfers();

const slider=doc.querySelector('#transferBudgetAllocation'),beforeTransfer=q.moneyNumber(c.budget),beforeWage=finance.wageBudget,beforeTotal=beforeTransfer+beforeWage*52;
assert(slider,'Transfer screen exposes the budget allocation slider');
assert.equal(Number(slider.value),beforeWage,'Slider reflects the live weekly wage allocation');
assert.match(doc.querySelector('#transferWageCommitted').textContent,/Committed .*\/w .* free/,'Committed and available weekly wages are explicit');
assert.match(doc.querySelector('.transfer-budget-total span').textContent,/TRANSFER BUDGET/,'The transfer pot is not mislabeled as a wage budget');

const requested=Math.min(Number(slider.max),beforeWage+10_000);assert(requested>beforeWage,'Transfer funds can create additional wage room');
slider.value=String(requested);slider.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
assert.equal(finance.wageBudget,beforeWage,'Dragging previews the split without repeatedly writing career state');
assert(q.moneyNumber(doc.querySelector('#transferBudgetValue').textContent)<beforeTransfer,'Increasing wages previews a lower transfer budget');
slider.dispatchEvent(new dom.window.Event('change',{bubbles:true}));
assert.equal(finance.wageBudget,requested,'Releasing the slider commits the wage allocation');
assert.equal(q.moneyNumber(c.budget),beforeTransfer-(requested-beforeWage)*52,'Each extra weekly pound costs £52 of transfer funds');
assert.equal(q.moneyNumber(c.budget)+finance.wageBudget*52,beforeTotal,'Reallocation never creates or removes money');

const floor=q.v89AllocateBudgets(c,0);assert(floor.wageBudget>=floor.committed,'The wage slider cannot move below existing commitments');
assert.equal(floor.transferBudget+floor.wageBudget*52,beforeTotal,'The commitment floor also preserves the shared pot');

console.log(JSON.stringify({status:'PASS',checks:['clear transfer and wage budget labels','live slider preview','FIFA-style £52 annual conversion','career-state commit on change','shared-pot conservation','existing wage commitments protected']},null,2));
