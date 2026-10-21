#!/usr/bin/env python3
"""Sprint 7 — Luxor + Aswan (main cities, re-extracted with the tighter bounds)
+ Abu Simbel (sub-destination under aswan).

Reads the 2.55 GB OSM provincial dump line-by-line and writes FLAT seeds:
  { id, name, nameAr, nameEn, lat, lng, tags, parent? }   -- no geometry / properties
"""
import json, os
SOURCE = r'D:\prototype-full\data\egypt_output\egypt_nodes_full.jsonl'
BASE  = r'D:\dahab-—-travel-platform\Travel.eg'

TOURISM_OK = {
    'attraction','museum','temple','tomb','hotel','restaurant','viewpoint','gallery',
    'artwork','picnic_site','monument','memorial','hostel','guest_house','castle',
    'palace','ruins','theme_park','zoo','aquarium','cultural_centre','beach_resort',
    'camp_site','wilderness_camp','chalet','alpine_hut','motel','guesthouse','arts_centre',
    'cultural_centre','event_venue','nightclub','casino','library','garden',
}
HISTORIC_OK = {
    'temple','tomb','ruins','archaeological_site','monument','memorial','mosque',
    'church','monastery','castle','palace','cemetery','shrine','wayside_cross',
    'wayside_shrine','mausoleum','necropolis','colonnade',
}
AMENITY_OK = {
    'place_of_worship','restaurant','cafe','hotel','bar','fast_food','marketplace',
    'library','museum','community_centre','grave_yard','fuel','bank','pharmacy',
    'ice_cream','internet_cafe','nightclub','theatre','arts_centre','courthouse',
    'monastery','hostel','guest_house','fountain','drinking_water','atm',
}
NATURAL_OK = {
    'cave_entrance','spring','waterfall','peak','hill','rock','crater','sand',
    'valley','cliff','canyon','geyser','hot_spring','beach','volcano','sinkhole',
}
LEISURE_OK = {'park','garden','nature_reserve','picnic_table','playground','pitch','stadium'}

CONFIG = {
    'luxor': {
        'parent': None, 'file': 'data/cities/luxor.json',
        'bounds': {'latMin': 25.60, 'latMax': 25.80, 'lngMin': 32.50, 'lngMax': 32.70},
    },
    'aswan': {
        'parent': None, 'file': 'data/cities/aswan.json',
        'bounds': {'latMin': 23.90, 'latMax': 24.20, 'lngMin': 32.80, 'lngMax': 33.00},
    },
    'abu_simbel': {
        'parent': 'aswan', 'file': 'data/cities/sub/abu_simbel.json',
        'bounds': {'latMin': 22.33, 'latMax': 22.38, 'lngMin': 31.60, 'lngMax': 31.65},
    },
}

def allowed(tags):
    for k, ok in (('tourism', TOURISM_OK), ('historic', HISTORIC_OK),
                  ('amenity', AMENITY_OK), ('natural', NATURAL_OK), ('leisure', LEISURE_OK)):
        v = tags.get(k)
        if isinstance(v, str) and v in ok:
            return True
    return False

def extract(slug):
    cfg = CONFIG[slug]
    b = cfg['bounds']
    feats = []
    with open(SOURCE, 'r', encoding='utf-8', errors='replace') as fh:
        for line in fh:
            line = line.strip()
            if not line or not line.startswith('{'):
                continue
            try:
                node = json.loads(line)
            except Exception:
                continue
            lat = node.get('lat'); lng = node.get('lng')
            if lat is None or lng is None:
                continue
            if not (b['latMin'] <= lat <= b['latMax'] and b['lngMin'] <= lng <= b['lngMax']):
                continue
            tags = node.get('tags') or {}
            name = tags.get('name') or tags.get('name:ar') or tags.get('name:en')
            if not name or not str(name).strip():
                continue
            if not allowed(tags):
                continue
            # pollution exclusions
            if tags.get('addr:housenumber') or tags.get('shop') or tags.get('office'):
                continue
            f = {
                'id': node.get('id'),
                'name': tags.get('name') or tags.get('name:ar') or tags.get('name:en'),
                'nameAr': tags.get('name:ar') or tags.get('name:en') or name,
                'nameEn': tags.get('name:en') or tags.get('name') or name,
                'lat': lat, 'lng': lng,
                'tags': {k: v for k, v in tags.items() if v is not None and str(v) != ''},
            }
            if cfg['parent']:
                f['parent'] = cfg['parent']
            feats.append(f)

    out = os.path.join(BASE, *cfg['file'].split('/'))
    os.makedirs(os.path.dirname(out), exist_ok=True)
    meta = {
        'slug': slug,
        'featureCount': len(feats),
        'tourismCount': sum(1 for f in feats if f['tags'].get('tourism')),
        'bounds': {'latMin': b['latMin'], 'latMax': b['latMax'],
                   'lngMin': b['lngMin'], 'lngMax': b['lngMax']},
        'features': feats,
    }
    if cfg['parent']:
        meta['parent'] = cfg['parent']
    with open(out, 'w', encoding='utf-8') as fh:
        json.dump(meta, fh, ensure_ascii=False, separators=(',', ':'))
    sz = os.path.getsize(out)
    f0 = feats[0] if feats else {}
    poll = sum(1 for f in feats if 'addr:housenumber' in (f.get('tags') or {}))
    print('%s -> %d B (%d features, tourism=%d, poll=%d) flat=%s lat=%s lng=%s parent=%s' % (
        slug, sz, len(feats), meta['tourismCount'], poll,
        'geometry' not in f0 and f0.get('lat') is not None,
        f0.get('lat'), f0.get('lng'), cfg['parent']), flush=True)

if __name__ == '__main__':
    for s in ['luxor', 'aswan', 'abu_simbel']:
        extract(s)
