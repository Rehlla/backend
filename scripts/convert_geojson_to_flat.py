#!/usr/bin/env python3
"""Convert GeoJSON FeatureCollection seeds to flat format (dahab-compatible).

Reads from data/cities/{slug}.geojson.bak (the original source of truth),
writes data/cities/{slug}.json in flat format matchingdahab.json structure.
One run per city."""
import json, os, sys

base = r'D:\dahab-—-travel-platform\Travel.eg'

SEED_META = {
    'alexandria': {'city': 'alexandria', 'name': 'Alexandria', 'featureCount': 667, 'tourismCount': 120},
    'giza':       {'city': 'giza', 'name': 'Giza',       'featureCount': 1411, 'tourismCount': 330},
    'nuweiba':    {'city': 'nuweiba', 'name': 'Nuweiba',  'featureCount': 16,  'tourismCount': 11},
}

def convert(slug):
    bak_path = os.path.join(base, 'data', 'cities', slug + '.geojson.bak')
    in_path = os.path.join(base, 'data', 'cities', slug + '.json')
    if not os.path.exists(bak_path):
        print('NO BACKUP: {} missing'.format(slug))
        return 0
    # Source of truth: the .geojson.bak file (original GeoJSON, restored from
    # git index). Keep the backup on disk for rollback.
    j = json.load(open(bak_path, encoding='utf-8'))
    if j.get('type') != 'FeatureCollection':
        print('  WARN {}: backup type={} (expected FeatureCollection)'.format(slug, j.get('type')))
    features_flat = []
    tag_counts = {}
    for f in j['features']:
        props = f.get('properties', {})
        coords = f.get('geometry', {}).get('coordinates', [None, None])
        lat = coords[1] if len(coords) > 1 else None
        lng = coords[0] if len(coords) > 0 else None
        tags = {}
        for k, v in props.items():
            if k in ('id', 'type'):
                continue
            if isinstance(v, str) and v != '':
                tags[k] = v
            elif isinstance(v, (int, float, bool)):
                tags[k] = v
        for k in ['name', 'name:en', 'name:ar', 'official_name', 'alt_name',
                  'tourism', 'historic', 'amenity', 'leisure', 'shop', 'office',
                  'cuisine', 'website', 'wikidata', 'man_made', 'building']:
            if k in props and k not in tags and props[k] is not None and props[k] != '':
                tags[k] = props[k]

        flat_f = {
            'id': props.get('id') or f.get('id'),
            'name': props.get('name') or props.get('name:en') or props.get('name:ar') or '',
            'nameAr': props.get('name:ar') or props.get('name') or '',
            'nameEn': props.get('name:en') or props.get('name') or '',
            'lat': lat,
            'lng': lng,
            'tags': tags,
        }
        features_flat.append(flat_f)

        for k, v in tags.items():
            tag_counts.setdefault(k, {})
            tag_counts[k][v] = tag_counts[k].get(v, 0) + 1

    # Flatten tagCounts to keep top few keys (server filter needs it)
    tag_counts_flat = {}
    for k, v_dict in tag_counts.items():
        top = dict(sorted(v_dict.items(), key=lambda x: -x[1])[:8])
        tag_counts_flat[k] = top

    lats = [f['lat'] for f in features_flat if f['lat'] is not None]
    lngs = [f['lng'] for f in features_flat if f['lng'] is not None]
    bounds = {'latMin': round(min(lats), 2) if lats else None, 'latMax': round(max(lats), 2) if lats else None,
              'lngMin': round(min(lngs), 2) if lngs else None, 'lngMax': round(max(lngs), 2) if lngs else None}

    meta = SEED_META[slug]
    flat = {
        'city': meta['city'],
        'name': meta['name'],
        'bounds': bounds,
        'featureCount': len(features_flat),
        'tourismCount': meta['tourismCount'],
        'tagCounts': tag_counts_flat,
        'features': features_flat,
    }
    with open(in_path, 'w', encoding='utf-8') as f:
        json.dump(flat, f, ensure_ascii=False, separators=(',', ':'), indent=None)

    sz = os.path.getsize(in_path)
    poll = sum(1 for f in features_flat if 'addr:housenumber' in f.get('tags', {}))
    tourism = sum(1 for f in features_flat if f['tags'].get('tourism'))
    historic = sum(1 for f in features_flat if f['tags'].get('historic'))
    print('{} -> flat {} B ({} features, {} tourism, {} historic, {} housenumber-pollution)'.format(
        slug, sz, len(features_flat), tourism, historic, poll))
    # Keep .geojson.bak (source of truth) for rollback; don't delete.
    return sz

if __name__ == '__main__':
    for slug in ['alexandria', 'giza', 'nuweiba']:
        convert(slug)
