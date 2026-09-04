const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=name=>fs.readFileSync(path.join(root,name),'utf8');
const app=read('app.js'),css=read('squad-redesign.css'),index=read('index.html'),bootstrap=read('career-bootstrap.js');

assert.match(index,/squad-redesign\.css\?v=v67-squad-refinement/,'squad stylesheet cache key');
assert.match(index,/career-bootstrap\.js\?v=v67-squad-refinement/,'bootstrap cache key');
assert.match(bootstrap,/app\.js\?v=v67-squad-refinement/,'app cache key');

assert.equal((index.match(/id="startingThreeShowcase"/g)||[]).length,1,'one authoritative starter presentation');
assert.match(index,/id="startersGrid"[^>]*hidden[^>]*aria-hidden="true"/,'legacy starter mount remains inert for compatibility');
assert.doesNotMatch(app,/\$\('#startersGrid'\)\.innerHTML=lineup\.starter/,'starters are not rendered twice');
assert.match(app,/if\(\$\('#startersGrid'\)\)\$\('#startersGrid'\)\.innerHTML=''/,'legacy starter mount is cleared');
assert.match(app,/const seenIds=new Set\(\)[\s\S]*seenIds\.has\(id\)[\s\S]*roster\.splice\(i,1\)/,'duplicate player ids are repaired at the squad cache boundary');

assert.match(app,/const cards=\$\$\('#subsGrid[^']*#startingThreeShowcase[^']*'\)/,'drag binding uses only visible cards');
assert.doesNotMatch(app,/const cards=\$\$\('#startersGrid/,'drag binding excludes the old duplicate grid');
assert.match(app,/if\(save\|\|squadSavePending\)scheduleSquadSave\(\)/,'swaps schedule a debounced save outside the paint callback');
assert.ok((app.match(/refreshSeniorSquadUI\(\{save:true\}\)/g)||[]).length>=2,'click and drag swaps use the fast refresh path');
assert.match(app,/target\.addEventListener\('dragover',[\s\S]*dropEffect='move';\}\}\)/,'dragover avoids repeated class writes');

for(const marker of ['grid-template-columns:7.15cqw minmax(0,1fr)','v66-depth-scroll','v66-profile-tabs','v66-confirm-selection','--v66-green'])assert.ok(css.includes(marker),`professional squad layout marker: ${marker}`);
for(const label of ['SQUAD MANAGEMENT','STARTING THREE','SUBSTITUTES &amp; RESERVES','CONFIRM SELECTION'])assert.ok(index.includes(label)||app.includes(label),`reference layout label: ${label}`);
assert.match(css,/@media\(max-width:1100px\)/,'narrow desktop layout');
assert.match(css,/@media\(max-width:760px\)/,'compact layout');

for(const name of ['app.js','squad-redesign.css','index.html','career-bootstrap.js']){
  assert.equal(read(name),read(path.join('dist',name)),`dist sync: ${name}`);
}

console.log('V66 squad management checks: PASS');
