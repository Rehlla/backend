#!/usr/bin/env python3
"""Sprint 8 — re-extract the four under-populated cities with wider bounds and a
wider whitelist, writing FLAT utf-8 seeds (ensure_ascii=False so Arabic survives).

saint_catherine : 28.30-28.80 N / 33.70-34.20 E   (was 28.45-28.70 / 33.80-34.10)
taba            : 29.20-29.65 N / 34.60-35.00 E   (was 29.35-29.60 / 34.75-34.95)
luxor           : 25.50-25.90 N / 32.40-32.80 E   (was 25.60-25.80 / 32.50-32.70)
aswan           : 23.80-24.30 N / 32.70-33.10 E   (was 23.90-24.20 / 32.80-33.00)
"""
import json, os

SOURCE = r'D:\prototype-full\data\egypt_output\egypt_nodes_full.jsonl'
BASE  = r'D:\dahab-—-travel-platform\Travel.eg'

TOURISM_OK = {
    'attraction','museum','temple','tomb','hotel','restaurant','viewpoint','gallery',
    'artwork','picnic_site','monument','memorial','hostel','guest_house','guesthouse',
    'castle','palace','ruins','theme_park','zoo','aquarium','cultural_centre','arts_centre',
    'beach_resort','camp_site','wilderness_camp','wilderness_hut','chalet','alpine_hut',
    'motel','diving','snorkeling','scuba_diving','resort','fort','castle','fortress',
    'shrine','spring','sauna','garden','park','nature_reserve','sculpture','city_gate',
    'caravan_site','dive_centre','boatyard','marina','harbour','fishing_village',
}
HISTORIC_OK = {
    'temple','tomb','ruins','archaeological_site','monastery','church','memorial','mosque',
    'castle','palace','fort','fortress','cemetery','shrine','wayside_cross','wayside_shrine',
    'mausoleum','necropolis','colonnade','city_gate','gatehouse','kirk','cathedral',
    'archaeological_site','city_wall','wall','tower','beacon','military',
}
AMENITY_OK = {
    'place_of_worship','shrine','monastery','religious_christian','religious_muslim',
    'restaurant','cafe','fast_food','hotel','hostel','guest_house','bar','pub','nightclub',
    'marketplace','library','museum','community_centre','grave_yard','shelter','campsite',
    'drinking_water','fountain','theatre','arts_centre','ice_cream','food_court','bus_station',
    'ferry_terminal','harbour','marina','fuel','pharmacy','bank','atm','university','school',
}
NATURAL_OK = {
    'peak','cave','cave_entrance','rock','gorge','valley','bay','beach','reef','island',
    'spring','waterfall','crater','sand','cliff','canyon','volcano','hill','saddle','wetland',
    'wood','scrub','bare_rock','hot_spring','geyser','sinkhole','desert','shingle','mud',
}
LEISURE_OK = {
    'park','garden','nature_reserve','picnic_table','playground','pitch','stadium',
    'fitness_station','marina','slipway','swimming_area','fitness_centre','sports_centre',
}

CONFIG = {
    'saint_catherine': {
        'file': 'data/cities/saint_catherine.json', 'parent': None,
        'bounds': {'latMin': 28.30, 'latMax': 28.80, 'lngMin': 33.70, 'lngMax': 34.20},
    },
    'taba': {
        'file': 'data/cities/taba.json', 'parent': None,
        'bounds': {'latMin': 29.20, 'latMax': 29.65, 'lngMin': 34.60, 'lngMax': 35.00},
    },
    'luxor': {
        'file': 'data/cities/luxor.json', 'parent': None,
        'bounds': {'latMin': 25.50, 'latMax': 25.90, 'lngMin': 32.40, 'lngMax': 32.80},
    },
    'aswan': {
        'file': 'data/cities/aswan.json', 'parent': None,
        'bounds': {'latMin': 23.80, 'latMax': 24.30, 'lngMin': 32.70, 'lngMax': 33.10},
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
    # ensure_ascii=False keeps Arabic readable in the file itself
    with open(out, 'w', encoding='utf-8') as fh:
        json.dump(meta, fh, ensure_ascii=False, separators=(',', ':'))
    sz = os.path.getsize(out)
    f0 = feats[0] if feats else {}
    poll = sum(1 for f in feats if 'addr:housenumber' in (f.get('tags') or {}))
    print('%s -> %d B (%d features, tourism=%d, poll=%d) flat=%s first=%r lat=%s lng=%s' % (
        slug, sz, len(feats), meta['tourismCount'], poll,
        'geometry' not in f0 and f0.get('lat') is not None,
        f0.get('nameAr'), f0.get('lat'), f0.get('lng')), flush=True)

if __name__ == '__main__':
    for s in ['saint_catherine', 'taba', 'luxor', 'aswan']:
        extract(s)
