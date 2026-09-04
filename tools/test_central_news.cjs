const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const {runtime} = require('./career_test_runtime.cjs');
const root = path.resolve(__dirname, '..');
const r = runtime(), q = r.q;
const club = q.state().clubs.find(c => c.name === 'Riva Sola');
r.d.assignClubForTest(club);
q.initializeCareerLifecycle();
vm.runInContext(fs.readFileSync(path.join(root, 'central-news.js'), 'utf8'), r.context);
const news = r.context.VELMORA_CENTRAL_NEWS;
const report = {status: 'PASS', checks: []};
const check = (name, fn) => { fn(); report.checks.push(name); };
check('Calendar gate: matchday, preceding day, month/year/leap boundaries, no fixture, completed fixture', () => {
  for (const [today, date, expected] of [
    ['2026-08-20','2026-08-23',false], ['2026-08-21','2026-08-23',false],
    ['2026-08-22','2026-08-23',true], ['2026-08-23','2026-08-23',true],
    ['2026-08-24','2026-08-23',false], ['2026-08-31','2026-09-01',true],
    ['2026-12-31','2027-01-01',true], ['2028-02-28','2028-02-29',true],
    ['2028-02-29','2028-03-01',true], ['2026-08-20','invalid',false]
  ]) assert.equal(news.fixtureIsDue(today, {date, played:false}), expected, `${today} / ${date}`);
  assert.equal(news.fixtureIsDue('2026-08-23', null), false);
  assert.equal(news.fixtureIsDue('2026-08-23', {date:'2026-08-23', played:true}), false);
});
const fixture = q.nextUserFixture(), opponent = q.fixtureClubs(fixture).home.id === club.id ? q.fixtureClubs(fixture).away : q.fixtureClubs(fixture).home;
q.state().careerTime.currentDate = '2026-08-20';
const player = q.getSquad(club)[0], other = q.getSquad(club)[1], academy = q.getAcademy(club)[0];
q.addCareerNews({id:'qa-signing', date:'2026-08-20', category:'TRANSFERS', title:`${club.name} sign ${player.name}`, body:[`${player.name} joins from ${opponent.name}.`], image:player.avatar});
q.addCareerNews({id:'qa-academy', date:'2026-08-19', category:'ACADEMY', title:`${academy.name} impresses in training`, body:['An academy update.'], playerId:academy.id, clubId:club.id});
q.addCareerNews({id:'qa-stale', date:'2026-07-01', category:'TRANSFERS', title:'Old news', body:['Old']});
q.addCareerNews({id:'qa-future', date:'2026-09-01', category:'TRANSFERS', title:'Future news', body:['Future']});
let items;
check('Stories come from current career news, excluding future/stale reports and resolving real senior/academy people', () => {
  items = q.centralNewsFeatureItems(club, opponent, fixture);
  assert.equal(items[0].id, 'qa-signing');
  assert(!items.some(n => ['qa-stale','qa-future'].includes(n.id)));
  const signing = items.find(n => n.id === 'qa-signing');
  assert.equal(signing.actors[0].id, player.id);
  assert.equal(signing.clubName, club.name);
  assert.equal(signing.actors[0].src, q.v262StandingSprite(player));
  assert.equal(items.find(n => n.id === 'qa-academy').actors[0].id, academy.id);
  // Many players reuse artwork. Only the named character may be selected.
  const sameAvatar = {...other, avatar:player.avatar};
  const cast = q.centralNewsCast({title:player.name, body:[], image:player.avatar}, [player,sameAvatar]);
  assert.deepEqual(Array.from(cast, p => p.id), [player.id]);
  const noMatch = q.centralNewsCast({title:'The board meets',body:[],image:player.avatar}, [player,sameAvatar]);
  assert.equal(noMatch.length, 0);
  const pair = q.centralNewsCast({title:`${player.name} and ${other.name}`,body:[]}, [player,other]);
  assert.equal(pair.length, 2);
});
check('Correct manager identity is retained; missing AI art does not impersonate a player', () => {
  const manager = Object.values(q.state().managerMarket.managers)[0];
  const cast = q.centralNewsCast({title:`Pressure builds on ${manager.name}`,body:[]}, [player]);
  assert.equal(cast[0].id, manager.id);
  assert.equal(cast[0].src, undefined);
});
check('Training/press classification and all nine supplied scene files', () => {
  for (const category of ['TRANSFERS','ACADEMY','TRAINING','BREAKOUT PLAYER','INJURY UPDATE']) assert.equal(news.sceneFor({id:category,category,title:'Update'}).group, 'training');
  for (const category of ['MANAGER MARKET','MANAGER PRESSURE','PRESS','BOARD','MATCHDAY']) assert.equal(news.sceneFor({id:category,category,title:'Update'}).group, 'press');
  const selected = new Set();
  for (let i=0;i<80;i++) for (const category of ['TRAINING','PRESS']) selected.add(news.sceneFor({id:`story-${i}`,category}).src);
  assert.equal(selected.size, 9);
  for (const file of selected) assert.equal(fs.readFileSync(path.join(root,file)).subarray(1,4).toString(), 'PNG');
});
// Exercise the actual carousel's event handlers with the project's DOM adapter.
const timers = new Map(); let serial = 0, blocked = false, opened = null;
r.context.setTimeout = (fn, delay) => { const id=++serial; timers.set(id,{fn,delay}); return id; };
r.context.clearTimeout = id => timers.delete(id);
const options = {fixtureMode:false,items,dateLabel:'20 AUG 2026',onOpen:id=>{opened=id;},isBlocked:()=>blocked};
r.node('#screenCentral').classList.add('is-active');
news.render(options);
const host = r.node('created-section');
host.contains = value => !!value;
const click = (action, index) => host.dispatch('click',{target:{closest:()=>({dataset:index===undefined?{cn:action}:{cnIndex:String(index)}})}});
const tick = () => { assert.equal(timers.size,1); const [id,timer]=[...timers][0]; assert.equal(timer.delay,8000); timers.delete(id);timer.fn(); };
check('Rotation, wraparound, direct selection, read-story binding, and no duplicate timers', () => {
  news.setScreenActive(true);
  assert.equal(news.snapshot().timerRunning,true);
  news.render(options); news.render(options);
  assert.equal(timers.size,1);
  const first=news.snapshot().storyId;
  tick(); assert.notEqual(news.snapshot().storyId,first);
  click('previous'); assert.equal(news.snapshot().storyId,first);
  click('previous'); assert.equal(news.snapshot().storyId,items.at(-1).id);
  click('next'); assert.equal(news.snapshot().storyId,first);
  click(null,1); assert.equal(news.snapshot().storyId,items[1].id);
  click('read'); assert.equal(opened,items[1].id);
});
check('Pause, hover, keyboard focus, hidden tabs, blocking overlays, and navigation stop rotation', () => {
  click('pause'); assert.equal(news.snapshot().paused,true); assert.equal(timers.size,0);
  click('pause'); assert.equal(timers.size,1);
  host.dispatch('mouseenter',{}); assert.equal(timers.size,0);
  host.dispatch('mouseleave',{}); assert.equal(timers.size,1);
  host.dispatch('focusin',{}); assert.equal(timers.size,0);
  host.dispatch('focusout',{relatedTarget:null}); assert.equal(timers.size,1);
  blocked=true; const id=news.snapshot().storyId;tick();assert.equal(news.snapshot().storyId,id);blocked=false;
  r.context.document.hidden=true;news.setScreenActive(true);assert.equal(timers.size,0);
  r.context.document.hidden=false;news.setScreenActive(true);assert.equal(timers.size,1);
  news.setScreenActive(false);assert.equal(timers.size,0);
  news.setScreenActive(true);assert.equal(timers.size,1);
  news.render({...options,fixtureMode:true});assert.equal(timers.size,0);assert.equal(host.hidden,true);
  news.render({...options,items:[items[0]]});assert.equal(timers.size,0);
});
// Restore runtime timers before asking the full game to render its other panels.
r.context.setTimeout = () => 1; r.context.clearTimeout = () => {};
check('Full dashboard switches news → day-before lineups → matchday → news without duplicating Match Preview', () => {
  const next={...fixture,date:'2026-08-23',played:false};q.set('fixtures',[next]);
  for(const [date,mode] of [['2026-08-21','news'],['2026-08-22','fixture'],['2026-08-23','fixture'],['2026-08-24','news']]){
    q.state().careerTime.currentDate=date;q.renderCentral();assert.equal(news.snapshot().mode,mode,date);
  }
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.equal((html.match(/id="centralContinue"/g)||[]).length,1);
  assert.equal(r.node('centralContinue').listenerCount('click'),1);
});
check('Reduced-motion users start with automatic rotation paused', () => {
  r.context.matchMedia = () => ({matches:true,addEventListener(){}});
  vm.runInContext(fs.readFileSync(path.join(root,'central-news.js'),'utf8'),r.context);
  r.context.VELMORA_CENTRAL_NEWS.render(options);
  assert.equal(r.context.VELMORA_CENTRAL_NEWS.snapshot().paused,true);
  assert.equal(r.context.VELMORA_CENTRAL_NEWS.snapshot().timerRunning,false);
});
console.log(JSON.stringify(report,null,2));
