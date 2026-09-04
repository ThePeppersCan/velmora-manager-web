"""Verify alpha-only changes against a copy of the previous delivered assets."""
from pathlib import Path
import argparse, json
import numpy as np
from PIL import Image
from scipy import ndimage
from player_sprite_transparency import REGIONS

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--before', type=Path, required=True)
args = parser.parse_args()
manifest = json.loads((ROOT/'data/player-sprite-manifest.json').read_text())
checked = changed = removed = protected = 0
failures = []
for r in manifest['players'] + manifest['unpaired']:
    for pose in ('avatar', 'standing', 'flying'):
        rel = r.get(pose+'_path')
        if not rel:
            continue
        checked += 1
        try:
            a = np.asarray(Image.open(ROOT/rel).convert('RGBA'))
            b = np.asarray(Image.open(args.before/rel).convert('RGBA'))
            assert a.shape == b.shape, 'Frame dimensions changed'
            assert np.all(a[:, :, 3] <= b[:, :, 3]), 'New opaque pixels introduced'
            unchanged_alpha = a[:, :, 3] == b[:, :, 3]
            assert np.array_equal(a[:, :, :3][unchanged_alpha], b[:, :, :3][unchanged_alpha]), 'Colours changed outside repaired edge pixels'
            diff = b[:, :, 3] > a[:, :, 3]
            changed += int(diff.any())
            if pose == 'avatar':
                continue
            removed += int(diff.sum())
            c = r[pose]
            w, h = c['bbox'][2]-c['bbox'][0], c['bbox'][3]-c['bbox'][1]
            pad = max(6, round(max(w, h)*.035))
            original = b[pad:pad+h, pad:pad+w]
            current = a[pad:pad+h, pad:pad+w]
            rgb = original[:, :, :3].astype(int)
            white = (original[:, :, 3] > 0) & (rgb.min(2) >= 225) & (np.ptp(rgb, axis=2) <= 15)
            labels, _ = ndimage.label(white, np.ones((3, 3)))
            entry = REGIONS['poses'].get(r['source_key']+':'+pose, {})
            ids = [labels[y, x] for x, y in entry.get('preserve', [])]
            if ids:
                mask = np.isin(labels, ids)
                assert np.array_equal(current[:, :, 3][mask], original[:, :, 3][mask]), 'Protected white artwork removed'
                protected += int(mask.sum())
            assert diff.sum() == c['transparency']['removed_pixels'], 'Alpha audit count mismatch'
        except Exception as exc:
            failures.append({'file': rel, 'error': str(exc)})

# Regression coverage: entire lower wing, pale faces and the reported rider's gap.
features = []
for n, rect in [(296,(90,45,170,103)), (292,(100,60,175,104)),
                (1465,(12,8,68,57)), (1004,(15,8,68,53))]:
    rel = f'assets/quidditch-engine/players/player-{n:03}.webp'
    x0,y0,x1,y1 = rect
    a = np.asarray(Image.open(ROOT/rel).convert('RGBA'))[y0:y1,x0:x1]
    b = np.asarray(Image.open(args.before/rel).convert('RGBA'))[y0:y1,x0:x1]
    kept = float((a[:, :, 3]>0).sum()/max(1,(b[:, :, 3]>0).sum()))
    features.append({'player':n,'region':rect,'opaque_pixels_retained':kept})
    if kept < .97:
        failures.append({'file':rel,'error':'White wing/face preservation regression'})

report = {'status':'FAIL' if failures else 'PASS', 'asset_revision':'alpha-3',
          'files_checked':checked, 'files_changed':changed,
          'native_background_pixels_removed':removed,
          'protected_white_pixels_retained':protected,
          'frame_dimensions':'unchanged', 'retained_colours':'unchanged outside repaired edge pixels',
          'white_artwork_regressions':features, 'failures':failures}
(ROOT/'data/player-transparency-validation.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
raise SystemExit(bool(failures))
