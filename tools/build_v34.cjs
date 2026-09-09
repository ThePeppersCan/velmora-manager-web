'use strict';

const fs=require('node:fs');
const path=require('node:path');
const cp=require('node:child_process');
const {runtimeFiles,assetDirectories}=require('./release_manifest.cjs');
const release=require('../release-meta.js');

const root=path.resolve(__dirname,'..');
const output=path.join(root,'dist');

for(const file of runtimeFiles){
  const source=path.join(root,file);
  if(!fs.existsSync(source))throw new Error(`Missing runtime file: ${file}`);
  if(file.endsWith('.js'))cp.execFileSync(process.execPath,['--check',source]);
}

fs.mkdirSync(output,{recursive:true});
for(const file of runtimeFiles)fs.copyFileSync(path.join(root,file),path.join(output,file));
for(const dir of assetDirectories){
  const source=path.join(root,dir);
  if(fs.existsSync(source))fs.cpSync(source,path.join(output,dir),{recursive:true});
}

console.log(`Static ${release.label} ${release.channel.toLowerCase()} build complete. ${fs.existsSync(path.join(root,'assets'))?'Local assets included.':'The supplied project omits assets; apply the update to your asset-complete game for full presentation.'}`);
