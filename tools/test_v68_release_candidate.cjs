'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {runtimeFiles}=require('./release_manifest.cjs');

const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const pkg=JSON.parse(read('package.json'));
const index=read('index.html');
const bootstrap=read('career-bootstrap.js');

assert.equal(pkg.version,'68.0.0','package release version');
assert.match(index,/V68 · RELEASE CANDIDATE/,'visible release version');
assert.match(index,/career-bootstrap\.js\?v=v68-release-candidate/,'bootstrap cache version');
assert.match(bootstrap,/app\.js\?v=v68-release-candidate/,'application cache version');

for(const file of runtimeFiles){
  const source=path.join(root,file);
  const built=path.join(root,'dist',file);
  assert.ok(fs.existsSync(source),`source runtime file exists: ${file}`);
  assert.ok(fs.existsSync(built),`built runtime file exists: ${file}`);
  assert.ok(fs.readFileSync(built).equals(fs.readFileSync(source)),`dist matches source: ${file}`);
}

const staticReferences=[...index.matchAll(/(?:src|href)="([^"#]+)"/g)]
  .map(match=>match[1].split('?')[0])
  .filter(file=>!/^https?:/i.test(file));
for(const file of staticReferences)assert.ok(fs.existsSync(path.join(root,file)),`static page reference exists: ${file}`);

console.log(`V68 release-candidate checks: PASS (${runtimeFiles.length} runtime files, ${staticReferences.length} static references)`);
