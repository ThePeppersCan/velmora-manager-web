'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const html=read('index.html');
const css=read('matchday-preview-redesign.css');
const app=read('app.js');

assert.match(html,/matchday-preview-redesign\.css\?v=v68-matchday-reference-restore/,'browser cache must load the restored reference composition');

// The current shared top navigation is deliberately preserved.
assert.match(css,/#screenMatchday\.md2 \.matchday-topbar\{grid-template-columns:minmax\(9cqw,14%\) minmax\(0,1fr\) minmax\(34cqw,38%\)!important/,'current matchday top-bar containment must remain intact');
assert.doesNotMatch(css,/\.matchday-topbar \{[^}]*display:flex!important/,'the retired bespoke matchday top bar must not return');

// Reference body: full-bleed hero, integrated side rail and inward portraits.
assert.match(css,/grid-template-columns:minmax\(0,1fr\) minmax\(285px,23\.6%\)!important/,'hero and status rail must use the exact reference composition');
assert.match(css,/\.md2-hero \{[^}]*border-radius:0!important[^}]*box-shadow:none!important/,'hero must return to the full-bleed reference treatment');
assert.match(css,/\.matchday-featured\.md2-portrait\.home img \{transform:scale\(-1\.13,1\.13\)!important\}/,'home featured player must be oversized and face inward');
assert.match(css,/\.matchday-featured\.md2-portrait\.away \{right:-1%!important/,'away featured player must use the reference crop');
assert.match(css,/\.md2-side \{[^}]*gap:0!important[^}]*border-left:1px solid var\(--md2-line\)/,'status cards must form the integrated right rail');

// Reference lower strip: badges and all three players arranged horizontally.
assert.match(html,/id="matchdayHomeTeamBadge" class="matchday-badge md2-team-badge"/,'home team strip badge must exist');
assert.match(html,/id="matchdayAwayTeamBadge" class="matchday-badge md2-team-badge"/,'away team strip badge must exist');
assert.match(css,/\.md2-lineup\.matchday-lineup \{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important/,'each Starting Three must render in a horizontal three-player strip');
assert.match(app,/setBadge\(\$\(`#matchday\$\{side\}TeamBadge`\),team\)/,'team strip badges must be populated from the live fixture');
assert.match(css,/grid-template-rows:min\(38\.4cqw,calc\(100dvh - var\(--md-nav-height\) - 175px\)\)/,'desktop hero must retain the Image 1 depth beneath the shared top bar');
assert.match(css,/\.md2-edit-btn\.matchday-edit-team\{display:none!important\}/,'the reference lineup header must not show the later edit-link addition');
assert.match(css,/\.md2-teams \{[^}]*margin:16px 2\.1% 0/,'lineup cards must align to the Image 1 margins');
assert.match(css,/\.md2-shell::-webkit-scrollbar\{width:0;height:0\}/,'the below-fold report must not reserve a visible scrollbar gutter');
assert.match(css,/\.md2-action-status \{display:none!important\}/,'the later preview-status caption must not intrude on the reference action rail');

assert.match(html,/<details class="md2-report"><summary>OPPOSITION REPORT &amp; STAFF MATCH PLAN<\/summary>/,'secondary scouting detail must remain available below the reference screen');
assert.ok(fs.existsSync(path.join(root,'assets/matchday-cobalt/fonts/Anton-Regular.ttf')),'reference headline font must be packaged');

console.log('V68 restored matchday reference checks: PASS');
