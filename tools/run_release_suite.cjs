'use strict';

const cp=require('node:child_process');
const path=require('node:path');
const pkg=require(path.resolve(__dirname,'..','package.json'));

const tests=Object.keys(pkg.scripts).filter(name=>name.startsWith('test:'));
const failures=[];
for(const name of tests){
  console.log(`\n=== ${name} ===`);
  const command=process.platform==='win32'
    ? {file:process.env.ComSpec||'cmd.exe',args:['/d','/s','/c',`npm run --silent ${name}`]}
    : {file:'npm',args:['run','--silent',name]};
  const result=cp.spawnSync(command.file,command.args,{
    cwd:path.resolve(__dirname,'..'),
    encoding:'utf8'
  });
  if(result.stdout)process.stdout.write(result.stdout);
  if(result.stderr)process.stderr.write(result.stderr);
  if(result.status!==0)failures.push(name);
}

if(failures.length){
  console.error(`\nRelease suite failed: ${failures.join(', ')}`);
  process.exitCode=1;
}else{
  console.log(`\nRelease suite passed: ${tests.length} test groups.`);
}
