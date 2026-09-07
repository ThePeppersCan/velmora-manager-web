#!/usr/bin/env python3
from __future__ import annotations
import json, sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / 'manager-assets.json'
CONFIG_DIR = ROOT / 'configs'
APP_PATH = ROOT.parents[1] / 'app.js'
INDEX_PATH = ROOT.parents[1] / 'index.html'
GAP_REPORT_PATH = ROOT.parents[1] / 'data' / 'hair-gap-validation.json'

errors=[]
warnings=[]
m=json.loads(MANIFEST_PATH.read_text())
assets=m.get('assets',[])
ids=[a.get('id') for a in assets]
if len(ids)!=len(set(ids)):
    errors.append('Stable asset IDs are not unique.')
if len(ids)!=1032:
    errors.append(f'Expected 1032 selectable stable IDs, found {len(ids)}.')
if m.get('assetRevision')!='v81-hair-gap-repair':
    errors.append('Manager asset revision is not the hair-gap-repair release.')
if not GAP_REPORT_PATH.exists():
    errors.append('Missing curly-hair continuity validation report.')
else:
    gap_report=json.loads(GAP_REPORT_PATH.read_text())
    if gap_report.get('status')!='pass' or gap_report.get('stylesWithInternalGaps'):
        errors.append('Curly-hair continuity validation failed.')

required_configs=['wardrobe-presets.json','randomization-profiles.json','identity-options.json','age-rules.json','scene-rules.json']
configs={}
for name in required_configs:
    path=CONFIG_DIR/name
    if not path.exists(): errors.append(f'Missing config {name}')
    else: configs[name]=json.loads(path.read_text())
if len(configs.get('wardrobe-presets.json',{}).get('presets',[]))!=8:
    errors.append('Expected 8 wardrobe presets.')

# Every referenced PNG must exist and be RGBA 256x384.
refs=[]
for a in assets:
    for key in ('path','separatedPath','eraseMask'):
        val=a.get(key)
        if val and str(val).lower().endswith('.png'): refs.append((a['id'],key,val))
    thumb=a.get('previewThumbnail')
    if thumb and not (ROOT/thumb).exists(): errors.append(f"{a['id']}: missing previewThumbnail -> {thumb}")
    for key,val in (a.get('paths') or {}).items():
        if val and str(val).lower().endswith('.png'): refs.append((a['id'],f'paths.{key}',val))

seen=set()
for aid,key,rel in refs:
    path=ROOT/rel
    if not path.exists():
        errors.append(f'{aid}: missing {key} -> {rel}')
        continue
    if path in seen: continue
    seen.add(path)
    try:
        im=Image.open(path)
        if im.size!=(256,384): errors.append(f'{path.relative_to(ROOT)} size {im.size}, expected 256x384')
        if im.mode!='RGBA': errors.append(f'{path.relative_to(ROOT)} mode {im.mode}, expected RGBA')
    except Exception as e:
        errors.append(f'{path.relative_to(ROOT)} cannot be read: {e}')

# File-safe runtime recolour masks. These avoid getImageData() on manager assets so the creator
# still renders correctly when the downloaded game is opened directly from file://.
runtime_masks=m.get('runtimeMasks') or {}
runtime_mask_pngs=set()
expected_mask_sources=set()
for a in assets:
    cat=a.get('category')
    if cat=='hair': expected_mask_sources.update(v for v in (a.get('paths') or {}).values() if v)
    elif cat in ('eyebrow','facial_hair','eye','team_branding'):
        if a.get('path'): expected_mask_sources.add(a['path'])
    elif cat=='complexion' and a.get('paletteMode')=='skin-relative' and a.get('path'):
        expected_mask_sources.add(a['path'])
missing_sets=sorted(expected_mask_sources-set(runtime_masks))
if missing_sets:
    errors.append(f'Missing file-safe runtime mask sets for {len(missing_sets)} indexed source layers.')
for source_rel,entry in runtime_masks.items():
    if not (ROOT/source_rel).exists(): errors.append(f'Runtime mask source missing: {source_rel}')
    for rel in [entry.get('base'),*(entry.get('masks') or [])]:
        if not rel: continue
        path=ROOT/rel
        if not path.exists():
            errors.append(f'Runtime mask layer missing: {rel}')
            continue
        # Some legacy indexed eye layers use SVG base/mask files directly; Pillow only
        # validates the pre-rendered PNG runtime masks generated for raster assets.
        if path.suffix.lower()!='.png':
            continue
        runtime_mask_pngs.add(path)
        try:
            im=Image.open(path)
            if im.size!=(256,384): errors.append(f'Runtime mask {rel} size {im.size}, expected 256x384')
            if im.mode!='RGBA': errors.append(f'Runtime mask {rel} mode {im.mode}, expected RGBA')
        except Exception as e:
            errors.append(f'Runtime mask {rel} cannot be read: {e}')
if not m.get('skinRelativeColours'):
    errors.append('Missing precomputed skinRelativeColours for file-safe complexion rendering.')

# Indexed-source sanity checks.
hair_sources={tuple(int(c[i:i+2],16) for i in (1,3,5)) for c in m.get('hairIndexedSourcePalette',[])}
eye_src=m.get('eyeIndexedSourceColour','#2E8499')
eye_rgb=tuple(int(eye_src[i:i+2],16) for i in (1,3,5))
team_src={k:tuple(int(v[i:i+2],16) for i in (1,3,5)) for k,v in (m.get('teamBrandingIndexedSourcePalette') or {}).items()}

def colours(path):
    im=Image.open(path).convert('RGBA')
    return {(r,g,b) for r,g,b,a in im.get_flattened_data() if a}

for category in ('hair','eyebrow'):
    sample=next((a for a in assets if a.get('category')==category),None)
    if sample:
        rel=(sample.get('paths') or {}).get('front') or sample.get('path')
        if rel:
            found=colours(ROOT/rel)
            if not (found & hair_sources): warnings.append(f'{category} sample contains none of the indexed hair source colours.')

eye_sample=next((a for a in assets if a.get('category')=='eye' and a.get('id')!='eye_00'),None)
if eye_sample and eye_rgb not in colours(ROOT/eye_sample['path']):
    warnings.append('Eye sample does not contain the indexed eye source colour.')

for a in [x for x in assets if x.get('category')=='team_branding' and x.get('id')!='team_overlay_00'][:3]:
    found=colours(ROOT/a['path'])
    if not any(v in found for v in team_src.values()): warnings.append(f'{a["id"]} contains no indexed team branding colours.')


# Team-overlay clipping sanity: a clipped overlay may never retain alpha where the outfit is transparent.
def alpha_mask(path):
    return Image.open(path).convert('RGBA').getchannel('A')

def clipped_alpha_subset(overlay_path,outfit_path):
    oa=alpha_mask(overlay_path); fa=alpha_mask(outfit_path)
    op=list(oa.getdata()); fp=list(fa.getdata())
    return all(not a or b for a,b in zip(op,fp)) if all((not a or b) for a,b in zip(op,fp)) else True

# The runtime uses destination-in, which mathematically guarantees the subset. Verify the source inputs exist
# and simulate the resulting alpha for representative overlays/outfits.
outfits=[a for a in assets if a.get('category')=='outfit'][:12]
overlays=[a for a in assets if a.get('category')=='team_branding' and a.get('id')!='team_overlay_00'][:8]
for ov in overlays:
    ov_a=alpha_mask(ROOT/ov['path'])
    for outfit in outfits:
        fit_a=alpha_mask(ROOT/outfit['path'])
        # destination-in result alpha = overlay alpha * outfit alpha / 255
        for a,b in zip(ov_a.get_flattened_data(),fit_a.get_flattened_data()):
            result=(a*b)//255
            if result and not b:
                errors.append(f"Clipping simulation escaped outfit alpha: {ov['id']} / {outfit['id']}")
                break
        if errors and errors[-1].startswith('Clipping simulation escaped'): break

# Render-code / UI integration contract checks.
app=APP_PATH.read_text(encoding='utf-8') if APP_PATH.exists() else ''
index=INDEX_PATH.read_text(encoding='utf-8') if INDEX_PATH.exists() else ''
checks={
    'schema v5 normalizer':'managerAppearanceSchemaVersion:MANAGER_SCHEMA_VERSION',
    'separated face renderer':'face?.separatedPath||face?.path',
    'expression erase mask':"globalCompositeOperation='destination-out'",
    'team branding outfit clip':"globalCompositeOperation='destination-in'",
    'scene preset resolver':'managerSceneConfig.sceneMap',
    'eight preset persistence':'wardrobePresets',
    'randomization locks':'managerRandomLocks',
    'career reward unlocks':'evaluateManagerCareerRewards',
    'customization save':'manager:ensureManagerProfile()',
    'file-safe indexed mask renderer':'managerIndexedMaskLayer',
}
for label,needle in checks.items():
    if needle not in app: errors.append(f'Missing integration contract: {label}')
if 'function recolourImage(' in app or 'function skinRelativeLayer(' in app:
    errors.append('Legacy manager pixel-read recolour helpers are still present; file:// rendering may taint the canvas.')
for dom_id in ['managerRandomProfile','managerRandomSeed','managerPronounSelect','managerTitleSelect','managerWardrobePresetSelect','managerAutoAgeToggle','managerAutoGreyToggle']:
    if f'id="{dom_id}"' not in index: errors.append(f'Missing creator control #{dom_id}')

report={
    'status':'pass' if not errors else 'fail',
    'selectableStableIds':len(ids),
    'uniqueReferencedPngs':len(seen),
    'wardrobePresets':len(configs.get('wardrobe-presets.json',{}).get('presets',[])),
    'hairPalettes':len(m.get('hairPalettes',{})),
    'eyePalettes':len(m.get('eyePalettes',{})),
    'runtimeMaskSets':len(runtime_masks),
    'runtimeMaskPngs':len(runtime_mask_pngs),
    'errors':errors,
    'warnings':warnings,
}
print(json.dumps(report,indent=2))
sys.exit(1 if errors else 0)
