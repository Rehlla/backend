#!/usr/bin/env python3
"""Sprint 7 final — luxor + aswan (main) + all sub + cruise + admin gates, live server."""
import json, os, urllib.request, urllib.error, sys, io

BASE = 'http://localhost:3111'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOG = os.path.join(ROOT, 'logs', 'final_luxor_aswan_api.json')

ENDPOINTS = [
    ('luxor', '/api/cities/luxor/places'),
    ('aswan', '/api/cities/aswan/places'),
    ('aswan', '/api/cities/aswan/sub/abu_simbel/places'),
    ('sharm', '/api/cities/sharm/sub/ras_mohamed/places'),
    ('nuweiba', '/api/cities/nuweiba/sub/colored_canyon/places'),
    ('alexandria', '/api/cities/alexandria/places'),
    ('giza', '/api/cities/giza/places'),
    ('dahab', '/api/dahab/places'),
    ('cruise', '/api/nile-cruise/routes'),
    ('health', '/api/health'),
    ('admin401', '/api/cities/dahab/admin/stats'),
]

out = []
rows = []
for parent, path in ENDPOINTS:
    try:
        with urllib.request.urlopen(BASE + path, timeout=15) as r:
            b = json.loads(r.read().decode('utf-8'))
            ct = b.get('count') if 'count' in b else b.get('placeCount', len(b.get('stops', [])))
            first = b.get('first', {}).get('name') if isinstance(b.get('first'), dict) else (
                b.get('places', [{}])[0].get('name') if isinstance(b.get('places'), list) else None)
            rows.append('%s | %s | HTTP 200 | count=%s feat=%s first=%s' % (parent, path, r.status, ct, b.get('featureCount'), first))
    except urllib.error.HTTPError as e:
        rows.append('%s | %s | HTTP %s' % (parent, path, e.code))
    except Exception as e:
        rows.append('%s | %s | ERR %s' % (parent, path, str(e)[:60]))

report = {
    'base': BASE,
    'endpoints': rows,
    'file': LOG,
}
os.makedirs(os.path.dirname(LOG), exist_ok=True)
with io.open(LOG, 'w', encoding='utf-8') as f:
    f.write(json.dumps(report, ensure_ascii=False, indent=2) + '\n')

sys.stdout.reconfigure(encoding='utf-8')
print('\n'.join(rows))
print('written', LOG)
