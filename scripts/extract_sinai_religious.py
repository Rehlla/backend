#!/usr/bin/env python3
"""Sprint 6b — Saint Catherine (Sinai religious/mountain) + Taba (Sinai boat/border)."""
import json, os, time
SOURCE = r'D:\prototype-full\data\egypt_output\egypt_nodes_full.jsonl'
BASE = r'D:\dahab-—-travel-platform\Travel.eg'
BOUNDS = {
    'saint_catherine': {'latMin':28.45,'latMax':28.70,'lngMin':33.80,'lngMax':34.10,'city':'saint_catherine','name':'Saint Catherine'},
    'taba': {'latMin':29.35,'latMax':29.60,'lngMin':34.75,'lngMax':34.95,'city':'taba','name':'Taba'},
}
WHITELIST = {'attraction','museum','monastery','church','mosque','hotel','camp_site','viewpoint','peak','temple'}

def extract(slug):
    b = BOUNDS[slug]
    feats = []; tag_counts = {}
    with open(SOURCE,'r',encoding='utf-8',errors='replace') as fh:
        for line in fh:
            line=line.strip()
            if not line or not line.startswith('{'):
                continue
            try: node = json.loads(line)
            except: continue
            lat = node.get('lat'); lng = node.get('lng')
            if lat is None or lng is None: continue
            if not (b['latMin'] <= lat <= b['latMax'] and b['lngMin'] <= lng <= b['lngMax']):
                continue
            tags = node.get('tags') or {}
            if not tags: continue
            name = tags.get('name') or tags.get('name:ar') or tags.get('name:en')
            if not name or str(name).strip() == '': continue
            # allow religious/historic/whitelist plus monastery/temple specifically
            has_whitelist = False
            for k,v in tags.items():
                if k in ('tourism','historic','amenity') and isinstance(v,str) and v in WHITELIST:
                    has_whitelist = True; break
                if k == 'historic' and isinstance(v,str) and v in ('monastery','church','ruins','temple'):
                    has_whitelist = True; break
            if not has_whitelist: continue
            if tags.get('addr:housenumber') or tags.get('shop') or tags.get('office'):
                continue
            flat_f = {
                'id': node.get('id'), 'name': name,
                'nameAr': tags.get('name:ar') or name,
                'nameEn': tags.get('name:en') or name,
                'lat': lat, 'lng': lng,
                'tags': {k:v for k,v in tags.items() if v is not None and str(v)!=''},
            }
            feats.append(flat_f)
            for k,v in tags.items():
                if v is not None and str(v)!='':
                    tag_counts.setdefault(k,{}); tag_counts[k][str(v)] = tag_counts[k].get(str(v),0)+1
    # Meta
    lats = [f['lat'] for f in feats if f['lat'] is not None]
    lngs = [f['lng'] for f in feats if f['lng'] is not None]
    bounds = {'latMin':round(min(lats),2) if lats else None,'latMax':round(max(lats),2) if lats else None,'lngMin':round(min(lngs),2) if lngs else None,'lngMax':round(max(lngs),2) if lngs else None}
    tag_counts_flat = {k: dict(sorted(v_dict.items(), key=lambda x: -x[1])[:8]) for k,v_dict in tag_counts.items()}
    flat = {
        'city': slug, 'name': b['name'], 'bounds': bounds,
        'featureCount': len(feats),
        'tourismCount': sum(1 for f in feats if f['tags'].get('tourism')),
        'tagCounts': tag_counts_flat,
        'features': feats,
    }
    out = os.path.join(BASE, 'data', 'cities', slug+'.json')
    with open(out,'w',encoding='utf-8') as f: json.dump(flat, f, ensure_ascii=False, separators=(',',':'), indent=None)
    sz = os.path.getsize(out)
    poll = sum(1 for f in feats if 'addr:housenumber' in f.get('tags',{}))
    f0 = feats[0] if feats else {}
    print('%s -> %d B (%d features, tourism=%d, poll=%d) lat=%s lng=%s flat=%s' % (slug, sz, len(feats), flat['tourismCount'], poll, f0.get('lat'), f0.get('lng'), 'geometry' not in f0 and f0.get('lat') is not None))
    return sz, len(feats)

if __name__ == '__main__':
    for slug in ['saint_catherine', 'taba']:
        extract(slug)
