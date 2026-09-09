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
const app=read('app.js');
const release=require('../release-meta.js');
// The release cache key is read from release-meta.js so a version bump
// never has to be chased through the test suite by hand.
const RELEASE_CACHE_KEY=require('../release-meta.js').cacheKey;

assert.equal(pkg.version,release.version,'package release version');
const visibleRelease=`${release.label} · ${release.channel}`.replace(/&/g,'&amp;');
assert(index.includes(visibleRelease),'visible release version');
assert(index.includes(`release-meta.js?v=${release.cacheKey}`),'release metadata cache version');
assert(index.includes(`career-bootstrap.js?v=${release.cacheKey}`),'bootstrap cache version');
assert.equal([...index.matchAll(/[?&]v=([^"'&\s]+)/g)].filter(match=>match[1]!==release.cacheKey).length,0,'all runtime assets share the authoritative release cache key');
assert(bootstrap.includes(`window.VELMORA_RELEASE?.cacheKey||'${RELEASE_CACHE_KEY}'`),'application cache version comes from release metadata');
assert(app.includes(`version:window.VELMORA_RELEASE?.saveSchema||${release.saveSchema}`),'career saves use the authoritative release schema');

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

console.log(`${release.label} release-stabilisation checks: PASS (${runtimeFiles.length} runtime files, ${staticReferences.length} static references)`);
