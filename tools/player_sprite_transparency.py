"""Deterministic alpha repair for the supplied player sheets.

Reviewed, source-local seeds identify flat matte caught inside silhouettes.
Protected seeds retain actual white artwork. RGB values and frame geometry
are never changed. This runs after ownership/pairing, so it cannot split or
reassign players. The JSON includes the original source hash for each entry.
"""
from pathlib import Path
import json
import numpy as np
from scipy import ndimage

REGIONS = json.loads(Path(__file__).with_name('player_matte_regions.json').read_text())
CONNECT = np.ones((3, 3), dtype=bool)


def decontaminate_edge_matte(pixels, protection=None):
    """Recover antialiased silhouette edges that were flattened onto white.

    The old extraction correctly removed the background, but some pale edge
    samples remained fully opaque.  Those pixels flash white when a standing
    sprite is enlarged over a dark scene.  Reconstruct their colour from the
    nearest true interior pixel and derive the original coverage from a white
    matte.  Alpha can only decrease; frame geometry never changes.
    """
    a = pixels.copy()
    rgb = a[:, :, :3].astype(np.int16)
    visible = a[:, :, 3] > 0
    if not visible.any():
        return a, {'edge_matte_pixels': 0}
    if protection is None:
        protection = np.zeros(visible.shape, dtype=bool)
    interior = ndimage.binary_erosion(visible, structure=CONNECT, border_value=0)
    if not interior.any():
        return a, {'edge_matte_pixels': 0}
    distance, nearest = ndimage.distance_transform_edt(~interior, return_indices=True)
    nearest_rgb = rgb[tuple(nearest)]
    edge = visible & ~ndimage.binary_erosion(visible, structure=CONNECT, border_value=0)
    observed_light = rgb.mean(2)
    interior_light = nearest_rgb.mean(2)
    neutral_pale = (rgb.min(2) >= 170) & (np.ptp(rgb, axis=2) <= 45)
    candidate = (edge & neutral_pale & (distance <= 4.5) &
                 (interior_light < 175) & ((observed_light - interior_light) >= 32) &
                 ~protection)
    denominator = 255 - nearest_rgb
    valid_channel = candidate[:, :, None] & (denominator > 20) & (rgb >= nearest_rgb + 15)
    ratios = np.divide(255 - rgb, denominator, out=np.zeros_like(rgb, dtype=float), where=denominator > 0)
    channel_count = valid_channel.sum(2)
    coverage = np.divide((ratios * valid_channel).sum(2), channel_count,
                         out=np.ones(visible.shape, dtype=float), where=channel_count > 0)
    coverage = np.clip(coverage, .05, .95)
    new_alpha = np.minimum(a[:, :, 3], np.rint(coverage * 255).astype(np.uint8))
    repaired = candidate & (channel_count > 0) & (new_alpha < a[:, :, 3])
    a[:, :, :3][repaired] = nearest_rgb[repaired].astype(np.uint8)
    a[:, :, 3][repaired] = new_alpha[repaired]
    return a, {'edge_matte_pixels': int(repaired.sum())}

def repair_alpha(pixels, source_key, pose, source_sha256=None):
    a = pixels.copy()
    rgb = a[:, :, :3].astype(np.int16)
    visible = a[:, :, 3] > 0
    entry = REGIONS['poses'].get(source_key + ':' + pose, {})
    if entry and source_sha256:
        assert entry['source_sha256'] == source_sha256, 'Source changed: review transparency seeds again'
    white = visible & (rgb.min(2) >= 225) & (np.ptp(rgb, axis=2) <= 15)
    labels, _ = ndimage.label(white, CONNECT)
    def selected(name):
        ids = []
        for x, y in entry.get(name, []):
            assert labels[y, x] > 0, (source_key, pose, name, x, y)
            ids.append(labels[y, x])
        return np.isin(labels, ids) if ids else np.zeros(visible.shape, bool)
    protected = selected('preserve')
    # Keep the adjoining shading of protected white feathers, faces and fabrics.
    protection = ndimage.binary_dilation(protected, iterations=2)
    trapped = selected('remove')
    pale = visible & (rgb.min(2) >= 180) & (np.ptp(rgb, axis=2) <= 40) & (rgb.mean(2) >= 205)
    # Grow through the light gray matte border, stopping at coloured/dark ink.
    trapped = ndimage.binary_propagation(trapped, structure=CONNECT, mask=(pale & ~protection) | trapped)
    # Two mosquito poses also retain flat blue-gray patches around their feet.
    # The reviewed rectangles avoid the wings and face; dark limb ink remains.
    for x0, y0, x1, y1 in entry.get('pale_matte_boxes', []):
        local = (visible & (rgb.min(2) >= 140) & (np.ptp(rgb, axis=2) <= 80)
                 & (rgb.mean(2) >= 170) & ~protection)
        trapped[y0:y1, x0:x1] |= local[y0:y1, x0:x1]
    remaining = visible & ~trapped
    distance = ndimage.distance_transform_edt(remaining)
    fringe_colour = remaining & (rgb.min(2) >= 210) & (np.ptp(rgb, axis=2) <= 24)
    flabels, count = ndimage.label(fringe_colour, CONNECT)
    sizes = np.bincount(flabels.ravel())
    # Only shallow, exposed pale fragments qualify. Large white regions and all
    # interior highlights stay opaque. In particular, this is not a white-key.
    maximum_depth = ndimage.maximum(distance, flabels, np.arange(count + 1))
    eligible = (sizes <= 128) & (maximum_depth <= 1.5)
    eligible[0] = False
    edge = eligible[flabels] & (distance <= 1.5) & ~protection
    removed = trapped | edge
    # Isolated neutral debris left by the old matte, outside the silhouette.
    remainder = visible & ~removed
    lab, n = ndimage.label(remainder, CONNECT)
    sz = np.bincount(lab.ravel())
    for c in np.where((sz > 0) & (sz <= 6))[0]:
        if c == 0:
            continue
        part = lab == c
        values = rgb[part]
        if values.min() >= 175 and np.ptp(values, axis=1).max() <= 30 and not protection[part].any():
            removed |= part
    a[removed, 3] = 0
    a, matte = decontaminate_edge_matte(a, protection)
    return a, {'trapped_matte_pixels': int(trapped.sum()),
               'edge_debris_pixels': int((removed & ~trapped).sum()),
               'edge_matte_pixels': matte['edge_matte_pixels'],
               'removed_pixels': int(removed.sum()) + matte['edge_matte_pixels'],
               'protected_white_pixels': int(protected.sum())}
