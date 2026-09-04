const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=name=>fs.readFileSync(path.join(root,name),'utf8');
const app=read('app.js'),css=read('homepage-polish.css'),index=read('index.html'),bootstrap=read('career-bootstrap.js');

assert.match(index,/homepage-polish\.css\?v=v65-homepage-priority-pulse/,'homepage stylesheet cache key');
assert.match(index,/career-bootstrap\.js\?v=v66-squad-management/,'bootstrap cache key');
assert.match(bootstrap,/app\.js\?v=v66-squad-management/,'app cache key');

for(const key of ['transfer','contract','squad','medical','board','admin','scouting','discipline','career','season']){
  assert.match(css,new RegExp(`is-category-${key}`),`category style: ${key}`);
}
for(const marker of ['TODAY','1 DAY LEFT','DAYS LEFT','is-urgency-${urgency.key}'])assert.ok(app.includes(marker),`urgency marker: ${marker}`);
assert.match(app,/data-task-category="\$\{category\.key\}" data-task-urgency="\$\{urgency\.key\}"/,'category and urgency stay separate in the DOM');
assert.match(app,/data-v45-task-action="track"[\s\S]*data-v45-task-action="remind"[\s\S]*data-v45-task-action="dismiss"/,'task controls preserved');
assert.match(app,/addEventListener\('click',\(\)=>v2077HandleCentralTask/,'task routing preserved');

for(const source of ['recentClubForm(club,6)','squadAtmosphereSnapshot(club)','ensureBoardConfidence()'])assert.ok(app.includes(source),`live Club Pulse source: ${source}`);
for(const label of ['SUPPORTERS','DRESSING ROOM','BOARD'])assert.ok(app.includes(`label:'${label}'`),`Club Pulse metric: ${label}`);
assert.match(css,/\.v65-club-pulse > footer p[\s\S]*text-overflow: ellipsis/,'narrative is constrained');
assert.match(css,/@media \(max-width: 900px\)[\s\S]*\.v65-pulse-metrics[\s\S]*grid-template-columns: minmax\(0,1fr\)/,'narrow Club Pulse layout');

for(const name of ['app.js','homepage-polish.css','index.html','career-bootstrap.js']){
  assert.equal(fs.readFileSync(path.join(root,name),'utf8'),fs.readFileSync(path.join(root,'dist',name),'utf8'),`dist sync: ${name}`);
}

console.log('V65 homepage priority UX checks: PASS');
