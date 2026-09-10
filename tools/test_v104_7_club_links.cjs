'use strict';
// V104.7 · A club named anywhere is a way in to that club
//
// The rule is that naming a club never changes a layout: the link is an
// inline span with no box of its own, or an existing control reused. These
// checks hold both halves of that -- the link exists, and it carries nothing
// that would move anything.

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {runtime}=require('./career_test_runtime.cjs');

const r=runtime(),q=r.q,win=r.context.window;
const clubs=r.context.VELMORA_CLUBS;
const mine=clubs.find(club=>club.id==='redwick');
const other=clubs.find(club=>club.id!=='redwick');

r.d.assignClubForTest(mine);
q.initializeCareerLifecycle();

// ---------------------------------------------------------------
// The link itself
// ---------------------------------------------------------------
const link=q.clubLinkHTML(other);
assert.match(link,new RegExp(`data-open-club="${other.id}"`),'a named club carries its identity');
assert.match(link,/class="vm-club-link"/);
assert.match(link,/role="link"/,'and is reachable by keyboard');
assert.match(link,/tabindex="0"/);
assert.ok(link.includes(other.name),'the club name is still the visible text');
assert.equal(/style=|<div|<button/.test(link),false,'the link introduces no box and no inline styling');

const nested=q.clubLinkHTML(other,other.name,{nested:true});
assert.match(nested,/data-open-club/);
assert.equal(/tabindex|role=/.test(nested),false,
  'a club named inside another control does not become a second tab stop');

assert.equal(q.clubLinkHTML(null,'Free agent'),'Free agent',
  'an unattached player names no club, so there is nothing to open');
assert.equal(q.clubLinkHTML({name:'Nowhere'},'Nowhere'),'Nowhere',
  'and a club with no identity is plain text rather than a broken link');

// Escaping survives the wrapper.
const awkward={id:'x"y',name:'A & B <script>'};
const escaped=q.clubLinkHTML(awkward);
assert.equal(escaped.includes('<script>'),false,'club names are escaped inside the link');
assert.match(escaped,/&amp;/);

// ---------------------------------------------------------------
// It opens the club
// ---------------------------------------------------------------
assert.equal(q.openClubProfile(other.id),true,'the club page opens');
assert.equal(q.state().currentClub.id,mine.id,'without changing who you manage');
assert.equal(q.openClubProfile('no-such-club'),false,'an unknown club is refused rather than half-opened');

// ---------------------------------------------------------------
// The surfaces that name a club
// ---------------------------------------------------------------
const squadPlayer=q.getSquad(q.state().currentClub)[0];
const profile=q.v48ProfileData(squadPlayer.id);
assert.ok(profile,'the player profile has data');
assert.equal(profile.clubId,String(mine.id),'and knows which club, not just its name');
assert.equal(profile.club,mine.name);

// The overlay module turns that into a link of its own.
const source=fs.readFileSync(path.resolve(__dirname,'..','player-profiles.js'),'utf8');
for(const marker of ['function clubLink(d,text)','data-open-club','clubLink(d)'])
  assert.ok(source.includes(marker),`the profile overlay links the club: ${marker}`);

// And the styling is inert until you touch it, so no screen shifts.
const css=fs.readFileSync(path.resolve(__dirname,'..','career-expansion.css'),'utf8');
const rule=css.slice(css.indexOf('.vm-club-link{'),css.indexOf('.vm-club-link:hover'));
assert.equal(/margin|padding|display|border(?!-radius)|font-size/.test(rule),false,
  'the resting link changes no box metrics');

console.log(JSON.stringify({status:'PASS',version:'V104.7',club:other.name,
  checks:[
    'a named club carries its identity and stays keyboard reachable',
    'a club named inside another control is not a second tab stop',
    'an unattached player names no club',
    'club names are escaped inside the link',
    'opening a club never changes who you manage',
    'an unknown club is refused',
    'the player profile knows its club identity',
    'the profile overlay renders the link',
    'the resting link changes no box metrics'
  ]},null,2));
