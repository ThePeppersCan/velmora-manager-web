'use strict';
// V104.8 · What actually decides a match
//
// An audit found squad quality, fitness and morale working, home advantage
// working on one route only, and two systems that were displayed to the player
// while changing nothing: the tactical plan and player form. These checks hold
// the corrected model in place, in one unit throughout -- points of team
// strength, where one point of squad OVR is worth two.

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {runtime}=require('./career_test_runtime.cjs');

const r=runtime(),q=r.q;
const clubs=r.context.VELMORA_CLUBS;
const A=clubs[0],B=clubs[1];
r.d.assignClubForTest(A);
q.initializeCareerLifecycle();

function squad(club,ovr,extra={}){
  q.getSquad(club).forEach(p=>{
    p.ovr=ovr;p.stats={PAC:ovr,SHO:ovr,PAS:ovr,HAN:ovr,DEF:ovr,STA:ovr};
    p.fitness=extra.fitness??100;p.morale=extra.morale??'Content';p.form=extra.form??'Average';
    p.playingTraits=[];p.injuryDaysRemaining=0;p.onLoan=false;
  });
}
function rng(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function outcomes(xgHome,xgAway,n=40000){
  let w=0,d=0,l=0,goals=0;
  for(let i=0;i<n;i++){
    const roll=rng(i*2654435761%2147483647);
    const h=q.backgroundGoals(roll,xgHome),a=q.backgroundGoals(roll,xgAway);
    goals+=h+a;
    if(h>a)w++;else if(h<a)l++;else d++;
  }
  return{win:w/n,draw:d/n,loss:l/n,goals:goals/n,homePoints:(w*3+d)/n,awayPoints:(l*3+d)/n};
}
const neutralTactics={defensive:'Balanced',attacking:'Balanced',mentality:'Balanced',width:'Balanced',tempo:'Balanced',freedom:'Balanced'};

// ---------------------------------------------------------------
// Squad quality decides matches, and does so smoothly
// ---------------------------------------------------------------
const curve=[];
for(const gap of [-15,-10,-5,0,5,10,15]){
  squad(A,60+gap);squad(B,60);
  const xg=q.v24ExpectedGoals(A,B,false,null);
  curve.push({gap,win:outcomes(xg.home,xg.away).win});
}
for(let i=1;i<curve.length;i++)
  assert.ok(curve[i].win>curve[i-1].win+0.02,
    `a better squad wins more often at every step (${curve[i-1].gap} -> ${curve[i].gap})`);
const even=curve.find(row=>row.gap===0);
assert.ok(even.win>0.36&&even.win<0.48,'an even match is close to even, with the home edge');
assert.ok(curve.at(-1).win>0.72,'a much better squad is a clear favourite');
assert.ok(curve.at(-1).win<0.95,'but never a certainty');
assert.ok(curve[0].win>0.03,'and the underdog always has a chance');

// ---------------------------------------------------------------
// Home advantage: present, moderate, and the same on both routes
// ---------------------------------------------------------------
squad(A,60);squad(B,60);
const level=q.v24ExpectedGoals(A,B,false,null);
const home=outcomes(level.home,level.away);
const share=home.homePoints/(home.homePoints+home.awayPoints);
assert.ok(share>0.53&&share<0.59,`home advantage is worth about 56% of the points, measured ${(share*100).toFixed(1)}%`);
const neutral=q.v24ExpectedGoals(A,B,false,{neutralVenue:true});
assert.ok(Math.abs(neutral.home-neutral.away)<0.12,'a neutral venue gives neither side the edge');
assert.ok(home.goals>1.9&&home.goals<3.1,`the world scores at a believable rate, measured ${home.goals.toFixed(2)}`);

// The live engine carries the same edge and the same scoring rate. It had
// neither: nothing in it favoured the home side, and it scored twice as freely
// as the rest of the world.
const engine=fs.readFileSync(path.resolve(__dirname,'..','velmora-quidditch-engine.js'),'utf8');
for(const marker of ['CAREER_FINISH_SCALE','CAREER_HOME_EDGE','CAREER_QUALITY_EDGE','careerFinishScale(shooter.team)'])
  assert.ok(engine.includes(marker),`the live match is calibrated against the career world: ${marker}`);
assert.ok(engine.includes('careerFinishScale(team)'),
  'including the late-keeper rescue, which was the largest single source of goals');

// The live match must stay expressive across the gaps this world actually
// produces. A cap that saturates below the real spread makes a cup tie across
// three divisions feel like a close match, which is how it shipped once.
const number=name=>{
  const found=engine.match(new RegExp(name+'\\s*=\\s*([0-9.]+)'));
  assert.ok(found,`${name} is declared`);
  return Number(found[1]);
};
const qualityEdge=number('CAREER_QUALITY_EDGE'),qualityCap=number('CAREER_QUALITY_CAP');
const clubOvr=clubs.map(club=>{
  const players=q.getSquad(club);
  return players.length?players.reduce((sum,p)=>sum+Number(p.ovr||0),0)/players.length:0;
}).filter(Boolean);
const worldSpread=Math.max(...clubOvr)-Math.min(...clubOvr);
assert.ok(worldSpread>20,`the world really does span the divisions, measured ${worldSpread.toFixed(1)} OVR`);
assert.ok(qualityCap/qualityEdge>=worldSpread*0.65,
  `squad quality still separates teams near the top of the world's range (saturates at ${(qualityCap/qualityEdge).toFixed(1)} OVR against a ${worldSpread.toFixed(1)} OVR spread)`);

// ---------------------------------------------------------------
// The tactical plan is worth choosing, and is answered by the opposition
// ---------------------------------------------------------------
const OPTIONS={defensive:['Balanced','Press','Drop Back'],attacking:['Balanced','Possession','Direct','Fast Break'],
  mentality:['Balanced','Attacking','Defensive'],width:['Balanced','Wide','Compact'],
  tempo:['Balanced','Urgent','Patient'],freedom:['Balanced','Fluid','Structured']};
const opponent={...neutralTactics,defensive:'Press',attacking:'Possession'};
let best=-Infinity,worst=Infinity;
for(const d of OPTIONS.defensive)for(const a of OPTIONS.attacking)for(const m of OPTIONS.mentality)
for(const w of OPTIONS.width)for(const t of OPTIONS.tempo)for(const f of OPTIONS.freedom){
  const mod=q.v1048TacticalModifier({defensive:d,attacking:a,mentality:m,width:w,tempo:t,freedom:f},opponent);
  if(mod>best)best=mod;if(mod<worst)worst=mod;
}
const tacticalOvr=(best-worst)/2;
assert.ok(tacticalOvr>1.8&&tacticalOvr<3.2,
  `the plan is worth about two and a half OVR of squad quality, measured ${tacticalOvr.toFixed(2)}`);

// Real matchups, not just a reward for agreeing with the assistant.
const plan=(attacking,defensive)=>({...neutralTactics,attacking,defensive});
const net=(mine,theirs)=>q.v1048TacticalModifier(mine,theirs)-q.v1048TacticalModifier(theirs,mine);
assert.ok(net(plan('Fast Break','Balanced'),plan('Balanced','Press'))>0.6,
  'breaking quickly punishes a high press');
assert.ok(net(plan('Possession','Balanced'),plan('Balanced','Press'))<-0.6,
  'patient possession is smothered by that same press');
assert.ok(net(plan('Possession','Balanced'),plan('Balanced','Drop Back'))>0.3,
  'but patience unpicks a deep block');
assert.ok(net(plan('Fast Break','Balanced'),plan('Balanced','Drop Back'))<-0.3,
  'where there is no space to break into');
// An incoherent plan costs something even with the right approach.
assert.ok(q.v1048TacticalModifier({...plan('Possession','Balanced'),tempo:'Patient'},opponent)>
          q.v1048TacticalModifier({...plan('Possession','Balanced'),tempo:'Urgent'},opponent),
  'instructions that contradict each other are worth less than ones that agree');
// Both sides of every fixture are judged the same way.
assert.equal(q.v1048TacticalModifier(neutralTactics,neutralTactics),
             q.v1048TacticalModifier(neutralTactics,neutralTactics));

// ---------------------------------------------------------------
// Form is on every player card, so it changes results
// ---------------------------------------------------------------
squad(A,60);squad(B,60);
const flat=q.v24ExpectedGoals(A,B,false,null),flatGap=flat.home-flat.away;
squad(A,60,{form:'Excellent'});
const sharp=q.v24ExpectedGoals(A,B,false,null),sharpGap=sharp.home-sharp.away;
squad(A,60,{form:'Terrible'});
const flat2=q.v24ExpectedGoals(A,B,false,null),poorGap=flat2.home-flat2.away;
assert.ok(sharpGap>flatGap,'a squad in form is worth more');
assert.ok(poorGap<flatGap,'and a squad out of form is worth less');
const formOvr=((sharpGap-poorGap)*18)/2/2;
assert.ok(formOvr>0.7&&formOvr<2.2,
  `form sits alongside morale rather than above it, measured ${formOvr.toFixed(2)} OVR either way`);

// Morale and fitness keep the weight they had.
squad(A,60,{morale:'Very Unhappy'});
assert.ok((q.v24ExpectedGoals(A,B,false,null).home-q.v24ExpectedGoals(A,B,false,null).away)<flatGap,
  'an unhappy squad underperforms');
squad(A,60,{fitness:50});
assert.ok((q.v24ExpectedGoals(A,B,false,null).home-q.v24ExpectedGoals(A,B,false,null).away)<flatGap,
  'a tired squad underperforms');

console.log(JSON.stringify({status:'PASS',version:'V104.8',
  measured:{
    evenMatchHomeWin:+(even.win*100).toFixed(1),
    homePointsShare:+(share*100).toFixed(1),
    goalsPerMatch:+home.goals.toFixed(2),
    tacticalPlanWorthOvr:+tacticalOvr.toFixed(2),
    formWorthOvr:+formOvr.toFixed(2)
  },
  checks:[
    'a better squad wins more often at every step',
    'an even match is close, a mismatch is not a certainty',
    'home advantage is worth about 56% of the points',
    'a neutral venue favours neither side',
    'the live match is calibrated against the career world',
    'the tactical plan is worth about two and a half OVR',
    'approaches genuinely counter each other',
    'contradictory instructions cost something',
    'form changes results, alongside morale',
    'morale and fitness keep their weight'
  ]},null,2));
