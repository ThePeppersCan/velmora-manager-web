const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const app = fs.readFileSync(path.join(__dirname, '..', 'dist', 'app.js'), 'utf8');
const profiles = fs.readFileSync(path.join(__dirname, '..', 'dist', 'player-profiles.js'), 'utf8');

test('player profile participates in the global overlay stack', () => {
  assert.match(app, /'#v48PlayerProfile'/);
  assert.match(profiles, /dialog\.className='is-open'/);
  assert.match(profiles, /dialog\.setAttribute\('aria-hidden','false'\)/);
});

test('closing the profile restores the underlying window', () => {
  assert.match(app, /\[\.\.\.m\.addedNodes,\.\.\.m\.removedNodes\]/);
  assert.match(app, /overlay\.id==='v48PlayerProfile'\)window\.VelmoraPlayerProfiles\?\.close\(\)/);
  assert.match(app, /contains\('is-open'\)\?'News'/);
});
