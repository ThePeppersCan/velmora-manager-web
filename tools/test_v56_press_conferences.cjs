const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');

const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const html=read('index.html');
const app=read('app.js');
const css=read('press-conference.css');
const dataSource=read('press-conference-data.js');
const engineSource=read('press-conference-engine.js');

assert(html.includes('press-conference.css?v=v60-manager-media'));
assert(html.indexOf('press-conference-data.js')<html.indexOf('press-conference-engine.js'));
assert(html.indexOf('press-conference-engine.js')<html.indexOf('career-bootstrap.js'));
assert(app.includes("openFixturePressConference('pre'"),'Match start must offer the pre-match conference');
assert(app.includes("openFixturePressConference('post'"),'Result exit must offer the post-match conference');
assert(app.includes("'press-live',expression"),"Press conferences must preserve the manager's chosen active outfit in the live renderer");
assert(app.includes("drawManagerPressShoulderExtension(ctx,drawable)"),'Shoulder coverage must be generated from the selected outfit pixels');
assert(!css.includes('#0a2854'),'Press-room shoulder coverage must not hard-code a blue garment colour');
assert(!app.includes("push('expression',exp?.id,exp?.path,{eraseMask:exp?.eraseMask})"),'Expression changes must never cut transparency through the manager face');
for(const consequence of ['adjustPlayerMorale','adjustPlayerManagerTrust','shiftBoardConfidence','recordMediaStatement']){
  assert(app.includes(consequence),`Expected live-career consequence: ${consequence}`);
}
assert(css.includes('.pc-manager-stage'));
assert(css.includes('.pc-foreground'));
assert(css.includes('body.has-press-conference #careerMusicMiniPlayer'));

for(const file of [
  'assets/press-conference/press-room-night.png',
  'assets/press-conference/press-room-light.png',
  'assets/press-conference/press-desk-night.png',
  'assets/press-conference/press-desk-light.png'
]){
  const bytes=fs.readFileSync(path.join(root,file));
  assert.equal(bytes.subarray(1,4).toString(),'PNG',`${file} must be a valid PNG`);
  assert(bytes.length>100000,`${file} should be a production scene asset`);
}

const dom=new JSDOM('<!doctype html><html><body></body></html>',{
  runScripts:'outside-only',
  pretendToBeVisual:true,
  url:'http://127.0.0.1/'
});
const {window}=dom;
window.eval(dataSource);
window.eval(engineSource);
window.setTimeout=callback=>{callback();return 1;};
const library=window.VELMORA_PRESS_CONFERENCE_LIBRARY;
assert(library,'Question library must register globally');
assert.equal(library.questionsPerConference,5);
assert(library.categories.length>=38,'Expected broad press-room topic coverage');
assert(library.categories.reduce((sum,item)=>sum+item.templates.length,0)>=220,'Expected hundreds of authored question stems');
assert.equal(library.responseArchetypes.length,6,'Every question must have six response directions');
assert(library.estimatedQuestionVariants>=10000,'Contextual question combinations must reach five figures');

let continued=0;
let impacts=0;
let saved=null;
const fixture={fixtureId:'QA-V56-001'};
const context={
  fixtureId:fixture.fixtureId,
  date:'2026-09-03',
  club:{id:'velmora',name:'Velmora Athletic',abbr:'VEL'},
  opponent:{id:'northstar',name:'Northstar City',abbr:'NOR'},
  competition:'VELMORA PREMIER DIVISION',
  venue:'Velmora Arena',
  occasion:'Opening Night',
  managerName:'Isaac Vale',
  form:'W W D W L',
  tablePosition:2,
  tableSuffix:'nd',
  tactic:'high press',
  boardLabel:'supportive',
  world:'Velmora',
  recentStory:'A major academy breakthrough dominated the week',
  rivalManager:{id:'mgr-rival',name:'Alex Mercer'},
  reporters:[{id:'rep-1',name:'Mara Voss',role:'Senior correspondent',outlet:'V-PULSE SPORT',tone:'Direct',relationship:58}],
  players:{
    featured:{id:'p-1',name:'Eli Shaw'},captain:{id:'p-2',name:'Milo Reed'},young:{id:'p-3',name:'Noah Vale'},
    unavailable:{id:'p-4',name:'Ari Cole'},contract:{id:'p-5',name:'Theo Marr'},transfer:{id:'p-6',name:'Owen Pike'},
    opponentStar:{id:'p-7',name:'Leo Storm'}
  }
};
const conference=window.VelmoraPressConferences.create({
  context:stage=>({...context,stage}),
  managerHTML:expression=>`<div data-expression="${expression}"></div>`,
  saveSession:(_key,value)=>{saved=value;},
  getSession:()=>null,
  recentQuestionKeys:()=>[],
  applyImpact:()=>{impacts++;return{positive:2,negative:0,reaction:'WARM RESPONSE',chips:[{tone:'positive',label:'TEAM MORALE +'}]};}
});

assert.equal(conference.open('pre',fixture,()=>continued++,'GO TO MATCH'),true);
assert(window.document.querySelector('.pc-intro'),'Invitation should render before the conference');
assert.equal(window.document.querySelectorAll('[data-pc-attend]').length,1);
window.document.querySelector('[data-pc-attend]').click();
assert.equal(window.document.querySelectorAll('[data-pc-answer]').length,6,'Question screen must expose six answers');
assert.equal(saved.questions.length,5,'Standard conference must contain five contextual questions');
assert(new Set(saved.questions.map(item=>item.categoryId)).size>=4,'A conference should avoid repetitive categories');
window.document.querySelector('[data-pc-answer]').click();
assert.equal(impacts,1,'Selecting an answer must apply career consequences');
assert(window.document.querySelector('.pc-response-panel'),'Answer must produce a cinematic spoken response');
assert(window.document.querySelector('.pc-manager-figure.is-speaking'),'Manager must switch to a speaking pose');
window.document.querySelector('[data-pc-leave]').click();
assert.equal(continued,1,'Leaving an optional conference must continue the match flow');
assert.equal(window.document.querySelector('#pressConferenceOverlay').getAttribute('aria-hidden'),'true');

dom.window.close();
console.log(JSON.stringify({status:'PASS',version:'V56.0',checks:[
  'optional pre- and post-match hooks are connected',
  '38+ contextual categories and 10,000+ variants are available',
  'all questions expose six distinct response directions',
  'manager speaking presentation, layered scenes and career impacts are wired',
  'skip and early-exit paths continue safely',
  'all four production scene assets are present'
]},null,2));
