'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'matchday-preview-redesign.css'),'utf8');

assert.match(html,/matchday-preview-redesign\.css\?v=v68-matchday-layout-hotfix/,'browser cache must load the matchday layout hotfix');
assert.match(css,/#screenMatchday\.md2 \.matchday-topbar\{grid-template-columns:minmax\(9cqw,14%\) minmax\(0,1fr\) minmax\(34cqw,38%\)!important/,'matchday header must reserve a non-collapsing utility track');
assert.match(css,/#screenMatchday\.md2 \.md2-meta\{flex:1 1 0;min-width:0;overflow:hidden;text-overflow:ellipsis\}/,'long competition names must truncate instead of colliding with navigation');
assert.match(css,/left:2\.25%!important;right:2\.25%!important;bottom:auto!important;width:auto!important/,'matchday shell must be anchored to both viewport edges');
assert.match(css,/#screenMatchday\.md2 \.matchday-shell-v2\.md2-shell>\*\{min-width:0!important;max-width:100%\}/,'matchday grid children must remain contained');
assert.match(css,/\.matchday-featured\.md2-portrait\.home img\{[^}]*transform:scaleX\(-1\)!important/,'home portrait must face inward');
assert.match(css,/\.matchday-featured\.md2-portrait\.away img\{[^}]*transform:scaleX\(1\)!important/,'away portrait must retain its inward-facing orientation');
assert.match(css,/@container \(max-width:960px\)\{[\s\S]*?\.md2-meta\{display:none!important\}/,'compact matchday headers must remove duplicated competition metadata');

console.log('V68 matchday layout checks: PASS');
