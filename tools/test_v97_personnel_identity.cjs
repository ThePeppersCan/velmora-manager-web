'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const personnel=require('../personnel-identity.js');

const root=path.resolve(__dirname,'..');
const roles=['scout','coach','medical','academy','commercial'];
const files=roles.map(role=>personnel.asset(role));

assert.equal(new Set(files).size,5,'Each recurring personnel role needs a distinct asset');
for(const file of files){
  assert(file.endsWith('.png'),`${file} is not a PNG`);
  assert(fs.existsSync(path.join(root,file)),`Missing personnel asset: ${file}`);
}

assert.equal(personnel.normalizeRole('assistant'),'coach');
assert.equal(personnel.normalizeRole('recruitment'),'scout');
assert.equal(personnel.normalizeRole('executive'),null);
assert.equal(personnel.roleForMessage({type:'YOUTH',sender:'ACADEMY DIRECTOR'}),'academy');
assert.equal(personnel.roleForMessage({type:'MEDICAL',sender:'MEDICAL TEAM'}),'medical');
assert.equal(personnel.roleForMessage({type:'SQUAD',sender:'ASSISTANT COACH'}),'coach');
assert.equal(personnel.roleForMessage({type:'TRANSFERS',sender:'HEAD OF RECRUITMENT'}),'scout');
assert.equal(personnel.roleForMessage({type:'FINANCE',sender:'CLUB OPERATIONS'}),'commercial');

const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const expansion=fs.readFileSync(path.join(root,'career-expansion.js'),'utf8');
const training=fs.readFileSync(path.join(root,'training-ui.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const manifest=require('./release_manifest.cjs');

assert(app.includes("personnelForRole?.('coach',club)"),'Training data is not connected to the employed assistant coach');
assert(app.includes('roleForMessage?.(m)'),'Inbox portraits are not connected to personnel roles');
assert(expansion.includes('v36-person-portrait'),'Staff dossier does not render personnel art');
assert(expansion.includes("personnelBrief(d,'academy'"),'Academy screen is missing its director');
assert(expansion.includes("personnelBrief(d,'commercial'"),'Commercial screen is missing its director');
assert(training.includes('tr-assistant-art'),'Training advice is missing the assistant coach');
assert(html.includes('personnel-identity.js'),'Personnel identity data is not loaded');
assert(html.includes('personnel-identity.css'),'Personnel presentation styles are not loaded');
assert(manifest.runtimeFiles.includes('personnel-identity.js')&&manifest.runtimeFiles.includes('personnel-identity.css'),'Personnel files are missing from release builds');

console.log(JSON.stringify({status:'PASS',roles,files,placements:['staff','training','academy','commercial','inbox','first-week']},null,2));
