#!/usr/bin/env python3
import json
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
manifest=json.loads((ROOT/"manager-assets.json").read_text())
ids=set(); paths=set(); errors=[]
for row in manifest["assets"]:
    if row["id"] in ids: errors.append(f"duplicate ID: {row['id']}")
    ids.add(row["id"])
    rels=([row["path"]] if row.get("path") else [])+list(row.get("paths",{}).values())
    rels += [row[k] for k in ("separatedPath","eraseMask") if row.get(k)]
    for rel in rels:
        paths.add(rel); path=ROOT/rel
        if not path.exists(): errors.append(f"missing: {rel}"); continue
        with Image.open(path) as im:
            if im.size != (256,384) or im.mode != "RGBA": errors.append(f"invalid PNG: {rel} {im.size} {im.mode}")
result={"status":"pass" if not errors else "fail","uniqueStableIds":len(ids),"uniqueLayerPngs":len(paths),"errors":errors}
print(json.dumps(result,indent=2)); raise SystemExit(0 if not errors else 1)
