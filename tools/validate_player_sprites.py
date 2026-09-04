"""Check every delivered frame and compare native poses with source pixels."""
from pathlib import Path
import argparse,json,sys
import numpy as np
from PIL import Image
from scipy import ndimage
from rebuild_player_sprites import extract_sheet, padded

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('--sources',type=Path)
args=parser.parse_args()
manifest=json.loads((ROOT/'data/player-sprite-manifest.json').read_text())
failures=[];checks=0;multi=[];matched=0
source_records={}
if args.sources:
    for p in args.sources.rglob('*.png'):
        records,_=extract_sheet(p)
        source_records.update({r['source_key']:r for r in records})
for record in manifest['players']+manifest['unpaired']:
    for pose in ('avatar','standing','flying'):
        rel=record.get(pose+'_path')
        if not rel:continue
        checks+=1
        try:
            im=Image.open(ROOT/rel).convert('RGBA');a=np.asarray(im);box=im.getbbox()
            assert box is not None,'empty frame'
            x0,y0,x1,y1=box
            assert min(x0,y0,im.width-x1,im.height-y1)>=6,'opaque art touches frame edge'
            if pose=='avatar':
                assert im.size==(256,256),'wrong avatar canvas'
                assert max(x1-x0,y1-y0)<=232,'avatar exceeds normalized frame'
            else:
                mask=a[:,:,3]>0
                labels,_=ndimage.label(mask,np.ones((3,3)))
                sizes=sorted(np.bincount(labels[mask]).tolist(),reverse=True)
                if len(sizes)>1 and sizes[1]>max(600,sizes[0]*.15):multi.append(rel)
                if source_records:
                    source=source_records[record['source_key']][pose]['pixels']
                    expected=np.asarray(padded(source))
                    actual=np.asarray(im)
                    assert actual.shape==expected.shape,'native frame changed size'
                    assert np.array_equal(actual[:,:,3],expected[:,:,3]),'reviewed source alpha does not match'
                    visible=expected[:,:,3]>0
                    assert np.array_equal(actual[visible],expected[visible]),'retained source colours/details changed'
                    matched+=1
        except Exception as e:failures.append({'file':rel,'error':str(e)})
report={'status':'PASS' if not failures else 'FAIL','all_image_files_checked':checks,
    'native_poses_matched_to_reviewed_source_alpha':matched,'frame_margin_minimum':6,
    'avatars_normalized':len(manifest['players']),'large_disconnected_fragments_for_review':multi,
    'source_sheet_count':manifest['source_sheets'],'complete_pairs':manifest['complete_pairs'],
    'unpaired_source_characters':manifest['unpaired_source_characters'],'failures':failures}
(ROOT/'data/player-sprite-validation.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
sys.exit(bool(failures))
