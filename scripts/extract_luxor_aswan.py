#!/usr/bin/env python3
"""Sprint 6 — Luxor + Aswan flat extraction directly from egypt_nodes_full.jsonl.
Reads chunk-by-chunk (line-by-line, memory-safe on 2.55 GB file), filters by
bounds + name + whitelisted tags + no addr:housenumber/shop/office, writes flat
format matching dahab.json exactly. No GeoJSON intermediate (Sprint 5.1 fixed)."""
import json, os, sys

SOURCE = r'D:\prototype-full\data\egypt_output\egypt_nodes_full.jsonl'
BASE = r'D:\dahab-—-travel-platform\Travel.eg'

BOUNDS = {
    'luxor':  {'latMin': 25.60, 'latMax': 25.80, 'lngMin': 32.50, 'lngMax': 32.70, 'city':'luxor', 'name':'Luxor'},
    'aswan':  {'latMin': 23.90, 'latMax': 24.20, 'lngMin': 32.80, 'lngMax': 33.00, 'city':'aswan', 'name':'Aswan'},
}

WHITELIST = {'restaurant','cafe','attraction','museum','hotel','camp_site','temple'}


def extract(slug):
    b = BOUNDS[slug]
    features = []
    tag_counts = {}
    with open(SOURCE, 'r', encoding='utf-8', errors='replace') as fh:
        for line in fh:
            line=line.strip()
            if not line or not line.startswith('{'):
                continue
            try:
                node = json.loads(line)
            except Exception:
                continue
            lat = node.get('lat')
            lng = node.get('lng')
            if lat is None or lng is None:
                # Source uses lng (verified Sprint 3); if missing try lng key
                lng = node.get('lng')
            if lat is None or lng is None:
                continue
            if not (b['latMin'] <= lat <= b['latMax'] and b['lngMin'] <= lng <= b['lngMax']):
                continue
            tags = node.get('tags') or {}
            if not tags:
                continue
            name = tags.get('name') or tags.get('name:ar') or tags.get('name:en')
            if not name or str(name).strip() == '':
                continue
            # Whitelist: at least one whitelisted tag must exist
            has_whitelist = False
            for k, v in tags.items():
                if k in ('tourism','historic','amenity') and isinstance(v, str):
                    if v in WHITELIST:
                        has_whitelist = True
                        break
            if not has_whitelist:
                continue
            # Exclude
            if tags.get('addr:housenumber') or tags.get('addr:street') == 'housenumber':
                continue
            if 'shop' in tags or 'office' in tags:
                continue
            # Build flat feature
            flat_f = {
                'id': node.get('id'),
                'name': tags.get('name') or tags.get('name:en') or tags.get('name:ar') or '',
                'nameAr': tags.get('name:ar') or tags.get('name') or '',
                'nameEn': tags.get('name:en') or tags.get('name') or '',
                'lat': lat,
                'lng': lng,
                'tags': {k: v for k, v in tags.items() if v is not None and str(v) != ''},
            }
            features.append(flat_f)
            # Update tag counts
            for k, v in tags.items():
                if v is not None and str(v) != '':
                    tag_counts.setdefault(k, {})
                    tag_counts[k][str(v)] = tag_counts[k].get(str(v), 0) + 1
    # Build top-level meta
    lats = [f['lat'] for f in features if f['lat'] is not None]
    lngs = [f['lng'] for f in features if f['lng'] is not None]
    bounds_flat = {
        'latMin': round(min(lats), 2) if lats else None,
        'latMax': round(max(lats), 2) if lats else None,
        'lngMin': round(min(lngs), 2) if lngs else None,
        'lngMax': round(max(lngs), 2) if lngs else None,
    }
    tag_counts_flat = {}
    for k, v_dict in tag_counts.items():
        tag_counts_flat[k] = dict(sorted(v_dict.items(), key=lambda x: -x[1])[:8])
    tourism_counts = {}
    historic_counts = {}
    for f in features:
        t = f['tags'].get('tourism')
        if t and isinstance(t, str):
            tourism_counts[t] = tourism_counts.get(t, 0) + 1
        h = f['tags'].get('historic')
        if h and isinstance(h, str):
            historic_counts[h] = historic_counts.get(h, 0) + 1
    # Approximate meta from feature tags (better than nothing for seed)
    flat = {
        'city': slug,
        'name': b['name'],
        'bounds': bounds_flat,
        'featureCount': len(features),
        'tourismCount': sum(1 for f in features if f['tags'].get('tourism')),
        'tagCounts': tag_counts_flat,
        'features': features,
    }
    out_path = os.path.join(BASE, 'data', 'cities', slug + '.json')
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(flat, f, ensure_ascii=False, separators=(',', ':'), indent=None)
    sz = os.path.getsize(out_path)
    pollution = sum(1 for f in features if 'addr:housenumber' in f.get('tags', {}))
    # Verify flat: no geometry, no properties, has lat/lng/tags
    f0 = features[0] if features else {}
    print('%s -> %d B (%d features, tourismTags=%d, pollution=%d) lat=%s lng=%s flat_ok=%s' % (
        slug, sz, len(features), flat['tourismCount'], pollution,
        f0.get('lat'), f0.get('lng'),
        'geometry' not in f0 and 'properties' not in f0 and f0.get('lat') is not None))
    return sz, len(features), flat['tourismCount']

if __name__ == '__main__':
    for slug in ['luxor', 'aswan']:
        sz, cnt, tour = extract(slug)
