#!/usr/bin/env python3
"""Sprint 6.1 — sub-destination API verification (live server, post-build)."""
import json, os, urllib.request, urllib.error, io, sys

BASE = 'http://localhost:3111'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOG = os.path.join(ROOT, 'logs', 'sub_destinations_api.json')

ENDPOINTS = [
    ('sharm',  'ras_mohamed',    '/api/cities/sharm/sub'),
    ('sharm',  'ras_mohamed',    '/api/cities/sharm/sub/ras_mohamed/places'),
    ('nuweiba','colored_canyon', '/api/cities/nuweiba/sub'),
    ('nuweiba','colored_canyon', '/api/cities/nuweiba/sub/colored_canyon/places'),
    ('sharm',  None,             '/api/cities/sharm/places'),
    ('nuweiba',None,             '/api/cities/nuweiba/places'),
    ('alexandria', None,         '/api/cities/alexandria/places'),
    ('giza',   None,             '/api/cities/giza/places'),
    ('dahab',  None,             '/api/dahab/places'),
    ('dahab',  None,             '/api/cities/dahab/admin/stats'),
    ('dahab',  None,             '/api/cities/sharm/sub/ras_mohamed/places?x=1'),
    ('health', None,             '/api/health'),
]

def get(path):
    try:
        with urllib.request.urlopen(BASE + path, timeout=30) as r:
            raw = r.read().decode('utf-8', 'replace')
            try: return r.status, json.loads(raw)
            except Exception: return r.status, {'raw': raw[:400]}
    except urllib.error.HTTPError as e:
        raw = e.read().decode('utf-8', 'replace')
        try: return e.code, json.loads(raw)
        except Exception: return e.code, {'raw': raw[:400]}
    except Exception as e:
        return 0, {'error': str(e)}

def first3(body):
    for k in ('places', 'subDestinations'):
        v = body.get(k) if isinstance(body, dict) else None
        if isinstance(v, list):
            return [{'name': x.get('name'), 'nameAr': x.get('nameAr'), 'lat': x.get('lat'),
                     'lng': x.get('lng'), 'parent': x.get('parent'),
                     'tags': x.get('tags'), 'slug': x.get('slug')} for x in v[:3]]
    return []

report = {'base': BASE, 'endpoints': []}
for parent, sub, path in ENDPOINTS:
    st, body = get(path)
    row = {
        'parent': parent, 'sub': sub, 'path': path, 'http': st,
        'count': body.get('count') if isinstance(body, dict) else None,
        'placeCount': body.get('placeCount') if isinstance(body, dict) else None,
        'totalFeatures': body.get('totalFeatures') if isinstance(body, dict) else None,
        'featureCount': body.get('featureCount') if isinstance(body, dict) else None,
        'tourismCount': body.get('tourismCount') if isinstance(body, dict) else None,
        'cityCount': body.get('cityCount') if isinstance(body, dict) else None,
        'subCount': body.get('subCount') if isinstance(body, dict) else None,
        'first3': first3(body),
    }
    report['endpoints'].append(row)

os.makedirs(os.path.dirname(LOG), exist_ok=True)
with io.open(LOG, 'w', encoding='utf-8') as f:
    f.write(json.dumps(report, ensure_ascii=False, indent=2))

out = []
for r in report['endpoints']:
    out.append('%-9s %-10s %-52s %s  count=%-6s feat=%-6s tour=%-5s first=%s' % (
        r['parent'], r['sub'] or '-', r['path'], r['http'], r['count'], r['featureCount'],
        r['tourismCount'], (r['first3'][0]['name'] if r['first3'] else None)))
with io.open(os.path.join(ROOT, 'logs', 'sub_destinations_api.txt'), 'w', encoding='utf-8') as f:
    f.write('=== Sprint 6.1 — sub-destination API verification (live :3111, post-build) ===\n')
    f.write('\n'.join(out) + '\n')
sys.stdout.reconfigure(encoding='utf-8')
print('\n'.join(out))
print('written', LOG)
