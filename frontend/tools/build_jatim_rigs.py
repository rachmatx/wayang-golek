"""Assemble generated puppet parts into SVG rigs without modifying source pixels.

The original PNG sheets remain unaltered. WebP files are runtime encodings of
those originals. This script writes only SVG XML and rig metadata. Each sheet
is embedded once; SVG crop paths isolate the body and four articulated limbs.
Run from any directory: python frontend/tools/build_jatim_rigs.py [character ...]
"""
from __future__ import annotations

import base64
import json
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / 'frontend' / 'assets' / 'jatim'
SVG = 'http://www.w3.org/2000/svg'
ET.register_namespace('', SVG)


def el(tag, attrs=None, parent=None):
    node = ET.Element(f'{{{SVG}}}{tag}', {k: str(v) for k, v in (attrs or {}).items()})
    if parent is not None:
        parent.append(node)
    return node


def sprite(parent, part, sheet_scale, target_pivot=None):
    """Place a source crop using its known socket, never raster-crop the sheet."""
    rect = part['rect']
    if target_pivot is None:
        tx, ty = part['translation']
    else:
        sx, sy = part['source_pivot']
        tx = target_pivot[0] - sx * sheet_scale
        ty = target_pivot[1] - sy * sheet_scale
    wrapper = el('g', {'transform': f'translate({tx:.3f} {ty:.3f}) scale({sheet_scale})'}, parent)
    el('use', {'href': '#sheet', 'clip-path': f"url(#{part['id']}-crop)"}, wrapper)


def assemble(key, spec):
    source = ASSETS / spec['runtime_sheet']
    encoded = base64.b64encode(source.read_bytes()).decode('ascii')
    root = el('svg', {'width':444, 'height':562, 'viewBox':'0 0 444 562',
        'role':'img', 'aria-labelledby':'asset-title asset-desc',
        'data-foot-x':spec['foot'][0], 'data-foot-y':spec['foot'][1],
        'data-art-status':'interpretative-illustration', 'data-source-face':'right'})
    el('title', {'id':'asset-title'}, root).text = spec['title']
    el('desc', {'id':'asset-desc'}, root).text = 'Ilustrasi interpretatif untuk aplikasi wayang kulit Jawa Timuran; bukan dokumentasi benda museum atau hasil validasi praktisi.'
    defs = el('defs', parent=root)
    el('image', {'id':'sheet', 'width':spec['sheet_size'][0], 'height':spec['sheet_size'][1],
        'href':'data:image/webp;base64,'+encoded}, defs)
    for part in spec['parts'].values():
        clip = el('clipPath', {'id':part['id']+'-crop', 'clipPathUnits':'userSpaceOnUse'}, defs)
        x1,y1,x2,y2 = part['rect']
        el('rect', {'x':x1, 'y':y1, 'width':x2-x1, 'height':y2-y1},clip)
    rig = el('g', {'id':'grup-wayang'}, root)
    def arm(side):
        upper_key = 'upper_'+side
        lower_key = 'lower_'+side
        upper = spec['parts'][upper_key]
        lower = spec['parts'][lower_key]
        top = el('g', {'id':'lengan-atas-'+side, 'data-pivot-x':upper['pivot'][0],
            'data-pivot-y':upper['pivot'][1]}, rig)
        sprite(top,upper,spec['arm_scale'],upper['pivot'])
        fore = el('g', {'id':'lengan-bawah-'+side,'data-pivot-x':lower['pivot'][0],
            'data-pivot-y':lower['pivot'][1]},top)
        if lower.get('rod'):
            x1, y1, x2, y2 = lower['rod']
            el('path', {'d':f'M{x1} {y1} L{x2} {y2}', 'fill':'none',
                'stroke':'#302619', 'stroke-width':'1.8', 'stroke-linecap':'round'},fore)
        sprite(fore,lower,spec['arm_scale'],lower['pivot'])
    if spec.get('back_arm_under_body', True):
        arm('kiri')
    body = el('g', {'id':'badan'}, rig)
    sprite(body,spec['parts']['body'],spec['body_scale'])
    if not spec.get('back_arm_under_body', True):
        arm('kiri')
    arm('kanan')
    ET.indent(root,space='  ')
    path=ASSETS/f'wayang-{key}.svg'
    ET.ElementTree(root).write(path,encoding='utf-8',xml_declaration=True)
    return path


def main():
    specs = json.loads((ASSETS/'rig-specs.json').read_text())
    selected = sys.argv[1:] or list(specs)
    for key in selected:
        path=assemble(key,specs[key])
        print(f'{key}: {path.stat().st_size/1024:.1f} KB')


if __name__=='__main__':
    main()
