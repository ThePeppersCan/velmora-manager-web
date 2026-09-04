"""Remove the residual white matte from exported standing sprites.

This is a one-time migration for alpha-2 assets.  It keeps every frame and
silhouette in place, lowers alpha only on contaminated edge pixels, regenerates
the matching profile avatar, and archives every changed original.

Usage:
  python tools/defringe_standing_sprites.py          # audit only
  python tools/defringe_standing_sprites.py --apply # archive and repair
"""
from pathlib import Path
import argparse
import json
import shutil

import numpy as np
from PIL import Image

from player_sprite_transparency import decontaminate_edge_matte

ROOT = Path(__file__).resolve().parents[1]
STANDING = ROOT / 'assets' / 'quidditch-engine' / 'standing'
AVATARS = ROOT / 'assets' / 'player-avatars'
MANIFEST = ROOT / 'data' / 'player-sprite-manifest.json'
RUNTIME = ROOT / 'data' / 'player-sprites.js'
REPORT = ROOT / 'data' / 'player-transparency-validation.json'
BACKUP = ROOT / '_archive' / 'standing-alpha-2-pre-defringe-20260903'


def make_avatar(pixels):
    im = Image.fromarray(pixels, 'RGBA')
    scale = min(232 / im.width, 232 / im.height)
    im = im.resize((round(im.width * scale), round(im.height * scale)), Image.Resampling.NEAREST)
    out = Image.new('RGBA', (256, 256))
    out.paste(im, ((256 - im.width) // 2, 244 - im.height))
    return out


def archive(path):
    target = BACKUP / path.relative_to(ROOT)
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists():
        shutil.copy2(path, target)


def main(apply=False):
    root_resolved = ROOT.resolve()
    assert STANDING.resolve().is_relative_to(root_resolved)
    assert AVATARS.resolve().is_relative_to(root_resolved)
    manifest = json.loads(MANIFEST.read_text(encoding='utf-8'))
    changed = []
    pixels_repaired = 0
    for record in manifest['players']:
        path = ROOT / record['standing_path']
        before = np.asarray(Image.open(path).convert('RGBA')).copy()
        after, stats = decontaminate_edge_matte(before)
        count = stats['edge_matte_pixels']
        if not count:
            continue
        assert after.shape == before.shape
        assert np.all(after[:, :, 3] <= before[:, :, 3])
        unchanged = after[:, :, 3] == before[:, :, 3]
        assert np.array_equal(after[unchanged], before[unchanged])
        repaired = after[:, :, 3] < before[:, :, 3]
        assert int(repaired.sum()) == count
        assert int(after[:, :, :3][repaired].min(1).max(initial=0)) < 220
        changed.append((record, path, after, count))
        pixels_repaired += count
    result = {
        'status': 'PASS',
        'asset_revision': 'alpha-3',
        'mode': 'apply' if apply else 'audit',
        'standing_files_checked': len(manifest['players']),
        'standing_files_changed': len(changed),
        'edge_matte_pixels_repaired': pixels_repaired,
        'frame_dimensions': 'unchanged',
        'alpha_rule': 'decreased only on detected white-matte edge pixels',
        'backup': str(BACKUP) if apply else None,
    }
    if not apply:
        print(json.dumps(result, indent=2))
        return
    BACKUP.mkdir(parents=True, exist_ok=True)
    for metadata in (MANIFEST, RUNTIME, REPORT):
        if metadata.exists():
            archive(metadata)
    for record, path, after, count in changed:
        archive(path)
        Image.fromarray(after, 'RGBA').save(path, optimize=True)
        component = record['standing']
        width = component['bbox'][2] - component['bbox'][0]
        height = component['bbox'][3] - component['bbox'][1]
        pad = max(6, round(max(width, height) * .035))
        art = after[pad:pad + height, pad:pad + width]
        avatar_path = ROOT / record['avatar_path']
        archive(avatar_path)
        make_avatar(art).save(avatar_path, optimize=True)
        transparency = component.setdefault('transparency', {})
        transparency['edge_matte_pixels'] = int(transparency.get('edge_matte_pixels', 0)) + count
        transparency['removed_pixels'] = int(transparency.get('removed_pixels', 0)) + count
    manifest['revision'] = 2
    manifest['asset_revision'] = 'alpha-3'
    MANIFEST.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    runtime = RUNTIME.read_text(encoding='utf-8')
    runtime = runtime.replace('"revision":1', '"revision":2', 1).replace('"assetRevision":"alpha-2"', '"assetRevision":"alpha-3"', 1)
    RUNTIME.write_text(runtime, encoding='utf-8')
    REPORT.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--apply', action='store_true')
    main(parser.parse_args().apply)
