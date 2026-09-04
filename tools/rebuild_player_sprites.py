"""Rebuild game assets from the supplied art, without a fixed sheet grid.

Usage: python tools/rebuild_player_sprites.py --sources /path/to/source-folders
Requires Pillow, numpy, scipy. Sources are the four extracted attachment groups.
The sheet/component overrides below were checked against the supplied originals.
"""
from pathlib import Path
import argparse
import hashlib
import json
from collections import Counter

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage
from scipy.cluster.hierarchy import fclusterdata
from player_sprite_transparency import repair_alpha

ROOT = Path(__file__).resolve().parents[1]
# Touching silhouettes need a narrow, background-following separation seam.
# Values are source component id: (central x, permitted x deviation).
SEAMS = {
    ('original-01-22', 9): {14: (511, 18)},
    ('additional-34-46', 43): {
        3: (404, 16), 10: (655, 18), 16: (653, 16), 19: (410, 17),
        27: (651, 15), 30: (396, 18), 31: (650, 17), 35: (886, 16),
    },
    ('additional-34-46', 45): {32: (393, 16)},
}
# Broom handles crossing a standing outline in the original crowded sheets.
# These small source rectangles belong to the right-hand flying silhouette.
BROOM_OVERLAPS = {
    ('additional-34-46',43,3):(398,164,422,186),
    ('additional-34-46',43,16):(638,632,660,646),
    ('additional-34-46',43,35):(865,1379,895,1397),
    ('additional-34-46',45,32):(369,1152,403,1171),
}


def bbox(mask):
    yy, xx = np.where(mask)
    return [int(xx.min()), int(yy.min()), int(xx.max()+1), int(yy.max()+1)]


def seam_split(mask, target, radius):
    """Partition touching source pixels; never stretch or redraw the artwork."""
    x0, y0, x1, y1 = bbox(mask)
    lo, hi = max(x0+1, target-radius), min(x1-1, target+radius)
    xs = np.arange(lo, hi+1)
    # Penalise crossing opaque pixels, and prefer a gentle central path through gaps.
    cost = mask[y0:y1, lo:hi+1].astype(float)*100 + abs(xs-target)[None, :]*.025
    dist = cost[0].copy()
    back = np.zeros(cost.shape, dtype=np.int16)
    for y in range(1, len(cost)):
        candidates = np.stack([np.pad(dist, (2,2), constant_values=1e12)[2+d:2+d+len(xs)]+abs(d)*.15 for d in (-2,-1,0,1,2)])
        choice = np.argmin(candidates, axis=0)
        back[y] = np.arange(len(xs))+choice-2
        dist = candidates[choice, np.arange(len(xs))]+cost[y]
    route = np.zeros(len(cost), dtype=int)
    route[-1] = int(dist.argmin())
    for y in range(len(cost)-1, 0, -1):
        route[y-1] = back[y, route[y]]
    boundary = np.full(mask.shape[0], target, dtype=int)
    boundary[y0:y1] = xs[route]
    left = mask & (np.arange(mask.shape[1])[None, :] < boundary[:, None])
    right = mask & ~left
    # A tail can cross the seam below the neighbouring rider. Put disconnected
    # seam fragments back with their nearest main body instead of leaving a
    # detached tail tip inside the other player's frame.
    cores, fragments = [], []
    for region in (left,right):
        labels,n = ndimage.label(region,np.ones((3,3),dtype=np.uint8))
        sizes = np.bincount(labels.ravel());sizes[0]=0
        largest = int(sizes.argmax())
        cores.append(labels == largest)
        for component in range(1,n+1):
            if component != largest:fragments.append(labels == component)
    distances = [ndimage.distance_transform_edt(~core) for core in cores]
    result = [core.copy() for core in cores]
    for fragment in fragments:
        owner = int(np.argmin([dist[fragment].min() for dist in distances]))
        result[owner] |= fragment
    assert np.array_equal(result[0] | result[1],mask)
    return result


def extract_sheet(path):
    rgba = np.asarray(Image.open(path).convert('RGBA'))
    foreground = rgba[:, :, 3] > 0
    raw, _ = ndimage.label(foreground, np.ones((3,3), dtype=np.uint8))
    sizes = np.bincount(raw.ravel())
    sheet = int(path.stem.rsplit('-', 1)[1])
    group = path.parent.name
    split = SEAMS.get((group, sheet), {})
    primary = np.zeros(raw.shape, dtype=np.int32)
    origins = {}
    count = 0
    for component in np.where(sizes >= 700)[0]:
        if component == 0:
            continue
        masks = seam_split(raw == component, *split[component]) if component in split else [raw == component]
        overlap = BROOM_OVERLAPS.get((group,sheet,int(component)))
        if overlap:
            x0,y0,x1,y1=overlap
            moved=masks[0][y0:y1,x0:x1].copy()
            masks[0][y0:y1,x0:x1]=False
            masks[1][y0:y1,x0:x1]|=moved
        for part, mask in enumerate(masks):
            count += 1
            primary[mask] = count
            origins[count] = {'component': int(component), 'part': part if component in split else None}
    distance, nearest = ndimage.distance_transform_edt(primary == 0, return_indices=True)
    nearest_owner = primary[tuple(nearest)]
    owners = primary.copy()
    objects = ndimage.find_objects(raw)
    discarded = 0
    # Associate disconnected toes, antennae, highlights and magic effects with their
    # actual nearest silhouette, rather than including a neighbour's bounding box.
    for component in np.where((sizes > 0) & (sizes < 700))[0]:
        if component == 0:
            continue
        box = objects[component-1]
        small = raw[box] == component
        distances = distance[box][small]
        candidates = nearest_owner[box][small]
        index = int(distances.argmin())
        if distances[index] <= 40:
            owners[box][small] = candidates[index]
        else:
            discarded += int(sizes[component])
    assert np.all(owners[primary > 0] > 0), 'A primary artwork pixel was lost'
    components = []
    for owner in range(1, count+1):
        box = bbox(owners == owner)
        x0,y0,x1,y1 = box
        pixels = rgba[y0:y1,x0:x1].copy()
        pixels[owners[y0:y1,x0:x1] != owner] = 0
        components.append({'owner': owner, 'bbox': box, 'origin': origins[owner], 'pixels': pixels})
    clusters = fclusterdata(np.array([[(c['bbox'][1]+c['bbox'][3])/2] for c in components]), 65, criterion='distance', method='single')
    rows = sorted([[c for c,k in zip(components, clusters) if k == label] for label in set(clusters)], key=lambda r:min(c['bbox'][1] for c in r))
    records = []
    ordinal = 0
    for r, row in enumerate(rows):
        row.sort(key=lambda c:c['bbox'][0])
        if group == 'additional-34-46' and sheet == 34:
            assert len(row) == 7
            pairs = [(0,1),(2,3),(4,None),(5,6)]
        elif group == 'additional-34-46' and sheet == 43 and r == 0:
            assert len(row) == 7
            pairs = [(0,1),(2,3),(None,4),(5,6)]
        elif group == 'additional-34-46' and sheet == 45 and r < 2:
            assert len(row) == 7
            pairs = [(0,1),(2,3),(4,None),(5,6)]
        else:
            assert len(row) % 2 == 0, (path, r, len(row))
            pairs = [(i,i+1) for i in range(0,len(row),2)]
        for s,f in pairs:
            ordinal += 1
            world = path.name.split('-')[1].capitalize() if group == 'worlds' else 'Velmora'
            requested_id = ((1104+(sheet-34)*24) if group == 'worlds' else (sheet-1)*24)+ordinal if ordinal <= 24 else None
            records.append({'source_key': f'{group}-{path.stem}-p{ordinal:02}', 'group': group, 'world': world,
                'sheet': sheet, 'row': r, 'ordinal': ordinal, 'requested_id': requested_id,
                'source_file': path.name, 'source_sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                'standing': row[s] if s is not None else None, 'flying': row[f] if f is not None else None})
    for record in records:
        for pose in ('standing', 'flying'):
            if record[pose]:
                c = record[pose]
                c['pixels'], c['transparency'] = repair_alpha(c['pixels'], record['source_key'], pose, record['source_sha256'])
    summary = {'group':group,'sheet':sheet,'file':path.name,'row_pose_counts':[len(row) for row in rows],
        'characters':len(records),'complete_pairs':sum(bool(r['standing'] and r['flying']) for r in records),
        'separated_touching_components':len(split),'isolated_background_pixels_removed':discarded}
    return records, summary


def padded(pixels):
    im = Image.fromarray(pixels)
    pad = max(6, round(max(im.size)*.035))
    out = Image.new('RGBA', (im.width+pad*2, im.height+pad*2))
    out.paste(im,(pad,pad))
    return out


def avatar(pixels):
    im = Image.fromarray(pixels)
    scale = min(232/im.width,232/im.height)
    im = im.resize((round(im.width*scale),round(im.height*scale)), Image.Resampling.NEAREST)
    out = Image.new('RGBA',(256,256))
    out.paste(im,((256-im.width)//2,244-im.height))
    return out


def public_record(record):
    out = {k:v for k,v in record.items() if k not in ('standing','flying')}
    for pose in ('standing','flying'):
        c = record[pose]
        out[pose] = {k:v for k,v in c.items() if k != 'pixels'} if c else None
    return out


def build(sources):
    records, sheets = [], []
    paths = sorted(sources.rglob('*.png'), key=lambda p:(p.parent.name == 'worlds',int(p.stem.rsplit('-',1)[1]),p.name))
    assert len(paths) == 67, f'Expected all 67 source sheets, got {len(paths)}'
    for path in paths:
        items, summary = extract_sheet(path)
        records.extend(items); sheets.append(summary)
    complete = [r for r in records if r['standing'] and r['flying']]
    unpaired = [r for r in records if not (r['standing'] and r['flying'])]
    by_id = {r['requested_id']:r for r in complete if r['requested_id'] is not None}
    extras = [r for r in complete if r['requested_id'] is None]
    reassigned = []
    for n in range(1,1609):
        if n in by_id:
            continue
        group = 'original-01-22' if n <= 528 else 'additional-23-33' if n <= 792 else 'additional-34-46'
        replacement = next((r for r in extras if r['group'] == group), extras[0] if extras else None)
        assert replacement is not None, f'No complete source pair for visual slot {n}'
        extras.remove(replacement)
        by_id[n] = replacement
        reassigned.append({'visual_id':n,'replacement_source':replacement['source_key'], 'reason':'The nominal 24-per-sheet slot had no complete source pair.'})
    for n, record in enumerate(extras,1609):
        by_id[n] = record
    for d in ['assets/player-avatars','assets/quidditch-engine/standing','assets/quidditch-engine/players','assets/player-sprites/unpaired','data','sprite-review']:
        (ROOT/d).mkdir(parents=True,exist_ok=True)
    exported = []
    for n, record in sorted(by_id.items()):
        record['id'] = n
        key = f'player-{n:03}'
        standing_path = f'assets/quidditch-engine/standing/{key}.png'
        flying_path = f'assets/quidditch-engine/players/{key}.webp'
        avatar_path = f'assets/player-avatars/{key}.png'
        padded(record['standing']['pixels']).save(ROOT/standing_path)
        padded(record['flying']['pixels']).save(ROOT/flying_path,lossless=True,method=4)
        avatar(record['standing']['pixels']).save(ROOT/avatar_path)
        entry = public_record(record)
        entry.update(avatar_path=avatar_path,standing_path=standing_path,flying_path=flying_path)
        exported.append(entry)
    incomplete = []
    for record in unpaired:
        entry = public_record(record)
        for pose in ('standing','flying'):
            if record[pose]:
                out = f"assets/player-sprites/unpaired/{record['source_key']}-{pose}.png"
                padded(record[pose]['pixels']).save(ROOT/out)
                entry[pose+'_path'] = out
        entry['status'] = 'missing-flying-source' if record['standing'] else 'missing-standing-source'
        incomplete.append(entry)
    report = {'revision':2,'asset_revision':'alpha-3','source_sheets':len(paths),'source_characters':len(records),'complete_pairs':len(exported),
        'unpaired_source_characters':len(incomplete),'runtime_images':len(exported)*3,
        'sheets':sheets,'reassigned_nominal_slots':reassigned,'players':exported,'unpaired':incomplete}
    (ROOT/'data/player-sprite-manifest.json').write_text(json.dumps(report,indent=2))
    legacy = [{'id':f"AV{x['id']:03}",'file':x['avatar_path'],'sheet':x['sheet'],'row':x['row'],
        'source_key':x['source_key'],'standing':x['standing_path'],'flying':x['flying_path']} for x in exported]
    (ROOT/'data/player-avatar-manifest.json').write_text(json.dumps(legacy,indent=2))
    frames = {}
    for r in exported:
        im = Image.open(ROOT/r['standing_path'])
        frames[r['id']] = {'standingBottom':im.getbbox()[3]/im.height}
    runtime = {'revision':2,'assetRevision':'alpha-3','ids':[r['id'] for r in exported], 'frames':frames,
        'pools':{w:[r['id'] for r in exported if r['world']==w] for w in ['Velmora','Kharova','Caldria','Ezuraya']}}
    (ROOT/'data/player-sprites.js').write_text('window.VELMORA_PLAYER_SPRITES = '+json.dumps(runtime,separators=(',',':'))+';\n')
    review_fields=['id','world','group','source_key','source_file','ordinal','avatar_path','standing_path','flying_path']
    review=[{k:r[k] for k in review_fields if k in r} for r in exported+incomplete]
    (ROOT/'sprite-review/review-data.js').write_text('const VELMORA_SPRITE_REVIEW='+json.dumps(review,separators=(',',':'))+';\n')
    print(json.dumps({k:v for k,v in report.items() if k not in ('players','unpaired','sheets')},indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--sources',type=Path,required=True)
    build(parser.parse_args().sources)
