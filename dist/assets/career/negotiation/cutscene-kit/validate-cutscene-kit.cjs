'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');

const kit = __dirname;
const derivedProject = path.resolve(kit, '..', '..', '..', '..');
const projectFlag = process.argv.indexOf('--project');
const requestedProject = projectFlag >= 0 && process.argv[projectFlag + 1]
  ? path.resolve(process.argv[projectFlag + 1])
  : derivedProject;
const managerAssetsRoot = fs.existsSync(path.join(requestedProject, 'assets', 'manager'))
  ? path.join(requestedProject, 'assets', 'manager')
  : null;
const manifestPath = path.join(kit, 'cutscene-kit.json');
const checksumPath = path.join(kit, 'SHA256SUMS.txt');
const expectedShots = [
  'boardroom-wide',
  'boardroom-reverse',
  'boardroom-table',
  'cafe-wide',
  'cafe-over-shoulder',
  'cafe-table-wide',
  'cafe-table-close'
];

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function pngInfo(file) {
  const source = fs.readFileSync(file);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  assert(source.subarray(0, 8).equals(signature), `${path.basename(file)} is not a PNG`);

  let offset = 8;
  let ihdr = null;
  const idat = [];
  while (offset < source.length) {
    const length = source.readUInt32BE(offset);
    const type = source.toString('ascii', offset + 4, offset + 8);
    const data = source.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') ihdr = data;
    if (type === 'IDAT') idat.push(data);
    offset += length + 12;
    if (type === 'IEND') break;
  }

  assert(ihdr && idat.length, `${path.basename(file)} is missing PNG image data`);
  const width = ihdr.readUInt32BE(0);
  const height = ihdr.readUInt32BE(4);
  const bitDepth = ihdr[8];
  const colorType = ihdr[9];
  const interlace = ihdr[12];
  assert(bitDepth === 8 && colorType === 6 && interlace === 0,
    `${path.basename(file)} must be non-interlaced 8-bit RGBA`);

  const bytesPerPixel = 4;
  const stride = width * bytesPerPixel;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  assert(raw.length === height * (stride + 1), `${path.basename(file)} has unexpected scanline data`);

  let previous = Buffer.alloc(stride);
  let alphaMin = 255;
  let alphaMax = 0;
  let transparentPixels = 0;
  let partialPixels = 0;
  let opaquePixels = 0;
  let input = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = raw[input++];
    const scanline = raw.subarray(input, input + stride);
    input += stride;
    const current = Buffer.allocUnsafe(stride);

    for (let x = 0; x < stride; x += 1) {
      const left = x >= bytesPerPixel ? current[x - bytesPerPixel] : 0;
      const up = previous[x];
      const upLeft = x >= bytesPerPixel ? previous[x - bytesPerPixel] : 0;
      let predictor = 0;
      if (filter === 1) predictor = left;
      else if (filter === 2) predictor = up;
      else if (filter === 3) predictor = Math.floor((left + up) / 2);
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        predictor = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
      } else if (filter !== 0) fail(`${path.basename(file)} uses unsupported PNG filter ${filter}`);
      current[x] = (scanline[x] + predictor) & 255;
    }

    for (let x = 3; x < stride; x += 4) {
      const alpha = current[x];
      alphaMin = Math.min(alphaMin, alpha);
      alphaMax = Math.max(alphaMax, alpha);
      if (alpha === 0) transparentPixels += 1;
      else if (alpha === 255) opaquePixels += 1;
      else partialPixels += 1;
    }
    previous = current;
  }

  return { width, height, alphaMin, alphaMax, transparentPixels, partialPixels, opaquePixels };
}

function assetReferences(manifest) {
  const references = [];
  for (const name of expectedShots) {
    const shot = manifest.shots?.[name];
    assert(shot, `Missing shot ${name}`);
    for (const field of ['foreground', 'lighting', 'cameraVariant']) {
      assert(typeof shot[field] === 'string' && shot[field].endsWith('.png'), `${name}.${field} must name a PNG`);
      references.push(shot[field]);
    }
  }
  for (const field of ['seatShadow', 'tableShadow']) {
    assert(typeof manifest.shared?.[field] === 'string' && manifest.shared[field].endsWith('.png'), `shared.${field} must name a PNG`);
    references.push(manifest.shared[field]);
  }
  return [...new Set(references)];
}

function validateManifest(manifest) {
  assert(manifest.version === 1, 'Manifest version must be 1');
  assert(Array.isArray(manifest.canvas) && manifest.canvas[0] === 1672 && manifest.canvas[1] === 941,
    'Manifest canvas must be 1672x941');
  assert(Object.keys(manifest.shots || {}).length === expectedShots.length, 'Manifest must contain exactly seven shots');

  for (const name of expectedShots) {
    const placements = manifest.shots[name].placements;
    assert(placements && Object.keys(placements).length, `${name} needs at least one character placement`);
    for (const [role, placement] of Object.entries(placements)) {
      assert(['playerManager', 'oppositionManager', 'agent', 'player'].includes(role), `${name} has unknown role ${role}`);
      assert(Number.isFinite(placement.x) && placement.x >= 0 && placement.x <= 1, `${name}.${role}.x is invalid`);
      assert(Number.isFinite(placement.y) && placement.y >= 0 && placement.y <= 1, `${name}.${role}.y is invalid`);
      assert(Number.isFinite(placement.scale) && placement.scale > 0, `${name}.${role}.scale is invalid`);
      assert(typeof placement.flipX === 'boolean', `${name}.${role}.flipX must be boolean`);
    }
  }

  const expressions = manifest.characters?.speechExpressions || {};
  for (const field of ['closed', 'open', 'listening']) {
    const id = expressions[field];
    assert(typeof id === 'string', `speechExpressions.${field} is missing`);
    if (managerAssetsRoot) {
      assert(fs.existsSync(path.join(managerAssetsRoot, 'expressions', `${id}.png`)), `Missing expression asset ${id}`);
    }
  }
  assert(Array.isArray(expressions.recommendedCadenceMs) && expressions.recommendedCadenceMs.every(n => Number.isInteger(n) && n >= 100),
    'recommendedCadenceMs must be an array of timing values');

  for (const role of ['oppositionManager', 'agent']) {
    const pool = manifest.characters?.[role]?.wardrobePool;
    assert(Array.isArray(pool) && pool.length, `${role}.wardrobePool is empty`);
    for (const id of pool) {
      assert(/^outfit_formal_\d+$/.test(id), `${role} wardrobe contains non-formal outfit ${id}`);
      if (managerAssetsRoot) {
        assert(fs.existsSync(path.join(managerAssetsRoot, 'outfits', `${id}.png`)), `Missing outfit asset ${id}`);
      }
    }
  }
}

function validateChecksums() {
  const lines = fs.readFileSync(checksumPath, 'utf8').trim().split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    const match = line.match(/^([a-f0-9]{64})\s{2}(.+)$/);
    assert(match, `Malformed checksum line: ${line}`);
    const file = path.join(kit, match[2]);
    assert(fs.existsSync(file), `Checksum references missing file ${match[2]}`);
    assert(sha256(file) === match[1], `Checksum mismatch for ${match[2]}`);
  }
  return lines.length;
}

function main() {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  validateManifest(manifest);
  const references = assetReferences(manifest);
  const pngFiles = fs.readdirSync(kit).filter(name => name.endsWith('.png')).sort();
  assert(pngFiles.length === 14, `Expected 14 PNG assets, found ${pngFiles.length}`);
  assert(references.length === 14, `Expected 14 unique manifest asset references, found ${references.length}`);
  assert(pngFiles.every(name => references.includes(name)), 'Every shipped PNG must be referenced by the manifest');

  const imageReport = {};
  for (const name of pngFiles) {
    const info = pngInfo(path.join(kit, name));
    imageReport[name] = info;
    if (!name.startsWith('contact-shadow-')) {
      assert(info.width === manifest.canvas[0] && info.height === manifest.canvas[1], `${name} must match the scene canvas`);
    }
    if (name.includes('-foreground')) {
      assert(info.alphaMin === 0 && info.alphaMax > 0, `${name} must contain real transparency and visible pixels`);
    }
    if (name.includes('-light-overlay')) {
      assert(info.alphaMin > 0 && info.alphaMax < 255, `${name} must remain a translucent light pass`);
    }
    if (name.startsWith('contact-shadow-')) {
      assert(info.alphaMin === 0 && info.alphaMax > 0 && info.alphaMax < 255, `${name} must remain a translucent shadow`);
    }
  }

  const checksumEntries = validateChecksums();
  console.log(JSON.stringify({
    status: 'PASS',
    shots: expectedShots.length,
    pngAssets: pngFiles.length,
    checksumEntries,
    manifestReferences: references.length,
    externalManagerAssets: managerAssetsRoot ? 'PASS' : 'SKIPPED_STANDALONE',
    imageReport
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(`[cutscene-kit] ${error.message}`);
  process.exitCode = 1;
}
