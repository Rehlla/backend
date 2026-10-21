#!/usr/bin/env python3
"""Sprint 6 STEP 7 — final verification of all 10 cities against the LIVE server.

Captures real HTTP status, real counts, real first-3 place names and real
hotel counts for all 10 cities, plus the auth and backward-compat gates.
Writes logs/final_10_cities_api.json. Every value comes from the response body.
"""
import json, os, urllib.request, urllib.error

BASE = 'http://localhost:3111'
CITIES = ['dahab', 'sharm', 'hurghada', 'marsa_alam', 'siwa',
          'nuweiba', 'alexandria', 'giza', 'luxor', 'aswan']
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'logs', 'final_10_cities_api.json')


def get(path):
    try:
        with urllib.request.urlopen(BASE + path, timeout=30) as r:
            raw = r.read().decode('utf-8')
            try:
                return r.status, json.loads(raw)
            except Exception:
                return r.status, {'raw': raw[:300]}
    except urllib.error.HTTPError as e:
        raw = e.read().decode('utf-8', 'replace')
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {'raw': raw[:300]}
    except Exception as e:
        return 0, {'error': str(e)}


def places_of(body):
    for k in ('places', 'features', 'results', 'data'):
        v = body.get(k) if isinstance(body, dict) else None
        if isinstance(v, list):
            return v
    return []


report = {'base': BASE, 'cities': {}, 'gates': {}}

for slug in CITIES:
    st, body = get('/api/cities/%s/places' % slug)
    places = places_of(body)
    st_h, body_h = get('/api/cities/%s/hotels' % slug)
    st_m, body_m = get('/api/cities/%s/meta' % slug)
    report['cities'][slug] = {
        'places': {
            'http': st,
            'count': body.get('count') if isinstance(body, dict) else None,
            'featureCount': body.get('featureCount') if isinstance(body, dict) else None,
            'tourismCount': body.get('tourismCount') if isinstance(body, dict) else None,
            'catalogue': body.get('catalogue') if isinstance(body, dict) else None,
            'first3': [
                {'name': p.get('name'), 'nameAr': p.get('nameAr'), 'lat': p.get('lat'),
                 'lng': p.get('lng'), 'id': p.get('id'), 'tags': p.get('tags')}
                for p in places[:3]
            ],
        },
        'hotels': {'http': st_h, 'count': body_h.get('count') if isinstance(body_h, dict) else None},
        'meta': {
            'http': st_m,
            'featureCount': body_m.get('featureCount') if isinstance(body_m, dict) else None,
            'tourismCount': body_m.get('tourismCount') if isinstance(body_m, dict) else None,
            'catalogue': body_m.get('catalogue') if isinstance(body_m, dict) else None,
        },
    }

for path in ['/api/cities/dahab/admin/stats', '/api/cities/luxor/admin/stats',
             '/api/cities/aswan/admin/stats']:
    st, _ = get(path)
    report['gates'][path] = {'http': st}
st, body = get('/api/dahab/places')
report['gates']['/api/dahab/places'] = {'http': st, 'count': body.get('count') if isinstance(body, dict) else None}
st, _ = get('/api/health')
report['gates']['/api/health'] = {'http': st}

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(report, f, ensure_ascii=False, indent=2)

lines = ['city        http count featCount tourCount catalogue | hotels | first name (real from API)']
for slug, e in report['cities'].items():
    p = e['places']
    lines.append('%-11s %s  %-5s %-9s %-8s %-9s | %-6s | %s' % (
        slug, p['http'], p['count'], p['featureCount'], p['tourismCount'],
        p['catalogue'], e['hotels']['count'], p['first3'][0]['name'] if p['first3'] else '(none)'))
lines.append('')
lines.append('GATES: ' + json.dumps(report['gates'], ensure_ascii=False))
with open(os.path.join(ROOT, 'logs', 'final_10_cities_api.txt'), 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines) + '\n')
print('written', OUT)
